# QuestAcademy

A persistent educational RPG hosted at https://questacademy.bookwyrminteractive.studio.

Read [Source of Truth](docs/Source_of_Truth.md) and [Migration Plan](docs/Migration_Plan) before changing gameplay or architecture. The current runtime and verification procedure are documented in [the Worker migration guide](docs/cloudflare/full-migration.md).

## Development

```sh
npm ci
npm run check
npm test
npm run build:cloudflare
npm run dev:cloudflare
```

The React client is served through Cloudflare Worker Static Assets. Fetch-native APIs use Neon PostgreSQL, one Durable Object coordinates each combat room, and R2 stores uploaded images. Development secrets belong in an uncommitted `.dev.vars` file. The required secret names and bindings are defined in `wrangler.jsonc`.

Database migrations live in `migrations/cloudflare`. GitHub's manual Deploy Cloudflare Staging workflow performs validation, storage preparation, additive migration, deployment and origin smoke checks. Live Combat Staging Acceptance exercises the complete student and teacher flow.

## Avatar and workshop development

[Workshop routing and upload access](docs/workshop-routing.md) documents the
separate Bookwyrm Worker and R2 bucket. [Static starter art](attached_assets/characters/human/static-starters-v1/README.md)
and the [permanent starter wardrobe](docs/starter-wardrobe.md) record the October 5 review.

```sh
npm run build:static-avatars
npm run render:static-avatars
```

The workshop review can publish independently. Live game deployment requires
static-art/armor-rule signoff and additive migration `0009_starter_wardrobe.sql`.
