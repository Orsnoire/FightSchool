import type { Student } from "../../shared/contracts/dto";
import { EQUIPMENT_SLOTS, ownedEquipment } from "../../shared/equipment-catalog";
export function safeStudent(student: Student): Student {
  return {
    id: student.id,
    guildCode: student.guildCode,
    grantedJobs: student.grantedJobs,
    aaExperience: student.aaExperience,
    aaPointsSpent: student.aaPointsSpent ?? 0,
    aaRanks: student.aaRanks ?? {},
    aaRevision: student.aaRevision ?? 0,
    characterName: student.characterName ?? null,
    crossClassAbilities: student.crossClassAbilities ?? [student.crossClassAbility1, student.crossClassAbility2],
    staminaDay: student.staminaDay,
    dailyCombats: student.dailyCombats,
    xpRemainder: student.xpRemainder,
    nickname: student.nickname,
    guildId: student.guildId,
    weapon: student.weapon,
    headgear: student.headgear,
    armor: student.armor,
    offhand: student.offhand,
    hands: student.hands,
    legs: student.legs,
    feet: student.feet,
    arms: student.arms,
    crossClassAbility1: student.crossClassAbility1,
    crossClassAbility2: student.crossClassAbility2,
    gold: student.gold,
    characterClass: student.characterClass,
    gender: student.gender,
    inventory: ownedEquipment([...student.inventory, ...EQUIPMENT_SLOTS.map(slot => student[slot]).filter((id): id is string => !!id)]),
  };
}
