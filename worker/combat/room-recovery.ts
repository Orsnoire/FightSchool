import { upgradePriestActions } from "./choices";
import { initialCombatState } from "./encounter-setup";
import { addStudent } from "./participants";
import type { IdentityRepository } from "../db/repository";
import type { StoredRoom } from "./room-state";

interface RecoveryEffects {
  repository: Pick<IdentityRepository, 'findStudentById' | 'getCombatProfile'> | null;
  save(room: StoredRoom): Promise<void>;
  syncAlarm(room: StoredRoom): Promise<void>;
}
/** Retain both legacy phase-4 and version-2 Priest adapters without resetting progress. */
export async function recoverRoom(room: StoredRoom, effects: RecoveryEffects): Promise<StoredRoom> {
  if (room.snapshot.schemaVersion === 2) {
    const upgraded = upgradePriestActions(room.snapshot);
    if (upgraded !== room.snapshot) {
      room.snapshot = upgraded;
      await effects.save(room);
    }
    return room;
  }
  // Upgrade the unfinished phase-4 room in place. Existing answers and HP survive.
  const old: any = room.snapshot;
  let upgraded = initialCombatState(
    old.sessionId,
    room.fight,
    old.phaseStartTime,
  );
  for (const previous of Object.values(old.players) as any[]) {
    const student = await effects.repository?.findStudentById(
      previous.studentId,
    );
    if (!student) continue;
    upgraded = addStudent(
      upgraded,
      student,
      await effects.repository?.getCombatProfile?.(student, old.sessionId),
    );
    const player = upgraded.players[student.id];
    Object.assign(player, {
      health: Math.min(previous.health, player.maxHealth),
      mp: Math.min(previous.mp, player.maxMp),
      hasAnswered: previous.hasAnswered,
      currentAnswer: previous.currentAnswer,
      lastAnswerCorrect: previous.lastAnswerCorrect,
      isDead: previous.isDead,
      threat: previous.threat,
    });
  }
  upgraded.currentPhase = old.currentPhase;
  upgraded.currentQuestionIndex = Math.min(
    old.currentQuestionIndex,
    room.fight.questions.length - 1,
  );
  upgraded.questionStartTime = old.questionStartTime;
  upgraded.phaseStartTime = old.phaseStartTime;
  upgraded.enemies = old.enemies.map((e: any) => ({ ...e, effects: [] }));
  if (old.currentPhase === "question")
    upgraded.phaseDeadline =
      (old.questionStartTime || Date.now()) +
      room.fight.questions[upgraded.currentQuestionIndex].timeLimit * 1000;
  if (old.currentPhase === "game_over") {
    upgraded.victory = false;
    upgraded.endReason =
      "Previous fight completed before the combat migration";
    room.resultsPersisted = true;
  }
  room.snapshot = upgraded;
  room.receipts = [];
  await effects.save(room);
  await effects.syncAlarm(room);
  return room;
}
