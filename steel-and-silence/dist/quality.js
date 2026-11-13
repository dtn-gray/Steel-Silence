export const GRAPHICS_PROFILES=Object.freeze({
 low:{maxWidth:640,scale:.75,particles:0,trails:false,shadows:false},
 fast:{maxWidth:900,scale:.9,particles:32,trails:false,shadows:false},
 balanced:{maxWidth:1280,scale:1,particles:96,trails:true,shadows:false},
 high:{maxWidth:1600,scale:1.25,particles:128,trails:true,shadows:true}
});
export class GraphicsQuality {
 constructor(mode='auto',{lowPower=false}={}){this.lowPower=lowPower;this.setMode(mode);}
 setMode(mode){this.mode=['auto','fast','high'].includes(mode)?mode:'auto';this.level=this.mode==='auto'?(this.lowPower?'fast':'balanced'):(this.mode==='fast'?'low':'high');this.resetSamples();}
 resetSamples(){this.duration=0;this.frames=0;}
 get profile(){return GRAPHICS_PROFILES[this.level];}
 observe(seconds,active=true){
  if(this.mode!=='auto'||!active||seconds<=0||seconds>.2){this.resetSamples();return false;}
  this.duration+=seconds;this.frames++;
  if(this.duration<1.8||this.frames<24)return false;
  const average=this.duration/this.frames;this.resetSamples();
  if(this.level==='balanced'&&average>.024){this.level='fast';return true;}
  if(this.level==='fast'&&average>.034){this.level='low';return true;}
  return false;
 }
}
