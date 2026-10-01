'use client';
import {useCallback,useState} from 'react';
import GameCanvas,{type Session} from './GameCanvas';
import type {OpponentKit} from '@/lib/team';
export default function ScreenDemo({opponent}:{opponent:OpponentKit}){
 const [session,setSession]=useState<Session>({id:'demo-1',seed:1978,limit:Infinity,practice:true});
 const repeat=useCallback(()=>setSession(s=>({...s,id:`demo-${Number(s.id.slice(5))+1}`,seed:s.seed+1})),[]);
 return <div className="screen-demo" aria-label="Automatisk demonstration af spillet"><GameCanvas demo session={session} opponent={opponent} onEnd={repeat}/><span>DEMONSTRATION</span></div>;
}
