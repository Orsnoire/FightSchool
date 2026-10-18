import { type AbilityContext } from "@shared/combat/abilityValues";
import { getTotalMechanicUpgrades, getTotalPassiveBonuses } from "@shared/jobSystem";
import { ALL_CHARACTER_CLASSES, calculateCharacterStats, type CharacterClass, type EquipmentItemDb, type EquipmentStats, type StudentJobLevel } from "@shared/schema";
import { equipmentEffects } from "@shared/tier-one-equipment";

import type { LobbyStudent } from "./types";

export function createLobbyPreview(student: LobbyStudent, jobLevels: StudentJobLevel[], equippedItems: EquipmentItemDb[]) {
  const previewLevels = Object.fromEntries(ALL_CHARACTER_CLASSES.map(job => [job, jobLevels.find(row => row.jobClass === job)?.level || 0])) as Record<CharacterClass, number>;
  const previewEquipment: EquipmentStats = { str: 0, int: 0, agi: 0, mnd: 0, vit: 0, def: 0, atk: 0, mat: 0, rtk: 0 };
  for (const item of equippedItems) for (const key of Object.keys(previewEquipment) as (keyof EquipmentStats)[]) previewEquipment[key] += item.stats[key] || 0;
  const previewStats = calculateCharacterStats(student.characterClass, previewEquipment, getTotalPassiveBonuses(previewLevels), getTotalMechanicUpgrades(previewLevels));
  const previewPlayer: AbilityContext = {    
equipmentEffects: equipmentEffects(student), characterClass: student.characterClass, stats: previewStats, jobLevels: previewLevels,
    health: previewStats.maxHp, maxHealth: previewStats.maxHp,
    mp: student.characterClass === "wizard" ? Math.floor(previewStats.maxMp / 2) : previewStats.maxMp,
    healingPotions: 5, shieldPotions: 0, consecutiveCorrectAnswers: 0  
};
  return { previewStats, previewPlayer };
}
