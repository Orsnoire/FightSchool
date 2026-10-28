import { ACTIVITY_IDLE_MS, ACTIVITY_SAMPLE_MS } from '@shared/contracts/player-activity';
/** Monotonic browser time; only complete, continuously visible samples qualify. */
export class ActivitySampler {
  private lastInput: number;
  private activeSince: number;
  private lastTick: number;
  constructor(now: number, private visible: boolean) {
    this.lastInput = now;
    this.activeSince = now;
    this.lastTick = now;
  }
  interact(now: number) {
    if (!this.visible) return;
    if (now - this.lastInput >= ACTIVITY_IDLE_MS) this.activeSince = now;
    this.lastInput = now;
  }
  visibility(visible: boolean, now: number) {
    this.visible = visible;
    this.activeSince = now;
    this.lastTick = now;
    if (visible) this.lastInput = now;
  }
  sample(now: number): boolean {
    const gap = now - this.lastTick;
    this.lastTick = now;
    // Background throttling, suspended machines and clock jumps never backfill time.
    if (gap > ACTIVITY_SAMPLE_MS * 1.5 || gap < 0) {
      this.activeSince = now;
      return false;
    }
    if (!this.visible || now - this.lastInput >= ACTIVITY_IDLE_MS) {
      this.activeSince = now;
      return false;
    }
    if (now - this.activeSince < ACTIVITY_SAMPLE_MS) return false;
    // Retain sub-sample time so small timer jitter cannot repeatedly discard half the playtime.
    this.activeSince += ACTIVITY_SAMPLE_MS;
    return true;
  }
}
