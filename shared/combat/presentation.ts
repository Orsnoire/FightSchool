import type { CombatEvent, CombatSnapshot, CombatPlayer } from "./model";
export const EFFECTS = [
  "sword",
  "fire",
  "ice",
  "curse",
  "herbalist",
  "arrow",
  "claw",
  "bard",
  "web",
  "bite",
  "heal",
  "block",
] as const;
export type AttackEffect = (typeof EFFECTS)[number];
export function abilityEffect(
  ability: string,
  player?: Pick<CombatPlayer, "characterClass" | "weaponKind">,
): AttackEffect {
  if (["frostbolt", "freezing_touch"].includes(ability)) return "ice";
  if (["fireball", "fireblast", "manabomb"].includes(ability)) return "fire";
  if (
    [
      "curse",
      "hex",
      "doom",
      "dread_aura",
      "shadow_requiem",
      "abyssal_drain",
      "pact_surge",
      "hypnosis",
      "hypnotic_stare",
      "possess",
      "corrode",
      "suffocate",
    ].includes(ability)
  )
    return "curse";
  if (ability === "webbing") return "web";
  if (
    [
      "bite",
      "vampiric_bite",
      "fangs",
      "mandible_strike",
      "wolf_charge",
    ].includes(ability)
  )
    return "bite";
  if (
    [
      "paralyze_claws",
      "double_attack",
      "flurry",
      "flurry_of_blows",
      "focused_palm",
    ].includes(ability)
  )
    return "claw";
  if (
    [
      "inspire",
      "finale",
      "cleansing_chorus",
      "battle_hymn",
      "crescendo",
    ].includes(ability)
  )
    return "bard";
  if (
    [
      "headshot",
      "aim",
      "mark",
      "killshot",
      "arrowstorm",
      "piercing_shot",
      "hunters_mark",
      "prey",
      "twin_shot",
      "hunters_volley",
    ].includes(ability)
  )
    return "arrow";
  if (
    [
      "healing_potion",
      "shield_potion",
      "potion_diffuser",
      "life_potion",
      "craft_healing_potion",
      "craft_shield_potion",
    ].includes(ability)
  )
    return "herbalist";
  if (
    [
      "first_aid",
      "mend",
      "purify",
      "holy_light",
      "divine_grace",
      "lay_on_hands",
      "inner_peace",
    ].includes(ability)
  )
    return "heal";
  if (
    [
      "warrior_block",
      "shield_bash",
      "unbreakable",
      "aegis",
      "manashield",
      "fortify",
      "deflect",
    ].includes(ability)
  )
    return "block";
  if (ability !== "attack") return "sword";
  const weapon = player?.weaponKind;
  if (weapon === "bow" || weapon === "spoon") return "arrow";
  if (weapon === "harp") return "bard";
  if (weapon === "claws" || weapon === "fist") return "claw";
  if (weapon === "herbs") return "herbalist";
  if (weapon === "staff" || weapon === "wand")
    return player?.characterClass === "warlock" ? "curse" : "fire";
  return (
    (
      {
        wizard: "fire",
        warlock: "curse",
        herbalist: "herbalist",
        scout: "arrow",
        ranger: "arrow",
        bard: "bard",
        monk: "claw",
        priest: "heal",
      } as Partial<Record<string, AttackEffect>>
    )[player?.characterClass || ""] || "sword"
  );
}
export interface PlaybackBatch {
  id: string;
  round: number;
  phase: "question_resolution" | "enemy_ai";
  eventIds: string[];
  initialHealth: Record<string, number>;
}
export interface PlaybackCue {
  event: CombatEvent;
  startMs: number;
  impactMs: number;
  endMs: number;
  effect: AttackEffect;
  showEffect: boolean;
  alternate: boolean;
}
export const ATTACK_SPACING_MS = 150,
  IMPACT_MS = 180,
  CLIP_MS = 700;
export function playbackCues(
  batch: PlaybackBatch,
  events: CombatEvent[],
): PlaybackCue[] {
  let notes = 0;
  const selected = new Set(batch.eventIds),
    groups = new Map<string, number>(),
    shown = new Set<string>();
  return events
    .filter((e) => selected.has(e.id))
    .map((event) => {
      const group = event.actionId || event.id;
      if (!groups.has(group)) groups.set(group, groups.size);
      const startMs = groups.get(group)! * ATTACK_SPACING_MS;
      const key = group + ":" + event.targetId;
      // Prefer the concrete hit over an accompanying narration, but show pure status/buff actions.
      const concrete = event.type !== "ability";
      const hasConcrete = events.some(
        (e) =>
          selected.has(e.id) &&
          (e.actionId || e.id) === group &&
          e.targetId === event.targetId &&
          e.type !== "ability",
      );
      const showEffect = !shown.has(key) && (concrete || !hasConcrete);
      if (showEffect) shown.add(key);
      const effect =
        event.effect ||
        (event.type === "heal"
          ? "heal"
          : event.type === "block"
            ? "block"
            : "sword");
      return {
        event,
        startMs,
        impactMs: startMs + IMPACT_MS,
        endMs: startMs + CLIP_MS,
        effect,
        showEffect,
        alternate: effect === "bard" && showEffect ? notes++ % 2 === 1 : false,
      };
    });
}
export function playbackDuration(batch: PlaybackBatch, events: CombatEvent[]) {
  return Math.max(0, ...playbackCues(batch, events).map((c) => c.endMs));
}
export function isResolution(phase: string) {
  return phase === "question_resolution" || phase === "enemy_ai";
}
export function makePlayback(
  before: CombatSnapshot,
  after: CombatSnapshot,
): PlaybackBatch {
  const phase = after.currentPhase as PlaybackBatch["phase"];
  const previous = new Set(before.events.map((e) => e.id));
  return {
    id: `${after.sessionId}:${after.round}:${phase}:${after.revision}`,
    round: after.round,
    phase,
    eventIds: after.events
      .filter(
        (e) =>
          e.round === after.round &&
          e.phase === phase &&
          (phase === "question_resolution" || !previous.has(e.id)),
      )
      .map((e) => e.id),
    initialHealth: Object.fromEntries([
      ...Object.values(before.players).map(
        (p) => [p.studentId, p.health] as const,
      ),
      ...before.enemies.map((e) => [e.id, e.health] as const),
    ]),
  };
}
/** Isolated visual projection; never feeds combat calculations or reward accounting. */
export function displayedHealth(
  batch: PlaybackBatch,
  events: CombatEvent[],
  elapsed: number,
) {
  const hp = { ...batch.initialHealth };
  for (const cue of playbackCues(batch, events))
    if (elapsed >= cue.impactMs && cue.event.healthAfter !== undefined)
      hp[cue.event.targetId] = cue.event.healthAfter;
  return hp;
}
