// Shared deterministic simulation. The server replays input, never trusts a submitted score.
export const GAME_VERSION = 3;
// Samlet score = overlevelsestid + 1 point per gennemført aflevering.
// Begge dele holdes i millisekund-skala, så 24.820 ms + 11 afleveringer = 35.820 = 35,82 point.
export const PASS_POINT = 1000;
export const WIDTH = 400;
export const HEIGHT = 680;
export type Point = {x:number; y:number};
export type Skater = Point & {id:string; phase:number; team:'home'|'away'};
export type Input = {t:number; target:string; bank?:boolean};
export type Reason = 'caught'|'opponent'|'intercepted'|'whistle'|'left';
export type Stage = {home:Skater[]; away:Skater[]; bank:{target:string; point:Point}|null; shortHanded:boolean};
export type Flight = {from:Point; to:Point; via:Point|null; start:number; end:number; intercepted:Point|null};
export type Game = {version:number;seed:number; step:number; active:Point; stage:Stage; readyAt:number; deadline:number; now:number; limit:number; dead:Reason|null; score:number; flight:Flight|null; impact:Point|null; passes:number; events:Input[]};

export function allowance(seconds:number,version=GAME_VERSION) { return Math.max(1000,3500 * Math.pow(.8,Math.floor(seconds/(version===1?15:10)))); }
export function rng(seed:number) { let a=seed>>>0; return ()=> {a+=0x6D2B79F5; let t=a; t=Math.imul(t^(t>>>15),t|1); t^=t+Math.imul(t^(t>>>7),t|61); return ((t^(t>>>14))>>>0)/4294967296;}; }
export function distanceToSegment(p:Point,a:Point,b:Point) {const dx=b.x-a.x,dy=b.y-a.y; const u=Math.max(0,Math.min(1,((p.x-a.x)*dx+(p.y-a.y)*dy)/(dx*dx+dy*dy||1))); return Math.hypot(p.x-a.x-u*dx,p.y-a.y-u*dy);}
export function position(p:Skater,t:number):Point {return {x:p.x+Math.sin(t/750+p.phase)*7,y:p.y};}
export function stageFor(seed:number,step:number,active:Point,t:number,version=GAME_VERSION):Stage {
 const random=rng(seed ^ Math.imul(step+1,0x45d9f3b));
 const shortHanded=t>=25000 && Math.floor(t/1000)%30>=25;
 const lanes=[78,200,322]; const safe=Math.floor(random()*3);
 const lineup:Skater[]=lanes.map((x,i)=>({id:`h${step}-${i}`,x,y:active.y-210-(i===1?100:random()*55),phase:random()*6.28,team:'home'}));
 // Undertal tager en medspiller ud af opstillingen. Modstanderne bliver stående, så presset er uændret.
 const covered=shortHanded?(safe+1)%3:-1;
 const home=lineup.filter((_,i)=>i!==covered);
 const away:Skater[]=[];
 if(step>=2) {
   for(let i=0;i<3;i++) {if(i===safe)continue;
    // Version 1-2 mistede modstanderen sammen med medspilleren i undertal. Version 3 dækker banen uanset hvad.
    const target=version>=3?lineup[i]:home.find(p=>p.x===lanes[i]); if(!target)continue;
    const p={id:`a${step}-${i}`,x:active.x+(target.x-active.x)*.62,y:active.y+(target.y-active.y)*.62,phase:random()*6.28,team:'away' as const};
    // Keep a generous, permanently open corridor to the guaranteed safe skater.
    if(distanceToSegment(p,active,lineup[safe])>51) away.push(p);
   }
 }
 const extra={id:`a${step}-wide`,x:safe===0?315:70,y:active.y-360,phase:random()*6.28,team:'away' as const}; away.push(extra);
 let bank:Stage['bank']=null;
 if(step>=3 && step%3===0) {
  const target=home.find(p=>p.x===(safe===0?322:78)) || home[0];
  const point={x:target.x>200?388:12,y:active.y-100};
  if(away.every(p=>distanceToSegment(p,active,point)>35 && distanceToSegment(p,point,target)>35)) bank={target:target.id,point};
 }
 return {home,away,bank,shortHanded};
}
export function createGame(seed:number,limit=Infinity,version=GAME_VERSION):Game {const active={x:200,y:0};return {version,seed,step:0,active,stage:stageFor(seed,0,active,0,version),readyAt:0,deadline:3500,now:0,limit,dead:null,score:0,flight:null,impact:null,passes:0,events:[]};}
function die(g:Game,reason:Reason,t:number) {g.dead=reason;g.score=Math.max(0,Math.floor(t));g.now=t;}
export function advance(g:Game,t:number) {
 if(g.dead)return; t=Math.max(g.now,t);
 // Apply the earliest event, including flight/catch/competition cutoff.
 if(g.limit<=t && (!g.flight ? g.limit<=g.deadline : g.limit<=g.flight.end)) {die(g,'whistle',g.limit);return;}
 if(g.flight && t>=g.flight.end) {
  const f=g.flight; g.flight=null;
  if(f.intercepted) {g.impact=f.intercepted;die(g,'intercepted',f.end);return;}
  g.active=f.to;g.step++;g.passes++;g.readyAt=f.end;g.deadline=f.end+allowance(f.end/1000,g.version);g.stage=stageFor(g.seed,g.step,g.active,f.end,g.version);
 }
 if(!g.flight && t>=Math.min(g.deadline,g.limit)) {const cut=g.limit<=g.deadline;die(g,cut?'whistle':'caught',cut?g.limit:g.deadline);return;}
 g.now=t;g.score=Math.floor(t);
}
export function act(g:Game,input:Input):boolean {
 advance(g,input.t); if(g.dead || g.flight || input.t<g.readyAt)return false;
 const enemy=g.stage.away.find(p=>p.id===input.target);
 const target=g.stage.home.find(p=>p.id===input.target);
 if(!target && !enemy)return false;
 if(input.bank && (!g.stage.bank || g.stage.bank.target!==input.target))return false;
 g.events.push({...input});
 if(enemy) {g.impact=position(enemy,input.t);die(g,'opponent',input.t);return true;}
 const to=position(target!,input.t); const via=input.bank?g.stage.bank!.point:null;
 const points=[g.active,...(via?[via]:[]),to];
 let interception:Point|null=null,hitLeg=-1,bestDistance=Infinity,previousLength=0;
 for(let i=1;i<points.length;i++){
  const a=points[i-1],b=points[i];
  for(const defender of g.stage.away){const p=position(defender,input.t),distance=previousLength+Math.hypot(p.x-a.x,p.y-a.y);if(distanceToSegment(p,a,b)<25&&distance<bestDistance){interception=p;hitLeg=i-1;bestDistance=distance;}}
  previousLength+=Math.hypot(b.x-a.x,b.y-a.y);
 }
 g.flight={from:{...g.active},to:interception||to,via:hitLeg===0?null:via,start:input.t,end:input.t+(g.version===1?(via?380:240):(via?600:450)),intercepted:interception};
 return true;
}
export function replay(seed:number,events:Input[],end:number,limit=Infinity,abandoned=false,version=GAME_VERSION) {
 if(!Number.isSafeInteger(end)||end<0||end>30*60*1000||!Array.isArray(events)||events.length>6000)throw new Error('Invalid run');
 const game=createGame(seed,limit,version);let last=-1;
 for(const e of events) {if(!e || !Number.isSafeInteger(e.t)||e.t<last||e.t>end||typeof e.target!=='string'||e.target.length>40||(e.bank!==undefined&&typeof e.bank!=='boolean')||!act(game,e))throw new Error('Invalid input');last=e.t;}
 // Scores are whole milliseconds; a fractional deadline is rounded down by die().
 advance(game,end+1);
 if(!game.dead && abandoned)die(game,'left',end);
 if(!game.dead || Math.abs(game.score-end)>2)throw new Error('Unfinished or altered run');
 return game;
}
// Version 1-2 blev scoret på overlevelsestid alene. Gamle resultater må ikke få afleveringer lagt til bagefter.
export const scorePasses=(g:{version:number;passes:number})=>g.version>=3?g.passes:0;
export const totalScore=(g:{version:number;score:number;passes:number})=>g.score+scorePasses(g)*PASS_POINT;
export const formatTime=(ms:number)=>`${(ms/1000).toFixed(2).replace('.',',')}`;
export const formatScore=(points:number)=>`${(points/1000).toFixed(2).replace('.',',')}`;
export const causes:Record<Reason,string>={caught:'Jægeren nåede dig, før du fik afleveret.',opponent:'Du afleverede til en modstander.',intercepted:'En modstander stod i afleveringsbanen.',whistle:'Tiden løb ud. Resultatet tæller.',left:'Du forlod spillet, så forsøget blev afbrudt.'};
export const reasons:Record<Reason,string>={caught:'Du blev indhentet',opponent:'Det var en modstander',intercepted:'Afleveringen blev afskåret',whistle:'Slutfløjt! Godt spillet',left:'Forsøget blev afbrudt'};
