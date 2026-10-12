import { queryOptions } from '@tanstack/react-query';
import type { Fight, Guild } from '@shared/schema';
import { apiRequest } from './queryClient';
export interface HostedSession {sessionId:string;fightId:string;status:string;guildId?:string|null}
export interface LeaderboardEntry {studentId:string;nickname:string;characterClass:string;totalDamageDealt:number;fightsCompleted:number}
// Cache identity and request URL are separate: parameters never become path segments.
function query<T>(queryKey:readonly unknown[],url:string) {
  return queryOptions({queryKey,queryFn:async ():Promise<T> => (await apiRequest('GET',url)).json()});
}
export const apiQueries={
  teacherFights:(id:string)=>query<Fight[]>([`/api/teacher/${id}/fights`],`/api/teacher/${encodeURIComponent(id)}/fights`),
  hostedSessions:(teacherId:string)=>query<HostedSession[]>(['/api/fights/hosted-sessions',teacherId],'/api/fights/hosted-sessions'),
  guild:(id:string)=>query<Guild>([`/api/guilds/${id}`],`/api/guilds/${encodeURIComponent(id)}`),
  leaderboard:(id:string,metric:string)=>query<LeaderboardEntry[]>([`/api/guilds/${id}/leaderboard`,metric],`/api/guilds/${encodeURIComponent(id)}/leaderboard?${new URLSearchParams({metric})}`),
};
