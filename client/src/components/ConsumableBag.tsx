import { bagWeight, CONSUMABLES, CONSUMABLE_IDS, consumableProblem, type ConsumableId } from '@shared/campaign/consumables';
import type { CombatPlayer } from '@shared/combat/model';
import { Button } from './ui/button';

export function ConsumableBag({ player, disabled, onUse, combat = false }: {
  player: CombatPlayer; disabled: boolean; onUse: (id: ConsumableId) => void; combat?: boolean;
}) {
  const bag = player.consumables || {};
  return <details className="space-y-3 max-h-[45dvh] overflow-y-auto overscroll-contain" data-testid="consumable-bag">
    <summary className="cursor-pointer font-semibold">Items · Weight {bagWeight(bag)}</summary>
    <p className="text-sm">Each item weighs 1. No carry limit in this playtest. {combat ? 'One item per round, before Ready. Cures work while disabled.' : 'Bought items are separate from job healing charges.'}</p>
    {!CONSUMABLE_IDS.some(id => bag[id]) && <p className="text-sm">Your bag is empty. Visit the item shop (S) in town.</p>}
    {CONSUMABLE_IDS.filter(id => bag[id]).map(id => {
      const item = CONSUMABLES[id], problem = consumableProblem(player, id);
      return <div key={id} className="rounded border p-3 space-y-2">
        <strong>{item.name} ×{bag[id]}</strong><p className="text-sm">{item.description}</p>
        <Button size="sm" variant="outline" className="h-auto whitespace-normal py-2 text-left" disabled={disabled || !!problem} title={problem} onClick={() => onUse(id)}>Use {item.name}</Button>
        {problem && <p className="text-xs text-muted-foreground">{problem}</p>}
      </div>;
    })}
    {!!Object.keys(player.itemProtections || {}).length && <p className="text-sm">Protection: {Object.entries(player.itemProtections || {}).map(([id, turns]) => `${id} · ${turns} enemy turns`).join('; ')}</p>}
  </details>;
}
