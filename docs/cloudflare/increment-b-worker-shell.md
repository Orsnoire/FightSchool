# Increment B: Unified Worker Shell

## Delivered boundary

This increment adds a deployable shell for the target architecture without porting legacy API or combat behavior. The Vite client builds with `/QuestAcademy/` as its production base, Wouter scopes navigation to `/QuestAcademy`, and shared client URL helpers keep HTTP, WebSocket, and object paths inside the application boundary.

The Worker handles these routes:

- `/QuestAcademy` redirects once to `/QuestAcademy/`.
- `/QuestAcademy/api/_shell/health` returns a shell health response.
- `/QuestAcademy/api/*` returns a JSON `501` placeholder and never receives SPA HTML.
- `/QuestAcademy/ws` requires a WebSocket upgrade, then returns a JSON `501` placeholder until the Durable Object slice is implemented.
- Other `/QuestAcademy/*` GET and HEAD requests are rewritten without the public prefix and sent to the `ASSETS` binding. Workers Static Assets supplies the SPA fallback.
- Any request outside the exact `/QuestAcademy` and `/QuestAcademy/*` boundary is rejected by the Worker. Production route attachment must provide the primary non-capture boundary.

## Commands

```sh
npm run test:cloudflare
npm run build:cloudflare
npm run cloudflare:dev
```

The Cloudflare commands pin Wrangler 4.20.0 because selective Static Assets `run_worker_first` routing requires Wrangler 4.20.0 or later. No package-lock update is required for the pinned `npx` invocation.

## Configuration

Committed non-secret variables:

- `APP_BASE_PATH=/QuestAcademy`
- `APP_ORIGIN` placeholder values for local, preview, and staging
- `ENVIRONMENT`

Committed binding:

- `ASSETS`, mapped to `dist/public`

`DATABASE_URL`, session key material, `COMBAT_SESSIONS`, and `OBJECTS` remain deferred because this increment does not execute migrated application behavior. Do not add secret values or account identifiers to the repository.

## Manual Cloudflare actions

No account action is required to review this pull request. For an authorized preview deployment:

1. Authenticate Wrangler locally with the intended Cloudflare account.
2. Replace the `.invalid` preview or staging origin through environment-specific configuration without committing private account data.
3. Run the build and Wrangler dry run before any upload.
4. Deploy to a preview or staging Worker only.
5. Do not attach the production domain yet.

For a later authorized production route attachment, configure both exact route patterns:

- `BookwyrmInteractive.studio/QuestAcademy`
- `BookwyrmInteractive.studio/QuestAcademy/*`

Do not configure `BookwyrmInteractive.studio/QuestAcademy*`; Cloudflare wildcards match arbitrary suffixes and would capture similarly prefixed paths. Do not attach a Custom Domain for the apex because Custom Domains route every path on the hostname.

## Validation and rollback

The routing tests cover the bare-path redirect, asset-prefix rewriting, nested SPA navigation, API/WebSocket precedence, case sensitivity, and unrelated or similarly prefixed path rejection. The Wrangler test also prevents an overbroad production route from being committed.

This increment does not change DNS, production routes, Neon, sessions, or object storage. Rollback is a code revert or removal of a preview/staging Worker route. Preserve the existing host throughout later acceptance testing.
