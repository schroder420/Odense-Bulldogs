'use client';
import {useLayoutEffect,useRef,type ReactNode} from 'react';

// Fit all information into the available screen region, including long staff messages.
export default function ScreenFit({children}:{children:ReactNode}){
 const host=useRef<HTMLDivElement>(null),content=useRef<HTMLDivElement>(null);
 useLayoutEffect(()=>{
  const outer=host.current!,inner=content.current!;
  const fit=()=>{
   const minimum=Number(getComputedStyle(outer).getPropertyValue('--fit-min-width'))||600;
   const width=Math.max(minimum,outer.clientWidth);
   inner.style.width=`${width}px`;
   const scale=Math.min(outer.clientWidth/width,outer.clientHeight/Math.max(1,inner.scrollHeight));
   inner.style.transform=`translate(-50%, -50%) scale(${scale})`;
  };
  const observer=new ResizeObserver(fit);observer.observe(outer);observer.observe(inner);
  let active=true;document.fonts.ready.then(()=>{if(active)fit();});fit();
  return()=>{active=false;observer.disconnect();};
 },[]);
 return <div className="screen-fit" ref={host}><div className="screen-fit-content" ref={content}>{children}</div></div>;
}
