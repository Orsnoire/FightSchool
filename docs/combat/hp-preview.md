# Waiting-room HP preview

Owner-approved scope — October 12, 2026.

Before Start Fight, display estimated enemy HP calculated from the current joined roster and the frozen fight template, using the same `scaleEncounter` calculation as combat start. Recompute after joins/leaves and on reconnect. Empty rooms show `Waiting for players` instead of numeric placeholder HP. After start, show actual HP without an estimate label.

The preview is a read-only public projection: it must not change persisted enemy HP, phase, deadlines, resources, attendance budgets, reward fractions or random seed. For an unchanged hosted roster, the last preview must match starting HP exactly. Cover modern swarms, legacy encounters, solo/duo loadouts, empty rooms, roster changes and restored rooms. Preserve all combat balance rules.

This separate branch is authorized alongside C03 / PR #58. It owns only combat preview/presentation and focused regression coverage; C03 retains schema and migration ownership. Merge or deploy only as a separately authorized step.

Checkpoint: draft PR #59 registered before implementation at `23dd554`. Four focused tests and typecheck pass. Three new tests failed on the baseline before implementation; the fourth verifies active-room/empty-room projection safety. Full suite, builds and CI pending.

Implementation uses a public snapshot projection with the room's frozen fight template. Only projected enemy HP is replaced; normal answer and AI redaction still applies. Host and student messages share one calculated public state per broadcast, so the rotation estimate is not repeated for every connected socket. Solo fights auto-start; hosted one/two-player previews use the same entry-loadout rules as hosted Start Fight. UI labels, hover titles and accessible meters identify the estimate; empty-room enemy meters are hidden.
