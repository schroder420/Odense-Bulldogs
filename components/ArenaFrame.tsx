'use client';
import {useEffect,useState,type ReactNode} from 'react';
// The arena has a 2:1 display. Fit the complete composition on any screen;
// reserve the bottom 8% for the arena's own clock, outside our content.
export default function ArenaFrame({children}:{children:ReactNode}){
 const [scale,setScale]=useState(1);
 useEffect(()=>{const resize=()=>setScale(Math.min(innerWidth/672,innerHeight*.92/309));resize();window.addEventListener('resize',resize);return()=>window.removeEventListener('resize',resize);},[]);
 return <main className="arena-frame" onDoubleClick={()=>{if(!document.fullscreenElement)void document.documentElement.requestFullscreen().catch(()=>{});else void document.exitFullscreen();}}><div style={{width:672*scale,height:309*scale}}><div className="arena-composition" style={{transform:`scale(${scale})`}}>{children}</div></div></main>;
}
