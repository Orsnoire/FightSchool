# Guild quests and classroom tiers

Implementation decision record, 8 October 2026. Implements the owner's current quest, guild-limit, shop and fight-authoring direction. This branch is not deployed.

## Teacher workflow

The guild administration panel displays and edits current limit tier, guild XP and unlocked shop tier. Teachers can create, edit, manually complete and archive quests. Completed rewards are immutable; archiving retains earned rewards. Personal assignments can target one member or create independent quests for all current members. Shared quests credit current guild members at completion. Weekly quests repeat by the existing UTC week period; limit-break rewards are restricted to one-time shared quests.

The student guild lobby has personal, shared and completed quest views with progress and reward descriptions. Seeded milestones cover job levels, advanced job unlocks and first cross-class licenses. Seeded personal gold rewards are once per character across guilds, including historical completions migrated into the receipt ledger.

Available objectives:

| Objective | Completion rule |
| --- | --- |
| Quiz accuracy | A victorious attempt reaches the selected percentage; individual performance or weighted class accuracy for one session |
| Class at cap | Selected percentage of current members have at least one earned job level at the current guild cap |
| Unlock job | Normal prerequisites met or a permanent quest grant exists |
| Cross-class license | Target job reaches its first cross-class milestone, level 8 |
| Solo fights | Selected number of distinct solo victories, optionally scoped to a fight |
| Perfect clear | Victory with 100% accuracy |
| Master question bank | Every current question answered correctly across attempts; question fingerprints include answer content, so editing a question invalidates its old mastery evidence |
| Try solo fight | Selected solo fight has at least one resolved question, including an incorrect answer or timeout |
| Job level / correct answers | Selected level or cumulative correct count |
| Manual | Teacher completes explicitly |

Job-unlock rewards permanently bypass normal prerequisites. Guild limit-break rewards raise the guild tier without lowering an existing higher tier. Completion and rewards are transactional and replay-safe. Lowering a guild tier does not replay completed limit-break quests.

## Progress and guild context

| Limit tier | Effective job-level ceiling |
| --- | --- |
| 1 | 4 |
| 2 | 8 |
| 3 | 10 |
| 4 | 15 |

New guilds begin at tier 1. Existing guilds migrate to tier 4 to preserve existing access until their teacher chooses a limit. Earned job levels and XP never roll back. New XP above the encounter's cap is banked as AA XP. Tiered AA purchases and their effects remain a separate development objective; this change provides the bank and limit context, not an AA upgrade tree.

A solo fight uses its explicitly selected guild. A hosted fight assigned to multiple guilds requires the teacher to select a hosting guild. Members must belong to that active guild. Each room snapshots its limit tier at creation; subsequent teacher changes apply to new rooms. Effective job levels, cross-class eligibility and gear respect the encounter ceiling. The character's permanent loadout and levels remain saved.

Unguilded/unassigned encounters use tier 1 effective power and award no job/AA XP. Multiple memberships do not apply a global lowest-guild cap: the encounter's hosting guild is the context. This replaces the earlier tentative lowest-limit proposal and avoids one teacher changing power in another teacher's classroom.

Archived guilds award no further quest progress or rewards; earned character progress remains. Already-running encounters retain their frozen context. Evidence is scoped to the hosting guild and cannot satisfy another guild's fight objectives. Failed evidence writes are retained in Durable Object storage and retried by alarm. Correct-answer fingerprints are never included in public combat snapshots.

Shop tiers are separate from combat limit tiers. Guild quests and explicit teacher settings control shop unlocks. The teacher shop's discrete tier slider only changes the preview, and Create item opens the item editor with that tier preselected. Custom items belong to the teacher and are shared across their guilds. This does not add guild-exclusive item inventories.

## Fight authoring and initial tuning

New fights select a tier (1–4), with Trash, Normal, Leader and Boss radio choices per enemy. The API derives damage/difficulty values from the shared presets rather than trusting conflicting client values. Existing fights keep legacy tuning until the teacher explicitly converts them.

| Role | Relative HP budget | Base difficulty |
| --- | --- | --- |
| Trash | 0.60 | 5 |
| Normal | 1.00 | 10 |
| Leader | 1.35 | 20 |
| Boss | 1.80 | 40 |

| Tier | Damage base | Difficulty factor | HP factor |
| --- | --- | --- | --- |
| 1 | 1 | 1.0 | 1.00 |
| 2 | 2 | 1.3 | 1.15 |
| 3 | 3 | 1.7 | 1.30 |
| 4 | 4 | 2.5 | 1.50 |

The existing party strength, quiz length, defense and solo safety calculations still apply. Difficulty is capped at 100. These are initial monotonic presets, not a claim of completed classroom balance testing. Authoring shows the HP factor and raw counterattack ceiling before defense. Tuning lives in `shared/encounter-tiers.ts`.

## Migration and validation

Apply migration `0014_guild_quests.sql` after 0013 before activating the Worker. It adds explicit encounter context, tier fields, job grants, AA XP, quest archives, evidence and atomic reward ledgers/functions. No production data was modified during implementation.

Validation includes the full existing test suite, TypeScript check and production build, plus database tests for duplicate rewards, cross-guild receipts, mastery, archived guilds, cap overflow, permanent job grants and teacher authorization; deterministic/API tier tests; and teacher authoring payload checks. Browser visual verification remains outstanding because the Chromium download failed in the development environment.
