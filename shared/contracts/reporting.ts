import { z } from 'zod';
import { ALL_CHARACTER_CLASSES } from '../schema';
export const reportQuerySchema = z.object({
  view:z.enum(['sessions','players','questions']).default('sessions'),
  search:z.string().trim().max(200).default(''),
  guildId:z.string().uuid().optional(), sessionId:z.string().min(1).max(100).optional(),
  quizId:z.string().uuid().optional(), questionId:z.string().min(1).max(200).optional(),
  playerId:z.string().uuid().optional(), job:z.enum(ALL_CHARACTER_CLASSES as [string,...string[]]).optional(),
  from:z.coerce.number().int().nonnegative().optional(), to:z.coerce.number().int().nonnegative().optional(),
  page:z.coerce.number().int().min(1).max(100000).default(1),
  pageSize:z.coerce.number().int().min(1).max(100).default(25),
  sort:z.enum(['recent','accuracy','name']).default('recent'),
});
export interface ReportRow {
  sessionId:string; studentId?:string; nickname?:string; quizTitle:string; guildName?:string;
  job?:string; status?:string; startedAt:number; players?:number;
  correct:number; incorrect:number; unanswered:number|null; attempts:number; recordedAttempts:number;
  damage:number; healing:number; blocked:number; deaths:number; xp:number; gold:number;
  victory?:boolean|null; survived?:boolean; round?:number; questionId?:string; questionVersion?:string;
  question?:import('../combat/model').PublicQuestion & {correctAnswer:string}; outcome?:string;
}
export interface SessionReport {
  rows:ReportRow[]; total:number; page:number; pageSize:number;
  summary:{sessions:number;players:number;correct:number;attempts:number;recordedAttempts:number;historicalParticipants:number};
  facets:{guilds:Array<{id:string;name:string}>;quizzes:Array<{id:string;name:string}>};
}
