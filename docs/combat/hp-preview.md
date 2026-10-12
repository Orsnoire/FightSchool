# Waiting-room HP preview

Owner-approved scope — October 12, 2026. **Reviewed and merged in [PR #59](https://github.com/Orsnoire/FightSchool/pull/59); deployment pending.**

Before Start Fight, display estimated enemy HP calculated from the current joined roster and the frozen fight template, using the same `scaleEncounter` calculation as combat start. Recompute after joins/leaves and on reconnect. Empty rooms show `Waiting for players` instead of numeric placeholder HP. After start, show actual HP without an estimate label.

The preview is a read-only public projection: it must not change persisted enemy HP, phase, deadlines, resources, attendance budgets, reward fractions or random seed. For an unchanged hosted roster, the last preview matches starting HP exactly. Preserve all combat balance rules.

Implementation uses a public snapshot projection with the room's frozen fight template. Only projected enemy HP is replaced; normal answer and AI redaction still applies. Host and student messages share one calculated public state per broadcast, so the rotation estimate is not repeated for every connected socket. Solo fights auto-start; hosted one/two-player previews use the same entry-loadout rules as hosted Start Fight. UI labels, hover titles and accessible meters identify the estimate; empty-room enemy meters are hidden.

Review and verification:

- No blocking findings in the implementation and boundary-test review.
- Three focused tests failed on the placeholder behavior before the fix; all four focused tests now pass. Coverage includes legacy/modern fights, a 25-goblin swarm, 1/2/4/30-player rosters, joins/leaves, restored host snapshots, non-mutation, and visible/accessible labels.
- Original branch: 215 tests, typecheck and client/Worker builds pass. Combined with merged C03: 218 tests, typecheck and both builds pass.
- Reviewed head `13713d5b13feea53d728e42155ab378df9faa7a1`: [CI 38274186846](https://github.com/Orsnoire/FightSchool/actions/runs/38274186846) and [browser acceptance 38274186815](https://github.com/Orsnoire/FightSchool/actions/runs/38274186815) passed.
- Merge commit: `02392ef1c6fb6978a6602e470a336290a6886193`. C03 / PR #58 and its later documentation completion remain intact. The only shared file was the work log, updated in separate sections.

The owner authorized the independent branch alongside C03 and then explicitly authorized review/merge. No deployment or live acceptance was performed by this task. Record those outcomes separately when authorized.
