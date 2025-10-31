import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { ShoppingBag, Coins, ArrowLeft, Sword, Shield, Crown, Lock } from "lucide-react";
import type { Student, Guild, Quest } from "@shared/schema";

interface EquipmentItemStats {
  str?: number;
  int?: number;
  agi?: number;
  mnd?: number;
  vit?: number;
  def?: number;
  atk?: number;
  mat?: number;
  rtk?: number;
}

interface EquipmentItemDb {
  id: string;
  name: string;
  iconUrl: string | null;
  itemType: string;
  quality: string;
  tier: number;
  slot: string;
  shopPrice: number | null;
  isPurchasable: boolean;
  stats: EquipmentItemStats;
}

export default function GuildShop() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [selectedSlot, setSelectedSlot] = useState<string>("all");
  const studentId = localStorage.getItem("studentId");

  // Fetch student data
  const { data: student, isLoading: studentLoading } = useQuery<Student>({
    queryKey: [`/api/student/${studentId}`],
    enabled: !!studentId,
  });

  // Fetch guild data
  const { data: guild } = useQuery<Guild>({
    queryKey: [`/api/guild/${student?.guildId}`],
    enabled: !!student?.guildId,
  });

  // Fetch guild quests to determine unlocked tiers
  const { data: guildQuests = [] } = useQuery<Quest[]>({
    queryKey: [`/api/guild/${student?.guildId}/quests`],
    enabled: !!student?.guildId,
  });

  // Calculate highest unlocked tier from completed guild quests
  const unlockedTier = guildQuests
    .filter((q) => q.questType === "guild" && q.completedAt && q.rewards?.unlockTier)
    .reduce((max, q) => Math.max(max, q.rewards?.unlockTier || 0), 1);

  // Fetch all purchasable equipment items (scoped to student's guild)
  const { data: shopItems = [], isLoading: itemsLoading } = useQuery<EquipmentItemDb[]>({
    queryKey: ["/api/equipment-items/shop", studentId],
    queryFn: async () => {
      if (!studentId) return [];
      const response = await fetch(`/api/equipment-items/shop?studentId=${studentId}`);
      if (!response.ok) return [];
      return response.json();
    },
    enabled: !!studentId,
  });

  // Filter items by unlocked tier and selected slot
  const availableItems = (shopItems || []).filter(
    (item) =>
      item.isPurchasable &&
      item.shopPrice !== null &&
      item.tier <= unlockedTier &&
      (selectedSlot === "all" || item.slot === selectedSlot)
  );

  // Group items by tier
  const itemsByTier = availableItems.reduce((acc, item) => {
    if (!acc[item.tier]) acc[item.tier] = [];
    acc[item.tier].push(item);
    return acc;
  }, {} as Record<number, EquipmentItemDb[]>);

  const purchaseMutation = {
    mutate: async ({ itemId, price }: { itemId: string; price: number }) => {
      if (!studentId) return;

      try {
        await apiRequest("POST", `/api/student/${studentId}/purchase-item`, {
          itemId,
          price,
        });

        toast({
          title: "Purchase Successful!",
          description: "Item added to your inventory",
        });

        // Invalidate relevant queries
        queryClient.invalidateQueries({ queryKey: [`/api/student/${studentId}`] });
        queryClient.invalidateQueries({ queryKey: [`/api/student/${studentId}/currency`] });
      } catch (error: any) {
        toast({
          title: "Purchase Failed",
          description: error.message || "Not enough gold or item unavailable",
          variant: "destructive",
        });
      }
    },
  };

  const getQualityColor = (quality: string) => {
    switch (quality) {
      case "common":
        return "text-muted-foreground";
      case "uncommon":
        return "text-green-600 dark:text-green-400";
      case "rare":
        return "text-blue-600 dark:text-blue-400";
      case "epic":
        return "text-purple-600 dark:text-purple-400";
      case "legendary":
        return "text-orange-600 dark:text-orange-400";
      default:
        return "text-muted-foreground";
    }
  };

  const getSlotIcon = (slot: string) => {
    switch (slot) {
      case "weapon":
        return <Sword className="h-4 w-4" />;
      case "armor":
        return <Shield className="h-4 w-4" />;
      case "headgear":
        return <Crown className="h-4 w-4" />;
      default:
        return null;
    }
  };

  if (studentLoading || itemsLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-pulse text-muted-foreground">Loading shop...</div>
      </div>
    );
  }

  if (!student || !student.guildId) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Card>
          <CardHeader>
            <CardTitle>Guild Shop Unavailable</CardTitle>
            <CardDescription>You must join a guild to access the shop</CardDescription>
          </CardHeader>
          <CardFooter>
            <Button onClick={() => setLocation("/student/lobby")} data-testid="button-back-lobby">
              Return to Lobby
            </Button>
          </CardFooter>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-50 border-b border-border bg-card">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setLocation("/student/lobby")}
              data-testid="button-back"
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              <h1 className="text-2xl font-serif font-bold text-foreground" data-testid="text-title">
                Guild Shop
              </h1>
              <p className="text-sm text-muted-foreground">
                {guild?.name || "Your Guild"} • Tier {unlockedTier} Unlocked
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 px-3 py-2 rounded-md bg-primary/10">
            <Coins className="h-5 w-5 text-primary" />
            <span className="font-semibold text-foreground" data-testid="text-gold-balance">
              {student.gold || 0}
            </span>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <div className="mb-6">
          <Tabs value={selectedSlot} onValueChange={setSelectedSlot}>
            <TabsList data-testid="tabs-slot-filter">
              <TabsTrigger value="all" data-testid="tab-all">All Items</TabsTrigger>
              <TabsTrigger value="weapon" data-testid="tab-weapon">Weapons</TabsTrigger>
              <TabsTrigger value="armor" data-testid="tab-armor">Armor</TabsTrigger>
              <TabsTrigger value="headgear" data-testid="tab-headgear">Headgear</TabsTrigger>
            </TabsList>
          </Tabs>
        </div>

        {Object.keys(itemsByTier).length === 0 ? (
          <Card>
            <CardHeader>
              <CardTitle>No Items Available</CardTitle>
              <CardDescription>
                Complete guild quests to unlock higher tier equipment
              </CardDescription>
            </CardHeader>
          </Card>
        ) : (
          <div className="space-y-8">
            {Object.keys(itemsByTier)
              .sort((a, b) => Number(b) - Number(a))
              .map((tier) => (
                <div key={tier}>
                  <div className="flex items-center gap-2 mb-4">
                    <h2 className="text-xl font-serif font-bold" data-testid={`text-tier-${tier}`}>
                      Tier {tier}
                    </h2>
                    <Badge variant="secondary">
                      {itemsByTier[Number(tier)].length} items
                    </Badge>
                  </div>
                  <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                    {itemsByTier[Number(tier)].map((item) => (
                      <Card
                        key={item.id}
                        className="hover-elevate"
                        data-testid={`card-item-${item.id}`}
                      >
                        <CardHeader className="gap-1 space-y-0 pb-2">
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex items-center gap-2">
                              {getSlotIcon(item.slot)}
                              <CardTitle className={`text-lg ${getQualityColor(item.quality)}`}>
                                {item.name}
                              </CardTitle>
                            </div>
                            <Badge variant="outline" className="capitalize">
                              {item.quality}
                            </Badge>
                          </div>
                          <CardDescription className="capitalize">{item.slot}</CardDescription>
                        </CardHeader>
                        <CardContent>
                          <div className="grid grid-cols-2 gap-2 text-sm">
                            {(item.stats.str || 0) > 0 && (
                              <div>
                                <span className="text-muted-foreground">STR:</span>{" "}
                                <span className="font-semibold">+{item.stats.str}</span>
                              </div>
                            )}
                            {(item.stats.int || 0) > 0 && (
                              <div>
                                <span className="text-muted-foreground">INT:</span>{" "}
                                <span className="font-semibold">+{item.stats.int}</span>
                              </div>
                            )}
                            {(item.stats.agi || 0) > 0 && (
                              <div>
                                <span className="text-muted-foreground">AGI:</span>{" "}
                                <span className="font-semibold">+{item.stats.agi}</span>
                              </div>
                            )}
                            {(item.stats.mnd || 0) > 0 && (
                              <div>
                                <span className="text-muted-foreground">MND:</span>{" "}
                                <span className="font-semibold">+{item.stats.mnd}</span>
                              </div>
                            )}
                            {(item.stats.vit || 0) > 0 && (
                              <div>
                                <span className="text-muted-foreground">VIT:</span>{" "}
                                <span className="font-semibold">+{item.stats.vit}</span>
                              </div>
                            )}
                            {(item.stats.def || 0) > 0 && (
                              <div>
                                <span className="text-muted-foreground">DEF:</span>{" "}
                                <span className="font-semibold">+{item.stats.def}</span>
                              </div>
                            )}
                            {(item.stats.atk || 0) > 0 && (
                              <div>
                                <span className="text-muted-foreground">ATK:</span>{" "}
                                <span className="font-semibold">+{item.stats.atk}</span>
                              </div>
                            )}
                            {(item.stats.mat || 0) > 0 && (
                              <div>
                                <span className="text-muted-foreground">MAT:</span>{" "}
                                <span className="font-semibold">+{item.stats.mat}</span>
                              </div>
                            )}
                            {(item.stats.rtk || 0) > 0 && (
                              <div>
                                <span className="text-muted-foreground">RTK:</span>{" "}
                                <span className="font-semibold">+{item.stats.rtk}</span>
                              </div>
                            )}
                          </div>
                        </CardContent>
                        <CardFooter>
                          <Button
                            className="w-full"
                            onClick={() =>
                              purchaseMutation.mutate({
                                itemId: item.id,
                                price: item.shopPrice!,
                              })
                            }
                            disabled={(student.gold || 0) < (item.shopPrice || 0)}
                            data-testid={`button-purchase-${item.id}`}
                          >
                            <Coins className="h-4 w-4 mr-2" />
                            {item.shopPrice} Gold
                          </Button>
                        </CardFooter>
                      </Card>
                    ))}
                  </div>
                </div>
              ))}
          </div>
        )}

        {/* Locked Tiers Preview */}
        {unlockedTier < 5 && (
          <div className="mt-8">
            <h2 className="text-xl font-serif font-bold mb-4 flex items-center gap-2">
              <Lock className="h-5 w-5 text-muted-foreground" />
              Locked Tiers
            </h2>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {[unlockedTier + 1, unlockedTier + 2].filter((t) => t <= 5).map((tier) => (
                <Card key={tier} className="opacity-60" data-testid={`card-locked-tier-${tier}`}>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Lock className="h-4 w-4" />
                      Tier {tier}
                    </CardTitle>
                    <CardDescription>
                      Complete guild quests to unlock this tier
                    </CardDescription>
                  </CardHeader>
                </Card>
              ))}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
