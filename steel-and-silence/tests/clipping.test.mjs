import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from '../dist/vendor/three.module.min.js';
import {Duel,STEP} from '../dist/engine.js';
import {FighterModel} from '../dist/fighter3d.js';
import {segmentDistance3D} from '../dist/math3d.js';

function triangles(mesh,legs=false){
 const g=mesh.geometry,position=g.attributes.position,vertices=new Map(),result=[],end=legs?g.userData.bodyIndexCount:g.index.count;
 const vertex=i=>{if(!vertices.has(i)){const p=new T.Vector3();if(mesh.isSkinnedMesh)mesh.getVertexPosition(i,p);else p.fromBufferAttribute(position,i);vertices.set(i,p.applyMatrix4(mesh.matrixWorld));}return vertices.get(i);};
 for(let i=0;i<end;i+=3){
  const ids=[g.index.getX(i),g.index.getX(i+1),g.index.getX(i+2)];
  if(legs&&(ids.reduce((s,id)=>s+position.getY(id),0)/3>1.10||ids.some(id=>Math.abs(position.getX(id))>.27)))continue;
  const points=ids.map(vertex),a=points[0],b=points[1],c=points[2];result.push({points,triangle:new T.Triangle(a,b,c),minX:Math.min(a.x,b.x,c.x),maxX:Math.max(a.x,b.x,c.x),minY:Math.min(a.y,b.y,c.y),maxY:Math.max(a.y,b.y,c.y),minZ:Math.min(a.z,b.z,c.z),maxZ:Math.max(a.z,b.z,c.z)});
 }
 return result;
}
const ray=new T.Ray(),direction=new T.Vector3(),hit=new T.Vector3(),closest=new T.Vector3(),GAP=.004,GRID=.12;
function overlaps(a,b){return a.maxX+GAP>=b.minX&&a.minX-GAP<=b.maxX&&a.maxY+GAP>=b.minY&&a.minY-GAP<=b.maxY&&a.maxZ+GAP>=b.minZ&&a.minZ-GAP<=b.maxZ;}
function tooClose(a,b){
 for(const [first,second]of[[a,b],[b,a]])for(let i=0;i<3;i++){
  const p=first.points[i],q=first.points[(i+1)%3];second.triangle.closestPointToPoint(p,closest);if(closest.distanceTo(p)<GAP)return true;
  direction.subVectors(q,p);const length=direction.length();if(length<1e-8)continue;ray.set(p,direction.multiplyScalar(1/length));
  if(ray.intersectTriangle(...second.points,false,hit)&&hit.distanceTo(p)<=length+1e-7)return true;
 }
 for(let i=0;i<3;i++)for(let j=0;j<3;j++)if(segmentDistance3D(a.points[i],a.points[(i+1)%3],b.points[j],b.points[(j+1)%3])<GAP)return true;
 return false;
}
function bins(t,visit,pad=0){
 for(let x=Math.floor((t.minX-pad)/GRID);x<=Math.floor((t.maxX+pad)/GRID);x++)for(let y=Math.floor((t.minY-pad)/GRID);y<=Math.floor((t.maxY+pad)/GRID);y++)for(let z=Math.floor((t.minZ-pad)/GRID);z<=Math.floor((t.maxZ+pad)/GRID);z++)visit(`${x},${y},${z}`);
}
function assertClear(model,label){
 model.group.updateMatrixWorld(true);const legs=triangles(model.skin,true),cloth=triangles(model.garment.mesh),grid=new Map();
 for(let i=0;i<legs.length;i++)bins(legs[i],key=>{let list=grid.get(key);if(!list){list=[];grid.set(key,list);}list.push(i);});
 for(let i=0;i<cloth.length;i++){
  const a=cloth[i],seen=new Set();bins(a,key=>{for(const j of grid.get(key)||[]){if(seen.has(j))continue;seen.add(j);const b=legs[j];if(overlaps(a,b))assert(!tooClose(a,b),`coat intersects a leg: ${label}, cloth triangle ${i}, leg triangle ${j}`);}},GAP);
 }
}

test('hair uses the head surface and its weights instead of an overlapping cap',()=>{
 const d=new Duel({random:()=>.5}),model=new FighterModel(0);model.update(d.fighters[0],1,0,false);
 const g=model.skin.geometry,hair=g.userData.hairVertices;assert(hair.length>100);
 const head=model.human.bones.findIndex(b=>b.name==='head');
 for(const i of hair){let weight=0;for(let k=0;k<4;k++)if(g.attributes.skinIndex.array[i*4+k]===head)weight+=g.attributes.skinWeight.array[i*4+k];assert.equal(weight,255,'hair and scalp must follow exactly the same head transform');}
 assert(model.head.children.every(o=>!o.geometry||o.geometry.attributes.position.count<300),'no separate scalp cap or ponytail can cross the head');
});

test('whole coat triangles clear the actual legs through both guards, sidesteps, dash, guard cancels, and falls',()=>{
 const d=new Duel({random:()=>.5});d.phase='fight';d.mode='local';const models=[new FighterModel(0),new FighterModel(1)];
 const samples=new Set([0,60,100,130,188,222,260,350,375,405,450,540,650]);
 for(let frame=0;frame<=650;frame++){
  if(frame===0){d.input('d',true);d.input('arrowleft',true);}
  if(frame===48){d.input('d',false);d.input('arrowleft',false);d.input('w',true);d.input('arrowup',true);}
  if(frame===84){d.input(' ',true);d.input('shiftright',true);}
  if(frame===114){d.input('w',false);d.input('arrowup',false);}
  if(frame===160){d.input('f',true);d.input('k',true);}
  if(frame===190){d.input('e',true);d.input('o',true);d.input('f',false);d.input('k',false);}
  if(frame===230){d.input('q',true);d.input('u',true);d.input('f',true);d.input('k',true);}
  if(frame===290){d.input('a',true);d.input('arrowright',true);}
  if(frame===360){d.applyHit(d.fighters[1],d.fighters[0],100);d.applyHit(d.fighters[0],d.fighters[1],100);}
  d.tick(STEP);if(!samples.has(frame))continue;
  for(let id=0;id<2;id++)for(const alpha of[.31,1]){
   const model=models[id];model.update(d.fighters[id],alpha,frame*STEP,alpha===1);assertClear(model,`frame ${frame}, player ${id}, interpolation ${alpha}`);
   for(const n of model.garment.mesh.geometry.attributes.position.array)assert(Number.isFinite(n));
  }
 }
 d.resetFighters();for(let id=0;id<2;id++){models[id].update(d.fighters[id],.5,0,true);assertClear(models[id],`reset player ${id}`);}
});

test('Fast graphics keeps the same coat clearance as full effects',()=>{
 const d=new Duel({random:()=>.5});d.phase='fight';d.mode='local';d.input('s',true);d.input(' ',true);for(let i=0;i<15;i++)d.tick(STEP);
 const model=new FighterModel(0);model.update(d.fighters[0],.47,1,false);const full=model.garment.mesh.geometry.attributes.position.array.slice();
 model.update(d.fighters[0],.47,1,true);assert.deepEqual(model.garment.mesh.geometry.attributes.position.array,full);assertClear(model,'Fast graphics');
});
