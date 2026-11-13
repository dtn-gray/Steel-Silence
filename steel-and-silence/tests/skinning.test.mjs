import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from '../dist/vendor/three.module.min.js';
import {HUMAN_DATA} from '../dist/human-data.js';
import {FighterModel} from '../dist/fighter3d.js';
import {FighterBatches} from '../dist/batching.js';
import {Duel,STEP} from '../dist/engine.js';

test('the sculpted body is one connected surface with normalized joint weights',()=>{
 const model=new FighterModel(0),g=model.skin.geometry,positions=g.attributes.position,weights=g.attributes.skinWeight,bones=g.attributes.skinIndex;
 assert(HUMAN_DATA.triangles>=8000&&HUMAN_DATA.triangles<=11000);assert(g.index.count/3<14000);
 const parents=Array.from({length:HUMAN_DATA.vertices},(_,i)=>i),root=i=>{while(i!==parents[i]){parents[i]=parents[parents[i]];i=parents[i];}return i;};
 for(let n=0;n<HUMAN_DATA.triangles*3;n+=3){const a=root(g.index.getX(n));for(let j=1;j<3;j++)parents[root(g.index.getX(n+j))]=a;}
 assert.equal(new Set(parents.map((_,i)=>root(i))).size,1,'anatomy must be a connected mesh');
 let blended=0;
 for(let i=0;i<positions.count;i++){
  let total=0,influences=0;for(let j=0;j<4;j++){const w=weights.array[i*4+j]/255;total+=w;if(w){influences++;assert(bones.array[i*4+j]<19);}}
  assert(Math.abs(total-1)<1e-6);if(influences>1)blended++;
 }
 assert(blended>positions.count*.25,'enough shared weights for joints to bend');
});

test('skinning follows movement, attacks, guard cancels, dash, and falls without surface explosions',()=>{
 const d=new Duel({random:()=>.5});d.mode='local';d.phase='fight';
 const models=[new FighterModel(0),new FighterModel(1)],v=new T.Vector3(),w=new T.Vector3();
 for(let frame=0;frame<720;frame++){
  if(frame===0){d.input('s',true);d.input('arrowup',true);}
  if(frame===60){d.input('s',false);d.input('arrowup',false);d.input('f',true);d.input('k',true);}
  if(frame===92)d.input('e',true);
  if(frame===210){d.input('w',true);d.input(' ',true);d.input('arrowdown',true);d.input('shiftright',true);}
  if(frame===240){d.input('w',false);d.input('arrowdown',false);}
  if(frame===360)d.applyHit(d.fighters[1],d.fighters[0],100);
  d.tick(STEP);
  for(let id=0;id<2;id++){
   const m=models[id];m.update(d.fighters[id],.5,frame*STEP,false);
   for(let b=0;b<m.human.bones.length;b++){
    const name=m.human.bones[b].name,p=m.points[name];if(p){m.human.bones[b].getWorldPosition(v);assert(v.distanceTo(p)<1e-5,`${name} must follow the collision rig`);}
   }
   if(frame%12===0){
    const g=m.skin.geometry,hip=m.points.hip;
    for(let i=0;i<g.attributes.position.count;i+=7){m.skin.getVertexPosition(i,v);assert([v.x,v.y,v.z].every(Number.isFinite));assert(v.distanceTo(hip)<2,'deformation must remain within a human silhouette');}
    for(let n=0;n<g.index.count;n+=93){m.skin.getVertexPosition(g.index.getX(n),v);m.skin.getVertexPosition(g.index.getX(n+1),w);assert(v.distanceTo(w)<.32,`weighted joints must stay connected: frame=${frame} player=${id} triangle=${n/3} edge=${v.distanceTo(w)} indices=${g.index.getX(n)},${g.index.getX(n+1)}`);}
   }
  }
 }
});

test('body skin draws separately and accessories still share render batches',()=>{
 const models=[new FighterModel(0),new FighterModel(1)],batches=new FighterBatches(models);
 assert(batches.batches.length<=16);
 for(const b of batches.batches)for(const r of b.records)assert(!r.source.isSkinnedMesh,'a deforming mesh must not become a rigid instance');
 assert(models[0].skin.geometry.attributes.position===models[1].skin.geometry.attributes.position,'base topology is shared');
 assert(models[0].skin.skeleton!==models[1].skin.skeleton,'players have independent poses');
});
