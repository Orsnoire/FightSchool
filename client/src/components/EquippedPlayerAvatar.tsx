import type { CombatPlayer } from '@shared/combat/model';
import { initialAppearance } from '@shared/avatar/appearance';
import { StaticAvatar } from './StaticAvatar';

/** One appearance/loadout projection for the battlefield and the smaller map. */
export function EquippedPlayerAvatar({ player, className, label }: {
  player: Pick<CombatPlayer, 'appearance' | 'gender' | 'characterClass' | 'equipmentLoadout' | 'equipmentVisuals'>;
  className?: string; label?: string;
}) {
  return <StaticAvatar appearance={player.appearance || initialAppearance(null, player.gender === 'B' ? 'human-female-v1' : 'human-male-v1', () => .35)}
    job={player.characterClass} loadout={player.equipmentLoadout} visuals={player.equipmentVisuals} className={className} label={label} />;
}
