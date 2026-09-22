// Compatibility barrel for the Phase 0/4 characterization imports.
// Authoritative deterministic rules live in worker/combat/engine.ts.
export {
  addStudent,
  advanceAfterQuestion,
  allLivingPlayersAnswered,
  applyAnswer,
  initialCombatState as createCombatState,
  startQuestion,
  type CombatEnemy,
  type CombatPhase,
  type CombatPlayer,
  type CombatSnapshot as DurableCombatState,
} from "./combat/engine.ts";
