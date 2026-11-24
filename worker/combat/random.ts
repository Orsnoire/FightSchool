/** The persisted generator is the only combat randomness source; keep call order stable. */
import { type CombatSnapshot } from "../../shared/combat/model.ts";

export function rng(s: CombatSnapshot) {
  s.seed = (Math.imul(s.seed, 1664525) + 1013904223) >>> 0;
  return s.seed / 4294967296;
}

export { deterministicShuffle } from "../../shared/shuffle";
