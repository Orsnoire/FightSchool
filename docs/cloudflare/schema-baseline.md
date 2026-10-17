# Cloudflare schema ownership and generation

C03 reconciles the Drizzle baseline with committed migrations through
`0014_guild_quests`. It changes declarations and metadata only. No new migration,
production DDL, data rewrite, or applied-history edit is required for C03.

C06 subsequently shipped index-only migration 0017 on October 17 via
[deployment 39075244755](https://github.com/Orsnoire/FightSchool/actions/runs/39075244755). Declarations, snapshot and journal
match its five measured indexes; all existing data and SQL reward functions are
preserved. Migrations through 0017 are now shipped and immutable.

## Ownership

| Structure | Source and maintenance rule |
| --- | --- |
| All 27 relational tables, 246 columns, defaults, checks, keys and indexes | `worker/db/schema.ts`; includes `quest_fight_evidence` and `personal_quest_receipts`. Match the shipped constraint names and delete actions. |
| `award_combat_results_with_stamina(jsonb)` | Handwritten PL/pgSQL; introduced in 0008, replaced in 0010 and 0014. Latest definition is in 0014. |
| `award_quest_batch(uuid,jsonb)` | Handwritten PL/pgSQL in 0014. Owns atomic quest rewards and receipt checks. |
| Avatar catalog seeds and recolor metadata | Handwritten data SQL in 0006/0007. These are product assets, not disposable test fixtures. |
| Historical data backfills/default transitions | Handwritten SQL: 0008 base XP backfill; 0010 fractional base XP conversion; 0014 legacy guild ceiling and personal receipt backfill. Preserve their order. |
| Applied migration order and SQL | `migrations/cloudflare/meta/_journal.json` and sibling SQL files. Append future migrations; never edit deployed entries or SQL. |

Drizzle snapshots do not own functions, seeds or backfills. Those require a new,
reviewed SQL migration when changed. Relational changes must also be represented
in the declarations and generated snapshot, even when their migration is handwritten.
The full migration chain remains the database creation path; fresh DDL generated
from declarations alone deliberately omits functions and product seed data.

## Repaired baseline

The journal reached 0014 but the latest snapshot was 0007. Generation consequently
proposed 23 duplicate column additions and a duplicate guild foreign key. The
catalog comparison additionally found two undeclared tables, nine missing checks,
a unique-index/unique-constraint mismatch for student nicknames, and the wrong
name for the live-session guild foreign key.

`0014_snapshot.json` records the reconciled declarations after existing migration
0014 and links to the retained 0007 snapshot ID. Missing intermediate snapshots
are not fabricated. All old snapshots, all 15 SQL files, and every journal entry
remain untouched. This is a one-time metadata repair, not a recipe for skipping
future migrations. No baseline SQL should be executed on an existing database.

## Verification and future changes

October 12 local verification: 3/3 focused schema checks, all 214 tests (including
existing-data preservation), typecheck and both production builds pass. CI/review
status and the exact published head are tracked in PR #58 and ACTIVE_WORK.md.

Run `node --import tsx --test tests/phase4/schema-baseline.test.ts` (also included
in `npm test`). The gate:

- Verifies SHA-256 hashes of shipped SQL through 0014 and the original journal
  prefix. Future entries may be appended; do not refresh the fixture to conceal
  an applied-history edit.
- Copies migrations to a temporary directory and runs the installed Drizzle CLI
  with the real config/declarations and an unusable dummy connection URL. Requires
  the no-change message and byte-identical SQL, journal and snapshots afterward.
- Applies every journal migration to disposable PGlite PostgreSQL, independently
  creates another database from the declarations, and compares canonical column
  types/defaults/nullability, named constraints and FK actions, indexes and tables.
- Checks the explicit SQL-owned function signatures. Reward behavior is covered
  by the existing stamina, guild-quest and Worker integration tests; this catalog
  gate is not a substitute for those behavior tests.

The existing `worker-integration.test.ts` inserts a populated student before 0011
and verifies all prior fields survive 0011–0014, including inventory, equipment
and gold, while new fields receive the intended defaults. Full CI retains this
existing-data preservation gate.

For the next relational change, edit declarations, generate and review an
**appended** migration (0015–0017 have already shipped), and include its snapshot/journal entry. Put
required procedural/data SQL in the reviewed new migration, then run all gates.
If the catalog comparison differs, fix the new declarations/migration rather
than changing shipped SQL or weakening the comparison. PGlite provides offline
PostgreSQL catalog evidence; it does not claim to inspect the live Neon catalog.
