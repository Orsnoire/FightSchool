# Enemy behavior and answer-based recovery

Owner decisions, October 8, 2026. Implementation for review; deployment is not
claimed by this document. This specification supersedes the initial proposal's
damage-threshold Hypnotize and fixed three-turn Hypnotic Stare.

## Teacher authoring

Each enemy has an explicit species and a behavior setting: species defaults,
custom priorities, or basic attacks only. Selecting a built-in image suggests
its species. An uploaded image can use any explicitly selected species. Cosmetic
enemy names never select behavior. Only Zombie, Ghost, Spider, Vampire, Slime,
Samhain and Goblin may be authored. Retired types must be changed to a supported
type before saving. Existing stored fights are not deleted: recognized old asset
identities map to their defined species; unknown legacy enemies remain basic
attacks when read. Vampire Bat and Ghost Wizard do not silently inherit Vampire
or Ghost moves. Custom images require a supported species.

The registry in `shared/combat/enemy-catalog.ts` supplies authoring choices and
sprites. A new type requires a complete moveset, valid default AI, and a verified
transparent combat sprite before inclusion. Catalog tests enforce this rule.

Custom rules select enabled moves, conditions, targets, priority, weight and
cooldown. Conditions are Always, Own HP below %, Target HP below %, Target lacks
the move's status, and Round at least N. Higher eligible priority wins; equal
priorities use weighted randomness. There is always a basic-attack fallback.
Disabled rules, cooldowns, species restrictions, insufficient sacrifice HP and
buff caps are respected. The preview evaluates the same selection rules against
a clearly labeled example situation, without consuming combat randomness.

Species defaults are in `shared/combat/enemy-ai.ts`. In brief:

- Zombie mixes the four attacks.
- Ghost prioritizes party Hypnosis, then mixes copied attacks and Telekinesis,
  with Fade Out available below half HP.
- Spider prioritizes Webbing, then favors poison/bleed on unaffected targets.
- Vampire prioritizes healing Bite below 80% HP, with Stare available from round 2.
- Slime mixes corrosion, suffocation, Trip and Flatten.
- Samhain prioritizes its nonstacking ATK buff, then favors Slash, adding defense
  below 60% HP and Blood Strike from round 2.
- Goblin only uses basic attacks, with the fixed swarm targeting described in
  [enemy waves and goblins](enemy-waves-and-goblins.md). Every addition has at
  least five individually targetable goblins; the UI and API enforce that minimum.
  Its fixed swarm policy does not expose custom move priorities.

Move names, descriptions and default cooldowns come from one shared catalog.
Cooldown N means N complete following rounds without that move. Teachers may
lengthen the catalog minimum cooldown, not bypass it. Empty custom rules safely
fall back to Attack. No JavaScript or expressions are evaluated from teacher input.

## Participation and recovery

Answer correctness, mastery fingerprints, earned activity XP, accuracy totals and
correct-answer streaks continue while a character is unable to act. Trip fails
the next correct question's combat action and applies the ordinary combat penalty,
without changing its academic correctness, streak, mastery evidence or credit.
Blocked question actions spend no MP, combo points or items. Fear prevents
offensive actions, including offensive support actions, but permits healing,
crafting and other non-offensive support. Existing damage-over-time continues.

| Effect | Recovery rule |
| --- | --- |
| Stun | Cannot act for its duration; repeated hits add duration. Two correct answers clear all stun stacks and paralysis sooner. |
| Paralysis | Ongoing debuff; default 30% chance to lose all actions for a round, configurable by the teacher. Two correct answers clear it and any stun stacks. |
| Web | One correct answer escapes, but the escape turn has no actions. |
| Hypnotic Stare | One targeted player is hypnotized; three correct answers release them. |
| Hypnosis | All eligible living players are hypnotized; each separately escapes after three correct answers. |
| Fear | Cannot attack for the next round; may answer and use non-attacking actions. |

Recovery answers need not be consecutive. Wrong or unanswered questions do not
erase progress. Reapplication never resets recovery. Stun/paralysis share a 0–2
counter; each hypnotized player has a 0–3 counter. The final recovery answer
restores actions immediately, except Web's explicitly consumed escape turn.
Natural stun expiration may restore actions earlier. Status labels display the
counters and the appropriate escape rule.

A hypnotizing source cannot act while any living participant remains hypnotized
by it. Players who escape can act while others continue recovering. Death of the
source releases its victims; damage alone no longer breaks hypnosis. A player
leaving or being knocked out cannot indefinitely keep the source channeling.
Late entrants are not retroactively affected by an earlier AoE. Correct-answer
escape works with a lone player too. A recovered player receives protection from
new disabling effects through at least the next round, preventing immediate
reapplication by swarms. New hypnosis cannot replace an existing source's effect.

## Damage and status details

- DMG uses the existing difficulty calculation for legacy fights and the shared
  role-based outgoing budget for individual-enemy encounters. Double Attack
  is two distinct hits, each processed through armor, VIT, guards and shields.
- Debuffs attached to a damaging hit require actual damage; pure status moves
  make their own application rolls. Immunity prevents new statuses.
- Zombie Bite has a 5% knockout proc after a damaging hit. Solo encounters retain
  the aggregate damage cap, including this proc, multi-hits, copied attacks and DOT.
  Individual-enemy encounters apply the existing 35%-of-player-max-HP per-phase
  concentration ceiling across all enemies and DOT, including knockout procs.
- Paralysis application stays 30%; its per-turn failure chance is a separate
  teacher setting, default 30%.
- Poison deals exactly two-thirds of the attack's raw DMG per round until
  cleansed. Bleed reduces ATK by 1 and deals one-quarter raw DMG for three rounds.
  Both DOT amounts use fractional carry and bypass armor on the tick, avoiding
  per-round rounding inflation. Effects first tick the round after application.
  Neither poison nor bleed stacks with itself; reapplication refreshes/strengthens
  it without resetting fractional carry. Bleed never permanently modifies stats.
- Purify, Cleansing Chorus and Crescendo remove poison and paralysis. Existing
  poison hooks in saved rooms continue to work.
- Webbing rolls 75% once per distinct selected target: threat leader, total-damage
  leader and highest-threat healer. Overlapping roles never produce extra rolls.
- Vampiric Bite heals `actual HP removed / player max HP * vampire max HP`,
  rounded down and capped by missing HP. Its minimum cooldown is five rounds.
- Corrosion removes 10% of base DEF per stack for five rounds, each independently
  expiring, capped at 100% reduction. Incoming damage rounds up after defense;
  saved equipment/stat values never change.
- Suffocate deals its second, normally mitigated hit next round and prevents
  that round's actions. Bat Strafe's fear lasts one round.
- Fade Out and Flatten block all player damage, including DOT, for the next
  round. Flatten's preparation, cooldowns, last move and combat RNG are excluded
  from public snapshots. It is revealed when damage misses; absence of a normal
  attack can still be noticed by players.
- Possess copies the direct-damage component of an affordable, unlocked,
  non-ultimate ability from a living player. It uses the same attack formulas,
  critical-hit and multi-target/multi-hit resolution, then applies actual target
  defenses. It does not spend the real player's resources, apply their secondary
  healing/buffs/DOT, or credit their combat totals. It falls back to an ordinary
  attack if no eligible direct-damage ability exists.
- Telekinesis uses the biome attack registry. Grasslands is the current biome:
  rock, 1× DMG, 30% one-turn stun. Additional biomes require explicit definitions.
- Samhain weapon ATK and base DEF equal the encounter tier (legacy default 1).
  Slash and Blood Strike deal DMG × ATK. Hunker Down adds 50% base DEF per stack
  up to three; adding a stack refreshes the stack group's two-round duration.
  Cobble Hollow doubles ATK for the next three rounds and cannot stack.
  Blood Strike costs 10% maximum HP, rounded up; it cannot sacrifice lethal HP.
  It heals 5% of actual damage dealt, rounded down—not 5% maximum HP.

## Persistence and architecture

Enemy configuration is validated by both shared and server schemas and saved in
the existing enemy JSON. No database migration is required. New rooms freeze the
configuration with the encounter; editing a fight does not alter running rooms.
Older active snapshots without AI metadata retain basic attacks. Saved status
durations, source links, recovery counters, cooldowns and seeded RNG survive
hibernation/reconnect. Player stats, resource deductions and outcomes remain
server-authoritative. AI selection, status processing, presentation and transport
remain separate modules.

The new deterministic tests cover the move families, source/channel behavior,
nonconsecutive recovery, stacking, solo caps, secrecy and persistence. API and
React DOM tests cover authoring validation, save/reload and visible recovery.
Classroom balance still needs observation: especially large-party hypnosis,
percentage vampire healing, poison duration and enemy compositions.
