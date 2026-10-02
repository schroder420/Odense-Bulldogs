import {test} from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID,createHash,createHmac} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import {PGlite} from '@electric-sql/pglite';
import {runLimit} from '../lib/game';
import {screenView} from '../lib/screen';
import {screenToken,verifyScreenToken} from '../lib/screen-token';
import {submissionDelay,closingCountdown} from '../lib/competition';
import type {Round} from '../lib/types';
const migrationFiles=['001_initial.sql','002_opponent_kit.sql','003_screen_control.sql','004_total_score.sql','005_qr_screen.sql','006_viggos_prize.sql','008_default_prize.sql','009_scheduled_competitions.sql','011_start_round_now.sql'];
async function database(){const db=new PGlite();await db.exec('create role anon; create role authenticated; create role service_role bypassrls;');for(const file of migrationFiles)await db.exec(await readFile(new URL('../supabase/'+file,import.meta.url),'utf8'));return db;}
test('scheduled rounds reject early/wrong-round starts and finalize autonomously into exactly five one-use vouchers',async()=>{
 const db=await database();try{
  const ids=Array.from({length:7},()=>randomUUID());
  for(const [i,id] of ids.entries())await db.query('insert into participants(id,nickname) values($1,$2)',[id,`Spiller${i}`]);
  const r=(await db.query<{id:string}>("insert into rounds(timing_version,screen_rotation,starts_at,ends_at,cutoff_at) values(2,true,now()+interval '1 minute',now()+interval '3 minutes',now()+interval '190 seconds') returning id")).rows[0].id;
  await assert.rejects(db.query('select start_round_run($1,99,$2)',[ids[0],r]),/ROUND_CLOSED/);
  await db.exec("update rounds set starts_at=now()-interval '1 minute'");
  await assert.rejects(db.query('select start_round_run($1,99,$2)',[ids[0],randomUUID()]),/ROUND_CLOSED/);
  const run=(await db.query<{v:any}>('select start_round_run($1,99,$2) v',[ids[0],r])).rows[0].v.run;
  await db.query("update runs set started_at=now()-interval '15 seconds' where id=$1",[run.id]);
  // We are in the last five seconds of collection. Scores earned before the whistle still count.
  await db.exec("update rounds set ends_at=now()-interval '5 seconds',cutoff_at=now()+interval '5 seconds'");
  await db.query('select advance_competitions()');
  assert.equal((await db.query<{status:string}>('select status from rounds')).rows[0].status,'open');
  await assert.rejects(db.query('select start_round_run($1,99,$2)',[ids[1],r]),/ROUND_CLOSED/);
  await assert.rejects(db.query('select finish_run($1,$2,14000,14000,0)',[run.id,ids[0]]),/INVALID_TIME/);
  await db.query('select finish_run($1,$2,9000,9000,0)',[run.id,ids[0]]);
  for(const [i,id] of ids.slice(1).entries())await db.query('insert into scores(round_id,participant_id,score_points,time_ms,passes) values($1,$2,$3,$3,0)',[r,id,8000-i*1000]);
  await db.exec("update rounds set ends_at=now()-interval '11 seconds',cutoff_at=now()-interval '1 second'");
  await db.query('select advance_competitions()');await db.query('select advance_competitions()');
  const board=(await db.query<{v:any}>('select round_board($1) v',[r])).rows[0].v;
  assert.equal(board.round.status,'final');assert.equal(board.round.screen_mode,'winners');assert.equal(board.round.screen_rotation,false);assert.equal(board.entries.length,5);
  const prizes=(await db.query<{participant_id:string;claim_code:string;claim_hash:string}>('select * from prizes order by rank')).rows;
  assert.deepEqual(prizes.map(p=>p.participant_id),ids.slice(0,5));
  assert.match(prizes[0].claim_code,/^[A-F0-9]{24}$/);assert.equal(prizes[0].claim_hash,createHash('sha256').update(prizes[0].claim_code).digest('hex'));
  await db.query('select redeem_prize($1)',[prizes[0].claim_hash]);await assert.rejects(db.query('select redeem_prize($1)',[prizes[0].claim_hash]),/ALREADY_REDEEMED/);
  assert.equal(JSON.stringify(board).includes(prizes[0].claim_code),false);
  // A new round cannot move an already opened screen to the new contest.
  const next=(await db.query<{id:string}>("insert into rounds(timing_version,starts_at,ends_at,cutoff_at) values(2,now()+interval '1 minute',now()+interval '2 minutes',now()+interval '130 seconds') returning id")).rows[0].id;
  assert.equal((await db.query<{v:any}>('select public_board() v')).rows[0].v.round.id,next);
  assert.equal((await db.query<{v:any}>('select round_board($1) v',[r])).rows[0].v.round.id,r);
  await db.query("update rounds set ends_at=now()-interval '11 seconds',cutoff_at=now()-interval '1 second' where id=$1",[next]);
  const late=(await db.query<{id:string}>("insert into runs(participant_id,round_id,seed,started_at) values($1,$2,99,now()-interval '20 seconds') returning id",[ids[6],next])).rows[0].id;
  await assert.rejects(db.query('select finish_run($1,$2,1000,1000,0)',[late,ids[6]]),/ROUND_FINAL/);
  await db.query('select advance_competitions()');
  const empty=(await db.query<{v:any}>('select round_board($1) v',[next])).rows[0].v;assert.equal(empty.round.status,'final');assert.deepEqual(empty.entries,[]);
  for(const role of ['anon','authenticated']){await db.exec(`set role ${role}`);await assert.rejects(db.query('select advance_competitions()'));await assert.rejects(db.query('select round_board($1)',[r]));await assert.rejects(db.query('select claim_code from prizes'));await db.exec('reset role');}
 }finally{await db.close();}
});
test('new deadline is end-of-countdown; five-second send delay follows server time, legacy versions retain buffer',()=>{
 const start='2026-10-01T18:00:00Z',cutoff='2026-10-01T18:01:10Z';
 assert.equal(runLimit(start,cutoff,5,2),60000);
 assert.equal(runLimit(start,cutoff,4,1),65000);
 assert.equal(runLimit(start,cutoff,3,1),70000);
 assert.equal(submissionDelay(65000,1000,50,60050),4000);
 assert.equal(submissionDelay(65000,1000,50,67000),0);
});
test('rotation uses 36/15/9 seconds, manual override and deadline/winners priority',()=>{
 const r:Round={id:randomUUID(),title:'Pause',prize:'Sodavand',status:'open',starts_at:new Date(0).toISOString(),ends_at:new Date(120000).toISOString(),cutoff_at:new Date(130000).toISOString(),timing_version:2,screen_rotation:true};
 assert.equal(screenView(r,0),'leaderboard');assert.equal(screenView(r,35999),'leaderboard');assert.equal(screenView(r,36000),'rules');assert.equal(screenView(r,50999),'rules');assert.equal(screenView(r,51000),'qr');assert.equal(screenView(r,60000),'leaderboard');
 assert.equal(screenView({...r,screen_rotation:false,screen_mode:'info'},61000),'info');
 assert.equal(screenView(r,110000),'countdown');assert.equal(screenView(r,120000),'collecting');assert.equal(screenView(r,130000),'collecting');assert.equal(screenView({...r,status:'final',screen_mode:'winners',screen_rotation:false},130000),'winners');
});
test('screen tokens are bound to round, signature, kind and expiry',()=>{
 const id=randomUUID(),secret='a'.repeat(40),token=screenToken(id,20000,secret);
 assert.equal(verifyScreenToken(token,id,secret,10000),true);
 assert.equal(verifyScreenToken(token,randomUUID(),secret,10000),false);
 assert.equal(verifyScreenToken(token,id,'b'.repeat(40),10000),false);
 assert.equal(verifyScreenToken(token,id,secret,20000),false);
 assert.equal(verifyScreenToken(token+'x',id,secret,10000),false);
 assert.equal(verifyScreenToken(token+'.extra',id,secret,10000),false);
 const body=Buffer.from(JSON.stringify({roundId:id,expires:20000,kind:'admin'})).toString('base64url');
 assert.equal(verifyScreenToken(`${body}.${createHmac('sha256',secret).update(body).digest('base64url')}`,id,secret,10000),false);
});

test('start now preserves duration and screen identity, opens play, and cannot reset an active round',async()=>{
 const db=await database();try{
  const r=(await db.query<{id:string}>("insert into rounds(timing_version,starts_at,ends_at,cutoff_at) values(2,now()+interval '30 seconds',now()+interval '210 seconds',now()+interval '220 seconds') returning id")).rows[0].id;
  const player=randomUUID();await db.query("insert into participants(id,nickname) values($1,'Startnu')",[player]);
  await assert.rejects(db.query('select start_round_run($1,99,$2)',[player,r]),/ROUND_CLOSED/);
  await db.query('select start_round_now($1)',[r]);
  const first=(await db.query<{s:string;duration:number;buffer:number}>('select starts_at::text s,extract(epoch from ends_at-starts_at)::float duration,extract(epoch from cutoff_at-ends_at)::float buffer from rounds where id=$1',[r])).rows[0];
  assert.equal(first.duration,180);assert.equal(first.buffer,10);
  const run=(await db.query<{v:any}>('select start_round_run($1,99,$2) v',[player,r])).rows[0].v;assert.equal(run.round.id,r);
  await db.query('select start_round_now($1)',[r]);
  assert.equal((await db.query<{s:string}>('select starts_at::text s from rounds where id=$1',[r])).rows[0].s,first.s);
  for(const role of ['anon','authenticated']){await db.exec(`set role ${role}`);await assert.rejects(db.query('select start_round_now($1)',[r]));await db.exec('reset role');}
  await db.query("update rounds set status='final' where id=$1",[r]);
  await assert.rejects(db.query('select start_round_now($1)',[r]),/ROUND_CLOSED/);
 }finally{await db.close();}
});

test('phone countdown uses the last ten seconds of the game deadline, never practice',()=>{
 assert.equal(closingCountdown(10001,false),null);
 assert.equal(closingCountdown(10000,false),10);
 assert.equal(closingCountdown(9000,false),9);
 assert.equal(closingCountdown(1,false),1);
 assert.equal(closingCountdown(0,false),null);
 assert.equal(closingCountdown(-100,false),null);
 assert.equal(closingCountdown(5000,true),null);
 assert.equal(closingCountdown(Infinity,false),null);
});
