import { availableAbilities } from '@shared/combat/abilities';
import { crossClassSelections } from '@shared/job-loadouts';
import { type AbilityContext } from "@shared/combat/abilityValues";
import { getTotalMechanicUpgrades, getTotalPassiveBonuses } from "@shared/jobSystem";
import { ALL_CHARACTER_CLASSES, calculateCharacterStats, type CharacterClass, type EquipmentItemDb, type StudentJobLevel } from "@shared/schema";
import { equipmentEffects } from "@shared/tier-one-equipment";
import { effectiveLevels } from '@shared/quests';
import { projectCombatLoadout } from '@shared/combat/loadout';

import type { LobbyStudent } from "./types";

export function createLobbyPreview(student: LobbyStudent, jobLevels: StudentJobLevel[], equippedItems: EquipmentItemDb[], tier = 4) {
  const previewLevels = effectiveLevels(Object.fromEntries(ALL_CHARACTER_CLASSES.map(job => [job, jobLevels.find(row => row.jobClass === job)?.level || 0])), tier) as Record<CharacterClass, number>;
  const { equipment: previewEquipment, advancement, loadout } = projectCombatLoadout(student.characterClass, student, previewLevels[student.characterClass] || 1, student.aaRanks, tier, equippedItems);
  const previewStats = calculateCharacterStats(student.characterClass, previewEquipment, getTotalPassiveBonuses(previewLevels), getTotalMechanicUpgrades(previewLevels), advancement);
  const previewPlayer: AbilityContext = {    
advancement, availableAbilities: availableAbilities(student.characterClass, previewLevels, crossClassSelections(student).slice(0, 2 + advancement.extraSlots).filter((id): id is string => !!id)), equipmentEffects: equipmentEffects(loadout), characterClass: student.characterClass, stats: previewStats, jobLevels: previewLevels,
    health: previewStats.maxHp, maxHealth: previewStats.maxHp,
    mp: previewStats.maxMp,
    healingPotions: 5, shieldPotions: 0, consecutiveCorrectAnswers: 0  
};
  return { previewStats, previewPlayer };
}
