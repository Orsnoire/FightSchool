import { appearanceColors, type AvatarAppearance, type StarterJob } from './appearance';
import { STATIC_FITS, type SpriteFit } from './static-catalog';

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
function sprite(ctx:CanvasRenderingContext2D, source:CanvasImageSource, fit:SpriteFit) {
  ctx.save();ctx.translate(fit.offsetX,fit.offsetY);ctx.scale(fit.scale,fit.scale);
  ctx.beginPath();fit.polygon.forEach(([x,y],i)=>i?ctx.lineTo(x,y):ctx.moveTo(x,y));ctx.closePath();ctx.clip();ctx.drawImage(source,0,0);ctx.restore();
}

/** Static rendering has no combat state, timers, persistence, or equipment grants. */
export function composeStaticAvatar(urls:StaticAssetUrls, appearance:AvatarAppearance, job:StarterJob):Promise<HTMLCanvasElement> {
  if(!assetSetIds.has(urls))assetSetIds.set(urls,nextAssetSetId++);
  const key=JSON.stringify([appearance,job,assetSetIds.get(urls)]);
  let result=composedCache.get(key);
  if(!result) {
    result=(async()=>{
      const fit=STATIC_FITS[job];if(!fit)throw new Error('This starter outfit is unavailable');
      const [head,atlas]=await Promise.all([tintedHead(urls,appearance),tintedAtlas(urls[job],appearanceColors(appearance).skin)]);
      const c=canvas(STATIC_CANVAS.width,STATIC_CANVAS.height),ctx=c.getContext('2d')!;
      ctx.translate(STATIC_CANVAS.offsetX,STATIC_CANVAS.offsetY);
      const isFemale=appearance.modelId==='human-female-v1';
      // The head retains its outline. Extend its skin behind each open collar.
      const neck=head.getContext('2d')!.getImageData(512,isFemale?577:599,1,1).data;
      ctx.fillStyle=`rgb(${neck[0]},${neck[1]},${neck[2]})`;
      ctx.beginPath();ctx.moveTo(470,isFemale?552:576);ctx.lineTo(555,isFemale?552:576);
      ctx.lineTo(558,595);ctx.lineTo(590,620);ctx.lineTo(590,765);ctx.lineTo(435,765);ctx.lineTo(435,620);ctx.lineTo(468,595);ctx.closePath();ctx.fill();
      sprite(ctx,atlas,isFemale?fit.female:fit.male);
      if(job==='wizard') sprite(ctx,atlas,fit.headwear); // Back brim sits behind hair.
      // Keep approved head/hair/neck geometry; original painted clothes are omitted.
      ctx.save();ctx.beginPath();ctx.moveTo(0,0);ctx.lineTo(1024,0);ctx.lineTo(1024,isFemale?589:607);
      ctx.lineTo(0,isFemale?589:607);ctx.closePath();ctx.clip();ctx.drawImage(head,0,0);ctx.restore();
      sprite(ctx,atlas,job==='wizard'?{...fit.headwear,polygon:[[1095,235],[1536,235],[1536,510],[1095,510]]}:fit.headwear);return c;
    })();
    composedCache.set(key,result);if(composedCache.size>8)composedCache.delete(composedCache.keys().next().value!);
    result.catch(()=>composedCache.delete(key));
  }
  return result;
}
