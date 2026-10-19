import { z } from 'zod';
import type { CombatSnapshot, CombatPlayer, CombatEnemy } from '../combat/model';

const commandId = z.string().regex(/^[A-Za-z0-9_-]{8,100}$/);
const round = z.number().int().nonnegative();
const targetId = z.string().min(1).max(200);
const simple = <T extends string>(type: T) => z.object({ type:z.literal(type), commandId });
export const combatCommandSchema = z.discriminatedUnion('type', [
  simple('host'), simple('join'), simple('start_fight'), simple('end_fight'), simple('leave_fight'),
  simple('ready').extend({round}),
  simple('playback_complete').extend({round,batchId:z.string().min(1).max(240)}),
  simple('answer').extend({round,questionId:targetId,answer:z.string().max(5000)}),
  simple('action').extend({round,ability:z.string().min(1).max(200),targetId,ready:z.boolean().optional()}),
  simple('resurrect').extend({round,targetId}),
  simple('eliminate_enemy').extend({round,targetId:z.string().min(1).max(220)}),
  simple('next_wave').extend({round,phase:z.enum(['question','answer_feedback','actions','abilities','question_resolution','enemy_ai','wave_break'])}),
  simple('remove_player').extend({targetId}),
  simple('review_rejoin').extend({targetId,decision:z.enum(['allow','deny','block'])}),
]);
export type CombatCommand = z.infer<typeof combatCommandSchema>;
export type CombatCommandType = CombatCommand['type'];
export type CommandPayload<T extends CombatCommandType> = Omit<Extract<CombatCommand,{type:T}>, 'type'|'commandId'|'round'>;
// Explicit top-level allowlists. New internal fields are private by default.
export const snapshotFields = ['schemaVersion','revision','sessionId','fightId','enemyDisplayMode','currentQuestionIndex','round','currentPhase','questionStartTime','phaseStartTime','phaseDeadline','threatLeaderId','damageLeaderId','victory','endReason','encounterRules','activeWave','autoAdvanceWaves','completedRounds','endedByHost'] as const;
export const playerFields = ['studentId','nickname','characterClass','gender','health','maxHealth','mp','maxMp','comboPoints','maxComboPoints','consecutiveCorrectAnswers','threat','isDead','hasAnswered','ready','healingPotions','shieldPotions','joinOrder','limitTier','roundsParticipated','recoveryCorrectAnswers','controlImmuneThroughRound'] as const;
export const enemyFields = ['id','name','image','difficultyMultiplier','health','maxHealth','enemyType','attackPower','defense','magicDefense','role','templateId','quantity','wave','species'] as const;
export type PublicCombatPlayer = Pick<CombatPlayer,typeof playerFields[number] | 'statuses' | 'actionBlocked' | 'equipmentVisuals' | 'equipmentLoadout' | 'equipmentEffects' | 'appearance' | 'stats' | 'jobLevels' | 'availableAbilities' | 'questionAction' | 'supportActions' | 'cooldowns' | 'ultimatesUsed' | 'buffs' | 'totals'> & {currentAnswer:null;lastAnswerCorrect?:boolean;answerOutcome?:import('../combat/answer-feedback').AnswerOutcome};
export type PublicCombatEnemy = Pick<CombatEnemy,typeof enemyFields[number] | 'palette' | 'effects' | 'aiState'>;
export type PublicCombatSnapshot = Pick<CombatSnapshot,typeof snapshotFields[number] | 'events' | 'playback'> & {seed:0;players:Record<string,PublicCombatPlayer>;pendingPlayers:Record<string,PublicCombatPlayer>;enemies:PublicCombatEnemy[]};

export interface EarnedResult {
  id:string;studentId:string;xpEarned:number;baseXp?:number;xpMultiplier?:number;
  staminaFightNumber?:number|null;goldReward:number;lootTable:Array<{itemId:string}>;
}
export type CombatServerMessage =
  | {type:'combat_state';state:PublicCombatSnapshot;question:import('../combat/model').PublicQuestion|null;serverTime:number;results?:EarnedResult[];rejoinRequests?:Array<{studentId:string;nickname:string}>}
  | {type:'session_created';state:PublicCombatSnapshot;sessionId?:string;rejoinRequests?:Array<{studentId:string;nickname:string}>}
  | {type:'fight_removed';sessionId:string}
  | {type:'join_status';sessionId:string;status:'pending'|'denied'|'blocked'|'ended'}
  | {type:'fight_left';sessionId:string;commandId:string}
  | {type:'command_ack';commandId:string;revision:number}
  | {type:'protocol_error';commandId?:string;error:string}
  | {type:'game_over';victory:boolean|null;message:string|null;results?:EarnedResult[]}
  | {type:'result_pending';message:string};
