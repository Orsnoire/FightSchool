import { createCanvas, Image } from '@napi-rs/canvas';
import { writeFileSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { composeStaticAvatar } from '../../../shared/avatar/static-renderer.ts';
import { initialAppearance, STARTER_JOBS, AVATAR_JOBS, PALETTES } from '../../../shared/avatar/appearance.ts';
(globalThis as any).Image = Image;
(globalThis as any).document = { createElement: () => createCanvas(1,1) };
const root=resolve('attached_assets/characters/human');
const urls=Object.fromEntries([
 ...['male','female'].flatMap(model=>['neutral','hair','eyes','skin'].map(channel=>[
   `${model}-${channel}`, `${root}/v1/recolor/${channel==='neutral'?`neutral/human-${model}-front.png`:`masks/human-${model}-front-${channel}.png`}`,
 ])),
 ...STARTER_JOBS.map(job=>[job,`${root}/static-starters-v1/source/${job}.png`]),
]);
urls['empty-bodies']=`${root}/static-starters-v1/source/empty-bodies.png`;
const output='artifacts/static-avatar-review';mkdirSync(output,{recursive:true});
function sheet(width:number,height:number) {
 const canvas=createCanvas(width,height),ctx=canvas.getContext('2d');
 ctx.fillStyle='#f4f0e6';ctx.fillRect(0,0,width,height);ctx.fillStyle='#302b25';ctx.font='22px sans-serif';
 return {canvas,ctx};
}
const lineup=sheet(1800,2200),detail=sheet(1600,1600),fallback=sheet(1200,1600),palettes=sheet(1400,800);
function fitDetail(target:ReturnType<typeof sheet>,avatar:any,col:number,row:number,label:string) {
 const x=col*400,y=row*800;
 target.ctx.fillText(label,x+12,y+26);
 target.ctx.drawImage(avatar,210,400,800,820,x,y+30,400,410);
 target.ctx.drawImage(avatar,470,930,260,260,x+50,y+450,300,300);
}
for(const [row,model] of ['human-male-v1','human-female-v1'].entries()) {
 for(const [col,job] of AVATAR_JOBS.entries()) {
   const avatar=await composeStaticAvatar(urls,initialAppearance(null,model as any,()=>0.35),job);
   const x=(col%6)*300,y=(row*2+Math.floor(col/6))*550;
   lineup.ctx.drawImage(avatar as any,x,y+35,300,487.5);
   lineup.ctx.fillText(`${job} · ${row?'female':'male'}`,x+12,y+30);
   if(col<4)fitDetail(detail,avatar,col,row,`${job} · ${row?'female':'male'}`);
   const fallbackCol=['blood_knight','monk','bard'].indexOf(job);
   if(fallbackCol>=0)fitDetail(fallback,avatar,fallbackCol,row,`${job} · ${row?'female':'male'}`);
 }
 const jobs=[...STARTER_JOBS,'blood_knight','monk','bard'] as const;
 for(const [col,job] of jobs.entries())for(const [tone,skin] of [PALETTES.skin[0],PALETTES.skin[7]].entries()) {
   const appearance={...initialAppearance(null,model as any,()=>0.35),skinColorId:skin.id};
   const avatar=await composeStaticAvatar(urls,appearance,job),y=(row*2+tone)*200;
   palettes.ctx.font='14px sans-serif';palettes.ctx.fillText(`${job} · ${row?'F':'M'} · ${skin.label}`,col*200+5,y+18);
   palettes.ctx.drawImage(avatar as any,470,930,260,260,col*200+10,y+20,180,180);
 }
}
for(const [name,result] of Object.entries({lineup,'fit-detail':detail,'fallback-fit-detail':fallback,'skin-palette-detail':palettes}))writeFileSync(`${output}/${name}.png`,result.canvas.toBuffer('image/png'));
console.log(`${output}/lineup.png and collar/headwear details`);
