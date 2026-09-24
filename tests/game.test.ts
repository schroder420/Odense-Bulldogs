import {test} from 'node:test';
import assert from 'node:assert/strict';
import {act,advance,allowance,createGame,formatScore,replay,position,distanceToSegment,stageFor,totalScore,PASS_POINT,type Game} from '../lib/game';
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

function survive(g:Game,passes:number){for(let i=0;i<passes;i++){const t=Math.ceil(g.readyAt+allowance(g.readyAt/1000)*.58);const safe=safeChoice(g,t)!;assert.ok(act(g,{t,target:safe.id}));advance(g,t+450);}advance(g,g.deadline+20);}
test('samlet score er overlevelsestid plus en aflevering, mens aeldre versioner beholder ren tid',()=>{
 const g=createGame(7);survive(g,11);
 assert.equal(g.dead,'caught');assert.equal(g.passes,11);
 assert.equal(totalScore(g),g.score+11*PASS_POINT);
 // Version 1-2 blev scoret paa tid alene og maa ikke faa afleveringer lagt til bagefter.
 const old=createGame(7,Infinity,2);survive(old,11);
 assert.equal(old.passes,11);assert.equal(totalScore(old),old.score);
 // Eksemplet fra aftalen: 24,82 sekunder + 11 afleveringer = 35,82 point.
 assert.equal(formatScore(24820+11*PASS_POINT),'35,82');
 assert.equal(totalScore(replay(7,g.events,g.score)),totalScore(g));
});
test('undertal fjerner en medspiller uden at fjerne modstanderpresset',()=>{
 let checked=0;
 for(let seed=1;seed<=200;seed++)for(let step=2;step<8;step++){
  const active={x:200,y:0};
  const full=stageFor(seed,step,active,5000),under=stageFor(seed,step,active,28000);
  assert.equal(full.shortHanded,false);assert.equal(under.shortHanded,true);
  assert.equal(full.home.length,3);assert.equal(under.home.length,2);
  assert.equal(under.away.length,full.away.length,`seed ${seed} step ${step}`);
  // Der skal stadig vaere mindst en reel afleveringsmulighed.
  assert.ok(under.home.some(p=>under.away.every(a=>distanceToSegment(position(a,28000),active,position(p,28000))>=25)));
  checked++;
 }
 assert.ok(checked>1000);
 // Version 2 mistede en modstander sammen med medspilleren. Den fejl er nu kun historik.
 assert.ok(stageFor(1,4,{x:200,y:0},28000,2).away.length<stageFor(1,4,{x:200,y:0},28000,3).away.length);
});

test('every highlighted onboarding receiver makes a safe first pass and replays correctly',()=>{
 for(let seed=1;seed<=500;seed++)for(const target of createGame(seed).stage.home){
  const game=createGame(seed);assert.ok(act(game,{t:0,target:target.id}));
  advance(game,450);assert.equal(game.dead,null);assert.equal(game.passes,1);
  advance(game,game.deadline+1);
  assert.equal(totalScore(replay(seed,game.events,game.score)),totalScore(game));
 }
});
