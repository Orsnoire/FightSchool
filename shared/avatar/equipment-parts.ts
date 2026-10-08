import type { EquipmentSlot } from '../equipment-slots';
import type { ArmorStyle } from './equipment-visuals';
export type Polygon = number[][];
/** Source-space partitions of the approved empty-handed atlas. Each slot owns both sides. */
const leftArm:Polygon=[[0,65],[150,65],[143,172],[129,220],[104,274],[85,302],[0,284]];
const rightArm=leftArm.map(([x,y])=>[418-x,y]);
export function armorSource(style:ArmorStyle) {
  const material=style==='fighter'?'plate':style==='forester'?'leather':['healer','caster'].includes(style)?'linen':style;
  return {material:material as 'plate'|'leather'|'linen',column:material==='plate'?0:material==='leather'?1:2,
    atlas:style==='caster'?'tier-one-caster':['fighter','forester','healer'].includes(style)?'tier-one-outfits':'empty-bodies'};
}
export function partRegions(slot:EquipmentSlot, material:'plate'|'leather'|'linen'):Polygon[] {
  if(slot==='arms')return [leftArm,rightArm];
  if(slot==='hands')return [[[0,284],[85,302],[95,395],[0,395]],[[418,284],[333,302],[323,395],[418,395]]];
  if(slot==='legs')return [[[85,335],[333,335],[333,545],[85,545]]];
  if(slot==='feet')return [[[0,535],[418,535],[418,627],[0,627]]];
  // The robe covers the legs; its central opening reveals the independently selected pants.
  return [material==='linen'
    ? [[150,65],[268,65],[275,172],[289,220],[314,274],[329,335],[370,535],[238,535],[211,278],[173,535],[48,535],[89,335],[104,274],[129,220],[143,172]]
    : [[150,65],[268,65],[275,172],[289,220],[314,274],[333,390],[85,390],[104,274],[129,220],[143,172]]];
}
/** Atlas bounds measured from generated output; never assume generation kept equal cells. */
export const PROP_SPRITES:Record<string,{box:[number,number,number,number];grip:[number,number];height:number;side?:'left'|'back'}>={
 sword:{box:[84,40,158,295],grip:[80,232],height:570},
 'two-handed-sword':{box:[389,0,164,346],grip:[81,291],height:870},
 staff:{box:[730,8,118,339],grip:[60,240],height:1040},
 wand:{box:[1064,60,80,279],grip:[40,212],height:440},
 ankh:{box:[79,355,171,308],grip:[85,220],height:470},
 bow:{box:[408,348,124,325],grip:[29,163],height:950,side:'left'},
 shield:{box:[682,350,211,318],grip:[105,159],height:540,side:'left'},
 quiver:{box:[1034,350,153,319],grip:[76,159],height:590,side:'back'},
 herbs:{box:[50,678,238,272],grip:[148,220],height:300},
 potion:{box:[375,705,184,243],grip:[92,85],height:250,side:'left'},
 spellbook:{box:[623,700,337,246],grip:[260,135],height:330,side:'left'},
 harp:{box:[1037,673,169,280],grip:[65,85],height:520},
 claws:{box:[57,972,214,260],grip:[115,45],height:295},
 spoon:{box:[416,957,100,278],grip:[38,203],height:480},
 fist:{box:[625,1018,326,199],grip:[82,80],height:180},
 'blue-shield':{box:[1007,957,205,281],grip:[102,140],height:540,side:'left'},
};
