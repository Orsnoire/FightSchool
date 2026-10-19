# C12 rehearsal isolation audit

Scope: PR #75 at `bac84636cdc55000e8ab0e9c96628f955b870608`, current main
`7cd6fab97c5306514a04d6e591ba3d5495dd0d8e`, and the separate safety follow-up
[PR #76](https://github.com/Orsnoire/FightSchool/pull/76), targeting
`cleanup/c12-release-review`. No application runtime, database schema or gameplay
changes. PR #75 remains draft/unmerged/undeployed; C11 remains the recorded live
runtime. No provider inventory, deployment, live acceptance, disruption or cleanup
command was run for this audit.

## Findings and bounded fixes

| Path | Evidence at the audited C12 head | Follow-up |
| --- | --- | --- |
| Database URL overrides (high) | `validateIsolation` checked `new URL(url).hostname`. The installed `@neondatabase/serverless` Client actually selects `ep-live.neon.tech` for a synthetic `postgres://example:unused@ep-rehearsal.neon.tech/test?host=ep-live.neon.tech`. The old validator accepted it. Driver construction was local, without connecting. | Reject connection options outside a narrow TLS allowlist, including decoded query keys, duplicates and routing options. Regression tests include the actual driver's host selection. |
| Production hostname formatting (high) | With the isolated URL and target both using a production hostname, supplying that same production hostname with a trailing dot, port suffix or surrounding whitespace defeated the comparison. Existing pooled/non-pooled checks already worked for correctly formatted inputs. | Normalize DNS case/root dots and pooled aliases; reject malformed bare-host input. These checks still depend on an accurate, complete production inventory. |
| Isolated acceptance origins (high, conditional on matching live release identity) | The exact-string live blacklist accepted both classroom origins with trailing DNS dots as isolated. An arbitrary HTTPS domain was also accepted. The independent SHA/version health guard remains an additional barrier; this was not proof of writes to current C11. | Share a strict UUID-derived workers.dev origin guard between acceptance and target validation; reject other domains, extra subdomains and ports. |
| Base config inheritance (latent high-impact path) | Current checked-in DO bindings are local and current routes/R2 are correctly replaced. However, the spread of `base` preserves a future `script_name`/`environment`, DO transfer, `env` route override, singular `route`, service, Hyperdrive or secret-store binding. Synthetic committed configs reproduced acceptance of all nine cases. | Construct an explicit config and fail closed on unreviewed top-level fields or changes to DO/export/secret/R2 declarations. Preserve the required static-asset behavior and local CombatSession SQLite declaration. This is preventive coverage, not a claim that current config already referenced a production DO namespace. |
| Cleanup account mismatch (medium) | The account came only from process environment, while inventory kept its account in a separate human record. A 404 for the rehearsal Worker name in the wrong account could satisfy the stopped-Worker prerequisite. | Require `cloudflareAccountId` in the target, pin generated config to it and compare cleanup's account before its first provider request. Actual account ownership, subdomain mapping and token permissions still require independent confirmation. |
| Redirects and legacy acceptance (medium) | Health observation already rejected redirects, but subsequent HTTP fixture writes/uploads used default redirect behavior. The older static-avatar script silently defaulted to the canonical live origin and lacked the C12 journal. It is not called by the C12 workflows. | Disable redirects for fixture HTTP and cleanup provider calls. Put static-avatar acceptance on the existing explicit target, observed identity and interruption-safe fixture journal. Local loopback tests show POST/PUT redirects cannot reach their destination; all three entry points fail before network access when no target is supplied. |

## Guards that already worked

- `prepare-rehearsal.mjs` requires the requested full commit SHA to match the
  checkout, checks tracked application/config inputs, replaces classroom routes,
  replaces runtime vars and R2, and does not provision or upload secrets.
- The current `durable_objects.bindings` has only `COMBAT_SESSIONS` /
  `CombatSession`, without an external script reference. A separate Worker with
  that local binding is the intended separation. Reusing an existing Worker name
  or transferred namespace is a provider inventory concern, not disproved by
  the name alone. Cloudflare documents how `script_name` can share persistent
  objects across Workers in its [DO environments reference](https://developers.cloudflare.com/durable-objects/reference/environments/).
- `validateManifest` rejects live mode, unresolved creation intent, unowned aliases
  and malformed/foreign object keys. Cleanup checks exact teacher/student aliases,
  ownership/reference closure, outside guild membership, session scope, quest
  completions and JSON equipment references. SQL is locked and transactional;
  faults roll back. No broad prefix deletion exists.
- Cleanup requires a Worker 404, rejects 403, preflights SQL with rollback before
  any R2 write, deletes exact journaled keys and tolerates already-absent objects.
  These checks do not prove independent resources or disposal of historical DO
  storage. The SQL preflight and apply are separate transactions; closing all
  other writers in the independently isolated environment remains required.
- Release guards check merged PR identity, identical reviewed tree, latest CI run
  and every required job. Health verifies commit/version before fixture creation.
  The live workflow additionally checks after acceptance. The repeated driver
  requires isolated mode and bounds repetitions and participant counts.

## Workflow and credential audit

| Entry point in C12 | Target / credential behavior | Isolation implication |
| --- | --- | --- |
| Deploy Cloudflare Staging | Manual dispatch on main; `cloudflare-staging` secrets; root `wrangler.jsonc`; production `ensure-r2.mjs`; `DATABASE_URL` migrations | Production release workflow. It is not a rehearsal deploy path. |
| Migrate Neon Staging | Manual dispatch on main; same production environment; direct `DATABASE_URL` | Production database operation. The configuration generator does not guard this separate command. |
| Live Combat Staging Acceptance | Manual main dispatch, two explicit live hostname choices, `ACCEPTANCE_MODE=live`, exact deployed identity | Intentionally creates live synthetic fixtures when separately authorized. It must not be used for disruptive rehearsal. |
| CI / Combat UI / Avatar Workshop | Read-only repository permission; unit/PGlite and local fixture/browser tests; no production provider secrets | Code regression evidence only. The parent Avatar Workshop suite remains green; this safety-only diff does not trigger its path filter. |
| Rehearsal generator / repeated driver / cleanup | No GitHub workflow provisions independent resources or selects an isolated secret environment | Operator/provider verification is still necessary. A new environment name or successful config generation is not evidence. |

The three C12 production workflows share a non-cancelling production concurrency
group. That lock does not cover direct CLIs, dashboard changes or other actors.
Main still has the older C11 workflow definitions: C12's SHA/tree gates and common
lock are proposals on unmerged #75, not installed operational controls. This
follow-up changes no workflow triggers or secrets and dispatches no provider job.

Raw Wrangler commands, the legacy smoke script, `ensure-r2.mjs`, and the database
migrator remain production-capable tools. Their use outside the prescribed path
cannot be made isolated by a filename. Secret upload is separate from the config
generator: it could supply a production DATABASE_URL/pepper/session secret even
after a different URL was validated. The runbook now calls this out explicitly.

## Independent evidence still required — none established by this audit

1. Cloudflare: verify the actual account and workers.dev subdomain mapping, fresh
   Worker, lack of classroom/custom routes, actual deployed bindings, fresh DO
   namespace IDs and lack of transfers/external script references. Confirm no
   pre-existing state under the selected name; UUID syntax is not freshness proof.
2. Neon: inventory production projects/branches and **all** endpoints, map the
   rehearsal endpoint/credentials to a distinct empty branch/database, and confirm
   it was not cloned from classroom data. A distinct endpoint can still access
   the same branch; `neonBranchId` in JSON is an assertion, not an API lookup.
3. Credentials: independently create and verify the isolated environment, token
   scope, actual uploaded database secret, session secret, password pepper and
   auth token. No secret values were retrieved or compared here.
4. R2: verify the account/bucket exists independently, is fresh/empty and is the
   bucket actually bound to the rehearsal Worker. A unique name does not establish
   ownership, contents or access boundaries.
5. Cleanup: reconcile every exact fixture identity/unresolved request, stop all
   writers, verify Worker absence in the correct account, then independently
   confirm disposal of DO namespaces, bucket and Neon branch. No cleanup receipt
   or operational disposal is produced by local tests. Historic live fixture
   retention remains a separate reviewed task.
6. C12 operations: representative repeated provider load and calibrated threshold,
   forced room/database recovery, compatible timed rollback, physical Chromebook
   observation and an agreed monitoring window remain open. This audit passes
   none of these gates and does not authorize their execution.

## Verification

The first 13 focused tests were run against the original implementation: 12
failed, and the valid current-config case passed. This distinguishes reproduced
guard gaps from assertions of general insecurity. The final suite adds local
driver-parser, redirect, account and acceptance-entry regressions. Existing
release/fixture and populated PGlite cleanup tests are retained. All input names,
connection strings, accounts and local HTTP traffic used here are synthetic.

Final verification results are recorded in PR #76 and the branch checkpoint.
No live acceptance, rehearsal stress, provider inventory query, cleanup CLI,
deployment or migration was run. Green tests establish code behavior only.
