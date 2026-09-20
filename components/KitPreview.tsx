'use client';
import {useEffect,useRef} from 'react';
import type {OpponentKit} from '@/lib/team';
import {tintOpponent} from '@/lib/sprites';
// Previewet bruger praecis samme sprite og samme farvning som spillet, saa det personalet ser er det, isen viser.
export default function KitPreview({kit}:{kit:OpponentKit}){
 const canvas=useRef<HTMLCanvasElement>(null);
 useEffect(()=>{let cancelled=false;const image=new Image();image.src='/assets/opponent-skater.webp';image.decode().then(()=>{if(cancelled)return;const ctx=canvas.current?.getContext('2d');if(!ctx)return;ctx.clearRect(0,0,180,180);ctx.drawImage(tintOpponent(image,kit),0,0,180,180);}).catch(()=>{});return()=>{cancelled=true;};},[kit.primary,kit.stripe]);
 return <canvas className="kit-preview" ref={canvas} width={180} height={180} role="img" aria-label={`Forhåndsvisning af ${kit.name}s dragt`}/>;
}
