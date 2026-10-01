'use client';
import {useEffect,useRef,useState} from 'react';
import QRCode from 'qrcode';
import {Brand} from '@/components/Brand';
import ScreenFit from '@/components/ScreenFit';
import ArenaFrame from '@/components/ArenaFrame';
import ScreenDemo from '@/components/ScreenDemo';
import {roundKit} from '@/lib/team';
import {formatScore} from '@/lib/game';
import {screenView} from '@/lib/screen';
import type {Board} from '@/lib/types';
export default function Leaderboard(){
 const [board,setBoard]=useState<Board|null>(null),[qr,setQr]=useState(''),[error,setError]=useState(''),[offline,setOffline]=useState(false),[now,setNow]=useState(Date.now()),[offset,setOffset]=useState(0),[updated,setUpdated]=useState(false);
 const signature=useRef<string|null>(null);
 useEffect(()=>{
  let gone=false,busy=false;let toast:ReturnType<typeof setTimeout>;
  const round=new URLSearchParams(location.search).get('round');
  const fragment=new URLSearchParams(location.hash.slice(1)).get('token');let token=fragment||'';
  try{if(fragment){sessionStorage.setItem(`bulldogs-screen:${round}`,fragment);history.replaceState(null,'',location.pathname+location.search);}else token=sessionStorage.getItem(`bulldogs-screen:${round}`)||'';}catch{}
  if(!round||!token){setError('Åbn konkurrencens storskærmslink fra personalepanelet.');return;}
  QRCode.toString(`${location.origin}/?round=${encodeURIComponent(round)}`,{type:'svg',margin:4,errorCorrectionLevel:'M',color:{dark:'#08251b',light:'#adc4ac'}}).then(svg=>{if(!gone)setQr('data:image/svg+xml;charset=utf-8,'+encodeURIComponent(svg));});
  const update=async()=>{if(busy)return;busy=true;const started=Date.now();try{
   const response=await fetch(`/api/screen-board?round=${encodeURIComponent(round)}`,{headers:{Authorization:`Bearer ${token}`},cache:'no-store'});const b=await response.json();
   if(!response.ok)throw new Error(b.error||'Forbindelsen er afbrudt.');
   if(b.round?.id!==round)throw new Error('Storskærmen modtog en forkert runde.');
   if(!gone){const next=JSON.stringify(b.entries);if(signature.current!==null&&next!==signature.current){setUpdated(true);clearTimeout(toast);toast=setTimeout(()=>setUpdated(false),1800);}signature.current=next;setBoard(b);setOffset(Date.parse(b.serverTime)-(started+Date.now())/2);setOffline(false);setError('');}
  }catch(e){if(!gone){setOffline(true);setError((e as Error).message);}}finally{busy=false;}};
  update();const poll=setInterval(update,1000),clock=setInterval(()=>setNow(Date.now()),100);
  return()=>{gone=true;clearInterval(poll);clearInterval(clock);clearTimeout(toast);};
 },[]);
 if(!board)return <div className="screen-lock"><Brand/><section><h1>STORSKÆRM</h1><p>{error||'Henter konkurrencen…'}</p><a className="secondary" href="/admin">Til personalepanelet</a></section></div>;
 const round=board.round!,time=now+offset,view=screenView(round,time),remaining=Math.max(0,Math.ceil((Date.parse(round.ends_at)-time)/1000)),scheduled=time<Date.parse(round.starts_at),final=round.status==='final';
 const countdown=`${Math.floor(remaining/60)}:${String(remaining%60).padStart(2,'0')}`;
 const status=offline?'FORBINDELSE AFBRUDT':final?'KAMPENS VINDERE':view==='collecting'?'SPILLET ER SLUT':scheduled?`START KL. ${new Date(round.starts_at).toLocaleTimeString('da-DK',{hour:'2-digit',minute:'2-digit',second:'2-digit',timeZone:'Europe/Copenhagen'})}`:`SLUT OM ${countdown}`;
 const qrImage=qr?<img src={qr} alt="Scan og åbn Bulldogs-spillet"/>:<span>Henter QR…</span>;
 if(view==='qr')return <div className="arena-qr-only">{qrImage}<span>SCAN & SPIL MED</span>{offline&&<small>{status}</small>}</div>;
 return <ArenaFrame><div className={`arena-v2 view-${view}`}>
  <header><Brand/><span className={offline?'offline':''}>{status}</span></header>
  <div className="arena-v2-grid"><section className="arena-slide" key={view}>
   {view==='countdown'?<div className="arena-count"><span>SPILLET SLUTTER OM</span><strong>{remaining}</strong></div>:
    view==='collecting'?<div className="arena-collect"><h1>TAK FOR<br/>SPILLET!</h1><p>Vi finder vinderne …</p><span className="collect-dots">● ● ●</span></div>:
    view==='winners'?<ScreenFit><div className="arena-winners"><h1>TILLYKKE TIL TOP 5!</h1><div className="arena-rows">{board.entries.slice(0,5).map(e=><div key={e.participant_id}><b>{e.rank}</b><strong>{e.nickname}</strong><span>{formatScore(e.score_points)}</span></div>)}</div>{!board.entries.length&&<p>Ingen godkendte resultater.</p>}<div className="arena-pickup"><strong>HENT DIN PRÆMIE I VIGGOS BAR</strong><span>{round.pickup_instructions||'Vis voucheren på din telefon. Kun barpersonalet må swipe.'}</span></div></div></ScreenFit>:
    view==='rules'?<div className="arena-rules"><ScreenDemo opponent={roundKit(round)}/><div><h1>SÅDAN<br/>SPILLER DU</h1><p>Scan. Vælg dit navn.</p><p>Tryk på en <strong>hvid Bulldogs-spiller</strong>.</p><p>Aflever, før du fanges. Undgå modstanderne.</p><p><strong>Sekunder + afleveringer = point.</strong></p></div></div>:
    view==='info'?<ScreenFit><div className="arena-info"><h1>{round.screen_title||'KAMPENS INFO'}</h1><p>{round.screen_body||'Scan QR-koden og vær med i pausespillet.'}</p></div></ScreenFit>:
    <div className="arena-leaders"><h1>HVEM HOLDER PUCKEN I LIVE?</h1><div className="arena-rows">{Array.from({length:5},(_,i)=>{const e=board.entries[i];return <div key={i}><b>{i+1}</b><strong>{e?.nickname||(i===0?'Din plads venter':'—')}</strong><span>{e?formatScore(e.score_points):'—'}</span></div>;})}</div><p className="arena-score-note">SEKUNDER + AFLEVERINGER = POINT</p></div>}
  </section><aside className="arena-qr"><h2>{final?'DIN VOUCHER':'SCAN & SPIL'}</h2>{qrImage}<p>{final?'Åbn på din spiltelefon':scheduled?'Prøv en træningsrunde':'Hvid trøje = Bulldogs'}</p></aside></div>
  <footer><strong>{round.prize}</strong><span>{updated?'↑ LEADERBOARD OPDATERET':`${board.participants} MED RESULTAT`}</span></footer>
 </div></ArenaFrame>;
}
