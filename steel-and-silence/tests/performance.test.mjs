import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from '../dist/vendor/three.module.min.js';
import {Duel,STEP} from '../dist/engine.js';
import {FighterModel} from '../dist/fighter3d.js';
import {FighterBatches,batchScenery} from '../dist/batching.js';
import {GraphicsQuality} from '../dist/quality.js';
import {Renderer} from '../dist/render.js';

test('automatic graphics reduce load only after sustained slow active frames',()=>{
 const q=new GraphicsQuality('auto',{lowPower:false});assert.equal(q.level,'balanced');
 for(let i=0;i<300;i++)q.observe(1/60,true);assert.equal(q.level,'balanced');
 for(let i=0;i<70;i++)q.observe(1/30,true);assert.equal(q.level,'fast');
 for(let i=0;i<45;i++)q.observe(1/20,true);assert.equal(q.level,'low');
 const idle=new GraphicsQuality('auto');for(let i=0;i<200;i++)idle.observe(.05,false);assert.equal(idle.level,'balanced');
 for(let i=0;i<200;i++)idle.observe(1,true);assert.equal(idle.level,'balanced');
});

test('manual Fast is the smallest render budget and High is an explicit option',()=>{
 const fast=new GraphicsQuality('fast');assert.equal(fast.profile.maxWidth,640);assert(!fast.profile.shadows);assert(!fast.profile.trails);
 for(let i=0;i<100;i++)fast.observe(.05);assert.equal(fast.mode,'fast');assert.equal(fast.level,'low');
 fast.setMode('high');assert(fast.profile.shadows);assert.equal(fast.profile.maxWidth,1600);
 const lowPower=new GraphicsQuality('auto',{lowPower:true});assert.equal(lowPower.level,'fast');
});

test('fighter instancing cuts opaque draws while preserving animated weapon transforms',()=>{
 const d=new Duel({random:()=>.5});d.mode='local';d.phase='fight';const models=[new FighterModel(0),new FighterModel(1)],batches=new FighterBatches(models);
 assert(batches.group.children.length<=16);
 for(let frame=0;frame<100;frame++){
  d.input('s',frame<60);d.tick(STEP);for(let i=0;i<2;i++)models[i].update(d.fighters[i],1,frame*STEP,false);batches.update(models);
  for(let id=0;id<2;id++){
   let found=false;
   for(const b of batches.batches)for(let i=0;i<b.records.length;i++)if(b.records[i].source===models[id].blade){
    found=true;const matrix=new T.Matrix4();b.mesh.getMatrixAt(i,matrix);for(let n=0;n<16;n++)assert(Math.abs(matrix.elements[n]-models[id].blade.matrixWorld.elements[n])<1e-5);
    const color=new T.Color();b.mesh.getColorAt(i,color);assert(Math.abs(color.r-models[id].blade.material.color.r)<1e-6);
   }
   assert(found);
  }
 }
});

test('static batching preserves world bounds and instance colors',()=>{
 const source=new T.Group(),m=new T.MeshStandardMaterial({color:'#ffffff',roughness:1}),box=new T.BoxGeometry(1,1,1),inst=new T.InstancedMesh(box,m,2);
 inst.setMatrixAt(0,new T.Matrix4().makeTranslation(2,1,0));inst.setMatrixAt(1,new T.Matrix4().makeTranslation(-2,1,0));inst.setColorAt(0,new T.Color('#805030'));inst.setColorAt(1,new T.Color('#308050'));source.add(inst);
 const b=new T.Mesh(box,m);b.position.set(0,3,0);source.add(b);const before=new T.Box3().setFromObject(source),batched=batchScenery(source),after=new T.Box3().setFromObject(batched);
 assert.equal(batched.children.length,1);assert(before.min.distanceTo(after.min)<1e-6);assert(before.max.distanceTo(after.max)<1e-6);assert(!batched.children[0].castShadow);
 const colors=batched.children[0].geometry.attributes.color;assert(colors.getX(0)>colors.getY(0));assert(colors.getY(36)>colors.getX(36));
});

function fakeCanvas(){const noop=()=>{},ctx=new Proxy({createRadialGradient:()=>({addColorStop:noop})},{get:(o,k)=>o[k]||noop,set:(o,k,v)=>(o[k]=v,true)});return{width:1,height:1,getContext:()=>ctx,getBoundingClientRect:()=>({width:1600}),addEventListener(){},parentNode:{dataset:{},appendChild(){}}};}

test('render profiles cap pixel count, disable default shadow passes, and avoid empty buffer uploads',()=>{
 const oldDocument=globalThis.document,oldWindow=globalThis.window;
 globalThis.window={devicePixelRatio:3};globalThis.document={createElement:tag=>tag==='canvas'?fakeCanvas():{style:{},setAttribute(){}}};
 try{
  let pixels=0,ratio=0;const backend={shadowMap:{},setPixelRatio(v){ratio=v;},setSize(w,h){pixels=w*h;},render(scene){scene.updateMatrixWorld(true);}};
  const d=new Duel({random:()=>.5}),r=new Renderer(fakeCanvas(),d,{backend,quality:'fast'});
  assert.equal(ratio,1);assert(pixels<=200000);assert(!backend.shadowMap.enabled);
  let draws=0;r.scene.traverseVisible(o=>{if(o.isMesh)draws++;});assert(draws<=25);
  const version=r.particlePoints.geometry.attributes.position.version;r.render(1,1/60);assert.equal(r.particlePoints.geometry.attributes.position.version,version);
  r.setGraphics('high');assert(backend.shadowMap.enabled);assert.equal(r.sun.shadow.mapSize.x,1024);assert(pixels<=1216000);
 }finally{globalThis.document=oldDocument;globalThis.window=oldWindow;}
});

test('the renderer follows the available viewport without stretching or increasing its pixel budget',()=>{
 const oldDocument=globalThis.document,oldWindow=globalThis.window;globalThis.window={devicePixelRatio:2};globalThis.document={createElement:tag=>tag==='canvas'?fakeCanvas():{style:{},setAttribute(){}}};
 try{
  const canvas=fakeCanvas();let rect={width:1400,height:650},pixels=0;canvas.getBoundingClientRect=()=>rect;
  const backend={shadowMap:{},setPixelRatio(){},setSize(w,h){pixels=w*h;},render(scene){scene.updateMatrixWorld(true);}};
  const r=new Renderer(canvas,new Duel({random:()=>.5}),{backend,quality:'fast'}),originalHalfWidth=Math.tan(33*Math.PI/360)*(1600/760);
  for(const size of[[1400,650],[800,230],[360,570],[320,300],[1920,900]]){
   rect={width:size[0],height:size[1]};r.resize();assert.equal(r.camera.aspect,rect.width/rect.height);assert(pixels<=640*304);
   assert(Math.abs(r.renderWidth/r.renderHeight-r.camera.aspect)<.02);assert(Math.tan(r.camera.fov*Math.PI/360)*r.camera.aspect>=originalHalfWidth-1e-6,'a narrow viewport must preserve the horizontal duel framing');
  }
 }finally{globalThis.document=oldDocument;globalThis.window=oldWindow;}
});
