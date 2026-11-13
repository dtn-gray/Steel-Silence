import * as T from './vendor/three.module.min.js';
import {HUMAN_DATA} from './human-data.js?v=10';

const X_AXIS=new T.Vector3(1,0,0),UP=new T.Vector3(0,1,0),FORWARD=new T.Vector3(0,0,-1),ONE=new T.Vector3(1,1,1);
const defs=HUMAN_DATA.bones,ids=Object.fromEntries(defs.map((b,i)=>[b.name,i]));
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const smooth=t=>{t=clamp(t,0,1);return t*t*(3-2*t);};
let shared=null;
function decode(){
 const raw=atob(HUMAN_DATA.data),bytes=new Uint8Array(raw.length);for(let i=0;i<raw.length;i++)bytes[i]=raw.charCodeAt(i);
 const fields={};for(const[name,field]of Object.entries(HUMAN_DATA.layout)){const Type=field.type==='f'?Float32Array:field.type==='H'?Uint16Array:Uint8Array;fields[name]=new Type(bytes.buffer,field.offset,field.count);}return fields;
}
function makeGeometry(){
 if(shared)return shared;
 const data=decode(),positions=Array.from(data.position),index=Array.from(data.index),regions=Array.from(data.region),shades=Array.from(data.shade),skinIndex=Array.from(data.skinIndex),skinWeight=Array.from(data.skinWeight);
 const vertex=(x,y,z,region,weights,shade=1)=>{
  const i=positions.length/3;positions.push(x,y,z);regions.push(region);shades.push(Math.round(shade*255));
  let sum=0;const ws=weights.map(([bone,w])=>{const v=Math.round(w*255);sum+=v;return[bone,v];});ws[0][1]+=255-sum;
  for(let k=0;k<4;k++){skinIndex.push(ws[k]?ws[k][0]:0);skinWeight.push(ws[k]?ws[k][1]:0);}return i;
 };
 // Hair occupies the scalp's own triangles. A second cap cannot intersect it.
 const hairVertices=[];
 for(let i=0;i<data.region.length;i++){
  const x=positions[i*3],y=positions[i*3+1],z=positions[i*3+2];
  const front=clamp((.025-z)/.115,0,1),hairline=1.775+front*.109+Math.cos(x*39)*.003;
  const scalp=y>hairline&&y>1.78;
  const brow=y>1.836&&y<1.849&&z<-.074&&Math.abs(Math.abs(x)-.035)<.022;
  if(scalp||brow){
   regions[i]=10;hairVertices.push(i);
   shades[i]=Math.round((.83+.15*(.5+.5*Math.sin(x*265+z*210+y*75)))*255);
   if(scalp){const lift=.0008*(.5+.5*Math.sin(x*265+z*210));for(let k=0;k<3;k++)positions[i*3+k]+=data.normal[i*3+k]*lift;}
  }
 }
 const torsoVolumes=[[0,1,.166,.139,.118],[0,1.17,.153,.165,.110],[0,1.385,.198,.185,.130],[0,1.465,.202,.091,.115],[-.082,1.399,.107,.104,.150],[.082,1.399,.107,.104,.150],[0,1.624,.051,.091,.052]];
 function frontSurface(x,y){let z=-.045;for(const[cx,cy,rx,ry,rz]of torsoVolumes){const d=1-((x-cx)/rx)**2-((y-cy)/ry)**2;if(d>0)z=Math.min(z,-rz*Math.sqrt(d));}return z-.008;}
 const torsoWeights=y=>{const t=smooth((y-1.08)/.46);return[[ids.hip,1-t],[ids.chest,t]];};
 // Curved lapels, collar, and leather cross-belt sit on the shaped chest.
 for(const side of[-1,1]){
  const base=positions.length/3,N=16;
  for(let i=0;i<=N;i++){const t=i/N,y=1.62-t*.36,cx=side*(.042+Math.sin(t*Math.PI)*.054-.022*t),width=.025*(1-t*.75);
   for(const edge of[-1,1]){const x=cx+edge*width/2;vertex(x,y,frontSurface(x,y)-.004,1,torsoWeights(y),1);}
  }
  for(let i=0;i<N;i++){const a=base+i*2;index.push(a,a+1,a+2,a+1,a+3,a+2);}
 }
 {
  const base=positions.length/3,N=20;
  for(let i=0;i<=N;i++){const t=i/N,cx=-.158+t*.294,y=1.51-t*.432;for(const edge of[-1,1]){const x=cx+edge*.018;vertex(x,y,frontSurface(x,y)-.013,4,torsoWeights(y),edge===1?.92:1);}}
  for(let i=0;i<N;i++){const a=base+i*2;index.push(a,a+1,a+2,a+1,a+3,a+2);}
 }
 {
  const base=positions.length/3,N=40;
  for(let r=0;r<2;r++)for(let i=0;i<=N;i++){const a=i/N*Math.PI*2;vertex(.172*Math.sin(a),1.048+r*.036,.130*Math.cos(a),4,[[ids.hip,1]],r?.95:.85);}
  for(let i=0;i<N;i++){const a=base+i,b=a+N+1;index.push(a,a+1,b,a+1,b+1,b);}
 }
 const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(positions,3));g.setIndex(index);g.computeVertexNormals();
 g.setAttribute('skinIndex',new T.Uint8BufferAttribute(skinIndex,4));g.setAttribute('skinWeight',new T.Uint8BufferAttribute(skinWeight,4,true));
 g.userData.bodyIndexCount=data.index.length;g.userData.hairVertices=hairVertices;
 shared={geometry:g,regions,shades};return shared;
}
function frameQuaternion(aim,forward,out,scratch){
 const up=scratch.up.copy(aim).normalize(),back=scratch.back.copy(forward).multiplyScalar(-1);back.addScaledVector(up,-back.dot(up));
 if(back.lengthSq()<.001){back.set(0,0,1).addScaledVector(up,-up.z);if(back.lengthSq()<.001)back.set(1,0,0);}
 back.normalize();const right=scratch.right.crossVectors(up,back).normalize();back.crossVectors(right,up).normalize();return out.setFromRotationMatrix(scratch.matrix.makeBasis(right,up,back));
}
function scratch(){return{up:new T.Vector3(),back:new T.Vector3(),right:new T.Vector3(),matrix:new T.Matrix4()};}
export class HumanSkin {
 constructor(theme){
  const asset=makeGeometry(),g=new T.BufferGeometry();for(const[name,attr]of Object.entries(asset.geometry.attributes))g.setAttribute(name,attr);g.setIndex(asset.geometry.index);g.userData={...asset.geometry.userData};
  const palette=[theme.coat,theme.dark,theme.skin,theme.pants,'#48372b',theme.trim,'#c9c4ae','#574137','#a77162','#252c24',theme.hair||'#39362e'].map(c=>new T.Color(c));
  const colors=new Float32Array(asset.regions.length*3);for(let i=0;i<asset.regions.length;i++){const color=palette[asset.regions[i]],s=asset.shades[i]/255;colors[i*3]=color.r*s;colors[i*3+1]=color.g*s;colors[i*3+2]=color.b*s;}g.setAttribute('color',new T.BufferAttribute(colors,3));
  this.material=new T.MeshLambertMaterial({color:0xffffff,vertexColors:true,emissive:0x000000});this.mesh=new T.SkinnedMesh(g,this.material);this.mesh.name='Continuous tailored human';this.mesh.castShadow=this.mesh.receiveShadow=true;this.mesh.frustumCulled=false;
  this.bones=defs.map(d=>{const bone=new T.Bone();bone.name=d.name;return bone;});
  this.bindPositions=defs.map(d=>new T.Vector3(...d.position));this.records=[];const sc=scratch();
  for(let i=0;i<defs.length;i++){
   const d=defs[i],parent=d.parent?ids[d.parent]:-1,bone=this.bones[i];bone.position.copy(this.bindPositions[i]);if(parent>=0){bone.position.sub(this.bindPositions[parent]);this.bones[parent].add(bone);}else this.mesh.add(bone);
   let restAim=d.aim?this.bindPositions[ids[d.aim]].clone().sub(this.bindPositions[i]):UP.clone();
   if(d.name==='offhand')restAim.copy(this.bindPositions[i]).sub(this.bindPositions[ids.offelbow]);
   const restInverse=frameQuaternion(restAim,FORWARD,new T.Quaternion(),sc).invert();
   this.records.push({name:d.name,parent,world:new T.Matrix4(),restInverse});
  }
  this.mesh.updateMatrixWorld(true);this.skeleton=new T.Skeleton(this.bones);this.mesh.bind(this.skeleton);
  this.spine=new T.Vector3();this.forward=new T.Vector3();this.aim=new T.Vector3();this.position=new T.Vector3();this.q=new T.Quaternion();this.local=new T.Matrix4();this.scratch=scratch();this.pitch=new T.Quaternion();this.rootQ=new T.Quaternion();this.headQuaternion=new T.Quaternion();this.fallFoot=new T.Quaternion();this.footQuaternions=[new T.Quaternion(),new T.Quaternion()];
 }
 update(p,yaw,f){
  this.forward.set(Math.cos(yaw),0,Math.sin(yaw));this.spine.lerpVectors(p.hip,p.chest,.5);
  const target=name=>name==='spine'?this.spine:p[name];
  for(let i=0;i<defs.length;i++){
   const d=defs[i],r=this.records[i],bone=this.bones[i];
   if(d.name==='coatBack'||d.name==='coatFront'){
    this.position.copy(this.bindPositions[i]).sub(this.bindPositions[ids.hip]).applyQuaternion(this.rootQ).add(p.hip);
    this.pitch.setFromAxisAngle(X_AXIS,f.cloth*.003*(d.name==='coatFront'?.65:1));this.q.copy(this.rootQ).multiply(this.pitch);
   }else{
    this.position.copy(target(d.name));
    if(d.name==='ankleFront'||d.name==='ankleBack'){
     const id=d.name==='ankleFront'?1:0,foot=f.feet[id];
     const twist=Math.atan2(Math.sin(foot.yaw-yaw),Math.cos(foot.yaw-yaw));
     this.q.setFromAxisAngle(UP,-yaw-clamp(twist,-.35,.35)-Math.PI/2);
     if(f.dead){this.fallFoot.setFromRotationMatrix(this.records[r.parent].world);this.q.slerp(this.fallFoot,smooth(f.fallBlend));}
     else {this.pitch.setFromAxisAngle(X_AXIS,Math.sin(foot.t*Math.PI*2)*Math.sin(foot.t*Math.PI)*.10);this.q.multiply(this.pitch);}
     this.footQuaternions[id].copy(this.q);
    }else{
     if(d.name==='hand')this.aim.subVectors(p.tip,p.hand);
     else if(d.name==='offhand')this.aim.subVectors(p.offhand,p.offelbow);
     else if(d.name==='head')this.aim.subVectors(p.head,p.neck);
     else this.aim.subVectors(target(d.aim),this.position);
     frameQuaternion(this.aim,this.forward,this.q,this.scratch).multiply(r.restInverse);
    }
    if(d.name==='hip')this.rootQ.copy(this.q);
    if(d.name==='head')this.headQuaternion.copy(this.q);
   }
   r.world.compose(this.position,this.q,ONE);
   if(r.parent>=0)this.local.copy(this.records[r.parent].world).invert().multiply(r.world);else this.local.copy(r.world);
   this.local.decompose(bone.position,bone.quaternion,bone.scale);
  }
  this.mesh.updateMatrixWorld(true);this.skeleton.update();
  this.material.emissive.set(f.hurt>.2?'#4a2115':'#000000');this.material.emissiveIntensity=f.hurt>.2?.12:0;
 }
}
