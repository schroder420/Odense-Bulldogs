'use client';
import {useCallback,useEffect,useRef,useState} from 'react';
import {ArrowUpRight,ArrowRight,Trophy,ShieldCheck,RotateCcw,Ticket,MoveUpRight,Maximize2,Star} from 'lucide-react';
import {Brand,Footer} from './Brand';
import GameCanvas,{type Session} from './GameCanvas';
import TeamKey from './TeamKey';
import {roundKit} from '@/lib/team';
import {causes,formatScore,formatTime,reasons,totalScore,GAME_VERSION,type Game} from '@/lib/game';
import {api} from '@/lib/client';
import type {Board,Me} from '@/lib/types';
import PrizeVoucher from './PrizeVoucher';
export default function GamePage(){
 const [board,setBoard]=useState<Board|null>(null),[me,setMe]=useState<Me|null>(null),[nickname,setNickname]=useState('');
 const [session,setSession]=useState<Session|null>(null),[result,setResult]=useState<Game|null>(null),[busy,setBusy]=useState(false),[playing,setPlaying]=useState(false),[error,setError]=useState(''),[saved,setSaved]=useState(false),[practiceBest,setPracticeBest]=useState(0),[ready,setReady]=useState(false),[rules,setRules]=useState(false),[pending,setPending]=useState(false);
 // Placeringen udledes af den top 10, der allerede er hentet til storskærmen. Ingen ekstra kald til serveren.
 function standing(){
  const entries=board?.entries||[],best=me?.best||0;
  if(!board?.round||board.round.status==='final'||!best||!me)return null;
  const mine=entries.find(e=>e.participant_id===me.id);
  if(mine)return {rank:mine.rank,gap:0};
  const last=entries[entries.length-1];
  if(!last||entries.length<10||best>=last.score_points)return {rank:entries.filter(e=>e.score_points>best).length+1,gap:0};
  return {rank:0,gap:last.score_points-best};
 }
 const [intro,setIntro]=useState<boolean|null>(null);
 const launchPending=useRef(false);
 const mounted=useRef(true);const lastProfile=useRef(0),lastRound=useRef(''),profileLoaded=useRef(false),bestBefore=useRef(0);const onReady=useCallback((value:boolean)=>setReady(value),[]);
 useEffect(()=>{mounted.current=true;try{setPracticeBest(Number(localStorage.getItem('bulldogs-practice-best-v3')||0));setNickname(localStorage.getItem('bulldogs-nickname')||'');setPending(!!localStorage.getItem('bulldogs-pending'));}catch{}return()=>{mounted.current=false;};},[]);
 const refresh=useCallback(async(forceMe=false)=>{try{const b=await api<Board>('board');if(!mounted.current)return;setBoard(b);const roundKey=`${b.round?.id}:${b.round?.status}`;if(forceMe||Date.now()-lastProfile.current>30000||lastRound.current!==roundKey){const m=await api<Me|null>('me');if(!mounted.current)return;setMe(m);if(m&&!profileLoaded.current)setNickname(m.nickname);profileLoaded.current=true;lastProfile.current=Date.now();}lastRound.current=roundKey;}catch{if(mounted.current)setError('Vi kan ikke hente konkurrencen lige nu. Du kan stadig træne.');}},[]);
 useEffect(()=>{if(playing)return;refresh(true);const timer=setInterval(()=>{if(!document.hidden)refresh();},7000+Math.random()*2000);return()=>clearInterval(timer);},[playing,refresh]);
 const open=board?.round?.status==='open'&&new Date(board.round.ends_at).getTime()>Date.now();
 async function submit(payload:unknown){await api('run/finish',payload);try{localStorage.removeItem('bulldogs-pending');}catch{}setPending(false);setSaved(true);setError('');await refresh(true);}
 async function retry(){setBusy(true);try{const value=localStorage.getItem('bulldogs-pending');if(value)await submit(JSON.parse(value));}catch(e){setError(e instanceof Error?e.message:'Resultatet kunne ikke sendes.');}finally{setBusy(false);}}
 async function begin(practice:boolean){if(busy||!ready)return;setBusy(true);setError('');setSaved(false);setResult(null);
  bestBefore.current=practice?practiceBest:me?.best||0;
  try{
   if(!practice){if(pending)throw new Error('Send dit ventende resultat, før du starter et nyt forsøg.');await api('join',{nickname});}
   try{localStorage.setItem('bulldogs-nickname',nickname);}catch{}
   setSession(null);setIntro(practice);setPlaying(true);
  }catch(e){setError(e instanceof Error?e.message:'Spillet kunne ikke starte.');}finally{setBusy(false);}
 }
 const launch=async(target:string)=>{if(busy||intro===null||launchPending.current)return;launchPending.current=true;setBusy(true);setError('');
  const practice=intro;
  try{
   const run=practice?{id:`practice-${Date.now()}`,seed:crypto.getRandomValues(new Uint32Array(1))[0],limit:Infinity,opponent:roundKit(board?.round)}:await api('run/start',{version:GAME_VERSION});
   if(!mounted.current)return;
   setSession({...run,practice,initialTarget:target,opponent:run.opponent||roundKit(board?.round)});setIntro(null);
  }catch(e){setError(e instanceof Error?e.message:'Spillet kunne ikke starte.');setIntro(null);setPlaying(false);}
  finally{launchPending.current=false;setBusy(false);}
 };
 const finish=async(g:Game)=>{setPlaying(false);setResult(g);
  if(session?.practice){const best=Math.max(practiceBest,totalScore(g));setPracticeBest(best);try{localStorage.setItem('bulldogs-practice-best-v3',String(best));}catch{}return;}
  if(!session)return;const payload={id:session.id,events:g.events,end:g.score,abandoned:g.dead==='left'};try{localStorage.setItem('bulldogs-pending',JSON.stringify(payload));}catch{}setPending(true);try{await submit(payload);}catch(e){setError(e instanceof Error?e.message:'Resultatet afventer forbindelse.');}
 };
 const showSurvey=!!me&&board?.round?.status==='final'&&me.roundId===board.round.id&&me.roundStatus==='final'&&me.rank===null;
 const enterFullscreen=()=>{const element=document.documentElement as HTMLElement & {requestFullscreen?:()=>Promise<void>};element.requestFullscreen?.().catch(()=>{});};
 return <div className={`page game-page ${playing?'is-playing':''} ${intro!==null?'has-onboarding':''}`}><header><Brand/><span className="event-label"><span className="diamond"/>{playing?(intro!==null?'DIN FØRSTE AFLEVERING':session?.practice?'TRÆNING':'KONKURRENCEN ER I GANG'):open?'KAMPENS PAUSE':'PAUSESPILLET'}{playing&&<button className="game-fullscreen" aria-label="Åbn spillet i fuld skærm" onClick={enterFullscreen}><Maximize2 size={16}/></button>}</span></header>
 <main className="play-layout"><section className="side-copy"><p className="eyebrow"><span/> ISEN ER DIN</p><h1>HOLD<br/>PUCKEN<br/><em>I LIVE.</em></h1><p className="lede">Ét tryk. En ny chance.<br/>Hvor længe kan du holde presset væk?</p>
 <div className="instructions"><div><b>01</b><p><strong>Find din medspiller</strong><span>Hvid trøje. Fri afleveringsbane.</span></p><MoveUpRight/></div><div><b>02</b><p><strong>Spil, før du bliver fanget</strong><span>Ringen bliver rød, når presset stiger.</span></p><RotateCcw/></div><div><b>03</b><p><strong>Hver aflevering giver point</strong><span>Sekunder + afleveringer. Bedste forsøg tæller.</span></p><Trophy/></div></div>
 <div className="prize-strip"><Trophy size={24}/><p><strong>{board?.round?.prize||'KÆMP DIG IND I TOP 5'}</strong><span>{board?.round?'Kampens bedste tider vinder.':'Spil dig varm inden næste konkurrence.'}</span></p></div>
 </section>
 <section className="game-column" aria-label="Spillet"><div className="game-frame"><div className="frame-label"><span>BULLDOGS / SURVIVAL</span><span>{session?.practice||!open?'TRÆNING':'LIVE'}</span></div>
 <GameCanvas onboarding={intro!==null} onboardingBusy={busy} onFirstPass={launch} session={session} opponent={roundKit(board?.round)} onEnd={finish} onReady={onReady}/>
 {!playing&&<div className={`game-overlay ${result?'has-result':''}`}>
  {result?<><p className="eyebrow">{session?.practice?'TRÆNINGSRESULTAT':saved?'RESULTAT GEMT':'DIT RESULTAT'}</p><h2>{reasons[result.dead!]}</h2><p className="result-cause">{causes[result.dead!]}</p><div className="result-time">{formatScore(totalScore(result))}<span>POINT I ALT</span></div><p className="result-detail">{formatTime(result.score)} sek. <span>·</span> {result.passes} afleveringer <span>·</span> Bedste {formatScore(session?.practice?practiceBest:Math.max(me?.best||0,saved?totalScore(result):0))}</p>
  {bestBefore.current>0&&totalScore(result)>bestBefore.current&&<p className="record"><Star size={15}/> NY PERSONLIG REKORD</p>}
  {!session?.practice&&saved&&(()=>{const s=standing();return s?<p className="standing">{s.rank?`Du ligger nummer ${s.rank}`:`Du mangler ${formatScore(s.gap)} point for at nå top 10`}</p>:null;})()}{!session?.practice&&<p className="save-status">{saved?<><ShieldCheck size={15}/> Dit resultat er godkendt og gemt</>:'Dit resultat afventer godkendelse'}</p>}<button className="primary" disabled={busy||(!session?.practice&&pending)} onClick={()=>begin(session?.practice||!open)}><RotateCcw size={18}/>Spil igen<ArrowRight size={20}/></button><button className="text-button" onClick={()=>{setResult(null);setSession(null);}}>Tilbage til start</button></>:<>
  <div className="lobby-heading"><span className="mini-logo"><img src="/assets/bulldogs-logo.png" alt=""/></span><div><p className="eyebrow">{open?'DIN TUR PÅ ISEN':'KLAR TIL FØRSTE AFLEVERING?'}</p><h2>Hvor længe holder du?</h2></div></div>
  <TeamKey kit={roundKit(board?.round)}/>
  <p className="lobby-help"><strong>1 point per sekund. 1 point per aflevering.</strong></p>
  {(()=>{const s=standing();return s?<p className="standing lobby">{s.rank?<><Trophy size={14}/> Du ligger nummer {s.rank} lige nu</>:<>Du mangler {formatScore(s.gap)} point for at nå top 10</>}</p>:null;})()}
  <label className="name-label">{open?'Dit navn på storskærmen':'Dit navn til træning (valgfrit)'}<input value={nickname} onChange={e=>setNickname(e.target.value)} placeholder="Fx BulldogsFan78" minLength={2} maxLength={18} autoComplete="nickname" enterKeyHint="done"/></label>
  <button className="primary" disabled={busy||!ready||(!!open&&nickname.trim().length<2)|| (!!open&&pending)} onClick={()=>begin(!open)}>{busy?'GØR ISEN KLAR…':open?'SPIL MED':'PRØV SPILLET'}<ArrowUpRight size={22}/></button>
  {open?<button className="text-button" disabled={busy} onClick={()=>begin(true)}>Tag en træningsrunde først</button>:<p className="practice-note">Træning · tæller ikke i konkurrencen</p>}
  <button className="rules-toggle" onClick={()=>setRules(!rules)} aria-expanded={rules}>{rules?'Skjul spilleregler':'Sådan spiller du'}</button>
  </>}
 </div>}
 </div>
 {error&&<div className="notice" role="alert">{error}</div>}{pending&&!playing&&<><button className="secondary retry" onClick={retry} disabled={busy}>Send ventende resultat igen</button><button className="text-button" disabled={busy} onClick={()=>{if(window.confirm('Opgiv det ventende resultat? Det kan ikke sendes igen bagefter.')){localStorage.removeItem('bulldogs-pending');setPending(false);setError('');}}}>Opgiv det ventende resultat</button></>}
 {rules&&!playing&&<div className="rules-panel"><h3>Sådan holder du pucken i live</h3><p>Tryk på en hvid medspiller foran dig. Mørke spillere kan både tackle dig og afskære afleveringen.</p><p>Ringen går fra grøn til rød og tømmes, når jægeren nærmer sig. En tom ring betyder, at du er fanget.</p><p>Lyser banden orange, kan du trykke på den for at følge den stiplede rute. Undertal giver færre medspillere i korte perioder.</p><p>Du starter med 3,5 sekunder til at aflevere. Hvert 10. sekund falder tiden med 20 %, indtil den når 1 sekund.</p><p>Din score er overlevelsestiden i sekunder plus ét point for hver gennemført aflevering. 24,82 sekunder og 11 afleveringer giver 35,82 point.</p><p>Flere forsøg er tilladt. Bedste score tæller. Ved samme score vinder den, der nåede den først. Skifter du væk fra spillet, slutter forsøget.</p><p>Gem denne browser til præmieudlevering. Kaldenavn og resultat vises offentligt; din deltageradgang gemmes i en nødvendig cookie.</p></div>}
 {!playing&&(showSurvey?<section className="claim-card survey-card" aria-labelledby="survey-title"><p className="eyebrow">TAK FOR KAMPEN!</p><h2 id="survey-title">Hvad synes du om spillet?</h2><p>Du kom ikke i top 5 denne gang. Hjælp os med at gøre pausespillet bedre ved at svare på spørgeskemaet.</p><a className="primary" href="https://tally.so/r/EkpNrN" target="_blank" rel="noopener noreferrer">Svar på spørgeskemaet <ArrowUpRight size={20}/></a></section>:me?.claim?<PrizeVoucher key={me.claim.code} claim={me.claim}/>:null)}
 </section></main><Footer/></div>;
}
