'use client';
import {useEffect,useRef,useState} from 'react';
import {act,advance,causes,createGame,formatScore,formatTime,HEIGHT,position,totalScore,WIDTH,reasons,type Game,type Stage,type Point} from '@/lib/game';
import {tintOpponent} from '@/lib/sprites';
import {waitingPose,puckOffset,endpointWeight,type Pose} from '@/lib/skater-pose';
import type {OpponentKit} from '@/lib/team';
export type Session={id:string;seed:number;limit:number;practice:boolean;opponent?:OpponentKit;initialTarget?:string};
// Doedsfeedback: banen bliver staaende, aarsagen markeres, og foerst derefter toner resultatskaermen frem.
const MARK_FOR=1100,FADE_FROM=480,FADE_OVER=420;
// Lobbyens panel dækker den nederste del af banen, så demoen skubbes op i den synlige strimmel.
const LOBBY_CAMERA=360;
export default function GameCanvas({session,onEnd,onReady,opponent,onboarding=false,onboardingBusy=false,onFirstPass}:{onboarding?:boolean;onboardingBusy?:boolean;onFirstPass?:(target:string)=>void;session:Session|null;onEnd:(g:Game)=>void;onReady?:(ready:boolean)=>void;opponent?:OpponentKit}){
 const canvas=useRef<HTMLCanvasElement>(null);const game=useRef<Game|null>(null);const camera=useRef(0);const start=useRef(0);const callback=useRef(onEnd);callback.current=onEnd;
 const [hud,setHud]=useState({time:0,passes:0,points:0,short:false,step:0,flight:false});const [assetError,setAssetError]=useState(false);
 const kit=session?.opponent||opponent;const kitKey=`${kit?.primary||''}${kit?.stripe||''}`;
 useEffect(()=>{
  let frame=0,stopped=false,ended=false,lastHud=0,shapeScale=1,lastFrame=0,deadAt=0,frameNow=0,idleStart=0;let previousStage:Stage|null=null,previousActive:Point|null=null;let renderedStage:Stage;const ctx=canvas.current!.getContext('2d',{alpha:false,desynchronized:true})!;
  const lowPower=typeof navigator!=='undefined' && ((navigator.hardwareConcurrency||4)<=4 || (navigator as Navigator & {connection?:{saveData?:boolean}}).connection?.saveData===true);
  // To skridtfaser per hold. Hver spiller beholder sin egen fase, så staven aldrig hopper fra
  // den ene side af kroppen til den anden midt i et skøjtetag.
  const load=(src:string)=>{const image=new Image();image.src=src;return image;};
  const homeGlide=load('/assets/bulldogs-glide-v6.webp'),homeStride=load('/assets/bulldogs-stride.webp');
  const homeReceive=load('/assets/bulldogs-receive-v6.webp'),awayReceive=load('/assets/opponent-receive-v6.webp');
  const awayGlide=load('/assets/opponent-glide.webp'),awayStride=load('/assets/opponent-stride.webp');
  const logo=load('/assets/bulldogs-logo.png');
  let awayGlideArt:CanvasImageSource=awayGlide,awayStrideArt:CanvasImageSource=awayStride,awayReceiveArt:CanvasImageSource=awayReceive;
  // Sprite'erne er centreret på kroppen, ikke på staven, så spilleren står dér, hvor man trykker.
  const SIZE=122;
  const stridesFor=(id:string)=>id.charCodeAt(id.length-1)%2===1;
  const art=(team:'home'|'away',stride:boolean):CanvasImageSource=>
   team==='home'?(stride?homeStride:homeGlide):(stride?awayStrideArt:awayGlideArt);
  const g=createGame(session?.seed||1978,session?.limit??Infinity);game.current=g;camera.current=0;renderedStage=g.stage;
  let landing:Pose={front:0,mirror:false,angle:0,stride:false};
  let flightStamp=-1,launch=landing,receiver=landing;
  const activePose=(time:number):Pose=>{
    const blend=g.step>0?Math.max(0,1-(time-g.readyAt)/300):0;
    return {...landing,front:landing.front*blend,angle:landing.angle*blend+Math.sin(time/800)*.035*(1-blend)};
  };
  const loaded=Promise.all([homeGlide,homeStride,awayGlide,awayStride,homeReceive,awayReceive,logo].map(im=>im.decode()));
  const skater=(point:Point,team:'home'|'away',stride=false,alpha=1,angle=0,front=0,mirror=false)=>{
    const x=point.x,y=point.y-camera.current+490;ctx.save();ctx.globalAlpha=alpha;
    ctx.fillStyle='rgba(19,46,59,.16)';ctx.beginPath();ctx.ellipse(x,y+17,25,8,0,0,Math.PI*2);ctx.fill();
    ctx.translate(x,y);ctx.rotate(angle);ctx.scale(mirror?-1:1,1);
    // Both views share a body-centred anchor. Crossfade on reception instead of spinning a flat sprite.
    if(front<1){ctx.globalAlpha=alpha*(1-front);ctx.drawImage(art(team,stride),-SIZE/2,-SIZE*shapeScale/2,SIZE,SIZE*shapeScale);}
    if(front>0){ctx.globalAlpha=alpha*front;ctx.drawImage(team==='home'?homeReceive:awayReceiveArt,-SIZE/2,-SIZE*shapeScale/2,SIZE,SIZE*shapeScale);}
    ctx.restore();
  };
  // En lille drejning mod spillet. Nok til at give retning, ikke nok til at se forkert ud.
  const lean=(x:number,towards:number,strength=900)=>Math.max(-.2,Math.min(.2,(towards-x)/strength));
  const drawPuck=(x:number,y:number)=>{
    ctx.save();ctx.fillStyle='rgba(12,24,24,.22)';ctx.beginPath();ctx.ellipse(x+2,y+3,7,4,0,0,Math.PI*2);ctx.fill();
    ctx.fillStyle='#11191a';ctx.beginPath();ctx.ellipse(x,y,6.5,3.8,0,0,Math.PI*2);ctx.fill();
    ctx.strokeStyle='rgba(255,255,255,.18)';ctx.lineWidth=1;ctx.beginPath();ctx.ellipse(x,y-1,4.5,2,0,Math.PI,Math.PI*2);ctx.stroke();ctx.restore();
  };
  // Hvor gik det galt? Jaegeren staar oven i puckholderen, afskaering og fejlaflevering har deres eget punkt.
  const blame=():Point|null=>g.dead==='caught'?{x:g.active.x,y:g.active.y+37}:(g.dead==='opponent'||g.dead==='intercepted')?g.impact:null;
  const draw=()=>{
    ctx.setTransform(1,0,0,1,0,0);const dpr=lowPower?1:Math.min(window.devicePixelRatio||1,2);const w=Math.round(WIDTH*dpr),h=Math.round(HEIGHT*dpr);if(canvas.current!.width!==w){canvas.current!.width=w;canvas.current!.height=h;}ctx.scale(dpr,dpr);shapeScale=HEIGHT*canvas.current!.clientWidth/(WIDTH*canvas.current!.clientHeight);
    const gradient=ctx.createLinearGradient(0,0,WIDTH,HEIGHT);gradient.addColorStop(0,'#eef5f5');gradient.addColorStop(.5,'#ffffff');gradient.addColorStop(1,'#dce9ed');ctx.fillStyle=gradient;ctx.fillRect(0,0,WIDTH,HEIGHT);
    ctx.save();ctx.strokeStyle='rgba(90,121,132,.045)';ctx.lineWidth=1;
    // Skoejtesporene foelger isen 1:1. To baand, saa der aldrig opstaar en tom stribe i toppen.
    if(!lowPower)for(let i=0;i<75;i++){const x=(i*137)%400,y=((i*91-camera.current)%680+680)%680;for(const offset of [0,-680]){ctx.beginPath();ctx.moveTo(x,y+offset);ctx.lineTo(x+60,y+offset-95);ctx.stroke();}}ctx.restore();
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
    const arrival=Math.min(1,Math.max(0,(g.now-g.readyAt)/300));
    if(g.flight&&flightStamp!==g.flight.start){flightStamp=g.flight.start;launch=activePose(g.flight.start);receiver=waitingPose(g.events.at(-1)!.target,g.flight.to.x,g.flight.from.x);}
    const drawPose=(at:Point,team:'home'|'away',pose:Pose,alpha=1)=>skater(at,team,pose.stride,alpha,pose.angle,pose.front,pose.mirror);
    if(previousStage&&arrival<1){previousStage.home.forEach(p=>{if(p.id!==g.events.at(-1)?.target){const at=position(p,g.now);drawPose(at,'home',waitingPose(p.id,at.x,previousActive?.x??g.active.x),1-arrival);}});previousStage.away.forEach(p=>{const at=position(p,g.now);drawPose(at,'away',waitingPose(p.id,at.x,previousActive?.x??g.active.x),1-arrival);});if(previousActive)drawPose(previousActive,'home',launch,1-arrival);}
    g.stage.home.forEach(p=>{const receiving=g.flight&&!g.flight.intercepted&&p.id===g.events.at(-1)?.target;const at=receiving?g.flight!.to:position(p,g.now);
     drawPose(at,'home',receiving?receiver:waitingPose(p.id,at.x,g.active.x));});
    g.stage.away.forEach(p=>{const at=position(p,g.now);drawPose(at,'away',waitingPose(p.id,at.x,g.active.x));});
    if(!g.flight&&g.step>0&&arrival<1){ctx.strokeStyle=`rgba(228,131,49,${.6*(1-arrival)})`;ctx.lineWidth=3;ctx.beginPath();ctx.arc(g.active.x,g.active.y-camera.current+490,40+arrival*12,0,Math.PI*2);ctx.stroke();}
    const pressure=Math.min(1,Math.max(0,(g.now-g.readyAt)/(g.deadline-g.readyAt)));
    const chaser={x:g.active.x+Math.sin(g.now/200)*3,y:g.active.y+120-pressure*83};
    skater(chaser,'away',false,1,lean(chaser.x,g.active.x,500));
    if(!g.flight){const x=g.active.x,y=g.active.y-camera.current+490;ctx.strokeStyle='rgba(24,73,46,.14)';ctx.lineWidth=5;ctx.beginPath();ctx.arc(x,y,40,0,Math.PI*2);ctx.stroke();ctx.strokeStyle=`hsl(${120*(1-pressure)},65%,${pressure>.7?46:36}%)`;ctx.beginPath();ctx.arc(x,y,40,-Math.PI/2,-Math.PI/2+Math.PI*2*(1-pressure));ctx.stroke();const pose=activePose(g.now);drawPose(g.active,'home',pose);const offset=puckOffset(pose,shapeScale);drawPuck(x+offset.x,y+offset.y);}
    else{const f=g.flight;const raw=Math.min(1,Math.max(0,(g.now-f.start)/(f.end-f.start)));const ease=(n:number)=>n*n*(3-2*n);const u=ease(raw);
      // The receiver is drawn once at the simulation's landing point.
      drawPose(f.from,'home',launch);
      if(!f.intercepted) { const rx=f.to.x,ry=f.to.y-camera.current+490;ctx.strokeStyle=`rgba(228,131,49,${.12+.25*u})`;ctx.lineWidth=3;ctx.beginPath();ctx.arc(rx,ry,34+5*u,0,Math.PI*2);ctx.stroke(); }
      const a=f.via?(raw<.5?f.from:f.via):f.from;const b=f.via?(raw<.5?f.via:f.to):f.to;const leg=f.via?(raw<.5?raw*2:(raw-.5)*2):raw;const v=leg;
      const fromOffset=puckOffset(launch,shapeScale),toOffset=puckOffset(receiver,shapeScale);
      const startWeight=endpointWeight(raw),endWeight=f.intercepted?0:endpointWeight(1-raw);
      const x=a.x+(b.x-a.x)*v+fromOffset.x*startWeight+toOffset.x*endWeight,y=a.y+(b.y-a.y)*v-camera.current+490+fromOffset.y*startWeight+toOffset.y*endWeight;
      ctx.strokeStyle='rgba(15,31,33,.2)';ctx.lineWidth=4;ctx.beginPath();ctx.moveTo(x-(b.x-a.x)*.08,y-(b.y-a.y)*.08);ctx.lineTo(x,y);ctx.stroke();drawPuck(x,y);}
    if(onboarding){
      ctx.fillStyle='rgba(5,24,18,.72)';ctx.fillRect(0,0,WIDTH,HEIGHT);
      // Redraw only the selectable Bulldogs and puckholder above the dimmed rink.
      g.stage.home.forEach(p=>{const at=position(p,0);ctx.strokeStyle='#E48331';ctx.lineWidth=2;ctx.beginPath();ctx.ellipse(at.x,at.y-camera.current+490,43,43*shapeScale,0,0,Math.PI*2);ctx.stroke();drawPose(at,'home',waitingPose(p.id,at.x,g.active.x));});
      const pose=activePose(0);drawPose(g.active,'home',pose);const offset=puckOffset(pose,shapeScale);drawPuck(g.active.x+offset.x,g.active.y-camera.current+490+offset.y);
      ctx.textAlign='center';ctx.fillStyle='#fff';ctx.font='bold 20px Arial';ctx.fillText('DU ER BULLDOGS I HVIDT',200,53);
      ctx.font='15px Arial';ctx.fillText('Tryk på en hvid medspiller foran dig',200,83);
      ctx.fillStyle='#dce8df';ctx.font='13px Arial';ctx.fillText('Første aflevering starter dit forsøg',200,110);
      ctx.fillStyle='#fff';ctx.font='bold 14px Arial';ctx.fillText('DIG · MED PUCKEN',g.active.x,g.active.y-camera.current+565);
    }
    const since=deadAt?frameNow-deadAt:0;
    const spot=g.dead?blame():null;
    if(spot){const pulse=.5+.5*Math.sin(since/95);const y=spot.y-camera.current+490;
      ctx.save();ctx.strokeStyle=`rgba(180,35,42,${.45+.5*pulse})`;ctx.lineWidth=4;ctx.beginPath();ctx.ellipse(spot.x,y,34+since*.022,(34+since*.022)*shapeScale,0,0,Math.PI*2);ctx.stroke();
      ctx.strokeStyle='rgba(180,35,42,.75)';ctx.lineWidth=3;for(const d of [-1,1]){ctx.beginPath();ctx.moveTo(spot.x-13*d,y-13);ctx.lineTo(spot.x+13*d,y+13);ctx.stroke();}ctx.restore();}
    if(g.dead&&session){const fade=Math.min(1,Math.max(0,(since-FADE_FROM)/FADE_OVER));
      if(fade>0){ctx.save();ctx.globalAlpha=fade;ctx.fillStyle='rgba(11,36,26,.9)';ctx.fillRect(0,0,WIDTH,HEIGHT);
      ctx.fillStyle='#E48331';ctx.font='bold 13px Arial';ctx.textAlign='center';ctx.fillText('DIT FORSØG ER SLUT',WIDTH/2,HEIGHT/2-54);
      ctx.fillStyle='#fff';ctx.font='bold 29px Arial';ctx.fillText(reasons[g.dead],WIDTH/2,HEIGHT/2-6);
      ctx.fillStyle='#c8d8cc';ctx.font='14px Arial';ctx.fillText(causes[g.dead],WIDTH/2,HEIGHT/2+28);
      ctx.fillStyle='#93ab99';ctx.font='13px Arial';ctx.fillText('Resultatet bliver gemt…',WIDTH/2,HEIGHT/2+58);ctx.restore();}}
    if(session&&g.step<2&&!g.dead){ctx.fillStyle='#18492e';ctx.font='bold 14px Arial';ctx.textAlign='center';ctx.fillText('TRYK PÅ EN HVID MEDSPILLER',200,70);ctx.font='12px Arial';ctx.fillText('DU SPILLER FOR BULLDOGS · FREMAD ↑',200,92);}
  };
  const finish=()=>{if(!ended){ended=true;window.setTimeout(()=>callback.current({...g,events:[...g.events]}),MARK_FOR);}};
  let lastPasser:Point|null=null;
  const loop=(now:number)=>{
   if(stopped)return;
   frameNow=now;
   if(session){advance(g,Math.floor(now-start.current));if(g.dead){if(!deadAt){deadAt=now;try{navigator.vibrate?.(g.dead==='whistle'?[40,70,40]:70);}catch{}}finish();}}
   else if(!onboarding){
    // Stille demo i lobbyen: spillerne vugger, og jægeren lukker op og falder tilbage igen,
    // så man kan se, hvad ringen betyder, før man selv starter. Intet kan dø her.
    const elapsed=now-idleStart;
    g.now=Math.floor(elapsed);
    const closing=(1-Math.cos(elapsed/2600))/2;
    g.readyAt=g.now-closing*3400;g.deadline=g.readyAt+3400;
   }
   if(renderedStage!==g.stage){previousStage=renderedStage;previousActive=g.events.length?lastPasser:null;renderedStage=g.stage;landing=receiver;}
   if(g.flight)lastPasser=g.flight.from;
   const progress=g.flight?Math.min(1,Math.max(0,(g.now-g.flight.start)/(g.flight.end-g.flight.start))):1;
   const eased=progress*progress*(3-2*progress);
   const targetCamera=!session&&!onboarding?LOBBY_CAMERA:g.flight?g.flight.from.y+(g.flight.to.y-g.flight.from.y)*eased:g.active.y;
   const dt=lastFrame?Math.min(100,now-lastFrame):16.67;lastFrame=now;
   camera.current+=(targetCamera-camera.current)*(1-Math.exp(-dt/85));
   draw();
   if(now-lastHud>60){setHud({time:g.score,passes:g.passes,points:totalScore(g),short:g.stage.shortHanded,step:g.step,flight:!!g.flight});lastHud=now;}
   // Billederne fortsaetter lidt efter doeden, saa aarsagen naar at blive set, foer skaermen toner ned.
   // frame nulstilles, naar sloejfen stopper, saa demoen kan startes igen ved fanevisning.
   frame=(session?(!g.dead||now-deadAt<MARK_FOR):(!document.hidden&&!stillness))?requestAnimationFrame(loop):0;
  };
  const stillness=typeof matchMedia!=='undefined'&&matchMedia('(prefers-reduced-motion: reduce)').matches;
  loaded.then(()=>{if(stopped)return;if(kit){awayGlideArt=tintOpponent(awayGlide,kit);awayStrideArt=tintOpponent(awayStride,kit);awayReceiveArt=tintOpponent(awayReceive,kit);}start.current=performance.now();idleStart=start.current;if(session?.initialTarget)act(g,{t:0,target:session.initialTarget});onReady?.(true);frame=requestAnimationFrame(loop);}).catch(()=>{if(!stopped){setAssetError(true);onReady?.(false);}});
  const visibility=()=>{if(!session&&!document.hidden&&!stillness&&!frame){idleStart=performance.now()-g.now;frame=requestAnimationFrame(loop);return;}
   if(document.hidden&&session&&!g.dead){advance(g,Math.floor(performance.now()-start.current));if(!g.dead){g.dead='left';g.score=Math.floor(g.now);}finish();}};document.addEventListener('visibilitychange',visibility);
  return()=>{stopped=true;cancelAnimationFrame(frame);document.removeEventListener('visibilitychange',visibility);};
 },[session,onReady,kitKey,onboarding]);// eslint-disable-line react-hooks/exhaustive-deps
 function input(target:string,bank=false){const g=game.current;if(!session||!g||g.dead)return;act(g,{t:Math.floor(performance.now()-start.current),target,bank});}
 function pointer(e:React.PointerEvent<HTMLCanvasElement>){const g=game.current;if(!g)return;const rect=e.currentTarget.getBoundingClientRect();const x=(e.clientX-rect.left)/rect.width*WIDTH,y=(e.clientY-rect.top)/rect.height*HEIGHT+camera.current-490;
  if(onboarding){if(onboardingBusy)return;const target=g.stage.home.find(p=>Math.hypot(x-position(p,0).x,y-p.y)<43);if(target)onFirstPass?.(target.id);return;}
  const b=g.stage.bank;if(b&&Math.hypot(x-b.point.x,y-b.point.y)<43){input(b.target,true);return;}
  const candidates=[...g.stage.home,...g.stage.away].map(p=>({p,d:Math.hypot(x-position(p,g.now).x,y-p.y)})).sort((a,b)=>a.d-b.d);if(candidates[0]?.d<43)input(candidates[0].p.id);
 }
 return <><div className={`game-hud ${onboarding?'onboarding-hud':''}`}><div><span>SCORE</span><strong>{formatScore(hud.points)}<small> POINT</small></strong></div>
 <div className="metric"><span>OVERLEVELSE</span><strong>{formatTime(hud.time)}<small> SEK</small></strong></div>
 <div className="metric passes"><span>AFLEVERINGER</span><strong>{String(hud.passes).padStart(2,'0')}</strong></div></div>
 <div className="canvas-box"><canvas ref={canvas} width={WIDTH} height={HEIGHT} onPointerDown={pointer} aria-label="Ishockeybane. Tryk på hvide Bulldogs-medspillere for at aflevere." />
 {onboarding&&<p className="onboarding-status" role="status">{onboardingBusy?'Gør dit forsøg klar…':'Tag dig god tid – uret er ikke startet'}</p>}
 {hud.short&&session&&<div className="short-banner">UNDERTAL <span>Færre medspillere. Samme pres.</span></div>}
 {assetError&&<div className="asset-error" role="alert">Spillergrafikken kunne ikke hentes. Genindlæs siden, før du spiller.</div>}
 </div></>;
}
