import * as T from './vendor/three.module.min.js';
import {FLOOR,clamp,damp,dampAngle} from './engine.js?v=10';
import {FighterModel,worldPoint,SCALE} from './fighter3d.js?v=10';
import {createArena} from './arena.js?v=10';
import {batchScenery,FighterBatches} from './batching.js?v=10';
import {GraphicsQuality} from './quality.js?v=10';

// The scene uses real meshes, lighting, perspective, depth testing and shadow maps.
export class Renderer {
 constructor(canvas,duel,{backend=null,quality='auto'}={}){
  this.canvas=canvas;this.duel=duel;this.reduced=false;this.supported=true;this.time=0;this.shake=0;this.notice=null;this.noticeLife=0;this.damageNumbers=[];this.labelTextures=new Map();this.view={...duel.camera};this.center=new T.Vector3();this.shadowClock=0;this.lastParticleCount=0;
  const lowPower=typeof navigator!=='undefined'&&((navigator.hardwareConcurrency&&navigator.hardwareConcurrency<=4)||(navigator.deviceMemory&&navigator.deviceMemory<=4));
  this.quality=new GraphicsQuality(quality,{lowPower});
  try{
   this.gpu=backend||new T.WebGLRenderer({canvas,antialias:false,alpha:false,powerPreference:'high-performance'});
  }catch(error){this.supported=false;this.error='Enable WebGL or hardware acceleration.';return;}
  this.gpu.setPixelRatio(1);
  this.gpu.shadowMap.enabled=false;this.gpu.shadowMap.type=T.PCFShadowMap;this.gpu.shadowMap.autoUpdate=false;
  this.gpu.toneMapping=T.ACESFilmicToneMapping;this.gpu.toneMappingExposure=1.05;this.gpu.outputColorSpace=T.SRGBColorSpace;
  this.scene=new T.Scene();this.scene.background=new T.Color('#85978d');this.scene.fog=new T.Fog('#85978d',13,36);
  this.camera=new T.PerspectiveCamera(33,1600/760,.08,65);
  const hemi=new T.HemisphereLight('#e4e8d3','#566449',2.1);this.scene.add(hemi);
  this.sun=new T.DirectionalLight('#ffe3b5',2.8);this.sun.position.set(-5,10,5);this.sun.castShadow=true;
  this.sun.shadow.mapSize.set(1024,1024);this.sun.shadow.autoUpdate=false;Object.assign(this.sun.shadow.camera,{left:-9,right:9,top:9,bottom:-9,near:.2,far:30});this.sun.shadow.bias=-.00025;this.sun.shadow.normalBias=.025;this.sun.shadow.radius=3;this.scene.add(this.sun);
  const rim=new T.DirectionalLight('#aec6ce',1.0);rim.position.set(4,5,-6);this.scene.add(rim);
  this.arena=batchScenery(createArena());this.scene.add(this.arena);
  this.models=[new FighterModel(0),new FighterModel(1)];
  for(const model of this.models){model.group.visible=false;this.scene.add(model.skin,model.garment.mesh,model.trail);}
  this.fighterBatches=new FighterBatches(this.models);this.scene.add(this.fighterBatches.group);
  const shadowCanvas=document.createElement('canvas');shadowCanvas.width=shadowCanvas.height=64;const ctx=shadowCanvas.getContext('2d'),gradient=ctx.createRadialGradient(32,32,3,32,32,31);gradient.addColorStop(0,'rgba(13,28,18,.52)');gradient.addColorStop(.55,'rgba(13,28,18,.24)');gradient.addColorStop(1,'rgba(13,28,18,0)');ctx.fillStyle=gradient;ctx.fillRect(0,0,64,64);
  const shadowTexture=new T.CanvasTexture(shadowCanvas);this.contactShadows=[];
  for(let i=0;i<2;i++){const shadow=new T.Mesh(new T.PlaneGeometry(1.35,.95),new T.MeshBasicMaterial({map:shadowTexture,transparent:true,opacity:.72,depthWrite:false}));shadow.rotation.x=-Math.PI/2;shadow.position.y=.007;shadow.renderOrder=1;this.scene.add(shadow);this.contactShadows.push(shadow);}

  const particleGeometry=new T.BufferGeometry();particleGeometry.setAttribute('position',new T.BufferAttribute(new Float32Array(256*3),3));particleGeometry.setAttribute('color',new T.BufferAttribute(new Float32Array(256*3),3));particleGeometry.setDrawRange(0,0);
  this.particlePoints=new T.Points(particleGeometry,new T.PointsMaterial({size:.030,vertexColors:true,transparent:true,opacity:.88,depthWrite:false,sizeAttenuation:true}));this.particlePoints.frustumCulled=false;this.scene.add(this.particlePoints);
  this.messageEl=document.createElement('div');this.messageEl.className='scene-message';this.messageEl.setAttribute('aria-hidden','true');canvas.parentNode.appendChild(this.messageEl);
  this.fadeEl=document.createElement('div');this.fadeEl.className='scene-fade';canvas.parentNode.appendChild(this.fadeEl);
  canvas.addEventListener('webglcontextlost',event=>{event.preventDefault();this.lost=true;duel.pause();this.messageEl.textContent='Graphics paused';this.messageEl.style.opacity=1;});
  canvas.addEventListener('webglcontextrestored',()=>{this.lost=false;});
  this.applyGraphics();this.render(1,0);
 }
 setGraphics(mode){this.quality.setMode(mode);this.applyGraphics();}
 applyGraphics(){
  if(!this.supported)return;
  if(this.canvas.parentNode.dataset)this.canvas.parentNode.dataset.graphics=this.quality.level;
  const shadows=this.quality.profile.shadows;this.gpu.shadowMap.enabled=shadows;this.sun.castShadow=shadows;
  if(shadows){this.gpu.shadowMap.needsUpdate=true;this.sun.shadow.needsUpdate=true;}
  else if(this.sun.shadow.map){this.sun.shadow.map.dispose();this.sun.shadow.map=null;}
  for(const shadow of this.contactShadows)shadow.material.opacity=shadows?.28:.72;
  for(const mesh of this.arena.children){const map=mesh.material.map;if(map){const value=this.quality.level==='high'?4:this.quality.level==='balanced'?2:1;if(map.anisotropy!==value){map.anisotropy=value;map.needsUpdate=true;}}}
  this.resize();
 }
 recordFrame(seconds,active){if(this.quality.observe(seconds,active))this.applyGraphics();}
 resize(){
  if(!this.supported)return;
  const rect=this.canvas.getBoundingClientRect(),profile=this.quality.profile,aspect=Math.max(.1,rect.width/Math.max(1,rect.height||rect.width*760/1600));
  const budget=profile.maxWidth*Math.round(profile.maxWidth*760/1600);
  const width=Math.max(1,Math.floor(Math.min(profile.maxWidth,rect.width*profile.scale,Math.sqrt(budget*aspect)))),height=Math.max(1,Math.floor(width/aspect));
  if(this.renderWidth===width&&this.renderHeight===height&&this.camera.aspect===aspect)return;
  this.renderWidth=width;this.renderHeight=height;this.gpu.setSize(width,height,false);this.camera.aspect=aspect;
  this.camera.fov=T.MathUtils.radToDeg(2*Math.atan(Math.tan(T.MathUtils.degToRad(33/2))*Math.max(1,(1600/760)/aspect)));this.camera.updateProjectionMatrix();
 }

 impact(type,heavy=false){if(type==='hit')this.shake=this.reduced?0:heavy?.07:.035;else if(type==='parry'||type==='clash'||type==='perfectParry')this.shake=this.reduced?0:.018;}
 message(text){this.notice=text;this.noticeLife=.8;}
 textTexture(text){
  if(this.labelTextures.has(text))return this.labelTextures.get(text);
  const c=document.createElement('canvas');c.width=128;c.height=64;const ctx=c.getContext('2d');ctx.clearRect(0,0,128,64);ctx.font='600 38px Georgia, serif';ctx.textAlign='center';ctx.textBaseline='middle';ctx.strokeStyle='#16251b';ctx.lineWidth=5;ctx.strokeText(text,64,32);ctx.fillStyle='#f3d6a5';ctx.fillText(text,64,32);
  const texture=new T.CanvasTexture(c);texture.colorSpace=T.SRGBColorSpace;this.labelTextures.set(text,texture);return texture;
 }
 damage(event){
  if(!this.supported)return;
  const sprite=new T.Sprite(new T.SpriteMaterial({map:this.textTexture('-'+event.damage),transparent:true,depthTest:false,depthWrite:false}));sprite.position.copy(worldPoint(event));sprite.position.y+=.25;sprite.scale.set(.60,.30,1);sprite.renderOrder=10;this.scene.add(sprite);this.damageNumbers.push({sprite,life:.8});
 }
 updateMessages(){
  const d=this.duel;let text='',alpha=0;
  if(d.phase==='countdown'){text='READY';alpha=Math.sin(Math.min(1,d.phaseTime/1.05)*Math.PI);}
  else if(d.phase==='fight'&&d.phaseTime<.5){text='FIGHT';alpha=1-d.phaseTime/.5;}
  else if(d.phase==='finish'&&d.phaseTime<.8){text='K.O.';alpha=1-d.phaseTime/.8;}
  else if(d.phase==='fight'&&this.noticeLife>0){text=this.notice;alpha=Math.min(1,this.noticeLife*3);}
  if(this.messageEl.textContent!==text)this.messageEl.textContent=text;
  const opacity=alpha.toFixed(2);if(this.messageEl.style.opacity!==opacity)this.messageEl.style.opacity=opacity;
  const fade=d.fade.toFixed(2);if(this.fadeEl.style.opacity!==fade)this.fadeEl.style.opacity=fade;
 }
 render(alpha,dt){
  if(!this.supported||this.lost)return;
  this.time+=dt;this.shake=damp(this.shake,0,12,dt);this.noticeLife=Math.max(0,this.noticeLife-dt);
  const d=this.duel;
  for(const key of['x','z','distance'])this.view[key]=damp(this.view[key],d.camera[key],14,dt);
  this.view.angle=dampAngle(this.view.angle,d.camera.angle,14,dt);
  const center=this.center.set((this.view.x-800)/SCALE,.91,this.view.z/SCALE),range=this.view.distance/SCALE,angle=this.view.angle;
  const shake=this.reduced?0:this.shake;
  this.camera.position.set(center.x+Math.cos(angle)*range+Math.sin(this.time*65)*shake,2.60+(range-6.5)*.18+Math.cos(this.time*52)*shake*.4,center.z+Math.sin(angle)*range);
  this.camera.lookAt(center);this.camera.updateMatrixWorld();
  for(let i=0;i<2;i++){
   this.models[i].update(d.fighters[i],alpha,this.time,this.reduced||!this.quality.profile.trails);
   const f=d.fighters[i];const rig=f.rig;this.contactShadows[i].position.set(((rig.hip.x+rig.ankleFront.x+rig.ankleBack.x)/3-800)/SCALE,.007,(rig.hip.z+rig.ankleFront.z+rig.ankleBack.z)/3/SCALE);this.contactShadows[i].rotation.z=-f.yaw;
  }
  this.fighterBatches.update(this.models);
  const ps=this.particlePoints.geometry.attributes.position.array,colors=this.particlePoints.geometry.attributes.color.array;let count=0;
  const limit=this.reduced?0:this.quality.profile.particles;
  for(let i=Math.max(0,d.particles.length-limit);i<d.particles.length&&count<limit;i++){
   const p=d.particles[i],a=clamp(p.life/p.max,0,1);ps[count*3]=(p.x-800)/SCALE;ps[count*3+1]=(FLOOR-p.y)/SCALE;ps[count*3+2]=p.z/SCALE;
   colors[count*3]=p.kind==='spark'?a*1.6:a*.6;colors[count*3+1]=p.kind==='spark'?a*1.2:a*.55;colors[count*3+2]=p.kind==='spark'?a*.6:a*.4;count++;
  }
  if(count||this.lastParticleCount){this.particlePoints.geometry.setDrawRange(0,count);this.particlePoints.geometry.attributes.position.needsUpdate=true;this.particlePoints.geometry.attributes.color.needsUpdate=true;}
  this.particlePoints.visible=count>0;this.lastParticleCount=count;
  for(const item of this.damageNumbers){item.life-=dt;item.sprite.position.y+=dt*.35;item.sprite.material.opacity=Math.min(1,item.life*3);if(item.life<=0){this.scene.remove(item.sprite);item.sprite.material.dispose();}}
  this.damageNumbers=this.damageNumbers.filter(item=>item.life>0);
  this.shadowClock+=dt;
  if(this.quality.profile.shadows&&this.shadowClock>=1/30){this.gpu.shadowMap.needsUpdate=true;this.sun.shadow.needsUpdate=true;this.shadowClock=0;}
  this.updateMessages();this.gpu.render(this.scene,this.camera);
 }
}
