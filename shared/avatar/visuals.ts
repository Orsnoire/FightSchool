import { z } from 'zod';
import { STARTER_EQUIPMENT } from '../equipment-catalog';
import { TIER_ONE_EQUIPMENT } from '../tier-one-equipment';
import type { EquipmentSlot } from '../equipment-slots';
export const VISUAL_BASES={...STARTER_EQUIPMENT,...TIER_ONE_EQUIPMENT};
const hex=z.string().regex(/^#[0-9a-fA-F]{6}$/);
export const paletteSchema=z.object({primary:hex.optional(),secondary:hex.optional(),accent:hex.optional()});
export type SpritePalette=z.infer<typeof paletteSchema>;
export const equipmentVisualSchema=z.object({baseItemId:z.string().refine(id=>Object.hasOwn(VISUAL_BASES,id),'Choose a registered base sprite'),palette:paletteSchema.default({})});
export type EquipmentVisual=z.infer<typeof equipmentVisualSchema>;
export type EquipmentVisuals=Partial<Record<EquipmentSlot,EquipmentVisual>>;
export function validVisualSlot(visual:EquipmentVisual|null|undefined,slot:string){return !visual||VISUAL_BASES[visual.baseItemId]?.slot===slot;}
const rgb=(hex:string)=>[1,3,5].map(x=>parseInt(hex.slice(x,x+2),16));
/** Shade-preserving channels: colored material, neutral metal/cloth, warm trim.
 * Reserved magenta skin pixels, ink, white highlights and transparency are untouched. */
export function recolorPixels(data:Uint8ClampedArray,palette:SpritePalette,preserveSkin=false) {
  const colors=Object.fromEntries(Object.entries(palette).filter(([,v])=>v).map(([k,v])=>[k,rgb(v!)]));
  for(let i=0;i<data.length;i+=4){
    if(!data[i+3])continue;
    const [r,g,b]=[data[i],data[i+1],data[i+2]],max=Math.max(r,g,b),min=Math.min(r,g,b);
    if(max<35||(min>240&&max-min<10))continue;
    if(preserveSkin&&g<Math.min(r,b)*.35&&r>30&&b>30&&r/b>.85&&r/b<1.18)continue;
    const channel=max-min<30?'secondary':r>g*1.12&&g>b*1.2?'accent':'primary';
    const color=colors[channel]||colors.primary;if(!color)continue;
    const shade=Math.min(1,max/210);
    for(let k=0;k<3;k++)data[i+k]=Math.round(color[k]*shade);
  }
}
