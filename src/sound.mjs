import {VOICES} from './story.mjs';
export class Sound{
 constructor(onSubtitle){this.onSubtitle=onSubtitle;this.volume=.55;this.voiceEnabled=true;this.lastStep=0;this.buffers=new Map();this.playingVoice=null;this.voiceTimer=null;this.voiceToken=0;this.paused=true;this.busy=false;this.currentVoice=null;this.resumeId=null;this.musicNext=0;this.dripNext=0;this.noteIndex=0;this.ringNext=0;}
 async start(){
  if(!this.context){
   const c=this.context=new(window.AudioContext||window.webkitAudioContext)();this.master=c.createGain();this.master.gain.value=this.volume*.55;const compressor=c.createDynamicsCompressor();compressor.threshold.value=-15;compressor.ratio.value=4;this.master.connect(compressor);compressor.connect(c.destination);
   this.ambience=c.createGain();this.ambience.gain.value=.13;this.ambience.connect(this.master);
   for(const[f,gain]of[[49,.09],[98,.017],[147,.006]]){const o=c.createOscillator(),g=c.createGain();o.frequency.value=f;g.gain.value=gain;o.connect(g);g.connect(this.ambience);o.start();}
   this.noise=c.createBuffer(1,c.sampleRate*3,c.sampleRate);const data=this.noise.getChannelData(0);let last=0;for(let i=0;i<data.length;i++){last=(last+(Math.random()*2-1)*.035)/1.02;data[i]=last;}
   const air=c.createBufferSource(),filter=c.createBiquadFilter();filter.type='lowpass';filter.frequency.value=600;air.buffer=this.noise;air.loop=true;air.connect(filter);filter.connect(this.ambience);air.start();
   this.radio=this.roomNoise(-3,1,6.75,500,.2);this.water=this.roomNoise(-3.5,1,-8.96,1600,.1);this.musicPanner=this.panner(10.65,.9,4.3);this.musicPanner.connect(this.master);
  }
  this.paused=false;await this.context.resume();if(this.resumeId){const id=this.resumeId;this.resumeId=null;this.voice(id);}
 }
 panner(x,y,z){const p=this.context.createPanner();p.panningModel='HRTF';p.distanceModel='inverse';p.refDistance=1.2;p.maxDistance=15;p.rolloffFactor=1.4;p.positionX.value=x;p.positionY.value=y;p.positionZ.value=z;return p;}
 roomNoise(x,y,z,frequency,gain){const c=this.context,source=c.createBufferSource(),filter=c.createBiquadFilter(),g=c.createGain(),p=this.panner(x,y,z);source.buffer=this.noise;source.loop=true;filter.type='bandpass';filter.frequency.value=frequency;filter.Q.value=1;g.gain.value=gain;source.connect(filter);filter.connect(g);g.connect(p);p.connect(this.master);source.start();g.panner=p;return g;}
 setVolume(value){this.volume=value;if(this.master)this.master.gain.setTargetAtTime(value*.55,this.context.currentTime,.05);}
 setVoice(value){this.voiceEnabled=value;if(!value&&this.playingVoice){this.playingVoice.onended=null;try{this.playingVoice.stop();}catch{}this.playingVoice=null;}}
 async pause(){this.paused=true;if(this.currentVoice)this.resumeId=this.currentVoice;this.stopVoice();if(this.context?.state==='running')await this.context.suspend();}
 stopVoice(clear=true){this.voiceToken++;this.busy=false;this.currentVoice=null;if(this.playingVoice){this.playingVoice.onended=null;try{this.playingVoice.stop();}catch{}this.playingVoice=null;}clearTimeout(this.voiceTimer);if(clear)this.onSubtitle('');}
 reset(){this.stopVoice();this.resumeId=null;this.lastStep=0;this.musicNext=this.dripNext=this.noteIndex=0;this.ringNext=0;if(this.ambience)this.ambience.gain.value=.13;}
 impulse(frequency,gain,duration,pan=0,destination=null){
  if(!this.context||this.paused)return;const c=this.context,t=c.currentTime,o=c.createOscillator(),g=c.createGain(),p=c.createStereoPanner();o.frequency.setValueAtTime(frequency,t);o.frequency.exponentialRampToValueAtTime(frequency*.72,t+duration);g.gain.setValueAtTime(gain,t);g.gain.exponentialRampToValueAtTime(.0001,t+duration);p.pan.value=pan;o.connect(g);g.connect(p);p.connect(destination||this.master);o.start();o.stop(t+duration);o.onended=()=>{o.disconnect();g.disconnect();p.disconnect();};
 }
 noiseBurst(duration,gain,frequency,pan=0){
  if(!this.context||this.paused)return;const c=this.context;if(!this.foleyNoise){this.foleyNoise=c.createBuffer(1,c.sampleRate,c.sampleRate);const d=this.foleyNoise.getChannelData(0);for(let i=0;i<d.length;i++)d[i]=Math.random()*2-1;}
  const t=c.currentTime,source=c.createBufferSource(),f=c.createBiquadFilter(),envelope=c.createGain(),stereo=c.createStereoPanner();source.buffer=this.foleyNoise;f.type='bandpass';f.frequency.value=frequency;f.Q.value=.8;envelope.gain.setValueAtTime(.0001,t);envelope.gain.exponentialRampToValueAtTime(gain,t+.01);envelope.gain.exponentialRampToValueAtTime(.0001,t+duration);stereo.pan.value=pan;source.connect(f);f.connect(envelope);envelope.connect(stereo);stereo.connect(this.master);source.start(t,Math.random()*.15);source.stop(t+duration);source.onended=()=>{source.disconnect();f.disconnect();envelope.disconnect();stereo.disconnect();};
 }
 step(distance,speed,carpet=true){if(distance<this.lastStep)this.lastStep=distance;if(speed>.15&&distance-this.lastStep>.8){this.lastStep=distance;this.impulse(92+Math.random()*17,.12,.12,Math.floor(distance/.8)%2?.08:-.08);this.noiseBurst(carpet?.18:.13,carpet?.023:.043,carpet?580:1100);}}
 effect(id){
  if(['drawer-open','drawer-close','door-wood'].includes(id)){this.noiseBurst(.52,.075,420,.35);this.impulse(58,.08,.16,.35);}
  if(id==='key'||id==='fuse'){this.noiseBurst(.04,.03,2400,.2);for(const f of[1700,2410,3180])this.impulse(f,.014,.3,.2);}
  if(id==='unlocked'){this.impulse(103,.12,.19);this.noiseBurst(.12,.085,1500);}
  if(id==='locked'||id==='bedroom-locked')this.noiseBurst(.12,.08,850);
  if(id==='knock'||id==='behind'){this.impulse(72,.15,.17,id==='behind'?-.8:.7);this.noiseBurst(.14,.08,480,.7);}
  if(id==='switch'||id==='power')this.noiseBurst(.06,id==='power'?.13:.04,1800);
  if(id==='clock-set'||id==='clock-solved')this.noiseBurst(.08,.04,1300);
  if(id==='glass'){for(const f of[480,760,1030])this.impulse(f,.028,1.1);}
  if(id==='echo-silenced'||id==='house-quiet')this.noiseBurst(.045,.028,750);
  if(id==='wrong-order')this.impulse(39,.07,1.0);
  if(id==='drip')this.impulse(850,.015,.15,0,this.musicPanner);
 }
 update(state,player){
  if(!this.context||this.paused)return;const c=this.context,t=c.currentTime,l=c.listener;
  if(l.positionX){l.positionX.value=player.x;l.positionY.value=1.64;l.positionZ.value=player.z;l.forwardX.value=-Math.sin(player.yaw);l.forwardY.value=0;l.forwardZ.value=-Math.cos(player.yaw);l.upX.value=0;l.upY.value=1;l.upZ.value=0;}
  const frozen=state.frozen||state.stage>=3;this.ambience.gain.setTargetAtTime(frozen?.006:.13,t,.8);
  const inverted=state.stage===3,echo=state.echoIndex||0;
  this.radio.gain.setTargetAtTime(inverted&&echo>=3?0:state.heardArrival?.075:.19,t,.15);
  this.water.gain.setTargetAtTime(inverted&&echo>=2?0:.11,t,.15);
  if(state.stage===2&&state.clockSolved&&!state.heardCall&&t>this.ringNext){this.ringNext=t+1.6;this.impulse(930,.12,.22,0,this.radio.panner);this.impulse(1130,.07,.24,0,this.radio.panner);}
  if(t>this.musicNext&&!(inverted&&echo>=1)&&state.stage>=1){this.musicNext=t+1.4;const notes=[659.25,783.99,587.33,523.25,659.25,440];this.impulse(notes[this.noteIndex++%notes.length],.045,.65,0,this.musicPanner);}
 }
 async voice(id){
  const line=VOICES[id];if(!line)return;this.stopVoice();this.busy=true;this.currentVoice=id;const token=this.voiceToken;this.onSubtitle(`${line.speaker} — “${line.text}”`);
  const done=()=>{if(token===this.voiceToken){this.onSubtitle('');this.busy=false;this.currentVoice=null;}};
  this.voiceTimer=setTimeout(done,Math.max(3500,line.text.length*65));
  if(!this.voiceEnabled||!this.context||this.paused)return;
  try{
   if(!this.buffers.has(id)){const r=await fetch(`assets/voice/${id}.ogg`);if(!r.ok)throw Error(`voice ${id}: ${r.status}`);this.buffers.set(id,await this.context.decodeAudioData(await r.arrayBuffer()));}
   if(token!==this.voiceToken||this.paused)return;const c=this.context,source=c.createBufferSource(),g=c.createGain(),filter=c.createBiquadFilter();source.buffer=this.buffers.get(id);g.gain.value=.95;filter.type='lowpass';filter.frequency.value=line.speaker==='THE GLASS'?3200:line.speaker==='THE TELEPHONE'?2300:6000;source.connect(filter);filter.connect(g);g.connect(this.master);this.playingVoice=source;clearTimeout(this.voiceTimer);this.voiceTimer=setTimeout(done,source.buffer.duration*1000+650);source.onended=()=>{if(this.playingVoice===source)this.playingVoice=null;source.disconnect();filter.disconnect();g.disconnect();};source.start();
  }catch(error){console.warn('Voice unavailable; subtitles retained.',error.message);}
 }
}
