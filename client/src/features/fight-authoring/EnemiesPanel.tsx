import { EnemyAIEditor } from "@/components/EnemyAIEditor";
import { EnemySwarmEditor } from "@/components/EnemySwarmEditor";
import { PaletteEditor } from "@/components/PaletteEditor";
import { RecoloredSprite } from "@/components/RecoloredSprite";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { TabsContent } from "@/components/ui/tabs";
import {
  closestCenter,
  DndContext
} from '@dnd-kit/core';
import {
  SortableContext,
  verticalListSortingStrategy
} from '@dnd-kit/sortable';
import { ROLE_SHARES } from "@shared/combat/encounters";
import { ENEMY_TYPES } from "@shared/combat/enemy-ai";
import { ENEMY_CATALOG } from "@shared/combat/enemy-catalog";
import { ENEMY_ROLE_LABELS, ENEMY_ROLES, enemyTuning } from "@shared/encounter-tiers";
import { type Enemy, type InsertFight } from "@shared/schema";
import { Image as ImageIcon, PlusCircle } from "lucide-react";


import { SortableEnemyItem } from "./SortableEnemyItem";
import type { useEnemyAuthoring } from "./useEnemyAuthoring";

interface EnemiesPanelProps {
  enemies: Enemy[];
  onChange: (enemies: Enemy[]) => void;
  encounterTier: number | null | undefined;
  enemyDisplayMode: InsertFight['enemyDisplayMode'];
  changeTier: (tier: number) => void;
  editor: ReturnType<typeof useEnemyAuthoring>;
}
export function EnemiesPanel({ enemies, onChange, encounterTier, enemyDisplayMode, changeTier, editor }: EnemiesPanelProps) {
  const { currentEnemy, setCurrentEnemy, editingEnemyIndex, setEditingEnemyIndex, uploadedEnemyImage, setUploadedEnemyImage, enemyImageInputRef, handleEnemyImageUpload, addEnemy, editEnemy, sensors, handleDragEnd } = editor;
  return (
    <TabsContent value="enemies" className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>{editingEnemyIndex !== null ? 'Edit Enemy' : 'Add Enemy'}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <label className="text-sm font-medium">Enemy Name</label>
            <Input
              value={currentEnemy.name || ""}
              onChange={(e) => setCurrentEnemy({ ...currentEnemy, name: e.target.value })}
              placeholder="Frost Zombie"
              data-testid="input-enemy-name"
            />
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm font-medium">Enemy Image</label>
              <div>
                <input
                  ref={enemyImageInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleEnemyImageUpload}
                  className="hidden"
                  data-testid="input-enemy-image-upload"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => enemyImageInputRef.current?.click()}
                  data-testid="button-upload-enemy-image"
                >
                  <ImageIcon className="h-4 w-4 mr-2" />
                  Upload Custom Image
                </Button>
              </div>
            </div>
            <p className="text-xs text-muted-foreground mb-2">Choose one creature sprite; quantity controls how many appear. Custom images are resized to 120×120px.</p>
            <div className="grid grid-cols-5 gap-3 mt-2 max-h-96 overflow-y-auto pr-2">
              {uploadedEnemyImage && (
                <button
                  type="button"
                  onClick={() => setCurrentEnemy({ ...currentEnemy, image: uploadedEnemyImage, species: "other" })}
                  className={`p-2 border-2 rounded-md hover-elevate ${currentEnemy.image === uploadedEnemyImage ? "border-primary" : "border-border"
                    }`}
                  data-testid="button-select-uploaded"
                >
                  <img src={uploadedEnemyImage} alt="Custom Upload" className="w-full h-20 object-cover rounded" />
                  <p className="text-xs mt-1 truncate">Custom</p>
                </button>
              )}
              {ENEMY_TYPES.map(id => ({ id, img: ENEMY_CATALOG[id].image, name: ENEMY_CATALOG[id].name })).map((enemy) => (
                <button
                  key={enemy.id}
                  type="button"
                  onClick={() => setCurrentEnemy({
                    ...currentEnemy, image: enemy.img, enemyType: enemy.id,
                    species: enemy.id === "goblin" ? "goblin" : "other", name: currentEnemy.name || enemy.name,
                    quantity: Math.max(ENEMY_CATALOG[enemy.id].minimumQuantity, currentEnemy.quantity || 1), ai: undefined
                  })}
                  className={`p-2 border-2 rounded-md hover-elevate ${currentEnemy.image === enemy.img ? "border-primary" : "border-border"
                    }`}
                  data-testid={`button-select-${enemy.id}`}
                >
                  <img src={enemy.img} alt={enemy.name} className="w-full h-20 object-contain rounded" />
                  <p className="text-xs mt-1 truncate">{enemy.name}</p>
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <label>Quantity<input aria-label="Enemy quantity" type="number" min={currentEnemy.enemyType === "goblin" ? 5 : 1} max="60" value={currentEnemy.quantity || 1} onChange={e => setCurrentEnemy({ ...currentEnemy, quantity: Math.max(currentEnemy.enemyType === "goblin" ? 5 : 1, Math.min(60, +e.target.value)) })} className="block w-full p-2 border rounded bg-background" /></label>
            {enemyDisplayMode === 'consecutive' && <label>Wave<input aria-label="Enemy wave" type="number" min="1" max="20" value={currentEnemy.wave || 1} onChange={e => setCurrentEnemy({ ...currentEnemy, wave: Math.max(1, Math.min(20, +e.target.value)) })} className="block w-full p-2 border rounded bg-background" /></label>}
          </div>
          <p className="text-xs text-muted-foreground">Enemies assigned to the same wave fight together. Hosted fights pause between waves; HP and MP carry forward.</p>
          <fieldset className="space-y-3 border rounded-lg p-4"><legend className="px-2 font-medium">Enemy role</legend>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">{ENEMY_ROLES.map(role => <label key={role} className={`flex items-center gap-2 rounded border p-3 cursor-pointer ${currentEnemy.role === role ? 'border-primary bg-primary/10' : ''}`}><input type="radio" name="enemy-role" value={role} checked={currentEnemy.role === role} onChange={() => { if (!encounterTier) changeTier(1); setCurrentEnemy(e => ({ ...e, role, difficultyMultiplier: enemyTuning(encounterTier || 1, role).difficultyMultiplier })); }} />{ENEMY_ROLE_LABELS[role]}</label>)}</div>
            <p className="text-sm text-muted-foreground">{Math.round(ROLE_SHARES[currentEnemy.role || 'normal'] * 100)}% of the full fight HP budget is shared by all enemies of this role across every wave. Missing roles leave their allocation unused. Goblin trash gets +1% of its allocation per three goblins.</p>
          </fieldset>

          <div className="flex items-center justify-center rounded bg-slate-800 p-3"><RecoloredSprite src={currentEnemy.image || ENEMY_CATALOG.zombie.image} palette={currentEnemy.palette} alt="Enemy color preview" className="h-36 w-36 object-contain" /></div>
          <PaletteEditor value={currentEnemy.palette} onChange={palette => setCurrentEnemy({ ...currentEnemy, palette })} />
          <EnemySwarmEditor enemy={currentEnemy} onChange={setCurrentEnemy} />
          <EnemyAIEditor enemy={currentEnemy} onChange={setCurrentEnemy} />
          <Button type="button" onClick={addEnemy} className="w-full" data-testid={editingEnemyIndex !== null ? "button-update-enemy" : "button-add-enemy"}>
            <PlusCircle className="mr-2 h-4 w-4" />
            {editingEnemyIndex !== null ? 'Update Enemy' : 'Add Enemy'}
          </Button>
          {editingEnemyIndex !== null && (
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setEditingEnemyIndex(null);
                setCurrentEnemy({ image: ENEMY_CATALOG.zombie.image, difficultyMultiplier: 10, role: "normal", quantity: 1, wave: currentEnemy.wave || 1 });
                setUploadedEnemyImage(null);
              }}
              className="w-full"
              data-testid="button-cancel-edit-enemy"
            >
              Cancel Edit
            </Button>
          )}
        </CardContent>
      </Card>

      {enemies.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Enemies ({enemies.reduce((n, e) => n + (e.quantity || 1), 0)}) · {enemies.length} groups</CardTitle>
            <p className="text-sm text-muted-foreground">Drag to set target-bounce order within each wave. Edit a group to change its quantity or wave.</p>
          </CardHeader>
          <CardContent className="space-y-2">
            {enemies.every(e => e.quantity === undefined) && <Button type="button" variant="outline" onClick={() => changeTier(encounterTier || 1)}>Convert to individual enemies and wave budgets</Button>}
            {enemyDisplayMode === 'consecutive' && enemies.some(e => e.quantity !== undefined) && <div className="grid gap-2 sm:grid-cols-2">{[...new Set(enemies.map((e, i) => e.wave || i + 1))].sort((a, b) => a - b).map(wave => <div key={wave} className="rounded border p-2 text-sm"><strong>Wave {wave}</strong><p>{enemies.filter((e, i) => (e.wave || i + 1) === wave).map(e => `${e.name} × ${e.quantity || 1}`).join(', ')}</p></div>)}</div>}
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragEnd={handleDragEnd}
            >
              <SortableContext
                items={enemies.map(e => e.id)}
                strategy={verticalListSortingStrategy}
              >
                {enemies.map((enemy, i) => (
                  <SortableEnemyItem
                    key={enemy.id}
                    enemy={enemy}
                    index={i}
                    onEdit={() => editEnemy(i)}
                    onDelete={() => {
                      const updated = enemies.filter((_, idx) => idx !== i);
                      onChange(updated);
                    }}
                  />
                ))}
              </SortableContext>
            </DndContext>
          </CardContent>
        </Card>
      )}
    </TabsContent>

  );
}
