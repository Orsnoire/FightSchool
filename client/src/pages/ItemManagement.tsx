import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, PlusCircle, Pencil, Trash2, Upload } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useTeacherAuth } from "@/hooks/useTeacherAuth";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { insertEquipmentItemSchema, type EquipmentItemDb, type ItemType, type ItemQuality, type EquipmentSlot } from "@shared/schema";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { z } from "zod";

const itemFormSchema = insertEquipmentItemSchema.extend({
  stats: z.object({
    str: z.coerce.number().min(0).optional(),
    int: z.coerce.number().min(0).optional(),
    agi: z.coerce.number().min(0).optional(),
    mnd: z.coerce.number().min(0).optional(),
    vit: z.coerce.number().min(0).optional(),
    atk: z.coerce.number().min(0).optional(),
    mat: z.coerce.number().min(0).optional(),
    rtk: z.coerce.number().min(0).optional(),
    def: z.coerce.number().min(0).optional(),
  }).optional(),
});

type ItemFormData = z.infer<typeof itemFormSchema>;

const ITEM_TYPES: ItemType[] = ["sword", "wand", "bow", "staff", "herbs", "two-handed-sword", "fist", "claws", "harp", "spoon", "light_armor", "leather_armor", "armor", "helmet", "cap", "hat", "consumable"];
const ITEM_QUALITIES: ItemQuality[] = ["common", "rare", "epic", "legendary"];
const EQUIPMENT_SLOTS: EquipmentSlot[] = ["weapon", "headgear", "armor"];

const QUALITY_COLORS = {
  common: "bg-slate-500",
  rare: "bg-blue-500",
  epic: "bg-purple-500",
  legendary: "bg-amber-500",
};

type FilterType = 'all' | ItemType | EquipmentSlot;

export default function ItemManagement() {
  const { toast } = useToast();
  const { isAuthenticated, isChecking } = useTeacherAuth();
  const teacherId = localStorage.getItem("teacherId");
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<EquipmentItemDb | null>(null);
  const [activeFilter, setActiveFilter] = useState<FilterType>('all');

  const { data: items, isLoading } = useQuery<EquipmentItemDb[]>({
    queryKey: [`/api/teacher/${teacherId}/equipment-items`],
    enabled: !!teacherId,
  });

  // Filter items based on active filter
  const filteredItems = items?.filter(item => {
    if (activeFilter === 'all') return true;
    if (activeFilter === 'weapon' || activeFilter === 'headgear' || activeFilter === 'armor') {
      return item.slot === activeFilter;
    }
    return item.itemType === activeFilter;
  }) || [];

  const form = useForm<ItemFormData>({
    resolver: zodResolver(itemFormSchema),
    defaultValues: {
      teacherId: teacherId || "",
      name: "",
      itemType: "sword",
      quality: "common",
      slot: "weapon",
      iconUrl: null,
      stats: {
        str: 0,
        int: 0,
        agi: 0,
        mnd: 0,
        vit: 0,
        atk: 0,
        mat: 0,
        rtk: 0,
        def: 0,
      },
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: ItemFormData) => {
      const response = await apiRequest("POST", "/api/equipment-items", data);
      return await response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/teacher/${teacherId}/equipment-items`] });
      setCreateDialogOpen(false);
      form.reset();
      toast({ title: "Item created!", description: "Your equipment item has been added" });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<ItemFormData> }) => {
      const response = await apiRequest("PATCH", `/api/equipment-items/${id}`, data);
      return await response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/teacher/${teacherId}/equipment-items`] });
      setEditingItem(null);
      form.reset();
      toast({ title: "Item updated!", description: "Your equipment item has been updated" });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const response = await apiRequest("DELETE", `/api/equipment-items/${id}`);
      return await response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/teacher/${teacherId}/equipment-items`] });
      toast({ title: "Item deleted", description: "Equipment item has been removed" });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });


  const onSubmit = (data: ItemFormData) => {
    if (editingItem) {
      updateMutation.mutate({ id: editingItem.id, data });
    } else {
      createMutation.mutate(data);
    }
  };

  const openEditDialog = (item: EquipmentItemDb) => {
    setEditingItem(item);
    form.reset({
      teacherId: item.teacherId,
      name: item.name,
      itemType: item.itemType,
      quality: item.quality,
      slot: item.slot,
      iconUrl: item.iconUrl,
      stats: {
        str: item.stats?.str || 0,
        int: item.stats?.int || 0,
        agi: item.stats?.agi || 0,
        mnd: item.stats?.mnd || 0,
        vit: item.stats?.vit || 0,
        atk: item.stats?.atk || 0,
        mat: item.stats?.mat || 0,
        rtk: item.stats?.rtk || 0,
        def: item.stats?.def || 0,
      },
    });
  };

  const closeDialog = () => {
    setCreateDialogOpen(false);
    setEditingItem(null);
    form.reset();
  };

  if (isChecking) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-900 via-indigo-900 to-blue-950 flex items-center justify-center">
        <div className="text-white text-xl">Verifying session...</div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return null; // Will redirect to login
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-900 via-indigo-900 to-blue-950">
      <header className="sticky top-0 z-50 border-b border-border bg-card">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/teacher">
              <Button variant="ghost" size="icon" data-testid="button-back">
                <ArrowLeft className="h-5 w-5" />
              </Button>
            </Link>
            <h1 className="text-2xl font-serif font-bold text-primary" data-testid="text-title">
              Item Management
            </h1>
          </div>
          <Dialog open={createDialogOpen || !!editingItem} onOpenChange={(open) => !open && closeDialog()}>
            <DialogTrigger asChild>
              <Button data-testid="button-create-item" onClick={() => setCreateDialogOpen(true)}>
                <PlusCircle className="mr-2 h-5 w-5" />
                Create Item
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>{editingItem ? "Edit Equipment Item" : "Create Equipment Item"}</DialogTitle>
              </DialogHeader>
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                  <FormField
                    control={form.control}
                    name="name"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Item Name</FormLabel>
                        <FormControl>
                          <Input placeholder="Epic Sword of Power" {...field} data-testid="input-item-name" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <div className="grid grid-cols-3 gap-4">
                    <FormField
                      control={form.control}
                      name="itemType"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Item Type</FormLabel>
                          <Select onValueChange={field.onChange} value={field.value}>
                            <FormControl>
                              <SelectTrigger data-testid="select-item-type">
                                <SelectValue placeholder="Select type" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {ITEM_TYPES.map((type) => (
                                <SelectItem key={type} value={type}>
                                  {type.replace("_", " ")}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="quality"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Quality</FormLabel>
                          <Select onValueChange={field.onChange} value={field.value}>
                            <FormControl>
                              <SelectTrigger data-testid="select-quality">
                                <SelectValue placeholder="Select quality" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {ITEM_QUALITIES.map((quality) => (
                                <SelectItem key={quality} value={quality}>
                                  {quality}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="slot"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Equipment Slot</FormLabel>
                          <Select onValueChange={field.onChange} value={field.value}>
                            <FormControl>
                              <SelectTrigger data-testid="select-slot">
                                <SelectValue placeholder="Select slot" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {EQUIPMENT_SLOTS.map((slot) => (
                                <SelectItem key={slot} value={slot}>
                                  {slot}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <FormField
                    control={form.control}
                    name="iconUrl"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Item Icon URL (optional)</FormLabel>
                        <FormControl>
                          <div className="flex gap-2 items-center">
                            <Input
                              placeholder="https://example.com/icon.png"
                              {...field}
                              value={field.value || ""}
                              data-testid="input-icon-url"
                            />
                            {field.value && (
                              <img src={field.value} alt="Icon preview" className="h-10 w-10 object-cover rounded" />
                            )}
                          </div>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <div className="space-y-4">
                    <h3 className="text-sm font-semibold text-muted-foreground">Base Stats</h3>
                    <div className="grid grid-cols-3 gap-4">
                      <FormField
                        control={form.control}
                        name="stats.str"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>STR (Strength)</FormLabel>
                            <FormControl>
                              <Input type="number" min="0" {...field} data-testid="input-stat-str" />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="stats.int"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>INT (Intelligence)</FormLabel>
                            <FormControl>
                              <Input type="number" min="0" {...field} data-testid="input-stat-int" />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="stats.agi"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>AGI (Agility)</FormLabel>
                            <FormControl>
                              <Input type="number" min="0" {...field} data-testid="input-stat-agi" />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>

                    <div className="grid grid-cols-3 gap-4">
                      <FormField
                        control={form.control}
                        name="stats.mnd"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>MND (Mind)</FormLabel>
                            <FormControl>
                              <Input type="number" min="0" {...field} data-testid="input-stat-mnd" />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="stats.vit"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>VIT (Vitality)</FormLabel>
                            <FormControl>
                              <Input type="number" min="0" {...field} data-testid="input-stat-vit" />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="stats.def"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>DEF (Defense)</FormLabel>
                            <FormControl>
                              <Input type="number" min="0" {...field} data-testid="input-stat-def" />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>

                    <h3 className="text-sm font-semibold text-muted-foreground pt-2">Combat Stats</h3>
                    <div className="grid grid-cols-3 gap-4">
                      <FormField
                        control={form.control}
                        name="stats.atk"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>ATK (Physical Attack)</FormLabel>
                            <FormControl>
                              <Input type="number" min="0" {...field} data-testid="input-stat-atk" />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="stats.mat"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>MAT (Magic Attack)</FormLabel>
                            <FormControl>
                              <Input type="number" min="0" {...field} data-testid="input-stat-mat" />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="stats.rtk"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>RTK (Ranged Attack)</FormLabel>
                            <FormControl>
                              <Input type="number" min="0" {...field} data-testid="input-stat-rtk" />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                  </div>

                  <DialogFooter>
                    <Button type="button" variant="outline" onClick={closeDialog} data-testid="button-cancel">
                      Cancel
                    </Button>
                    <Button type="submit" disabled={createMutation.isPending || updateMutation.isPending} data-testid="button-save-item">
                      {editingItem ? "Update Item" : "Create Item"}
                    </Button>
                  </DialogFooter>
                </form>
              </Form>
            </DialogContent>
          </Dialog>
        </div>
      </header>

      <div className="container mx-auto px-4 py-8">
        {/* Filter Section */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Filter Items</CardTitle>
            <CardDescription>Show items by type or category</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              <Button
                variant={activeFilter === 'all' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setActiveFilter('all')}
                data-testid="filter-all"
              >
                All
              </Button>
              
              {/* Slot filters */}
              <div className="w-px h-8 bg-border mx-2" />
              <Button
                variant={activeFilter === 'weapon' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setActiveFilter('weapon')}
                data-testid="filter-weapon-slot"
              >
                Weapons
              </Button>
              <Button
                variant={activeFilter === 'headgear' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setActiveFilter('headgear')}
                data-testid="filter-headgear-slot"
              >
                Headgear
              </Button>
              <Button
                variant={activeFilter === 'armor' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setActiveFilter('armor')}
                data-testid="filter-armor-slot"
              >
                Body Armor
              </Button>
              
              {/* Weapon type filters */}
              <div className="w-px h-8 bg-border mx-2" />
              {(['sword', 'staff', 'bow', 'herbs', 'two-handed-sword', 'fist', 'claws', 'harp', 'spoon'] as const).map((type) => (
                <Button
                  key={type}
                  variant={activeFilter === type ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setActiveFilter(type)}
                  data-testid={`filter-${type}`}
                >
                  {type === 'two-handed-sword' ? '2H Sword' : type.charAt(0).toUpperCase() + type.slice(1)}
                </Button>
              ))}
              
              {/* Armor type filters */}
              <div className="w-px h-8 bg-border mx-2" />
              {(['light_armor', 'leather_armor', 'helmet'] as const).map((type) => (
                <Button
                  key={type}
                  variant={activeFilter === type ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setActiveFilter(type)}
                  data-testid={`filter-${type}`}
                >
                  {type.replace('_', ' ').split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')}
                </Button>
              ))}
            </div>
          </CardContent>
        </Card>

        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[1, 2, 3].map((i) => (
              <Card key={i}>
                <CardContent className="p-6">
                  <div className="h-32 bg-muted animate-pulse rounded" />
                </CardContent>
              </Card>
            ))}
          </div>
        ) : filteredItems && filteredItems.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredItems.map((item) => (
              <Card key={item.id} className="hover-elevate" data-testid={`item-card-${item.id}`}>
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      {item.iconUrl && (
                        <img src={item.iconUrl} alt={item.name} className="h-12 w-12 object-cover rounded" data-testid={`item-icon-${item.id}`} />
                      )}
                      <div>
                        <CardTitle className="text-lg" data-testid={`item-name-${item.id}`}>{item.name}</CardTitle>
                        <CardDescription data-testid={`item-type-${item.id}`}>{item.itemType.replace("_", " ")}</CardDescription>
                      </div>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <Badge className={QUALITY_COLORS[item.quality]} data-testid={`item-quality-${item.id}`}>
                        {item.quality}
                      </Badge>
                      <Badge variant="outline" data-testid={`item-slot-${item.id}`}>{item.slot}</Badge>
                    </div>
                    <div className="text-sm space-y-1">
                      {item.stats && Object.entries(item.stats).map(([stat, value]) => {
                        if (!value || value === 0) return null;
                        const statLabels: Record<string, string> = {
                          str: "STR",
                          int: "INT",
                          agi: "AGI",
                          mnd: "MND",
                          vit: "VIT",
                          atk: "ATK",
                          mat: "MAT",
                          rtk: "RTK",
                          def: "DEF",
                        };
                        return (
                          <p key={stat} data-testid={`item-stat-${stat}-${item.id}`}>
                            {statLabels[stat] || stat.toUpperCase()} +{value}
                          </p>
                        );
                      })}
                    </div>
                  </div>
                </CardContent>
                <CardFooter className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => openEditDialog(item)}
                    data-testid={`button-edit-${item.id}`}
                  >
                    <Pencil className="h-4 w-4 mr-2" />
                    Edit
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => deleteMutation.mutate(item.id)}
                    disabled={deleteMutation.isPending}
                    data-testid={`button-delete-${item.id}`}
                  >
                    <Trash2 className="h-4 w-4 mr-2" />
                    Delete
                  </Button>
                </CardFooter>
              </Card>
            ))}
          </div>
        ) : (
          <div className="text-center py-12">
            <PlusCircle className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
            <h2 className="text-xl font-semibold mb-2">No Equipment Items Yet</h2>
            <p className="text-muted-foreground mb-6">
              Create custom equipment items to add to your fight loot tables
            </p>
            <Button onClick={() => setCreateDialogOpen(true)} data-testid="button-create-first-item">
              <PlusCircle className="mr-2 h-5 w-5" />
              Create Your First Item
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
