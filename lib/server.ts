import { createClient } from '@supabase/supabase-js';
import { createHmac, createHash, timingSafeEqual } from 'node:crypto';
import { cookies } from 'next/headers';
const supabaseUrl=()=>process.env.SUPABASE_URL||process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey=()=>process.env.SUPABASE_SERVICE_ROLE_KEY||process.env.SUPABASE_SECRET_KEY||process.env.SUPABASE_SERVICE_KEY;
export const configured=()=>!!(supabaseUrl() && serviceKey() && process.env.SESSION_SECRET && process.env.SESSION_SECRET.length>=32);
export function db(){if(!configured())throw new Error('NOT_CONFIGURED');return createClient(supabaseUrl()!,serviceKey()!,{auth:{persistSession:false,autoRefreshToken:false}});}
export function hash(s:string){return createHash('sha256').update(s).digest('hex');}
export function equal(a:string,b:string){return timingSafeEqual(Buffer.from(hash(a)),Buffer.from(hash(b)));}
function sign(s:string){return createHmac('sha256',process.env.SESSION_SECRET!).update(s).digest('base64url');}
export function ticket(id:string,kind='player',ttl=60*60*24*30){const body=Buffer.from(JSON.stringify({id,kind,expires:Date.now()+ttl*1000})).toString('base64url');return `${body}.${sign(body)}`;}
export function verify(value:string|undefined,kind='player'):string|null{try {if(!value||!configured())return null;const [body,sig]=value.split('.');if(!equal(sig,sign(body)))return null;const v=JSON.parse(Buffer.from(body,'base64url').toString());if(v.kind!==kind||v.expires<Date.now()||typeof v.id!=='string')return null;return v.id;}catch{return null;}}
export async function player(){return verify((await cookies()).get('bulldogs-player')?.value);}
export async function admin(){return verify((await cookies()).get('bulldogs-admin')?.value,'admin')==='staff';}
export function claimCode(round:string,id:string){return createHmac('sha256',process.env.SESSION_SECRET!).update(`prize:${round}:${id}`).digest('hex').slice(0,24).toUpperCase();}
export const cookieOptions={httpOnly:true,secure:process.env.NODE_ENV==='production',sameSite:'strict' as const,path:'/'};
// Postgres-koden følger med, så API'et kan oversætte fx manglende migration til en brugbar besked.
export async function rpc(name:string,args:Record<string,unknown>={}){const {data,error}=await db().rpc(name,args);if(error)throw Object.assign(new Error(error.message),{code:error.code,details:error.details,hint:error.hint});return data;}
