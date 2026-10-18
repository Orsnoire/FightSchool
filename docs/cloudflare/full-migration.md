# Worker migration and combat recovery

> **RELEASE HISTORY + OPEN OPERATIONS — updated October 18, 2026 (UTC).**
> The application migration is deployed; full operational signoff remains open.
> [Current status](../CURRENT_STATUS.md) names the latest runtime. Dated entries
> below retain earlier evidence and historical blockers; they are not competing
> current queues. Recovery and rollback follow-up belongs to [cleanup C12](../CLEANUP_PLAN.md).

This replaces the incomplete Phase 4 slice described in `phase-4-live-combat.md`. The implementation follows `../Migration_Plan`, `../Source_of_Truth.md`, and the current **Combat Flow Refactor**, **Quest Academy Expanded Class List**, and **Core Guild Design** documents.

> **C12 active in draft PR #75:** release/fixture safeguards and local verification are implemented. [C12 evidence](../reviews/2026-10-18-c12-release-review.md) and [current runbook](release-runbook.md) govern the remaining isolation, performance, recovery, rollback and classroom signoff. C12 has not been deployed; no operational gate is waived.

**Latest verified runtime:** `a580b30b6e9826fbaaca9f3e2cfc914a94e4c7ad`, released October 18 with C11 / PR #74.
[Deployment 39161062489](https://github.com/Orsnoire/FightSchool/actions/runs/39161062489) and [canonical acceptance 39161276964](https://github.com/Orsnoire/FightSchool/actions/runs/39161276964) passed on that same revision. Immutable Worker: `86111493-688d-41c2-9462-b050044b3d10`. No new migration or production-data reset.
See the [current release record](../ACTIVE_WORK.md) and [current status](../CURRENT_STATUS.md).
Earlier releases and R2 failures below are historical.
Full infrastructure recovery/rollback signoff remains open.

## Root cause and corrected behavior

The previous Worker stored answers without resolving attacks, healing, blocking, or enemy counterattacks. Exhausting the question bank incorrectly declared victory. The server now runs waiting → question (three-second introduction) → support choices → resolution → enemy AI → health check. Living enemies continue the fight by cycling the question bank; victory requires all enemies defeated, and defeat requires the entire party knocked out.

The engine is deterministic and independent of presentation, network transport, timers, and database I/O. It covers all twelve fully specified jobs in the class document. The unfinished Berserker sketch does not define an executable job and is not added. Job unlock requirements and stats follow the design rather than prototype formulas. Damage criticals and execution chances use a saved seeded generator. Question/option randomization uses a separate deterministic shuffle.

Numeric policy: health, MP, damage, healing, rewards and XP are whole numbers. Fractional damage/healing rounds down; fractional blocking capacity rounds up so the starting Warrior's VIT/2 block prevents one damage. VIT mitigation rounds down and is applied once. ATK, MAT, RTK and DEF are gear values; the documented primary-stat bonuses are added once by the attack or mitigation formula. Gold is normalized to exactly 10 at difficulty 1 and 10,000 at difficulty 100.

## Durable room and economy guarantees

- Signed session identity is verified before WebSocket upgrade; the browser cannot choose the acting student. Room ownership and private solo-room ownership are checked.
- Commands carry IDs, round numbers and question IDs. The object serializes all command/alarm mutations. Accepted-command receipts and updated state are stored together, with bounded receipts. Invalid commands do not consume their IDs.
- Reconnect restores state, deadline, current question and persisted results. The browser uses server time and does not restart phase clocks. A version-1 room is upgraded in place, retaining answers and remaining HP.
- Alarms compare saved deadlines and resume transitions after hibernation. Unsaved final results remain pending and retry through alarms; successful completion is announced after persistence.
- Unique session/student result rows are the source of XP and automatic gold. The ledger insertion and award are one SQL statement. Loot-versus-gold choices update the claim and inventory/currency atomically. Quest completion has a separate unique period ledger.
- Fight deletion archives content and removes assignments while preserving historical results.

## Remaining application services

Fetch-native routes cover guilds, authenticated membership, teacher-owned assignments/settings, solo sessions, equipment CRUD/equipping/purchases, job levels and unlocks, combat statistics, leaderboards, personal/guild/weekly/teacher quests, manual quest completion, guild XP, and shop tiers. Teacher-created items remain content authored by teachers; the engine does not invent campaign-specific gear or academic questions. Personal milestone and ultimate quests are initialized when a student joins a guild.

R2 stores image assets behind an object-storage boundary. Uploads require teacher authentication and same-origin mutations, accept only PNG/JPEG/WebP/GIF, verify file signatures, and cap the body at 5MB. Object keys use owner IDs and random identifiers. SVG and arbitrary executable uploads are rejected. Rich question HTML is sanitized on rendering.

The active app has one PostgreSQL schema in `worker/db/schema.ts`. Shared code contains public DTOs, validators and game rules. `server/`, Express sessions, Replit runtime/configuration, GCS code, legacy deployment scripts and the TypeScript error baseline have been removed. CI now requires a clean `tsc` result.

## Verification and deployment

Run `npm ci`, `npm run check`, `npm test`, and `npm run build:cloudflare`. The suite includes real PostgreSQL-compatible migration/reward tests using PGlite, deterministic combat, every unlocked ability's executable path, ownership/authentication, simultaneous command retries, early/expired alarms, and failed-result recovery.

Deploy Cloudflare Staging checks the app, ensures the `questacademy-objects` R2 bucket, applies committed additive Neon migrations, publishes to the existing Worker, and verifies both configured origins. No credentials are committed. Run Live Combat Staging Acceptance on the same branch against `https://questacademy.bookwyrminteractive.studio` to exercise a complete fight plus guild/shop/quest/reward/solo flows with isolated acceptance fixtures. The workflow never seeds production accounts on startup. Acceptance fixture fights are archived after use.

The historical pre-refactor rollback Worker version was `20382b06-88e9-42a3-805d-bc7ca476e602`, from successful deployment run `36749441658` on 30 September 2026. It includes the rich-content preview fix merged in PR #17 (`b10488316d9f008139c000e3d4e51383548a07e8`). The added database tables and columns can remain during rollback; do not remove them or replace the Durable Object namespace. Keep the canonical domain, Worker identity, session secrets and Neon database unchanged.

## Recovery checkpoint — 30 September 2026

The interrupted `cloudflare-migration/full-combat-refactor` worktree contained 102 staged changes without a commit or remote branch. Its exact staged tree was recovered in commit `520864a1668582e84a1817b058465875613b7a8b`, then current main was merged on `cloudflare-migration/recover-full-refactor`. The original worktree was left intact.

Recovery preserves the shared sanitized HTML/SVG/KaTeX renderer and its five regression tests from PR #17. Additional checks exercise the real Worker and Neon query adapter against a disposable PGlite database: authentication, guild ownership, class unlocks, fight ownership, room reuse after host refresh, object upload signatures/ownership, and logout revocation. No external accounts or production data are used by these local tests.

The combat hook now discards stale questions together with stale snapshots, clears state and pending commands when changing rooms, and retries outstanding commands only once after a reconnect. Durable Object commands revalidate the authenticated session, preventing a revoked session from continuing to act through an already-open socket. Pre-migration socket attachments reconnect to acquire the new verification metadata.

Local checks: `npm run check`, `npm test` (38 tests), `npm run build:cloudflare`, and `git diff --check` pass. These checks do not establish deployed acceptance.

The recovered tree was published in PR #18 and merged into `main` as `8738127a2749f0b7f046893a2072facfb3926d72` after owner authorization. CI passed on both the PR head (run `36763459258`) and merged main (run `36763615920`). The PR's Live Combat Staging Acceptance run was **skipped**, not passed. The owner subsequently authorized live deployment and acceptance testing.

Deployment preparation found and corrected an obsolete smoke assertion that expected object storage to be disabled (501). The smoke now reads a valid, randomly generated absent object key and requires a non-HTML 404. This exercises the R2 binding; unavailable storage still fails the release check.

Release sequence required at the recovery checkpoint:

1. Run **Deploy Cloudflare Staging** on the latest CI-passing `main`. Despite its name, this workflow updates the Worker that owns the canonical public hostname. It ensures R2, applies additive migrations, deploys, and checks both configured origins. If R2 availability or token permissions fail, fix the deployment configuration before proceeding.
2. Run **Live Combat Staging Acceptance** on the deployed revision with `staging_origin=https://questacademy.bookwyrminteractive.studio`. It must finish through genuine enemy defeat, database rewards, guild/shop/quest flows, and solo-room creation. The workflow uses explicitly created acceptance fixtures; application startup never seeds accounts.
3. Verify the host and student browser flows, including reconnect, question/answer previews, and a second isolated room. Finish the remaining storage/load/recovery/rollback checks in `../Migration_Plan` before claiming full migration acceptance.
4. Record the deployed commit, immutable Worker version, deployment run, acceptance evidence, and remaining limitations here. Retain the rollback version above and the additive schema.

At that checkpoint, the recovered refactor was merged but not deployed. Subsequent deployment and acceptance evidence follows below; CI alone is not a production cutover record.

### Deployment attempt — 30 September 2026, 19:19 UTC

PR #19 corrected the storage smoke check and merged as `8558015a5d6bc978cc28f151bd217bb4c561ec17`. CI passed on that merged revision (run `36764680747`). The owner authorized starting deployment through GitHub's browser interface.

**Deploy Cloudflare Staging** run `36764886693` (job `110056452170`) ran against `8558015` and passed dependency installation, type checking, all tests, and both builds. It stopped at **Ensure image storage bucket** with Cloudflare's response: `Unable to inspect R2 bucket (403): Please enable R2 through the Cloudflare Dashboard.` Database migrations, secret preparation, Worker deployment, and both smoke checks were skipped. This attempt changed neither the live Worker nor its database.

The owner enabled R2 and authorized continuing. Attempt 2 (job `110058036415`) passed R2 and additive migrations, then published Worker version `7b528a4b-4286-4694-97e0-dd772c7b19b6` at 19:24 UTC. Its immediate storage smoke hit the previous rollout version (501); subsequent probes of both hostnames returned the required 404. The smoke now uses the existing bounded rollout wait for this probe as well as liveness/WebSockets.

Canonical live acceptance run `36765677655` reached guild quest completion but received a 503. Local reproduction enforcing the Worker's 50 external-subrequest budget showed that personal quest evaluation fetched the same student's job levels once per quest. Job levels are now loaded once for all relevant students. The integration test enforces that budget and completes a manual quest twice, requiring exactly one award.

Browser acceptance also found a valid teacher cookie with missing browser-local identity: the dashboard showed no fights and Create Fight redirected to login. Session verification now restores the teacher display cache from the authenticated response; Create Fight waits for that verification instead of trusting absent local storage. A regression test covers missing and stale cached identity.

Deploy these acceptance fixes, then repeat canonical live combat and browser acceptance. The last pre-refactor rollback version remains `20382b06-88e9-42a3-805d-bc7ca476e602`. Full storage/load/recovery/rollback acceptance is still outstanding.

PR #20 merged those fixes as `d9adc222ea2c8f3ef7c88bde3c8d54298b361fcf`. Deployment run `36766938447` passed completely, publishing Worker `9128ae40-c8cb-4843-bf28-ed686c86b601` at 19:38 UTC; both origins passed HTTP/database/WebSocket smoke checks.

The additional live R2 probe passed authenticated upload, byte-for-byte readback, MIME/cache/nosniff headers, duplicate-upload rejection, anonymous write rejection, and foreign-origin rejection. It exposed missing Range/HEAD handling, now covered by explicit range parsing, metadata responses, and integration tests. `tests/staging/operational-acceptance.mjs` extends the manual acceptance workflow with these checks plus a 30-player room, a second isolated room, host refresh reuse, concurrent answers, reconnect, exactly-once results, and open-socket logout revocation. It uses isolated fixtures and archives its fights. A workspace DNS failure prevented local WebSocket load verification; the workflow runner is the intended execution environment for that test.

PR #21 merged as `a943eeaa0b1355f203b30e802f5591137a8fc504`; deployment `36767696373` published Worker `dceda7fc-a3fa-4d7c-9066-8c122646ec96` and passed both smoke checks. Live acceptance `36767944961` passed the complete combat/guild/shop/quest/reward/solo/history flow and all storage checks. Thirty-player attendance, a second isolated room, host reuse, answer bursts, reconnect, and logout revocation passed (answer acknowledgement p50 1,962ms, p95 3,767ms, max 3,916ms). Thirty-player result persistence remained pending because it still queried and updated per student. The follow-up batches identity/assignment reads, ledger awards, and derived job levels, preserving unique result receipts and atomic XP/gold. A 30-player local database regression enforces a 45-query ceiling, retries completion, and requires exactly one XP/gold award per player.

Quest completion and recipient rewards are also batched: the same regression completes 30 personal level milestones and one class-wide teacher award, then retries without duplicating student gold or guild XP. This keeps both result saving and simultaneous classroom progression within the request budget.

### Live deployment — 30 September 2026, 19:59 UTC

PR #22 merged the classroom persistence fixes as `bfc4fbedbdec3e2bde1752ce4796bb06c1461d7a` (runtime tree `28b0424bb5ec6071aaecace0f072db2911d12327`). [Deployment run 36769310686](https://github.com/Orsnoire/FightSchool/actions/runs/36769310686), job `110071359534`, passed strict type checking, all 40 tests, builds, R2 provisioning, additive migrations, deployment, and both origin smoke checks. The live immutable Worker version is `8e7588f1-e259-4c64-9a44-a6f5fcb0e825`.

The existing signed-in teacher browser successfully restored its session identity, listed all three existing battles, rendered rich question/answer previews including the graph in Construct a Function, and loaded Create Fight directly without a login redirect. Existing teacher content was inspected without edits.

Acceptance run `36769499444` passed full combat and storage, and classroom completion returned promptly after the batching fix. Its final assertion incorrectly expected a resolved answer immediately after ending the fight during the question phase; totals are counted when the round resolves. The operational script now advances all 30 players through question and support readiness, verifies resolved totals, then ends the fixture and checks all 30 saved results. This correction changes only acceptance code and documentation; the deployed runtime is unchanged.

### Functional live acceptance passed — 30 September 2026, 20:07 UTC

PR #23 merged the corrected acceptance script as `eff0f786c3dac5e40d615f9d72b06bdd83f1a595`, after successful CI run `36769944816`. [Live acceptance run 36770136289](https://github.com/Orsnoire/FightSchool/actions/runs/36770136289), job `110074128400`, passed both steps against `https://questacademy.bookwyrminteractive.studio`:

- Complete combat: correct/wrong answers, damage, enemy AI, question cycling, reconnect deadlines, stale and retried commands, durable XP, guilds, quests, shop, reward claims, solo hosting, history, and owner isolation.
- R2: authenticated upload, exact byte readback, MIME/cache/nosniff headers, immutable duplicate rejection, anonymous and foreign-origin rejection, range reads, and HEAD metadata. Deployment smoke also verified a missing-object 404.
- Classroom: 30 participants, host refresh reuses the room, a second room remains isolated, simultaneous answers, reconnect with the original deadline, one resolved answer and one persisted result per student, and logout revocation of an already-open socket.

The final 30-player answer burst measured p50 **2,067ms**, p95 **3,876ms**, maximum **4,025ms**, below this smoke test's 15-second maximum. This is a single live burst, not a sustained-load latency guarantee. Local PGlite regression tests additionally verified exactly-once XP/gold and simultaneous classroom quest rewards under a 45-query ceiling.

The live Worker still runs runtime commit `bfc4fbe`, immutable version `8e7588f1-e259-4c64-9a44-a6f5fcb0e825`. Later commits contain only the acceptance correction and this documentation, so no additional runtime deployment was required. All 40 local/CI tests, type checking, builds, both deployed smoke checks, and both final live acceptance steps passed.

### Operational signoff still open

Functional live acceptance does not close every Phase 7 gate in `../Migration_Plan`. Remaining evidence includes a forced deployed Durable Object restart/eviction, deliberate Neon interruption and connection-limit recovery, a timed immutable-version rollback rehearsal, a complete student desktop/mobile browser pass, and the agreed monitoring/observation window. Local restart and failed-save tests plus live reconnect are useful evidence, but are not substitutes for those infrastructure drills. Perform disruptive drills in an isolated deployment or an agreed release window.

Keep Worker `20382b06-88e9-42a3-805d-bc7ca476e602` as the pre-refactor rollback reference. The accepted runtime version recorded above is an additional immutable checkpoint. A Worker rollback does not undo Neon, R2, or Durable Object data; retain the additive schema and existing bindings. Acceptance creates separate accounts with random passwords and tiny image fixtures, and archives its fight fixtures. It does not edit the teacher's existing battles.

## Classroom balance release — 1 October 2026

PR #29 merged as `35aa3fe998330305f912959dcd9c01aa17a6ba88`. It adds daily XP
stamina, 20-second support selection and HP/threat tiles, potion replenishment,
quiz-based enemy HP, solo survivability, half-threat Block transfers, and the
approved Wizard/Scout balance. The exact rules and deferred Priest design are in
[Classroom balance and daily stamina](../combat/classroom-balance-and-stamina.md).

Deployment [run 36889089379](https://github.com/Orsnoire/FightSchool/actions/runs/36889089379)
(job `110459835438`) published this revision to the existing Worker and canonical
hostname at 16:04 UTC (10:04 Mountain). Its type check, all 74 tests, both builds,
R2 check, committed additive migrations through `0008_daily_combat_stamina.sql`,
and smoke checks on both hostnames passed. Immutable Worker version:
`eee2f302-3cb6-45b4-9a56-e5be828fdc40`.

Live acceptance [run 36889382720](https://github.com/Orsnoire/FightSchool/actions/runs/36889382720)
(job `110460830754`) tested that same revision against
`https://questacademy.bookwyrminteractive.studio` and passed both steps:

- Combat and economy: actual enemy defeat, Fireball MP spending, wrong answers,
  phase cycling, reconnect deadlines, duplicate/stale commands, persisted XP and
  stamina status, guilds, quests, shop, reward claims, solo-room ownership and history.
- Storage and classroom: R2 upload authorization/content/ranges, 30 participants,
  host refresh, concurrent room isolation, simultaneous answers, reconnect,
  exactly-once results and logout revocation. Answer acknowledgement latency was
  p50 855ms, p95 1613ms, maximum 1664ms in this single burst.

The release head also passed browser acceptance at 1366x768 and 390x844 (run
`36886749518`), including the target grid, potion controls, rich content and math
keyboard. This does not close the broader operational drills listed above.

The immediately preceding deployed Worker version is
`fadc38ed-c073-493a-9a3a-17b4643ccb09` from deployment run `36779575641`.
Keep this as the latest rollback checkpoint. A rollback preserves the additive
Neon schema, existing sessions, R2 and Durable Object bindings; it would restore
the old combat XP policy. Do not delete or reset student data.

## Independent avatar workshop

The review workshop uses **bookwyrm-animation-studio**, R2 **bookwyrm-workshop**,
binding **WORKSHOP_BUCKET**, and secret **WORKSHOP_UPLOAD_TOKEN**. It serves
https://bookwyrminteractive.studio/workshop/ and is independent of this application
Worker and deployment workflow. See [routing and temporary upload connection](../workshop-routing.md).

The October 5 static-avatar/wardrobe change adds migration `0009_starter_wardrobe.sql`.
Apply it through the normal additive migration gate before deploying the new Worker.
Existing students and equipped items are preserved; permanent starter ownership
is derived from the shared catalog without repeated item grants. A workshop upload
does not apply this migration. Do not mark this migration applied based only on
a local test or the earlier October 1 deployment record.


## Static avatars and starter wardrobe — 5 October 2026

The owner approved static workshop review 03 and authorized live release. PR #33
merged as `c056895bc7e54171fd4976c1820fac0489ba0feb`. All 81 local tests, type
checking, both builds, and the static workshop/creator/job-change browser checks
passed. The PR head CI run `37369592788` and Avatar Workshop Acceptance run
`37369592682` also passed. Combat UI Acceptance run `37369592777` was cancelled
before any job steps ran during the runner incident; it is not an application
test result.

Deployment run `37370440485` and the first attempt of `37371803971` were cancelled
before any job steps ran during the October 5 GitHub Actions runner incident.
The [queued-run snapshot](../releases/2026-10-05-static-avatar-deployment-queued.jpg)
is historical evidence of that delay, not the current release status.

After Actions recovered, [deployment run 37371803971, attempt 2](https://github.com/Orsnoire/FightSchool/actions/runs/37371803971/attempts/2)
successfully deployed `9431f7fa0a65fa4db75ca32e7083c2579e528407` at 00:31 UTC
October 6 (18:31 MDT October 5). The workflow passed type checking, all 81 tests,
the client/Worker build, R2 verification, additive migrations including
`0009_starter_wardrobe.sql`, publication and smoke checks on both hostnames.
Immutable Worker version: `381d9a52-e2d8-479b-9396-00d2668d9e8a`.
The previous deployed version, `eee2f302-3cb6-45b4-9a56-e5be828fdc40`, remains the
rollback checkpoint. Keep the additive database schema when rolling back.

The live saved-avatar API acceptance below passed on the canonical domain for
both bodies, all four base jobs and all 23 permanent starter items. Live combat
and classroom acceptance also passed in [run 36889382720, attempt 2](https://github.com/Orsnoire/FightSchool/actions/runs/36889382720/attempts/2),
job `112047036895`. This reran the established October 1 acceptance harness;
its two scripts and workflow are unchanged from the release revision, and it
tested the newly deployed canonical domain. Coverage includes combat resources,
reconnect/rewards, R2 behavior and 30-participant classroom concurrency.
The public login page also loaded in the browser; authenticated avatar UI
coverage remains the pre-release browser acceptance plus the live API checks.

The targeted live API check is now reproducible with:

```sh
STAGING_ORIGIN=https://questacademy.bookwyrminteractive.studio \
  node --import tsx tests/staging/static-avatar-acceptance.mjs
```

It explicitly creates two isolated student fixtures, checks both saved body
models, creation retries, palette persistence across jobs/relogin, permanent
starter ownership, all four base-job loadouts, same-job equipment retention,
armor exclusions, body immutability, ownership and origin checks. It signs out
its sessions afterward and does not touch real students. It is not run at app
startup and does not replace the live combat/classroom acceptance workflow.

## Host controls and student departure — 7 October 2026

The owner authorized publication, browser checks, merge and live deployment.
[PR #35](https://github.com/Orsnoire/FightSchool/pull/35) merged as
`1aa7ccb16130d5822010766c6c7b13316588b7cd`. The release consolidates host controls
and the current question around the join-code panel, restores joined-player
counts, places a bounded scrollable log beside the enemies, and adds confirmed,
acknowledged student departure to every combat context dialog.

All 92 automated tests, TypeScript and both production builds passed in
[CI run 37681311378](https://github.com/Orsnoire/FightSchool/actions/runs/37681311378).
[Combat UI Acceptance run 37681311265](https://github.com/Orsnoire/FightSchool/actions/runs/37681311265)
passed host and student browser checks at 1366×768 and 390×844; screenshot review
also passed. Both runs checked PR head `c360af693a7f66c67a90fe98ed50e323827554ce`.

[Deployment run 37681816536](https://github.com/Orsnoire/FightSchool/actions/runs/37681816536)
successfully deployed the merge revision at 20:26 UTC (14:26 MDT). The workflow
passed all 92 tests, type checking, both builds, image storage verification,
the additive migration gate and smoke checks on both hostnames. Immutable
Worker version: `4ba61e1d-374d-4224-a0d4-cda88a62e442`.
See the [successful deployment snapshot](../releases/2026-10-07-host-panel-deployed.jpg).

[Live Combat Staging Acceptance run 37682106085](https://github.com/Orsnoire/FightSchool/actions/runs/37682106085),
job `113000499181`, passed against
`https://questacademy.bookwyrminteractive.studio` at 20:29 UTC. Coverage includes
combat resources, reconnect deadlines, durable rewards, authorization, R2,
30 simultaneous participants/answers, room isolation and exactly-once results.
The new departure path is covered by the automated and browser suites above.
This release adds no schema migration or student-data reset. Hosts and students
should refresh existing browser tabs to load the updated client.

## Battlefield and participation — 7 October 2026

[PR #36](https://github.com/Orsnoire/FightSchool/pull/36) merged as
`5f16dc2a4661b917441d946d192ed9201351c339`. The release introduces the shared
grassland battlefield, saved player avatars, private student resources, minimal
waiting strip, host fullscreen and floating combat log, threat/damage leaders,
moderated removal/rejoining and proportionate completion rewards. See the
[approved behavior](../combat-facelift.md#october-7-battlefield-and-participation-approval).

Final PR head `d58bd4048ae5c24fcda65876c05874b64af2267d` passed all 99 tests,
TypeScript and production builds in
[CI run 37688923550](https://github.com/Orsnoire/FightSchool/actions/runs/37688923550).
[Combat UI Acceptance run 37688923553](https://github.com/Orsnoire/FightSchool/actions/runs/37688923553)
passed at 1366×768, 390×844 and 3840×2160, including formations from 1 to 30,
fullscreen, combat-log controls, removal and rejoin moderation. The reviewed
[host](../releases/2026-10-07-battlefield-host.png) and
[student waiting](../releases/2026-10-07-battlefield-student.png) previews come
from the passing browser fixture run `37688335333`; subsequent changes covered
ally-target cancellation and live acceptance timing without changing the layout.

The owner explicitly approved deployment and the fractional-XP migration on
October 7. [Deployment run 37694702056](https://github.com/Orsnoire/FightSchool/actions/runs/37694702056),
job `113043450125`, successfully published revision
`5fa124afa1621a49003250d83d6c2abf5e5abc5f` at 22:14 UTC (16:14 MDT).
All 99 tests, TypeScript, production builds, image storage verification, additive
migrations and both hostname smoke checks passed. Immutable Worker version:
`d0d8563e-43f2-44b7-9fb7-8b4822d45be6`.
See the [successful deployment](../releases/2026-10-07-battlefield-deployed.jpg).

Migration `0010_fractional_participation_xp.sql` was applied before publication.
It widens the existing base-XP audit field and award function input to retain
fractional completion XP; existing students and historical results are preserved.
The earlier [pending-dispatch snapshot](../releases/2026-10-07-battlefield-deployment-awaiting-approval.jpg)
is historical evidence of the approval pause, not the current deployment status.

[Live acceptance run 37694892042](https://github.com/Orsnoire/FightSchool/actions/runs/37694892042),
job `113044085188`, passed against the canonical domain at 22:16 UTC (16:16 MDT).
Both scripts passed: live combat/resources/reconnect/economy, R2 authorization and
ranges, 30-participant concurrency, room isolation, exactly-once results, and
logout revocation. The new live case also passed late entry at the next question,
host-approved rejoin after removal with preserved resources/activity, blocked
future requests, unchanged enemy scaling, and fractional host-ended completion
XP plus full earned activity XP. Test fixtures were archived by the harness.

Previous Worker `4ba61e1d-374d-4224-a0d4-cda88a62e442` from deployment
`37681816536` remains the rollback checkpoint. Keep the additive schema if a
Worker rollback is needed. Hosts and students should refresh existing browser
tabs to load the new client. Static avatar art remains intentional; animation rigs
are a separate, unfinished release.

## Classroom polish, First Aid and expanded gear — 7 October 2026

The owner authorized combined review, merge and deployment. PRs #37–42 were
merged in order into `main`, ending at `41a372c039d00421882e37044830abaa9218b427`.
The merge tree matches the reviewed PR #42 tree
`7fb86f6e2c0667a3eff764ae572629983dfbac15`. Each implementation PR passed CI
and Combat UI Acceptance. The final combined build passed all 118 tests,
TypeScript and client/Worker builds again in the deployment workflow.

[Deployment run 37717016937](https://github.com/Orsnoire/FightSchool/actions/runs/37717016937)
published immutable Worker `8776783b-ea00-4ffa-979c-e42415856d0a` and passed
smoke checks on both the workers.dev and canonical hostnames. Additive migration
`0011_equipment_arms.sql` ran before Worker activation, adding only a nullable
Arms column and preserving existing equipment, inventory and student progression.

This release includes free scaling Priest First Aid and solo-loadout guidance,
calculated ability values, informative loot choices, eight equipment slots,
complete Tier 0 starter entitlements, synchronized loadout displays, visible
class equipment permissions and explicit classification for new custom armor.
The existing October 7 session-code join/rejoin flow remains the group entry.

The focused `static-avatar-acceptance.mjs` check also passed against the canonical
domain using isolated male/female student fixtures. It checked all eight slots
across the four base-job defaults, all permanent starter IDs without duplication,
same-job gear retention, appearance persistence across relogin/job switches,
armor exclusions, owner/origin enforcement and unchanged progression. Sessions
were signed out afterward; real classroom students were not modified.

Previous immutable Worker `d0d8563e-43f2-44b7-9fb7-8b4822d45be6` from deployment
`37694702056` remains the rollback checkpoint. Retain the additive schema during
a Worker rollback. Hosts and students should refresh existing tabs for the new
client. Individual gear overlays, animation, per-job remembered loadouts and the
separate infrastructure recovery drills remain outside this release.

[Live acceptance run 37717180059](https://github.com/Orsnoire/FightSchool/actions/runs/37717180059),
job `113116240926`, passed against the canonical domain after deployment.
Both live combat/resources/reconnect/economy and storage/classroom-concurrency
scripts succeeded, including 30 participants, isolated rooms, exactly-once rewards,
late entry, moderated rejoin and fractional host-ended completion rewards.
This closes the combined release gate; infrastructure failure/rollback drills
remain a separate acceptance track.


<a id="gear-release-attempt--8-october-2026-blocked-before-migration"></a>

## Gear release attempt — 8 October 2026 (historical R2 failure)

**Historical attempt 1 only.** The successful retry and later deployment below
supersede this failure; it is not an active release or migration blocker.

The owner authorized deployment of the complete review stack. PRs #43–46 were
merged in order into `main`, ending at
`14a58f14cf29e8a0ed33e8aa601e2e680dd77efc`. Its tree
`47a5feea9194fc03b825edcd981c2f69c5a5070a` exactly matches reviewed PR #46.
This includes remembered job loadouts, Tier 1 gear/VIT/loot rules, gear comparisons
and both-body equipped static artwork. Previous head bonuses remain unchanged.

All implementation PR checks passed. Merged-main
[CI run 37773184867](https://github.com/Orsnoire/FightSchool/actions/runs/37773184867)
passed type checking, all 133 tests and both production builds.
[Deployment run 37773374205, attempt 1](https://github.com/Orsnoire/FightSchool/actions/runs/37773374205/attempts/1),
job `113298147189`, also passed those checks, then failed at **Ensure image storage
bucket** at 11:58 UTC (05:58 MDT). Cloudflare returned HTTP 403:
“Please enable R2 through the Cloudflare Dashboard.”

No database migration, secret preparation, Worker deployment or smoke check ran
in attempt 1. At that checkpoint, migrations 0012 (remembered loadouts/revision)
and 0013 (spell-book constraint) were pending, and the live Worker was still
`8776783b-ea00-4ffa-979c-e42415856d0a` from deployment `37717016937`, runtime
`41a372c039d00421882e37044830abaa9218b427`. These statements describe the failed
attempt, not the current release.

## Gear release recovered and verified — 8 October 2026

### Deployment timeline

All times below are UTC on October 8. Each successful deployment passed R2,
the additive migration gate, Worker publication and both the workers.dev and
canonical-hostname smoke checks. The configured environment is named
`cloudflare-staging`, but the published Worker also serves
`https://questacademy.bookwyrminteractive.studio`.

| Deployment evidence | Checked-out runtime commit | Worker version / publication | Scope |
| --- | --- | --- | --- |
| [37773374205, attempt 2](https://github.com/Orsnoire/FightSchool/actions/runs/37773374205/attempts/2), [job 113307281605](https://github.com/Orsnoire/FightSchool/actions/runs/37773374205/job/113307281605) | `14a58f14cf29e8a0ed33e8aa601e2e680dd77efc` | `73332986-23d4-4393-b22e-c96161f8ff4f`, 12:21:36 | First verified successful gear-stack deployment: PRs #43–46 |
| [37801260340](https://github.com/Orsnoire/FightSchool/actions/runs/37801260340), [job 113393829996](https://github.com/Orsnoire/FightSchool/actions/runs/37801260340/job/113393829996) | `e3e1737a371e1d5d26d65b77e46f7f48684200f3` | `974a808d-07e5-48a7-aba3-2cf3dd4842b0`, 15:32:12 | Gear stack plus guild quests/progression/tier authoring, PR #47 |
| [37814586746](https://github.com/Orsnoire/FightSchool/actions/runs/37814586746), [job 113439828394](https://github.com/Orsnoire/FightSchool/actions/runs/37814586746/job/113439828394) | `764cd2fe2d544733c8e10fdace84084cbbfe94aa` | `926af6a1-eb8b-4fd0-8c3b-9941ece77aad`, 17:12:46 | Verified 17:12 checkpoint, additionally including explicit host-session controls, PR #49; superseded by PR #52 below |

The 12:21 retry passed all 133 tests and both builds. The 17:12 deployment passed
type checking, all 142 tests and both builds; R2 reported ready at 17:12:24,
migrations succeeded at 17:12:25, and the two smoke checks passed at 17:12:50–51.
The logs establish that the R2 gate succeeded; they do not identify the specific
account or token change that resolved the earlier 403.

### Migration verification record

The deployed [package script](https://github.com/Orsnoire/FightSchool/blob/764cd2fe2d544733c8e10fdace84084cbbfe94aa/package.json)
runs `drizzle-kit migrate --config drizzle.cloudflare.config.ts`.
That [configuration](https://github.com/Orsnoire/FightSchool/blob/764cd2fe2d544733c8e10fdace84084cbbfe94aa/drizzle.cloudflare.config.ts)
uses `migrations/cloudflare` and the deployment environment's `DATABASE_URL`.
Each successful job logs `migrations applied successfully!` before publishing
the Worker with the same environment's database connection.

| Migration | Intended schema change | Verified release evidence |
| --- | --- | --- |
| `0012_remembered_job_loadouts.sql` | Adds `students.job_loadouts` and `students.loadout_revision` with defaults | Present in the [gear release journal](https://github.com/Orsnoire/FightSchool/blob/14a58f14cf29e8a0ed33e8aa601e2e680dd77efc/migrations/cloudflare/meta/_journal.json); migration gate succeeded by 12:21:16 in attempt 2 of `37773374205` |
| `0013_spellbook_offhand.sql` | Extends `equipment_items_offhand_type_check` to allow `spellbook` | Same gear journal and successful 12:21:16 migration gate; no longer blocked on R2 |
| `0014_guild_quests.sql` | Adds guild quest/progression, encounter context, tier and reward-ledger support | Present in the [PR #47 release journal](https://github.com/Orsnoire/FightSchool/blob/e3e1737a371e1d5d26d65b77e46f7f48684200f3/migrations/cloudflare/meta/_journal.json); migration gate succeeded by 15:31:50 in `37801260340` |

The [17:12 deployed journal](https://github.com/Orsnoire/FightSchool/blob/764cd2fe2d544733c8e10fdace84084cbbfe94aa/migrations/cloudflare/meta/_journal.json)
contains all three, and that migration gate succeeded again at 17:12:25.
Release status is therefore **migration-gate verified through 0014**, including
0012/0013, rather than blocked or awaiting a rerun. This conclusion follows from
the successful migrator and checked-out journals. The logs do not enumerate
individual applied/skipped migrations, database ledger rows, hashes or live
column/constraint definitions. They establish a successful gate by these times,
not the exact first execution time of each SQL file or an independent schema
audit. No direct database inspection or mutation was performed for this
documentation reconciliation; no migration SQL or journal entries were changed.

### Canonical live acceptance

[Live acceptance run 37816148964, attempt 2](https://github.com/Orsnoire/FightSchool/actions/runs/37816148964/attempts/2),
[job 113446372770](https://github.com/Orsnoire/FightSchool/actions/runs/37816148964/job/113446372770),
passed both scripts against `https://questacademy.bookwyrminteractive.studio`
at 17:26–17:28. It checked out fixture commit
`971d93a24b2e676569391ce0e7d389fd66e1f70c` from
[PR #50](https://github.com/Orsnoire/FightSchool/pull/50), correcting the level-1
Tier 1 equipment assumption and separating personal quest gold from combat gold.

- Live combat, damage/resources, reconnect, stale/retried commands, durable XP,
  guilds, quests, shop, reward claims, solo hosting, history and owner isolation.
- R2 upload/readback, authorization, cache/type handling, byte ranges and metadata.
- Thirty-player attendance, simultaneous answers, room isolation, reconnect and
  exactly-once result persistence; answer acknowledgements p50 1,003ms,
  p95 1,904ms, max 2,008ms for this single burst.
- Hosted-session discovery, explicit end, concurrent launch and stale-end
  isolation; late entry, moderated rejoin, blocked requests, fractional
  host-ended rewards and open-socket logout revocation.

PR #50 merged as `b601d8faddfb6f0e97ec3dfa85c9a0567a14f63f` at 17:29:24.
The [comparison with the deployed commit](https://github.com/Orsnoire/FightSchool/compare/764cd2fe2d544733c8e10fdace84084cbbfe94aa...b601d8faddfb6f0e97ec3dfa85c9a0567a14f63f)
changes only the two acceptance scripts. Its fixture SHA is not a new deployed
runtime; no application redeployment was needed to obtain the passing result.

This closes the recorded R2/deployment/live-acceptance blocker for the gear stack.
It does not establish exhaustive manual equipment/visual acceptance, an approved
animation rig, near-profile coverage, completed classroom balance tuning or full
Phase 7 infrastructure recovery/rollback signoff. Team race and party-scaled
swarm counts remain future work. This reconciliation changes documentation only
and neither dispatches nor reruns deployment, migration or live acceptance jobs.


## Enemy AI, recovery and waves release — 8 October 2026

PR #52 merged as `e1581948f6623d86af859452bf083ca0f35db681` at 21:01 UTC,
including individual enemies/waves, goblin targeting, the seven-species authoring
catalog, configurable AI and answer-based status recovery. No schema migration
was added by this release. It includes the preceding equipment, guild-quest and
explicit host-session releases.

- [CI 37843818974](https://github.com/Orsnoire/FightSchool/actions/runs/37843818974)
  passed on this exact revision.
- [Deployment 37844054859](https://github.com/Orsnoire/FightSchool/actions/runs/37844054859)
  passed on this revision after the R2/migration gates and published immutable
  Worker `2180375a-c947-470d-a3ea-e199c9ff25f3` at 21:04:51 UTC
  ([job 113540375470](https://github.com/Orsnoire/FightSchool/actions/runs/37844054859/job/113540375470)).
- [Canonical live acceptance 37844271331](https://github.com/Orsnoire/FightSchool/actions/runs/37844271331)
  passed on the same revision against the canonical classroom domain, covering
  functional combat/economy, R2, 30 participants, refresh, isolated rooms,
  late entry/moderation, revocation and idempotent rewards.
- The 30-answer burst recorded p50 1,657ms, p95 3,070ms, maximum 3,220ms.
  The maximum gate remains 15 seconds; this is one burst and not a fully seeded
  guild/history workload or a sustained performance guarantee.
- [PR browser acceptance 37841834095](https://github.com/Orsnoire/FightSchool/actions/runs/37841834095)
  passed on the review head; [enemy verification](../combat/enemy-ai-verification.md)
  records its scope and inspected screenshots.

This was the verified runtime at the October 9 review baseline, superseded by
the C01 release below. The release does
not implement team race, party-scaled enemy counts, AA purchases or animated
avatars. Existing operational drills above and classroom balance observation
remain open. October 9 documentation changes require no runtime redeployment.

## October 9 cleanup handoff

[Current status](../CURRENT_STATUS.md), the [cleanup plan](../CLEANUP_PLAN.md),
[expansion backlog](../EXPANSION_PLAN.md) and [engineering review](../reviews/2026-10-09-code-review.md)
now govern work tracking. Documentation preparation and the Phase 1 resume
safeguard are complete. C01 subsequently closed the reproduced built-in loot and
leaderboard defects; its release evidence follows. C02 is next and not started.
Schema generation drift remains C03 work.

Preserve current live students and records. Old Worker IDs above are historical
checkpoints, not a claim that September builds are safe against today's room
state and schema. C12 must identify and rehearse a currently compatible immutable
rollback version; changing Worker code does not undo Neon, R2 or room data.


## C01 correctness release — 9 October 2026

**COMPLETE — merged, deployed and accepted.** [PR #53](https://github.com/Orsnoire/FightSchool/pull/53)
merged at 16:04:13 UTC as `8bf9df71629c9ba8933b63a24ca5f35da655e3cc`.
This release fixes F01 built-in/custom loot claim validation, F02 leaderboard
metric URLs and visible retryable errors, and F03 weighted accuracy. Ownership,
earned-loot checks, atomic rewards, guild visibility and approved gameplay remain
unchanged. C01 adds no migration and performs no player-data reset.

| Evidence | Verified result |
| --- | --- |
| [Main CI 37956409540](https://github.com/Orsnoire/FightSchool/actions/runs/37956409540) | Passed on exact merged runtime `8bf9df7` |
| [Deployment 37956580253](https://github.com/Orsnoire/FightSchool/actions/runs/37956580253), [job 113908508849](https://github.com/Orsnoire/FightSchool/actions/runs/37956580253/job/113908508849) | Passed on `8bf9df7`: type check, 208 tests, production build, R2, migration gate, Worker publication and both hostname smoke checks |
| Immutable Worker | `68cf4f65-c163-4018-ad6f-a718489dbb46`, published 16:07:27 UTC (10:07:27 MDT) |
| Migration evidence | Existing additive migrator succeeded at 16:07:09 UTC with the unchanged journal through `0014`; no new SQL files. This is migrator-gate evidence, not an independent live-schema audit |
| Smoke checks | workers.dev and canonical-domain checks passed at 16:07:35–36 UTC |
| [Canonical live acceptance 37956888302](https://github.com/Orsnoire/FightSchool/actions/runs/37956888302), [job 113909563121](https://github.com/Orsnoire/FightSchool/actions/runs/37956888302/job/113909563121) | Passed on `8bf9df7`, 16:08–16:11 UTC; both scripts targeted `https://questacademy.bookwyrminteractive.studio` |
| [PR CI 37951053838](https://github.com/Orsnoire/FightSchool/actions/runs/37951053838) and [browser acceptance 37951054128](https://github.com/Orsnoire/FightSchool/actions/runs/37951054128) | Passed on reviewed head `b952894a1fd9e584f41018038765434d49981a41`; merged tree matches this head |

Live acceptance covered combat/damage/resources, enemy AI, reconnect deadlines,
stale/retried commands, durable XP, guilds, quests, shop, reward claims, solo
hosting, history and owner isolation. Operational checks passed R2 upload and
readback, authorization, ranges/metadata, 30 participants, refresh, concurrent
room isolation, exactly-once results, host discovery/end/launch, late entry,
moderation, fractional host-end rewards and open-socket logout revocation.

The 30-answer burst recorded **p50 2,065 ms, p95 3,976 ms, maximum 4,177 ms**,
within the existing 15-second maximum gate. This single run does not establish a
performance trend, meet the proposed under-one-second cleanup p95 target, or
replace repeated seeded 30/60-player measurements. Those remain C05–C08/C12 work.
F01–F03's specific built-in loot, unequal-fight accuracy and error UI fixtures
are covered by disposable boundary regressions in the 208-test suite; the
standard live harness does not individually reproduce all those new cases.

**October 8 queue reconciliation:** all merged PRs #37–50 and #52 were verified
as ancestors of `e1581948f6623d86af859452bf083ca0f35db681`, which already passed
October 8 deployment `37844054859` and live acceptance `37844271331`. Before
merging C01, later main changes were documentation-only and #53 was the only
open PR. No separate older runtime change was waiting to deploy. This release
includes equipment, guild quests/progression, host controls, waves/goblin swarms
and enemy AI. Team race, party-scaled counts, AA purchases and full animated
avatars remain future work, not a release backlog.

Previous Worker `2180375a-c947-470d-a3ea-e199c9ff25f3` remains historical evidence;
no rollback rehearsal was performed. C12's infrastructure drills, fixture
isolation/retention and full operational signoff remain open. Current live data
must be preserved. The [active-work checkpoint](../ACTIVE_WORK.md) records C01
complete and C02 unstarted; documentation-only handoff commits require no redeploy.

[Deployment success screenshot](../releases/2026-10-09-c01-deployed.jpg).

## C02 dependency release — 12 October 2026

C02 is complete with scoped advisory deferrals: [PR #56](https://github.com/Orsnoire/FightSchool/pull/56)
merged at `a0983ffcff3775404fdfd70c4299e7731108696c`. Deployed checkout `5d89fb0bc4d160754ceb9645019f465809742ef2`
adds only the interruption checkpoint to that merge. Worker `81387a2a-9084-410f-b773-3726713f8544` was
published October 12 at 15:32:49 UTC. No gameplay, migration history or schema changed.

| Evidence | Result |
| --- | --- |
| [PR CI 38265412023](https://github.com/Orsnoire/FightSchool/actions/runs/38265412023) | Passed at `5bb7949` |
| [Chromebook/phone acceptance 38265412210](https://github.com/Orsnoire/FightSchool/actions/runs/38265412210) | Passed at `5bb7949`, including MathLive keyboard |
| [Deployment 38270833735](https://github.com/Orsnoire/FightSchool/actions/runs/38270833735) | Passed at `5d89fb0`; 211 tests, typecheck, builds, R2, migration gate and both hostname smoke checks |
| [Canonical live acceptance 38271115093](https://github.com/Orsnoire/FightSchool/actions/runs/38271115093) | Passed at `5d89fb0` against https://questacademy.bookwyrminteractive.studio |

The migration command completed using the upgraded Drizzle Kit and existing
journal through `0014`; C02 adds no DDL. This is migrator evidence, not a direct
production catalog/ledger audit. C03 still owns generation metadata reconciliation.
Local tests apply all 15 migrations in disposable PGlite and check preserved student data.

[Dependency triage](../reviews/2026-10-12-dependency-triage.md) records versions
and exposure: 32 audit entries reduced to 12 (5 high, 7 moderate). Remaining
Tailwind build and Drizzle Kit loader findings are explicitly deferred; production-only
audit still lists 7 Tailwind peer-chain entries. Do not call the audit clean.
No forced downgrade, cross-major override or Tailwind framework migration was applied.

C03 is next and NOT STARTED. Register one branch/draft PR before implementation.
C12 rollback/isolation/retention drills remain open; passing this release does not
complete those broader operational gates. Subsequent documentation-only handoff
commits do not require another application deployment.

The October 12 30-answer burst measured p50 1,659 ms, p95 3,217 ms and maximum
3,367 ms (existing 15-second maximum gate). A single burst is not a performance
trend or evidence that C05/C06 targets have been met. Live checks also passed
R2 integrity/ranges, room isolation, reconnect, exactly-once results, host session
controls, moderated late entry, fractional rewards and logout socket revocation.


## HP preview release — 12 October 2026

**COMPLETE — reviewed, merged, deployed and accepted.** PR #59 merged as
`02392ef1c6fb6978a6602e470a336290a6886193`. The owner then explicitly authorized
deployment. Checkout `274dbfe1d29dcb8897b675e85a3edb0343866f0c` adds the review/merge
checkpoint and includes C03 / PR #58. Immutable Worker
`50f91c4d-1cdb-4b04-bf69-8f3c715eff82` was published at 16:13:11 UTC.

Waiting rooms now show enemy HP calculated by the real Start Fight scaler for
the joined roster. Joins, leaves and reconnects refresh the estimate; empty rooms
show Waiting for players. Starting an unchanged roster uses the previewed HP.
The preview is read-only and preserves combat balance and authored quantities.
See the [HP preview specification](../combat/hp-preview.md).

| Evidence | Result |
| --- | --- |
| [Deployment 38275647965](https://github.com/Orsnoire/FightSchool/actions/runs/38275647965), [job 114900336120](https://github.com/Orsnoire/FightSchool/actions/runs/38275647965/job/114900336120) | Passed on `274dbfe`: typecheck, all 218 tests, client/Worker builds, R2, migration gate, Worker publication and both hostname smoke checks |
| [Canonical live acceptance 38275889570](https://github.com/Orsnoire/FightSchool/actions/runs/38275889570), [job 114901147536](https://github.com/Orsnoire/FightSchool/actions/runs/38275889570/job/114901147536) | Passed on the same revision against `https://questacademy.bookwyrminteractive.studio`, 16:13–16:15 UTC |
| [PR CI 38274186846](https://github.com/Orsnoire/FightSchool/actions/runs/38274186846) / [browser acceptance 38274186815](https://github.com/Orsnoire/FightSchool/actions/runs/38274186815) | Passed on reviewed head `13713d5`; the combined C03/preview tree passed all 218 tests and both builds |
| Database evidence | Existing migrator succeeded at 16:12:52 UTC with the unchanged journal through `0014`. C03 repaired declarations/snapshot metadata; neither C03 nor HP preview adds SQL migrations |

Live checks passed combat/resources, reconnect, stale/retried commands, durable
XP, guilds, quests, shop, reward claims, solo hosting, history, owner isolation,
R2 integrity/ranges, 30 participants, simultaneous answers, room isolation,
exactly-once results, host controls, late entry/moderation, fractional host-end
rewards and logout socket revocation. The 30-answer burst recorded p50 **905 ms**,
p95 **1,809 ms**, maximum **1,909 ms** within the existing 15-second maximum gate.
This is one burst, not a sustained or fully seeded performance benchmark.

The four HP-specific boundary tests cover preview/start equality, roster changes,
restored snapshots, non-mutation and visible/accessible labels. The standard live
harness complements those tests; it does not reproduce every HP-specific case.
No current classroom data was reset. Previous Worker
`81387a2a-9084-410f-b773-3726713f8544` remains the preceding release checkpoint;
no rollback rehearsal was performed. C12 infrastructure drills remain open.
Hosts and students should refresh existing tabs for the new client. C04 remains
unstarted, and documentation-only release records require no redeployment.

## C04 contracts and diagnostics — 12 October 2026

Owner authorized merge and live deployment. PR #60 merged as
`097081c11692c3526714d34628a29b0b0f28815c`; its reviewed head `84ce8e8` passed
224 tests, typecheck/builds, CI 38283049347 and browser 38283049357.

The first deployment, 38284111710 (Worker
`ad902178-71c9-443c-a1d3-d987beb416b6`), passed both hostname smoke checks but
canonical acceptance 38284362252 failed host-session creation with 503.
The new request-ID wrapper attempted to mutate immutable Durable Object
subresponse headers. PR #62 published the exact failing regression at `13b8bcc`,
then copied ordinary HTTP responses before decorating headers while preserving
WebSocket upgrade identity. Follow-up head `5fdfe6c` passed all 224 tests,
typecheck/builds, CI 38284897429 and browser 38284897183 before merge.

The corrected runtime is merge `a2f13673de9bccbf044ef27f67a96fa4adf2431a`.
[Deployment 38285264787](https://github.com/Orsnoire/FightSchool/actions/runs/38285264787)
passed all 224 tests, typecheck, client/Worker builds, R2, the existing migration
gate and both hostname smoke checks. Immutable Worker
`94a6a8f1-462d-4b1c-98c1-365de92066f1` was published at 17:37:35 UTC.
Merged-main CI 38285235793 also passed. C04 introduces no SQL migration and
preserves current live data; the migration runner succeeded but individual
production ledger rows were not independently queried.

[Canonical live acceptance 38285499681](https://github.com/Orsnoire/FightSchool/actions/runs/38285499681)
passed on the same checkout. Combat/economy, R2, 30 participants, reconnects,
room isolation, host controls, moderation, revocation and exactly-once rewards
all passed. The answer burst measured p50 809 ms, p95 1,513 ms, max 1,562 ms;
a single burst is not a performance trend. C04 is complete, merged, deployed
and accepted. C05 is next and not started.


Shared contract ownership, body limits, public projections, diagnostic privacy
and intended CI checks are documented in [contracts and diagnostics](contracts-and-diagnostics.md).
Main branch protection enforcement remains off. C05 owns cost comparisons;
this release does not claim a performance improvement. PR #61 is separate and
is not deployed in this runtime.


## Swarm, gear baseline and host controls — 12 October 2026

Owner authorized review, merge and deployment. [PR #61](https://github.com/Orsnoire/FightSchool/pull/61)
merged as `cda5fd42eea16690d60a81181474ba5fb4e28f5c`. Reviewed head `a9cd95f` incorporates
current main `87d45a5`, including the C04 refactor, released PR #62 forwarding fix
and release records; no blocking review findings remained.

The release adds optional swarm batches at 8/12/16 players, roster-based count/HP
preview with counts locked at Start Fight, previous-tier reference gear, teacher
Next wave and individual enemy elimination ×. See the [current specification](../combat/swarm-scaling.md).

| Evidence | Result |
| --- | --- |
| [Review CI 38295996875](https://github.com/Orsnoire/FightSchool/actions/runs/38295996875) | Passed all 238 tests, typecheck and both production builds on the integrated revision |
| [Browser acceptance 38295996779](https://github.com/Orsnoire/FightSchool/actions/runs/38295996779) | Passed Chromebook, phone and large-screen flows, including confirmation and keyboard controls |
| [Merged-main CI 38296325836](https://github.com/Orsnoire/FightSchool/actions/runs/38296325836) | Passed on exact merged revision `cda5fd4` |
| [Deployment 38296345335](https://github.com/Orsnoire/FightSchool/actions/runs/38296345335), [job 114968246331](https://github.com/Orsnoire/FightSchool/actions/runs/38296345335/job/114968246331) | Passed 238 tests, typecheck, builds, R2, existing migration gate and both hostname smoke checks |
| [Canonical live acceptance 38296638292](https://github.com/Orsnoire/FightSchool/actions/runs/38296638292) | Passed against the canonical domain on `cda5fd4`; combat/economy, R2, concurrency, reconnects, moderation, revocation and exactly-once rewards |

Immutable Worker `26fa9a9e-5bb8-4ca7-a624-474421c1b20a` was published at 19:16:34 UTC.
The existing migration runner succeeded at 19:16:18 UTC with the unchanged journal
through `0014`; PR #61 adds no SQL migration or live-data reset. Individual production
ledger rows were not independently queried. The local typecheck and 17 focused
integration tests also passed.

Boundary tests cover swarm counts/caps, preview/start equality, previous-tier gear,
editor persistence, host ownership/revocation, stale commands, retries and exactly-once
results. Standard live acceptance complements these checks; it does not reproduce
every feature-specific fixture on the live service. Classroom balance observation
and C12 operational drills remain open. Hosts/students should refresh existing tabs.
C05 remains next and unstarted. Documentation-only release records do not require redeployment.

Canonical acceptance ran at 19:17–19:19 UTC. The 30-answer burst recorded p50
858 ms, p95 1,714 ms and maximum 1,815 ms within the existing 15-second maximum
gate; this single burst is not a sustained performance benchmark. The release
is complete, merged, deployed and accepted. Prior Worker
`94a6a8f1-462d-4b1c-98c1-365de92066f1` remains the preceding release checkpoint;
no rollback rehearsal was performed.

## C06 data-cost release — October 17, 2026

The owner instructed "Merge and deploy" after reviewing the implementation. PR #69
merged with an expected-head check at `470dd724a621b235624da4730255240580911fd3`;
the merged tree exactly matches reviewed head `24b0116e4f7b671dae6c8cb4816cc6f72610034c`.

| Evidence | Result |
| --- | --- |
| [Review CI 39074557950](https://github.com/Orsnoire/FightSchool/actions/runs/39074557950) | 275 tests, TypeScript and client/Worker builds pass |
| [Chromium 39074557979, attempt 2](https://github.com/Orsnoire/FightSchool/actions/runs/39074557979/attempts/2) | Complete suite passed with unchanged code after an intermittent phone comparison Escape timeout in attempt 1 |
| [Deployment 39075244755](https://github.com/Orsnoire/FightSchool/actions/runs/39075244755) | Passed on `470dd724`: tests/builds, R2, additive migrations and both hostnames |
| [Canonical live acceptance 39075452591](https://github.com/Orsnoire/FightSchool/actions/runs/39075452591) | Passed on `470dd724`: combat/economy, guild quests/shop/history, isolation, R2, 30-player concurrency/reconnect/completion, moderation and revocation |

Immutable Worker `0de082fd-746e-48bb-bf4a-e33a8827ba68` was published at 22:31:11 UTC.
The migration runner through 0017 succeeded at 22:30:55 UTC. No student records,
evidence or progression were reset; SQL reward functions were unchanged. The runner's
success is the release evidence; individual production ledger/catalog rows were not
independently queried. The standard acceptance suite creates its own test accounts,
content and rooms; operational test fights are archived, while broader fixture cleanup
and environment isolation remain C12 work. Existing classroom records are not reset.

Live acceptance completed at 22:34:02 UTC. Its single 30-answer burst recorded p50
708 ms, p95 1,312 ms and maximum 1,362 ms, within the existing 15-second maximum gate.
This is not a sustained benchmark or a controlled before/after latency comparison.
Production plans, lock-contention/recovery drills and rollback rehearsal remain open.
The additive indexes can remain during a compatible code rollback; no reverse data
migration is needed. No rollback was performed. Documentation-only release commits
are not a new deployed runtime. C07 remains next and unstarted.

## C07 initial-loading release — October 17, 2026

The owner instructed "Merge and deploy" after implementation review. [PR #70](https://github.com/Orsnoire/FightSchool/pull/70)
merged with an expected-head check at `8f280b7b75479aa05bfb7dfd069f37e3f5d72334`;
its tree exactly matches reviewed head `7ded5765776fbcd5ea7b261cce3f16e3f8401a76`.
C07 defers routes and MathLive, retains accessible loading/error/text fallback,
introduces owner-only SQL fight summaries and limits periodic dashboard work to
foreground live-session status. Full academic authoring, permissions, progression
and atomic rewards are preserved.

| Evidence | Result |
| --- | --- |
| [Final review CI 39078713939](https://github.com/Orsnoire/FightSchool/actions/runs/39078713939) | 277 tests, TypeScript and client/Worker builds pass on `7ded576` |
| [Chromium 39078713913](https://github.com/Orsnoire/FightSchool/actions/runs/39078713913) | Existing combat UI and production initial-loading suites pass on `7ded576` |
| [Deployment 39080264978](https://github.com/Orsnoire/FightSchool/actions/runs/39080264978) | Passed on `8f280b7`: tests/builds, R2, existing migration gate and both hostname smoke checks |
| [Canonical live acceptance 39080459577](https://github.com/Orsnoire/FightSchool/actions/runs/39080459577) | Passed on `8f280b7` against the canonical domain: combat/economy, guild quests/shop/history, isolation, R2, 30-player concurrency/reconnect/completion, moderation and revocation |

Immutable Worker `e2f6dc5a-4157-47f4-bba6-080214499dce` was published at 23:47:43 UTC.
The existing additive migration gate succeeded at 23:47:29 UTC; C07 adds no
migration and changes no schema or reward procedure. No classroom records,
progression, evidence, equipment or rewards were reset. Production ledger/catalog
rows were not independently queried. The acceptance suite uses its own test
accounts/content/rooms and archives operational test fights; broader fixture
cleanup and environment isolation remain C12 work.

Live acceptance completed at 23:51:29 UTC. One 30-answer burst recorded p50
759 ms, p95 1,363 ms and maximum 1,415 ms, within the existing 15-second maximum
gate. This is functional acceptance, not a repeated load benchmark or a controlled
before/after latency comparison. [C07 measurements](../reviews/2026-10-17-c07-initial-loading.md)
record an 80.11% login gzip JS reduction and reduced SQL/HTTP transfers with
explicit fixture limits. C12 recovery/rollback drills remain open; no rollback
was performed. Prior Worker `0de082fd-746e-48bb-bf4a-e33a8827ba68` is historical
evidence, not a rehearsed rollback target. Documentation-only release commits do
not change this runtime. **C07 is complete; C08 is next and unstarted.**

### C11 authoring and lobby release — October 18, 2026 UTC

Owner-authorized [PR #74](https://github.com/Orsnoire/FightSchool/pull/74) merged as `a580b30b6e9826fbaaca9f3e2cfc914a94e4c7ad`, identical to reviewed tree `bb9a1f04ae80fc662abcab16ad301b97187d9248`. All 300 tests, TypeScript, client/Worker builds and four Chromium jobs pass on final reviewed head `34c3dd4`. Authoring/lobby extraction preserves draft state, permissions, serialized loadout saves and recovery; a pinned-baseline loot re-add defect is fixed. No SQL, migration or saved-room change.

[Deployment 39161062489](https://github.com/Orsnoire/FightSchool/actions/runs/39161062489) passed all gates and both hostname smoke checks. Worker `86111493-688d-41c2-9462-b050044b3d10` was published at 19:59:21 UTC. [Canonical acceptance 39161276964](https://github.com/Orsnoire/FightSchool/actions/runs/39161276964) passed teacher/student combat, guilds/quests/shop/history, durable rewards, owner isolation, R2, 30-player answers/reconnect/completion, concurrent rooms, moderation and revocation on the same runtime.

One 30-answer burst measured p50 654 ms, p95 1260 ms, maximum 1310 ms; this is functional acceptance, not a repeated performance benchmark. Existing student records were not reset. The standard suite uses acceptance fixtures; complete fixture isolation/cleanup, provider interruption/eviction/rollback drills, physical-device measurements and monitoring remain C12 work. No rollback was performed. Prior accepted Worker `d925c8ca-ff82-48bc-9843-36a49b2582d6` is historical evidence, not a newly rehearsed rollback target. Later documentation-only commits do not change the deployed runtime.

[Detailed report](../reviews/2026-10-18-c11-authoring-lobby.md); [Live acceptance record](https://github.com/Orsnoire/FightSchool/actions/runs/39161276964). C12 / Phase 6 release review is next and unstarted.
