# Campaign / October 26 production compatibility

> Historical October 27 evidence. For current numbering (roster 0019, campaign
> 0020–0024), strict schema guards and the 22-to-29-row preview bridge, use the
> [October 28 safety review](2026-10-28-campaign-release-safety.md).

> Superseded release-safety guidance: use the [October 28 review and runbook](2026-10-28-campaign-release-safety.md) for schema validation, retry/rollback, provider preflight and the subsequent gated-beta release. The evidence below describes the October 27 head.

## Scope and release boundary

Reconcile registered `feature/campaign-pilot` / PR #81, originally `d7c4a835`,
with main `2d524dff1ff7ac784d37b02fb48a4ec530e9b666`. The original comparison was
33 behind / 29 ahead. Main includes releases #83–86; this merge keeps their math,
shop, guild combat access, solo EXP, periodic effects and AA changes.

**Implementation and repository verification complete; ready for review. No merge
to main, deployment, provider/database operation or playtest reset was performed.** C12
is separate. The preview release-request file is unchanged. Its runtime remains
`6de42632f4953e408b566bf60978cfe482a11f10`, with the October 21 preview-only ledger.
Owner-authenticated guardian-victory acceptance remains pending; fixture tests
cannot substitute for that acceptance.

## Compatibility behavior

- Campaign power uses `aaTier` with its own tier and hosting guild, before the
  shared loadout/stats projection. The pilot remains tier 1 / effective level 4;
  adaptive monster tier and unrelated guilds cannot raise its AA allowance.
- Stats, HP/MP, licensed equipment, weapon specialization, Natural Wisdom and
  slot capacity use the same effective ranks as combat. Field healing uses
  shared ability values. Bag healing potions gain the active Wisdom bonus;
  only combat use rolls potion preservation, using the persisted encounter RNG.
  Cures/protections, invalid actions and field potions do not roll preservation.
  Bag items keep their existing no-academic-contribution-credit rule.
- All five earned cross-class selections remain saved. The effective level/slot
  projection suppresses unavailable choices without writing the suppression
  back during campaign equipment changes. Tier 1's level-4 cap means borrowed
  abilities remain unavailable, even if an extra slot is purchased.
- Gear changes and AA purchases do not refill resources. Inn rest and explicit
  personal reset keep their existing behavior. AA revision joins the existing
  atomic campaign/loadout revisions so a concurrent purchase cannot admit a
  stale power snapshot. Legacy callers without the field only work at AA
  revision zero; coordinate the future runtime release with migration 0023.
- Encounter player snapshots freeze ranks, abilities, gear and starting resources
  until settlement, including the active-adventure view. Existing pre-AA
  snapshots retain their old resource/power state. Reconnect does not rebuild them.
- Production's EXP formula, Hex/Hemorrhage, combo-loss, dodge and other combat
  changes are integrated. Campaign solo-host exit shares normal earned-EXP
  completion, grants no victory loot/stamina recovery, and settles HP/MP/items.
  Guardian victories keep exactly-once post-fight stamina restoration and AA
  overflow through the shared result transaction.
- The pilot remains solo: new guildmate joining cannot enter someone else's
  campaign, and campaign rooms do not appear in the shared guild battle list.

## Migration histories and safe forward path

Production SQL and journal entries **0000–0018 are byte-for-byte unchanged**.
An immutable hash fixture extends regression coverage through the released AA
migration. Never renumber its ledger row, delete history or rewrite wallet data.

| Legacy isolated preview | Canonical history after AA |
| --- | --- |
| `0018_campaign_pilot` | `0019_campaign_pilot` |
| `0019_campaign_equipment` | `0020_campaign_equipment` |
| `0020_campaign_consumables` | `0021_campaign_consumables` |
| `0021_campaign_boss_stamina` | `0022_campaign_boss_stamina` |
| No AA-revision guard | New `0023_campaign_aa_compatibility` |

The four old SQL files and complete original journal are retained in
`migrations/cloudflare/legacy-campaign-preview/`. Their canonical counterparts
have identical SQL bytes, with new names/timestamps after production AA 0018.
Snapshots describe the combined schema, and disposable no-op generation checks
it against the ORM. The archive is outside the active journal.

**Fresh or production-history databases:** the standard migrator runs AA 0018
and canonical campaign 0019–0023 in order. A database already at production 0018
only runs 0019 onward. Expected canonical ledger: 24 rows. This describes a future
authorized release; production was not migrated for this task.

**Existing preview through historical 0021:** do not run the standard migrator
first. Its timestamp cursor sees AA as new but cannot recognize already-applied
campaign DDL under the new timestamps. The regression test proves that this
mistake fails and rolls back, rather than being accepted as a valid upgrade.

After separate authorization, verify the exact isolated preview database identity,
take its normal recoverable backup, coordinate a brief write pause/runtime release,
and inspect the ledger and preserved-state digests. Generate the reviewable bridge:

```sh
node scripts/campaign-preview-migration-bridge.mjs > /tmp/campaign-preview-bridge.sql
```

This command is offline and has no connection or deployment capability. The SQL
must only be executed through authorized preview database tooling. It takes a
ledger lock and requires the exact 22-entry legacy hash/timestamp history plus
the expected campaign schema. Unknown, partial, corrupt, production and C12
histories are rejected before changes. It applies the **unchanged AA 0018 SQL**,
appends four aliases attesting that the byte-identical campaign SQL already ran,
then applies 0023. All of that commits in one transaction. No old ledger row,
ID, hash or timestamp is modified. Expected bridged ledger: **28 rows**.

Rerunning the bridge against its exact completed history is a no-op; the normal
migrator then also finds nothing pending. Any failure must roll back the open
transaction before inspection/retry. Do not manually mark a failed migration
as applied. If history differs, inspect it and write a separately reviewed path;
do not weaken the guard. The bridge never replays the item-shop backfill, boss
rewards or campaign initialization against the legacy preview.

Before a later preview deployment, verify ledger/schema/state digests and set
the new `campaignAACompatibilityApplied: true` attestation in an explicitly
authorized release request. Old 0020/0021 attestations alone cannot deploy the
reconciled runtime. The fixed preview target and resource/secret preservation
guards remain unchanged. Do not roll back to an old free-appearance runtime
after AA purchases; retain AA wallet/receipt data and a compatible runtime.

## Verification and limits

The tested integration is `bcf2c4c251c24f2d5a4cbcc5a62aac97149bb3af`, with main
`2d524dff1ff7ac784d37b02fb48a4ec530e9b666` as its second parent. The subsequent
checkpoint commit only records these results; it changes no runtime, migration,
test or deployment configuration.

| Gate | Result / evidence |
| --- | --- |
| Full deterministic suites | **385/385 pass** locally and in [CI 40535793500](https://github.com/Orsnoire/FightSchool/actions/runs/40535793500): phase 2 = 5, phase 3 = 7, phase 4 = 357, rich content = 16 |
| TypeScript and client/Worker builds | Pass locally and in the same CI run |
| Deployment boundary | **4/4 pass** locally; requires the new AA compatibility attestation while preserving the fixed isolated target |
| Chromium acceptance | All four jobs pass in [40535793069](https://github.com/Orsnoire/FightSchool/actions/runs/40535793069): browser, initial-loading, authoring-lobby and battlefield-rendering |
| Campaign visual inspection | Inspected `1366-campaign-aa.png` and `390-campaign-aa.png` from [browser artifact 12747678359](https://github.com/Orsnoire/FightSchool/actions/runs/40535793069/artifacts/12747678359); HP/MP, suppressed healing and responsive layout are legible without overlap |

- Local phase-4 tests used concurrency 2 to fit the workspace; CI's normal `npm test`
  also passes without that override.
- Disposable PostgreSQL/PGlite tests pass for production-history upgrades and
  legacy preview bridging, seeded wallets/receipts/results/progress/active rooms,
  old ledger preservation, retry/no-op behavior, corrupt-history rejection and
  transactional failure rollback. No provider test was performed.
- Historical fixtures use exact SQL/ledger hashes through their starting point;
  forward migration and post-bridge no-op use Drizzle's real timestamp migrator.
  PGlite's prepared-query limitation on old multi-statement migration 0008 is
  handled only while seeding the historical fixture with `exec`.
- Updated desktop/phone fixture browser acceptance passes teacher setup, gates,
  exploration, inn, both shops, saved resources and encounter resume. New checks
  cover licensed gear, capped resource display, suppressed borrowed healing, AA
  potion amount and reload persistence. The production AA browser suite also
  passes five-slot persistence and actual cross-class combat actions.
- Local Chromium download failed with a truncated archive. This is **not** a
  local browser pass. Live preview upgrade, live guardian victory, physical-device
  pacing and C12 operational signoff are not established by these checks.

## Handoff

PR #81 is reviewable, open and unmerged. The next action is code/migration review;
any later preview migration and deployment require separate authorization. That
release must use the guarded bridge above, preserve existing playtest progress,
and then record authenticated owner acceptance of a live guardian victory and
its 20-percentage-point stamina reward. Current fixture acceptance does not claim
that live acceptance. Production and C12 remain untouched.
