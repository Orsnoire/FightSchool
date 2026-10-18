import type { EquipmentVisuals } from "@shared/avatar/visuals";
import { memo, useEffect, useRef, useState } from 'react';
import { avatarSurface, stableVisualKey, type AvatarSurface } from '@shared/avatar/render-budget';
import { composeStaticAvatar, type StaticAssetUrls } from '@shared/avatar/static-renderer';
import type { AvatarAppearance, AvatarJob } from '@shared/avatar/appearance';

import { avatarEquipment, unknownEquipment, type AvatarLoadout } from '@shared/avatar/equipment-visuals';
import tierOneOutfits from '../../../attached_assets/characters/human/equipment-static-v1/source/tier-one-outfits.png';
import tierOneCaster from '../../../attached_assets/characters/human/equipment-static-v1/source/tier-one-caster.png';
import props from '../../../attached_assets/characters/human/equipment-static-v1/source/props.png';
import starterHarp from '../../../attached_assets/characters/human/equipment-static-v1/source/starter-harp.png';

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
  'tier-one-outfits':tierOneOutfits,'tier-one-caster':tierOneCaster,props,'starter-harp':starterHarp,
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

interface StaticAvatarProps {
  appearance:AvatarAppearance; job:AvatarJob; loadout?:AvatarLoadout;
  visuals?:EquipmentVisuals; className?:string; label?:string;
}
function visualKey({appearance,job,loadout,visuals}:StaticAvatarProps) {
  return stableVisualKey([appearance,job,avatarEquipment(job,loadout),visuals || {}]);
}
export const StaticAvatar = memo(function StaticAvatar({ appearance, job, loadout, visuals, className='', label }:StaticAvatarProps) {
  const container=useRef<HTMLDivElement>(null),canvas=useRef<HTMLCanvasElement>(null);
  const [size,setSize]=useState<AvatarSurface|null>(null),[error,setError]=useState('');
  const equipment=avatarEquipment(job,loadout),equipmentKey=stableVisualKey([equipment,visuals]);
  const missing=unknownEquipment(equipment);
  useEffect(()=>{
    const element=container.current;
    if(!element)return;
    let media:MediaQueryList|undefined;
    const measure=()=>{
      const box=element.getBoundingClientRect();
      const next=avatarSurface(box.width,box.height,window.devicePixelRatio || 1);
      setSize(previous=>previous?.width===next?.width&&previous?.height===next?.height?previous:next);
    };
    const watchDpr=()=>{
      media?.removeEventListener('change',watchDpr);
      media=window.matchMedia?.(`(resolution: ${window.devicePixelRatio || 1}dppx)`);
      media?.addEventListener('change',watchDpr);
      measure();
    };
    const observer=typeof ResizeObserver==='undefined'?undefined:new ResizeObserver(measure);
    observer?.observe(element);
    window.addEventListener('resize',measure);
    watchDpr();
    return()=>{observer?.disconnect();window.removeEventListener('resize',measure);media?.removeEventListener('change',watchDpr);};
  },[]);
  useEffect(()=>{
    let active=true;const controller=new AbortController();
    // Avoid a passive state update for every healthy avatar on a roster resize.
    if(error)setError('');
    const target=canvas.current;
    if(target)delete target.dataset.avatarReady;
    if(!size)return;
    target?.getContext('2d')?.clearRect(0,0,target.width,target.height);
    composeStaticAvatar(staticAvatarUrls,appearance,job,equipment,visuals,{...size,signal:controller.signal}).then(source=>{
      if(!active||!canvas.current)return;
      const c=canvas.current,ctx=c.getContext('2d');
      if(!ctx)throw new Error('Canvas unavailable');
      ctx.clearRect(0,0,c.width,c.height);ctx.drawImage(source,0,0,c.width,c.height);
      c.dataset.avatarReady='true';
    }).catch(()=>{if(active)setError('Avatar artwork could not load.');});
    return()=>{active=false;controller.abort();};
  },[appearance.modelId,appearance.hairColorId,appearance.eyeColorId,appearance.skinColorId,job,equipmentKey,size?.width,size?.height]);
  return <div ref={container} className={className} data-testid="static-avatar" data-job={job} data-equipment={equipmentKey} title={missing.length?"Some custom equipment uses a neutral appearance.":undefined}>
    <canvas ref={canvas} width={size?.width || 1} height={size?.height || 2} aria-label={label||`${job} avatar`} role="img" className="w-full h-full object-contain" />
    {error&&<p role="alert">{error}</p>}
  </div>;
},(previous,next)=>previous.className===next.className&&previous.label===next.label&&visualKey(previous)===visualKey(next));
