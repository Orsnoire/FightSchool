# Worker migration and combat recovery

This replaces the incomplete Phase 4 slice described in `phase-4-live-combat.md`. The implementation follows `../Migration_Plan`, `../Source_of_Truth.md`, and the current **Combat Flow Refactor**, **Quest Academy Expanded Class List**, and **Core Guild Design** documents.

**Current verified release, 8 October 2026:** equipment PRs #43–46, guild quests
(#47) and explicit host-session controls (#49) are deployed at runtime commit
`764cd2fe2d544733c8e10fdace84084cbbfe94aa`, Worker version
`926af6a1-eb8b-4fd0-8c3b-9941ece77aad`. Deployment `37814586746` and subsequent
canonical live acceptance `37816148964` (attempt 2, corrected PR #50 fixtures)
passed. The original R2 403 is historical; it was overcome in attempt 2 of the
earlier gear deployment. See the [October 8 evidence and migration record](#gear-release-recovered-and-verified--8-october-2026).
Full Phase 7 operational signoff remains open.

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

The current pre-refactor rollback Worker version is `20382b06-88e9-42a3-805d-bc7ca476e602`, from successful deployment run `36749441658` on 30 September 2026. It includes the rich-content preview fix merged in PR #17 (`b10488316d9f008139c000e3d4e51383548a07e8`). The added database tables and columns can remain during rollback; do not remove them or replace the Durable Object namespace. Keep the canonical domain, Worker identity, session secrets and Neon database unchanged.

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
| [37814586746](https://github.com/Orsnoire/FightSchool/actions/runs/37814586746), [job 113439828394](https://github.com/Orsnoire/FightSchool/actions/runs/37814586746/job/113439828394) | `764cd2fe2d544733c8e10fdace84084cbbfe94aa` | `926af6a1-eb8b-4fd0-8c3b-9941ece77aad`, 17:12:46 | Latest verified deployment, additionally including explicit host-session controls, PR #49 |

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
