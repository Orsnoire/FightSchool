import { appearanceColors, starterVisual, type AvatarAppearance, type AvatarJob } from './appearance';
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

/** Static rendering has no combat state, timers, persistence, or equipment grants. */
export function composeStaticAvatar(urls:StaticAssetUrls, appearance:AvatarAppearance, job:AvatarJob):Promise<HTMLCanvasElement> {
  if(!assetSetIds.has(urls))assetSetIds.set(urls,nextAssetSetId++);
  const key=JSON.stringify([appearance,job,assetSetIds.get(urls)]);
  let result=composedCache.get(key);
  if(!result) {
    result=(async()=>{
      const visual=starterVisual(job),fit=visual.body==='empty-bodies'?EMPTY_BODY_FITS[visual.armor]:STATIC_FITS[visual.body],hatFit=STATIC_FITS[visual.headwear].headwear;
      const [head,atlas,hat]=await Promise.all([tintedHead(urls,appearance),tintedAtlas(urls[visual.body],appearanceColors(appearance).skin),image(urls[visual.headwear])]);
      const c=canvas(STATIC_CANVAS.width,STATIC_CANVAS.height),ctx=c.getContext('2d')!;
      ctx.translate(STATIC_CANVAS.offsetX,STATIC_CANVAS.offsetY);
      const isFemale=appearance.modelId==='human-female-v1';
      const bodyFit=isFemale?fit.female:fit.male;
      // Back collar first, then a continuous neck/upper torso, then the front lip.
      // The torso has no bottom ink line: it continues out of sight under clothing.
      sprite(ctx,atlas,bodyFit);
      const neck=head.getContext('2d')!.getImageData(512,isFemale?577:599,1,1).data;
      ctx.fillStyle=`rgb(${neck[0]},${neck[1]},${neck[2]})`;
      const join=isFemale?575:595,left=isFemale?471:467,right=isFemale?555:557;
      ctx.beginPath();ctx.moveTo(left,join-12);ctx.lineTo(right,join-12);
      ctx.bezierCurveTo(right,617,599,602,610,650);ctx.bezierCurveTo(634,740,586,783,512,783);
      ctx.bezierCurveTo(438,783,390,740,414,650);ctx.bezierCurveTo(425,602,left,617,left,join-12);ctx.closePath();ctx.fill();
      ctx.strokeStyle='#151310';ctx.lineWidth=6;ctx.lineCap='round';
      ctx.beginPath();ctx.moveTo(left,join-10);ctx.bezierCurveTo(left,617,425,602,414,650);
      ctx.moveTo(right,join-10);ctx.bezierCurveTo(right,617,599,602,610,650);ctx.stroke();
      sprite(ctx,atlas,bodyFit,[],true);
      if(visual.headwear==='warrior')for(const guard of HELMET_NECK_GUARD)sprite(ctx,hat,{...hatFit,polygon:guard});
      if(visual.headwear==='wizard') sprite(ctx,hat,hatFit); // Back brim sits behind hair.
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
      sprite(ctx,hat,visual.headwear==='wizard'?{...hatFit,polygon:[[1095,235],[1536,235],[1536,510],[1095,510]]}:hatFit,visual.headwear==='warrior'?HELMET_NECK_GUARD:[]);return c;
    })();
    composedCache.set(key,result);if(composedCache.size>8)composedCache.delete(composedCache.keys().next().value!);
    result.catch(()=>composedCache.delete(key));
  }
  return result;
}
