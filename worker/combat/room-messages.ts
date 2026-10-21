import { publicSnapshot } from "./public-snapshot";
import { answersRevealed } from "../../shared/combat/answer-feedback";
import { deterministicShuffle } from "./random";
import type { StoredRoom } from "./room-state";

export function publicResults(room: StoredRoom) {
  return room.results?.map((r:any)=>({
    studentId:r.studentId,id:r.id,xpEarned:r.xpEarned,baseXp:r.baseXp,xpMultiplier:r.xpMultiplier,
    staminaFightNumber:r.staminaFightNumber,staminaRestored:r.staminaRestored,goldReward:r.goldReward,
    lootTable:r.lootTable?.map((item:{itemId:string})=>({itemId:item.itemId}))||[],
  }));
}
export function snapshotMessage(room: StoredRoom, role = "student", projectedState = publicSnapshot(room.snapshot, room.fight), now = Date.now()) {
  const question = room.fight.questions[room.snapshot.currentQuestionIndex];
  const safe = { id:question.id,type:question.type,question:question.question,options:question.options,timeLimit:question.timeLimit,
    ...(answersRevealed(room.snapshot.currentPhase) ? {correctAnswer: question.correctAnswer} : {}),
  };
  if (room.fight.shuffleOptions && safe.options)
    safe.options = deterministicShuffle(
      safe.options,
      `${room.snapshot.sessionId}:${room.snapshot.round}`,
    );
  return {
    type: "combat_state",
    rejoinRequests: role === "teacher" ? Object.entries(room.removals || {}).filter(([, r]) => r.requestedAt && !r.blocked).map(([studentId, r]) => ({ studentId, nickname: r.nickname })) : undefined,
    state: projectedState,
    question: [
      "question",
      "answer_feedback",
      "actions",
      "abilities",
      "question_resolution",
      "enemy_ai",
    ].includes(room.snapshot.currentPhase)
      ? safe
      : null,
    serverTime: now,
    results: publicResults(room),
  };
}
