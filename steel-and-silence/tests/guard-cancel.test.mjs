import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {Duel,STEP,MOVES,CONTROLS,MAX_HEALTH} from '../dist/engine.js';
const run=(d,t)=>{for(let i=0;i<Math.round(t/STEP);i++)d.tick(STEP);};
function setup(){const d=new Duel({random:()=>.5});d.phase='fight';d.mode='local';d.fighters[0].x=450;d.fighters[1].x=1150;return d;}

test('both players cancel either cut in wind-up, active swing, follow-through, and recovery',()=>{
 for(let id=0;id<2;id++)for(const type of['high','low'])for(const stage of['wind','strike','follow','recover']){
  const d=setup(),f=d.fighters[id],c=CONTROLS[id],m=MOVES[type],opposite=type==='high'?'low':'high';
  d.setGuard(f,type);run(d,.3);d.input(c.attack,true);
  const t=stage==='wind'?m.wind*.7:stage==='strike'?m.wind+m.strike*.5:stage==='follow'?m.wind+m.strike+m.follow*.5:m.wind+m.strike+m.follow+m.recover*.4;
  run(d,t);assert(f.attack,`${id} ${type} ${stage}`);if(stage==='strike')assert(d.active(f));
  f.buffer={life:.2};const pose=structuredClone(f.pose),rig=structuredClone(f.rig),stamina=f.stamina;
  d.input(c[opposite],true);d.input(c[opposite],false);
  assert.equal(f.attack,null);assert.equal(f.guard,opposite);assert.equal(f.buffer,null);assert.equal(f.trail.length,0);assert(!d.active(f));assert.equal(f.stamina,stamina,'an already-paid attack is not refunded or charged again');
  assert.deepEqual(f.pose,pose,'guard input must not snap the animation');assert.deepEqual(f.rig,rig);
  assert(d.consumeEvents().some(e=>e.type==='guardCancel'&&e.fighter===id&&e.guard===opposite));
  run(d,1.2);assert.equal(f.attack,null,'a held attack key must not restart the cancelled cut');assert.equal(d.fighters[1-id].health,MAX_HEALTH);
  d.input(c.attack,false);d.input(c.attack,true);assert.equal(f.attack.type,opposite,'the next cut uses the new latched guard');
 }
});

test('the current guard and removed G/L controls leave an active swing running',()=>{
 for(let id=0;id<2;id++)for(const guard of['high','low']){
  const d=setup(),f=d.fighters[id],c=CONTROLS[id];d.setGuard(f,guard);run(d,.3);d.input(c.attack,true);run(d,MOVES[guard].wind+.1);const attack=f.attack;
  d.input(c[guard],true);assert.equal(f.attack,attack);d.input('g',true);d.input('l',true);assert.equal(f.attack,attack);assert(!('feint'in c));
 }
});

test('cancelling a cut before contact prevents a hit, and after contact preserves damage already dealt',()=>{
 for(const afterContact of[false,true]){
  const d=setup(),[f,target]=d.fighters;d.attack(f);run(d,MOVES.high.wind+.1);d.touches=()=>true;target.guard='low';target.guardBlend=1;
  if(afterContact){d.combat();assert.equal(target.health,MAX_HEALTH-MOVES.high.damage);assert(f.attack.contact);}
  const health=target.health;d.input('e',true);d.combat();assert.equal(target.health,health);run(d,1);assert.equal(target.health,health);assert.equal(f.attack,null);
 }
});

test('the CPU uses guard switching to cancel its own committed cut',()=>{
 const d=setup(),f=d.fighters[1];d.mode='duel';d.level=2;d.attack(f);f.attack.t=MOVES.high.wind+.1;f.ai.switchAt=.1;f.ai.timer=1;f.ai.cooldown=1;d.ai(f,d.fighters[0],STEP);
 assert.equal(f.attack,null);assert.equal(f.guard,'low');assert(d.consumeEvents().some(e=>e.type==='guardCancel'&&e.fighter===1));
});

test('guard cancellation returns the blade smoothly to the selected guard',()=>{
 for(const start of['high','low']){
  const d=setup(),f=d.fighters[0];d.setGuard(f,start);run(d,.3);d.attack(f);run(d,MOVES[start].wind+.1);const opposite=start==='high'?'low':'high';d.setGuard(f,opposite);
  let previous=structuredClone(f.rig),largest=0;for(let i=0;i<72;i++){d.tick(STEP);for(const key of['hip','chest','head','hand','elbow']){const a=previous[key],b=f.rig[key];largest=Math.max(largest,Math.hypot(b.x-a.x,b.y-a.y,b.z-a.z));}previous=structuredClone(f.rig);}
  assert(largest<12,`joint moved ${largest} in one step`);assert(Math.abs(f.guardBlend-(opposite==='low'?1:0))<.01);
 }
});

test('keyboard guide, touch buttons, and accessible instructions expose guard cancellation without a feint button',()=>{
 const html=readFileSync(new URL('../dist/index.html',import.meta.url),'utf8'),app=readFileSync(new URL('../dist/app.js',import.meta.url),'utf8');
 assert(!/feint/i.test(html));assert(!/k\.feint/.test(app));assert(!/data-key="[gl]"/.test(html));assert(/Switch guard mid-swing to cancel/.test(html));
 for(const k of['q','e'])assert(html.includes(`data-key="${k}"`));
});
