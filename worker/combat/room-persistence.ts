import { createPlaybackGate } from "./playback-gate";
import { isResolution } from "../../shared/combat/presentation";
import { reportingSignature } from "../db/session-reporting";
import { diagnostic } from "../diagnostics";
import { CombatRuleError } from "../../shared/combat/errors";
import type { IdentityRepository } from "../db/repository";
import type { StoredRoom } from "./room-state";

export interface SaveEffects {
  repository: Pick<IdentityRepository, 'recordSessionReporting' | 'recordQuestEvidence'> | null;
  checkpoint(room: StoredRoom): Promise<void>;
  syncAlarm(room: StoredRoom): Promise<void>;
  activeRenderers(room: StoredRoom): string[];
}
/** The durable snapshot is the outbox. Always checkpoint before optional SQL effects. */
export async function saveRoom(room: StoredRoom, effects: SaveEffects, flushReporting = false) {
  if(!isResolution(room.snapshot.currentPhase))delete room.snapshot.playback;
  if(!isResolution(room.snapshot.currentPhase)||!room.snapshot.playback)delete room.playbackGate;
  else if(room.playbackGate?.batchId!==room.snapshot.playback.id)room.playbackGate=createPlaybackGate(room.snapshot,effects.activeRenderers(room));
  await effects.checkpoint(room);
  const reportKey = reportingSignature(room.snapshot);
  // Answers are durably checkpointed above. Drain their outbox when the question
  // closes, instead of repeating whole-roster SQL writes for every answer in a
  // classroom burst. Membership/status changes still project immediately;
  // alarms explicitly flush retries, including after object restoration.
  const reportingChanged = reportKey !== room.reportingSignature;
  const canFlushAttempts = flushReporting || room.snapshot.currentPhase !== "question";
  if (effects.repository?.recordSessionReporting && (reportingChanged || (canFlushAttempts && (room.reportingPending || room.snapshot.pendingAttempts?.length)))) {
    try {
      await effects.repository.recordSessionReporting(room.snapshot, room.fight);
      room.reportingSignature = reportKey;
      room.reportingPending = false;
      room.snapshot.pendingAttempts = [];
    } catch { room.reportingPending = true; }
    await effects.checkpoint(room);
    if (room.reportingPending) await effects.syncAlarm(room);
  }
  const entries=Object.values({...room.snapshot.departedPlayers,...room.snapshot.pendingPlayers,...room.snapshot.players}).filter(p=>p.questGuildId&&p.totals.questionsAnswered>0);
  const signature=JSON.stringify([room.snapshot.victory,entries.map(p=>[p.studentId,p.totals.questionsAnswered,p.totals.questionsCorrect,!!room.snapshot.players[p.studentId]])]);
  if(effects.repository?.recordQuestEvidence && entries.length && (signature!==room.evidenceSignature||room.evidencePending)){
    if(!canFlushAttempts){
      // The durable snapshot is the evidence outbox. Batch a classroom question,
      // but arm recovery even if the room hibernates before its final answer.
      room.evidencePending=true;
      await effects.checkpoint(room);
      await effects.syncAlarm(room);
      return;
    }
    const evidenceStartedAt=performance.now();
    try {await effects.repository.recordQuestEvidence(room.snapshot,room.fight);room.evidenceSignature=signature;room.evidencePending=false;diagnostic({event:'combat_evidence',roomId:room.snapshot.sessionId,revision:room.snapshot.revision,durationMs:performance.now()-evidenceStartedAt,outcome:'ok'});}
    catch {room.evidencePending=true;diagnostic({event:'combat_evidence',roomId:room.snapshot.sessionId,revision:room.snapshot.revision,durationMs:performance.now()-evidenceStartedAt,outcome:'retry'});}
    await effects.checkpoint(room);
    if(room.evidencePending)await effects.syncAlarm(room);
  }
}

/** Earliest phase/playback deadline or outbox/result retry; no independent scheduler. */
export function roomAlarmAt(room: StoredRoom, now = Date.now()): number | null {
  const retry = room.reportingPending || room.evidencePending || (room.snapshot.currentPhase === 'game_over' && !room.resultsPersisted) ? now + 5000 : Infinity;
  const deadline = Math.min(room.snapshot.phaseDeadline || Infinity, room.playbackGate?.recoveryAt || Infinity, retry);
  return Number.isFinite(deadline) ? deadline : null;
}

export interface CompletionEffects {
  repository: Pick<IdentityRepository, 'persistResults'> | null;
  save(room: StoredRoom): Promise<void>;
  syncAlarm(room: StoredRoom): Promise<void>;
  publish(room: StoredRoom): Promise<void>;
  scheduleRetry(): Promise<void>;
  broadcast(message: unknown): void;
}
/** SQL receipts make retry safe even when SQL succeeds and the following checkpoint fails. */
export async function completeRoom(room: StoredRoom, effects: CompletionEffects) {
  try {
    if (!room.resultsPersisted) {
      if (!effects.repository?.persistResults)
        throw new CombatRuleError("Result persistence unavailable");
      room.results = await effects.repository.persistResults(
        room.snapshot,
        room.fight,
      );
      room.resultsPersisted = true;
      await effects.save(room);
    }
    await effects.syncAlarm(room);
    await effects.publish(room);
  } catch (error) {
    diagnostic({event:'combat_results',roomId:room.snapshot.sessionId,revision:room.snapshot.revision,outcome:'retry'});
    await effects.scheduleRetry();
    effects.broadcast({
      type: "result_pending",
      message:
        "Fight complete. Saving results; reconnect to see your rewards.",
    });
  }
}
