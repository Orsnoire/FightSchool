# MATH-02 missing-exponent authoring pilot

Status: **MERGED / MIGRATED / DEPLOYED — live authoring acceptance pending fixture approval**.
[November 5 release evidence](../releases/2026-11-05-math-02.md).
Base: `326dd08004b145fea5a25472a3a5b854818a621d`; branch: `feature/math-02-authoring`.
[PR #97](https://github.com/Orsnoire/FightSchool/pull/97), authorized November 5.
Published implementation checkpoint: `32fa766593364a9eb5610b73839cd8c431dd0b42`.
Initial published head `eac51e02389dfdc58dbf7d926a3a3185e0e24999` has exactly the
same Git tree as local reviewed `9b5d640`; publication reconstructed the commits
through GitHub after direct Git push was unavailable. No code changed in transit.

The owner approved the scoped missing-integer-exponent pilot and the proposed
versioned teacher-owned storage on November 4, 2026, then draft publication on
November 5. Consequential dependencies, merging, production migration and deployment
were initially reserved. The owner explicitly approved merge, migration and deployment
on November 5 after the draft passed CI and all four browser jobs. The earlier
local-only checkpoint followed the owner's publication boundary. Consequential
dependencies and symbolic/live-session expansion remain outside scope. C12 / PR #75 remains separate.

## Result and instructional boundary

Teachers can search three curated skills, configure exponent ranges, preview
valid questions, try an answer through MATH-01, save a draft, approve the reviewed
version, and reopen immutable revision history. The workspace is in the existing
Questions tab, above the fixed-question editor. Settings survive tab changes and
hiding the panel; saving a fight requires pending template work to be saved or
discarded. Templates remain personal to their teacher.
Template controls are disassociated from the surrounding fight form, so their
native validation and Enter behavior cannot interfere with fixed-fight submission.

| Candidate | Fit with the deployed grader | Decision for this slice |
| --- | --- | --- |
| Numerical fraction practice | Exact rational answers and required forms already work; relatively little mathematical infrastructure needed | Valid future family, but less directly aligned with the immediate Math 3/AP Precalculus exponent practice |
| Missing-integer exponent rules | Prompts contain powers; answers are ordinary integer literals already supported by MATH-01 | Approved pilot: product, quotient and power of a power |
| Full symbolic exponent simplification | Answers such as `x^8` require a different answer contract/parser and equivalence/form checks | Deferred; the missing-exponent pilot does not implement this |
| Rational-expression simplification | Requires linked polynomial factors, original-domain exclusions, cancellation checks and symbolic answer/form validation | Deferred; no symbolic component selected |

This pilot exercises exponent reasoning but does not assess construction of an
entire simplified expression. It is teacher authoring only: no generated combat
questions, Add to fight action, CSV export of templates, session-length policy,
student answer entry, live grading change or reward change.

## Parameters, examples and validation

Each template asks for the integer `k` making an identity true **for every positive
real x**. This avoids zero-base and negative-base ambiguity and states an identity
instead of asking about one possibly degenerate value such as x = 1.

| Rule | Generated example | Answer | Other valid variant |
| --- | --- | --- | --- |
| Product | `x^3 · x^5 = x^k` | `8` | `x^(-2) · x^5 = x^k`, answer `3` |
| Quotient | `x^2 / x^5 = x^k` | `-3` | `x^6 / x^2 = x^k`, answer `4` |
| Power of a power | `(x^(-2))^3 = x^k` | `-6` | `(x^(-3))^(-2) = x^k`, answer `6` |

Teacher controls:

- Title (1–120 characters), optional teacher note (up to 1,000), and selected rule.
- Separate inclusive integer ranges for m and n, each within -6…6; defaults 2…6.
- Answer sign: any, positive, or negative. Positive inputs can produce negative
  quotient answers; the UI explains that behavior.
- Include identity cases, off by default. Off excludes input exponents 0 and 1
  and output k = 0. On permits them under the same positive-base assumption.
- Preview count 1–10, default 5; new-batch control advances a deterministic seed.

The server exhaustively enumerates at most 169 parameter pairs per rule, filters
the selected constraints, deduplicates swapped product factors, and samples
without replacement with a pinned v1 shuffle. It reports the finite available
count, returns fewer previews when exhausted, and refuses an empty pool. It never
changes the requested rule or silently widens parameters. Zero/negative exponent
cases remain defined because the base is positive. No arbitrary formulas execute.

The generator derives k by the integer power laws, then checks each generated
answer against the unchanged exact grader. Tests independently evaluate all 507
rule/parameter combinations using repeated BigInt multiplication and exact
reciprocals at bases 2, 3 and 5, searching all possible k in -36…36. These are
regression checks, not a general symbolic-equivalence proof. The mathematical
justification is the integer power laws on positive reals; uniqueness follows
already at base 2, where distinct integer powers are distinct.

For the product example with expected answer 8, the deployed grader accepts `8`,
`+8` and `08`; `8.0`, `16/2` and `4+4` are equal in value but fail the requested
integer-literal form. `x^8`, `2^3` and LaTeX fraction input remain unsupported and
return **indeterminate**, not a mathematical verdict of incorrect. The UI explains
this distinction and clears old feedback when the trial answer changes.

## Review, versions and ownership

1. Saving creates a draft revision and a server-generated preview snapshot.
2. The teacher reviews the prompts, answers, explanations, base assumption and
   response format, then checks an explicit confirmation box and approves.
3. Approval recomputes the full bounded pool and reviewed preview, verifies both
   content and preview hashes, and appends an approved revision with actor/time.
4. Later edits append new drafts. Earlier approvals and previews remain available;
   a historical revision can explicitly become the basis of a new draft.

Presets pin schema, family, generator and grader versions. Snapshots preserve the
actual prompts, parameters, explanations, answer contracts, seed, shuffle version,
requested/available counts and SHA-256 hashes. A seed alone is not the record.
Unknown preset versions open read-only; the application never silently upgrades
or approves them. Approval is for authoring reuse and grants no live-session access.

The additive `0026_math_templates.sql` proposal introduces only:

- `math_templates`: teacher ownership, creation retry key, latest revision and
  timestamps.
- `math_template_revisions`: immutable-through-API revisions, complete preset and
  preview JSON, content/request hashes, mutation receipt, state and approval audit.

Unique keys and atomic SQL statements protect retries; expected-revision checks
reject concurrent stale edits with 409 while preserving the client draft. A failed
revision insert rolls back its head advance. Every list/read/write/history/retry
operation is teacher-scoped. Foreign identifiers return 404, nonteachers cannot
access the API, and existing mutation-origin checks still apply. Request bodies,
parameters, search input, previews and pagination are bounded. No public sharing,
delete flow or imported executable template is provided.

## Code map

| Area | Files and behavior |
| --- | --- |
| Contracts and generator | `shared/contracts/math-templates.ts`, `shared/math/templates/exponents.ts`: strict supported versions, finite generation, deterministic snapshots |
| API | `worker/routes/math-authoring.ts`, small dispatch in `worker/index.ts`: teacher catalog/list/preview/create/read/revise/approve endpoints |
| Persistence | `worker/db/math-template-repository.ts`, additions to `worker/db/schema.ts`: owner-scoped reads, atomic creation/appending, retry receipts and concurrency checks |
| Migration proposal | `migrations/cloudflare/0026_math_templates.sql`, appended journal/snapshot, `math-authoring-contract.json`: two new tables and their constraints/indexes |
| Teacher UI | `client/src/features/math-authoring/`: search, controls, previews, grading trials, approval, saved versions; small integration in `QuestionsPanel.tsx` and `CreateFight.tsx` |
| Regressions | `tests/phase4/math-templates.test.ts`, `math-authoring.test.ts`, `math-authoring-ui.test.ts` and shared fixture; intentional current-history expectations in `campaign-migrations.test.ts` |
| Browser gate | `tests/browser/math-authoring.mjs`, existing authoring CI job: real app + real Worker/disposable Postgres at desktop and phone sizes |

MATH-01 parser/grader, fixed-question contracts, CSV importer, combat logic and
package dependency manifests are unchanged. The large Drizzle snapshot is generated
schema metadata. Historical migration SQL and campaign bridge contracts are intact.

## Verification and acceptance

| Gate | Local evidence / remaining work |
| --- | --- |
| Mathematical correctness and bounds | Five generator tests pass, including all 507 parameter combinations, independent exact oracle, sign/identity constraints, empty pools, deduplication and unsupported answers |
| Authenticated storage and approval | Nine API tests pass using the real Worker against disposable PGlite through the Neon HTTP transport boundary; owner isolation, tampered hashes, retries, concurrent saves, insert rollback and unsupported versions covered |
| Teacher interaction | DOM integration test passes with real React components, Worker, Postgres and KaTeX; tab draft retention, previews, grading, lost-response retry, approvals, historical drafts, conflicts and reopen after remount covered |
| Existing application | `npm test`: **449 passed, zero failed/skipped** (5 phase 2, 7 phase 3, 421 phase 4, 16 rich-content); includes existing CSV, fixed-question, answer secrecy, combat and reward regressions |
| Migration/data preservation | All eight campaign migration tests pass; schema baseline/generation checks pass. Dedicated fixture snapshots every existing public table before 0026 and verifies unchanged rows afterward. Existing ledger prefixes stay intact; new canonical history has 27 rows |
| Deployment safeguards | All 13 existing deployment tests pass; no safeguard relaxed |
| Compile/build | TypeScript and client/Worker production builds pass |
| Desktop/phone browser acceptance | All four final-head browser jobs pass; desktop/phone screenshots inspected. Local Chromium still cannot launch (`socket() failed: Operation not permitted`); CI supplies the browser evidence |
| Publication/release | PR #97 merged, additive production migration and deployment verified; canonical live combat acceptance passes. New live authoring smoke awaits explicit production-fixture approval |

The full application suite passed, followed by a focused DOM rerun, TypeScript and
build after the final UI feedback/read-only polish. Initial migration-suite failures
were outdated expected forward-history lengths (26/30); those now expect 27/31
and the new schema fingerprint. Historical ledger assertions were retained.

First published browser run [42041629366](https://github.com/Orsnoire/FightSchool/actions/runs/42041629366)
passed existing authoring/CSV checks, then stopped at the new exact `Answer sign`
label lookup. Explicit accessible names now identify the template dropdowns;
browser assertions remain unchanged, and failure screenshots are retained. See the
live PR for verification of the corrected head.

Exploratory local Node/PGlite measurements: 100 maximum-pool preview operations
after 10 warmups gave p50 3.05 ms / p95 11.24 ms; 30 simultaneous authenticated
preview requests gave p50 119.67 ms / p95 126.94 ms. These measurements include no
production network, do not establish classroom latency, and are not load guarantees.

Reproduce the main checks:

```sh
npm test
npm run check
npm run build:cloudflare
node --test tests/deployment/*.test.mjs
UI_ORIGIN=http://127.0.0.1:4177 node --import tsx tests/browser/math-authoring.mjs
```

The browser command requires a running production preview and installed Playwright
Chromium, as configured in the existing authoring CI job. Its acceptance assertions
include full fixed-fight/CSV save and reopen, both viewport sizes, horizontal
overflow, errors and screenshots. CI/browser review is complete; the new live authoring smoke remains an open gate
because automatic approval review blocked creating its production QA fixtures.

## Release decisions and remaining gate

Draft publication and CI/browser review are complete at `234f645`:
[CI](https://github.com/Orsnoire/FightSchool/actions/runs/42042381980),
[all four browser jobs](https://github.com/Orsnoire/FightSchool/actions/runs/42042382023).
Both authoring screenshots were inspected. The owner subsequently authorized
merge, migration and deployment. See the live PR for final-head release-tooling checks.

The release adapter now explicitly recognizes the 27-row `math-authoring` stage;
historical stages remain bounded. `production-math-migration.mjs` accepts only the
exact 26-row history/schema, locks existing tables, applies 0026 atomically, and
checks the new schema, every existing public-table row digest and the original
ledger prefix. Repeating against the exact 27-row schema is a no-op. Local tests
inject late failure, changed rows, old ledger drift and pre/post schema drift.
The exact generated transaction passed twice on an isolated native production
child. Private branch/recovery identities stay outside Git. Production migration
still follows protected pause, independent identity/room verification and a native
recovery copy; then post-migration verification, resume and live acceptance.

Symbolic grammar/libraries, fraction or rational-expression expansion, generated
sessions, live indeterminate policy, sharing, student response UI, and completion/
reward rules remain separate decisions. Selecting this family settles none of them.

The final release-tooling head `378f40c` passed CI and all browser jobs before
merge. Production now serves merge `7562485` with the verified 27-entry ledger and
all 958 saved rooms preserved across migration. Canonical combat acceptance passed.
The new authoring smoke was blocked by automatic approval review; it has not been
retried or moved to another executor. Explicit approval for two QA teachers and
three sample templates remains necessary. See the release evidence for the exact
production state and prepared test.
