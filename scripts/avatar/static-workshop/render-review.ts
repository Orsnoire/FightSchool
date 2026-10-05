import { createCanvas, Image } from '@napi-rs/canvas';
import { writeFileSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { composeStaticAvatar } from '../../../shared/avatar/static-renderer.ts';
import { initialAppearance, STARTER_JOBS } from '../../../shared/avatar/appearance.ts';
(globalThis as any).Image = Image;
(globalThis as any).document = { createElement: () => createCanvas(1,1) };
const root=resolve('attached_assets/characters/human');
const urls=Object.fromEntries([
 ...['male','female'].flatMap(model=>['neutral','hair','eyes','skin'].map(channel=>[
   `${model}-${channel}`, `${root}/v1/recolor/${channel==='neutral'?`neutral/human-${model}-front.png`:`masks/human-${model}-front-${channel}.png`}`,
 ])),
 ...STARTER_JOBS.map(job=>[job,`${root}/static-starters-v1/source/${job}.png`]),
]);
const sheet=createCanvas(1600,1380),ctx=sheet.getContext('2d');
ctx.fillStyle='#f4f0e6';ctx.fillRect(0,0,1600,1380);ctx.textAlign='center';ctx.font='22px sans-serif';
for(const [row,model] of ['human-male-v1','human-female-v1'].entries()) {
 for(const [col,job] of STARTER_JOBS.entries()) {
   const avatar=await composeStaticAvatar(urls,initialAppearance(null,model as any,()=>0.35),job);
   ctx.drawImage(avatar as any,col*400,row*690+35,400,650);
   ctx.fillStyle='#302b25';ctx.fillText(`${job} · ${row?'female':'male'}`,col*400+200,row*690+30);
 }
}
mkdirSync('artifacts/static-avatar-review',{recursive:true});
writeFileSync('artifacts/static-avatar-review/lineup.png',sheet.toBuffer('image/png'));
console.log('artifacts/static-avatar-review/lineup.png');
