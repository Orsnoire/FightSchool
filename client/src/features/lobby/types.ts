import type { CharacterClass, Gender, Student } from "@shared/schema";
/** Panels render only after character selection is complete. */
export type LobbyStudent = Student & { characterClass: CharacterClass; gender: Gender };
