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
   campaign upgrade. For this release, migration 0020 is required. Do not migrate
   the classroom database. The workflow intentionally has no database credential.
5. Record `migration0020Applied: true` and `mode: deploy` in the request, then commit.
   The workflow checks out the exact requested source, runs its checks/tests/build,
   uploads that build, retains preview resources/secrets, and verifies the release
   marker and public health endpoint.
6. Run authenticated item purchase/use/carryover and combat timing checks with the
   dedicated QA account, update the review evidence, then invite the owner to test.

A manual workflow dispatch can rerun the checked-in request once GitHub exposes
this workflow on the default branch. Until then, committing a request on the
campaign branch is the trigger; failed runs can be rerun from their Actions page.
A run performs only the checked-in mode; preflight never deploys.

If the credential is unavailable or rejected, stop before migration/deployment
and repair the existing GitHub environment credential through its normal settings.
Do not expose tokens in issues, logs, repository files, or chat. If bindings or
release source differ from the request, inspect the newer state before retrying.

## Current release

- Tested runtime: `ccb003f797e94b01f39329a477af8a009b7d7e98`.
- [Read-only preflight](https://github.com/Orsnoire/FightSchool/actions/runs/39643804398) passed.
- Migration 0020 is applied only to the preview: 21 ledger entries, one item shop,
  unchanged map geometry and player progress digests.
- Request now explicitly deploys the tested runtime; live verification is pending.
- Four deployment boundary tests pass locally (read-only preflight, wrong-target
  rejection, explicit migration/source gates, resource/secret preservation).
