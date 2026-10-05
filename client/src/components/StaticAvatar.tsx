import { useEffect, useRef, useState } from 'react';
import { composeStaticAvatar, STATIC_CANVAS, type StaticAssetUrls } from '@shared/avatar/static-renderer';
import type { AvatarAppearance, AvatarJob } from '@shared/avatar/appearance';

import male_neutral from '../../../attached_assets/characters/human/v1/recolor/neutral/human-male-front.png';
import male_hair from '../../../attached_assets/characters/human/v1/recolor/masks/human-male-front-hair.png';
import male_eyes from '../../../attached_assets/characters/human/v1/recolor/masks/human-male-front-eyes.png';
import male_skin from '../../../attached_assets/characters/human/v1/recolor/masks/human-male-front-skin.png';
import female_neutral from '../../../attached_assets/characters/human/v1/recolor/neutral/human-female-front.png';
import female_hair from '../../../attached_assets/characters/human/v1/recolor/masks/human-female-front-hair.png';
import female_eyes from '../../../attached_assets/characters/human/v1/recolor/masks/human-female-front-eyes.png';
import female_skin from '../../../attached_assets/characters/human/v1/recolor/masks/human-female-front-skin.png';
import warrior from '../../../attached_assets/characters/human/static-starters-v1/source/warrior.png';
import wizard from '../../../attached_assets/characters/human/static-starters-v1/source/wizard.png';
import scout from '../../../attached_assets/characters/human/static-starters-v1/source/scout.png';
import herbalist from '../../../attached_assets/characters/human/static-starters-v1/source/herbalist.png';
import emptyBodies from '../../../attached_assets/characters/human/static-starters-v1/source/empty-bodies.png';
export const staticAvatarUrls:StaticAssetUrls = {
  'male-neutral':male_neutral,
  'male-hair':male_hair,
  'male-eyes':male_eyes,
  'male-skin':male_skin,
  'female-neutral':female_neutral,
  'female-hair':female_hair,
  'female-eyes':female_eyes,
  'female-skin':female_skin,
  'empty-bodies':emptyBodies,
  warrior,
  wizard,
  scout,
  herbalist,
};

export function StaticAvatar({ appearance, job, className='', label }: { appearance:AvatarAppearance; job:AvatarJob; className?:string; label?:string }) {
  const canvas=useRef<HTMLCanvasElement>(null),[error,setError]=useState('');
  useEffect(()=>{
    let active=true;setError('');
    composeStaticAvatar(staticAvatarUrls,appearance,job).then(source=>{
      if(!active||!canvas.current)return;const c=canvas.current,ctx=c.getContext('2d')!;
      ctx.clearRect(0,0,c.width,c.height);ctx.drawImage(source,0,0);
    }).catch(()=>{if(active)setError('Avatar artwork could not load.');});
    return()=>{active=false};
  },[appearance.modelId,appearance.hairColorId,appearance.eyeColorId,appearance.skinColorId,job]);
  return <div className={className} data-testid="static-avatar" data-job={job}>
    <canvas ref={canvas} width={STATIC_CANVAS.width} height={STATIC_CANVAS.height} aria-label={label||`${job} avatar`} role="img" className="w-full h-full object-contain" />
    {error&&<p role="alert">{error}</p>}
  </div>;
}
