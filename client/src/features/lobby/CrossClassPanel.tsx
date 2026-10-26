import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DndContext, DragEndEvent, DragOverlay, DragStartEvent, PointerSensor, TouchSensor, useSensor, useSensors } from "@dnd-kit/core";
import { ABILITY_DISPLAYS } from "@shared/abilityUI";
import { getCrossClassAbilities, type Ability } from "@shared/jobSystem";
import { aaRankTier, resolveAAEffects } from '@shared/aa';
import { crossClassSelections } from '@shared/job-loadouts';
import { effectiveLevels } from '@shared/quests';
import type { CharacterClass, StudentJobLevel } from "@shared/schema";
import { Sparkles } from "lucide-react";
import { useState } from "react";
import { Link } from 'wouter';
import { AbilityIcon, AbilitySlot, DraggableAbility } from "./AbilityDragItems";
import type { LobbyStudent } from "./types";

export function CrossClassPanel({ student, jobLevels, updateCrossClassAbility, tier: initialTier = 4 }: {
  student: LobbyStudent; jobLevels: StudentJobLevel[]; tier?: number;
  updateCrossClassAbility: (slot: number, abilityId: string | null) => Promise<void>;
}) {
  const [tier, setTier] = useState(initialTier);
  const [draggedAbility, setDraggedAbility] = useState<Ability | null>(null);
  const [abilityFilter, setAbilityFilter] = useState('all');
  const [saving, setSaving] = useState(false);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 250, tolerance: 5 } }));
  const levels = Object.fromEntries(jobLevels.map(row => [row.jobClass, row.level])) as Record<CharacterClass, number>;
  const available = getCrossClassAbilities(student.characterClass, levels);
  const active = getCrossClassAbilities(student.characterClass, effectiveLevels(levels, tier) as Record<CharacterClass, number>);
  const ownedCapacity = 2 + resolveAAEffects(student.aaRanks, 4).extraSlots;
  const activeCapacity = 2 + resolveAAEffects(student.aaRanks, tier).extraSlots;
  const selected = crossClassSelections(student);
  const filtered = abilityFilter === 'all' ? available : available.filter(ability => ABILITY_DISPLAYS[ability.id]?.abilityClass?.includes(abilityFilter as any));
  const save = async (slot: number, id: string | null) => {
    if (saving || slot > ownedCapacity || slot > activeCapacity) return;
    setSaving(true);
    try { await updateCrossClassAbility(slot, id); } finally { setSaving(false); }
  };
  const handleDragEnd = (event: DragEndEvent) => {
    setDraggedAbility(null);
    const slot = Number(String(event.over?.id || '').replace('slot-', ''));
    const ability = event.active.data.current?.ability as Ability | undefined;
    if (Number.isInteger(slot) && slot >= 1 && slot <= 5 && ability && active.some(a => a.id === ability.id)) void save(slot, ability.id);
  };
  return <Card data-testid="card-cross-class-abilities">
    <CardHeader><CardTitle className="flex items-center gap-2"><Sparkles className="h-5 w-5 text-primary" />Cross-Class Abilities</CardTitle>
      <p className="text-sm text-muted-foreground">{ownedCapacity} owned slots · {activeCapacity} active at Tier {tier}. Two base slots plus up to three AA slots.</p>
      <label className="block text-sm">Ability power preview
        <select aria-label="Ability power preview" value={tier} onChange={e => setTier(Number(e.target.value))} className="ml-2 rounded border bg-background p-2">
          <option value={4}>Full loadout · Tier 4</option>{[1,2,3].map(value=><option key={value} value={value}>Preview Tier {value}</option>)}
        </select>
      </label>
      <p className="text-xs text-muted-foreground">Abilities still require their other class's level. Lower-tier fights preserve your saved assignments.</p>
      <Link href="/student/advancement" className="text-sm underline">Unlock more slots with AA</Link>
    </CardHeader>
    <CardContent>
      <DndContext sensors={sensors} onDragStart={(event: DragStartEvent) => setDraggedAbility(event.active.data.current?.ability || null)} onDragEnd={handleDragEnd}>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {Array.from({ length: 5 }, (_, index) => {
            const slot = index + 1, unlocked = slot <= ownedCapacity, enabled = slot <= activeCapacity;
            const equipped = available.find(a => a.id === selected[index]);
            const eligible = !!equipped && active.some(a => a.id === equipped.id);
            return <div key={slot} className="min-w-0 space-y-2">
              <p className="text-sm font-medium">Ability Slot {slot}{slot > 2 ? ` · AA rank ${slot - 2} · Tier ${aaRankTier(slot - 2)}` : ' · Base'}</p>
              <AbilitySlot slotNumber={slot} equippedAbility={equipped} isLocked={!unlocked || !enabled} onRemove={() => { void save(slot, null); }} />
              {!unlocked ? <p className="text-xs text-muted-foreground">Purchase Cross-class slots rank {slot - 2}.</p>
                : !enabled ? <p className="text-xs text-muted-foreground">Inactive at Tier {tier}{equipped ? ` · Saved: ${equipped.name}` : ''}</p>
                : <label className="block text-xs">Choose slot {slot} ability
                  <select aria-label={`Ability Slot ${slot}`} data-testid={`select-ability-${slot}`} className="mt-1 w-full rounded border bg-background p-2 text-sm"
                    disabled={saving} value={selected[index] || ''} onChange={event => { void save(slot, event.target.value || null); }}>
                    <option value="">None</option>
                    {available.filter(a => a.id === selected[index] || !selected.includes(a.id)).map(a => <option key={a.id} value={a.id} disabled={!active.some(x => x.id === a.id)}>{a.name}{!active.some(x => x.id === a.id) ? ' · Tier restricted' : ''}</option>)}
                  </select>
                </label>}
              {equipped && enabled && !eligible && <p className="text-xs text-muted-foreground">Saved ability is inactive at this tier.</p>}
            </div>;
          })}
        </div>
        {!available.length && <p className="py-4 text-sm text-muted-foreground">No cross-class abilities unlocked yet. Level other jobs to their cross-class milestones.</p>}
        <div className="flex flex-wrap gap-2 mt-4" aria-label="Ability filters">
          {['all', 'healing', 'spell', 'physical', 'ultimate'].map(filter => <Button key={filter} size="sm" variant={abilityFilter === filter ? 'default' : 'outline'}
            data-testid={`filter-${filter}`} onClick={() => setAbilityFilter(filter)}>{filter[0].toUpperCase() + filter.slice(1)}</Button>)}
        </div>
        <div className="grid grid-cols-5 sm:grid-cols-8 gap-2 mt-3">{filtered.map(ability => <DraggableAbility key={ability.id} ability={ability} />)}</div>
        <p className="text-xs text-muted-foreground mt-3">Drag an ability to a slot, or use its selection menu. Right-click or long-press an icon for details.</p>
        <DragOverlay>{draggedAbility && <AbilityIcon ability={draggedAbility} isDragging />}</DragOverlay>
      </DndContext>
    </CardContent>
  </Card>;
}
