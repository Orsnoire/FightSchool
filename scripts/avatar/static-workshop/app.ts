import { initialAppearance, validAppearance, STARTER_JOBS, AVATAR_JOBS, JOB_PRESENTATION, CHANNELS, COLOR_FIELDS, PALETTES, selectAvatarJob, type AvatarAppearance, type AvatarJob } from '../../../shared/avatar/appearance';
import { composeStaticAvatar, STATIC_CANVAS, type StaticAssetUrls } from '../../../shared/avatar/static-renderer';
declare global { interface Window { STATIC_STARTER_ASSETS: StaticAssetUrls } }
const $ = <T extends HTMLElement>(id:string) => document.getElementById(id) as T;
let appearance=initialAppearance(null,'human-male-v1',()=>0.35),job:AvatarJob='warrior';
try { const previous=JSON.parse(localStorage.getItem('qa-static-avatar-review-v1')||'null'); if(validAppearance(previous))appearance=initialAppearance(previous); } catch { /* Workshop iframe storage may be unavailable. */ }
const jobSelect=$<HTMLSelectElement>('job'),modelSelect=$<HTMLSelectElement>('model');
for(const j of AVATAR_JOBS)jobSelect.add(new Option(JOB_PRESENTATION[j].name,j));
modelSelect.value=appearance.modelId;
for(const channel of CHANNELS) {
 const select=$<HTMLSelectElement>(channel);
 for(const option of PALETTES[channel])select.add(new Option(option.label,option.id));
 select.value=appearance[COLOR_FIELDS[channel]];
 select.addEventListener('change',()=>{appearance={...appearance,[COLOR_FIELDS[channel]]:select.value};render();});
}
jobSelect.addEventListener('change',()=>{job=jobSelect.value as AvatarJob;render();});
modelSelect.addEventListener('change',()=>{appearance={...appearance,modelId:modelSelect.value as AvatarAppearance['modelId']};render();});
const main=$<HTMLCanvasElement>('avatar');main.width=STATIC_CANVAS.width;main.height=STATIC_CANVAS.height;
let generation=0;
async function render() {
 const current=++generation,selection=selectAvatarJob(appearance,job);
 try { localStorage.setItem('qa-static-avatar-review-v1',JSON.stringify(appearance)); } catch { /* Shared values still persist in memory. */ }
 $('job-title').textContent=selection.kit.name;
 $('clothing').textContent=selection.kit.clothing;
 $('headwear').textContent=selection.kit.head;
 $('weapon-status').textContent=selection.kit.missingWeapon?'Weapon artwork pending — showing empty hands.':'';
 $('right-hand').textContent=selection.kit.right;
 $('left-hand').textContent=selection.kit.left;
 $('status').textContent='Rendering…';
 try {
  const output=await composeStaticAvatar(window.STATIC_STARTER_ASSETS,appearance,job);
  if(current!==generation)return;
  const ctx=main.getContext('2d')!;ctx.clearRect(0,0,main.width,main.height);ctx.drawImage(output,0,0);
  main.dataset.job=job;main.dataset.appearance=JSON.stringify(appearance);main.setAttribute('aria-label',`${selection.kit.name}, ${modelSelect.selectedOptions[0].text} body`);
  $('status').textContent='Ready for review';
  for(const j of STARTER_JOBS) {
   const canvas=$<HTMLCanvasElement>(`compare-${j}`),img=await composeStaticAvatar(window.STATIC_STARTER_ASSETS,appearance,j);
   if(current!==generation)return;
   const c=canvas.getContext('2d')!;c.clearRect(0,0,canvas.width,canvas.height);c.drawImage(img,0,0,canvas.width,canvas.height);
   canvas.closest('button')!.setAttribute('aria-pressed',String(j===job));
  }
 } catch { if(current===generation)$('status').textContent='Artwork could not load. Reload this preview to try again.'; }
}
for(const j of STARTER_JOBS)$(`choose-${j}`).addEventListener('click',()=>{job=j;jobSelect.value=j;render();});
$('download').addEventListener('click',()=>{
 const link=document.createElement('a');link.download=`${appearance.modelId}-${job}-static.png`;link.href=main.toDataURL('image/png');link.click();
});
render();
