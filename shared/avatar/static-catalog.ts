export interface SpriteFit {
  /** Source-space polygon excludes neighboring atlas sprites. */
  polygon: number[][];
  /** Source-to-reference transform: x * scale + offsetX, y * scale + offsetY. */
  scale: number;
  offsetX: number;
  offsetY: number;
  /** Inner front collar edge in source coordinates: points and cubic Bézier segments. */
  neckline?: number[][];
}
export interface StarterFit { male: SpriteFit; female: SpriteFit; headwear: SpriteFit }
export const STATIC_FITS: Record<string, StarterFit> = {
  herbalist: {
    male: { polygon:[[0,160],[552,160],[552,950],[0,950]],scale:1.28,offsetX:120,offsetY:368, neckline:[[252,199],[250,215,275,226,292,230],[305,281],[319,230],[341,225,359,211,358,200]] },
    female: { polygon:[[564,180],[1105,180],[1105,950],[564,950]],scale:1.29,offsetX:-584,offsetY:344, neckline:[[793,215],[793,230,812,240,832,243],[842,282],[853,243],[878,237,894,225,895,216]] },
    headwear: { polygon:[[1120,200],[1536,200],[1536,510],[1120,510]],scale:1.65,offsetX:-1666,offsetY:-350 },
  },
  scout: {
    male: { polygon:[[20,55],[578,55],[578,990],[20,990]],scale:1.28,offsetX:128,offsetY:291, neckline:[[240,246],[239,266,262,282,286,287],[297,314],[310,287],[336,282,354,265,353,247]] },
    female: { polygon:[[590,55],[1125,55],[1125,990],[590,990]],scale:1.29,offsetX:-573,offsetY:275, neckline:[[784,257],[782,275,802,287,824,292],[835,318],[847,292],[873,286,895,273,895,258]] },
    headwear: { polygon:[[1132,115],[1536,115],[1536,465],[1132,465]],scale:1.7,offsetX:-1757,offsetY:-279 },
  },
  warrior: {
    male: { polygon: [[0,80],[565,80],[565,370],[597,430],[610,500],[620,570],[610,690],[580,790],[580,1000],[0,1000]], scale:1.4,offsetX:62,offsetY:174, neckline:[[275,310],[282,323,357,325,370,312]] },
    female: { polygon: [[580,80],[1125,80],[1125,1000],[650,1000],[650,800],[630,600],[624,480],[600,430],[590,350]], scale:1.43,offsetX:-728,offsetY:141, neckline:[[829,326],[837,338,895,339,907,327]] },
    headwear: { polygon:[[1130,360],[1536,360],[1536,860],[1130,860]],scale:1.74,offsetX:-1809,offsetY:-766 },
  },
  wizard: {
    male: { polygon:[[0,30],[580,30],[580,1010],[0,1010]],scale:1.4,offsetX:32,offsetY:118, neckline:[[295,349],[295,369,310,378,329,380],[339,411],[349,380],[370,377,382,364,382,349]] },
    female: { polygon:[[590,30],[1092,30],[1092,1010],[590,1010]],scale:1.43,offsetX:-723,offsetY:92, neckline:[[820,354],[820,369,834,378,853,380],[863,412],[873,380],[893,375,907,367,908,355]] },
    headwear: { polygon:[[1095,235],[1536,235],[1536,635],[1095,635]],scale:1.8,offsetX:-1850,offsetY:-750 },
  },
};

/** Rear flares sit behind the head; cheek plates and the brow band remain in front. */
export const HELMET_NECK_GUARD = [
  [[1130,675],[1177,675],[1181,728],[1194,785],[1130,803]],
  [[1470,675],[1536,675],[1536,803],[1452,785],[1468,728]],
];

/** Empty hands use the approved face-on rest pose, with armor-specific sleeves/gloves. */
export const EMPTY_BODY_FITS:Record<'plate'|'leather'|'linen',{male:SpriteFit;female:SpriteFit}> = Object.fromEntries(
  (['plate','leather','linen'] as const).map((armor,col)=>[armor,{
    male:{polygon:[[col*418,0],[(col+1)*418,0],[(col+1)*418,627],[col*418,627]],scale:1.75,offsetX:512-(210+col*418)*1.75,offsetY:446,
      neckline: armor==='plate'?[[175,95],[183,105,235,105,245,96]]:armor==='leather'?[[592,98],[594,115,607,122,619,123],[626,143],[633,123],[647,120,657,112,659,98]]:[[1001,96],[1001,109,1016,118,1030,119],[1036,146],[1044,119],[1060,116,1071,108,1070,96]]},
    female:{polygon:[[col*418,627],[(col+1)*418,627],[(col+1)*418,1254],[col*418,1254]],scale:1.76,offsetX:512-(210+col*418)*1.76,offsetY:-591,
      neckline: armor==='plate'?[[176,683],[184,693,235,693,244,684]]:armor==='leather'?[[593,680],[593,694,607,702,619,704],[626,727],[634,704],[648,701,658,693,659,680]]:[[1003,683],[1003,697,1016,707,1030,709],[1037,734],[1045,709],[1060,704,1072,696,1071,683]]},
  }])
) as Record<'plate'|'leather'|'linen',{male:SpriteFit;female:SpriteFit}>;
