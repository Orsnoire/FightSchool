# Combat implementation boundaries

C10 implementation map; gameplay authority remains the current specifications linked from `Source_of_Truth.md`. This extraction changes no combat rules or persisted-room schema.

| Owner | Responsibility |
| --- | --- |
| `engine.ts` | Compatible exports for existing callers; internal modules import their owners directly. |
| `encounter-setup.ts`, `participants.ts` | Initial/scaled encounters, entry profiles, queued/departed participants and participation accounting. |
| `choices.ts`, `host-controls.ts` | Answer/selection/readiness rules and explicit host interventions. |
| `phases.ts` | Clone the input snapshot, order resolution and round cleanup, and construct playback batches. |
| `ability-execution.ts`, `health.ts` | Resource/ability effects and damage/healing on the phase-owned working copy. |
| `random.ts`, `state-events.ts`, `damage-values.ts` | Persisted seeded randomness, ordered events/leaders and damage estimates. |
| Existing `enemy-turn.ts` and shared combat modules | Enemy moves, statuses, encounters, ability catalogs and presentation contracts. |
| `commands.ts` | Frame/JSON/schema validation and atomic student rule application; no authority or persistence. |
| `public-snapshot.ts`, `room-messages.ts` | Allowlisted public state, questions and results with role/phase secrecy. |
| `room-state.ts`, `room-recovery.ts` | Durable shape and retained legacy/Priest adapters. No version bump. |
| `room-persistence.ts` | Snapshot outbox, reporting/evidence/result retries and earliest alarm policy through explicit effect callbacks. |
| `session-object.ts` | Sole serialized authority: authenticated socket context, revocation/rate/round/deadline checks, durable command receipts, moderation, host sessions, storage and transport. |

The phase engine never schedules work, writes storage or sends messages. Its injected/explicit timestamps and persisted RNG retain existing ordering. Health and ability primitives mutate only the working snapshot owned by phase resolution. Callers use the compatible engine operations, which retain the previous clone/no-op behavior.

The room authority checkpoints before acknowledgement or publication. SQL reporting/evidence can retry from the durable snapshot; result SQL receipts make a repeated completion safe if SQL succeeds but the following checkpoint fails. The authority owns alarms and its single promise queue; extracted services create no independent queue or background task. C06 question batching and C02 duplicate suppression remain in place.

Run the frozen pre-extraction replay and boundary checks with:

```sh
node --import tsx --test tests/phase4/combat-replay.test.ts tests/phase4/combat-room-boundaries.test.ts
```

The complete gate remains `npm run check`, `npm test`, `npm run build`, plus CI's three Chromium jobs. See [C10 evidence](../reviews/2026-10-18-c10-combat-modules.md) for the exact revision and verification limitations. Legacy adapters must not be removed without a separate retirement decision.
