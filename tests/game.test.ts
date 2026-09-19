import {test} from 'node:test';
import assert from 'node:assert/strict';
import {act,advance,allowance,createGame,replay,position,distanceToSegment,type Game} from '../lib/game';
test('20% less every 10 seconds, permanently clamped at one second',()=>{
 assert.equal(allowance(0),3500);assert.equal(allowance(9.999),3500);assert.equal(allowance(10),2800);assert.ok(Math.abs(allowance(20)-2240)<.001);assert.ok(Math.abs(allowance(59.99)-1146.88)<.001);assert.equal(allowance(60),1000);assert.equal(allowance(10000),1000);
});
test('catching, opponent taps, pause and modified score validation',()=>{
 const g=createGame(5);advance(g,4000);assert.equal(g.dead,'caught');assert.equal(g.score,3500);assert.equal(replay(5,[],3500).score,3500);assert.throws(()=>replay(5,[],12000));
 const h=createGame(5);const input={t:900,target:h.stage.away[0].id};act(h,input);assert.equal(h.dead,'opponent');assert.equal(replay(5,[input],900).dead,'opponent');assert.equal(replay(5,[],1700,Infinity,true).score,1700);
 assert.throws(()=>replay(5,[{t:5,target:'fake'}],3500));assert.throws(()=>replay(5,[{t:NaN,target:'fake'}],3500));
});
function safeChoice(g:Game,t:number){return g.stage.home.find(p=>g.stage.away.every(a=>distanceToSegment(position(a,t),g.active,position(p,t))>=25));}
test('500 seeded games always have a safe forward pass, including after 90 seconds; replay matches',()=>{
 for(let seed=1;seed<=500;seed++){
  const g=createGame(seed);for(let i=0;i<180;i++){
   const t=Math.ceil(g.readyAt+allowance(g.readyAt/1000)*.58);const safe=safeChoice(g,t);assert.ok(safe,`seed ${seed}, step ${i}`);assert.ok(safe.y<g.active.y);
   assert.ok(act(g,{t,target:safe.id}));advance(g,t+450);assert.equal(g.dead,null);
  }
  advance(g,g.deadline+20);assert.equal(g.dead,'caught');assert.equal(replay(seed,g.events,g.score).score,g.score);
 }
});
test('bank pass uses both segments, cannot be fabricated, and travels visibly',()=>{
 let checked=0;
 for(let seed=1;seed<100;seed++){
  const g=createGame(seed);
  for(let i=0;i<14;i++){
   const t=Math.ceil(g.readyAt+400);
   if(g.stage.bank){const b=g.stage.bank;assert.ok(act(g,{t,target:b.target,bank:true}));assert.equal(g.flight!.end-t,600);advance(g,t+600);assert.equal(g.dead,null);checked++;}
   else {const safe=safeChoice(g,t)!;assert.equal(act(g,{t,target:safe.id,bank:true}),false);act(g,{t,target:safe.id});advance(g,t+450);}
  }
 }
 assert.ok(checked>100);
});
test('competition cutoff interrupts possession and flight; out of order inputs rejected',()=>{
 const g=createGame(3,1100);act(g,{t:1000,target:g.stage.home[0].id});advance(g,1500);assert.equal(g.dead,'whistle');assert.equal(g.score,1100);assert.equal(replay(3,g.events,1100,1100).score,1100);
 assert.throws(()=>replay(3,[{t:1000,target:'h0-0'},{t:1001,target:'h0-1'}],3500));
});
