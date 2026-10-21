import { normalizeBag, normalizeProtections } from '../../shared/campaign/consumables';
import { equipmentVisualSchema, paletteSchema } from "../../shared/avatar/visuals";
import { answersRevealed, answerOutcome } from "../../shared/combat/answer-feedback";
import { playerFields, snapshotFields, enemyFields, type PublicCombatSnapshot, type PublicCombatPlayer } from '../../shared/contracts/combat';
import type { CombatSnapshot, CombatPlayer, CombatAction } from '../../shared/combat/model';
import { EQUIPMENT_SLOTS } from '../../shared/equipment-slots';
import { ALL_CHARACTER_CLASSES } from '../../shared/schema';
import type { FightRecord } from '../db/schema';
import { scaleEncounter } from './encounter-setup';

function pick<T, K extends keyof T>(value:T, keys:readonly K[]): Pick<T,K> {
  return Object.fromEntries(keys.filter(key=>value[key]!==undefined).map(key=>[key,value[key]])) as Pick<T,K>;
}
const action=(a:CombatAction)=>pick(a,['ability','targetId']);
function player(p:CombatPlayer, reveal:boolean):PublicCombatPlayer {
  return {
    ...pick(p,playerFields), currentAnswer:null,
    consumables: p.consumables ? normalizeBag(p.consumables) : undefined,
    itemProtections: p.itemProtections ? normalizeProtections(p.itemProtections) : undefined,
    lastAnswerCorrect:reveal?p.lastAnswerCorrect:undefined,
    answerOutcome:reveal?answerOutcome(p):undefined,
    statuses:p.statuses?.map(s=>({...pick(s,['type','sourceId','appliedRound','throughRound','amount','carry','chance','correctAnswers']),actionFailure:s.actionFailure?pick(s.actionFailure,['round','skip']):undefined})),
    actionBlocked:p.actionBlocked?pick(p.actionBlocked,['round','reason','attacksOnly']):undefined,
    equipmentLoadout:p.equipmentLoadout?pick(p.equipmentLoadout,EQUIPMENT_SLOTS):undefined,
    equipmentVisuals:p.equipmentVisuals?Object.fromEntries(EQUIPMENT_SLOTS.filter(slot=>p.equipmentVisuals?.[slot]).map(slot=>[slot,equipmentVisualSchema.parse(p.equipmentVisuals![slot])])):undefined,
    equipmentEffects:p.equipmentEffects?pick(p.equipmentEffects,['healingBonus','potionAttackBonus']):undefined,
    appearance:p.appearance?pick(p.appearance,['modelId','hairColorId','eyeColorId','skinColorId']):p.appearance,
    stats:pick(p.stats,['str','int','agi','mnd','vit','def','atk','mat','rtk','hp','maxHp','mp','maxMp','comboPoints','maxComboPoints']),
    jobLevels:pick(p.jobLevels,ALL_CHARACTER_CLASSES),
    availableAbilities:[...p.availableAbilities],questionAction:p.questionAction?action(p.questionAction):null,
    supportActions:p.supportActions.map(action), cooldowns:{...p.cooldowns},ultimatesUsed:[...p.ultimatesUsed],
    buffs:Object.fromEntries(Object.entries(p.buffs).map(([key,b])=>[key,pick(b,['rounds','amount'])])),
    totals:pick(p.totals,['questionsAnswered','questionsCorrect','questionsIncorrect','damageDealt','damageBlocked','healingDone','bonusDamage','damageTaken','deaths']),
  };
}
export function publicSnapshot(snapshot:CombatSnapshot,fight?:FightRecord):PublicCombatSnapshot {
  const preview=fight&&snapshot.currentPhase==='waiting'&&Object.keys(snapshot.players).length?scaleEncounter(snapshot,fight):snapshot;
  const enemies=preview.enemies;
  const reveal=answersRevealed(snapshot.currentPhase);
  return {
    ...pick(preview,snapshotFields),seed:0,
    ...(fight && snapshot.currentPhase === 'waiting' ? { encounterTier: preview.encounterTier || fight.encounterTier || 1 } : {}),
    playback:snapshot.playback?{...pick(snapshot.playback,['id','round','phase']),eventIds:[...snapshot.playback.eventIds],initialHealth:{...snapshot.playback.initialHealth}}:undefined,
    players:Object.fromEntries(Object.entries(snapshot.players).map(([id,p])=>[id,player(p,reveal)])),
    pendingPlayers:Object.fromEntries(Object.entries(snapshot.pendingPlayers||{}).map(([id,p])=>[id,player(p,false)])),
    enemies:enemies.map(e=>({...pick(e,enemyFields),palette:e.palette?paletteSchema.parse(e.palette):undefined,effects:e.effects.map(v=>pick(v,['ownerId','type','rounds','damage'])),aiState:e.aiState?{readyRounds:{},buffs:e.aiState.buffs.filter(b=>b.type!=='flatten').map(b=>pick(b,['type','throughRound']))}:undefined})),
    events:snapshot.events.map(e=>pick(e,['id','round','phase','type','actorId','targetId','amount','message','actionId','abilityId','effect','healthBefore','healthAfter'])),
  };
}
