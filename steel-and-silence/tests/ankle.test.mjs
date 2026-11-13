import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from '../dist/vendor/three.module.min.js';
import {Duel,STEP} from '../dist/engine.js';
import {FighterModel} from '../dist/fighter3d.js';

const UP=new T.Vector3(0,1,0),FORWARD=new T.Vector3(0,0,-1);

test('the boot shaft stays on the shin while the sole and heel retain their shape',()=>{
 const d=new Duel({random:()=>.5});d.phase='fight';d.mode='local';const model=new FighterModel(0),f=d.fighters[0],g=model.skin.geometry,bind=g.attributes.position;
 const shin=[],sole=[];for(let i=0;i<bind.count;i++){
  const y=bind.getY(i),x=bind.getX(i);if(y>.17&&y<.29)shin.push([i,x<0?'Back':'Front']);if(y<.06)sole.push([i,x<0?'Back':'Front']);
 }
 assert(shin.length>80&&sole.length>80);
 const v=new T.Vector3(),expected=new T.Vector3(),matrix=new T.Matrix4();
 for(let frame=0;frame<220;frame++){
  if(frame===0){d.input('s',true);d.input('d',true);}if(frame===45)d.input(' ',true);if(frame===85){d.input('s',false);d.input('d',false);d.input('f',true);}if(frame===135)d.input('e',true);
  d.tick(STEP);if(frame%10)continue;model.update(f,.43,frame*STEP,false);
  for(const[vertices,prefix]of[[shin,'knee'],[sole,'ankle']])for(const[i,side]of vertices){
   const id=model.human.bones.findIndex(b=>b.name===prefix+side);matrix.copy(model.human.bones[id].matrixWorld).multiply(model.human.skeleton.boneInverses[id]);expected.fromBufferAttribute(bind,i).applyMatrix4(matrix);model.skin.getVertexPosition(i,v);
   assert(v.distanceTo(expected)<1e-5,'no second bend or collapse halfway up the boot');
  }
 }
});

test('planted soles stay flat and ankle twist remains within a human range',()=>{
 const d=new Duel({random:()=>.5}),model=new FighterModel(0),f=d.fighters[0];
 for(const yaw of[0,.5,Math.PI,-Math.PI+.1]){
  f.yaw=f.prevYaw=yaw;d.solveRig(f,0);f.prevRig=structuredClone(f.rig);
  for(let i=0;i<2;i++){f.feet[i].yaw=yaw+(i?-2:2);f.feet[i].t=1;}
  model.update(f,1,0,false);const heading=new T.Vector3(Math.cos(yaw),0,Math.sin(yaw));
  for(const foot of model.feet){const up=UP.clone().applyQuaternion(foot.quaternion),forward=FORWARD.clone().applyQuaternion(foot.quaternion);assert(up.dot(UP)>.99999,'a planted sole stays horizontal');assert(forward.dot(heading)>=Math.cos(.35)-1e-6,'the foot must not twist backward');}
 }
});

test('fallen feet follow the lower leg instead of remaining upright against it',()=>{
 const d=new Duel({random:()=>.5});d.mode='local';d.phase='fight';const f=d.fighters[0],model=new FighterModel(0);d.applyHit(d.fighters[1],f,100);for(let i=0;i<300;i++)d.tick(STEP);model.update(f,1,2,false);assert.equal(f.fallBlend,1);
 for(const[id,side]of[[0,'Back'],[1,'Front']]){const q=new T.Quaternion();model.human.bones.find(b=>b.name==='knee'+side).getWorldQuaternion(q);assert(q.angleTo(model.feet[id].quaternion)<1e-5);}
});
