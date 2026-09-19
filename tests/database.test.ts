import {test} from 'node:test';
import assert from 'node:assert/strict';
import {PGlite} from '@electric-sql/pglite';
import {readFile} from 'node:fs/promises';
import {randomUUID} from 'node:crypto';
test('database enforces RLS, best scores, closure, immutable winners and one-time redemption',async()=>{
 const db=new PGlite();try{
 await db.exec('create role anon; create role authenticated; create role service_role bypassrls;');
 await db.exec(await readFile(new URL('../supabase/001_initial.sql',import.meta.url),'utf8'));
 const p=randomUUID(),q=randomUUID();
 await db.query('insert into participants(id,nickname) values ($1,\'Test1\'),($2,\'Test2\')',[p,q]);
 await db.exec('set role anon');await assert.rejects(db.query('select * from participants'));await assert.rejects(db.query('select public_board()'));await db.exec('reset role');
 const round=(await db.query<{id:string}>("insert into rounds(ends_at,cutoff_at) values(now()+interval '3 minutes',now()+interval '4 minutes') returning id")).rows[0].id;
 const result=(await db.query<{v:any}>('select start_run($1,23) v',[p])).rows[0].v;
 await assert.rejects(db.query('select start_run($1,24)',[p]),/TOO_FAST/);
 await db.query("update runs set started_at=now()-interval '10 seconds' where id=$1",[result.run.id]);
 await db.query('select finish_run($1,$2,3500)',[result.run.id,p]);await db.query('select finish_run($1,$2,3500)',[result.run.id,p]);
 let board=(await db.query<{v:any}>('select public_board() v')).rows[0].v;assert.equal(board.entries[0].score_ms,3500);assert.equal(board.participants,1);
 const second=(await db.query<{v:any}>('select start_run($1,25) v',[p])).rows[0].v;
 await db.query("update runs set started_at=now()-interval '10 seconds' where id=$1",[second.run.id]);await db.query('select finish_run($1,$2,1200)',[second.run.id,p]);
 board=(await db.query<{v:any}>('select public_board() v')).rows[0].v;assert.equal(board.entries[0].score_ms,3500);
 await assert.rejects(db.query('select finalize_round($1,$2)',[round,JSON.stringify({[p]:'a'.repeat(64)})]),/WAIT_FOR_RUNS/);
 await db.query("update rounds set status='closing',ends_at=now()-interval '1 minute',cutoff_at=now()-interval '30 seconds' where id=$1",[round]);
 await assert.rejects(db.query('select start_run($1,26)',[p]),/ROUND_CLOSED/);
 await db.query('select finalize_round($1,$2)',[round,JSON.stringify({[p]:'a'.repeat(64)})]);
 await assert.rejects(db.query('select finalize_round($1,$2)',[round,JSON.stringify({[p]:'a'.repeat(64)})]),/INVALID_ROUND/);
 await db.query('select redeem_prize($1)',['a'.repeat(64)]);await assert.rejects(db.query('select redeem_prize($1)',['a'.repeat(64)]),/ALREADY_REDEEMED/);
 await db.query('update participants set hidden=true where id=$1',[p]);board=(await db.query<{v:any}>('select public_board() v')).rows[0].v;assert.equal(board.entries[0].nickname,'Bulldogs-fan');assert.equal(board.entries[0].rank,1);
 }finally{await db.close();}
});
