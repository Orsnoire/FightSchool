import { appearanceColors, type AvatarAppearance, type AvatarJob } from './appearance';
import { avatarEquipment, armorStyle, headStyle, propStyle, ARMOR_RENDER_ORDER, type AvatarLoadout } from './equipment-visuals';
import { armorSource, partRegions, PROP_SPRITES } from './equipment-parts';
import type { EquipmentLoadout } from '../equipment-catalog';
import { STATIC_FITS, EMPTY_BODY_FITS, HELMET_NECK_GUARD, type SpriteFit } from './static-catalog';

export type StaticAssetUrls = Record<string, string>;
export const STATIC_CANVAS = { width: 1200, height: 1950, offsetX: 88, offsetY: 400 };
const imageCache = new Map<string, Promise<HTMLImageElement>>();
const composedCache = new Map<string, Promise<HTMLCanvasElement>>();
const assetSetIds = new WeakMap<StaticAssetUrls, number>();
let nextAssetSetId=1;
function image(url: string) {
  let result = imageCache.get(url);
  if (!result) {
    result = new Promise<HTMLImageElement>((resolve, reject) => {
      const img = new Image(); img.onload = () => resolve(img); img.onerror = () => reject(new Error('Avatar artwork could not load')); img.src = url;
    }); imageCache.set(url, result);
    result.catch(() => imageCache.delete(url));
  }
  return result;
}
function canvas(width: number, height: number) { const c = document.createElement('canvas'); c.width=width; c.height=height; return c; }
function rgb(hex: string) { return [1,3,5].map(x => parseInt(hex.slice(x,x+2),16)); }
async function tintedHead(urls: StaticAssetUrls, appearance: AvatarAppearance) {
  const prefix = appearance.modelId === 'human-male-v1' ? 'male' : 'female';
  const colors = appearanceColors(appearance);
  const [base,...masks] = await Promise.all(['neutral','hair','eyes','skin'].map(key => image(urls[`${prefix}-${key}`])));
  const c = canvas(base.width,base.height), ctx = c.getContext('2d', {willReadFrequently:true})!;
  ctx.drawImage(base,0,0); const pixels = ctx.getImageData(0,0,c.width,c.height);
  const scratch = canvas(c.width,c.height), s = scratch.getContext('2d',{willReadFrequently:true})!;
  for (let channel=0;channel<3;channel++) {
    s.clearRect(0,0,c.width,c.height);s.drawImage(masks[channel],0,0);
    const mask=s.getImageData(0,0,c.width,c.height).data, swatch=rgb(colors[(['hair','eyes','skin'] as const)[channel]]);
    for(let i=0;i<pixels.data.length;i+=4) if(mask[i]) for(let k=0;k<3;k++) pixels.data[i+k]=Math.round(pixels.data[i+k]*(1-mask[i]/255+mask[i]/255*swatch[k]/255));
  }
  ctx.putImageData(pixels,0,0);return c;
}
async function tintedAtlas(url: string, skin: string) {
  const img=await image(url), c=canvas(img.width,img.height),ctx=c.getContext('2d',{willReadFrequently:true})!;
  ctx.drawImage(img,0,0);const pixels=ctx.getImageData(0,0,c.width,c.height), color=rgb(skin);
  // Source art reserves magenta for exposed hands; garments and ink never use it.
  for(let i=0;i<pixels.data.length;i+=4) {
    const r=pixels.data[i],g=pixels.data[i+1],b=pixels.data[i+2];
    if(g<Math.min(r,b)*0.35 && r>30 && b>30 && r/b>0.85 && r/b<1.18) {
      const shade=Math.max(r,b)/255;
      for(let k=0;k<3;k++)pixels.data[i+k]=Math.round(color[k]*shade);
    }
  }
  ctx.putImageData(pixels,0,0);return c;
}
function polygon(ctx:CanvasRenderingContext2D, points:number[][]) {
  points.forEach(([x,y],i)=>i?ctx.lineTo(x,y):ctx.moveTo(x,y));ctx.closePath();
}
function sprite(ctx:CanvasRenderingContext2D, source:CanvasImageSource, fit:SpriteFit, exclusions:number[][][]=[] , frontCollar=false) {
  ctx.save();ctx.translate(fit.offsetX,fit.offsetY);ctx.scale(fit.scale,fit.scale);
  ctx.beginPath();polygon(ctx,fit.polygon);ctx.clip();
  if(exclusions.length || frontCollar) {
    ctx.beginPath();ctx.rect(-1,-1,2050,2050);
    for(const points of exclusions)polygon(ctx,points);
    if(frontCollar && fit.neckline) {
      const [start,...edge]=fit.neckline;
      ctx.moveTo(start[0],-1);ctx.lineTo(start[0],start[1]);
      for(const p of edge) {
        if(p.length===6)ctx.bezierCurveTo(p[0],p[1],p[2],p[3],p[4],p[5]);
        else ctx.lineTo(p[0],p[1]);
      }
      const end=edge[edge.length-1];ctx.lineTo(end[end.length-2],-1);ctx.closePath();
    }
    ctx.clip('evenodd');
  }
  ctx.drawImage(source,0,0);ctx.restore();
}

/** Palette changes happen at render time and retain the source ink/alpha. */
async function paletteImage(url:string, kind:string) {
  const source=await image(url);if(!kind)return source;
  const c=canvas(source.width,source.height),ctx=c.getContext('2d')!;
  ctx.drawImage(source,0,0);const pixels=ctx.getImageData(0,0,c.width,c.height),d=pixels.data;
  for(let i=0;i<d.length;i+=4) {
    const [r,g,b]=[d[i],d[i+1],d[i+2]];let color:number[]|undefined;
    if(kind==='red' && b>r*1.2 && b>g*1.05)color=[b*.95,g*.45,r*.7];
    if(kind==='green' && r>g*1.12 && g>b*1.08)color=[g*.65,r*.8,b*.7];
    if(kind==='violet' && b>g*1.18 && r>g*1.05)color=[Math.min(240,r*1.65),Math.min(210,g*1.65),Math.min(250,b*1.55)];
    if(kind==='brown' && (g>r*1.2 || b>g*1.2))color=[Math.max(r,g,b)*.8,Math.max(r,g,b)*.55,Math.max(r,g,b)*.3];
    // Linen pants/shoes share the starter garment silhouette, with separate cloth palettes.
    if(kind.startsWith('cloth:') && Math.max(r,g,b)>35) {
      const target=rgb(kind.slice(6)),shade=Math.min(1,(Math.max(r,g,b)+55)/145);
      color=target.map(v=>v*shade);
    }
    if(color)for(let k=0;k<3;k++)d[i+k]=Math.round(color[k]);
  }
  ctx.putImageData(pixels,0,0);return c;
}
async function equipmentBody(urls:StaticAssetUrls,appearance:AvatarAppearance,loadout:EquipmentLoadout) {
  const female=appearance.modelId==='human-female-v1',skin=appearanceColors(appearance).skin;
  const atlases=new Map<string,Promise<CanvasImageSource>>();
  const cached=(key:string,load:()=>Promise<CanvasImageSource>)=>{if(!atlases.has(key))atlases.set(key,load());return atlases.get(key)!;};
  const parts=await Promise.all(ARMOR_RENDER_ORDER.map(async slot=>{
    const style=armorStyle(loadout[slot]);let source=armorSource(style);
    const cloth=['linen','healer','caster'].includes(style);
    // Robe atlases conceal most pants: use the full starter trouser geometry underneath.
    if(slot==='legs'&&cloth)source=armorSource('leather');
    const fit=EMPTY_BODY_FITS[source.material][female?'female':'male'];
    const handColor=slot==='hands'&&loadout.hands&&style==='linen'?'#ded8cf':skin;
    let atlas:CanvasImageSource=await cached(`${source.atlas}:${handColor}`,()=>tintedAtlas(urls[source.atlas],handColor));
    if(cloth&&(slot==='legs'||(slot==='feet'&&style==='linen'))) {
      atlas=await paletteImage(urls[source.atlas],`cloth:${style==='caster'?'#644182':style==='healer'?'#f2eee6':'#cbc5ba'}`);
    }
    const regions=partRegions(slot,source.material).map(poly=>poly.map(([x,y])=>[x+source.column*418,y+(female?590:0)]));
    return {slot,atlas,fit,regions};
  }));
  return (ctx:CanvasRenderingContext2D,front=false)=>{
    for(const part of parts)for(const polygon of part.regions)
      sprite(ctx,part.atlas,{...part.fit,polygon},[],front&&part.slot==='armor');
  };
}
async function equipmentProps(urls:StaticAssetUrls,loadout:EquipmentLoadout) {
  const result=await Promise.all((['weapon','offhand'] as const).map(async slot=>{
    const id=loadout[slot];let kind:string|null=propStyle(id);if(!kind)return null;
    if(id==='t1_healer_ankh')kind='ankh';
    if(id==='basic_shield')kind='blue-shield';
    const geometry=PROP_SPRITES[kind!];if(!geometry)return null;
    const atlas=id==='basic_harp'?await image(urls['starter-harp']):
      id?.startsWith('basic_')&&['staff','bow','quiver'].includes(kind!)?await paletteImage(urls.props,'brown'):await image(urls.props);
    return {id,kind,geometry,atlas};
  }));
  return (ctx:CanvasRenderingContext2D,back=false)=>{
    for(const part of result) {
      if(!part||(part.geometry.side==='back')!==back)continue;
      const {geometry:g,atlas}=part;
      let [sx,sy,w,h]=g.box,[gx,gy]=g.grip;
      if(part.id==='basic_harp'){sx=300;sy=82;w=700;h=1090;gx=90;gy=560;}
      if(part.kind==='fist'){w=163;gx=82;}
      const scale=g.height/h;
      const x=back?315:g.side==='left'?835:195,y=back?720:1020;
      ctx.drawImage(atlas,sx,sy,w,h,x-gx*scale,y-gy*scale,w*scale,h*scale);
      if(part.kind==='fist')ctx.drawImage(atlas,sx+163,sy,w,h,835-gx*scale,y-gy*scale,w*scale,h*scale);
      if(part.kind==='bow') {
        ctx.save();ctx.strokeStyle='#302b24';ctx.lineWidth=3;ctx.beginPath();
        ctx.moveTo(x+52*scale,y-155*scale);ctx.lineTo(x+52*scale,y+149*scale);ctx.stroke();ctx.restore();
      }
    }
  };
}

/** Static rendering has no combat state, timers, persistence, or equipment grants. */
export function composeStaticAvatar(urls:StaticAssetUrls, appearance:AvatarAppearance, job:AvatarJob, loadout?:AvatarLoadout):Promise<HTMLCanvasElement> {
  if(!assetSetIds.has(urls))assetSetIds.set(urls,nextAssetSetId++);
  const equipment=avatarEquipment(job,loadout);
  const key=JSON.stringify([appearance,equipment,assetSetIds.get(urls)]);
  let result=composedCache.get(key);
  if(!result) {
    result=(async()=>{
      const visual={headwear:headStyle(equipment.headgear)},hatFit=visual.headwear?STATIC_FITS[visual.headwear].headwear:null;
      const tierOneHat=equipment.headgear?.startsWith('t1_');
      const [head,body,props,hat]=await Promise.all([tintedHead(urls,appearance),equipmentBody(urls,appearance,equipment),equipmentProps(urls,equipment),visual.headwear?paletteImage(urls[visual.headwear],tierOneHat?({warrior:'red',scout:'green',wizard:'violet',herbalist:''}[visual.headwear]):''):null]);
      const c=canvas(STATIC_CANVAS.width,STATIC_CANVAS.height),ctx=c.getContext('2d')!;
      ctx.translate(STATIC_CANVAS.offsetX,STATIC_CANVAS.offsetY);
      const isFemale=appearance.modelId==='human-female-v1';

      // Back collar first, then a continuous neck/upper torso, then the front lip.
      // The torso has no bottom ink line: it continues out of sight under clothing.
      props(ctx,true);body(ctx);
      const neck=head.getContext('2d')!.getImageData(512,isFemale?577:599,1,1).data;
      ctx.fillStyle=`rgb(${neck[0]},${neck[1]},${neck[2]})`;
      const join=isFemale?575:595,left=isFemale?471:467,right=isFemale?555:557;
      ctx.beginPath();ctx.moveTo(left,join-12);ctx.lineTo(right,join-12);
      ctx.bezierCurveTo(right,617,599,602,610,650);ctx.bezierCurveTo(634,740,586,783,512,783);
      ctx.bezierCurveTo(438,783,390,740,414,650);ctx.bezierCurveTo(425,602,left,617,left,join-12);ctx.closePath();ctx.fill();
      ctx.strokeStyle='#151310';ctx.lineWidth=6;ctx.lineCap='round';
      ctx.beginPath();ctx.moveTo(left,join-10);ctx.bezierCurveTo(left,617,425,602,414,650);
      ctx.moveTo(right,join-10);ctx.bezierCurveTo(right,617,599,602,610,650);ctx.stroke();
      body(ctx,true);props(ctx);
      if(hat&&hatFit&&visual.headwear==='warrior')for(const guard of HELMET_NECK_GUARD)sprite(ctx,hat,{...hatFit,polygon:guard});
      if(hat&&hatFit&&visual.headwear==='wizard') sprite(ctx,hat,hatFit); // Back brim sits behind hair.
      // Keep the face/hair intact; omit the old neckline and its closed bottom edge.
      ctx.save();ctx.beginPath();ctx.moveTo(0,0);ctx.lineTo(1024,0);ctx.lineTo(1024,isFemale?583:591);
      ctx.lineTo(564,isFemale?583:591);ctx.lineTo(564,join);ctx.lineTo(463,join);ctx.lineTo(463,isFemale?583:591);
      ctx.lineTo(0,isFemale?583:591);ctx.closePath();ctx.clip();
      // Closed headwear contains the crown hair. Keep the fringe and side hair below its band.
      if(visual.headwear==='scout' || visual.headwear==='warrior') {
        ctx.beginPath();ctx.moveTo(-100,450);
        if(visual.headwear==='scout') {
          ctx.lineTo(200,415);ctx.bezierCurveTo(290,310,444,203,570,199);ctx.bezierCurveTo(700,213,780,310,835,442);
        } else {
          ctx.lineTo(205,330);ctx.bezierCurveTo(350,280,670,280,810,330);ctx.lineTo(850,410);
        }
        ctx.lineTo(1124,450);ctx.lineTo(1124,800);ctx.lineTo(-100,800);ctx.closePath();ctx.clip();
      }
      ctx.drawImage(head,0,0);ctx.restore();
      if(hat&&hatFit)sprite(ctx,hat,visual.headwear==='wizard'?{...hatFit,polygon:[[1095,235],[1536,235],[1536,510],[1095,510]]}:hatFit,visual.headwear==='warrior'?HELMET_NECK_GUARD:[]);return c;
    })();
    composedCache.set(key,result);if(composedCache.size>8)composedCache.delete(composedCache.keys().next().value!);
    result.catch(()=>composedCache.delete(key));
  }
  return result;
}
