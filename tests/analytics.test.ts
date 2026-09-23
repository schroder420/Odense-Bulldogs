import {test} from 'node:test';
import assert from 'node:assert/strict';
import {PGlite} from '@electric-sql/pglite';
import {readFile} from 'node:fs/promises';
import {randomUUID} from 'node:crypto';
test('staff analytics scopes rounds, counts repeats and excludes replaced/unfinished runs from accepted totals',async()=>{
 const db=new PGlite();try{
  await db.exec('create role anon;create role authenticated;create role service_role bypassrls;');
  for(const file of ['001_initial.sql','002_opponent_kit.sql','003_screen_control.sql','004_total_score.sql','007_staff_analytics.sql'])await db.exec(await readFile(new URL('../supabase/'+file,import.meta.url),'utf8'));
  const r=randomUUID(),other=randomUUID(),p=randomUUID(),q=randomUUID();
  await db.query("insert into rounds(id,status,ends_at,cutoff_at) values($1,'final',now(),now()),($2,'final',now(),now())",[r,other]);
  await db.query("insert into participants(id,nickname) values($1,'Test1'),($2,'Test2')",[p,q]);
  const empty=(await db.query<{v:any}>('select staff_analytics($1) v',[r])).rows[0].v;
  assert.equal(empty.players,0);assert.equal(empty.averageTimeMs,0);assert.deepEqual(empty.activity,[]);
  await db.query(`insert into runs(round_id,participant_id,seed,finished_at,score_points,time_ms,passes) values
   ($1,$3,1,now(),12000,10000,2),($1,$3,2,now(),24000,20000,4),
   ($1,$3,3,now(),null,null,null),($1,$4,4,null,null,null,null),
   ($2,$4,5,now(),99000,99000,0)`,[r,other,p,q]);
  await db.query("insert into prizes(round_id,participant_id,rank,claim_hash,redeemed_at) values($1,$2,1,'abc',now()),($1,$3,2,'def',null)",[r,p,q]);
  const m=(await db.query<{v:any}>('select staff_analytics($1) v',[r])).rows[0].v;
  assert.equal(m.players,2);assert.equal(m.starts,4);assert.equal(m.repeatPlayers,1);assert.equal(m.accepted,2);
  assert.equal(m.totalTimeMs,30000);assert.equal(m.averageTimeMs,15000);assert.equal(m.passes,6);assert.equal(m.bestScore,24000);
  assert.equal(m.vouchers,2);assert.equal(m.redeemed,1);assert.equal(m.activity.reduce((n:number,a:any)=>n+a.starts,0),4);
  for(const role of ['anon','authenticated']){await db.exec(`set role ${role}`);await assert.rejects(db.query('select staff_analytics($1)',[r]));await db.exec('reset role');}
  await db.exec('set role service_role');assert.equal((await db.query<{v:any}>('select staff_analytics($1) v',[r])).rows[0].v.starts,4);
 }finally{await db.close();}
});
