import test from 'node:test';
import assert from 'node:assert/strict';
import {Duel,STEP,angleDelta} from '../dist/engine.js';
import {point,distance,segmentDistance3D,ik3D} from '../dist/math3d.js';
const run=(d,s)=>{for(let n=0;n<Math.round(s/STEP);n++)d.tick(STEP);};
function setup(){const d=new Duel({random:()=>.5});d.mode='local';d.phase='fight';const[p,e]=d.fighters;p.x=650;e.x=855;e.guard='low';run(d,.4);return d;}

test('swept blade distances distinguish a depth miss from a real intersection',()=>{
 assert.equal(segmentDistance3D(point(0,0,0),point(10,0,0),point(5,-2,0),point(5,2,0)),0);
 assert.equal(segmentDistance3D(point(0,0,0),point(10,0,0),point(5,-2,12),point(5,2,12)),12);
 assert.equal(segmentDistance3D(point(0,0,0),point(0,0,0),point(0,3,4),point(0,3,4)),5);
});

test('three-dimensional IK preserves both limb lengths off the original plane',()=>{
 const a=point(4,3,7),b=point(40,65,-13),joint=ik3D(a,b,43,43,point(0,1,1));assert(Math.abs(distance(a,joint)-43)<1e-7);assert(Math.abs(distance(joint,b)-43)<1e-7);assert(Math.abs(joint.z)>1);
});

test('both players sidestep in depth while remaining targeted and independently controlled',()=>{
 const d=setup(),[p,e]=d.fighters;d.input('s',true);d.input('arrowdown',true);const initial=[p.z,e.z];run(d,.5);assert(p.z>initial[0]+35);assert(e.z>initial[1]+35);assert(Math.abs(angleDelta(p.yaw,Math.atan2(e.z-p.z,e.x-p.x)))<.06);d.input('s',false);run(d,.22);assert(p.yaw>.05);d.input('arrowdown',false);run(d,.4);assert(Math.abs(p.vz)<1&&Math.abs(e.vz)<1);
});

test('a late outside sidestep evades a cut that connects against a stationary fighter',()=>{
 const still=setup();still.attack(still.fighters[0]);run(still,1.4);assert.equal(still.fighters[1].health,66);
 const moving=setup();moving.attack(moving.fighters[0]);run(moving,.52);moving.input('arrowup',true);run(moving,1.0);assert.equal(moving.fighters[1].health,100);assert(Math.abs(moving.fighters[1].z)>70);
});

test('turning is limited during the committed part of an attack',()=>{
 const d=setup(),[p,e]=d.fighters;d.attack(p);run(d,.57);const yaw=p.yaw;e.z+=150;d.tick(STEP);assert(Math.abs(angleDelta(yaw,p.yaw))<.004);assert(Math.abs(angleDelta(p.yaw,Math.atan2(e.z-p.z,e.x-p.x)))>.4);
});

test('depth separation prevents phantom hits even when the side projection overlaps',()=>{
 const d=setup(),[p,e]=d.fighters;d.attack(p);p.attack.t=.70;e.z=180;d.solveRig(e,0);assert(!d.touches(p,e));e.z=0;d.solveRig(e,0);run(d,.12);assert.equal(e.health,66);
});

test('fighters can orbit past the old left/right ordering without crossing bodies',()=>{
 const d=setup(),p=d.fighters[0];d.input('s',true);let rotated=false;
 for(let i=0;i<1300;i++){d.tick(STEP);const e=d.fighters[1];rotated ||= p.x>e.x;assert(Math.hypot(e.x-p.x,e.z-p.z)>101);assert(Number.isFinite(d.camera.angle));}
 assert(rotated);assert(Math.abs(p.z)>30);
});

test('planted feet hold world depth and lift during a sidestep',()=>{
 const d=setup(),p=d.fighters[0];d.input('w',true);let fixed=0,lifted=0;
 for(let i=0;i<100;i++){const before=p.feet.map(f=>({...f}));d.tick(STEP);for(let n=0;n<2;n++){const old=before[n],foot=p.feet[n];if(old.t===1&&foot.t===1){assert(Math.hypot(old.x-foot.x,old.z-foot.z)<.01);fixed++;}if(foot.y<587)lifted++;}}
 assert(fixed>10&&lifted>10);
});

test('arena boundaries constrain sustained movement around the full courtyard',()=>{
 const d=setup();d.input('a',true);d.input('s',true);d.input('arrowright',true);d.input('arrowup',true);run(d,15);for(const f of d.fighters){assert(Math.hypot(f.x-800,f.z)<=630.01);for(const p of Object.values(f.rig))assert(Number.isFinite(p.z));}
});

test('body contact cannot push a fighter outside the arena boundary',()=>{
 const d=setup(),[p,e]=d.fighters;p.x=1420;e.x=1430;p.z=e.z=0;d.tick(STEP);for(const f of[p,e])assert(Math.hypot(f.x-800,f.z)<=630.01);assert(Math.hypot(e.x-p.x,e.z-p.z)>102);
});
