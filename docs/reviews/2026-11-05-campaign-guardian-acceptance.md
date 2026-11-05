# Campaign guardian acceptance — review draft, November 5, 2026

**Prepared against main `8605097b13179f77d020a1cd3c1426ef1043aca8`.**
The owner approved opening the two existing AP Cave Key gates and publishing
this test-only draft on November 5. Both gate updates are verified below.
No deployment, environment creation, production fixture or student-progress
write was performed. The new authenticated browser runner has **not** been
executed. Its live result remains unverified.

Current main records MATH-02 accepted; its work is complete. The only open PR
found before publication was C12 / #75, a separate release/performance project.
**CAM-A01 — authenticated guardian acceptance** is registered on
`review/campaign-guardian-acceptance` / [draft PR #98](https://github.com/Orsnoire/FightSchool/pull/98) and does not supersede C12.
The branch carries its checkpoint; main is not directly edited by this
draft-publication approval.

## Key keeper diagnosis

Read-only inspection on November 5 of the Neon branch named **production**
(`billowing-glade-98094019` / `br-tiny-sun-b5fwfx52`, database `neondb`), using the
exact guild UUIDs in current `wrangler.jsonc`, initially returned:

| Guild | Current campaign | Cave Key gate | Valid assigned fights | Saved players / with keys / cleared |
| --- | --- | --- | --- | --- |
| AP Calculus | Hearthlight Expedition | Closed, campaign revision 0 | 4 | 4 / 0 / 0 |
| AP Precalc 2027 | Hearthlight Expedition | Closed, campaign revision 0 | 8 | 3 / 0 / 0 |

Both layouts have a matching quest keeper for every gate. These initial
database observations supersede the October 29 *no campaign yet* checkpoint.
They do not independently re-establish the live Worker's opaque DATABASE_URL
mapping or prove what a particular student's browser displayed.

The observed closed gates are sufficient to explain a keeper refusing a key.
`Campaigns.tsx` creates named gates with `open: false`; `CampaignAdventure.tsx`
disables **Collect key** when closed; `worker/campaign/actions.ts` rejects the
quest action with **Your teacher has not opened this unlock yet.** This is an
explicit teacher configuration prerequisite, not evidence of a broken grant.

Other prerequisites are: active membership in the allowed guild, an existing
character, a currently valid selected assigned question bank, no active encounter,
and overworld position on or orthogonally adjacent to that key's keeper. All
required gates must be open AND individually collected before cave entry.
Diagonal adjacency does not count. Closing a gate preserves the collected key
but blocks access. The student view polls every 3 seconds when idle.

**Owner-approved remedy completed November 5:** a single guarded database
transaction opened **Cave Key** for exactly these two campaigns. Fresh reads
verified matching guild ownership, active guilds, revision 0, exact named gate
IDs and hashes of every other campaign field before the write. The transaction
required exactly two updates or rolled back; it changed only each gate's `open`
flag and incremented its campaign revision to 1. An independent post-commit read
confirmed both gates open and both other-field hashes unchanged. This was a
provider configuration update, not a claim of authenticated teacher-UI acceptance.
No campaigns were recreated, no keys directly granted, and no student progress
or membership table was written. Students still collect their own keys. Scope:

- AP Calculus: `ccaa4e20-dbec-4b67-a6c2-dc7d57f3c667`.
- AP Precalc 2027: `dce4cc5d-8a65-4b74-961c-bf0839c17ede`.

## Smallest useful fixture

| Object | Quantity | Purpose |
| --- | --- | --- |
| Fresh QA teacher | 1 | Owns all test content and configures the campaign in a real browser context |
| Fresh QA student | 1 | Level-one Warrior with normal starter gear; separate authenticated browser context |
| Fresh QA guild | 1 | Contains only that student; never reuse either classroom guild |
| Teacher-owned fights | 2 | One unassigned campaign template with `9+9 → 18`; one assigned bank with `2+2 → 4` |
| Fresh campaign | 1 | One generated overworld/cave, one named key, initially closed |
| Guardian sessions | 2 | First completion and a second win after the QA student's explicit personal reset |

Each fight has one short-answer question, 60-second question clock, base XP 1,
base enemy damage 1, no loot, fixed ordering. The server creates its actual normal
slime and boss snapshots. Distinct template/bank IDs and question IDs detect an
accidental fallback to creation-time content. One fight alone cannot detect that.
No outsiders, second student, equipment shop exercise or 30-player load fixture
is needed: those boundaries already have deterministic/canonical coverage.

The runner earns depletion through at least two **real ordinary campaign wins**;
it never sets stamina, HP, position, guardian health, results or clear flags via
SQL. It walks the generated map and completes every triggered encounter, bounded
by 200 steps per route, 60 encounters, 60 rounds per encounter, six minutes per
encounter and 20 minutes overall. It does not forecast encounter rolls. The
one-question bank deliberately minimizes runtime without bypassing game rules.
A local real-engine feasibility probe with starter Warrior gear produced a
one-round ordinary win (16 HP retained) and a six-round guardian win (5/16 HP),
using real phase advancement. That is fixture feasibility, not browser acceptance
or a claim that every generated run has identical combat randomness.

## Precise suite additions

| File | Change |
| --- | --- |
| `tests/staging/campaign-guardian-acceptance.mjs` | New opt-in real Playwright HTTP-cookie/WS/UI scenario. Default invocation is plan-only and makes no requests. Fresh QA objects are created only after target/approval validation. |
| `tests/staging/campaign-acceptance-contract.mjs` | Target guard, independent stamina oracle, topology-only route finder. No application changes. |
| `tests/staging/campaign-acceptance-target.example.json` | Disabled manifest template listing required independently verified provider identities and source version. |
| `tests/staging/campaign-provider-audit.sql` | Read-only, fixture-scoped receipt/progress/frozen-bank/stamina audit for the independently verified provider database. |
| `tests/phase4/campaign-acceptance-contract.test.ts` | Three focused tests of the runner's target refusals, reward oracle/day rollover, and routing. |
| `tests/phase4/campaign-movement.test.ts` | One regression for teacher gate revision changes arriving without a student-progress revision change; stale closed-gate poll cannot overwrite opened state. |

Keep `tests/browser/campaign.mjs` and the canonical live combat scripts intact.
Do not add this network test to `npm test` or a PR/push-triggered live job. After
review, a separate **manual-only** acceptance job can reuse the existing browser
tool installation, run the new script once, and retain its scoped screenshots and
evidence JSON. No changes to `deploy/production-acceptance.json` are proposed.

## Assertions and existing evidence

| Area | Existing deterministic coverage | New browser/API assertion | Provider assertion / limit |
| --- | --- | --- | --- |
| Teacher configuration and beta authorization | `campaign.test.ts`: allowlist, membership, archived guild, owning teacher, stale gate revision | Teacher creates the campaign via UI with closed key; distinct HTTP-issued sessions | Independently verify source/version/bindings and isolated beta policy before execution |
| Selected question bank | `campaign.test.ts`: assigned/nonempty/owned bank, removed/archived/empty selection, frozen in-flight content | Entry disabled until explicit selection; only assigned bank shown; every observed question and result uses that bank, never template | `campaign_encounters.fight_snapshot`, live session and result all reference selected bank |
| Keeper and cave gates | `campaign.test.ts`: closed rejection, student forbidden gate writes, open grant, stale update, reclosure | Closed key button and server grant rejected; opening reaches student via live polling without refresh; key action replay writes once; reload retains key; reclosure blocks cave while retaining key | Existing AP gates opened with owner approval and independently verified; actual classroom key collection remains unobserved |
| Complete guardian | Existing HTTP test manually constructs `game_over`; October 20 live result predates stamina reward | Real answers, Attack, Ready and real UI playback through victory; no mocked responses, forced victory or injected socket states | Two settled objective sessions, each completed/victorious with exactly one receipt |
| Saved progress/resources | `campaign.test.ts`, advancement/consumables tests: frozen handoff and retry-safe settlement | Active session clears, `cleared=true`, final HP/MP/charges carry back, layout/key/bank/progress revision survive reload | Compare `campaign_players` state/revision and layout digest with captured snapshots |
| Stamina | `campaign-stamina.test.ts`, `stamina.test.ts`: SQL/TS curve, cap, first/repeat wins, loss/departure/nonparticipation exclusions, concurrent rooms, rollover, ordinary rewards | Sample immediately before and after EACH encounter; ordinary bonus 0; guardian bonus 0.20 in depleted fixture; actual completed count advances once; winning XP rate equals pre-award rate; result banner agrees | Read `stamina_day`, `daily_combats`, `stamina_recovery`, result audit fields; recompute curve independently |
| Reconnect | `campaign.test.ts`: frozen join and mocked durable eviction; movement test recovery; publication tests checkpoint ordering | Reload active guardian browser; same room/roster, round, deadline, HP/MP/charges and enemy HP; finish through normal UI | Browser reconnect is not a forced DO eviction/provider outage drill |
| Duplicate rewards | `campaign-stamina.test.ts`: concurrent/retried `persistCombatResults`; `campaign.test.ts`: settlement retry | Reopen completed room in second authenticated tab; reload original; same receipt ID; history/count/stamina/student XP/gold/job levels/progress unchanged | Audit one result per student/session; an actual failure between SQL commit and DO receipt needs a separately approved isolated fault drill |
| Repeat victory | `campaign-stamina.test.ts`: distinct session grants another reward | Reset ONLY the QA student's one adventure, recollect saved open gate, walk back, beat guardian again; distinct session/result IDs | First receipt remains; second receipt has its own award; replay must never be counted as a repeat victory |

The cap-at-100% and negative reward cases stay in deterministic tests; repeating
all of them live would add fixtures and runtime without addressing the specific
end-to-end gap. The new browser path does not replace authorization, cap, migration,
equipment, visual-layout or classroom concurrency tests.

### Correct stamina oracle

Do **not** assert `after = before + 0.20`. The win first pays its normal fight cost.
For completed count `n` and saved recovery `r`, let `f` be the documented stamina
curve. Winning XP uses `f(n-r)`; the no-bonus next rate is `f(n+1-r)`; the guardian
next rate is `min(1, f(n+1-r)+0.20)`. The receipt stores the actual difference
between those last two values. Actual daily count increments; recovery does not
decrement it. Post-win stamina can be lower than pre-fight stamina even with the
bonus. The runner infers effective position from the public pre-fight rate and
independently recomputes the next rate; it does not import the production formula.

Abort as inconclusive if Denver midnight changes `resetsAt`, if rate has reached
the numerical floor, or if another session changes the fixture's count. Start at
least 15 minutes before midnight. Keep the student exclusive to this run.

## Environment dependencies and execution boundary

1. **Draft publication and the two AP gate openings are approved. Provider
   setup and authenticated test execution still require separate approval.**
   No new QA identities have been created.
2. Use a new disposable environment, not the old retained campaign preview or
   C12 rehearsal. Verify its Worker, Neon branch/database, Durable Object namespace
   and R2 bucket are distinct from all production and retained environments.
   Provision a schema-only database with the canonical migrations through 0026
   (27 journal entries at this source). Do not apply current migrations blindly
   to the historical preview; its legacy bridge is a separate operation.
3. Deploy the reviewed source to that isolated Worker with its own auth secrets,
   allowed origin and cookies, ready assets and WebSocket support. The draft uses
   `ENVIRONMENT=campaign-preview` on this isolated target to admit the newly created
   QA guild without changing any production allowlist. The production allowlist
   enforcement itself remains covered by existing deterministic HTTP tests. An
   isolated production-policy variant would need a precreated allowlisted QA guild
   and a separately reviewed manifest/driver change; it is not silently claimed.
4. Pin the exact app SHA and Worker version independently. `/api/health/ready`
   proves readiness, not code identity or database mapping. Fill the manifest only
   after verification. Its booleans are operator attestations, not cryptographic
   proof that a similarly named environment is isolated. Known production aliases
   and the retained preview are hard-refused. The historical Worker named
   `questacademy-staging` serves production; its name is not an isolation signal.
5. Runner requirements: repository's Node 22/npm lockfile dependencies, Chromium
   runtime libraries, outbound HTTPS and WebSocket access to the isolated origin.
   Reuse the existing browser workflow's isolated `playwright@1.62.1` install;
   do not change the application dependency tree or lockfile. Optionally set
   `PLAYWRIGHT_CHROMIUM_EXECUTABLE`. No database or provider credential is supplied
   to the browser runner. Real application signup/login endpoints issue cookies;
   UI localStorage values are identity hints only. Login-screen visual acceptance
   is outside this scenario.
6. Default safe inspection command:
   `node tests/staging/campaign-guardian-acceptance.mjs`.
   After explicit approval and target verification only:
   `node tests/staging/campaign-guardian-acceptance.mjs --execute /private/reviewed-target.json`.
   Never run the existing canonical staging scripts to prepare this fixture; they
   execute immediately and some default to production.
7. Retain `artifacts/campaign-acceptance/<run>/evidence.json` and screenshots.
   The JSON journals created IDs incrementally, session/result IDs and stamina
   observations; passwords, cookies and raw network traces are not saved. A failed
   run retains its fixtures for diagnosis and logs out established sessions.
   An ambiguous create response requires scoped inspection before retry; never
   broad-delete by a QA name prefix. No automated cleanup/reset of external
   environments is included. Remove an entire disposable environment only after
   review/approval of its exact identities and retained evidence.
8. Use `campaign-provider-audit.sql` on the independently verified isolated target,
   substituting only the exact IDs in that run's evidence. It executes a read-only
   transaction, guards fixture ownership, and returns persistent receipts/state.
   Capture before/after completed-room replay if provider-level unchanged-state
   evidence is required; the runner itself already compares API snapshots across
   that replay. Do not call `persistCombatResults` manually against a provider.

The runner ends at **browser/API passed; provider audit pending**. Only after the
provider audit, pinned-version evidence and owner review should this scenario be
recorded as accepted. A passing isolated run is not acceptance of either current
AP production campaign. Production gameplay verification would need a separately
approved dedicated QA guild and configuration, never classroom membership edits.

## Local verification

- JavaScript syntax and default no-network plan mode passed.
- The disabled example manifest was rejected before importing Playwright or
  making any network requests; execution requires reviewed isolation/approval.
- 15 focused tests passed: campaign HTTP, stamina, publication, movement and the
  three new runner-contract tests, including the new keeper-poll regression.
- `npm run check` passed.
- The read-only provider-audit SQL parsed/executed successfully against an
  isolated local PGlite database with all 27 canonical migrations and synthetic
  ownership rows. This validates its schema references, not live provider data.
- Real-engine fixture feasibility probe passed as described above.
- Local checks used Node 24.22.1; repository CI specifies Node 22 and has not run
  this unpublished proposal. `git diff --check` passed. Remote main was rechecked
  and still matched the pinned baseline at review completion.
- No authenticated browser run, provider fixture creation,
  provider fault injection or operational acceptance is claimed.

## Remaining review boundary

The owner approved the two existing AP Cave Key openings and this test-only
draft PR. Provisioning/running a new isolated environment still requires review
of its concrete resource identities and separate approval. Production fixtures,
resets, deployment and fault injection are not authorized by this publication.
