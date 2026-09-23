import {test} from 'node:test';
import assert from 'node:assert/strict';
import {PGlite} from '@electric-sql/pglite';
import {readFile} from 'node:fs/promises';
import {randomUUID} from 'node:crypto';
import {act,advance,allowance,createGame,distanceToSegment,position,replay,scorePasses,totalScore,type Input} from '../lib/game';
// Spiller sikre afleveringer, indtil konkurrencens sidste floejt afslutter forsoeget.
function playToWhistle(seed:number,limit:number){
 const game=createGame(seed,limit);const events:Input[]=[];
 while(!game.dead){
  const t=Math.ceil(game.readyAt+allowance(game.readyAt/1000)*.5);
  if(t>=limit){advance(game,limit+1);break;}
  const safe=game.stage.home.find(p=>game.stage.away.every(a=>distanceToSegment(position(a,t),game.active,position(p,t))>=25))!;
  events.push({t,target:safe.id});act(game,{t,target:safe.id});advance(game,t+450);
 }
 return {game,events};
}
const migrations=['001_initial.sql','002_opponent_kit.sql','003_screen_control.sql','004_total_score.sql','005_qr_screen.sql','006_viggos_prize.sql'];
async function migrate(db:PGlite){
 await db.exec('create role anon; create role authenticated; create role service_role bypassrls;');
 for(const file of migrations)await db.exec(await readFile(new URL('../supabase/'+file,import.meta.url),'utf8'));
}
test('only five winners receive vouchers even when claims are supplied for all seven players',async()=>{
 const db=new PGlite();try{
  await migrate(db);
  const r=(await db.query<{id:string}>("insert into rounds(ends_at,cutoff_at) values(now()-interval '2 minutes',now()-interval '1 minute') returning id")).rows[0].id;
  const ids=Array.from({length:7},()=>randomUUID()),claims:Record<string,string>={};
  for(const [i,id] of ids.entries()){
   await db.query('insert into participants(id,nickname) values($1,$2)',[id,`Spiller${i}`]);
   await db.query('insert into scores(round_id,participant_id,score_points,time_ms,passes) values($1,$2,$3,$3,0)',[r,id,7000-i*1000]);
   claims[id]=String(i+1).repeat(64);
  }
  await db.query('select finalize_round($1,$2)',[r,JSON.stringify(claims)]);
  const winners=(await db.query<{participant_id:string}>('select participant_id from prizes order by rank')).rows;
  assert.deepEqual(winners.map(p=>p.participant_id),ids.slice(0,5));
  for(const id of ids.slice(5))await assert.rejects(db.query('select redeem_prize($1)',[claims[id]]),/INVALID_CLAIM/);
  await db.query('select redeem_prize($1)',[claims[ids[0]]]);
  await assert.rejects(db.query('select redeem_prize($1)',[claims[ids[0]]]),/ALREADY_REDEEMED/);
 }finally{await db.close();}
});
test('database enforces RLS, best scores, closure, immutable winners and one-time redemption',async()=>{
 const db=new PGlite();try{
 await migrate(db);
 const p=randomUUID(),q=randomUUID();
 await db.query('insert into participants(id,nickname) values ($1,\'Test1\'),($2,\'Test2\')',[p,q]);
 await db.exec('set role anon');await assert.rejects(db.query('select * from participants'));await assert.rejects(db.query('select public_board()'));await db.exec('reset role');
 const round=(await db.query<{id:string}>("insert into rounds(ends_at,cutoff_at) values(now()+interval '3 minutes',now()+interval '4 minutes') returning id")).rows[0].id;
 const result=(await db.query<{v:any}>('select start_run($1,23) v',[p])).rows[0].v;
 await assert.rejects(db.query('select start_run($1,24)',[p]),/TOO_FAST/);
 await db.query("update runs set started_at=now()-interval '10 seconds' where id=$1",[result.run.id]);
 // 3,5 sekunder plus 4 afleveringer = 7.500 point.
 await db.query('select finish_run($1,$2,7500,3500,4)',[result.run.id,p]);await db.query('select finish_run($1,$2,7500,3500,4)',[result.run.id,p]);
 let board=(await db.query<{v:any}>('select public_board() v')).rows[0].v;
 assert.equal(board.entries[0].score_points,7500);assert.equal(board.entries[0].time_ms,3500);assert.equal(board.entries[0].passes,4);assert.equal(board.participants,1);
 const second=(await db.query<{v:any}>('select start_run($1,25) v',[p])).rows[0].v;
 await db.query("update runs set started_at=now()-interval '10 seconds' where id=$1",[second.run.id]);await db.query('select finish_run($1,$2,2200,1200,1)',[second.run.id,p]);
 board=(await db.query<{v:any}>('select public_board() v')).rows[0].v;assert.equal(board.entries[0].score_points,7500);
 await assert.rejects(db.query('select finalize_round($1,$2)',[round,JSON.stringify({[p]:'a'.repeat(64)})]),/WAIT_FOR_RUNS/);
 await db.query("update rounds set status='closing',ends_at=now()-interval '1 minute',cutoff_at=now()-interval '30 seconds' where id=$1",[round]);
 await assert.rejects(db.query('select start_run($1,26)',[p]),/ROUND_CLOSED/);
 await db.query('select finalize_round($1,$2)',[round,JSON.stringify({[p]:'a'.repeat(64)})]);
 await assert.rejects(db.query('select finalize_round($1,$2)',[round,JSON.stringify({[p]:'a'.repeat(64)})]),/INVALID_ROUND/);
 await db.query('select redeem_prize($1)',['a'.repeat(64)]);await assert.rejects(db.query('select redeem_prize($1)',['a'.repeat(64)]),/ALREADY_REDEEMED/);
 await db.query('update participants set hidden=true where id=$1',[p]);board=(await db.query<{v:any}>('select public_board() v')).rows[0].v;assert.equal(board.entries[0].nickname,'Bulldogs-fan');assert.equal(board.entries[0].rank,1);
 }finally{await db.close();}
});
test('samlet score rangerer, og databasen afviser point der ikke passer til forloebet',async()=>{
 const db=new PGlite();try{
 await migrate(db);
 const slow=randomUUID(),quick=randomUUID();
 await db.query("insert into participants(id,nickname) values ($1,'Langsom'),($2,'Hurtig')",[slow,quick]);
 await db.query("insert into rounds(ends_at,cutoff_at) values(now()+interval '3 minutes',now()+interval '4 minutes')");
 const startRun=async(id:string)=>{
  const run=(await db.query<{v:any}>('select start_run($1,42) v',[id])).rows[0].v.run;
  await db.query("update runs set started_at=now()-interval '60 seconds' where id=$1",[run.id]);return run.id as string;
 };
 // Laengst paa isen, men faa afleveringer. Modspilleren overlever kortere og afleverer mere.
 await db.query('select finish_run($1,$2,32000,30000,2)',[await startRun(slow),slow]);
 await db.query('select finish_run($1,$2,35820,24820,11)',[await startRun(quick),quick]);
 const board=(await db.query<{v:any}>('select public_board() v')).rows[0].v;
 assert.equal(board.entries[0].nickname,'Hurtig');assert.equal(board.entries[0].score_points,35820);
 assert.equal(board.entries[1].nickname,'Langsom');
 // Point kan hverken vaere mindre end tiden eller mere end tiden plus et point per aflevering.
 const cheat=await startRun(slow);
 await assert.rejects(db.query('select finish_run($1,$2,99000,30000,2)',[cheat,slow]),/INVALID_TIME/);
 await assert.rejects(db.query('select finish_run($1,$2,10000,30000,2)',[cheat,slow]),/INVALID_TIME/);
 // Tiden maa stadig ikke overstige den tid, der faktisk er gaaet.
 await assert.rejects(db.query('select finish_run($1,$2,900000,900000,0)',[cheat,slow]),/INVALID_TIME/);
 }finally{await db.close();}
});
test('slutfloejt godkendes, selv naar forsoegets frist kun er praecis paa mikrosekundet',async()=>{
 const db=new PGlite();try{
 await migrate(db);
 const onTime=randomUUID(),tooLong=randomUUID();
 await db.query("insert into participants(id,nickname) values ($1,'Slutfloejt'),($2,'Forlaenget')",[onTime,tooLong]);
 await db.query("insert into rounds(ends_at,cutoff_at) values(now()+interval '2 minutes',now()+interval '2 minutes 30 seconds')");
 const start=async(id:string)=>(await db.query<{v:any}>('select start_run($1,99) v',[id])).rows[0].v.run.id as string;
 const first=await start(onTime),second=await start(tooLong);
 // started_at har mikrosekunder i Postgres. Konkurrencen er slut, og begge forsoeg loeb til sidste floejt.
 await db.query("update runs set started_at=now()-interval '8.271843 seconds' where id in ($1,$2)",[first,second]);
 await db.query("update rounds set status='closing',ends_at=now()-interval '30 seconds',cutoff_at=now()-interval '0.3 seconds'");
 const row=(await db.query<{s:string;c:string}>('select run.started_at::text s,r.cutoff_at::text c from runs run join rounds r on r.id=run.round_id where run.id=$1',[first])).rows[0];
 // Praecis den frist serveren udleverer til spilleren ved start: millisekunder, ikke mikrosekunder.
 const limit=Math.floor(new Date(row.c).getTime()-new Date(row.s).getTime());
 // Kør hele vejen: simulationen loeber til slutfloejt, serveren genspiller, databasen godkender.
 const {game,events}=playToWhistle(99,limit);
 assert.equal(game.dead,'whistle');
 assert.equal(game.score,limit);
 assert.ok(game.passes>0);
 const validated=replay(99,events,game.score,limit);
 assert.equal(validated.dead,'whistle');
 assert.equal(validated.score,limit);
 await db.query('select finish_run($1,$2,$3,$4,$5)',[first,onTime,totalScore(validated),validated.score,scorePasses(validated)]);
 const board=(await db.query<{v:any}>('select public_board() v')).rows[0].v;
 assert.equal(board.entries[0].score_points,totalScore(validated));
 assert.equal(board.entries[0].time_ms,limit);
 // En tid ud over forsoegets frist er stadig ugyldig.
 await assert.rejects(db.query('select finish_run($1,$2,$3,$3,0)',[second,tooLong,limit+50]),/INVALID_TIME/);
 }finally{await db.close();}
});
