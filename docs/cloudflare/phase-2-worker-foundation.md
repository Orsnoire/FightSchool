# Phase 2: Unified Worker Foundation

Status: repository implementation prepared; staging deployment requires manual approval

## Architecture

The staging service is one Cloudflare Worker named questacademy-staging.

- Workers Static Assets serves dist/public.
- SPA navigation falls back to index.html.
- /api, /ws, and /objects run through the Worker before asset handling.
- COMBAT_SESSIONS binds to the SQLite-backed CombatSession Durable Object.
- The production hostname and all production DNS remain untouched.

The Durable Object uses Cloudflare's Hibernation WebSocket API and serializes a minimal per-connection attachment. Phase 2 exposes only a staging-authenticated ping/pong contract. It does not port gameplay, teacher/student identity, Neon, sessions, or object storage.

## Route contract

| Route | Phase 2 behavior |
| --- | --- |
| /api/health/live | JSON liveness response |
| /api/health/ready | JSON readiness after a Durable Object request |
| unknown /api/* | JSON 404 |
| /ws without upgrade | JSON 426 |
| /ws without staging authorization | JSON 401 |
| authorized /ws?sessionId=... | Durable Object WebSocket ping/pong |
| /objects/* | JSON 501; never SPA HTML |
| known assets | Workers Static Assets |
| nested browser routes | SPA index.html fallback |

## Configuration

Committed non-secret staging values:

- ENVIRONMENT=staging
- PUBLIC_ORIGIN=https://questacademy-staging.coxsonator.workers.dev
- Worker name questacademy-staging
- Durable Object binding COMBAT_SESSIONS

GitHub environment secrets:

- CLOUDFLARE_ACCOUNT_ID
- CLOUDFLARE_API_TOKEN

STAGING_AUTH_TOKEN is generated for each manual deployment inside GitHub Actions, masked immediately, uploaded as a Worker secret, used for the WebSocket smoke test, and discarded with the job.

## Deploy

1. Open the Deploy Cloudflare Staging workflow in GitHub Actions.
2. Select Run workflow on the reviewed branch.
3. Approve the cloudflare-staging environment request.
4. Wait for build, deployment, and smoke verification.

The workflow verifies dependency installation, the TypeScript diagnostic ratchet, all repository tests, the client and Worker builds, liveness, readiness, API 404 behavior, object-route isolation, nested SPA refresh, and Durable Object WebSocket echo. The first liveness check retries for up to one minute because a newly created workers.dev route can take several seconds to become visible to the GitHub runner.

## Manual Cloudflare actions

None are required for the first staging deployment. Wrangler creates the staging Worker and reconciles the declared Durable Object export. Do not attach a Custom Domain, add DNS, or create R2.

## Rollback

Staging is not production traffic. Roll back by deploying an earlier known-good Worker version from Cloudflare's deployment history or rerunning the workflow from the earlier commit. If the foundation must be abandoned, disable the staging workers.dev route; do not delete Durable Object exports or data without a separately reviewed destructive change.

## Known limitations

- The bearer credential is a staging smoke-test boundary, not the production teacher/student session design.
- No Neon database or Hyperdrive binding exists yet.
- No gameplay command is implemented in the Durable Object.
- No object upload or delivery adapter is enabled.
- Browser acceptance is limited to automated HTTP/WebSocket smoke checks until Phase 3 supplies real identity and data.
