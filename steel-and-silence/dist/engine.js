import {point,add,sub,scale,dot,length,distance,normalize,segmentDistance3D,ik3D} from './math3d.js?v=10';
// A fixed-step duel simulation. Rendering and input run independently of its clock.
export const FLOOR = 590;
export const STEP = 1 / 120;
export const MAX_HEALTH = 100;
export const SWORD_LENGTH = 172;
export const DASH = Object.freeze({duration:.28,speed:460,cost:23,kick:160});
export const CONTROLS = [
 {left:'a',right:'d',high:'q',low:'e',attack:'f',dash:' ',sideUp:'w',sideDown:'s'},
 {left:'arrowleft',right:'arrowright',high:'u',low:'o',attack:'k',dash:'shiftright',sideUp:'arrowup',sideDown:'arrowdown'}
];
export function inputKey(code){
 if(/^Key[A-Z]$/.test(code))return code.slice(3).toLowerCase();
 return code==='Space'?' ':code.toLowerCase();
}
export const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
export const lerp = (a, b, t) => a + (b - a) * t;
export const smooth = t => { t = clamp(t, 0, 1); return t * t * (3 - 2 * t); };
export const damp = (v, to, rate, dt) => lerp(v, to, 1 - Math.exp(-rate * dt));
const hypot = Math.hypot;
const copyRig=(r,destination={})=>{for(const k in r){const a=r[k],b=destination[k]||(destination[k]={});b.x=a.x;b.y=a.y;b.z=a.z;}return destination;};
const high = { hipX:0,hipY:0,chestX:5,chestY:0,headX:3,handX:56,handY:-169,blade:-.72,bladeSide:.06,offX:-36,offY:-157 };
const low = { ...high,hipY:3,chestX:8,handX:57,handY:-116,blade:-.12,offY:-150 };
const POSES = {
 high: [
  { ...high },
  { ...high, hipX:-13,hipY:5,chestX:-19,handX:-35,handY:-228,blade:-2.60,bladeSide:.65,offX:-54,offY:-165 },
  { ...high, hipX:10,hipY:7,chestX:27,handX:89,handY:-175,blade:.16,bladeSide:-.05,offX:-22,offY:-145 },
  { ...high, hipX:12,hipY:9,chestX:26,handX:81,handY:-140,blade:.62,bladeSide:-.24,offX:-35,offY:-151 }
 ],
 low: [
  { ...low },
  { ...low,hipX:-12,hipY:9,chestX:-19,handX:-20,handY:-130,blade:-1.90,bladeSide:-.80,offX:-52,offY:-148 },
  { ...low,hipX:14,hipY:18,chestX:24,handX:91,handY:-95,blade:.15,bladeSide:.12,offX:-31,offY:-134 },
  { ...low,hipX:13,hipY:13,chestX:25,handX:81,handY:-115,blade:.61,bladeSide:.28,offX:-38,offY:-140 }
 ]
};
export const MOVES = {
 high: { wind:.52, strike:.24, follow:.12, recover:.34, cost:24,lane:'high',damage:34,reach:259,drive:65 },
 low: { wind:.48, strike:.26, follow:.10, recover:.36, cost:22,lane:'low',damage:28,reach:259,drive:70 }
};
function blendPose(a,b,t){ return Object.fromEntries(Object.keys(high).map(k=>[k,lerp(a[k],b[k],t)])); }
const segments=segmentDistance3D;
export const angleDelta=(a,b)=>Math.atan2(Math.sin(b-a),Math.cos(b-a));
export const dampAngle=(a,b,rate,dt)=>a+angleDelta(a,b)*(1-Math.exp(-rate*dt));
export class Duel {
 constructor({random=Math.random}={}){
  this.random=random;this.phase='ready';this.phaseTime=0;this.time=0;this.elapsed=0;this.level=1;this.mode='duel';this.scores=[0,0];this.round=1;this.events=[];this.particles=[];this.slow=1;this.freeze=0;this.fade=0;this.keys={};this.camera={x:800,z:0,angle:Math.PI/2+.12,distance:1050};this.roundResult=null;this.resetFighters();this.stats={strikes:0,parries:0,steps:0};this.lastEvent='';this.attackId=0;
 }
 makeFighter(x,face,id){
  const yaw=face>0?0:Math.PI;
  const f={id,x,z:0,vx:0,vz:0,face,yaw,prevYaw:yaw,sideIntent:0,sideLean:0,guard:'high',guardBlend:0,guardReturn:null,guardAge:2,parryWindow:0,health:MAX_HEALTH,hurt:0,stamina:100,attack:null,buffer:null,recovery:0,stun:0,recoil:0,evade:0,dashDir:point(face,0,0),dead:false,pose:{...high},breath:this.random()*6,lean:0,headTilt:0,bob:0,cloth:0,knockDir:point(-face,0,0),feet:[
   {x:x-face*35,z:-face*19,y:FLOOR,from:point(x-face*35,FLOOR,-face*19),to:point(x-face*35,FLOOR,-face*19),t:1,duration:.22,yaw,fromYaw:yaw},
   {x:x+face*43,z:face*19,y:FLOOR,from:point(x+face*43,FLOOR,face*19),to:point(x+face*43,FLOOR,face*19),t:1,duration:.22,yaw,fromYaw:yaw}
  ],trail:[],rig:null,prevRig:null,blade:high.blade,ai:{timer:.7,reaction:null,seen:null,cooldown:1.25,dir:0,retreat:0,side:0,sideTimer:0},ragdoll:null};
  this.solveRig(f,STEP);f.prevRig=copyRig(f.rig);return f;
 }

 resetFighters(){this.fighters=[this.makeFighter(545,1,0),this.makeFighter(1055,-1,1)];this.particles=[];this.keys={};}
 emit(type,extra={}){this.events.push({...extra,type});}
 consumeEvents(){const e=this.events;this.events=[];return e;}
 start({mode=this.mode,level=this.level}={}){this.mode=mode;this.level=level;this.elapsed=0;this.scores=[0,0];this.round=1;this.stats={strikes:0,parries:0,steps:0};this.transition();}
 transition(){this.phase='transition';this.phaseTime=0;this.swapped=false;this.roundResult=null;this.freeze=0;this.slow=1;this.keys={};this.fighters.forEach(f=>f.buffer=null);}
 nextRound(){if(this.phase!=='round')return;this.round++;this.transition();}
 pause(){if(['fight','countdown','transition','finish'].includes(this.phase)){this.savedPhase=this.phase;this.phase='paused';this.keys={};this.fighters.forEach(f=>f.buffer=null);return true;}return false;}
 resume(){if(this.phase==='paused'){this.phase=this.savedPhase;this.savedPhase=null;return true;}return false;}
 setGuard(f,lane){
  if(f.dead||(lane!=='high'&&lane!=='low'))return false;
  if(lane!==f.guard){
   f.guard=lane;f.guardAge=0;
   if(f.attack){
    // Changing guard stops even an active cut. Preserve the current pose so
    // the existing animation blend brings the blade into its new guard.
    f.attack=null;f.buffer=null;f.trail=[];f.recovery=Math.max(f.recovery,.12);f.ai.switchAt=0;
    f.guardReturn={from:{...f.pose},t:0};
    this.emit('guardCancel',{fighter:f.id,guard:lane});
   }else if(f.guardReturn)f.guardReturn={from:{...f.pose},t:0};
  }
  f.parryWindow=.17;return true;
 }
 input(key,down){
  key=inputKey(key);const was=this.keys[key];this.keys[key]=down;
  if(!down||was||this.phase!=='fight')return;
  const playerCount=this.mode==='local'?2:1;
  for(let i=0;i<playerCount;i++){
   const f=this.fighters[i],controls=CONTROLS[i];
   if(key===controls.high||key===controls.low)this.setGuard(f,key===controls.low?'low':'high');
   if(key===controls.attack){f.buffer={life:.20};this.tryBuffered(f);}
   if(key===controls.dash)this.dash(f);
  }
 }
 attack(f){
  const type=f.guard,m=MOVES[type];
  if(f.dead||f.attack||f.evade>0||f.stun>0||f.recovery>0||f.stamina<m.cost)return false;
  f.stamina-=m.cost;f.attack={type,t:0,from:{...f.pose},contact:false,id:++this.attackId};f.buffer=null;f.parryWindow=0;f.guardReturn=null;
  this.stats.strikes++;this.emit('windup',{fighter:f.id,move:type});return true;
 }
 tryBuffered(f){if(f.buffer&&this.attack(f))f.buffer=null;}
 readMovement(f){
  if(f.id===1&&this.mode!=='local')return;
  const c=CONTROLS[f.id],longitudinal=(this.keys[c.right]?1:0)-(this.keys[c.left]?1:0),depth=(this.keys[c.sideDown]?1:0)-(this.keys[c.sideUp]?1:0),sign=f.id===0?1:-1;
  f.intent=longitudinal*sign;f.sideIntent=depth*sign;
 }
 dash(f){
  if(f.dead||f.evade>0||f.attack||f.stun>0||f.stamina<DASH.cost)return false;
  this.readMovement(f);
  const cx=Math.cos(f.yaw),cz=Math.sin(f.yaw),along=(f.intent||0)*((f.intent||0)<0?165:193),side=(f.sideIntent||0)*166;
  let x=cx*along-cz*side,z=cz*along+cx*side,range=Math.hypot(x,z);
  if(range<1){x=f.vx;z=f.vz;range=Math.hypot(x,z);}
  if(range<20){x=cx;z=cz;range=1;}
  f.dashDir=point(x/range,0,z/range);f.stamina-=DASH.cost;f.evade=DASH.duration;f.buffer=null;
  f.vx+=f.dashDir.x*DASH.kick;f.vz+=f.dashDir.z*DASH.kick;
  this.emit('dash',{fighter:f.id,x:f.dashDir.x,z:f.dashDir.z});return true;
 }

 ai(f,target,dt){
  const ai=f.ai,range=Math.hypot(f.x-target.x,f.z-target.z),r=()=>this.random();
  ai.sideTimer=Math.max(0,ai.sideTimer-dt);f.sideIntent=ai.sideTimer>0?ai.side:0;ai.timer-=dt;ai.cooldown-=dt;ai.retreat=Math.max(0,ai.retreat-dt);ai.guardLock=Math.max(0,(ai.guardLock||0)-dt);
  if(this.mode==='practice'){
   ai.dir=range>247?1:range<210?-1:0;
   if(ai.timer<0){this.setGuard(f,r()>.5?'high':'low');ai.timer=1.6+r()*1.4;}
   return ai.dir;
  }
  if(target.attack&&ai.seen!==target.attack.id){
   ai.seen=target.attack.id;ai.reaction={t:.25+(2-this.level)*.08+r()*.14,lane:target.attack.type,willBlock:r()<[.34,.56,.76][this.level],evade:r()<.24};
  }
  if(ai.reaction){
   ai.reaction.t-=dt;
   if(ai.reaction.t<=0&&ai.guardLock<=0){
    if(ai.reaction.willBlock){this.setGuard(f,ai.reaction.lane);ai.guardLock=.72+r()*.18;}
    if(ai.reaction.evade&&range<250){if(r()<.65){ai.side=r()>.5?1:-1;ai.sideTimer=.40;}else ai.retreat=.3;}
    ai.reaction=null;
   }
  }
  if(ai.timer<=0){
   ai.timer=.20+r()*.28;
   if(range<340&&ai.sideTimer<=0&&r()<.08+this.level*.07){ai.side=r()>.5?1:-1;ai.sideTimer=.45+r()*.5;}const want=f.stamina<27?320:240+Math.sin(this.time*.8)*17;
   ai.dir=range>want+13?1:range<want-14?-1:0;
   if(ai.retreat>0)ai.dir=-1;
   if(!target.attack&&ai.guardLock<=0&&r()<.16)this.setGuard(f,r()>.5?'high':'low');
   if(ai.cooldown<=0&&range<280&&f.stamina>30&&!target.dead&&!f.attack){
    const punish=target.attack&&target.attack.t>MOVES[target.attack.type].wind+MOVES[target.attack.type].strike;
    if(!target.attack||punish){
     if(ai.guardLock<=0)this.setGuard(f,r()<.50+this.level*.08?(target.guard==='high'?'low':'high'):(r()>.5?'high':'low'));
     if(this.attack(f)){ai.cooldown=.95+r()*(1.55-this.level*.3);ai.switchAt=this.level>0&&r()<.16?.26+r()*.14:0;}
    }
   }
  }
  if(ai.switchAt&&f.attack&&f.attack.t>ai.switchAt){this.setGuard(f,f.guard==='high'?'low':'high');ai.switchAt=0;ai.cooldown=.22;}
  return ai.retreat>0?-1:ai.dir;
 }

 tick(realDt){
  const dt=clamp(realDt,0,.04);if(this.phase==='paused')return;
  this.time+=dt;this.phaseTime+=dt;this.fade=0;
  if(this.phase==='transition'){
   this.fade=this.phaseTime<.28?smooth(this.phaseTime/.28):1-smooth((this.phaseTime-.32)/.32);
   if(this.phaseTime>=.28&&!this.swapped){this.resetFighters();this.camera={x:800,z:0,angle:Math.PI/2+.12,distance:1050};this.swapped=true;this.emit('roundStart');}
   if(this.phaseTime>.67){this.phase='countdown';this.phaseTime=0;}
  }else if(this.phase==='countdown'&&this.phaseTime>1.05){this.phase='fight';this.phaseTime=0;this.emit('fight');}
  this.slow=damp(this.slow,1,3,dt);let simDt=dt*this.slow;
  if(this.freeze>0){this.freeze-=dt;simDt*=.06;}
  const fighting=this.phase==='fight';if(fighting)this.elapsed+=simDt;
  const p=this.fighters[0],e=this.fighters[1];
  if(fighting){
   this.readMovement(p);
   if(this.mode==='local')this.readMovement(e);
   else e.intent=this.ai(e,p,simDt);
  }else for(const f of[p,e]){f.intent=0;f.sideIntent=0;}
  for(const f of this.fighters){
   copyRig(f.rig,f.prevRig);f.prevBlade=f.blade;f.prevYaw=f.yaw;
   if(!f.dead){
    const target=f===p?e:p,heading=Math.atan2(target.z-f.z,target.x-f.x);
    let turnRate=9;
    if(f.attack){const m=MOVES[f.attack.type];turnRate=f.attack.t<m.wind?1.55:f.attack.t<m.wind+m.strike+.06?.30:3.2;}
    f.yaw+=clamp(angleDelta(f.yaw,heading),-turnRate*simDt,turnRate*simDt);
   }
   this.updateFighter(f,simDt,fighting);
  }
  if(fighting){
   for(let iteration=0;iteration<8;iteration++){
    const dx=e.x-p.x,dz=e.z-p.z,gap=Math.hypot(dx,dz);
    if(gap>=103)break;
    const nx=gap>.01?dx/gap:1,nz=gap>.01?dz/gap:0,overlap=(103-gap)*.5;p.x-=nx*overlap;p.z-=nz*overlap;e.x+=nx*overlap;e.z+=nz*overlap;
    for(const f of[p,e]){const r=Math.hypot(f.x-800,f.z);if(r>630){f.x=800+(f.x-800)/r*630;f.z=f.z/r*630;}}
   }
   if(!p.dead)this.solveRig(p,0);if(!e.dead)this.solveRig(e,0);
   this.combat();
  }
  for(const particle of this.particles){particle.life-=simDt;particle.x+=particle.vx*simDt;particle.y+=particle.vy*simDt;particle.z+=particle.vz*simDt;particle.vy+=(particle.kind==='spark'?450:35)*simDt;}
  this.particles=this.particles.filter(a=>a.life>0);
  if(this.phase==='finish'&&this.phaseTime>1.65){
   this.phase=this.scores.some(s=>s>=3)?'match':'round';this.emit('result',{result:this.roundResult});
  }
  const center=(p.x+e.x)/2,centerZ=(p.z+e.z)/2,range=Math.hypot(e.x-p.x,e.z-p.z),lineAngle=Math.atan2(e.z-p.z,e.x-p.x);
  this.camera.x=damp(this.camera.x,center,2.6,dt);this.camera.z=damp(this.camera.z,centerZ,2.6,dt);
  this.camera.angle=dampAngle(this.camera.angle,lineAngle+Math.PI/2+.12,2.2,dt);
  this.camera.distance=damp(this.camera.distance,clamp(800+range*.45,880,1180),2,dt);
 }

 updateFighter(f,dt,fighting){
  if(f.dead){this.updateRagdoll(f,dt);return;}
  f.hurt=Math.max(0,f.hurt-dt);f.guardAge+=dt;f.parryWindow=Math.max(0,f.parryWindow-dt);f.recovery=Math.max(0,f.recovery-dt);f.stun=Math.max(0,f.stun-dt);f.evade=Math.max(0,f.evade-dt);f.recoil=damp(f.recoil,0,11,dt);f.breath+=dt*1.8;
  f.stamina=clamp(f.stamina+dt*(f.attack?5:f.stun?9:22),0,100);
  if(f.buffer){f.buffer.life-=dt;if(f.buffer.life<=0)f.buffer=null;else if(fighting)this.tryBuffered(f);}
  const forward=point(Math.cos(f.yaw),0,Math.sin(f.yaw)),right=point(-forward.z,0,forward.x);
  let longitudinal=(f.intent||0)*((f.intent||0)<0?165:193),lateral=(f.sideIntent||0)*166;
  if(f.attack){longitudinal*=.20;lateral*=.22;const m=MOVES[f.attack.type],t=f.attack.t;if(t>m.wind&&t<m.wind+m.strike)longitudinal+=Math.sin((t-m.wind)/m.strike*Math.PI)*58;}
  let desiredX=forward.x*longitudinal+right.x*lateral,desiredZ=forward.z*longitudinal+right.z*lateral;
  const speed=Math.hypot(desiredX,desiredZ),speedCap=f.sideIntent?195:193;
  if(speed>speedCap){desiredX*=speedCap/speed;desiredZ*=speedCap/speed;}
  if(f.stun>0){const push=120*clamp(f.hurt/.4,0,1);desiredX=f.knockDir.x*push;desiredZ=f.knockDir.z*push;}
  if(f.evade>0){desiredX=f.dashDir.x*DASH.speed;desiredZ=f.dashDir.z*DASH.speed;}
  const accel=f.evade>0?2400:(Math.hypot(desiredX,desiredZ)<1?1550:1250),dvx=desiredX-f.vx,dvz=desiredZ-f.vz,dv=Math.hypot(dvx,dvz),step=Math.min(1,accel*dt/(dv||1));
  f.vx+=dvx*step;f.vz+=dvz*step;f.x+=f.vx*dt;f.z+=f.vz*dt;
  const radius=Math.hypot(f.x-800,f.z);
  if(radius>630){const nx=(f.x-800)/radius,nz=f.z/radius;f.x=800+nx*630;f.z=nz*630;const outward=f.vx*nx+f.vz*nz;if(outward>0){f.vx-=nx*outward;f.vz-=nz*outward;}}
  let target=blendPose(high,low,smooth(f.guardBlend));f.guardBlend=damp(f.guardBlend,f.guard==='low'?1:0,13,dt);
  if(f.attack){
   const a=f.attack,m=MOVES[a.type];a.t+=dt;const t=a.t,ps=POSES[a.type];
   if(t>=m.wind&&!a.swung){a.swung=true;this.emit('swing',{fighter:f.id,move:a.type});}
   if(t<m.wind)target=blendPose(a.from,ps[1],smooth(t/m.wind));
   else if(t<m.wind+m.strike)target=blendPose(ps[1],ps[2],smooth((t-m.wind)/m.strike));
   else if(t<m.wind+m.strike+m.follow)target=blendPose(ps[2],ps[3],smooth((t-m.wind-m.strike)/m.follow));
   else {const end=blendPose(high,low,smooth(f.guardBlend));target=blendPose(ps[3],end,smooth((t-m.wind-m.strike-m.follow)/m.recover));}
   if(t>m.wind+m.strike+m.follow&&!a.contact&&!a.whiffed){a.whiffed=true;this.emit('miss',{fighter:f.id});}
   if(t>=m.wind+m.strike+m.follow+m.recover){f.attack=null;target=blendPose(high,low,smooth(f.guardBlend));}
  }
  if(f.guardReturn){const returning=f.guardReturn;returning.t+=dt;target=blendPose(returning.from,target,smooth(returning.t/.20));if(returning.t>=.20)f.guardReturn=null;}
  if(f.evade>0){const alongDash=f.dashDir.x*forward.x+f.dashDir.z*forward.z;target={...target,hipY:15,chestX:6+alongDash*18,handX:44+alongDash*8,handY:-180};}
  target.chestX+=f.recoil*-.55;target.handX-=f.recoil*.65;target.blade-=f.recoil*.013;
  for(const k of Object.keys(f.pose))f.pose[k]=damp(f.pose[k],target[k],f.attack?39:16,dt);
  const along=f.vx*forward.x+f.vz*forward.z,side=f.vx*right.x+f.vz*right.z;
  f.lean=damp(f.lean,clamp(along/193,-1.4,1.4),8,dt);f.sideLean=damp(f.sideLean,side*.045,8,dt);
  f.headTilt=damp(f.headTilt,-along*.0006-f.pose.chestX*.003,7,dt);f.cloth=damp(f.cloth,-along*.09,6,dt);
  this.updateFeet(f,dt);this.solveRig(f,dt);f.blade=f.pose.blade;
  if(f.attack&&f.attack.t>MOVES[f.attack.type].wind*.9&&f.attack.t<MOVES[f.attack.type].wind+MOVES[f.attack.type].strike+.06){f.trail.push({...f.rig.tip,base:{...f.rig.hand},life:.12});}
  f.trail.forEach(t=>t.life-=dt);f.trail=f.trail.filter(t=>t.life>0).slice(-18);
 }
 updateFeet(f,dt){
  const speed=Math.hypot(f.vx,f.vz),forward=point(Math.cos(f.yaw),0,Math.sin(f.yaw)),right=point(-forward.z,0,forward.x);
  let stepping=f.feet.some(a=>a.t<1);
  for(let i=0;i<2;i++){
   const foot=f.feet[i],rest=i===0?-35:43,side=i===0?-19:19,desired=point(f.x+forward.x*rest+right.x*side,FLOOR,f.z+forward.z*rest+right.z*side);
   if(foot.t>=1&&!stepping&&(Math.hypot(foot.x-desired.x,foot.z-desired.z)>(speed>80?21:12)||Math.abs(angleDelta(foot.yaw,f.yaw))>.35)){
    foot.from=point(foot.x,foot.y,foot.z);foot.to=point(desired.x+f.vx*.135,FLOOR,desired.z+f.vz*.135);foot.fromYaw=foot.yaw;foot.t=0;foot.duration=f.evade>0?.14:clamp(.24-speed*.00025,.14,.24);stepping=true;
   }
   if(foot.t<1){
    foot.t=Math.min(1,foot.t+dt/foot.duration);foot.x=lerp(foot.from.x,foot.to.x,smooth(foot.t));foot.z=lerp(foot.from.z,foot.to.z,smooth(foot.t));foot.y=FLOOR-Math.sin(foot.t*Math.PI)*(f.evade>0?21:14);foot.yaw=foot.fromYaw+angleDelta(foot.fromYaw,f.yaw)*smooth(foot.t);
    if(foot.t>=1){foot.y=FLOOR;this.dust(foot.x,FLOOR,3,foot.z);if(f.id===0)this.stats.steps++;this.emit('step',{fighter:f.id,speed});}
   }
   const dx=foot.x-f.x,dz=foot.z-f.z,range=Math.hypot(dx,dz);
   if(range>114){foot.x=damp(foot.x,f.x+dx/range*114,22,dt);foot.z=damp(foot.z,f.z+dz/range*114,22,dt);}
  }
 }
 solveRig(f,dt){
  const q=f.pose,forward=point(Math.cos(f.yaw),0,Math.sin(f.yaw)),right=point(-forward.z,0,forward.x);
  const world=(x,y,side=0)=>point(f.x+forward.x*x+right.x*side,FLOOR+y,f.z+forward.z*x+right.z*side);
  const stepLift=Math.max(...f.feet.map(a=>FLOOR-a.y));f.bob=damp(f.bob,-stepLift*.15,13,dt);const breath=Math.sin(f.breath)*1.6;
  const hip=world(q.hipX,-107+q.hipY+f.bob),originalHipY=hip.y;
  for(let i=0;i<2;i++){
   const hx=hip.x+right.x*(i===0?-14:14),hz=hip.z+right.z*(i===0?-14:14),dx=Math.min(121,Math.hypot(f.feet[i].x-hx,f.feet[i].z-hz));
   hip.y=Math.max(hip.y,f.feet[i].y-10-Math.sqrt(122*122-dx*dx));
  }
  const crouch=hip.y-originalHipY,chest=world(q.hipX+q.chestX+f.lean*5,-178+q.hipY*.55+f.bob+q.chestY+breath+crouch*.8,f.sideLean);
  const headOffset=20,neck=add(chest,point(forward.x*2,-18,forward.z*2)),head=add(neck,point(forward.x*(q.headX+Math.sin(f.headTilt)*headOffset),-Math.cos(f.headTilt)*headOffset,forward.z*(q.headX+Math.sin(f.headTilt)*headOffset)));
  const hipBack=add(hip,scale(right,-14)),hipFront=add(hip,scale(right,14));
  const ankleBack=point(f.feet[0].x,f.feet[0].y-10,f.feet[0].z),ankleFront=point(f.feet[1].x,f.feet[1].y-10,f.feet[1].z);
  const shoulderBack=add(add(chest,scale(right,-24)),point(0,-5,0)),shoulder=add(add(chest,scale(right,24)),point(0,-5,0));
  const hand=world(q.handX,q.handY+breath*.6+f.bob+crouch*.8,14),offhand=world(q.offX+f.lean*2,q.offY+breath+crouch*.8,-28);
  const elbow=ik3D(shoulder,hand,43,43,add(scale(right,.8),point(0,.8,0))),offelbow=ik3D(shoulderBack,offhand,40,39,add(scale(right,-.8),point(0,.7,0)));
  const kneeBack=ik3D(hipBack,ankleBack,60,62,forward),kneeFront=ik3D(hipFront,ankleFront,60,62,forward);
  const bladeForward=Math.cos(q.blade)*Math.cos(q.bladeSide)*SWORD_LENGTH,bladeSide=Math.cos(q.blade)*Math.sin(q.bladeSide)*SWORD_LENGTH;
  const tip=add(hand,point(forward.x*bladeForward+right.x*bladeSide,Math.sin(q.blade)*SWORD_LENGTH,forward.z*bladeForward+right.z*bladeSide));
  f.rig={hip,chest,neck,head,hipBack,hipFront,ankleBack,ankleFront,shoulderBack,shoulder,hand,offhand,elbow,offelbow,kneeBack,kneeFront,tip};
 }

 active(f){if(f.dead||f.stun>0||!f.attack||f.attack.contact)return false;const m=MOVES[f.attack.type];return f.attack.t>=m.wind+.045&&f.attack.t<=m.wind+m.strike+.04;}
 touches(f,target){
  const lane=MOVES[f.attack.type].lane,rig=target.rig,old=f.prevRig;
  const capsules=lane==='high'?[[rig.head,rig.neck,18],[rig.neck,rig.hip,23]]:[[rig.hip,rig.kneeFront,20],[rig.hip,rig.kneeBack,20]];
  for(let i=0;i<=4;i++){
   const t=i/4,hand=point(lerp(old.hand.x,f.rig.hand.x,t),lerp(old.hand.y,f.rig.hand.y,t),lerp(old.hand.z,f.rig.hand.z,t)),tip=point(lerp(old.tip.x,f.rig.tip.x,t),lerp(old.tip.y,f.rig.tip.y,t),lerp(old.tip.z,f.rig.tip.z,t));
   for(const[a,b,radius]of capsules)if(segments(hand,tip,a,b)<radius)return true;
  }return false;
 }
 combat(){
  const[a,b]=this.fighters,contacts=[];
  if(this.active(a)&&this.active(b)&&segments(a.rig.hand,a.rig.tip,b.rig.hand,b.rig.tip)<8){
   const x=(a.rig.tip.x+b.rig.tip.x)*.5,y=(a.rig.tip.y+b.rig.tip.y)*.5;
   for(const f of[a,b]){f.attack=null;f.buffer=null;f.trail=[];f.stun=.20;f.recovery=.17;f.recoil=20;f.vx-=Math.cos(f.yaw)*90;f.vz-=Math.sin(f.yaw)*90;f.stamina=Math.max(0,f.stamina-6);}
   this.freeze=.035;this.sparks(x,y,(a.rig.tip.z+b.rig.tip.z)*.5);this.emit('clash');return;
  }
  for(const f of[a,b]){
   const target=f===a?b:a;
   if(this.active(f)&&!target.dead&&target.hurt<=0){
    const matching=!target.attack&&target.guard===f.attack.type;
    const bladeContact=matching&&segments(f.rig.hand,f.rig.tip,target.rig.hand,target.rig.tip)<9;
    if(this.touches(f,target)||bladeContact)contacts.push([f,target]);
   }
  }
  const hits=[];
  for(const[f,target]of contacts){
   if(!f.attack||f.attack.contact)continue;
   const move=MOVES[f.attack.type],lane=move.lane;f.attack.contact=true;
   const settled=Math.abs(target.guardBlend-(lane==='high'?0:1))<.4;
   const toAttacker=normalize(point(f.x-target.x,0,f.z-target.z)),facing=point(Math.cos(target.yaw),0,Math.sin(target.yaw)),front=dot(toAttacker,facing)>.25;
   if(!target.attack&&target.evade<=0&&target.stun<=0&&target.guard===lane&&settled&&front&&target.stamina>=12){
    const perfect=target.parryWindow>0;target.stamina-=perfect?8:16;f.stamina=Math.max(0,f.stamina-(perfect?14:5));
    f.stun=perfect?.37:.20;f.recovery=perfect?.31:.15;f.recoil=27;target.recoil=perfect?5:11;
    f.vx-=Math.cos(f.yaw)*(perfect?145:75);f.vz-=Math.sin(f.yaw)*(perfect?145:75);target.vx-=Math.cos(target.yaw)*25;target.vz-=Math.sin(target.yaw)*25;f.attack=null;f.buffer=null;f.trail=[];
    this.sparks((f.rig.tip.x+target.rig.hand.x)/2,(f.rig.tip.y+target.rig.hand.y)/2,(f.rig.tip.z+target.rig.hand.z)/2);this.freeze=perfect?.055:.025;
    this.stats.parries++;this.emit(perfect?'perfectParry':'parry',{fighter:target.id,lane});
    if(target.id===1&&this.mode!=='local')target.ai.cooldown=Math.min(target.ai.cooldown,perfect?.16:.33);
   }else hits.push({attacker:f,target,damage:move.damage});
  }
  // Contacts in this simulation step trade fairly; an earlier hit cancels all later attacks.
  for(const hit of hits)this.applyHit(hit.attacker,hit.target,hit.damage);
  if(!hits.length)return;
  const defeated=this.fighters.filter(f=>f.health<=0);
  if(defeated.length){
   const draw=defeated.length===2,winner=draw?null:1-defeated[0].id;
   this.roundResult={winner,draw,practice:this.mode==='practice'};
   if(!draw&&this.mode!=='practice')this.scores[winner]++;
   this.phase='finish';this.phaseTime=0;this.slow=.22;this.freeze=.05;this.keys={};
   for(const f of this.fighters)f.buffer=null;
  }else{this.freeze=.045;this.slow=Math.min(this.slow,.72);}
 }
 applyHit(attacker,target,damage){
  const interrupted=Boolean(target.attack);
  target.health=Math.max(0,target.health-damage);target.attack=null;target.buffer=null;target.trail=[];target.evade=0;target.guardReturn=null;
  target.parryWindow=0;target.stun=.43;target.hurt=.43;target.recovery=.30;target.recoil=34;target.knockDir=normalize(point(target.x-attacker.x,0,target.z-attacker.z));target.vx+=target.knockDir.x*155;target.vz+=target.knockDir.z*155;
  target.ai.cooldown=Math.max(target.ai.cooldown,.65);
  if(target.health<=0)this.knockdown(target,target.knockDir);
  this.dust(target.rig.chest.x,target.rig.chest.y,5,target.rig.chest.z);
  this.emit('hit',{fighter:attacker.id,target:target.id,damage,interrupted,ko:target.health<=0,x:target.rig.chest.x,y:target.rig.chest.y,z:target.rig.chest.z});
 }

 knockdown(f,dir){
  f.dead=true;f.fallBlend=0;f.attack=null;f.buffer=null;f.trail=[];f.guardReturn=null;
  if(typeof dir==='number')dir=point(dir,0,0);
  const nodes=copyRig(f.rig);for(const n of Object.values(nodes)){const impulse=35+(FLOOR-n.y)*.23;n.vx=dir.x*impulse;n.vy=-22;n.vz=dir.z*impulse;}
  const pairs=[['hip','chest'],['chest','neck'],['neck','head'],['hip','hipBack'],['hip','hipFront'],['hipBack','hipFront'],['chest','shoulder'],['chest','shoulderBack'],['shoulder','shoulderBack'],['hipBack','kneeBack'],['kneeBack','ankleBack'],['hipFront','kneeFront'],['kneeFront','ankleFront'],['shoulder','elbow'],['elbow','hand'],['shoulderBack','offelbow'],['offelbow','offhand'],['hip','neck'],['shoulder','hipFront'],['shoulderBack','hipBack'],['hand','tip']];
  f.ragdoll={nodes,links:pairs.map(([a,b])=>({a,b,len:distance(nodes[a],nodes[b])}))};
 }
 updateRagdoll(f,dt){
  const r=f.ragdoll;if(dt<=0)return;f.fallBlend=clamp(f.fallBlend+dt*5,0,1);f.cloth=damp(f.cloth,0,5,dt);
  for(const n of Object.values(r.nodes)){n.px=n.x;n.py=n.y;n.pz=n.z;n.vy+=1050*dt;n.x+=n.vx*dt;n.y+=n.vy*dt;n.z+=n.vz*dt;}
  for(let i=0;i<10;i++){
   for(const l of r.links){const a=r.nodes[l.a],b=r.nodes[l.b],dx=b.x-a.x,dy=b.y-a.y,dz=b.z-a.z,d=Math.hypot(dx,dy,dz)||.001,corr=(d-l.len)/d*.5;a.x+=dx*corr;a.y+=dy*corr;a.z+=dz*corr;b.x-=dx*corr;b.y-=dy*corr;b.z-=dz*corr;}
   for(const[k,n]of Object.entries(r.nodes)){const rad=k==='head'?17:k==='chest'?14:k==='tip'?2:6;if(n.y>FLOOR-rad){n.y=FLOOR-rad;n.px=lerp(n.px,n.x,.10);n.pz=lerp(n.pz,n.z,.10);}}
  }
  for(const n of Object.values(r.nodes)){n.vx=(n.x-n.px)/dt*Math.exp(-dt*1.2);n.vy=(n.y-n.py)/dt*Math.exp(-dt*.8);n.vz=(n.z-n.pz)/dt*Math.exp(-dt*1.2);}
  copyRig(r.nodes,f.rig);
 }
 sparks(x,y,z=0){for(let i=0;i<20;i++){const a=this.random()*Math.PI*2,v=80+this.random()*220;this.particles.push({kind:'spark',x,y,z,vx:Math.cos(a)*v,vy:-50-this.random()*180,vz:Math.sin(a)*v,life:.2+this.random()*.24,max:.44});}}
 dust(x,y,count,z=0){for(let i=0;i<count;i++)this.particles.push({kind:'dust',x,y:y-2,z,vx:(this.random()-.5)*50,vy:-10-this.random()*25,vz:(this.random()-.5)*50,life:.3+this.random()*.25,max:.55});}
}
