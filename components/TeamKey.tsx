'use client';
import {useEffect,useRef} from 'react';
import type {OpponentKit} from '@/lib/team';
import {tintOpponent} from '@/lib/sprites';
// To farvede prikker fortalte ikke nok. Her står de to dragter, som man møder dem på isen.
// Der zoomes ind på kroppen: ved 52 px ville en hel sprite med stav blive til ingenting.
const BOX=52,CROP=168,CENTRE=(384-CROP)/2;
function paint(canvas:HTMLCanvasElement|null,source:CanvasImageSource){
 const ctx=canvas?.getContext('2d');if(!ctx)return;
 ctx.clearRect(0,0,BOX,BOX);ctx.drawImage(source,CENTRE,CENTRE,CROP,CROP,0,0,BOX,BOX);
}
export default function TeamKey({kit}:{kit:OpponentKit}){
 const home=useRef<HTMLCanvasElement>(null),away=useRef<HTMLCanvasElement>(null);
 useEffect(()=>{let cancelled=false;
  const load=(src:string,then:(image:HTMLImageElement)=>void)=>{
   const image=new Image();image.src=src;image.decode().then(()=>{if(!cancelled)then(image);}).catch(()=>{});
  };
  load('/assets/bulldogs-receive-v6.webp',image=>paint(home.current,image));
  load('/assets/opponent-receive-v6.webp',image=>paint(away.current,tintOpponent(image,kit)));
  return()=>{cancelled=true;};},[kit.primary,kit.stripe]);
 return <div className="team-key">
  <span><canvas ref={home} width={BOX} height={BOX} aria-hidden="true"/><span><b>Bulldogs</b><small>DET ER DIG</small></span></span>
  <span><canvas ref={away} width={BOX} height={BOX} aria-hidden="true"/><span><b>{kit.name}</b><small>UNDGÅ DEM</small></span></span>
 </div>;
}
