import * as T from './vendor/three.module.min.js';

// Bake unmoving scenery once; animate shared primitive instances for the fighters.
// Neither operation touches the collision rig.
function materialKey(m){return [m.type,m.map?.uuid||'',m.roughness??1,m.metalness??0,m.side,m.flatShading?1:0,m.transparent?m.opacity:1].join('/');}
function renderMaterial(source,vertexColors=false){
 const options={color:0xffffff,side:source.side,vertexColors,map:source.map||null,transparent:source.transparent,opacity:source.opacity,depthWrite:source.depthWrite,flatShading:source.flatShading,fog:source.fog};
 const m=(source.metalness||0)>.1?new T.MeshStandardMaterial({...options,roughness:source.roughness,metalness:source.metalness,emissive:source.emissive,emissiveIntensity:source.emissiveIntensity}):new T.MeshLambertMaterial(options);
 return m;
}
export function batchScenery(source){
 source.updateMatrixWorld(true);
 const batches=new Map(),instance=new T.Matrix4(),world=new T.Matrix4(),normalMatrix=new T.Matrix3(),p=new T.Vector3(),normal=new T.Vector3(),instanceColor=new T.Color();
 source.traverse(o=>{
  if(!o.isMesh)return;
  const material=o.material;
  const key=materialKey(material);let batch=batches.get(key);
  if(!batch){batch={source:material,positions:[],normals:[],colors:[],uvs:[]};batches.set(key,batch);}
  const geometry=o.geometry,position=geometry.attributes.position,normals=geometry.attributes.normal,uv=geometry.attributes.uv,index=geometry.index;
  const total=Math.min(index?index.count:position.count,geometry.drawRange.count);
  const start=geometry.drawRange.start;
  for(let n=0;n<(o.isInstancedMesh?o.count:1);n++){
   world.copy(o.matrixWorld);instanceColor.set(0xffffff);
   if(o.isInstancedMesh){o.getMatrixAt(n,instance);world.multiply(instance);if(o.instanceColor)o.getColorAt(n,instanceColor);}
   instanceColor.multiply(material.color);normalMatrix.getNormalMatrix(world);
   for(let k=start;k<start+total;k++){
    const i=index?index.getX(k):k;p.fromBufferAttribute(position,i).applyMatrix4(world);
    batch.positions.push(p.x,p.y,p.z);normal.fromBufferAttribute(normals,i).applyNormalMatrix(normalMatrix);batch.normals.push(normal.x,normal.y,normal.z);
    batch.colors.push(instanceColor.r,instanceColor.g,instanceColor.b);batch.uvs.push(uv?uv.getX(i):0,uv?uv.getY(i):0);
   }
  }
 });
 const group=new T.Group();group.name='Batched courtyard';
 for(const batch of batches.values()){
  const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(batch.positions,3));g.setAttribute('normal',new T.Float32BufferAttribute(batch.normals,3));g.setAttribute('color',new T.Float32BufferAttribute(batch.colors,3));g.setAttribute('uv',new T.Float32BufferAttribute(batch.uvs,2));g.computeBoundingSphere();
  const mesh=new T.Mesh(g,renderMaterial(batch.source,true));mesh.receiveShadow=true;mesh.castShadow=false;mesh.matrixAutoUpdate=false;mesh.updateMatrix();group.add(mesh);
 }
 // Only GPU geometry is replaced. The generated texture maps remain shared by the batches.
 const disposed=new Set();source.traverse(o=>{if(o.isMesh&&!disposed.has(o.geometry)){disposed.add(o.geometry);o.geometry.dispose();}});
 group.updateMatrixWorld(true);return group;
}
const primitiveCache=new Map();
function primitive(source){
 const p=source.parameters||{},scale=new T.Vector3(1,1,1);let key,make;
 if(source.type==='BoxGeometry'){key='box';scale.set(p.width,p.height,p.depth);make=()=>new T.BoxGeometry(1,1,1);}
 else if(source.type==='CylinderGeometry'){
  const r=Math.max(p.radiusTop,p.radiusBottom),ratio=Math.min(p.radiusTop,p.radiusBottom)/r;
  const taper=ratio>.9?'straight':p.radiusTop>p.radiusBottom?'down':'up';key='cylinder/'+taper+(p.openEnded?'/open':'/closed');
  scale.set(r,p.height,r);make=()=>new T.CylinderGeometry(taper==='up'?.8:1,taper==='down'?.8:1,1,8,1,p.openEnded);
 }else if(source.type==='SphereGeometry'){
  const cap=p.thetaLength<Math.PI-.01;key='sphere/'+(cap?'cap':'full');scale.setScalar(p.radius);
  make=()=>new T.SphereGeometry(1,10,7,p.phiStart,p.phiLength,p.thetaStart,p.thetaLength);
 }else if(source.type==='TorusGeometry'){
  key='torus/'+[p.radius,p.tube,p.radialSegments,p.tubularSegments,p.arc].join('/');make=()=>source;
 }else return{geometry:source,scale};
 if(!primitiveCache.has(key))primitiveCache.set(key,make());return{geometry:primitiveCache.get(key),scale};
}
export class FighterBatches {
 constructor(models){
  this.group=new T.Group();this.group.name='Instanced fighters';this.records=[];this.batches=[];this.matrix=new T.Matrix4();this.color=new T.Color();const groups=new Map();
  for(const model of models){
   model.group.updateMatrixWorld(true);
   model.group.traverse(mesh=>{
    if(!mesh.isMesh||mesh.isSkinnedMesh||mesh.userData.dynamicGarment||mesh.material.transparent)return;
    const shape=primitive(mesh.geometry),m=mesh.material;
    const key=shape.geometry.uuid+'/'+((m.metalness||0)>.1?materialKey(m):'diffuse');
    let batch=groups.get(key);if(!batch){batch={geometry:shape.geometry,source:m,records:[]};groups.set(key,batch);}
    batch.records.push({source:mesh,scale:shape.scale,lastColor:null});
   });
  }
  for(const b of groups.values()){
   const mesh=new T.InstancedMesh(b.geometry,renderMaterial(b.source),b.records.length);mesh.name='Fighter instances';mesh.castShadow=mesh.receiveShadow=true;mesh.frustumCulled=false;mesh.instanceMatrix.setUsage(T.DynamicDrawUsage);this.group.add(mesh);
   this.batches.push({mesh,records:b.records});
  }
  this.update(models);
 }
 update(models){
  for(const model of models)model.group.updateMatrixWorld(true);
  for(const batch of this.batches){
   let colorsChanged=false;
   for(let i=0;i<batch.records.length;i++){
    const r=batch.records[i],m=r.source.material;this.matrix.copy(r.source.matrixWorld).scale(r.scale);batch.mesh.setMatrixAt(i,this.matrix);
    this.color.copy(m.color);if(!batch.mesh.material.isMeshStandardMaterial&&m.emissiveIntensity>0){this.color.r+=m.emissive.r*m.emissiveIntensity;this.color.g+=m.emissive.g*m.emissiveIntensity;this.color.b+=m.emissive.b*m.emissiveIntensity;}
    const signature=this.color.r+this.color.g*3+this.color.b*7;
    if(r.lastColor!==signature){batch.mesh.setColorAt(i,this.color);r.lastColor=signature;colorsChanged=true;}
   }
   batch.mesh.instanceMatrix.needsUpdate=true;if(colorsChanged)batch.mesh.instanceColor.needsUpdate=true;
  }
 }
}
