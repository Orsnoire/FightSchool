# Waiting-room HP preview

Owner-approved scope — October 12, 2026.

Before Start Fight, display estimated enemy HP calculated from the current joined roster and the frozen fight template, using the same `scaleEncounter` calculation as combat start. Recompute after joins/leaves and on reconnect. Empty rooms show `Waiting for players` instead of numeric placeholder HP. After start, show actual HP without an estimate label.

The preview is a read-only public projection: it must not change persisted enemy HP, phase, deadlines, resources, attendance budgets, reward fractions or random seed. For an unchanged hosted roster, the last preview must match starting HP exactly. Cover modern swarms, legacy encounters, solo/duo loadouts, empty rooms, roster changes and restored rooms. Preserve all combat balance rules.

This separate branch is authorized alongside C03 / PR #58. It owns only combat preview/presentation and focused regression coverage; C03 retains schema and migration ownership. Merge or deploy only as a separately authorized step.

Checkpoint: registered before implementation; tests not yet run.
