'use client';
import {useRef,useState} from 'react';
import {api} from '@/lib/client';
import type {Me} from '@/lib/types';

export default function PrizeVoucher({claim}:{claim:NonNullable<Me['claim']>}){
 const [used,setUsed]=useState(false),[busy,setBusy]=useState(false),[progress,setProgress]=useState(0),[error,setError]=useState('');
 const gesture=useRef<{id:number;x:number;width:number}|null>(null),sending=useRef(false);
 if(claim.rank<1||claim.rank>5||claim.redeemed||used)return null;
 async function redeem(){if(sending.current)return;sending.current=true;setBusy(true);setError('');
  try{await api('voucher/redeem',{code:claim.code});setUsed(true);}
  catch(e){setError((e as Error).message);setProgress(0);}
  finally{sending.current=false;setBusy(false);}
 }
 return <section className="claim-card voucher"><p className="eyebrow">DIN VOUCHER · NR. {claim.rank}</p><h2>1 alm. fadøl / sodavand</h2><p>Indløses i <strong>Viggos Bar</strong></p><small>{claim.roundTitle}</small><div className="voucher-warning"><strong>DU MÅ IKKE SELV SWIPE</strong><p>Vis telefonen til den ansatte i baren. Kun den ansatte må swipe, når du får din drik.</p></div><div className="voucher-swipe" role="slider" tabIndex={0} aria-label="Kun barpersonale: swipe mod højre for at indløse" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(progress*100)} aria-disabled={busy}
 onKeyDown={e=>{if(e.key==='ArrowRight'&&!busy){e.preventDefault();setProgress(v=>Math.min(1,v+.1));}if(e.key==='Enter'&&progress>=.9&&!busy)void redeem();}}
 onPointerDown={e=>{if(busy||e.button!==0)return;const rect=e.currentTarget.getBoundingClientRect();if(e.clientX-rect.left>68)return;gesture.current={id:e.pointerId,x:e.clientX,width:Math.max(1,rect.width-64)};e.currentTarget.setPointerCapture(e.pointerId);setProgress(0);}}
 onPointerMove={e=>{const g=gesture.current;if(g?.id===e.pointerId)setProgress(Math.max(0,Math.min(1,(e.clientX-g.x)/g.width)));}}
 onPointerCancel={()=>{gesture.current=null;setProgress(0);}}
 onPointerUp={e=>{const g=gesture.current;if(!g||g.id!==e.pointerId)return;gesture.current=null;const distance=(e.clientX-g.x)/g.width;if(distance>=.9){setProgress(1);void redeem();}else setProgress(0);}}>
 <span className="voucher-thumb" style={{left:`calc(${progress*100}% - ${progress*60}px)`}}>→</span><span>{busy?'Indløser…':'BARPERSONALE: SWIPE →'}</span></div><small>Voucheren forsvinder efter indløsning og kan kun bruges én gang.</small>{error&&<p className="notice" role="alert">{error} Voucheren er ikke fjernet. Prøv igen med forbindelse.</p>}</section>;
}
