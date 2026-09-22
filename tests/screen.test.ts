import {test} from 'node:test';
import assert from 'node:assert/strict';
import {screenView} from '../lib/screen';
import type {Round} from '../lib/types';
import {PGlite} from '@electric-sql/pglite';
import {readFile} from 'node:fs/promises';
const round:Round={id:'test',title:'Pause',status:'open',starts_at:new Date(0).toISOString(),ends_at:new Date(60000).toISOString(),cutoff_at:new Date(90000).toISOString(),prize:'Billetter',screen_mode:'info'};
test('countdown overrides remote content only during the final ten seconds of entry',()=>{
 assert.equal(screenView(round,49000),'info');assert.equal(screenView(round,50000),'countdown');assert.equal(screenView(round,59999),'countdown');assert.equal(screenView(round,60000),'info');
 assert.equal(screenView({...round,status:'closing'},55000),'info');
});
test('final results show winners, while staff can still cut away and return',()=>{
 assert.equal(screenView({...round,status:'final',screen_mode:'leaderboard'},55000),'winners');
 assert.equal(screenView({...round,status:'final',screen_mode:'rules'},55000),'rules');
 assert.equal(screenView({...round,screen_mode:'winners'},1000),'leaderboard');
 assert.equal(screenView(null,0),'leaderboard');
});
test('screen settings persist in board and remain protected by database access rules',async()=>{
 const db=new PGlite();try{
 await db.exec('create role anon; create role authenticated; create role service_role bypassrls;');
 for(const file of ['001_initial.sql','002_opponent_kit.sql','003_screen_control.sql','004_total_score.sql','005_qr_screen.sql'])await db.exec(await readFile(new URL('../supabase/'+file,import.meta.url),'utf8'));
 await db.exec("insert into rounds(ends_at,cutoff_at) values(now()+interval '1 minute',now()+interval '2 minutes'); update rounds set screen_mode='info',screen_body='Velkommen',pickup_instructions='Hent ved indgang A';");
 const board=(await db.query<{v:any}>('select public_board() v')).rows[0].v;
 assert.equal(board.round.screen_mode,'info');assert.equal(board.round.pickup_instructions,'Hent ved indgang A');
 await db.exec("update rounds set screen_mode='qr'");
 assert.equal((await db.query<{v:any}>('select public_board() v')).rows[0].v.round.screen_mode,'qr');
 await assert.rejects(db.exec("update rounds set screen_mode='invalid'"));
 await db.exec('set role anon');await assert.rejects(db.exec("update rounds set screen_mode='rules'"));
 }finally{await db.close();}
});
test('QR mode is remotely selectable and the last ten seconds still take precedence',()=>{
 assert.equal(screenView({...round,screen_mode:'qr'},1000),'qr');
 assert.equal(screenView({...round,screen_mode:'qr'},55000),'countdown');
 assert.equal(screenView({...round,status:'final',screen_mode:'qr'},55000),'qr');
});
