/** Canvas backing estimates are RGBA bytes, not browser heap/GPU measurements. */
export const AVATAR_CACHE_BYTES = 32 * 1024 * 1024;
export interface AvatarSurface { width: number; height: number }
const WIDTH = 1200, HEIGHT = 1950;

/** Fit the artwork inside its CSS box, then cover device pixels in small buckets. */
export function avatarSurface(width: number, height: number, dpr = 1): AvatarSurface | null {
  if (![width, height, dpr].every(Number.isFinite) || width <= 0 || height <= 0 || dpr <= 0) return null;
  const scale = Math.min(width / WIDTH, height / HEIGHT) * dpr;
  const backingWidth = Math.min(WIDTH, Math.max(8, Math.ceil(WIDTH * scale / 8) * 8));
  return { width: backingWidth, height: Math.ceil(backingWidth * HEIGHT / WIDTH) };
}

/** Ready entries only. In-flight deduplication is separate and owns no cached bytes. */
export class ByteLru<T> {
  private entries = new Map<string, { value:T; bytes:number }>();
  bytes = 0;
  constructor(readonly limit: number, readonly maxEntries = 256) {}
  get size() { return this.entries.size; }
  get(key: string) {
    const entry = this.entries.get(key);
    if (!entry) return undefined;
    this.entries.delete(key); this.entries.set(key, entry);
    return entry.value;
  }
  set(key: string, value: T, bytes: number) {
    const previous = this.entries.get(key);
    if (previous) { this.bytes -= previous.bytes; this.entries.delete(key); }
    if (!Number.isFinite(bytes) || bytes <= 0 || bytes > this.limit) return;
    while (this.bytes + bytes > this.limit || this.entries.size >= this.maxEntries) {
      const oldest = this.entries.keys().next().value;
      if (oldest === undefined) break;
      this.bytes -= this.entries.get(oldest)!.bytes; this.entries.delete(oldest);
    }
    this.entries.set(key, {value, bytes}); this.bytes += bytes;
  }
}

/** Object insertion order must not invalidate an otherwise identical appearance. */
export function stableVisualKey(value: unknown): string {
  return JSON.stringify(value, (_key, item) => item && typeof item === 'object' && !Array.isArray(item)
    ? Object.fromEntries(Object.keys(item).sort().map(key => [key, item[key]])) : item);
}
