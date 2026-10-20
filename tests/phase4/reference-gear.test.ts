import assert from "node:assert/strict";
import { test } from "node:test";
import { referenceParty, encounterBudget } from "../../shared/combat/encounters";
import { calculateCharacterStats, calculateLoadoutEquipmentStats, getStartingEquipment, type CharacterClass } from "../../shared/schema";
import { getTotalPassiveBonuses, getTotalMechanicUpgrades } from "../../shared/jobSystem";

test("tier 1 reference uses real starter gear at level 2, including starter weapons and armor", () => {
  for (const player of referenceParty(1)) {
    const levels = { [player.characterClass]: 2 } as Record<CharacterClass, number>;
    const expected = calculateCharacterStats(player.characterClass,
      calculateLoadoutEquipmentStats(getStartingEquipment(player.characterClass)),
      getTotalPassiveBonuses(levels), getTotalMechanicUpgrades(levels));
    assert.deepEqual(player.stats, expected, player.characterClass);
    assert.equal(player.equipmentEffects?.healingBonus, 0);
    assert.deepEqual(player.jobLevels, levels);
  }
  assert.equal(encounterBudget(referenceParty(1), 1, 10).hp, 173, "HP uses the new additive formula with the full reference rotation output");
});

test("higher-tier reference uses previous-tier gear while retaining the encounter's level midpoint", () => {
  const loadouts = {
    warrior: ["fighter", "fighter_sword", "fighter_shield"],
    priest: ["healer", "healer_ankh"],
    wizard: ["caster", "caster_staff"],
    scout: ["forester", "forester_bow", "forester_quiver"],
  };
  for (const tier of [2, 3, 4]) for (const player of referenceParty(tier)) {
    const [family, weapon, offhand] = loadouts[player.characterClass as keyof typeof loadouts];
    const gear = calculateLoadoutEquipmentStats({
      ...Object.fromEntries(["headgear", "armor", "arms", "hands", "legs", "feet"].map(slot => [slot, `t1_${family}_${slot}`])),
      weapon: `t1_${weapon}`, offhand: offhand ? `t1_${offhand}` : null,
    });
    for (const key of Object.keys(gear) as (keyof typeof gear)[]) gear[key] *= tier - 1;
    const levels = { [player.characterClass]: [2, 6, 9, 13][tier - 1] } as Record<CharacterClass, number>;
    assert.deepEqual(player.stats, calculateCharacterStats(player.characterClass, gear,
      getTotalPassiveBonuses(levels), getTotalMechanicUpgrades(levels)), `tier ${tier} ${player.characterClass}`);
    assert.equal(player.equipmentEffects?.healingBonus, player.characterClass === "priest" ? tier - 1 : 0);
    assert.deepEqual(player.jobLevels, levels);
  }
});
