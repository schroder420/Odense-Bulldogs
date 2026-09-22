import {test} from 'node:test';
import assert from 'node:assert/strict';
import {waitingPose,puckOffset,endpointWeight,type Pose} from '../lib/skater-pose';
test('blade anchor follows the exact mirror, vertical scale and rotation used by the sprite',()=>{
 const pose:Pose={front:0,mirror:false,angle:0,stride:false};
 assert.deepEqual(puckOffset(pose,1),{x:33,y:-47});
 assert.deepEqual(puckOffset({...pose,mirror:true},2),{x:-33,y:-94});
 const rotated=puckOffset({...pose,angle:Math.PI/2},1);
 assert.ok(Math.abs(rotated.x-47)<1e-9);assert.ok(Math.abs(rotated.y-33)<1e-9);
 assert.deepEqual(puckOffset({...pose,front:1},1),{x:38,y:55});
});
test('poses are stable and varied; puck endpoints leave bank and mid-flight collision paths untouched',()=>{
 const poses=Array.from({length:12},(_,i)=>waitingPose(`home-${i}`,200,250));
 assert.ok(poses.some(p=>p.front===0));assert.ok(poses.some(p=>p.front===1));
 assert.ok(poses.some(p=>p.mirror));assert.ok(poses.some(p=>p.stride));
 assert.deepEqual(waitingPose('home-1',200,250),waitingPose('home-1',200,250));
 assert.equal(endpointWeight(0),1);assert.equal(endpointWeight(.5),0);assert.equal(endpointWeight(1),0);
});
