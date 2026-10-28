import grassland from '@/assets/campaign-v1/battle-grassland.webp';
import cave from '@/assets/campaign-v1/battle-cave.webp';
import type { CombatSnapshot } from '@shared/combat/model';

export function BattleScenery({ environment }: { environment?: CombatSnapshot['battleEnvironment'] }) {
  return <img className="battle-scenery" src={environment === 'normal_cave' ? cave : grassland}
    data-environment={environment || 'grassland'} alt="" aria-hidden="true" decoding="async" />;
}
