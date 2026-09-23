'use client';
import {useEffect,useState} from 'react';
import {api} from '@/lib/client';
type Metrics={players:number;starts:number;accepted:number;repeatPlayers:number;totalTimeMs:number;averageTimeMs:number;bestScore:number;passes:number;vouchers:number;redeemed:number;activity:{minute:string;starts:number}[]};
type Report={rounds:{id:string;title:string;starts_at:string}[];roundId:string|null;metrics:Metrics|null;generatedAt:string};
const number=(n:number,digits=0)=>n.toLocaleString('da-DK',{maximumFractionDigits:digits});
export default function StaffAnalytics({currentRoundId}:{currentRoundId?:string}){
 const [selected,setSelected]=useState(''),[report,setReport]=useState<Report|null>(null),[error,setError]=useState('');
 useEffect(()=>{
  let disposed=false,inFlight=false;
  setReport(null);setError('');
  async function refresh(){if(inFlight||document.hidden)return;inFlight=true;
   try{const data=await api<Report>(`admin/analytics${selected?`?roundId=${encodeURIComponent(selected)}`:''}`);if(!disposed){setReport(data);setError('');}}
   catch(e){if(!disposed)setError((e as Error).message);}finally{inFlight=false;}
  }
  void refresh();const timer=setInterval(refresh,30000);document.addEventListener('visibilitychange',refresh);
  return()=>{disposed=true;clearInterval(timer);document.removeEventListener('visibilitychange',refresh);};
 },[selected,currentRoundId]);
 const m=report?.metrics;
 const cards=m?[
  ['Deltagere',number(m.players),'Unikke deltager-ID’er med mindst ét startet forsøg'],
  ['Startede forsøg',number(m.starts),`${number(m.players?m.starts/m.players:0,1)} forsøg pr. deltager`],
  ['Spiller igen',`${number(m.players?100*m.repeatPlayers/m.players:0)} %`,`${number(m.repeatPlayers)} deltagere har startet mindst to forsøg`],
  ['Godkendte resultater',number(m.accepted),`${number(m.starts?100*m.accepted/m.starts:0)} % af startede forsøg`],
  ['Samlet spilletid',`${number(m.totalTimeMs/60000,1)} min.`, 'Summen af godkendte forsøg'],
  ['Gns. overlevelsestid',`${number(m.averageTimeMs/1000,1)} sek.`, 'Pr. godkendt forsøg'],
  ['Afleveringer',number(m.passes),'I alle godkendte forsøg'],
  ['Bedste score',`${number(m.bestScore/1000,2)} point`,'Sekunder + afleveringer'],
  ['Indløste vouchers',`${m.redeemed} / ${m.vouchers}`,`${m.vouchers-m.redeemed} mangler at blive indløst`],
 ]:[];
 const peak=Math.max(1,...(m?.activity.map(a=>a.starts)||[]));
 return <section className="admin-card staff-analytics"><div className="analytics-heading"><div><p className="eyebrow">INDBLIK / PAUSESPILLET</p><h2>Hvordan går konkurrencen?</h2></div><label>Runde<select value={selected} onChange={e=>setSelected(e.target.value)}><option value="">Seneste runde</option>{report?.rounds.map(r=><option key={r.id} value={r.id}>{r.title} · {new Date(r.starts_at).toLocaleString('da-DK',{dateStyle:'short',timeStyle:'short'})}</option>)}</select></label></div>
 {error&&<p className="notice" role="alert">{error}{report&&' Tallene nedenfor er fra sidste opdatering.'}</p>}
 {!report&&!error&&<p>Henter statistik…</p>}{report&&!m&&<p>Åbn den første konkurrence for at se statistik.</p>}
 {m&&<><div className="analytics-cards">{cards.map(([label,value,note])=><article key={label}><h3>{label}</h3><strong>{value}</strong><p>{note}</p></article>)}</div><h3>Startede forsøg pr. minut</h3>{m.activity.length?<div className="analytics-activity">{m.activity.map(a=><div key={a.minute}><time>{new Date(a.minute).toLocaleTimeString('da-DK',{hour:'2-digit',minute:'2-digit'})}</time><div className="analytics-track"><div style={{width:`${a.starts/peak*100}%`}}/></div><strong>{number(a.starts)}</strong></div>)}</div>:<p>Der er ikke startet nogen forsøg endnu.</p>}<p className="field-note">Opdateres hvert 30. sekund. Senest {new Date(report!.generatedAt).toLocaleTimeString('da-DK')}. Træning, QR-scanninger og besøg tælles ikke. Igangværende, erstattede og ikke-indsendte forsøg er med i starter, men ikke i godkendte resultater. Deltagere tælles via browserens deltager-ID.</p></>}
 </section>;
}
