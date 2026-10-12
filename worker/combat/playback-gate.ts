import {
  isResolution,
  playbackDuration,
} from "../../shared/combat/presentation";
import type { CombatSnapshot } from "../../shared/combat/model";
export interface PlaybackGate {
  batchId: string;
  pending: string[];
  recoveryAt: number;
}
export function rendererKey(role: string, actorId: string) {
  return `${role}:${actorId}`;
}
export function createPlaybackGate(
  snapshot: CombatSnapshot,
  renderers: string[],
  now = Date.now(),
): PlaybackGate | undefined {
  const batch = snapshot.playback;
  if (!isResolution(snapshot.currentPhase) || !batch) return;
  return {
    batchId: batch.id,
    pending: [...new Set(renderers)],
    recoveryAt:
      now + Math.max(8000, playbackDuration(batch, snapshot.events) * 3 + 5000),
  };
}
export function acknowledgePlayback(
  gate: PlaybackGate,
  batchId: string,
  renderer: string,
) {
  if (gate.batchId !== batchId) return false;
  gate.pending = gate.pending.filter((key) => key !== renderer);
  return true;
}
