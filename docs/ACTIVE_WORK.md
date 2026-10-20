# Campaign pilot — isolated preview ready for owner playtest (October 20, 2026)

- Latest owner design addition: [CAM-08 content and polish](CAMPAIGN_DEVELOPMENT_ROADMAP.md#cam-08-polish-acceptance--environment-bestiaries) now requires a dedicated bestiary of 3–5 unique enemies per biome/environment, including overworld tile types, with encounter selection by current environment. Question eligibility remains tied to unlocked dungeons. Documentation only; enemy implementation remains future work. Reviewed the documentation diff and whitespace checks; no runtime change or redeployment.
- Active branch `feature/campaign-pilot`, [PR #81](https://github.com/Orsnoire/FightSchool/pull/81), ready for review and **unmerged**. C12 stays on its own lane. Owner requested testing and access; classroom deployment remains out of scope.
- Play: https://questacademy-campaign-preview.coxsonator.workers.dev/ . [Student/teacher walkthrough](CAMPAIGN_PLAYTEST.md). A fresh `CampaignTester` character has 500 gold, full HP and an unclaimed key; its teacher gate is open. Credentials were supplied privately in the owner conversation, never committed.
- Deployed source `a688e8f18d2c539612cb87d0360f92fe8f5cbf18`. This checkpoint is documentation only. Dedicated Neon project/database, R2 bucket and local DO namespace are verified in [the test report](reviews/2026-10-20-campaign-playtest.md). All 19 migrations applied only to the fresh empty preview database.
- Verification: [329 tests, TypeScript and both builds](https://github.com/Orsnoire/FightSchool/actions/runs/39456186245) pass; [all four browser jobs](https://github.com/Orsnoire/FightSchool/actions/runs/39456186313) pass. Updated desktop/phone screenshots were inspected; an unreadable light-theme heading was fixed.
- Real HTTP/WebSocket checks pass for gates/key, question eligibility, exploration, both shops, inn jobs/rest, reduced persistent HP, field potion cost, reconnect, leaving encounters, guardian victory and saved clear state. [Structured results](reviews/2026-10-20-campaign-playtest-results.json). The owner character was not consumed by acceptance.
- Open observations: first combat run had an unexplained answer-feedback delay; later fights progressed. A driver assumption about empty animation phases was corrected without changing gameplay. The level-one herbalist's guardian fight was long (28 rounds including test interruption); solo balance is not approved.
- Exact next action: owner plays the preview and reports usability, combat timing and balance observations. Fix reproducible pilot issues on this branch; do not mark the full campaign roadmap complete. Cooperative exploration, role-constrained 3–8-player bosses, transport gates, other biomes and assigned loot chests remain future work.
- Boundary: **PREVIEW DEPLOYED / CORE LOOP ACCEPTED / OWNER PLAYTEST PENDING**. No merge, classroom migration/deployment, C12 overwrite or automatic resource cleanup occurred.

## Historical checkpoints

Earlier campaign, release and cleanup checkpoints remain in the
[previous committed version](https://github.com/Orsnoire/FightSchool/blob/830c6bca750ed9c971733bb8beb9f7f0f2b42316/docs/ACTIVE_WORK.md).
This handoff retains current campaign status without republishing the historical
infrastructure inventory. The separate C12 lane remains
[PR #75](https://github.com/Orsnoire/FightSchool/pull/75); inspect its branch checkpoint
and live PR before resuming that work. Main's checkpoint remains the discovery
pointer for registered work.
