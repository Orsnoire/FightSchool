# Bookwyrm animation workshop routing and publishing

Recovered and checked October 5, 2026. This workshop is separate from the QuestAcademy application Worker and its deployment workflow.

| Surface | Configuration |
| --- | --- |
| Public workshop | https://bookwyrminteractive.studio/workshop/ |
| Worker fallback | https://bookwyrm-animation-studio.coxsonator.workers.dev/workshop/ |
| Worker name | `bookwyrm-animation-studio` |
| R2 bucket | `bookwyrm-workshop` |
| R2 binding | `WORKSHOP_BUCKET` |
| Owner upload secret | `WORKSHOP_UPLOAD_TOKEN` |
| Health | `GET /workshop/_health` |
| Public objects | `GET` / `HEAD /workshop/{file}` → R2 `workshop/{file}` |
| Upload | `PUT /workshop/_upload/{file}` with a bearer owner token or connected session |

Public health returned version 2, `bucketBound: true`, `uploadsConfigured: true`, and `sessionConnection: true`. This verifies that those bindings are available, not the exact dashboard route expression. Preserve the existing host/path route. If rebuilding it, scope it to the workshop path on the Bookwyrm host; verify `/workshop` redirects to `/workshop/` without taking over the apex site or the QuestAcademy subdomain. Do not change DNS merely to publish a new preview.

`workshop/worker.js` is the recovered v2 Worker source from the owner's saved `bookwyrm-workshop-worker.js`. It is now versioned here. `workshop/site/index.html`, `app.js` and `catalog.js` preserve the public review shell. The October 1 `human-male-15.html` was ahead of the prior Git checkpoint; its exact artifact, manifest, rig and clips are archived under `attached_assets/characters/human/workshop-review15/`. These are review checkpoints, not proof of completed animation approval.

## Connection without sharing a secret in chat

1. Run `node scripts/workshop/publish.mjs connect`. This generates an uncommitted, permission-restricted session file and prints a link containing only a SHA-256 ticket.
2. The owner opens that `/workshop/_connect?ticket=…` link and enters the existing workshop upload secret on the password form. The owner token is never placed in a URL or sent to chat.
3. The page submits a same-origin `POST /workshop/_connect`. The Worker stores `_auth/sessions/{ticket}` with an eight-hour expiry and the owner's current token hash.
4. Run `node scripts/workshop/publish.mjs status` to check authorization, then `node scripts/workshop/publish.mjs upload` after building/reviewing the preview.

If the upload secret is unknown or needs rotation, the owner can use Cloudflare Dashboard → Workers & Pages → `bookwyrm-animation-studio` → Settings → Variables and Secrets → `WORKSHOP_UPLOAD_TOKEN`. Set the secret privately and deploy the configuration, then repeat the connection step. The assistant does not need the owner's Cloudflare password, and should not ask for it. Rotating the owner secret invalidates existing sessions.

The session bearer is a private random `bws_` token. Its SHA-256 digest is the ticket. The helper stores the bearer in ignored `.workshop-upload-session.json` with mode 0600. Do not commit it, the owner secret, or session authorization headers.

## Static starter review

```sh
npm run build:static-avatars
npm run render:static-avatars
node scripts/workshop/publish.mjs status
node scripts/workshop/publish.mjs upload
```

The generated `workshop/site/previews/static-starters-01.html` is self-contained and below the Worker's 25 MiB upload limit. It shares the app's appearance and renderer modules, supports both bodies and all twelve jobs, and offers PNG download. Its controls work when storage is blocked by the workshop's sandboxed iframe; shared values remain in memory. A standalone visit also remembers the latest appearance locally when browser storage is available. This preview never writes student data.

The helper uploads the new preview, checks its returned public bytes, then publishes the catalog entry last. It merges against the current public catalog to preserve later and historical entries, and aborts if that catalog changes during upload. Existing preview versions are not overwritten with different bytes. A revised visual review should use a new filename/ID. Uploading this review needs no Worker-code deployment, DNS change or Neon migration.

After publication, verify both the direct preview and `/workshop/?asset=static-starters-01`, including male/female, each job, light/dark palettes, keyboard controls and a phone viewport. If connection is pending, the generated HTML can be opened directly or loaded through the workshop shell's local-file picker.

## Separate live application

`questacademy-staging` serves https://questacademy.bookwyrminteractive.studio/. The GitHub **Deploy Cloudflare Staging** workflow changes that canonical live application despite its name. Use [the migration guide](cloudflare/full-migration.md) for it. A workshop upload does not deploy avatar APIs, alter students, or publish new combat logic.
