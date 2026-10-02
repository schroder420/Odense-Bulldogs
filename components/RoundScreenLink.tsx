'use client';
import {useState} from 'react';
import {Check,Copy,ExternalLink,Monitor} from 'lucide-react';
import {api} from '@/lib/client';
export default function RoundScreenLink({roundId,title}:{roundId:string;title:string}){
 const [url,setUrl]=useState(''),[message,setMessage]=useState(''),[busy,setBusy]=useState(false),[copied,setCopied]=useState(false);
 async function link(){
  if(url)return url;
  const result=await api<{url:string}>('admin/screen-link',{roundId});
  const absolute=new URL(result.url,location.origin).href;setUrl(absolute);return absolute;
 }
 async function open(){
  const tab=window.open('about:blank','_blank');if(tab)tab.opener=null;
  setBusy(true);setMessage('');
  try{const target=await link();if(tab)tab.location.replace(target);else setMessage('Browseren blokerede det nye vindue. Brug linket nedenfor.');}
  catch(e){tab?.close();setMessage((e as Error).message);}finally{setBusy(false);}
 }
 async function copy(){
  setBusy(true);setCopied(false);setMessage('');
  try{const target=await link();try{await navigator.clipboard.writeText(target);setCopied(true);setMessage('Link kopieret – send det til den, der skal vise skærmen.');}catch{setMessage('Markér og kopiér hele linket i feltet nedenfor.');}}
  catch(e){setMessage((e as Error).message);}finally{setBusy(false);}
 }
 return <section className="round-screen-card" aria-label={`Storskærm til ${title}`}>
  <div className="round-screen-heading"><span className="round-screen-icon"><Monitor size={25}/></span><div><p className="eyebrow">KONKURRENCENS STORSKÆRM</p><h2>{title}</h2></div></div>
  <p className="round-screen-description">Åbn på denne enhed, eller send linket videre. Modtageren behøver ikke personalelogin.</p>
  <div className="round-screen-actions"><button className="primary" onClick={open} disabled={busy}><ExternalLink size={18}/>Åbn storskærm</button><button className="secondary" onClick={copy} disabled={busy}>{copied?<Check size={18}/>:<Copy size={18}/>}Kopiér link</button></div>
  {url&&<label className="round-screen-url">Delbart link<input readOnly value={url} onFocus={e=>e.currentTarget.select()} aria-label="Delbart storskærmslink"/><a href={url} target="_blank" rel="noreferrer">Åbn link i ny fane ↗</a></label>}
  <p className="field-note">Viser kun denne konkurrence og virker også før start. Linket giver adgang til visningen, ikke til personalepanelet.</p>
  {message&&<p className="round-screen-message" role="status">{message}</p>}
 </section>;
}
