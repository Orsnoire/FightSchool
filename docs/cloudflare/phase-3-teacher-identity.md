# Phase 3A: Teacher Identity and Neon Foundation

Status: repository implementation prepared; Neon staging provisioning and acceptance remain manual

## Scope

This increment creates the first clean Cloudflare database boundary. It intentionally ports only teacher identity so the schema, migration, cookie, and revocation model can be proven before student identity and gameplay data are added.

- Neon HTTP and Drizzle run inside the Worker without a Node TCP server.
- Committed migrations create `teachers` and `app_sessions`; they do not seed prototype data.
- Passwords use a versioned, salted PBKDF2-HMAC-SHA256 format at the Cloudflare-enforced 100,000-iteration ceiling, with an independent HMAC pepper kept outside Neon.
- The browser receives a signed, high-entropy opaque cookie. Only its SHA-256 digest is stored in Neon.
- Sessions are server-side, expiring, and immediately revocable on logout.
- Teacher signup, login, logout, session check, and same-teacher profile read run through the Worker.
- Unsafe teacher requests require the exact configured same-origin `Origin` header.
- Readiness now verifies both the Durable Object and Neon.

Student identity, fights, guilds, combat persistence, login throttling, password recovery, and production DNS are outside this increment.

## Required staging secrets

Store these only in the GitHub `cloudflare-staging` environment:

- `DATABASE_URL`: pooled Neon connection string for an isolated staging branch or project.
- `PASSWORD_PEPPER`: at least 32 bytes of cryptographically random data used only for password pre-hashing.
- `SESSION_SECRET`: at least 32 bytes of cryptographically random data, used only for session-cookie HMAC.

The existing `CLOUDFLARE_ACCOUNT_ID` and `CLOUDFLARE_API_TOKEN` remain required. No secret belongs in source control or a `VITE_*` variable.

## Staging sequence

1. Create an isolated Neon staging project or branch with an empty database.
2. Add `DATABASE_URL` and `SESSION_SECRET` to the GitHub `cloudflare-staging` environment.
3. Run the `Migrate Neon Staging` workflow from `main` and confirm it succeeds.
4. Run `Deploy Cloudflare Staging` from `main`.
5. Confirm readiness, create a teacher account, refresh the browser, log out, and verify the old cookie no longer authenticates.

Migrations and deployment remain separate manual workflows. This prevents an application deploy from silently changing the database.

## Acceptance

- A blank staging database migrates successfully and a second migration run is a no-op.
- Missing database or session secrets fail deployment preparation and Worker identity routes fail closed.
- Duplicate email registration is rejected without revealing password information.
- Invalid login returns the same response for an unknown email and a wrong password.
- A valid teacher session survives refresh, cannot read another teacher profile, and is revoked immediately on logout.
- API responses never include `password_hash`, the raw session token, or database credentials.

## Rollback

This migration is additive and staging-only. Roll back code by deploying the prior Worker version. Do not drop the new tables during the rollback window; the preceding Worker ignores them. Database rollback is therefore no-op unless separately reviewed data removal is explicitly authorized.
