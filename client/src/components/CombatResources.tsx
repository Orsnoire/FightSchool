import type { CombatPlayer } from "@shared/combat/model";
import { Heart, Sparkles, FlaskConical, Shield, Zap } from "lucide-react";

export function CombatResources({ player: p }: { player: CombatPlayer }) {
  const potions = p.availableAbilities.some((id) => id.includes("potion"));
  return (
    <div aria-label="Your resources" className="flex flex-wrap gap-x-4 gap-y-2 text-sm tabular-nums">
      <span className="inline-flex items-center gap-1"><Heart aria-hidden size={16} /> HP {p.health}/{p.maxHealth}</span>
      {p.maxMp > 0 && <span className="inline-flex items-center gap-1"><Sparkles aria-hidden size={16} /> MP {p.mp}/{p.maxMp}</span>}
      {p.maxComboPoints > 0 && <span className="inline-flex items-center gap-1"><Zap aria-hidden size={16} /> Combo {p.comboPoints}/{p.maxComboPoints}</span>}
      {potions && <span className="inline-flex items-center gap-1"><FlaskConical aria-hidden size={16} /> Healing potions {p.healingPotions}/5</span>}
      {p.availableAbilities.some((id) => id.includes("shield_potion")) && <span className="inline-flex items-center gap-1"><Shield aria-hidden size={16} /> Shield potions {p.shieldPotions}/3</span>}
    </div>
  );
}
