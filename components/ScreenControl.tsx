'use client';
import {useState} from 'react';
import type {Round} from '@/lib/types';
import {api} from '@/lib/client';
export default function ScreenControl({round,onSaved}:{round:Round;onSaved:()=>void}){
 const [title,setTitle]=useState(round.screen_title||'Kampens info');
 const [text,setText]=useState(round.screen_body||'');
 const [pickup,setPickup]=useState(round.pickup_instructions||'Vis dit præmiebevis til personalet for at hente dine billetter.');
 const [busy,setBusy]=useState(false),[message,setMessage]=useState('');
 async function show(mode:string){setBusy(true);setMessage('');try{await api('admin/screen',{roundId:round.id,mode,title,text,pickup});setMessage('Sendt til storskærmen. Visningen skifter inden for ca. 3 sekunder.');onSaved();}catch(e){setMessage((e as Error).message);}finally{setBusy(false);}}
 const selected=round.screen_mode==='leaderboard'&&round.status==='final'?'winners':round.screen_mode||'leaderboard';
 return <section className="admin-card screen-control"><p className="eyebrow">FJERNBETJENING / STORSKÆRM</p><h2>Vælg, hvad publikum ser</h2><p>Skifter indholdet på den allerede åbne storskærm. Konkurrencen fortsætter, og QR-koden bliver stående. De sidste 10 sekunder overtager automatisk skærmen.</p><div className="screen-buttons">{[['leaderboard','Leaderboard'],['rules','Spilleregler'],['info','Besked'],['winners','Vindere & billetter']].map(([mode,label])=><button key={mode} className={selected===mode?'primary':'secondary'} aria-pressed={selected===mode} disabled={busy||(mode==='winners'&&round.status!=='final')} onClick={()=>show(mode)}>{label}</button>)}</div><p className="field-note">Vinderne kan vises, når top 5 er fastlåst. Brug knapperne til at klippe væk og tilbage igen.</p><div className="screen-editor"><label>Beskedens overskrift<input maxLength={80} value={title} onChange={e=>setTitle(e.target.value)}/></label><label>Besked til publikum<textarea rows={3} maxLength={500} value={text} onChange={e=>setText(e.target.value)} placeholder="Fx en besked fra speakeren…"/></label><label>Hvor og hvordan henter vinderne billetterne?<textarea rows={2} maxLength={240} value={pickup} onChange={e=>setPickup(e.target.value)} placeholder="Angiv udleveringssted…"/></label></div><button className="secondary" disabled={busy} onClick={()=>show(round.screen_mode||'leaderboard')}>Gem tekster på storskærmen</button>{message&&<p role="status">{message}</p>}</section>;
}
