# Campaign pilot — consumables and combat responsiveness (October 21, 2026)

- Continue on `feature/campaign-pilot`, [PR #81](https://github.com/Orsnoire/FightSchool/pull/81), open and unmerged. C12 remains separate in PR #75.
- Owner accepted the movement improvement. Current scope: item shop, weighted consumable quantities, all eight requested item effects, and pauses between combat inputs.
- Implemented locally: Items menus in exploration/combat, item shop added to new/saved maps, atomic gold/quantity purchases, carryover/retry-safe settlement, self-cures while disabled, and five enemy-turn protection. [Rules and explicit prototype defaults](CAMPAIGN_CONSUMABLES.md).
- Responsiveness: a prior-preview QA probe found fast command acknowledgment but waits before resolution/completion display. Campaign snapshots now publish after durable checkpoint and before optional reporting; rewards remain gated on persisted results.
- Verification: 339 local tests, TypeScript and both builds pass. Current GitHub CI passes; campaign/combat desktop/phone browser tests pass on the first checkpoint. The final bounded bag/projection follow-up is awaiting CI and screenshot review. Saved-map upgrade and idempotent reapplication pass. No deployment of this follow-up yet; the hosting connector currently returns internal errors.
- Next: finish tests and browser review, publish verified code, then apply forward-only migration 0020 and deploy to the isolated preview when its hosting connector recovers. The owner playtester has not been changed by QA.
- Earlier [movement/equipment evidence](reviews/2026-10-20-campaign-movement-equipment.md), [play guide](CAMPAIGN_PLAYTEST.md), [art direction](CAMPAIGN_ART_DIRECTION.md) and [roadmap](CAMPAIGN_DEVELOPMENT_ROADMAP.md) remain applicable. The UI workshop, biome bestiaries and long herbalist guardian balance review remain open.
- Classroom deployment and merge remain outside this task.

Earlier checkpoints are preserved in [Git history](https://github.com/Orsnoire/FightSchool/commits/feature/campaign-pilot/docs/ACTIVE_WORK.md).
