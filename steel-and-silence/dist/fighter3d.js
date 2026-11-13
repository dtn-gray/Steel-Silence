import * as T from './vendor/three.module.min.js';
import {FLOOR,lerp,angleDelta} from './engine.js?v=10';
import {HumanSkin} from './human-skin.js?v=10';
import {Coat} from './coat.js?v=10';
export const SCALE=135;
export function worldPoint(p,out=new T.Vector3()){return out.set((p.x-800)/SCALE,(FLOOR-p.y)/SCALE,(p.z||0)/SCALE);}
const UP=new T.Vector3(0,1,0),unitSphere=new T.SphereGeometry(1,12,8),unitCylinder=new T.CylinderGeometry(1,1,1,12),unitBox=new T.BoxGeometry(1,1,1);
const themes=[{coat:'#577e85',dark:'#344f57',trim:'#c0aa72',skin:'#c8a27e',pants:'#3b413b',hair:'#39362e'},{coat:'#936751',dark:'#5b4136',trim:'#b9ad83',skin:'#b99b79',pants:'#3c4035',hair:'#49392d'}];
function material(color,roughness=.9,metalness=0){return new T.MeshStandardMaterial({color,roughness,metalness});}
function child(group,geo,mat,pos=[0,0,0],size=[1,1,1]){const m=new T.Mesh(geo,mat);m.position.set(...pos);m.scale.set(...size);m.castShadow=m.receiveShadow=true;group.add(m);return m;}
function geometry(vertices,indices){const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(vertices,3));g.setIndex(indices);g.computeVertexNormals();return g;}
function bladeGeometry(){
 const vertices=[],indices=[],sections=12;
 for(let i=0;i<=sections;i++){const t=i/sections,w=(1-t)*.054+.0015,thick=.0065*(1-t)+.0015,curve=.026*t*t;vertices.push(curve+w/2,t,0,curve,t,thick,curve-w/2,t,0,curve,t,-thick);}
 for(let i=0;i<sections;i++)for(let j=0;j<4;j++){const a=i*4+j,b=i*4+(j+1)%4,c=(i+1)*4+j,d=(i+1)*4+(j+1)%4;indices.push(a,c,b,b,c,d);}
 return geometry(vertices,indices);
}
// Shaped accessories are shared between the fighters; the body itself is skinned.
function hatGeometry(brim=false,band=false){
 const v=[],ix=[],N=40,profiles=brim?[[.100,.104],[.142,.103],[.185,.107],[.191,.118],[.185,.124],[.140,.119],[.100,.119]]:band?[[.115,.119],[.112,.141]]:[[.110,.116],[.112,.145],[.112,.205],[.103,.249],[.083,.258],[0,.260]];
 for(let r=0;r<profiles.length;r++)for(let c=0;c<=N;c++){const a=c/N*Math.PI*2,[radius,y]=profiles[r],wave=brim?Math.sin(a*2+.4)*.015*(radius/.19)**2:Math.sin(a*2)*.002;v.push(Math.sin(a)*radius,y+wave,Math.cos(a)*radius*.90);}
 for(let r=0;r<profiles.length-1;r++)for(let c=0;c<N;c++){const a=r*(N+1)+c,b=a+1,d=a+N+1;ix.push(a,b,d,b,d+1,d);}
 return geometry(v,ix);
}
function featherGeometry(){
 const v=[],ix=[],N=18;
 for(let r=0;r<=N;r++){const t=r/N,cx=-.117-t*.061,cy=.181+t*.269,cz=.009+t*.025,width=Math.sin(t*Math.PI)**.6*.020;
  v.push(cx-width,cy,cz-.001,cx,cy+.002,cz-.005,cx+width,cy,cz+.001);
 }
 for(let r=0;r<N;r++)for(let c=0;c<2;c++){const a=r*3+c;ix.push(a,a+1,a+3,a+1,a+4,a+3);}
 return geometry(v,ix);
}
function sheathGeometry(){
 const v=[],ix=[],N=12,M=12;
 for(let r=0;r<=M;r++){const t=r/M,rad=.025*(1-t*.29);for(let c=0;c<=N;c++){const a=c/N*Math.PI*2;v.push(Math.cos(a)*rad,-t*.79,Math.sin(a)*rad*.60+.026*t*t);}}
 for(let r=0;r<M;r++)for(let c=0;c<N;c++){const a=r*(N+1)+c,d=a+N+1;ix.push(a,a+1,d,a+1,d+1,d);}
 return geometry(v,ix);
}
const bladeGeo=bladeGeometry(),crownGeo=hatGeometry(),brimGeo=hatGeometry(true),hatBandGeo=hatGeometry(false,true),featherGeo=featherGeometry(),sheathGeo=sheathGeometry();
const bladeMat=new T.MeshStandardMaterial({color:'#d3dfe0',metalness:.8,roughness:.22,emissive:'#4d6972',emissiveIntensity:.19});
const guardGeo=new T.TorusGeometry(.089,.013,6,16,Math.PI*1.6);
const basisRight=new T.Vector3(),basisBack=new T.Vector3(),basisMatrix=new T.Matrix4(),Z_AXIS=new T.Vector3(0,0,1);
function bodyQuaternion(yaw,up,out){
 const right=basisRight.set(-Math.sin(yaw),0,Math.cos(yaw));right.addScaledVector(up,-right.dot(up));if(right.lengthSq()<.001)right.crossVectors(up,Z_AXIS);if(right.lengthSq()<.001)right.set(1,0,0);right.normalize();
 basisBack.crossVectors(right,up).normalize();right.crossVectors(up,basisBack).normalize();return out.setFromRotationMatrix(basisMatrix.makeBasis(right,up,basisBack));
}
function trailPoint(values,n,a,b=null,t=0){
 values[n*3]=((b?lerp(a.x,b.x,t):a.x)-800)/SCALE;values[n*3+1]=(FLOOR-(b?lerp(a.y,b.y,t):a.y))/SCALE;values[n*3+2]=(b?lerp(a.z,b.z,t):a.z)/SCALE;return n+1;
}
export class FighterModel {
 constructor(id){
  this.group=new T.Group();this.group.name=`Fighter ${id+1}`;this.points={};this.delta=new T.Vector3();this.up=new T.Vector3();this.rotation=new T.Quaternion();this.lastTrailCount=0;
  const t=themes[id];this.human=new HumanSkin(t);this.skin=this.human.mesh;this.group.add(this.skin);this.coat=this.human.material;this.garment=new Coat(this.skin,t);this.group.add(this.garment.mesh);
  const leather=material('#3e342a'),gold=material(t.trim,.45,.42),hat=material(id?'#443f32':'#3d4938');
  this.torso=new T.Group();this.group.add(this.torso);
  for(let i=0;i<4;i++)child(this.torso,unitSphere,gold,[.032,.040-i*.083,-.138],[.008,.008,.005]);
  child(this.torso,unitBox,gold,[.025,-.239,-.135],[.041,.029,.012]);
  this.head=new T.Group();this.group.add(this.head);
  child(this.head,brimGeo,hat);child(this.head,crownGeo,hat);child(this.head,hatBandGeo,leather);
  const eye=material('#aaa38b'),iris=material('#302f24');
  for(const x of[-.035,.035]){
   child(this.head,unitSphere,eye,[x,.001,-.084],[.013,.006,.010]);
   child(this.head,unitSphere,iris,[x,.001,-.093],[.004,.004,.003]);
  }
  const featherMat=material('#b6b99c');featherMat.side=T.DoubleSide;this.feather=child(this.head,featherGeo,featherMat);
  this.feet=[new T.Group(),new T.Group()];for(const foot of this.feet)this.group.add(foot);
  this.sword=new T.Group();this.group.add(this.sword);this.blade=child(this.sword,bladeGeo,bladeMat);
  child(this.sword,unitCylinder,leather,[0,-.075,0],[.029,.15,.029]);
  const guard=child(this.sword,guardGeo,gold,[0,-.012,0]);guard.rotation.x=Math.PI/2;
  child(this.sword,unitBox,gold,[0,.012,0],[.20,.03,.03]);child(this.sword,unitSphere,gold,[0,-.15,0],[.035,.032,.035]);
  this.scabbard=new T.Group();this.group.add(this.scabbard);child(this.scabbard,sheathGeo,leather);child(this.scabbard,unitCylinder,gold,[0,-.77,.024],[.019,.03,.013]);
  const trailGeo=new T.BufferGeometry();trailGeo.setAttribute('position',new T.BufferAttribute(new Float32Array(18*6*3),3));trailGeo.setDrawRange(0,0);
  this.trail=new T.Mesh(trailGeo,new T.MeshBasicMaterial({color:'#dbe5d1',side:T.DoubleSide,transparent:true,opacity:.16,depthWrite:false,blending:T.AdditiveBlending}));this.trail.frustumCulled=false;this.group.add(this.trail);
 }
 update(f,alpha,time,reduced){
  const p=this.points;for(const k in f.rig){const a=f.rig[k],b=f.prevRig[k]||a,v=p[k]||(p[k]=new T.Vector3());v.set((lerp(b.x,a.x,alpha)-800)/SCALE,(FLOOR-lerp(b.y,a.y,alpha))/SCALE,lerp(b.z,a.z,alpha)/SCALE);}
  const yaw=f.prevYaw+angleDelta(f.prevYaw,f.yaw)*alpha;this.human.update(p,yaw,f);this.garment.update(this.human.records[0].world,f.cloth);
  const up=this.up.subVectors(p.chest,p.hip).normalize(),rotation=bodyQuaternion(yaw,up,this.rotation);
  this.torso.position.copy(p.hip).add(p.chest).multiplyScalar(.5);this.torso.quaternion.copy(rotation);
  this.head.position.copy(p.head);this.head.quaternion.copy(this.human.headQuaternion);this.feather.rotation.z=reduced?0:Math.sin(time*2+f.id)*.012;
  for(let i=0;i<2;i++){this.feet[i].position.copy(i?p.ankleFront:p.ankleBack);this.feet[i].quaternion.copy(this.human.footQuaternions[i]);}
  const bladeDirection=this.delta.subVectors(p.tip,p.hand),bladeLength=bladeDirection.length();this.sword.position.copy(p.hand);this.sword.quaternion.setFromUnitVectors(UP,bladeDirection.normalize());this.blade.scale.y=bladeLength;
  this.scabbard.position.copy(p.hip);this.scabbard.position.x-=Math.sin(yaw)*.19;this.scabbard.position.z+=Math.cos(yaw)*.19;this.scabbard.quaternion.copy(rotation);this.scabbard.rotation.z+=.38;
  const values=this.trail.geometry.attributes.position.array;let n=0;
  if(!reduced)for(let i=1;i<f.trail.length&&n<18*6;i++){
   const a=f.trail[i-1],b=f.trail[i];n=trailPoint(values,n,a);n=trailPoint(values,n,b);n=trailPoint(values,n,a.base,a,.40);n=trailPoint(values,n,b);n=trailPoint(values,n,b.base,b,.40);n=trailPoint(values,n,a.base,a,.40);
  }
  if(n!==this.lastTrailCount)this.trail.geometry.setDrawRange(0,n);
  if(n)this.trail.geometry.attributes.position.needsUpdate=true;this.trail.visible=n>0;this.lastTrailCount=n;
 }
}
