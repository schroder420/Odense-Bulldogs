import {test} from 'node:test';
import assert from 'node:assert/strict';
import {stageFor,position,distanceToSegment} from '../lib/game';
test('safe passes and highlighted banks remain clear throughout possession',()=>{
 for(let seed=1;seed<=100;seed++)for(let step=0;step<20;step++)for(const x of [71,200,329]){
  const active={x,y:0},stage=stageFor(seed,step,active,28000);
  for(let t=28000;t<31500;t+=125){
   assert.ok(stage.home.some(p=>stage.away.every(a=>distanceToSegment(position(a,t),active,position(p,t))>=25)));
   if(stage.bank){const b=stage.bank,p=stage.home.find(p=>p.id===b.target)!;
    assert.ok(stage.away.every(a=>distanceToSegment(position(a,t),active,b.point)>=25&&distanceToSegment(position(a,t),b.point,position(p,t))>=25),`bank ${seed}/${step}/${x}/${t}`);
   }
  }
 }
});
