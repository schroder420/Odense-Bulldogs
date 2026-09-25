import { NextRequest,NextResponse } from 'next/server';
import { randomUUID,randomInt } from 'node:crypto';
import {admin,claimCode,configured,cookieOptions,db,equal,hash,leaderboard,player,rpc,ticket} from '@/lib/server';
import {DEFAULT_OPPONENT,validKit,roundKit} from '@/lib/team';
import {replay,scorePasses,totalScore,GAME_VERSION,runLimit} from '@/lib/game';
export const runtime='nodejs';
export const maxDuration=15;
const json=(value:unknown,status=200)=>NextResponse.json(value,{status,headers:{'Cache-Control':'private, no-store'}});
// Supabase-fejl er almindelige objekter, ikke Error. Uden det her forsvandt årsagen, og alt blev "kunne ikke gennemføres".
function describe(error:unknown){
 const coded=(value:unknown)=>typeof (value as {code?:unknown})?.code==='string'?(value as {code:string}).code:'';
 if(error instanceof Error)return {message:error.message,code:coded(error)};
 if(error&&typeof error==='object'){const e=error as {message?:unknown;code?:unknown;details?:unknown;hint?:unknown};
  return {message:[e.message,e.details,e.hint].filter(v=>typeof v==='string').join(' · '),code:coded(e)};}
 return {message:typeof error==='string'?error:'',code:''};
}
const known:Record<string,string>={NOT_CONFIGURED:'Konkurrencen er ikke forbundet endnu.',ROUND_CLOSED:'Der er lukket for nye forsøg.',TOO_FAST:'Vent et øjeblik, og prøv igen.',ROUND_FINAL:'Runden er afsluttet. Resultatet kom for sent.',RUN_REPLACED:'Et nyere forsøg er allerede startet.',WAIT_FOR_RUNS:'Vent på de sidste resultater.',INVALID_CLAIM:'Præmiekoden blev ikke fundet.',ALREADY_REDEEMED:'Præmien er allerede udleveret.',WINNERS_CHANGED:'Listen ændrede sig. Opdater og prøv igen.',INVALID_TIME:'Tiden kunne ikke godkendes.',INVALID_ROUND:'Runden kan ikke afsluttes igen.',PLAYER_MISSING:'Vælg først et spillernavn.',RUN_MISSING:'Forsøget blev ikke fundet.'};
// Postgres-koder oversat til noget, personalet kan handle på. Ingen rå fejltekst forlader serveren.
const codes:Record<string,{text:string;status:number}>={
 '23505':{text:'Der findes allerede en runde, som ikke er afsluttet. Luk og fastlås den først.',status:409},
 '42703':{text:'Databasen mangler en opdatering. Kør supabase/003_screen_control.sql og 004_total_score.sql i Supabase.',status:503},
 'PGRST204':{text:'Databasen mangler en opdatering. Kør supabase/003_screen_control.sql og 004_total_score.sql i Supabase.',status:503},
 'PGRST202':{text:'Databasen mangler en opdatering. Kør supabase/004_total_score.sql i Supabase.',status:503},
 '42883':{text:'Databasen mangler en opdatering. Kør supabase/004_total_score.sql i Supabase.',status:503},
 '42P01':{text:'Databasen mangler tabellerne. Kør supabase/001_initial.sql og fremefter i Supabase.',status:503}};
function fail(error:unknown){
 const {message,code}=describe(error);
 const key=Object.keys(known).find(k=>message.includes(k));
 if(key)return json({error:known[key]},key==='NOT_CONFIGURED'?503:400);
 console.error('API request failed:',code,message.slice(0,300));
 const mapped=codes[code];
 return json({error:mapped?mapped.text:'Handlingen kunne ikke gennemføres. Prøv igen.'},mapped?mapped.status:400);
}
export async function GET(req:NextRequest,{params}:{params:Promise<{path:string[]}>}){
 try{
 const path=(await params).path.join('/');
 if(path==='board'||path==='screen-board'){
  if(path==='screen-board' && !(await leaderboard()))return json({error:'Storskærmen kræver adgangskode.'},401);
  if(!configured())return path==='screen-board'
   ? json({error:'Supabase er ikke forbundet på denne Vercel-deployment. Kontrollér SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY og SESSION_SECRET i Production Environment.'},503)
   : json({configured:false,round:null,entries:[],participants:0,serverTime:new Date().toISOString()});
  const board=await rpc('public_board');
  if(path==='screen-board')return json({...board,configured:true});
  return NextResponse.json({...board,configured:true},{headers:{'Cache-Control':'public, max-age=0, s-maxage=2, stale-while-revalidate=3'}});
 }
 if(path==='me'){
  if(!configured())return json(null);
  const id=await player();if(!id)return json(null);
  const client=db();const {data:p,error}=await client.from('participants').select('id,nickname').eq('id',id).single();if(error)return json(null);
  const {data:r}=await client.from('rounds').select('*').order('starts_at',{ascending:false}).limit(1).maybeSingle();
  if(!r)return json({...p,best:0,bestTime:0,bestPasses:0,rank:null,claim:null});
  const {data:score}=await client.from('scores').select('score_points,time_ms,passes').eq('round_id',r.id).eq('participant_id',id).maybeSingle();
  const {data:prize}=await client.from('prizes').select('rank,redeemed_at,round_id,rounds(prize,title)').eq('participant_id',id).gte('rank',1).lte('rank',5).order('created_at',{ascending:false}).limit(1).maybeSingle();
  const prizeRound=prize?.rounds as unknown as {prize:string;title:string}|undefined;
  return json({...p,best:score?.score_points||0,bestTime:score?.time_ms||0,bestPasses:score?.passes||0,rank:prize&&prize.round_id===r.id?prize.rank:null,claim:prize?{code:claimCode(prize.round_id,id),rank:prize.rank,redeemed:!!prize.redeemed_at,prize:prizeRound?.prize||r.prize,roundTitle:prizeRound?.title||r.title}:null});
 }
 if(path==='admin/analytics'){
  if(!await admin())return json({error:'Log ind som personale.'},401);
  const requested=req.nextUrl.searchParams.get('roundId');
  if(requested&&!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(requested))return json({error:'Ugyldig runde.'},400);
  const {data:rounds,error}=await db().from('rounds').select('id,title,starts_at').order('starts_at',{ascending:false}).limit(50);if(error)throw error;
  const roundId=requested||rounds?.[0]?.id||null;
  if(requested&&!rounds?.some(r=>r.id===requested))return json({error:'Vælg en af de seneste 50 runder.'},404);
  const {data:metrics,error:metricsError}=roundId?await db().rpc('staff_analytics',{p_round:roundId}):{data:null,error:null};
  if(metricsError){if(metricsError.code==='PGRST202'||metricsError.code==='42883')return json({error:'Statistik kræver databaseopdateringen 007_staff_analytics.sql.'},503);throw metricsError;}
  return json({rounds,roundId,metrics,generatedAt:new Date().toISOString()});
 }
 if(path==='admin'){
  if(!configured())return json({configured:false,authenticated:false});
  if(!await admin())return json({configured:true,authenticated:false});
  const board=await rpc('public_board');
  let query=db().from('participants').select('id,nickname,hidden').order('created_at',{ascending:false}).limit(100);
  const search=req.nextUrl.searchParams.get('search');if(search)query=query.ilike('nickname',`%${search.replace(/[%_]/g,'').slice(0,18)}%`);
  const {data:participants,error}=await query;if(error)throw error;
  return json({configured:true,authenticated:true,board,participants});
 }
 return json({error:'Ikke fundet'},404);
 }catch(e){return fail(e);}
}
export async function POST(req:NextRequest,{params}:{params:Promise<{path:string[]}>}){
 try {
 const origin=req.headers.get('origin');
 const configuredOrigin=process.env.APP_ORIGIN?.replace(/\/$/,'');
 const requestOrigin=req.nextUrl.origin.replace(/\/$/,'');
 const sameOrigin=origin===requestOrigin || (!origin && req.headers.get('sec-fetch-site')==='same-origin');
 if(configuredOrigin ? origin!==configuredOrigin : !sameOrigin)return json({error:'Ugyldig afsender.'},403);
 if(!configured())return fail(new Error('NOT_CONFIGURED'));
 if(Number(req.headers.get('content-length')||0)>300000)return json({error:'For mange data.'},413);
 const raw=await req.text();if(raw.length>300000)return json({error:'For mange data.'},413);
 const body=JSON.parse(raw||'{}');const path=(await params).path.join('/');
 if(path==='voucher/redeem'){
  const id=await player();if(!id)return json({error:'Åbn voucheren på den telefon, du spillede med.'},401);
  const code=typeof body.code==='string'?body.code:'';
  if(!/^[A-F0-9]{24}$/.test(code))return json({error:'Ugyldig voucher.'},400);
  const {data:prize,error}=await db().from('prizes').select('rank,redeemed_at').eq('participant_id',id).eq('claim_hash',hash(code)).gte('rank',1).lte('rank',5).maybeSingle();
  if(error)throw error;if(!prize)return json({error:'Voucheren blev ikke fundet.'},404);
  if(prize.redeemed_at)return json({ok:true,alreadyRedeemed:true});
  try{await rpc('redeem_prize',{p_hash:hash(code)});}catch(e){if(!(e instanceof Error)||!e.message.includes('ALREADY_REDEEMED'))throw e;}
  return json({ok:true});
 }
 if(path==='join'){
  const nickname=String(body.nickname||'').trim().replace(/\s+/g,' ');
  if(!/^[\p{L}\p{N} ._\-]{2,18}$/u.test(nickname))return json({error:'Brug 2–18 bogstaver eller tal i dit navn.'},400);
  const id=await player()||randomUUID();const {error}=await db().from('participants').upsert({id,nickname},{onConflict:'id'});if(error)throw error;
  const response=json({id,nickname});response.cookies.set('bulldogs-player',ticket(id),{...cookieOptions,maxAge:60*60*24*30});return response;
 }
 if(path==='run/start'){
  if(body.version!==GAME_VERSION)return json({error:'Spillet er opdateret. Genindlæs siden, før du starter.'},409);
  const id=await player();if(!id)return json({error:'Vælg først et spillernavn.'},401);
  const result=await rpc('start_run',{p_player:id,p_seed:randomInt(1,2147483647)});
  const {error:versionError}=await db().from('runs').update({game_version:GAME_VERSION}).eq('id',result.run.id);if(versionError)throw versionError;
  return json({version:GAME_VERSION,opponent:roundKit(result.round),id:result.run.id,seed:Number(result.run.seed),limit:runLimit(result.run.started_at,result.round.cutoff_at,GAME_VERSION),roundId:result.round.id});
 }
 if(path==='run/finish'){
  const id=await player();if(!id)return json({error:'Din deltageradgang mangler.'},401);
  const {data:run,error}=await db().from('runs').select('*,rounds(cutoff_at)').eq('id',String(body.id)).eq('participant_id',id).single();if(error||!run)return json({error:'Forsøget blev ikke fundet.'},404);
  const limit=runLimit(run.started_at,run.rounds.cutoff_at,run.game_version??1);
  const validated=replay(Number(run.seed),body.events,body.end,limit,body.abandoned===true,run.game_version??1);
  if(validated.score>Date.now()-new Date(run.started_at).getTime()+1000)return json({error:'Tiden kunne ikke godkendes.'},400);
  // Serveren regner selv scoren ud af det replayede forløb. Klienten sender kun sine tryk.
  return json(await rpc('finish_run',{p_run:run.id,p_player:id,p_points:totalScore(validated),p_time:validated.score,p_passes:scorePasses(validated)}));
 }
 if(path==='admin/login'){
  if(!process.env.ADMIN_PASSWORD||process.env.ADMIN_PASSWORD.length<16)return json({error:'Personalets adgang er ikke sat op endnu.'},503);
  const bucket=hash(req.headers.get('x-vercel-forwarded-for')?.split(',')[0]||req.headers.get('x-forwarded-for')?.split(',')[0]||'local');
  if(!await rpc('admin_rate_limit',{p_bucket:bucket}))return json({error:'For mange forsøg. Vent 15 minutter.'},429);
  if(typeof body.password!=='string'||!equal(body.password,process.env.ADMIN_PASSWORD))return json({error:'Forkert adgangskode.'},401);
  const response=json({ok:true});response.cookies.set('bulldogs-admin',ticket('staff','admin',28800),{...cookieOptions,maxAge:28800});return response;
 }
 if(path==='leaderboard/login'){
  const secret=process.env.LEADERBOARD_ACCESS_CODE;
  if(!secret||secret.length<8)return json({error:'Storskærmens adgangskode er ikke sat op endnu.'},503);
  const bucket=hash('screen:'+(req.headers.get('x-vercel-forwarded-for')?.split(',')[0]||req.headers.get('x-forwarded-for')?.split(',')[0]||'local'));
  if(!await rpc('admin_rate_limit',{p_bucket:bucket}))return json({error:'For mange forsøg. Vent 15 minutter.'},429);
  if(typeof body.password!=='string'||!equal(body.password,secret))return json({error:'Forkert adgangskode.'},401);
  const response=json({ok:true});response.cookies.set('bulldogs-leaderboard',ticket('screen','leaderboard',28800),{...cookieOptions,maxAge:28800});return response;
 }
 if(!path.startsWith('admin/')||!await admin())return json({error:'Log ind som personale.'},401);
 if(path==='admin/logout'){const response=json({ok:true});response.cookies.delete('bulldogs-admin');return response;}
 if(path==='admin/screen'){
  const modes=['leaderboard','rules','info','winners','qr'];
  if(!modes.includes(body.mode)||typeof body.title!=='string'||body.title.length>80||typeof body.text!=='string'||body.text.length>500||typeof body.pickup!=='string'||body.pickup.length>240)return json({error:'Kontrollér skærmvalg og teksternes længde.'},400);
  const board=await rpc('public_board');
  if(!board.round||board.round.id!==body.roundId)return json({error:'Runden er ændret. Opdater siden.'},409);
  if(body.mode==='winners'&&board.round.status!=='final')return json({error:'Fastlås først vinderne.'},409);
  const {data,error}=await db().from('rounds').update({screen_mode:body.mode,screen_title:body.title.trim(),screen_body:body.text.trim(),pickup_instructions:body.pickup.trim()}).eq('id',body.roundId).eq('status',board.round.status).select('id').maybeSingle();
  if(error){if(error.code==='23514'&&body.mode==='qr')return json({error:'QR-visningen kræver databaseopdateringen 005_qr_screen.sql.'},503);if(['PGRST204','42703'].includes(error.code))return json({error:'Storskærmsstyring mangler i databasen. Kør supabase/003_screen_control.sql i Supabase.'},503);throw error;}
  if(!data)return json({error:'Runden ændrede sig. Prøv igen.'},409);
  return json({ok:true});
 }
 if(path==='admin/open'){
  const minutes=Number(body.minutes);if(!Number.isInteger(minutes)||minutes<1||minutes>15)return json({error:'Vælg 1–15 minutter.'},400);
  const opponent=body.opponent??DEFAULT_OPPONENT;if(!validKit(opponent))return json({error:'Vælg et holdnavn på 2–40 tegn og en trøjefarve, som tydeligt adskiller sig fra hvid.'},400);
  const {data:unfinished,error:lookupError}=await db().from('rounds').select('id,status').neq('status','final').limit(1).maybeSingle();
  if(lookupError)throw lookupError;
  if(unfinished)return json({error:'Der kører allerede en runde. Luk for nye forsøg, fastlås vinderne, og åbn så en ny.'},409);
  const end=Date.now()+minutes*60000;const {error}=await db().from('rounds').insert({opponent_name:opponent.name.trim(),opponent_primary:opponent.primary,opponent_stripe:opponent.stripe,title:String(body.title||'Kampens pause').slice(0,60),prize:String(body.prize||'1 alm. fadøl eller sodavand pr. vinder · Viggos Bar').slice(0,160),ends_at:new Date(end).toISOString(),cutoff_at:new Date(end+30000).toISOString()});if(error)throw error;return json({ok:true});
 }
 if(path==='admin/close'){
  const {data:r}=await db().from('rounds').select('*').eq('id',body.roundId).single();if(!r||r.status!=='open')return json({error:'Runden er allerede lukket.'},400);
  const now=Date.now();const end=Math.min(now,new Date(r.ends_at).getTime());
  // Preserve the original cutoff: signed game simulations must keep their deadline.
  const {error}=await db().from('rounds').update({status:'closing',ends_at:new Date(end).toISOString()}).eq('id',r.id).eq('status','open');if(error)throw error;return json({ok:true});
 }
 if(path==='admin/finalize'){
  const board=await rpc('public_board');if(board.round?.id!==body.roundId)return json({error:'Forkert runde.'},400);
  const claims=Object.fromEntries(board.entries.slice(0,5).map((e:{participant_id:string})=>[e.participant_id,hash(claimCode(body.roundId,e.participant_id))]));
  await rpc('finalize_round',{p_round:body.roundId,p_claims:claims});return json({ok:true});
 }
 if(path==='admin/hide'){
  if(typeof body.hidden!=='boolean')return json({error:'Ugyldig værdi.'},400);
  const {error}=await db().from('participants').update({hidden:body.hidden}).eq('id',body.id);if(error)throw error;return json({ok:true});
 }
 if(path==='admin/redeem'){
  const code=String(body.code||'').replace(/[\s-]/g,'').toUpperCase();if(!/^[A-F0-9]{24}$/.test(code))return json({error:'Præmiekoden skal være 24 tegn.'},400);
  return json(await rpc('redeem_prize',{p_hash:hash(code)}));
 }
 return json({error:'Ikke fundet'},404);
 }catch(e){return fail(e);}
}
