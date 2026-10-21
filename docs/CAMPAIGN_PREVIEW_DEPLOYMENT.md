# Campaign preview deployment

The campaign remains in `feature/campaign-pilot`, PR #81. The classroom site and
its short-domain redirect use a separate release path.

`Deploy Campaign Preview` uses the existing `cloudflare-staging` GitHub environment
only to retrieve its Cloudflare API token and account ID. The deployment script
has a fixed preview Worker target. It does not use `wrangler.jsonc`, classroom
`DATABASE_URL`, password/session secrets, or the classroom migration command.
Existing preview secrets, storage, and combat namespace are retained server-side.
Do not use `Deploy Cloudflare Staging` to release this campaign branch.

## Release procedure

1. Confirm the campaign branch/PR, the desired full runtime SHA, passing CI/browser
   evidence, and the currently deployed preview source.
2. Set `deploy/campaign-preview.json` to `mode: preflight`, with the desired source
   and expected previous source. Commit that request on the campaign branch.
   Only changes to this request file trigger the preview push workflow.
3. Check `Deploy Campaign Preview` in GitHub Actions. The preflight performs only
   a settings read and verifies preview bindings. An environment approval, if
   configured in GitHub, remains required.
4. Apply any required forward-only migration to the isolated preview database
   through the authorized database tooling. Verify its migration ledger and saved
   campaign upgrade. Migration 0020 is already applied to the preview; the reset
   release needs no additional migration. Do not migrate
   the classroom database. The workflow intentionally has no database credential.
5. Record `migration0020Applied: true` and `mode: deploy` in the request, then commit.
   The workflow checks out the exact requested source, runs its checks/tests/build,
   verifies the built campaign UI at desktop/phone sizes, uploads that build,
   retains preview resources/secrets, and verifies the release
   marker and public health endpoint.
6. Perform focused post-deploy checks appropriate to the change with the dedicated
   QA account where needed. Record precisely what was verified live versus in
   integration/browser fixtures, update review evidence, then invite the owner to test.
   Never reset the owner's playtester merely to verify a personal reset control.

A manual workflow dispatch can rerun the checked-in request once GitHub exposes
this workflow on the default branch. Until then, committing a request on the
campaign branch is the trigger; failed runs can be rerun from their Actions page.
A run performs only the checked-in mode; preflight never deploys.

If the credential is unavailable or rejected, stop before migration/deployment
and repair the existing GitHub environment credential through its normal settings.
Do not expose tokens in issues, logs, repository files, or chat. If bindings or
release source differ from the request, inspect the newer state before retrying.

## Earlier consumables release

- Tested runtime: `ccb003f797e94b01f39329a477af8a009b7d7e98`.
- [Read-only preflight](https://github.com/Orsnoire/FightSchool/actions/runs/39643804398) passed.
- Migration 0020 is applied only to the preview: 21 ledger entries, one item shop,
  unchanged map geometry and player progress digests.
- [Deployment run 39644095594](https://github.com/Orsnoire/FightSchool/actions/runs/39644095594)
  passed and deployed the tested runtime. The source marker and existing combat
  namespace identity were verified, and public liveness/readiness return 200.
- Live purchases, field/combat item use, protection countdown, settlement/reload
  carryover and timing checks pass. The owner subsequently reported the preview working.
- Future agents should use this GitHub path for preview deployment; another
  Cloudflare dashboard/MCP login is not needed while the stored credential works.
- Four deployment boundary tests pass locally (read-only preflight, wrong-target
  rejection, explicit migration/source gates, resource/secret preservation).

## Current personal reset release

Runtime source `248167a712be1d7fd0d38cd24962b2e2a7fe154a` has the same application
code as the initial reset release `905c56260141fb03b0a84cf7cec9b66fed5e83d4`; the
follow-up only improves screenshot capture after the dialog opening animation.
No new migration was required. [Run 39666392515](https://github.com/Orsnoire/FightSchool/actions/runs/39666392515)
passed 339 tests, TypeScript, both builds and desktop/phone campaign browser checks,
then deployed the requested source. Release-source, combat-namespace identity and
public-liveness verification passed. Fully opened reset screenshots were inspected.
The request expected the initial reset runtime as its previous source; update both
source fields for a future release rather than replaying that completed request.
See [reset evidence and live limits](reviews/2026-10-21-campaign-reset.md)
and [active work](ACTIVE_WORK.md). Owner acceptance of the reset remains pending.
