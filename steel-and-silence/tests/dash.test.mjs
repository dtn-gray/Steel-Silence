import test from 'node:test';
import assert from 'node:assert/strict';
import {Duel,STEP,DASH,SWORD_LENGTH,MOVES,CONTROLS} from '../dist/engine.js';
import {distance} from '../dist/math3d.js';
const run=(d,s)=>{for(let i=0;i<Math.round(s/STEP);i++)d.tick(STEP);};
function setup(){const d=new Duel({random:()=>.5});d.mode='local';d.phase='fight';d.fighters[0].x=450;d.fighters[1].x=1150;run(d,.2);return d;}

test('sidestep and guard keys are swapped for both players without cross-control',()=>{
 const d=setup(),[p,e]=d.fighters;d.input('w',true);d.input('arrowup',true);run(d,.3);assert(p.z< -20&&e.z< -20);assert.equal(p.guard,'high');assert.equal(e.guard,'high');
 d.input('w',false);d.input('arrowup',false);d.input('e',true);d.input('o',true);run(d,.3);assert.equal(p.guard,'low');assert.equal(e.guard,'low');assert(Math.abs(p.vz)<1&&Math.abs(e.vz)<1);
 d.input('q',true);d.input('u',true);assert.equal(p.guard,'high');assert.equal(e.guard,'high');assert.equal(CONTROLS[0].dash,' ');assert.equal(CONTROLS[1].dash,'shiftright');
});

test('dash follows every movement direction and normalizes diagonals',()=>{
 for(const keys of[['d'],['a'],['w'],['s'],['d','w'],['d','s'],['a','w'],['a','s']]){
  const d=setup(),f=d.fighters[0],x=f.x,z=f.z;for(const key of keys)d.input(key,true);d.input(' ',true);
  assert(f.evade>0);assert(Math.abs(Math.hypot(f.dashDir.x,f.dashDir.z)-1)<1e-9);const dir={...f.dashDir};
  run(d,.20);const dx=f.x-x,dz=f.z-z,range=Math.hypot(dx,dz);assert(range>60&&range<100);assert((dx*dir.x+dz*dir.z)/range>.99);
  if(keys.includes('w'))assert(dz< -20);if(keys.includes('s'))assert(dz>20);if(keys.includes('a'))assert(dx< -20);if(keys.includes('d'))assert(dx>20);
  assert(Math.hypot(f.vx,f.vz)<=DASH.speed+.01);
 }
});

test('dash keeps its chosen world direction as the character turns',()=>{
 const d=setup(),[p,e]=d.fighters;d.input('w',true);d.input(' ',true);const dir={...p.dashDir};e.z=220;run(d,.15);assert.deepEqual(p.dashDir,dir);assert(p.z< -30);assert(Math.abs(p.yaw)>.05);
});

test('a neutral dash goes forward and a released movement can carry through momentum',()=>{
 const d=setup(),p=d.fighters[0],x=p.x;d.input(' ',true);run(d,.2);assert(p.x>x+60);assert(Math.abs(p.z)<1);
 const moving=setup(),f=moving.fighters[0];moving.input('s',true);run(moving,.15);moving.input('s',false);assert(f.vz>20);moving.input(' ',true);assert(f.dashDir.z>.99);
});

test('Player 2 dashes from arrow input independently and at the same speed',()=>{
 const d=setup(),[p,e]=d.fighters,px=p.x,ex=e.x;d.input('arrowleft',true);d.input('arrowup',true);d.input('shiftright',true);assert(e.evade>0);assert.equal(p.evade,0);run(d,.2);assert(e.x<ex-40&&e.z< -40);assert.equal(p.x,px);assert(Math.hypot(e.vx,e.vz)<=DASH.speed+.01);
});

test('dash spends stamina once, cannot retrigger while held, and respects interruption',()=>{
 const d=setup(),[p,e]=d.fighters;p.stamina=10;assert(!d.dash(p));p.stamina=100;d.input(' ',true);assert.equal(p.stamina,100-DASH.cost);run(d,.5);d.input(' ',true);assert.equal(p.evade,0);assert.equal(d.consumeEvents().filter(e=>e.type==='dash').length,1);
 d.input(' ',false);d.input(' ',true);assert(p.evade>0);d.applyHit(e,p,28);assert.equal(p.evade,0);assert(!d.dash(p));run(d,.6);assert(d.attack(p));assert(!d.dash(p));
});

test('dash cannot pass through a fighter or the courtyard boundary',()=>{
 const d=setup(),[p,e]=d.fighters;p.x=1320;e.x=1425;d.input('d',true);d.input(' ',true);for(let i=0;i<80;i++){d.tick(STEP);assert(Math.hypot(p.x-800,p.z)<=630.01);assert(Math.hypot(e.x-800,e.z)<=630.01);assert(Math.hypot(e.x-p.x,e.z-p.z)>102);}
});

test('the larger sword uses its full visible length for collision and hit detection',()=>{
 const d=setup(),[p,e]=d.fighters;assert(SWORD_LENGTH>170);assert(Math.abs(distance(p.rig.hand,p.rig.tip)-SWORD_LENGTH)<1e-8);
 p.x=650;e.x=905;e.guard='low';run(d,.3);assert(d.attack(p));run(d,1.5);assert.equal(e.health,100-MOVES.high.damage);
});

test('both wide wind-ups can be cancelled by selecting the opposite guard',()=>{
 for(const type of ['high','low']){
  const d=setup(),p=d.fighters[0];d.setGuard(p,type);run(d,.3);d.attack(p);run(d,MOVES[type].wind-.03);
  assert(p.pose.chestX< -15);if(type==='high'){assert(p.pose.handX< -30);assert(p.pose.blade< -2.4);assert(p.pose.bladeSide>.58);}else{assert(p.pose.handX< -14);assert(p.pose.bladeSide< -.7);}
  assert(d.setGuard(p,type==='high'?'low':'high'));assert.equal(p.attack,null);run(d,.6);assert.equal(d.fighters[1].health,100);assert(!d.consumeEvents().some(e=>e.type==='hit'));
 }
});
