import { createCanvas, Image } from '@napi-rs/canvas';
import { writeFileSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { composeStaticAvatar } from '../../../shared/avatar/static-renderer.ts';
import { initialAppearance, STARTER_JOBS, AVATAR_JOBS } from '../../../shared/avatar/appearance.ts';
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
const sheet=createCanvas(1800,2600),ctx=sheet.getContext('2d');
ctx.fillStyle='#f4f0e6';ctx.fillRect(0,0,1800,2600);ctx.textAlign='center';ctx.font='22px sans-serif';
for(const [row,model] of ['human-male-v1','human-female-v1'].entries()) {
 for(const [col,job] of AVATAR_JOBS.entries()) {
   const avatar=await composeStaticAvatar(urls,initialAppearance(null,model as any,()=>0.35),job);
   ctx.drawImage(avatar as any,(col%6)*300,(row*2+Math.floor(col/6))*650+35,300,600);
   ctx.fillStyle='#302b25';ctx.fillText(`${job} · ${row?'female':'male'}`,(col%6)*300+150,(row*2+Math.floor(col/6))*650+30);
 }
}
mkdirSync('artifacts/static-avatar-review',{recursive:true});
writeFileSync('artifacts/static-avatar-review/lineup.png',sheet.toBuffer('image/png'));
console.log('artifacts/static-avatar-review/lineup.png');
