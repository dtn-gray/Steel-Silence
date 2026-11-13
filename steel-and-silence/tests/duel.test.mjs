import test from 'node:test';
import assert from 'node:assert/strict';
import { Duel, STEP, FLOOR, MOVES, MAX_HEALTH, inputKey } from '../dist/engine.js';
function seeded(seed=51){return()=>{seed=(seed*16807)%2147483647;return(seed-1)/2147483646;};}
function run(d,seconds){for(let i=0;i<Math.round(seconds/STEP);i++)d.tick(STEP);}
function place(d,distance=205){const[p,e]=d.fighters;p.x=650;e.x=p.x+distance;for(const f of[p,e]){f.vx=0;f.feet[0].x=f.x-f.face*35;f.feet[1].x=f.x+f.face*43;f.feet.forEach(foot=>{foot.t=1;foot.y=FLOOR;});d.solveRig(f,0);f.prevRig=structuredClone(f.rig);}}
function setup(distance=205){const d=new Duel({random:seeded()});d.mode='local';d.phase='fight';place(d,distance);return d;}
function guards(d,p='high',e='low'){d.setGuard(d.fighters[0],p);d.setGuard(d.fighters[1],e);run(d,.35);}
function finite(d){for(const f of d.fighters){assert(Number.isFinite(f.x));assert(f.health>=0&&f.health<=MAX_HEALTH);assert(f.stamina>=0&&f.stamina<=100);for(const p of Object.values(f.rig)){assert(Number.isFinite(p.x)&&Number.isFinite(p.y)&&Number.isFinite(p.z));assert(Math.abs(p.x)<10000&&Math.abs(p.y)<10000);}}}

test('acceleration, reversal, stopping, and planted footsteps remain smooth',()=>{
 const d=setup(650),p=d.fighters[0];d.input('d',true);const start=p.x;d.tick(STEP);assert(p.x-start>0&&p.x-start<.2);let planted=0,lifted=0;
 for(let n=0;n<100;n++){const before=p.feet.map(f=>({...f}));d.tick(STEP);for(let i=0;i<2;i++){const b=before[i],a=p.feet[i];if(b.t===1&&a.t===1){assert(Math.abs(a.x-b.x)<.01);planted++;}if(a.y<FLOOR-3)lifted++;}}
 assert(planted>15&&lifted>15);assert(p.vx>150);const previous=p.x;d.input('a',true);d.input('d',false);d.tick(STEP);assert(p.x>previous);run(d,.4);assert(p.vx<0);d.input('a',false);run(d,.3);assert(Math.abs(p.vx)<.001);finite(d);
});

test('one attack button takes its cut from a persistent guard selection',()=>{
 const d=setup(600),p=d.fighters[0];d.input('KeyE',true);d.input('KeyE',false);run(d,.3);assert.equal(p.guard,'low');d.input('KeyF',true);assert.equal(p.attack.type,'low');d.input('f',false);run(d,1.5);d.input('q',true);d.input('q',false);d.input('f',true);assert.equal(p.attack.type,'high');assert.deepEqual(Object.keys(MOVES),['high','low']);
});

test('held attack keys do not auto-repeat or queue an endless combo',()=>{
 const d=setup(600);d.input('f',true);run(d,1.6);for(let i=0;i<40;i++){d.input('f',true);d.tick(STEP);}assert.equal(d.consumeEvents().filter(e=>e.type==='windup').length,1);d.input('f',false);d.input('f',true);assert(d.fighters[0].attack);
});

test('guard changes and the slower attack animation blend every joint',()=>{
 const d=setup(600),p=d.fighters[0],initial=structuredClone(p.rig);d.input('e',true);assert.deepEqual(p.rig,initial);d.tick(STEP);assert(Math.abs(p.rig.hand.y-initial.hand.y)<1);run(d,.3);assert(p.rig.hand.y>initial.hand.y+30);d.input('f',true);run(d,.35);assert(p.attack.t<MOVES.low.wind);assert(!d.active(p));
 let before=structuredClone(p.rig),maxJump=0;for(let i=0;i<145;i++){d.tick(STEP);for(const k of['hip','chest','head','hand'])maxJump=Math.max(maxJump,Math.hypot(p.rig[k].x-before[k].x,p.rig[k].y-before[k].y));before=structuredClone(p.rig);}assert(maxJump<12,`joint jumped ${maxJump}`);finite(d);
});

test('matching guards parry; open cuts remove health without ending the round',()=>{
 for(const type of['high','low']){
  const blocked=setup();guards(blocked,type,type);blocked.attack(blocked.fighters[0]);run(blocked,1.6);assert.equal(blocked.fighters[1].health,MAX_HEALTH);assert(blocked.consumeEvents().some(e=>['parry','perfectParry'].includes(e.type)));
  const open=setup();guards(open,type,type==='high'?'low':'high');open.attack(open.fighters[0]);run(open,1.6);assert.equal(open.fighters[1].health,MAX_HEALTH-MOVES[type].damage);assert(!open.fighters[1].dead);assert.equal(open.phase,'fight');assert.deepEqual(open.scores,[0,0]);run(open,2);assert.equal(open.fighters[1].health,MAX_HEALTH-MOVES[type].damage);
 }
});

test('opposite-guard changes cancel late wind-ups without delayed damage',()=>{
 for(const type of['high','low']){
  const d=setup();guards(d,type,type==='high'?'low':'high');d.input('f',true);run(d,MOVES[type].wind-.035);d.input(type==='high'?'e':'q',true);assert.equal(d.fighters[0].attack,null);assert.equal(d.fighters[0].buffer,null);run(d,1.5);assert.equal(d.fighters[1].health,MAX_HEALTH);assert(!d.consumeEvents().some(e=>e.type==='hit'));
 }
});

test('low stamina prevents attacks but still allows an active cut to be cancelled by guard',()=>{
 const d=setup(600),p=d.fighters[0];p.stamina=2;assert(!d.attack(p));p.stamina=100;assert(d.attack(p));run(d,MOVES.high.wind+.10);assert(d.active(p));p.stamina=0;d.input('e',true);assert.equal(p.attack,null);assert.equal(p.guard,'low');assert.equal(p.stamina,0);
});

test('an earlier hit interrupts the opponent mid-wind-up and prevents the counter-hit',()=>{
 const d=setup(),[p,e]=d.fighters;guards(d,'high','high');d.attack(p);run(d,.30);d.input('k',true);assert(e.attack);run(d,.82);const hits=d.consumeEvents().filter(e=>e.type==='hit');assert(hits.some(e=>e.target===1&&e.interrupted));assert.equal(e.attack,null);assert.equal(e.buffer,null);assert.equal(e.health,MAX_HEALTH-MOVES.high.damage);assert.equal(p.health,MAX_HEALTH);run(d,1);assert.equal(p.health,MAX_HEALTH);
});

test('being hit also cancels an active cut, its trail, and any buffered follow-up',()=>{
 const d=setup(600),[p,e]=d.fighters;d.attack(e);run(d,MOVES.high.wind+.10);assert(d.active(e));e.buffer={life:.2};d.applyHit(p,e,28);assert.equal(e.attack,null);assert.equal(e.buffer,null);assert.equal(e.trail.length,0);assert(!d.active(e));assert(e.stun>.3);assert(!d.attack(e));run(d,.7);assert.equal(p.health,MAX_HEALTH);assert.equal(e.health,72);
});

test('two keyboard players move, attack, and cancel by guard independently with no AI',()=>{
 const d=setup(600),[p,e]=d.fighters;d.ai=()=>{throw Error('AI must not run in local mode');};d.input('d',true);d.input('arrowleft',true);const xs=[p.x,e.x];run(d,.3);assert(p.x>xs[0]&&e.x<xs[1]);d.input('d',false);d.input('arrowleft',false);d.input('e',true);d.input('u',true);d.input('f',true);d.input('k',true);assert.equal(p.attack.type,'low');assert.equal(e.attack.type,'high');d.input('q',true);assert.equal(p.attack,null);assert.equal(p.guard,'high');assert(e.attack);d.input('o',true);assert.equal(e.attack,null);assert.equal(e.guard,'low');assert.equal(inputKey('ShiftRight'),'shiftright');
});

test('Player 2 attack uses their guard, can damage Player 1, and CPU keys stay isolated',()=>{
 const d=setup();guards(d,'low','high');d.input('k',true);run(d,1.6);assert.equal(d.fighters[0].health,66);assert.equal(d.fighters[1].health,100);
 const solo=setup(600);solo.mode='duel';solo.ai=()=>0;solo.input('arrowleft',true);solo.input('arrowdown',true);solo.input('k',true);solo.input('j',true);solo.input('q',true);solo.input('l',true);const x=solo.fighters[1].x;run(solo,.3);assert(!solo.fighters[0].attack&&!solo.fighters[1].attack);assert.equal(solo.fighters[1].x,x);assert.equal(solo.fighters[1].guard,'high');
});

test('range, timed parries, directional dashes, and attack buffering still work',()=>{
 const out=setup(600);out.attack(out.fighters[0]);run(out,1.6);assert.equal(out.fighters[1].health,100);
 const d=setup();guards(d,'high','high');d.attack(d.fighters[0]);let perfect=false;for(let i=0;i<180;i++){if(d.fighters[0].attack?.t>.58)d.setGuard(d.fighters[1],'high');d.tick(STEP);perfect ||= d.consumeEvents().some(e=>e.type==='perfectParry');}assert(perfect);assert.equal(d.fighters[1].health,100);
 const back=setup(600),p=back.fighters[0],x=p.x;back.input('a',true);back.input(' ',true);assert.equal(p.x,x);run(back,.25);assert(p.x<x-45);run(back,.4);back.attack(p);run(back,1.1);back.input('f',true);run(back,.18);assert(p.attack&&p.attack.t<.2);
});

test('KO alone scores a round; health resets for each round and three wins finish a match',()=>{
 const d=setup();for(let round=0;round<3;round++){
  for(let hit=0;hit<3;hit++){
   place(d);guards(d,'high','low');assert(d.attack(d.fighters[0]));run(d,hit===2?2.5:1.5);
   if(hit<2){assert.equal(d.phase,'fight');assert.equal(d.scores[0],round);}
  }
  assert.equal(d.fighters[1].health,0);assert(d.fighters[1].dead);assert.equal(d.scores[0],round+1);assert.equal(d.phase,round===2?'match':'round');
  if(round<2){d.nextRound();run(d,2);assert(d.fighters.every(f=>f.health===MAX_HEALTH));}
 }
 d.start({mode:'local'});run(d,2);assert.equal(d.phase,'fight');assert.deepEqual(d.scores,[0,0]);assert.equal(d.round,1);assert(d.fighters.every(f=>f.health===100));
});

test('simultaneous lethal contacts produce a draw instead of favoring Player 1',()=>{
 const d=setup(500),[p,e]=d.fighters;p.health=e.health=20;p.guard='high';e.guard='low';d.attack(p);d.attack(e);p.attack.t=MOVES.high.wind+.1;e.attack.t=MOVES.low.wind+.1;d.touches=()=>true;d.combat();assert.deepEqual(d.scores,[0,0]);assert(d.roundResult.draw);assert(d.fighters.every(f=>f.dead&&f.health===0));
});

test('pausing freezes both players and transitions reset under a fade',()=>{
 const d=setup(600);d.input('d',true);d.input('arrowleft',true);run(d,.2);d.pause();const data=JSON.stringify(d.fighters);run(d,2);assert.equal(JSON.stringify(d.fighters),data);d.resume();run(d,.1);assert.equal(d.phase,'fight');d.transition();run(d,.29);assert(d.fade>.99);run(d,1.5);assert.equal(d.phase,'fight');assert.equal(d.fade,0);
});

test('KO ragdolls remain connected and settle on the ground',()=>{
 const d=setup(),[p,f]=d.fighters;d.applyHit(p,f,100);d.phase='finish';run(d,4);for(const l of f.ragdoll.links){const a=f.rig[l.a],b=f.rig[l.b];assert(Math.abs(Math.hypot(a.x-b.x,a.y-b.y,a.z-b.z)-l.len)<4);}assert(f.rig.head.y>FLOOR-80);finite(d);
});

test('practice is non-attacking and long CPU matches remain numerically stable',()=>{
 const practice=new Duel({random:seeded()});practice.phase='fight';practice.mode='practice';for(let i=0;i<2000;i++){practice.tick(STEP);assert(!practice.fighters[1].attack);}assert.deepEqual(practice.scores,[0,0]);
 const d=new Duel({random:seeded(311)});d.start({level:2});for(let i=0;i<18000;i++){if(d.phase==='match')d.start({level:2});if(d.phase==='round')d.nextRound();if(d.phase==='fight'){const[p,e]=d.fighters;d.input('d',e.x-p.x>220);d.input('a',e.x-p.x<155);if(i%147===0){d.input('f',false);d.input('e',false);d.input('q',false);d.input(i%2?'e':'q',true);d.input('f',true);}if(i%193===0){const guard=d.fighters[0].guard==='high'?'e':'q';d.input(guard,false);d.input(guard,true);}}d.tick(STEP);if(i%100===0)finite(d);d.consumeEvents();}finite(d);
});
