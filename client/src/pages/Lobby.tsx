import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PlayerAvatar } from "@/components/PlayerAvatar";
import { type Student, type EquipmentSlot, type StudentJobLevel, type CharacterClass, type EquipmentItemDb } from "@shared/schema";
import { LogOut, Swords, BarChart3, TrendingUp, Sword, Shield, Crown } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Link } from "wouter";
import { getTotalPassiveBonuses } from "@shared/jobSystem";
import { useQuery } from "@tanstack/react-query";

const RARITY_COLORS = {
  common: "border-gray-400",
  rare: "border-blue-500",
  epic: "border-purple-500",
  legendary: "border-yellow-500",
};

export default function Lobby() {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const [student, setStudent] = useState<Student | null>(null);
  const [jobLevels, setJobLevels] = useState<StudentJobLevel[]>([]);
  const [selectedSlot, setSelectedSlot] = useState<EquipmentSlot>("weapon");
  const [fightCode, setFightCode] = useState("");
  const studentId = localStorage.getItem("studentId");

  useEffect(() => {
    const loadStudent = async () => {
      const response = await fetch(`/api/student/${studentId}`);
      if (response.ok) {
        const data = await response.json();
        // Redirect to character selection if not completed
        if (!data.characterClass || !data.gender) {
          navigate("/student/character-select");
          return;
        }
        setStudent(data);
      }
    };
    
    const loadJobLevels = async () => {
      const response = await fetch(`/api/student/${studentId}/job-levels`);
      if (response.ok) {
        setJobLevels(await response.json());
      }
    };
    
    loadStudent();
    loadJobLevels();
  }, [studentId, navigate]);

  // Fetch equipped items
  const equippedItemIds = [student?.weapon, student?.headgear, student?.armor].filter(Boolean) as string[];
  const { data: equippedItems = [] } = useQuery<EquipmentItemDb[]>({
    queryKey: ['equipment-items', { ids: equippedItemIds.sort() }],
    queryFn: async () => {
      if (equippedItemIds.length === 0) return [];
      const response = await fetch(`/api/equipment-items?ids=${equippedItemIds.join(',')}`);
      return response.json();
    },
    enabled: equippedItemIds.length > 0,
  });

  // Fetch inventory items
  const inventoryIds = student?.inventory || [];
  const { data: inventoryItems = [] } = useQuery<EquipmentItemDb[]>({
    queryKey: ['equipment-items', { ids: inventoryIds.sort() }],
    queryFn: async () => {
      if (inventoryIds.length === 0) return [];
      const response = await fetch(`/api/equipment-items?ids=${inventoryIds.join(',')}`);
      return response.json();
    },
    enabled: inventoryIds.length > 0,
  });

  // Create a lookup map for equipped items
  const equippedItemsMap = (equippedItems || []).reduce((acc: Record<string, EquipmentItemDb>, item: EquipmentItemDb) => {
    acc[item.id] = item;
    return acc;
  }, {} as Record<string, EquipmentItemDb>);

  const joinFight = async () => {
    if (!fightCode.trim()) {
      toast({ title: "Please enter a fight code", variant: "destructive" });
      return;
    }

    // Check if an active fight exists with this class code
    const response = await fetch(`/api/fights/active/${fightCode}`);
    if (!response.ok) {
      const errorData = await response.json();
      toast({ 
        title: "Cannot join fight", 
        description: errorData.error || "Invalid class code or fight not active", 
        variant: "destructive" 
      });
      return;
    }

    const fight = await response.json();
    localStorage.setItem("fightId", fight.id);
    navigate("/student/combat");
  };

  const updateEquipment = async (slot: EquipmentSlot, itemId: string) => {
    const studentId = localStorage.getItem("studentId");
    const response = await fetch(`/api/student/${studentId}/equipment`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ [slot]: itemId }),
    });

    if (response.ok) {
      setStudent(await response.json());
      toast({ title: "Equipment updated!" });
    }
  };

  const handleLogout = () => {
    localStorage.removeItem("studentId");
    navigate("/student/login");
  };

  if (!student || !student.characterClass || !student.gender) {
    return <div className="min-h-screen bg-background flex items-center justify-center">Loading...</div>;
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-50 border-b border-border bg-card">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <h1 className="text-2xl font-serif font-bold" data-testid="text-lobby-title">
            Battle Lobby
          </h1>
          <div className="flex gap-2">
            <Link href={`/student/${studentId}/stats`}>
              <Button variant="outline" data-testid="button-view-stats">
                <BarChart3 className="mr-2 h-4 w-4" />
                Stats
              </Button>
            </Link>
            <Button variant="ghost" onClick={handleLogout} data-testid="button-logout">
              <LogOut className="mr-2 h-4 w-4" />
              Logout
            </Button>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-8">
          <div className="lg:col-span-2">
            <Card>
              <CardHeader>
                <CardTitle>Your Character</CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col items-center gap-4">
                <PlayerAvatar
                  characterClass={student.characterClass}
                  gender={student.gender}
                  size="lg"
                />
                <div className="text-center">
                  <h2 className="text-2xl font-bold" data-testid="text-nickname">{student.nickname}</h2>
                  <p className="text-muted-foreground capitalize">{student.characterClass}</p>
                </div>
                <div className="w-full space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Weapon:</span>
                    <span className="font-semibold capitalize" data-testid="text-weapon">
                      {student.weapon ? equippedItemsMap[student.weapon]?.name || "None" : "None"}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Headgear:</span>
                    <span className="font-semibold capitalize" data-testid="text-headgear">
                      {student.headgear ? equippedItemsMap[student.headgear]?.name || "None" : "None"}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Armor:</span>
                    <span className="font-semibold capitalize" data-testid="text-armor">
                      {student.armor ? equippedItemsMap[student.armor]?.name || "None" : "None"}
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="mt-4">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <TrendingUp className="h-5 w-5 text-primary" />
                  Class Progression
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {(() => {
                  // Convert job levels array to map
                  const jobLevelMap: Record<CharacterClass, number> = {
                    warrior: 0, wizard: 0, scout: 0, herbalist: 0,
                    knight: 0, paladin: 0, dark_knight: 0, sage: 0, ranger: 0, druid: 0, monk: 0,
                  };
                  
                  jobLevels.forEach(jl => {
                    jobLevelMap[jl.jobClass] = jl.level;
                  });
                  
                  const currentClassLevel = jobLevelMap[student.characterClass] || 0;
                  const currentJobLevel = jobLevels.find(jl => jl.jobClass === student.characterClass);
                  const currentExp = currentJobLevel?.experience || 0;
                  const passiveBonuses = getTotalPassiveBonuses(jobLevelMap);
                  
                  return (
                    <>
                      <div className="text-center p-3 bg-muted rounded-lg">
                        <div className="text-sm text-muted-foreground">Current Class Level</div>
                        <div className="text-3xl font-bold text-primary capitalize">
                          {student.characterClass} Lv{currentClassLevel}
                        </div>
                        <div className="text-sm text-muted-foreground mt-1" data-testid="text-experience">
                          {currentExp} XP
                        </div>
                      </div>
                      
                      <div className="space-y-2">
                        <div className="text-sm font-semibold text-muted-foreground">Passive Bonuses</div>
                        <div className="grid grid-cols-3 gap-2 text-center">
                          <div className="p-2 bg-muted rounded">
                            <div className="text-xs text-muted-foreground">HP</div>
                            <div className="font-bold text-health">+{passiveBonuses.hp || 0}</div>
                          </div>
                          <div className="p-2 bg-muted rounded">
                            <div className="text-xs text-muted-foreground">ATK</div>
                            <div className="font-bold text-damage">+{passiveBonuses.attack || 0}</div>
                          </div>
                          <div className="p-2 bg-muted rounded">
                            <div className="text-xs text-muted-foreground">DEF</div>
                            <div className="font-bold text-primary">+{passiveBonuses.defense || 0}</div>
                          </div>
                        </div>
                      </div>
                      
                      {jobLevels.length > 1 && (
                        <div className="space-y-1">
                          <div className="text-xs text-muted-foreground">Other Jobs</div>
                          <div className="flex flex-wrap gap-1">
                            {jobLevels
                              .filter(jl => jl.jobClass !== student.characterClass)
                              .map(jl => (
                                <span 
                                  key={jl.jobClass}
                                  className="text-xs px-2 py-1 bg-muted rounded capitalize"
                                >
                                  {jl.jobClass} Lv{jl.level}
                                </span>
                              ))}
                          </div>
                        </div>
                      )}
                    </>
                  );
                })()}
              </CardContent>
            </Card>

            <Card className="mt-4">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Swords className="h-5 w-5 text-primary" />
                  Join Battle
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label htmlFor="fight-code">Class Code</Label>
                  <Input
                    id="fight-code"
                    value={fightCode}
                    onChange={(e) => setFightCode(e.target.value)}
                    placeholder="Enter class code from your teacher"
                    data-testid="input-fight-code"
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        joinFight();
                      }
                    }}
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    Your teacher will give you a class code to enter here
                  </p>
                </div>
                <Button onClick={joinFight} className="w-full" data-testid="button-join-fight">
                  <Swords className="mr-2 h-4 w-4" />
                  Join Battle
                </Button>
              </CardContent>
            </Card>
          </div>

          <div className="lg:col-span-3">
            <Card>
              <CardHeader>
                <CardTitle>Equipment</CardTitle>
                <div className="flex gap-2 mt-4">
                  {(["weapon", "headgear", "armor"] as EquipmentSlot[]).map((slot) => (
                    <Button
                      key={slot}
                      variant={selectedSlot === slot ? "default" : "outline"}
                      onClick={() => setSelectedSlot(slot)}
                      className="capitalize"
                      data-testid={`button-slot-${slot}`}
                    >
                      {slot}
                    </Button>
                  ))}
                </div>
              </CardHeader>
              <CardContent>
                {inventoryItems.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <p>No equipment in inventory</p>
                    <p className="text-xs mt-2">Defeat enemies to collect loot!</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                    {inventoryItems
                      .filter((item) => item.slot === selectedSlot)
                      .map((item) => {
                        const isEquipped =
                          student[selectedSlot as keyof Pick<Student, "weapon" | "headgear" | "armor">] === item.id;

                        return (
                          <Card
                            key={item.id}
                            className={`cursor-pointer hover-elevate ${
                              isEquipped ? "ring-2 ring-primary" : ""
                            } border-2 ${RARITY_COLORS[item.quality as keyof typeof RARITY_COLORS]}`}
                            onClick={() => updateEquipment(selectedSlot, item.id)}
                            data-testid={`item-${item.id}`}
                          >
                            <CardContent className="p-4 text-center">
                              <div className="h-16 flex items-center justify-center mb-2">
                                {item.iconUrl ? (
                                  <img src={item.iconUrl} alt={item.name} className="h-12 w-12" />
                                ) : (
                                  <div className="text-muted-foreground">
                                    {item.slot === "weapon" && <Sword className="h-12 w-12" />}
                                    {item.slot === "armor" && <Shield className="h-12 w-12" />}
                                    {item.slot === "headgear" && <Crown className="h-12 w-12" />}
                                  </div>
                                )}
                              </div>
                              <p className="font-semibold text-sm">{item.name}</p>
                              <p className="text-xs text-muted-foreground capitalize">{item.quality}</p>
                              <div className="text-xs mt-1 space-y-0.5">
                                {item.hpBonus > 0 && <div className="text-health">+{item.hpBonus} HP</div>}
                                {item.attackBonus > 0 && <div className="text-damage">+{item.attackBonus} ATK</div>}
                                {item.defenseBonus > 0 && <div className="text-primary">+{item.defenseBonus} DEF</div>}
                              </div>
                            </CardContent>
                          </Card>
                        );
                      })}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </main>
    </div>
  );
}
