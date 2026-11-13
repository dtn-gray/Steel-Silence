import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from '../dist/vendor/three.module.min.js';
import {Duel,STEP} from '../dist/engine.js';
import {FighterModel,worldPoint} from '../dist/fighter3d.js';

test('the continuous human model keeps its visible sword on the collision endpoints',()=>{
 const d=new Duel({random:()=>.5}),model=new FighterModel(0),f=d.fighters[0];model.update(f,1,0,false);model.group.updateMatrixWorld(true);let meshes=0;model.group.traverse(o=>{if(o.isMesh)meshes++;for(const v of o.matrixWorld.elements)assert(Number.isFinite(v));});assert(model.skin.isSkinnedMesh);assert.equal(model.skin.skeleton.bones.length,19);assert(meshes<30);
 const tip=new T.Vector3(0,1,0).applyMatrix4(model.blade.matrixWorld);assert(tip.distanceTo(worldPoint(f.rig.tip))<1e-6);
 const head=model.head.position,feet=model.feet[0].position;assert(head.y-feet.y>1.3&&head.y-feet.y<2.1);
});

test('the 3D skeleton animates and falls without invalid mesh transforms',()=>{
 const d=new Duel({random:()=>.5});d.mode='local';d.phase='fight';const model=new FighterModel(0),f=d.fighters[0];d.input('s',true);for(let i=0;i<180;i++){d.tick(STEP);model.update(f,1,i*STEP,false);}assert(Math.abs(model.head.position.z)>.5);
 d.applyHit(d.fighters[1],f,100);for(let i=0;i<300;i++){d.tick(STEP);model.update(f,1,i*STEP,false);model.group.updateMatrixWorld(true);model.group.traverse(o=>{for(const v of o.matrixWorld.elements)assert(Number.isFinite(v));});}
 assert(model.head.position.y<.6);
});

test('the shorter neck keeps the head attached in both guards and through a guard cancel',()=>{
 const d=new Duel({random:()=>.5});d.mode='local';d.phase='fight';const model=new FighterModel(0),f=d.fighters[0];
 for(let frame=0;frame<180;frame++){
  if(frame===20)d.input('e',true);if(frame===60)d.input('f',true);if(frame===100)d.input('q',true);
  d.tick(STEP);model.update(f,1,frame*STEP,false);
  assert(Math.abs(f.rig.neck.y-f.rig.head.y-Math.cos(f.headTilt)*20)<1e-8);
  const headBone=model.human.bones.find(b=>b.name==='head');assert(headBone.getWorldPosition(new T.Vector3()).distanceTo(model.head.position)<1e-6);
 }
});
