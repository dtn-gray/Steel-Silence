import * as T from './vendor/three.module.min.js';

// Each cloth triangle lies outside a supporting plane of the posed lower body.
// This separates complete triangles, not just their corners, without cloth physics.
const PANELS=[[.06,1.55,.35],[1.61,2.25,.20],[4.03,4.67,.20],[4.73,6.22,.35]],COLS=6,ROWS=7;
const CLEARANCE=.012,THICKNESS=.003;
const lowerBodies=new WeakMap();
function lowerBody(geometry){
 const position=geometry.attributes.position;
 if(lowerBodies.has(position))return lowerBodies.get(position);
 const indices=geometry.index.array,end=geometry.userData.bodyIndexCount,remap=new Int32Array(position.count).fill(-1),vertices=[],triangles=[];
 for(let i=0;i<end;i+=3){
  const a=indices[i],b=indices[i+1],c=indices[i+2];
  if(Math.min(position.getY(a),position.getY(b),position.getY(c))>1.14||Math.max(Math.abs(position.getX(a)),Math.abs(position.getX(b)),Math.abs(position.getX(c)))>.30)continue;
  for(const v of[a,b,c]){if(remap[v]<0){remap[v]=vertices.length;vertices.push(v);}triangles.push(remap[v]);}
 }
 const result={vertices:new Uint16Array(vertices),triangles:new Uint16Array(triangles)};lowerBodies.set(position,result);return result;
}
export class Coat {
 constructor(body,theme){
  this.body=body;this.lowerBody=lowerBody(body.geometry);this.posed=new Float32Array(this.lowerBody.vertices.length*3);this.inverse=new T.Matrix4();this.point=new T.Vector3();
  this.bindPositions=new Float32Array(this.posed.length);const source=body.geometry.attributes.position;
  for(let i=0;i<this.lowerBody.vertices.length;i++){this.point.fromBufferAttribute(source,this.lowerBody.vertices[i]).applyMatrix4(body.bindMatrix).toArray(this.bindPositions,i*3);}
  this.poseToHip=new T.Matrix4();this.polygon=new Float64Array(16);
  this.panels=[];this.cells=[];this.bands=[];const bands=new Map();const positions=[],colors=[],indices=[],coat=new T.Color(theme.coat),lining=new T.Color(theme.dark);
  for(const[start,end,length]of PANELS){
   const base=positions.length/3,layer=(ROWS+1)*(COLS+1),panel={base,layer,start,end,length,vertices:[],cells:[]};
   for(let r=0;r<=ROWS;r++)for(let c=0;c<=COLS;c++){
    const t=r/ROWS,a=start+(end-start)*c/COLS;
    panel.vertices.push({x:Math.sin(a),z:Math.cos(a),y:.091-t*length,t,radius:1/Math.hypot(Math.sin(a)/(.177+t*.055),Math.cos(a)/(.139+t*.026))});
   }
   for(let inner=0;inner<2;inner++)for(let r=0;r<=ROWS;r++)for(let c=0;c<=COLS;c++){
    positions.push(0,0,0);const t=r/ROWS,a=start+(end-start)*c/COLS,shade=.93+Math.sin(a*15+t*2)*.035;
    const color=inner?lining:coat;colors.push(color.r*shade,color.g*shade,color.b*shade);
   }
   for(let r=0;r<ROWS;r++)for(let c=0;c<COLS;c++){
    const mid=start+(end-start)*(c+.5)/COLS,cell={x:Math.sin(mid),z:Math.cos(mid),low:.091-(r+1)/ROWS*length-CLEARANCE,high:.091-r/ROWS*length+CLEARANCE,support:-Infinity};
    panel.cells.push(cell);this.cells.push(cell);
    const bandKey=length+'/'+r;let band=bands.get(bandKey);if(!band){band={low:cell.low,high:cell.high,cells:[]};bands.set(bandKey,band);this.bands.push(band);}band.cells.push(cell);
    const a=base+r*(COLS+1)+c,b=a+1,d=a+COLS+1,e=d+1;
    indices.push(a,d,b,b,d,e,a+layer,b+layer,d+layer,b+layer,e+layer,d+layer);
   }
   for(let c=0;c<COLS;c++){const a=base+ROWS*(COLS+1)+c,b=a+1;indices.push(a,b,a+layer,b,b+layer,a+layer);}
   for(const c of[0,COLS])for(let r=0;r<ROWS;r++){const a=base+r*(COLS+1)+c,b=a+COLS+1;indices.push(a,a+layer,b,a+layer,b+layer,b);}
   this.panels.push(panel);
  }
  const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(positions,3).setUsage(T.DynamicDrawUsage));g.setAttribute('normal',new T.Float32BufferAttribute(new Float32Array(positions.length),3).setUsage(T.DynamicDrawUsage));g.setAttribute('color',new T.Float32BufferAttribute(colors,3));g.setIndex(indices);
  this.mesh=new T.Mesh(g,new T.MeshLambertMaterial({color:0xffffff,vertexColors:true}));this.mesh.name='Coat with pose clearance';this.mesh.userData.dynamicGarment=true;this.mesh.castShadow=this.mesh.receiveShadow=true;this.mesh.frustumCulled=false;
 }
 update(hipMatrix,sway=0){
  this.inverse.copy(hipMatrix).invert();this.poseToHip.copy(this.inverse).multiply(this.body.bindMatrixInverse);
  const p=this.posed,ids=this.lowerBody.vertices,triangles=this.lowerBody.triangles,v=this.point,matrices=this.body.skeleton.boneMatrices;
  const bind=this.bindPositions,weights=this.body.geometry.attributes.skinWeight.array,bones=this.body.geometry.attributes.skinIndex.array,h=this.poseToHip.elements;
  // Use the exact shader skin matrices; do not rebuild them per cloth vertex.
  for(let i=0;i<ids.length;i++){
   const offset=ids[i]*4,x=bind[i*3],y=bind[i*3+1],z=bind[i*3+2];let px=0,py=0,pz=0;
   for(let k=0;k<4;k++){
    const weight=weights[offset+k]/255;if(!weight)continue;const m=bones[offset+k]*16;
    px+=(matrices[m]*x+matrices[m+4]*y+matrices[m+8]*z+matrices[m+12])*weight;
    py+=(matrices[m+1]*x+matrices[m+5]*y+matrices[m+9]*z+matrices[m+13])*weight;
    pz+=(matrices[m+2]*x+matrices[m+6]*y+matrices[m+10]*z+matrices[m+14])*weight;
   }
   p[i*3]=h[0]*px+h[4]*py+h[8]*pz+h[12];p[i*3+1]=h[1]*px+h[5]*py+h[9]*pz+h[13];p[i*3+2]=h[2]*px+h[6]*py+h[10]*pz+h[14];
  }
  for(const cell of this.cells)cell.support=-Infinity;
  const polygon=this.polygon;
  for(let i=0;i<triangles.length;i+=3){
   const a=triangles[i]*3,b=triangles[i+1]*3,c=triangles[i+2]*3,low=Math.min(p[a+1],p[b+1],p[c+1]),high=Math.max(p[a+1],p[b+1],p[c+1]);
   for(const band of this.bands){
    if(high<band.low||low>band.high)continue;
    // Clip the body triangle to this cloth row before finding its support.
    // Using only corners would miss a leg crossing between two cloth rows.
    let n=0;
    for(let j=0;j<3;j++){
     const u=triangles[i+j]*3,w=triangles[i+(j+1)%3]*3,y=p[u+1],otherY=p[w+1];
     if(y>=band.low&&y<=band.high){polygon[n++]=p[u];polygon[n++]=p[u+2];}
     if((y<band.low&&otherY>band.low)||(y>band.low&&otherY<band.low)){
      const t=(band.low-y)/(otherY-y);polygon[n++]=p[u]+(p[w]-p[u])*t;polygon[n++]=p[u+2]+(p[w+2]-p[u+2])*t;
     }
     if((y<band.high&&otherY>band.high)||(y>band.high&&otherY<band.high)){
      const t=(band.high-y)/(otherY-y);polygon[n++]=p[u]+(p[w]-p[u])*t;polygon[n++]=p[u+2]+(p[w+2]-p[u+2])*t;
     }
    }
    for(const cell of band.cells){let support=cell.support;for(let j=0;j<n;j+=2)support=Math.max(support,polygon[j]*cell.x+polygon[j+1]*cell.z);cell.support=support;}
   }
  }
  const values=this.mesh.geometry.attributes.position;
  for(const panel of this.panels){
   for(let r=0;r<=ROWS;r++)for(let c=0;c<=COLS;c++){
    const i=r*(COLS+1)+c,vert=panel.vertices[i];let radius=vert.radius+Math.sin(vert.t*Math.PI)*Math.sin(sway*.02)*.006;
    // A shared corner satisfies every adjacent cell's separating plane.
    for(let rr=Math.max(0,r-1);rr<=Math.min(ROWS-1,r);rr++)for(let cc=Math.max(0,c-1);cc<=Math.min(COLS-1,c);cc++){
     const cell=panel.cells[rr*COLS+cc],projection=vert.x*cell.x+vert.z*cell.z;
     radius=Math.max(radius,(cell.support+CLEARANCE+THICKNESS)/projection);
    }
    for(let inner=0;inner<2;inner++){
     const rad=radius-inner*THICKNESS;v.set(vert.x*rad,vert.y,vert.z*rad).applyMatrix4(hipMatrix);values.setXYZ(panel.base+inner*panel.layer+i,v.x,v.y,v.z);
    }
   }
  }
  values.needsUpdate=true;this.mesh.geometry.computeVertexNormals();
 }
}
