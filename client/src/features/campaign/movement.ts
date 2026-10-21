import { campaignPath, campaignStep, MAX_CAMPAIGN_PATH, type CampaignStep } from '../../../../shared/campaign/movement';
import type { CampaignView } from '../../../../shared/campaign/model';

type Snapshot = { view?: CampaignView; busy: boolean; moving: boolean; recovering: boolean; error: string };
type Options = {
  send: (revision: number, action: Record<string, unknown>) => Promise<CampaignView>;
  read: () => Promise<CampaignView>;
  cancelPoll: () => Promise<unknown>;
  committed: (view: CampaignView) => void;
  encounter: (sessionId: string) => void;
};

/** Bounded local prediction; every committed step still passes through the server. */
export function createCampaignController(options: Options) {
  let state: Snapshot = { busy: false, moving: false, recovering: false, error: '' };
  let confirmed: CampaignView | undefined, queue: CampaignStep[] = [], outstanding = 0;
  let predictedEncounter = false, active = true;
  const listeners = new Set<() => void>();
  const publish = (patch: Partial<Snapshot>) => {
    state = { ...state, ...patch };
    if (active) listeners.forEach(fn => fn());
  };
  const accept = (view: CampaignView) => { confirmed = view; options.committed(view); };
  async function recover(error: unknown) {
    queue = []; outstanding = 0; predictedEncounter = false;
    publish({ view: confirmed, recovering: true, error: (error as Error).message });
    try {
      const fresh = await options.read();
      if (!active) return;
      accept(fresh); publish({ view: fresh, recovering: false });
      if (fresh.progress.activeSessionId) options.encounter(fresh.progress.activeSessionId);
    } catch {
      publish({ error: 'Connection lost. Reconnecting before you continue…' });
    }
  }
  async function flush() {
    publish({ busy: true, moving: true });
    try {
      await options.cancelPoll();
      while (active && queue.length && confirmed) {
        const steps = queue.splice(0, MAX_CAMPAIGN_PATH);
        const next = await options.send(confirmed.progressRevision, { type: 'move_path', steps });
        if (!active) return;
        outstanding -= steps.length;
        accept(next);
        if (next.progress.activeSessionId) {
          queue = []; outstanding = 0; publish({ view: next });
          options.encounter(next.progress.activeSessionId); break;
        }
        // Rebase unsent inputs on confirmed state; a server correction wins.
        const projected = queue.length ? campaignPath(next, next.progress, queue) : { progress: next.progress, encounter: false };
        predictedEncounter = projected.encounter;
        publish({ view: { ...next, progress: projected.progress } });
      }
    } catch (error) { if (active) await recover(error); }
    finally { publish({ busy: false, moving: false }); }
  }
  return {
    subscribe(fn: () => void) { listeners.add(fn); return () => { listeners.delete(fn); }; },
    getSnapshot: () => state,
    attach() { active = true; return () => { active = false; queue = []; }; },
    observe(view?: CampaignView) {
      if (!view || state.busy || (confirmed && (view.progressRevision < confirmed.progressRevision || view.revision < confirmed.revision))) return;
      confirmed = view; publish({ view, recovering: false });
    },
    move(step: CampaignStep) {
      if (!active || !state.view || state.recovering || (state.busy && !state.moving) || predictedEncounter || outstanding >= MAX_CAMPAIGN_PATH) return;
      try {
        const result = campaignStep(state.view, state.view.progress, step);
        predictedEncounter = result.encounter; queue.push(step); outstanding++;
        publish({ view: { ...state.view, progress: result.progress }, error: '' });
        if (!state.busy) void flush();
      } catch (error) { publish({ error: (error as Error).message }); }
    },
    async act(action: Record<string, unknown>) {
      if (!active || !confirmed || state.busy || state.recovering || confirmed.progress.activeSessionId) return;
      publish({ busy: true, error: '' });
      try {
        await options.cancelPoll();
        const next = await options.send(confirmed.progressRevision, action);
        if (!active) return;
        accept(next); predictedEncounter = false; publish({ view: next });
        if (next.progress.activeSessionId) options.encounter(next.progress.activeSessionId);
      } catch (error) { if (active) await recover(error); }
      finally { publish({ busy: false }); }
    },
  };
}
