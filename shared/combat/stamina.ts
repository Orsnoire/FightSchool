// n is the number of completed combats today, across every job and play mode.
// Full first reward, 90% second reward, 1.1% after ten completions, asymptote 1%.
export const STAMINA_TIME_ZONE = "America/Denver";
const RATE = -Math.log(0.89 / 0.99);
const POWER = Math.log(Math.log(990) / RATE) / Math.log(10);
export function xpMultiplier(completedCombats: number): number {
  const n = Math.max(0, Math.floor(completedCombats));
  return 0.01 + 0.99 * Math.exp(-RATE * n ** POWER);
}
export function mountainDay(now: number | Date): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: STAMINA_TIME_ZONE, year: "numeric", month: "2-digit", day: "2-digit",
  }).formatToParts(now);
  return ["year", "month", "day"].map(key => parts.find(p => p.type === key)!.value).join("-");
}
export function nextMountainMidnight(now: number): number {
  const day = mountainDay(now);
  // Find the date boundary instead of adding 24h: Denver has 23h and 25h days.
  let low = now, high = now + 27 * 60 * 60 * 1000;
  while (high - low > 1) {
    const mid = Math.floor((low + high) / 2);
    if (mountainDay(mid) === day) low = mid;
    else high = mid;
  }
  return high;
}
export interface StaminaStatus {
  completedCombats: number;
  xpMultiplier: number;
  resetsAt: number;
  timeZone: string;
}
