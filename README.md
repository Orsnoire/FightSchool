# QuestAcademy

A persistent educational RPG hosted at https://questacademy.bookwyrminteractive.studio.

Start with the [documentation index](docs/README.md), [current status](docs/CURRENT_STATUS.md),
and [cleanup plan](docs/CLEANUP_PLAN.md). C01–C11 are merged, deployed and accepted.
C11 (Phase 5) is released in [PR #74](https://github.com/Orsnoire/FightSchool/pull/74).
C12 (Phase 6 release review) is active in [draft PR #75](https://github.com/Orsnoire/FightSchool/pull/75); operational signoff remains open. Read the [active-work checkpoint](docs/ACTIVE_WORK.md);
[expansion](docs/EXPANSION_PLAN.md) follows the cleanup exit gates.
Read [Source of Truth](docs/Source_of_Truth.md) before changing gameplay or architecture.
The [migration plan](docs/Migration_Plan) is historical; the deployed architecture,
release evidence and open operational checks are in [the release/recovery record](docs/cloudflare/full-migration.md).

## Development

```sh
npm ci
npm run check
npm test
npm run build:cloudflare
npm run dev:cloudflare
```

The React client is served through Cloudflare Worker Static Assets. Fetch-native APIs use Neon PostgreSQL, one Durable Object coordinates each combat room, and R2 stores uploaded images. Development secrets belong in an uncommitted `.dev.vars` file. The required secret names and bindings are defined in `wrangler.jsonc`.

Database migrations live in `migrations/cloudflare`. Use the pinned Node/npm versions in `.node-version` and `package.json`. The [release runbook](docs/cloudflare/release-runbook.md) defines exact-SHA deployment, runtime identity verification, fixture ownership and isolated recovery drills. Both staging-named hostnames serve production.

## Avatar and workshop development

[Workshop routing and upload access](docs/workshop-routing.md) documents the
separate Bookwyrm Worker and R2 bucket. [Static starter art](attached_assets/characters/human/static-starters-v1/README.md)
and the [permanent starter wardrobe](docs/starter-wardrobe.md) record the October 5 review.

```sh
npm run build:static-avatars
npm run render:static-avatars
```

The workshop review can publish independently. Static avatars and the starter
wardrobe are already deployed, including migration `0009_starter_wardrobe.sql`;
front-facing equipped-item art followed in PR #46. Further art and animation
remain subject to their documented visual and technical gates.
