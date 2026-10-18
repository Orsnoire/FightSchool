# Authoring and lobby ownership

C11 changes module ownership while preserving the current product specifications.

| Owner | Responsibility |
| --- | --- |
| `pages/CreateFight.tsx` | Authentication, existing-fight hydration, one React Hook Form definition, tier coordination and final save/navigation |
| `fight-authoring/useQuestionAuthoring.ts` | Question draft, identity-preserving Edit/Save/Cancel and correct-option selection |
| `fight-authoring/useQuestionCsv.ts`, `csv.ts` | File import lifecycle and the existing case-insensitive CSV dialect; skipped invalid rows, answer order and timer defaults |
| `fight-authoring/useEnemyAuthoring.ts`, `enemy-image.ts` | Enemy draft, supported-species/minimum/maximum rules, upload error recovery and ordered groups |
| `fight-authoring/*Panel.tsx`, `FightSettings.tsx`, `SortableEnemyItem.tsx` | Settings and question/enemy/loot controls; sortable row presentation |
| `pages/Lobby.tsx` | Student readiness, page composition, guild discovery, join and logout |
| `lobby/useLobbyEquipment.ts`, `preview.ts` | Existing equipment query keys, equipped visuals and calculated ability-preview context |
| `lobby/useLoadoutActions.ts` | Gear/ability mutations through the existing serialized `saveStudentLoadout` boundary |
| `lobby/useClassAppearance.ts` | Shared appearance draft, modal lifecycle and appearance save before class/loadout mutation |
| `lobby/*Panel.tsx`, `ClassAppearanceDialog.tsx`, `GuildPicker.tsx` | Character, progression, gear, class abilities, cross-class abilities, appearance and guild selection UI |
| `lobby/AbilityDragItems.tsx` | Drag icons, tooltips and drop slots; the cross-class panel owns sensors/filter/drag state |

Authoring draft hooks intentionally run in the route **above** Radix tab content.
Moving them into conditionally mounted panels would discard unsaved drafts on a
tab switch. Collections and the final form payload retain one route owner;
callbacks update both the visible collection and its form field.

Lobby panels receive the authoritative student/loadout data and save callbacks.
They do not issue independent writes or implement client-side reward logic.
`saveStudentLoadout` still serializes edits and refreshes caches after success or
failure. Appearance loading/failure/saving still prevents a class write; failed
appearance or class saves keep the modal available for retry. Gear comparisons
use existing permissions and the same cached metadata.

The loot selector is a controlled empty selection after each add. This permits
re-adding a removed item without switching tabs; the pinned C10 browser fixture
records the previous failure. Saved loot payloads and API validation are unchanged.

Eight reference-proven legacy calculation helpers and four unused feedback types
were removed from shared schema. `CombatState` and its `PlayerState` dependency
remain because the guild lobby still references that contract. Both saved-room
adapters remain; their retirement requires a separate decision.

See [C11 verification and reproduction](../reviews/2026-10-18-c11-authoring-lobby.md).
