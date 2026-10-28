import type { StoredRoom } from '../combat/room-state';

export interface ReleaseWindow { id: string; startedAt: number; resumedAt: number | null }
export interface ReleaseEnv { RELEASE_WINDOWS?: string; RELEASE_SHA?: string; RELEASE_PROBE?: string }
export interface ReleaseState { paused: boolean; valid: boolean; windows: ReleaseWindow[] }

/** Retain completed windows: a hibernating room may not wake up for several releases. */
export function releaseState(env: ReleaseEnv): ReleaseState {
  if (env.RELEASE_WINDOWS === undefined) return { paused: false, valid: true, windows: [] };
  try {
    const windows: ReleaseWindow[] = JSON.parse(env.RELEASE_WINDOWS);
    if (!Array.isArray(windows) || windows.length > 64) throw Error();
    const ids = new Set<string>();
    let previousEnd = 0;
    for (const [index, window] of windows.entries()) {
      if (!window || !/^[a-zA-Z0-9_-]{8,80}$/.test(window.id) || ids.has(window.id) ||
        !Number.isSafeInteger(window.startedAt) || window.startedAt <= 0 || window.startedAt < previousEnd ||
        (window.resumedAt !== null && (!Number.isSafeInteger(window.resumedAt) || window.resumedAt < window.startedAt)) ||
        (window.resumedAt === null && index !== windows.length - 1)) throw Error();
      ids.add(window.id); previousEnd = window.resumedAt ?? Infinity;
    }
    return { paused: windows.at(-1)?.resumedAt === null, valid: true, windows };
  } catch { return { paused: true, valid: false, windows: [] }; }
}

export function maintenanceResponse(): Response {
  return Response.json({ status: 'maintenance', error: 'QuestAcademy is being updated. Your progress is saved. Please reconnect shortly.' },
    { status: 503, headers: { 'Cache-Control': 'no-store', 'Retry-After': '30' } });
}

/** Caller persists this single room record before recovery, commands or reward retries. */
export function resumeRoomClocks(room: StoredRoom, windows: ReleaseWindow[]): boolean {
  const applied = new Set(room.releaseWindows || []);
  let changed = false;
  for (const window of windows) {
    if (window.resumedAt === null || applied.has(window.id)) continue;
    if (room.snapshot.currentPhase !== 'game_over' && room.snapshot.phaseStartTime < window.resumedAt) {
      const shift = window.resumedAt - Math.max(window.startedAt, room.snapshot.phaseStartTime);
      room.snapshot.phaseStartTime += shift;
      if (room.snapshot.phaseDeadline !== null) room.snapshot.phaseDeadline += shift;
      if (room.snapshot.questionStartTime !== null) room.snapshot.questionStartTime += shift;
      if (room.playbackGate) room.playbackGate.recoveryAt += shift;
    }
    applied.add(window.id); changed = true;
  }
  if (changed) room.releaseWindows = [...applied];
  return changed;
}
