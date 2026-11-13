import * as T from './vendor/three.module.min.js';
const randomSeed=seed=>()=>{seed=(seed*16807)%2147483647;return(seed-1)/2147483646;};
const stoneColors=['#8e9685','#818d7b','#a0a28b','#717e6d','#9a9c84'];
function texture(size,paint){const c=document.createElement('canvas');c.width=c.height=size;paint(c.getContext('2d'));const t=new T.CanvasTexture(c);t.colorSpace=T.SRGBColorSpace;t.wrapS=t.wrapT=T.RepeatWrapping;return t;}
function mesh(group,geometry,material,x,y,z){const m=new T.Mesh(geometry,material);m.position.set(x,y,z);m.castShadow=m.receiveShadow=true;group.add(m);return m;}
export function createArena(){
 const group=new T.Group();group.name='Courtyard';const r=randomSeed(4819);
 const groundTexture=texture(512,c=>{
  c.fillStyle='#7b806b';c.fillRect(0,0,512,512);
  for(let y=0;y<8;y++)for(let x=0;x<8;x++){c.fillStyle=['#858975','#7e846f','#898b76','#76806c'][Math.floor(r()*4)];c.fillRect(x*64+(y%2?32:0),y*64,62,62);}
  for(let i=0;i<8500;i++){const a=r();c.fillStyle=a>.5?'#c8c2a147':'#3d50452e';const x=r()*512,y=r()*512;c.fillRect(x,y,1+r()*3,1+r()*2);}
  for(let i=0;i<60;i++){c.strokeStyle='#3d50452b';c.lineWidth=.7;c.beginPath();let x=r()*512,y=r()*512;c.moveTo(x,y);for(let n=0;n<3;n++){x+=(r()-.5)*30;y+=r()*20;c.lineTo(x,y);}c.stroke();}
 });groundTexture.repeat.set(9,9);groundTexture.anisotropy=4;
 const ground=new T.Mesh(new T.PlaneGeometry(30,30),new T.MeshStandardMaterial({map:groundTexture,roughness:1,color:'#a4a58d'}));ground.rotation.x=-Math.PI/2;ground.position.y=-.004;ground.receiveShadow=true;group.add(ground);
 const earth=new T.Mesh(new T.CircleGeometry(4.75,96),new T.MeshStandardMaterial({color:'#8a8a70',roughness:1,transparent:true,opacity:.17,depthWrite:false}));earth.rotation.x=-Math.PI/2;earth.position.y=.001;group.add(earth);
 const ring=new T.Mesh(new T.TorusGeometry(4.78,.018,4,120),new T.MeshStandardMaterial({color:'#b5b19a',roughness:1}));ring.rotation.x=Math.PI/2;ring.position.y=-.015;group.add(ring);
 const box=new T.BoxGeometry(1,1,1),stone=new T.MeshStandardMaterial({color:'#ffffff',roughness:1});
 const rim=new T.InstancedMesh(box,stone,78),mat=new T.Matrix4(),q=new T.Quaternion(),v=new T.Vector3();
 for(let i=0;i<78;i++){const a=i/78*Math.PI*2;q.setFromAxisAngle(new T.Vector3(0,1,0),-a);mat.compose(v.set(Math.cos(a)*4.96,.012,Math.sin(a)*4.96),q,new T.Vector3(.11,.075,.29));rim.setMatrixAt(i,mat);rim.setColorAt(i,new T.Color(stoneColors[i%5]));}rim.receiveShadow=true;group.add(rim);
 // Four complete stone walls keep the arena convincing as the camera follows a circle.
 const archShape=new T.Shape(),R=1.45,inner=1.12,h=1.50;
 archShape.moveTo(-R,0);archShape.lineTo(-R,h);archShape.absarc(0,h,R,Math.PI,0,true);archShape.lineTo(R,0);archShape.lineTo(inner,0);archShape.lineTo(inner,h);archShape.absarc(0,h,inner,0,Math.PI,false);archShape.lineTo(-inner,0);archShape.closePath();
 const archGeo=new T.ExtrudeGeometry(archShape,{depth:.56,bevelEnabled:true,bevelSegments:1,steps:1,bevelSize:.025,bevelThickness:.025,curveSegments:18});archGeo.translate(0,0,-.28);
 const archMat=new T.MeshStandardMaterial({color:'#b3b09a',roughness:.95}),iron=new T.MeshStandardMaterial({color:'#354237',metalness:.45,roughness:.65});
 for(let wall=0;wall<4;wall++){
  const g=new T.Group();g.rotation.y=wall*Math.PI/2;g.position.set(Math.sin(wall*Math.PI/2)*-11,0,Math.cos(wall*Math.PI/2)*-11);
  const blocks=[];
  for(let row=0;row<7;row++)for(let col=-15;col<=15;col++){const x=col*.75+(row%2?.375:0);if(Math.abs(x)<1.65&&row<6)continue;blocks.push({x,y:.23+row*.47,w:.72,hh:.445});}
  const inst=new T.InstancedMesh(box,stone,blocks.length);blocks.forEach((b,i)=>{mat.compose(v.set(b.x,b.y,0),new T.Quaternion(),new T.Vector3(b.w,b.hh,.55));inst.setMatrixAt(i,mat);inst.setColorAt(i,new T.Color(stoneColors[Math.floor(r()*5)]));});inst.castShadow=inst.receiveShadow=true;g.add(inst);
  mesh(g,archGeo,archMat,0,0,.01);
  const bars=new T.InstancedMesh(new T.CylinderGeometry(.019,.019,1,6),iron,13);
  for(let i=0;i<13;i++){const x=(i-6)*.17,height=1.5+Math.sqrt(Math.max(0,inner*inner-x*x));mat.compose(v.set(x,height/2,-.15),new T.Quaternion(),new T.Vector3(1,height,1));bars.setMatrixAt(i,mat);}bars.castShadow=true;g.add(bars);
  for(const y of[.8,1.5])mesh(g,new T.BoxGeometry(2.22,.055,.06),iron,0,y,-.16);
  mesh(g,new T.BoxGeometry(22.8,.15,.70),archMat,0,3.38,0);
  for(const x of[-7.6,-4.3,4.3,7.6]){mesh(g,new T.BoxGeometry(.62,3.45,.82),new T.MeshStandardMaterial({color:'#8b937e',roughness:1}),x,1.68,.15);mesh(g,new T.BoxGeometry(.79,.16,.98),archMat,x,3.43,.15);}
  group.add(g);
 }
 // Instanced foliage and branches make a shaded garden with modest draw-call cost.
 const foliageMat=new T.MeshStandardMaterial({color:'#ffffff',roughness:1,flatShading:true}),foliage=new T.InstancedMesh(new T.IcosahedronGeometry(1,1),foliageMat,48);
 const trunkMat=new T.MeshStandardMaterial({color:'#505245',roughness:1}),trunks=new T.InstancedMesh(new T.CylinderGeometry(.16,.30,1,7),trunkMat,8);
 const treePositions=[[-8.8,-8],[-8.6,3],[-8.5,8.6],[8.7,-8.2],[8.8,3.4],[8.6,8.6],[-3,-9.1],[4.4,-9.1]];
 treePositions.forEach(([x,z],i)=>{
  mat.compose(v.set(x,1.6,z),new T.Quaternion(),new T.Vector3(1,3.25,1));trunks.setMatrixAt(i,mat);
  for(let j=0;j<6;j++){const a=j/6*Math.PI*2,cx=x+Math.cos(a)*(j?1:0),cz=z+Math.sin(a)*(j?1:0),cy=3.6+r()*1.3;mat.compose(v.set(cx,cy,cz),new T.Quaternion().setFromEuler(new T.Euler(r(),r(),r())),new T.Vector3(1.3+r()*.8,1+r()*.6,1.3+r()*.8));const n=i*6+j;foliage.setMatrixAt(n,mat);foliage.setColorAt(n,new T.Color(['#697c51','#526d48','#80915f','#647b51'][Math.floor(r()*4)]));}
 });foliage.castShadow=trunks.castShadow=true;foliage.receiveShadow=trunks.receiveShadow=true;group.add(foliage,trunks);
 const grass=new T.InstancedMesh(new T.ConeGeometry(.07,.3,3),new T.MeshStandardMaterial({color:'#5c754f',roughness:1}),160);
 for(let i=0;i<160;i++){const a=r()*Math.PI*2,rr=7+r()*3;mat.compose(v.set(Math.cos(a)*rr,.10,Math.sin(a)*rr),new T.Quaternion().setFromAxisAngle(new T.Vector3(0,1,0),r()*6),new T.Vector3(1+r(),.6+r(),1));grass.setMatrixAt(i,mat);}group.add(grass);
 const wood=new T.MeshStandardMaterial({color:'#615943',roughness:.95}),hoop=new T.MeshStandardMaterial({color:'#454e40',metalness:.25,roughness:.7});
 for(const [x,z]of[[-6.6,-7],[6.8,-6.5],[-6.7,7.1],[6.8,7]]){
  mesh(group,new T.CylinderGeometry(.32,.30,.8,12),wood,x,.4,z);
  for(const y of[.12,.67])mesh(group,new T.TorusGeometry(.32,.027,5,12),hoop,x,y,z).rotation.x=Math.PI/2;
 }
 for(const x of[-7.5,7.5]){const bench=new T.Group();mesh(bench,new T.BoxGeometry(.60,.13,2.6),wood,0,.52,0);for(const z of[-.92,.92])mesh(bench,new T.BoxGeometry(.48,.50,.13),wood,0,.25,z);bench.position.set(x,0,0);group.add(bench);}
 return group;
}
