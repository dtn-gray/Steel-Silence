// Small synthesized soundscape. No downloads or delayed sound samples.
export class Sound {
 constructor(){this.enabled=false;this.ctx=null;this.lastStep=0;}
 unlock(){
  if(!this.enabled)return;
  try{if(!this.ctx){const AC=window.AudioContext||window.webkitAudioContext;if(!AC)return;this.ctx=new AC();this.master=this.ctx.createGain();this.master.gain.value=.55;this.master.connect(this.ctx.destination);this.noiseBuffer=this.ctx.createBuffer(1,this.ctx.sampleRate*2,this.ctx.sampleRate);const data=this.noiseBuffer.getChannelData(0);for(let i=0;i<data.length;i++)data[i]=Math.random()*2-1;this.ambience();}if(this.ctx.state==='suspended')this.ctx.resume().catch(()=>{});}catch{this.ctx=null;}
 }
 setEnabled(value){this.enabled=value;if(value)this.unlock();if(this.ctx&&this.master)this.master.gain.setTargetAtTime(value?.55:0,this.ctx.currentTime,.08);}
 ambience(){const ctx=this.ctx,noise=ctx.createBufferSource(),filter=ctx.createBiquadFilter(),gain=ctx.createGain();noise.buffer=this.noiseBuffer;noise.loop=true;filter.type='lowpass';filter.frequency.value=340;gain.gain.value=.045;noise.connect(filter);filter.connect(gain);gain.connect(this.master);noise.start();}
 noise(duration,volume,frequency,q=.7){if(!this.enabled||!this.ctx)return;const ctx=this.ctx,n=ctx.createBufferSource(),filter=ctx.createBiquadFilter(),g=ctx.createGain(),t=ctx.currentTime;n.buffer=this.noiseBuffer;filter.type='bandpass';filter.frequency.value=frequency;filter.Q.value=q;g.gain.setValueAtTime(.001,t);g.gain.exponentialRampToValueAtTime(Math.max(.002,volume),t+.012);g.gain.exponentialRampToValueAtTime(.001,t+duration);n.connect(filter);filter.connect(g);g.connect(this.master);n.start(t,Math.random());n.stop(t+duration);}
 ping(freq,duration,volume=.08,delay=0){if(!this.enabled||!this.ctx)return;const ctx=this.ctx,o=ctx.createOscillator(),g=ctx.createGain(),t=ctx.currentTime+delay;o.type='sine';o.frequency.setValueAtTime(freq,t);o.frequency.exponentialRampToValueAtTime(freq*.96,t+duration);g.gain.setValueAtTime(volume,t);g.gain.exponentialRampToValueAtTime(.001,t+duration);o.connect(g);g.connect(this.master);o.start(t);o.stop(t+duration);}
 event(e){if(!this.enabled||!this.ctx)return;
  switch(e.type){
   case'step':if(e.speed>25&&this.ctx.currentTime-this.lastStep>.075){this.noise(.09,.10,280);this.lastStep=this.ctx.currentTime;}break;
   case'windup':this.noise(.18,.035,540);break;
   case'swing':this.noise(.25,.14,e.move==='low'?650:1050);break;
   case'clash':case'parry':case'perfectParry':this.noise(.09,.25,3200);this.ping(1840,.34,.12);this.ping(2780,.22,.055,.005);this.ping(3610,.12,.03,.01);break;
   case'hit':this.noise(.19,.4,340);this.ping(82,.19,.19);break;
   case'dash':this.noise(.2,.15,430);break;
   case'guardCancel':this.noise(.11,.06,900);break;
   case'fight':this.ping(380,.35,.05);this.ping(570,.24,.025,.08);break;
   case'result':this.ping(220,.8,.05);this.ping(e.result.winner===0?330:260,.8,.035,.12);break;
  }
 }
}
