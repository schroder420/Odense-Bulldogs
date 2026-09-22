'use client';
import {useEffect,useRef} from 'react';
import type {OpponentKit} from '@/lib/team';
import {tintOpponent} from '@/lib/sprites';
// Forfra-billedet viser troeje, aag, bukser og sokkestriber langt tydeligere end et billede ovenfra.
// Det er den samme farvemester og den samme farvning som paa isen, saa farverne er garanteret ens.
export default function KitPreview({kit}:{kit:OpponentKit}){
 const canvas=useRef<HTMLCanvasElement>(null);
 useEffect(()=>{let cancelled=false;const image=new Image();image.src='/assets/opponent-receive-v6.webp';image.decode().then(()=>{if(cancelled)return;const ctx=canvas.current?.getContext('2d');if(!ctx)return;ctx.clearRect(0,0,200,260);ctx.drawImage(tintOpponent(image,kit),0,30,200,200);}).catch(()=>{});return()=>{cancelled=true;};},[kit.primary,kit.stripe]);
 return <canvas className="kit-preview" ref={canvas} width={200} height={260} role="img" aria-label={`Forhåndsvisning af ${kit.name}s dragt`}/>;
}
