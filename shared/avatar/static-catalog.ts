export interface SpriteFit {
  /** Source-space polygon excludes neighboring atlas sprites. */
  polygon: number[][];
  /** Source-to-reference transform: x * scale + offsetX, y * scale + offsetY. */
  scale: number;
  offsetX: number;
  offsetY: number;
}
export interface StarterFit { male: SpriteFit; female: SpriteFit; headwear: SpriteFit }
export const STATIC_FITS: Record<string, StarterFit> = {
  herbalist: {
    male: { polygon:[[0,160],[552,160],[552,950],[0,950]],scale:1.28,offsetX:120,offsetY:368 },
    female: { polygon:[[564,180],[1105,180],[1105,950],[564,950]],scale:1.29,offsetX:-584,offsetY:344 },
    headwear: { polygon:[[1120,200],[1536,200],[1536,510],[1120,510]],scale:1.65,offsetX:-1666,offsetY:-350 },
  },
  scout: {
    male: { polygon:[[20,55],[578,55],[578,990],[20,990]],scale:1.28,offsetX:128,offsetY:291 },
    female: { polygon:[[590,55],[1125,55],[1125,990],[590,990]],scale:1.29,offsetX:-573,offsetY:275 },
    headwear: { polygon:[[1132,115],[1536,115],[1536,465],[1132,465]],scale:1.7,offsetX:-1757,offsetY:-465 },
  },
  warrior: {
    male: { polygon: [[0,80],[565,80],[565,370],[597,430],[610,500],[620,570],[610,690],[580,790],[580,1000],[0,1000]], scale:1.4,offsetX:62,offsetY:174 },
    female: { polygon: [[580,80],[1125,80],[1125,1000],[650,1000],[650,800],[630,600],[624,480],[600,430],[590,350]], scale:1.43,offsetX:-714,offsetY:141 },
    headwear: { polygon:[[1130,360],[1536,360],[1536,860],[1130,860]],scale:1.74,offsetX:-1809,offsetY:-872 },
  },
  wizard: {
    male: { polygon:[[0,30],[580,30],[580,1010],[0,1010]],scale:1.4,offsetX:32,offsetY:118 },
    female: { polygon:[[590,30],[1092,30],[1092,1010],[590,1010]],scale:1.43,offsetX:-739,offsetY:92 },
    headwear: { polygon:[[1095,235],[1536,235],[1536,635],[1095,635]],scale:1.8,offsetX:-1850,offsetY:-750 },
  },
};
