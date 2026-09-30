import { and, eq, inArray } from "drizzle-orm";
import type { GameDatabase } from "./game-repository.ts";
import { avatarColors, avatarModels, studentAvatars } from "./schema.ts";

export interface AvatarColorSelection {
  hairColorId: string;
  eyeColorId: string;
  skinColorId: string;
}

/** Read only: viewing or reconnecting must never create/reroll an appearance. */
export async function getStudentAvatar(db: GameDatabase, studentId: string) {
  const [avatar] = await db.select().from(studentAvatars)
    .where(eq(studentAvatars.studentId, studentId));
  return avatar ?? null;
}

/**
 * Call when an authenticated student confirms initial avatar creation.
 * The caller must obtain studentId from the authenticated session, never trust
 * a student ID supplied in a request body. No gameplay gear or class is changed.
 * Retries return the first saved selection, including concurrent submissions.
 */
export async function createStudentAvatar(
  db: GameDatabase,
  studentId: string,
  modelId: string,
  selected: Partial<AvatarColorSelection> = {},
  random: () => number = Math.random,
) {
  const existing = await getStudentAvatar(db, studentId);
  if (existing) return existing;

  const [model] = await db.select().from(avatarModels)
    .where(and(eq(avatarModels.id, modelId), inArray(avatarModels.status, ["concept", "production"])));
  if (!model) throw new Error("Avatar model is unavailable");
  const colors = await db.select().from(avatarColors)
    .where(inArray(avatarColors.paletteId, [model.hairPaletteId, model.eyePaletteId, model.skinPaletteId]))
    .orderBy(avatarColors.sortOrder);
  const choose = (paletteId: string, selectedId?: string) => {
    const options = colors.filter(color => color.paletteId === paletteId);
    if (!options.length) throw new Error("Avatar palette is empty");
    if (selectedId !== undefined) {
      if (!options.some(color => color.id === selectedId)) throw new Error("Invalid avatar color");
      return selectedId;
    }
    const roll = random();
    if (!Number.isFinite(roll) || roll < 0 || roll >= 1) throw new Error("Invalid avatar random value");
    return options[Math.floor(roll * options.length)].id;
  };

  const [created] = await db.insert(studentAvatars).values({
    studentId, modelId,
    hairPaletteId: model.hairPaletteId,
    hairColorId: choose(model.hairPaletteId, selected.hairColorId),
    eyePaletteId: model.eyePaletteId,
    eyeColorId: choose(model.eyePaletteId, selected.eyeColorId),
    skinPaletteId: model.skinPaletteId,
    skinColorId: choose(model.skinPaletteId, selected.skinColorId),
  }).onConflictDoNothing({ target: studentAvatars.studentId }).returning();
  const result = created ?? await getStudentAvatar(db, studentId);
  if (!result) throw new Error("Avatar creation did not persist");
  return result;
}

/** Save an explicit choice, preserving model, palette versions and equipment. */
export async function saveStudentAvatarColors(
  db: GameDatabase,
  studentId: string,
  selected: AvatarColorSelection,
) {
  // Explicitly copy the three writable fields; do not spread caller input.
  // Composite foreign keys enforce each option's model-specific palette.
  const [updated] = await db.update(studentAvatars).set({
    hairColorId: selected.hairColorId,
    eyeColorId: selected.eyeColorId,
    skinColorId: selected.skinColorId,
    updatedAt: new Date(),
  }).where(eq(studentAvatars.studentId, studentId)).returning();
  return updated ?? null;
}
