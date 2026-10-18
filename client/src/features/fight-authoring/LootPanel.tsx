import { Button } from "@/components/ui/button";
import { Card,CardContent,CardHeader,CardTitle } from "@/components/ui/card";
import { Select,SelectContent,SelectItem,SelectTrigger,SelectValue } from "@/components/ui/select";
import { TabsContent } from "@/components/ui/tabs";
import { type EquipmentItemDb,type LootItem } from "@shared/schema";
import { Trash2 } from "lucide-react";



interface LootPanelProps {
  lootTable: LootItem[];
  teacherEquipment: EquipmentItemDb[];
  equipmentLoading: boolean;
  onChange: (loot: LootItem[]) => void;
}
export function LootPanel({ lootTable, teacherEquipment, equipmentLoading, onChange }: LootPanelProps) {
  const addLootItem = (itemId: string) => {
    const newLootTable = [...lootTable, { itemId }];
    onChange(newLootTable);
  };

  const removeLootItem = (index: number) => {
    const newLootTable = lootTable.filter((_, i) => i !== index);
    onChange(newLootTable);
  };

  return (
              <TabsContent value="loot" className="space-y-4">
                <Card>
                  <CardHeader>
                    <CardTitle>Add Loot Item</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div>
                      <label className="text-sm font-medium">Select Equipment</label>
                      {equipmentLoading ? (
                        <p className="text-sm text-muted-foreground">Loading equipment...</p>
                      ) : teacherEquipment.length === 0 ? (
                        <p className="text-sm text-muted-foreground">No equipment items found. Create items in the Item Management page first.</p>
                      ) : (
                        <Select value="" onValueChange={(value) => addLootItem(value)}>
                          <SelectTrigger data-testid="select-loot-item">
                            <SelectValue placeholder="Choose an item to add" />
                          </SelectTrigger>
                          <SelectContent>
                            {teacherEquipment
                              .filter(item => !lootTable.some(l => l.itemId === item.id))
                              .map(item => (
                                <SelectItem key={item.id} value={item.id}>
                                  {item.name} ({item.quality}) - {item.slot}
                                </SelectItem>
                              ))}
                          </SelectContent>
                        </Select>
                      )}
                      <p className="text-sm text-muted-foreground mt-2">Students can choose ONE item from this loot table OR take XP instead</p>
                    </div>
                  </CardContent>
                </Card>

                {lootTable.length > 0 && (
                  <Card>
                    <CardHeader>
                      <CardTitle>Loot Table ({lootTable.length})</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2">
                      {lootTable.map((loot, i) => {
                        const item = teacherEquipment.find(eq => eq.id === loot.itemId);
                        if (!item) return null;
                        return (
                          <div key={i} className="flex items-center justify-between p-3 border border-border rounded-md" data-testid={`loot-item-${i}`}>
                            <div>
                              <p className="font-medium">{item.name}</p>
                              <p className="text-sm text-muted-foreground capitalize">
                                {item.quality} | {item.slot} | 
                                {item.stats.vit ? ` +${item.stats.vit} HP` : ''}
                                {item.stats.atk ? ` +${item.stats.atk} ATK` : ''}
                                {item.stats.def ? ` +${item.stats.def} DEF` : ''}
                              </p>
                            </div>
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              onClick={() => removeLootItem(i)}
                              data-testid={`button-delete-loot-${i}`}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        );
                      })}
                    </CardContent>
                  </Card>
                )}
              </TabsContent>
  );
}
