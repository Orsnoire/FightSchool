import { useEffect, useRef, useState } from "react";
import type { CombatSnapshot } from "@shared/combat/model";
import { playbackCues, type PlaybackCue } from "@shared/combat/presentation";
export function useCombatPlayback(
  state: CombatSnapshot,
  onComplete?: (batchId: string) => void,
) {
  const batch = ["question_resolution", "enemy_ai"].includes(state.currentPhase)
      ? state.playback
      : undefined,
    batchId = batch?.id;
  const [active, setActive] = useState<PlaybackCue[]>([]),
    [health, setHealth] = useState<Record<string, number>>({});
  const [renderedBatch, setRenderedBatch] = useState<string | undefined>(),
    [finished, setFinished] = useState(false);
  const current = useRef({ state, onComplete });
  current.current = { state, onComplete };
  const control = useRef<{
    id: string;
    pending: Set<string>;
    timers: ReturnType<typeof setTimeout>[];
    done: boolean;
  } | null>(null);
  const completed = useRef<string>();
  const finish = () => {
    const c = control.current;
    if (!c || c.done || c.pending.size) return;
    c.done = true;
    completed.current = c.id;
    setFinished(true);
    setActive([]);
    setHealth({});
  };
  const completeCue = (id: string) => {
    const c = control.current;
    if (!c) return;
    c.pending.delete(id);
    setActive((a) => a.filter((x) => x.event.id !== id));
    finish();
  };
  const impact = (cue: PlaybackCue) => {
    if (cue.event.healthAfter !== undefined)
      setHealth((h) => ({
        ...h,
        [cue.event.targetId]: cue.event.healthAfter!,
      }));
  };
  useEffect(() => {
    setActive([]);
    setHealth({});
    setRenderedBatch(batchId);
    setFinished(false);
    if (!batch) return;
    const cues = playbackCues(batch, current.current.state.events),
      c = {
        id: batch.id,
        pending: new Set(cues.map((x) => x.event.id)),
        timers: [] as ReturnType<typeof setTimeout>[],
        done: false,
      };
    control.current = c;
    setHealth({ ...batch.initialHealth });
    const skip = () => {
      if (
        document.hidden ||
        window.matchMedia?.("(prefers-reduced-motion: reduce)").matches
      ) {
        c.timers.forEach(clearTimeout);
        c.pending.clear();
        finish();
      }
    };
    document.addEventListener("visibilitychange", skip);
    if (completed.current === batch.id) {
      c.pending.clear();
      finish();
    } else {
      for (const cue of cues)
        c.timers.push(
          setTimeout(() => {
            if (c.done) return;
            setActive((a) => [...a, cue]);
            c.timers.push(
              setTimeout(() => {
                if (!c.done) impact(cue);
              }, cue.impactMs - cue.startMs),
            );
          }, cue.startMs),
        );
      skip();
      finish();
    }
    return () => {
      c.timers.forEach(clearTimeout);
      document.removeEventListener("visibilitychange", skip);
      if (control.current === c) control.current = null;
    };
  }, [batchId]);
  // Re-send a completed batch after a connection recovery; server acknowledgements are idempotent.
  useEffect(() => {
    if (
      finished &&
      batchId &&
      renderedBatch === batchId &&
      completed.current === batchId
    )
      onComplete?.(batchId);
  }, [onComplete, finished, batchId, renderedBatch]);
  const showing = !!batch && !(renderedBatch === batchId && finished);
  const hp = renderedBatch === batchId ? health : batch?.initialHealth || {};
  const display = showing
    ? {
        ...state,
        players: Object.fromEntries(
          Object.entries(state.players).map(([id, p]) => [
            id,
            hp[id] === undefined
              ? p
              : { ...p, health: hp[id], isDead: hp[id] <= 0 },
          ]),
        ),
        enemies: state.enemies.map((e) =>
          hp[e.id] === undefined ? e : { ...e, health: hp[e.id] },
        ),
      }
    : state;
  return {
    display,
    active: renderedBatch === batchId ? active : [],
    completeCue,
    showing,
  };
}
