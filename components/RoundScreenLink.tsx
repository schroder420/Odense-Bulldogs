'use client';
import {useState} from 'react';
import {api} from '@/lib/client';
export default function RoundScreenLink({roundId}:{roundId:string}){
 const [url,setUrl]=useState(''),[error,setError]=useState(''),[busy,setBusy]=useState(false);
 async function open(){
  const tab=window.open('about:blank','_blank');if(tab)tab.opener=null;
  setBusy(true);setError('');
  try{const result=await api<{url:string}>('admin/screen-link',{roundId});setUrl(result.url);if(tab)tab.location.replace(result.url);}
  catch(e){tab?.close();setError((e as Error).message);}finally{setBusy(false);}
 }
 return <div className="round-screen-link"><button className="secondary" onClick={open} disabled={busy}>{busy?'Opretter link…':'Åbn rundens storskærm ↗'}</button>{url&&<><button className="text-button" onClick={async()=>{try{await navigator.clipboard.writeText(new URL(url,location.origin).href);setError('Link kopieret.');}catch{setError('Åbn linket og kopiér adressen.');}}}>Kopiér link</button><a href={url} target="_blank" rel="noreferrer">Åbn link</a></>}{error&&<p role="status">{error}</p>}<p className="field-note">Linket virker allerede før start og viser kun denne konkurrence. Del det kun med dem, der styrer skærmen.</p></div>;
}
