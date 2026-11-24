export function deterministicShuffle<T>(values: T[], salt: string): T[] {
  const result = [...values];
  let seed = 2166136261;
  for (const c of salt)
    seed = Math.imul(seed ^ c.charCodeAt(0), 16777619) >>> 0;
  for (let i = result.length - 1; i > 0; i--) {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    const j = seed % (i + 1);
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}
