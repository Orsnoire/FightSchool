/** Compatibility entry point. Internal modules import their owners directly. */
export type { CombatSnapshot, CombatPlayer, CombatEnemy, CombatPhase } from "../../shared/combat/model";
export { initialCombatState, scaleEncounter, startQuestion } from "./encounter-setup";
export { type CombatProfile, addStudent, completedRounds, participatedRounds, removeStudent } from "./participants";
export { applyAnswer, allLivingPlayersAnswered, selectAction, setReady, upgradePriestActions } from "./choices";
export { nextWave, eliminateEnemy, resurrectPlayer } from "./host-controls";
export { deterministicShuffle } from "./random";
export { baseDamage, encounterDamageEstimate } from "./damage-values";
export { advancePhase, advanceAfterQuestion } from "./phases";
