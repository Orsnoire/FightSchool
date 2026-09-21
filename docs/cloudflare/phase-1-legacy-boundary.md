# Phase 1: Legacy Boundary Hardening

Status: implemented for the selected authentication and fight-management boundary

Canonical production origin: https://questacademy.bookwyrminteractive.studio

## Scope

This increment keeps the existing Express deployment releasable while making the boundary that will be ported to Cloudflare safer and executable in CI. It does not deploy a Worker, create Cloudflare resources, change DNS, migrate Neon data, or enable object storage.

## Implemented changes

- Production startup now requires DATABASE_URL and SESSION_SECRET.
- Prototype and test records are no longer created during normal startup. Local developers must explicitly set SEED_DEVELOPMENT_DATA=1; production rejects that setting.
- /api/health/live reports process liveness and /api/health/ready verifies a Neon query.
- API requests receive an X-Request-Id. Structured request logs contain method, path, status, duration, and request ID, but not response bodies, passwords, session tokens, or student answers.
- Unknown /api/* routes return a JSON 404 before the SPA fallback.
- Session cookies explicitly use HttpOnly, SameSite=Lax, and Path=/; secure cookies remain enabled for deployed or production environments.
- Teacher-scoped reads reject missing sessions and cross-teacher IDs.
- Fight creation, updates, and deletion verify the authenticated teacher owns the requested resource.
- CI runs the type check, Phase 0 characterization, Phase 1 configuration and authorization tests, and the legacy production build.

## Compatibility matrix

| Subsystem | Current implementation | Phase 1 change | Cloudflare implication | Validation |
| --- | --- | --- | --- | --- |
| Configuration | Environment reads are distributed and the session secret has a production fallback | Central validation fails closed | The Worker can reuse the same explicit configuration contract | Phase 1 configuration tests |
| Startup data | Every process start creates prototype and test data | Explicit development-only opt-in | Worker isolates will not seed data during startup | Source and configuration tests |
| Health | No dedicated endpoint | Liveness and database readiness endpoints | Equivalent Worker endpoints can preserve the response contract | Source contract tests; staging probe later |
| Logging | API response bodies are logged | Redacted structured request events with request IDs | Worker logs can keep the same event fields | Source contract tests |
| Teacher authorization | Session presence is checked inconsistently; URL/body IDs can cross teacher boundaries | Selected teacher reads and fight mutations verify ownership | Establishes negative contracts before porting routes | Unit and route contract tests |
| API fallback | Unknown APIs can reach the SPA fallback | JSON 404 for /api/* | Matches the approved Worker route ordering | Source contract test |
| Sessions | express-session with PostgreSQL remains | Explicit cookie attributes and required production secret | Replacement with the Worker session repository remains Phase 3 | Type check/build; browser acceptance later |
| WebSockets | Process-local ws server remains | Phase 0 contract is retained unchanged | Durable Object port remains Phase 4 | Phase 0 characterization |

## Configuration

Required in production:

- DATABASE_URL (secret)
- SESSION_SECRET (secret)
- NODE_ENV=production

Optional legacy settings:

- PORT (defaults to 5000)
- REPLIT_DEPLOYMENT=1 for the existing rollback deployment
- SEED_DEVELOPMENT_DATA=1 for explicit local development only

No Cloudflare account ID, zone ID, database credential, session key, or production resource identifier is committed.

## Validation and rollback

Repository verification:

    npm ci
    npm run check
    npm test
    npm run build

Staging acceptance must additionally probe both health endpoints, verify an unknown API returns JSON, confirm request IDs appear in headers and logs, exercise teacher login/logout, and prove teacher A cannot read or mutate teacher B's fights.

Rollback is a normal redeploy of the prior legacy commit. This increment makes no schema, data, DNS, storage, or Cloudflare resource changes. Operators must not set SEED_DEVELOPMENT_DATA in production during either rollout or rollback.

## Known limitations

- Express, connect-pg-simple, the Node WebSocket server, and the Replit object-storage adapter remain legacy-only.
- Student identity and WebSocket upgrade authentication remain migration gates for Phases 3 and 4.
- Ownership checks outside the selected teacher-read and fight-management boundary still require audit and negative tests before those routes are ported.
- Session-table creation remains managed by the legacy session adapter until committed clean-schema migrations replace it in Phase 3.
- The unified Worker, Workers Static Assets, Durable Object binding, and Wrangler environments begin in Phase 2 after this boundary passes CI and review.
