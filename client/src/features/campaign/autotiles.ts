/** Cardinal N/E/S/W bits, then NE/SE/SW/NW. A diagonal only joins when both
 * adjoining cardinal neighbours join: 256 masks reduce to 47 blob tiles. */
export const NEIGHBOURS = [[0,-1],[1,0],[0,1],[-1,0],[1,-1],[1,1],[-1,1],[-1,-1]] as const;
export function canonicalMask(mask: number): number {
  return (mask & 15) | ([3,6,12,9].reduce((diagonals, pair, i) =>
    diagonals | ((mask & pair) === pair ? mask & (16 << i) : 0), 0));
}
export const BORDER_MASKS = [...new Set(Array.from({ length: 256 }, (_, mask) => canonicalMask(mask)))];
export function neighbourMask(x: number, y: number, joins: (x: number, y: number) => boolean): number {
  return canonicalMask(NEIGHBOURS.reduce((mask, [dx,dy], i) => mask | (joins(x+dx,y+dy) ? 1 << i : 0), 0));
}
// Four pixel-stepped 16px quarters make one 32px tile. Exact geometric edges
// keep the original textured artwork connected in every arrangement.
function quarter(a: boolean, b: boolean, diagonal: boolean) {
  if (a && b) return diagonal ? 'M0 0H16V16H0Z' : 'M4 0H16V16H0V4H2V2H4Z';
  if (a) return 'M4 0H16V16H4Z';
  if (b) return 'M0 4H16V16H0Z';
  return 'M8 4H16V16H4V8H6V6H8Z';
}
export function borderMaskSvg(mask: number): string {
  const n = !!(mask & 1), e = !!(mask & 2), s = !!(mask & 4), w = !!(mask & 8);
  return `<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32"><g fill="white"><path d="${quarter(n,w,!!(mask&128))}"/><path transform="translate(32 0) scale(-1 1)" d="${quarter(n,e,!!(mask&16))}"/><path transform="translate(32 32) scale(-1 -1)" d="${quarter(s,e,!!(mask&32))}"/><path transform="translate(0 32) scale(1 -1)" d="${quarter(s,w,!!(mask&64))}"/></g></svg>`;
}
export const BORDER_IMAGES = Object.fromEntries(BORDER_MASKS.map(mask => [mask,
  `url("data:image/svg+xml,${encodeURIComponent(borderMaskSvg(mask))}")`]));
