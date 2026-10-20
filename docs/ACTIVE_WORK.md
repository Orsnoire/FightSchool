# Campaign pilot — owner playtest follow-up (October 20, 2026)

- Continue on `feature/campaign-pilot`, [PR #81](https://github.com/Orsnoire/FightSchool/pull/81), open and unmerged. The separate C12 work remains [PR #75](https://github.com/Orsnoire/FightSchool/pull/75); inspect its checkpoint before resuming it.
- Owner feedback: movement feels slow; the placeholder UI needs a workshop; equipment should be accessible during exploration and show only currently usable owned gear.
- Implemented follow-up: immediate local movement prediction, at most eight unconfirmed steps, server-validated queued paths that stop at encounters, stale-poll protection, connection recovery, and reuse of the validated combat profile within each action.
- Equipment: current campaign job/effective-level/ownership/hand-pair filtering; server-validated saved loadout changes; combat lockout; HP/MP never refill. Forward-only migration 0019 extends the existing atomic action routine and remains unapplied pending verification.
- Local verification: TypeScript, full test suite and both builds pass. Focused cases cover delayed movement, batching, correction/recovery, encounter stops, equipment eligibility/persistence, job separation and resource preservation. Browser CI is pending; no local browser executable is installed.
- UI workshop is recorded in [the pilot specification](CAMPAIGN_PILOT.md). A map-first screen and menus opened on demand are proposed; no final visual layout has been approved.
- Future polish: [the roadmap](CAMPAIGN_DEVELOPMENT_ROADMAP.md) requires 3–5 unique enemies per biome/environment, including overworld tile types, with environment-specific encounter pools. Academic questions still come from currently unlocked dungeons. This is not implemented in the pilot.
- Next action: inspect CI/browser results, fix regressions, update only the isolated owner playtest, and verify movement and equipment there. The existing playtest still runs the earlier build. Classroom deployment is outside this task.
- Earlier campaign acceptance and balance observations remain in [the playtest report](reviews/2026-10-20-campaign-playtest.md); access instructions are in [the play guide](CAMPAIGN_PLAYTEST.md). The long level-one herbalist guardian fight remains an open balance observation.

Earlier checkpoints are preserved in [Git history](https://github.com/Orsnoire/FightSchool/commits/feature/campaign-pilot/docs/ACTIVE_WORK.md). Main's checkpoint remains the discovery pointer for registered work.
