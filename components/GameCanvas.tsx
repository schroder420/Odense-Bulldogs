'use client';
import {useEffect,useRef,useState} from 'react';
import {act,advance,createGame,formatTime,HEIGHT,position,WIDTH,type Game,type Input,type Point} from '@/lib/game';
export type Session={id:string;seed:number;limit:number;practice:boolean};
export default function GameCanvas({session,onEnd,onReady}:{session:Session|null;onEnd:(g:Game)=>void;onReady?:(ready:boolean)=>void}){
 const canvas=useRef<HTMLCanvasElement>(null);const game=useRef<Game|null>(null);const camera=useRef(0);const start=useRef(0);const callback=useRef(onEnd);callback.current=onEnd;
 const [hud,setHud]=useState({time:0,passes:0,short:false,step:0,flight:false});const [assetError,setAssetError]=useState(false);
 useEffect(()=>{
  let frame=0,stopped=false,ended=false,lastHud=0,shapeScale=1;const ctx=canvas.current!.getContext('2d')!;
  const home=new Image(),away=new Image(),logo=new Image();home.src='/assets/home-skater.webp';away.src='/assets/opponent-skater.webp';logo.src='/assets/bulldogs-logo.png';
  const g=createGame(session?.seed||1978,session?.limit||Infinity);game.current=g;camera.current=0;
  const loaded=Promise.all([home,away,logo].map(im=>im.decode()));
  const skater=(point:Point,team:'home'|'away',number?:number,alpha=1)=>{
    const x=point.x,y=point.y-camera.current+490;ctx.save();ctx.globalAlpha=alpha;
    ctx.fillStyle='rgba(19,46,59,.16)';ctx.beginPath();ctx.ellipse(x,y+14,24,8,0,0,Math.PI*2);ctx.fill();
    ctx.drawImage(team==='home'?home:away,x-53,y-62*shapeScale,106,106*shapeScale);
    if(number!==undefined){ctx.fillStyle='#18492e';ctx.font='bold 12px Arial';ctx.textAlign='center';ctx.fillText(String(number),x,y+48*shapeScale);}
    ctx.restore();
  };
  const draw=()=>{
    ctx.setTransform(1,0,0,1,0,0);const dpr=Math.min(window.devicePixelRatio||1,2);const w=Math.round(WIDTH*dpr),h=Math.round(HEIGHT*dpr);if(canvas.current!.width!==w){canvas.current!.width=w;canvas.current!.height=h;}ctx.scale(dpr,dpr);shapeScale=HEIGHT*canvas.current!.clientWidth/(WIDTH*canvas.current!.clientHeight);
    const gradient=ctx.createLinearGradient(0,0,WIDTH,HEIGHT);gradient.addColorStop(0,'#eef5f5');gradient.addColorStop(.5,'#ffffff');gradient.addColorStop(1,'#dce9ed');ctx.fillStyle=gradient;ctx.fillRect(0,0,WIDTH,HEIGHT);
    ctx.save();ctx.strokeStyle='rgba(90,121,132,.045)';ctx.lineWidth=1;
    for(let i=0;i<75;i++){const x=(i*137)%400,y=((i*91-camera.current*.7)%680+680)%680;ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(x+60,y-95);ctx.stroke();}ctx.restore();
    const rinkY=(((-camera.current+120)%1000)+1000)%1000-250;
    ctx.strokeStyle='rgba(180,35,42,.37)';ctx.lineWidth=3;ctx.beginPath();ctx.moveTo(15,rinkY);ctx.lineTo(385,rinkY);ctx.stroke();
    ctx.beginPath();ctx.arc(200,rinkY,85,0,Math.PI*2);ctx.stroke();
    ctx.fillStyle='rgba(180,35,42,.5)';ctx.beginPath();ctx.arc(200,rinkY,4,0,Math.PI*2);ctx.fill();
    ctx.strokeStyle='rgba(58,124,179,.48)';ctx.lineWidth=7;for(const y of [rinkY-240,rinkY+240]){ctx.beginPath();ctx.moveTo(14,y);ctx.lineTo(386,y);ctx.stroke();}
    for(const x of [96,304]){ctx.strokeStyle='rgba(180,35,42,.24)';ctx.lineWidth=2;ctx.beginPath();ctx.arc(x,rinkY+435,46,0,Math.PI*2);ctx.stroke();}
    ctx.globalAlpha=.09;ctx.drawImage(logo,146,rinkY-61,108,122);ctx.globalAlpha=1;
    ctx.fillStyle='#d5dfe0';ctx.fillRect(0,0,12,HEIGHT);ctx.fillRect(388,0,12,HEIGHT);ctx.fillStyle='#e9a331';ctx.fillRect(10,0,4,HEIGHT);ctx.fillRect(386,0,4,HEIGHT);
    ctx.save();ctx.translate(29,330);ctx.rotate(-Math.PI/2);ctx.fillStyle='rgba(24,73,46,.22)';ctx.font='bold 12px Arial';ctx.letterSpacing='3px';ctx.fillText('ODENSE BULLDOGS',0,0);ctx.restore();
    if(g.stage.bank){const b=g.stage.bank, p=g.stage.home.find(h=>h.id===b.target)!;const target=position(p,g.now);ctx.save();ctx.setLineDash([5,6]);ctx.strokeStyle='#d97a24';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(g.active.x,g.active.y-camera.current+490);ctx.lineTo(b.point.x,b.point.y-camera.current+490);ctx.lineTo(target.x,target.y-camera.current+490);ctx.stroke();ctx.setLineDash([]);ctx.fillStyle='#E48331';ctx.fillRect(b.point.x-11,b.point.y-camera.current+454,22,72);ctx.fillStyle='#1b3122';ctx.textAlign='center';ctx.font='bold 11px Arial';ctx.fillText('BANDE',b.point.x===12?48:352,b.point.y-camera.current+449);ctx.restore();}
    g.stage.home.forEach((p,i)=>skater(position(p,g.now),'home',i+1));g.stage.away.forEach(p=>skater(position(p,g.now),'away'));
    const pressure=Math.min(1,Math.max(0,(g.now-g.readyAt)/(g.deadline-g.readyAt)));
    skater({x:g.active.x+Math.sin(g.now/200)*3,y:g.active.y+120-pressure*83},'away');
    if(!g.flight){const x=g.active.x,y=g.active.y-camera.current+490;ctx.strokeStyle='rgba(24,73,46,.14)';ctx.lineWidth=5;ctx.beginPath();ctx.arc(x,y,40,0,Math.PI*2);ctx.stroke();ctx.strokeStyle=`hsl(${120*(1-pressure)},65%,${pressure>.7?46:36}%)`;ctx.beginPath();ctx.arc(x,y,40,-Math.PI/2,-Math.PI/2+Math.PI*2*(1-pressure));ctx.stroke();skater(g.active,'home');ctx.fillStyle='#162323';ctx.beginPath();ctx.ellipse(x+35,y-30,5,3.5,0,0,Math.PI*2);ctx.fill();}
    else{const f=g.flight;skater(f.from,'home',undefined,.55);const u=Math.min(1,(g.now-f.start)/(f.end-f.start));const a=f.via?(u<.5?f.from:f.via):f.from;const b=f.via?(u<.5?f.via:f.to):f.to;const v=f.via?(u<.5?u*2:(u-.5)*2):u;const x=a.x+(b.x-a.x)*v,y=a.y+(b.y-a.y)*v-camera.current+490;ctx.strokeStyle='rgba(15,31,33,.2)';ctx.lineWidth=4;ctx.beginPath();ctx.moveTo(x-(b.x-a.x)*.08,y-(b.y-a.y)*.08);ctx.lineTo(x,y);ctx.stroke();ctx.fillStyle='#162323';ctx.beginPath();ctx.ellipse(x,y,5,3.5,0,0,Math.PI*2);ctx.fill();}
    if(g.impact){ctx.strokeStyle='#b4232a';ctx.lineWidth=3;ctx.beginPath();ctx.ellipse(g.impact.x,g.impact.y-camera.current+490,35,35*shapeScale,0,0,Math.PI*2);ctx.stroke();ctx.fillStyle='#142323';ctx.beginPath();ctx.arc(g.impact.x+22,g.impact.y-camera.current+473,5,0,Math.PI*2);ctx.fill();}
    if(g.step<2&&!g.dead){ctx.fillStyle='#18492e';ctx.font='bold 14px Arial';ctx.textAlign='center';ctx.fillText('TRYK PÅ EN HVID MEDSPILLER',200,70);ctx.font='12px Arial';ctx.fillText('Du spiller altid fremad ↑',200,92);}
  };
  const finish=()=>{if(!ended){ended=true;callback.current({...g,events:[...g.events]});}};
  const loop=(now:number)=>{
   if(stopped)return;
   if(session){advance(g,Math.floor(now-start.current));if(g.dead)finish();}
   else{g.now=1000;}
   const targetCamera=g.flight?g.flight.from.y+(g.flight.to.y-g.flight.from.y)*Math.min(1,(g.now-g.flight.start)/(g.flight.end-g.flight.start)):g.active.y;
   camera.current+=(targetCamera-camera.current)*.16;
   draw();
   if(now-lastHud>60){setHud({time:g.score,passes:g.passes,short:g.stage.shortHanded,step:g.step,flight:!!g.flight});lastHud=now;}
   frame=requestAnimationFrame(loop);
  };
  loaded.then(()=>{if(stopped)return;start.current=performance.now();onReady?.(true);frame=requestAnimationFrame(loop);}).catch(()=>{if(!stopped){setAssetError(true);onReady?.(false);}});
  const visibility=()=>{if(document.hidden&&session&&!g.dead){advance(g,Math.floor(performance.now()-start.current));if(!g.dead){g.dead='left';g.score=Math.floor(g.now);}finish();}};document.addEventListener('visibilitychange',visibility);
  return()=>{stopped=true;cancelAnimationFrame(frame);document.removeEventListener('visibilitychange',visibility);};
 },[session,onReady]);
 function input(target:string,bank=false){const g=game.current;if(!session||!g||g.dead)return;act(g,{t:Math.floor(performance.now()-start.current),target,bank});}
 function pointer(e:React.PointerEvent<HTMLCanvasElement>){const g=game.current;if(!g)return;const rect=e.currentTarget.getBoundingClientRect();const x=(e.clientX-rect.left)/rect.width*WIDTH,y=(e.clientY-rect.top)/rect.height*HEIGHT+camera.current-490;
  const b=g.stage.bank;if(b&&Math.hypot(x-b.point.x,y-b.point.y)<43){input(b.target,true);return;}
  const candidates=[...g.stage.home,...g.stage.away].map(p=>({p,d:Math.hypot(x-position(p,g.now).x,y-p.y)})).sort((a,b)=>a.d-b.d);if(candidates[0]?.d<43)input(candidates[0].p.id);
 }
 return <><div className="game-hud"><div><span>OVERLEVELSE</span><strong>{formatTime(hud.time)}<small> SEK</small></strong></div><div className="passes"><span>AFLEVERINGER</span><strong>{String(hud.passes).padStart(2,'0')}</strong></div></div>
 <div className="canvas-box"><canvas ref={canvas} width={WIDTH} height={HEIGHT} onPointerDown={pointer} tabIndex={session?0:-1} aria-label="Ishockeybane. Tryk på hvide medspillere. Tast 1, 2 eller 3 for at aflevere, B for bandespil." onKeyDown={e=>{const g=game.current;if(!g||e.repeat)return;const index=Number(e.key)-1;if(index>=0&&index<g.stage.home.length){e.preventDefault();input(g.stage.home[index].id);}if(e.key.toLowerCase()==='b'&&g.stage.bank)input(g.stage.bank.target,true);}}/>
 {hud.short&&session&&<div className="short-banner">UNDERTAL <span>Find den frie spiller</span></div>}
 {assetError&&<div className="asset-error" role="alert">Spillergrafikken kunne ikke hentes. Genindlæs siden, før du spiller.</div>}
 </div></>;
}
