import type { SpritePalette } from './visuals';
import { recolorPixels } from './visuals';

/** Owner-approved Tier 2 colors, applied to the established armor silhouettes. */
export const TIER_TWO_PALETTES: Record<string, SpritePalette> = {
  soldier: { primary: '#c5cbd1', secondary: '#454a50', accent: '#c5cbd1' },
  ranger: { primary: '#4b633b', secondary: '#586247', accent: '#785538' },
  acolyte: { primary: '#3155c6', secondary: '#70418b', accent: '#70418b' },
  ascetic: { primary: '#494b50', secondary: '#f1f0e9', accent: '#494b50' },
};
export function tierTwoPalette(id: string | null | undefined) {
  return id?.startsWith('t2_') ? TIER_TWO_PALETTES[id.split('_')[1]] : undefined;
}
export function recolorEquipmentPixels(data: Uint8ClampedArray, width: number, palette: SpritePalette, ranger = false) {
  recolorPixels(data, palette, true);
  if (!ranger) return;
  // Deterministic olive/brown patches on green material only; preserve ink,
  // trim, highlights, exposed skin and alpha. Coordinates keep slot seams aligned.
  for (let i = 0; i < data.length; i += 4) {
    const r=data[i], g=data[i+1], b=data[i+2], a=data[i+3];
    if (!a || g < 35 || g < r * 1.18 || r < b * 1.1) continue;
    const x = (i / 4) % width, y = Math.floor(i / 4 / width);
    const cellX = Math.floor((x + (Math.floor(y / 13) % 3) * 7) / 29);
    const cellY = Math.floor(y / 23);
    const patch = ((Math.imul(cellX, 73856093) ^ Math.imul(cellY, 19349663)) >>> 0) % 7;
    const color = patch < 2 ? [105, 83, 52] : patch < 4 ? [53, 73, 44] : [75, 99, 59];
    const shade = Math.min(1, g / 99);
    for (let k = 0; k < 3; k++) data[i + k] = Math.round(color[k] * shade);
  }
}
