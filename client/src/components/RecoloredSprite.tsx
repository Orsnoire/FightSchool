import { useEffect,useRef,useState } from 'react';
import { recolorPixels,type SpritePalette } from '@shared/avatar/visuals';
export function RecoloredSprite({src,palette,alt,className}:{src:string;palette?:SpritePalette;alt:string;className?:string}){
 const canvas=useRef<HTMLCanvasElement>(null),[failed,setFailed]=useState(false),key=JSON.stringify(palette||{});
 useEffect(()=>{
  if(!palette||!Object.values(palette).some(Boolean))return;
  let active=true;setFailed(false);const img=new Image();img.crossOrigin='anonymous';
  img.onload=()=>{if(!active||!canvas.current)return;try{const c=canvas.current;c.width=Math.min(512,img.naturalWidth);c.height=Math.max(1,Math.round(img.naturalHeight*c.width/img.naturalWidth));const ctx=c.getContext('2d')!;ctx.drawImage(img,0,0,c.width,c.height);const pixels=ctx.getImageData(0,0,c.width,c.height);recolorPixels(pixels.data,palette);ctx.putImageData(pixels,0,0);}catch{setFailed(true);}};
  img.onerror=()=>{if(active)setFailed(true);};img.src=src;return()=>{active=false;};
 },[src,key]);
 if(!palette||!Object.values(palette).some(Boolean)||failed)return <img src={src} alt={alt} className={className} title={failed?'This image host does not permit recoloring. Use an uploaded image.':undefined}/>;
 return <canvas ref={canvas} role="img" aria-label={alt} className={className}/>;
}
