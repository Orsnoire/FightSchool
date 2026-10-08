import { z } from "zod";
import type { CombatEnemy, CombatPlayer, CombatSnapshot } from "./model";

export const ENEMY_TYPES = ["basic", "zombie", "ghost", "spider", "vampire", "slime", "samhain"] as const;
export type EnemyType = typeof ENEMY_TYPES[number];
export const BIOME_ATTACKS = { grasslands: { object: "rock", damageMultiplier: 1, stunChance: 0.3 } } as const;
export const TARGETS = ["threat", "damage", "healer", "lowest_hp", "random", "priority_roles", "party", "self"] as const;
export const TARGET_LABELS: Record<typeof TARGETS[number], string> = {
  threat: "Highest threat", damage: "Highest total damage", healer: "Highest-threat healer",
  lowest_hp: "Lowest HP percentage", random: "Random living player", priority_roles: "Threat + damage + healer", party: "All living players", self: "Self",
};
export const CONDITIONS = ["always", "self_hp_below", "target_hp_below", "target_unafflicted", "after_round"] as const;
export const CONDITION_LABELS: Record<typeof CONDITIONS[number], string> = {
  always: "Always", self_hp_below: "Own HP % below", target_hp_below: "Target HP % below",
  target_unafflicted: "Target lacks this effect", after_round: "Round at least",
};
export const MOVE_IDS = ["attack", "paralyze_claws", "freezing_touch", "bite", "double_attack", "fade_out", "possess", "telekinesis", "hypnosis", "webbing", "fangs", "mandible_strike", "leg_strike", "hypnotic_stare", "vampiric_bite", "wolf_charge", "bat_strafe", "corrode", "suffocate", "trip", "flatten", "slash", "hunker_down", "cobble_hollow", "blood_strike"] as const;
export type EnemyMove = typeof MOVE_IDS[number];
type Move = { name: string; type: EnemyType; description: string; cooldown: number; target: typeof TARGETS[number]; effect?: string };
export const ENEMY_MOVES: Record<EnemyMove, Move> = {
  attack: { name: "Attack", type: "basic", description: "Normal attack; fallback when no rule can run.", cooldown: 0, target: "threat" },
  paralyze_claws: { name: "Paralyze Claws", type: "zombie", description: "Damage; 30% paralysis. Two correct answers clear paralysis.", cooldown: 0, target: "threat", effect: "paralysis" },
  freezing_touch: { name: "Freezing Touch", type: "zombie", description: "Damage and one-turn stun.", cooldown: 2, target: "threat", effect: "stun" },
  bite: { name: "Bite", type: "zombie", description: "Damage; 5% knockout after a damaging hit. Solo damage cap still applies.", cooldown: 2, target: "threat" },
  double_attack: { name: "Double Attack", type: "zombie", description: "Two normal hits, each separately mitigated.", cooldown: 0, target: "threat" },
  fade_out: { name: "Fade Out", type: "ghost", description: "Immune to damage during the next round.", cooldown: 3, target: "self" },
  possess: { name: "Possess", type: "ghost", description: "Copy the direct damage of one affordable non-ultimate player ability against the party; player resources are untouched.", cooldown: 2, target: "damage" },
  telekinesis: { name: "Telekinesis", type: "ghost", description: "Grasslands rock: normal damage and 30% one-turn stun.", cooldown: 0, target: "threat", effect: "stun" },
  hypnosis: { name: "Hypnosis", type: "ghost", description: "Party-wide hypnosis. Each player escapes after three correct answers; the ghost cannot act until all are free.", cooldown: 5, target: "party", effect: "hypnosis" },
  webbing: { name: "Webbing", type: "spider", description: "75% web chance per distinct priority target. One correct answer escapes, using that turn.", cooldown: 3, target: "priority_roles", effect: "web" },
  fangs: { name: "Fangs", type: "spider", description: "Damage; 60% poison for two-thirds base damage each round until cleansed.", cooldown: 0, target: "threat", effect: "poison" },
  mandible_strike: { name: "Mandible Strike", type: "spider", description: "Damage; 30% bleed: −1 ATK and one-quarter base damage for three rounds.", cooldown: 0, target: "threat", effect: "bleed" },
  leg_strike: { name: "Leg Strike", type: "spider", description: "Normal damage.", cooldown: 0, target: "threat" },
  hypnotic_stare: { name: "Hypnotic Stare", type: "vampire", description: "Single-target hypnosis. Three correct answers free the player; the vampire cannot act while the target is hypnotized.", cooldown: 6, target: "threat", effect: "stare" },
  vampiric_bite: { name: "Vampiric Bite", type: "vampire", description: "Damage; heal the same percentage of vampire max HP as the target actually loses.", cooldown: 5, target: "threat" },
  wolf_charge: { name: "Wolf Charge", type: "vampire", description: "Damage; 30% one-turn stun.", cooldown: 0, target: "threat", effect: "stun" },
  bat_strafe: { name: "Bat Strafe", type: "vampire", description: "80% fear for one round: no attacks; answering and non-attacking actions remain available.", cooldown: 2, target: "damage", effect: "fear" },
  corrode: { name: "Corrode", type: "slime", description: "Damage; 30% corrosion: −10% base DEF per stack for five rounds, capped at −100%.", cooldown: 0, target: "threat", effect: "corrosion" },
  suffocate: { name: "Suffocate", type: "slime", description: "Damage; 30% chance of no action next round plus another damage tick.", cooldown: 2, target: "threat", effect: "suffocate" },
  trip: { name: "Trip", type: "slime", description: "80% trip: next correct answer fails in combat, while accuracy and earned question credit remain correct.", cooldown: 2, target: "damage", effect: "trip" },
  flatten: { name: "Flatten", type: "slime", description: "Secretly prepare to evade all player damage next round; reveal when triggered.", cooldown: 3, target: "self" },
  slash: { name: "Slash", type: "samhain", description: "Base damage × fight-tier weapon ATK.", cooldown: 0, target: "threat" },
  hunker_down: { name: "Hunker Down", type: "samhain", description: "+50% base DEF for two rounds per stack, up to three stacks; can act while protected.", cooldown: 0, target: "self" },
  cobble_hollow: { name: "Cobble Hollow", type: "samhain", description: "+100% ATK for the next three rounds, without stacking.", cooldown: 4, target: "self" },
  blood_strike: { name: "Blood Strike", type: "samhain", description: "Spend 10% max HP; deal base damage × ATK and heal 5% of actual damage dealt.", cooldown: 2, target: "threat" },
};

export const enemyRuleSchema = z.object({
  move: z.enum(MOVE_IDS), enabled: z.boolean().default(true), priority: z.number().int().min(0).max(100).default(10),
  weight: z.number().int().min(1).max(100).default(10), cooldown: z.number().int().min(0).max(20).default(0),
  target: z.enum(TARGETS), condition: z.enum(CONDITIONS).default("always"), value: z.number().int().min(0).max(100).default(50),
}).strict();
export type EnemyRule = z.infer<typeof enemyRuleSchema>;
export const enemyAISchema = z.object({
  mode: z.enum(["default", "custom", "basic"]).default("default"),
  rules: z.array(enemyRuleSchema).max(25).optional(),
  paralysisSkipChance: z.number().min(0).max(1).default(0.3),
  biome: z.literal("grasslands").default("grasslands"),
}).strict();
export type EnemyAI = z.infer<typeof enemyAISchema>;
export function ruleFor(move: EnemyMove, changes: Partial<EnemyRule> = {}): EnemyRule {
  return { move, enabled: true, priority: 10, weight: 10, cooldown: ENEMY_MOVES[move].cooldown, target: ENEMY_MOVES[move].target, condition: "always", value: 50, ...changes };
}
const rules = (moves: EnemyMove[]) => moves.map(move => ruleFor(move));
export const DEFAULT_ENEMY_RULES: Record<EnemyType, EnemyRule[]> = {
  basic: rules(["attack"]),
  zombie: rules(["paralyze_claws", "freezing_touch", "bite", "double_attack"]),
  ghost: [ruleFor("hypnosis", { priority: 20, condition: "target_unafflicted" }), ruleFor("fade_out", { condition: "self_hp_below", value: 50 }), ...rules(["possess", "telekinesis"])],
  spider: [ruleFor("webbing", { priority: 20, condition: "target_unafflicted" }), ruleFor("fangs", { condition: "target_unafflicted", weight: 20 }), ruleFor("mandible_strike", { condition: "target_unafflicted" }), ruleFor("leg_strike", { weight: 5 })],
  vampire: [ruleFor("vampiric_bite", { priority: 30, condition: "self_hp_below", value: 80 }), ruleFor("hypnotic_stare", { condition: "after_round", value: 2, weight: 5 }), ...rules(["wolf_charge", "bat_strafe"])],
  slime: rules(["corrode", "suffocate", "trip", "flatten"]),
  samhain: [ruleFor("cobble_hollow", { priority: 30 }), ruleFor("hunker_down", { condition: "self_hp_below", value: 60 }), ruleFor("slash", { weight: 30 }), ruleFor("blood_strike", { condition: "after_round", value: 2 })],
};
/** Use asset identity, never the teacher's cosmetic nickname. Explicit species wins. */
export function inferEnemyType(image = ""): EnemyType {
  if (/Samhain_lord/i.test(image)) return "samhain";
  if (/Giant_spider/i.test(image)) return "spider";
  if (/Vampire_RPG/i.test(image)) return "vampire";
  if (/Ghost_RPG/i.test(image)) return "ghost";
  if (/Zombie_RPG/i.test(image)) return "zombie";
  if (/Slime_RPG/i.test(image)) return "slime";
  return "basic";
}
export function enemyRules(enemy: Pick<CombatEnemy, "enemyType" | "ai">): EnemyRule[] {
  if (enemy.ai?.mode === "basic") return DEFAULT_ENEMY_RULES.basic;
  return enemy.ai?.mode === "custom" ? enemy.ai.rules || [] : DEFAULT_ENEMY_RULES[enemy.enemyType || "basic"];
}
export function ruleAllowed(type: EnemyType, rule: EnemyRule): boolean {
  const move = ENEMY_MOVES[rule.move];
  return rule.cooldown >= move.cooldown &&
    !(rule.condition === "target_unafflicted" && !move.effect) &&
    !(rule.target === "self" && rule.condition.startsWith("target_")) &&
    (move.type === type || rule.move === "attack") &&
    (move.target === "self" ? rule.target === "self" : rule.target !== "self" && (rule.target !== "priority_roles" || rule.move === "webbing") && (rule.target !== "party" || rule.move === "hypnosis") && (rule.move !== "hypnosis" || rule.target === "party"));
}
export function validEnemyAI(enemy: { enemyType?: EnemyType; image: string; ai?: EnemyAI }): boolean {
  const type = enemy.enemyType || inferEnemyType(enemy.image);
  const custom = enemy.ai?.rules || [];
  return custom.every(r => ruleAllowed(type, r)) && new Set(custom.map(r => r.move)).size === custom.length;
}
export function livingPlayers(s: CombatSnapshot): CombatPlayer[] {
  return Object.values(s.players).filter(p => !p.isDead).sort((a, b) => a.studentId.localeCompare(b.studentId));
}
export function enemyTargets(s: CombatSnapshot, target: EnemyRule["target"]): CombatPlayer[] {
  const players = livingPlayers(s);
  const threat = [...players].sort((a, b) => b.threat - a.threat || a.studentId.localeCompare(b.studentId));
  const damage = [...players].sort((a, b) => b.totals.damageDealt - a.totals.damageDealt || a.studentId.localeCompare(b.studentId));
  const healers = threat.filter(p => p.availableAbilities.some(a => ["first_aid", "mend", "healing_potion", "healing_guard", "holy_light", "cleansing_chorus"].includes(a)));
  if (target === "self") return [];
  if (target === "priority_roles") return [...new Set([threat[0], damage[0], healers[0]].filter((p): p is CombatPlayer => !!p))];
  if (target === "random" || target === "party") return players;
  if (target === "healer") return [healers[0] || threat[0]].filter(Boolean);
  if (target === "damage") return damage.slice(0, 1);
  if (target === "lowest_hp") return [...players].sort((a, b) => a.health / a.maxHealth - b.health / b.maxHealth || a.studentId.localeCompare(b.studentId)).slice(0, 1);
  return threat.slice(0, 1);
}
export function ruleProblem(s: CombatSnapshot, e: CombatEnemy, r: EnemyRule): string | null {
  if (!r.enabled) return "Disabled";
  if (!ruleAllowed(e.enemyType || "basic", r)) return "Move does not belong to this species";
  if ((e.aiState?.readyRounds[r.move] || 0) > s.round) return "Cooling down";
  if (livingPlayers(s).some(p => p.statuses?.some(x => ["hypnosis", "stare"].includes(x.type) && x.sourceId === e.id))) return "Maintaining hypnosis";
  const buffs = e.aiState?.buffs || [];
  if (r.move === "hunker_down" && buffs.filter(b => b.type === "defense" && b.throughRound >= s.round).length >= 3) return "Defense stack cap";
  if (r.move === "cobble_hollow" && buffs.some(b => b.type === "attack" && b.throughRound >= s.round)) return "Already empowered";
  if (r.move === "blood_strike" && e.health <= Math.ceil(e.maxHealth * 0.1)) return "Insufficient HP";
  if (r.move === "hypnosis" && livingPlayers(s).some(p => p.statuses?.some(x => x.type === "hypnosis" && x.sourceId === e.id))) return "Already hypnotizing a player";
  const targets = enemyTargets(s, r.target);
  if (r.target !== "self" && !targets.length) return "No living target";
  if (["hypnosis", "hypnotic_stare", "webbing", "bat_strafe"].includes(r.move) &&
    targets.every(p => p.buffs?.immunity || (p.controlImmuneThroughRound || 0) >= s.round ||
      (["hypnosis", "hypnotic_stare"].includes(r.move) && p.statuses?.some(x => x.type === "hypnosis" || x.type === "stare")))) return "Targets recovering or already hypnotized";
  if (r.condition === "self_hp_below" && 100 * e.health / e.maxHealth >= r.value) return "Own HP above threshold";
  if (r.condition === "after_round" && s.round < r.value) return "Before required round";
  if (r.condition === "target_hp_below" && !targets.some(p => 100 * p.health / p.maxHealth < r.value)) return "Target HP above threshold";
  if (r.condition === "target_unafflicted" && !targets.some(p => !p.statuses?.some(x => x.type === ENEMY_MOVES[r.move].effect))) return "Target already affected";
  return null;
}
/** Caller supplies the saved combat PRNG. Preview can use a fixed sample without consuming it. */
export function chooseEnemyRule(s: CombatSnapshot, e: CombatEnemy, random: () => number): EnemyRule {
  const eligible = enemyRules(e).filter(r => !ruleProblem(s, e, r));
  if (!eligible.length) return ruleFor("attack");
  const priority = Math.max(...eligible.map(r => r.priority));
  const pool = eligible.filter(r => r.priority === priority);
  let roll = random() * pool.reduce((sum, r) => sum + r.weight, 0);
  for (const rule of pool) { roll -= rule.weight; if (roll < 0) return rule; }
  return pool[pool.length - 1];
}
