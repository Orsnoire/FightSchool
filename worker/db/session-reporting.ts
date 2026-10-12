import { sql } from 'drizzle-orm';
import type { CombatSnapshot } from '../../shared/combat/model';
import type { FightRecord } from './schema';
import type { GameDatabase } from './game-repository';

export function reportingSignature(state: CombatSnapshot) {
  return JSON.stringify([state.currentPhase === 'game_over', state.victory,
    Object.values({...state.departedPlayers,...state.pendingPlayers,...state.players}).map(p =>
      [p.studentId,p.characterClass,p.questGuildId,p.isDead,p.totals,!!state.players[p.studentId]])]);
}
/** Repeated writes are safe after checkpoint/SQL interruptions; awards are never touched. */
export async function recordSessionReporting(db: GameDatabase, state: CombatSnapshot, fight: FightRecord) {
  const players = Object.values({...state.departedPlayers,...state.pendingPlayers,...state.players});
  const rows = players.map(p => ({ session:state.sessionId, student:p.studentId, teacher:fight.teacherId,
    fight:fight.id, guild:p.questGuildId || null, nickname:p.nickname, title:fight.title, job:p.characterClass,
    status:state.currentPhase === 'game_over' ? 'completed' : state.departedPlayers?.[p.studentId] && !state.players[p.studentId] ? 'left' : state.currentPhase === 'waiting' ? 'waiting' : 'active',
    victory:state.victory, survived:!p.isDead, totals:p.totals, revision:state.revision }));
  if(rows.length) await db.execute(sql`INSERT INTO session_participants(session_id,student_id,teacher_id,fight_id,guild_id,nickname,quiz_title,job,status,victory,survived,totals,revision,updated_at)
    SELECT x.session,x.student::uuid,x.teacher::uuid,x.fight::uuid,x.guild::uuid,x.nickname,x.title,x.job,x.status,x.victory,x.survived,x.totals,x.revision,${Date.now()}::bigint
    FROM jsonb_to_recordset(${JSON.stringify(rows)}::jsonb) AS x(session text,student text,teacher text,fight text,guild text,nickname text,title text,job text,status text,victory boolean,survived boolean,totals jsonb,revision integer)
    ON CONFLICT(session_id,student_id) DO UPDATE SET status=EXCLUDED.status,victory=EXCLUDED.victory,survived=EXCLUDED.survived,totals=EXCLUDED.totals,revision=EXCLUDED.revision,updated_at=EXCLUDED.updated_at
    WHERE EXCLUDED.revision>=session_participants.revision`);
  if(state.pendingAttempts?.length) await db.execute(sql`INSERT INTO question_attempts(session_id,student_id,round,teacher_id,fight_id,guild_id,job,question_id,question_version,question,outcome,recorded_at)
    SELECT ${state.sessionId},x."studentId"::uuid,x.round,${fight.teacherId}::uuid,${fight.id}::uuid,x."guildId"::uuid,x.job,x."questionId",x."questionVersion",x.question,x.outcome,${Date.now()}::bigint
    FROM jsonb_to_recordset(${JSON.stringify(state.pendingAttempts)}::jsonb) AS x("studentId" text,round integer,"guildId" text,job text,"questionId" text,"questionVersion" text,question jsonb,outcome text)
    ON CONFLICT(session_id,student_id,round) DO NOTHING`);
}
