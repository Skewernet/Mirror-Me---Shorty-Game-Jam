import {VOICES} from './story.mjs';
export class Sound{
  constructor(onSubtitle){this.onSubtitle=onSubtitle;this.volume=.55;this.voiceEnabled=true;this.silent=false;this.lastStep=0;this.buffers=new Map();this.playingVoice=null;this.voiceTimer=null;this.voiceToken=0;this.paused=true;}
  async start(){
    if(!this.context){
      this.context=new (window.AudioContext||window.webkitAudioContext)();const c=this.context;
      this.master=c.createGain();this.master.gain.value=this.volume*.48;
      const compressor=c.createDynamicsCompressor();compressor.threshold.value=-12;compressor.ratio.value=5;this.master.connect(compressor);compressor.connect(c.destination);
      this.ambience=c.createGain();this.ambience.gain.value=.13;this.ambience.connect(this.master);
      for(const [freq,gain] of [[49,.11],[98,.025],[147,.01]]){const o=c.createOscillator(),g=c.createGain();o.frequency.value=freq;g.gain.value=gain;o.connect(g);g.connect(this.ambience);o.start();}
      const noise=c.createBuffer(1,c.sampleRate*3,c.sampleRate),data=noise.getChannelData(0);let last=0;
      for(let i=0;i<data.length;i++){last=(last+(Math.random()*2-1)*.03)/1.015;data[i]=last;}
      const air=c.createBufferSource(),filter=c.createBiquadFilter();filter.type='lowpass';filter.frequency.value=700;air.buffer=noise;air.loop=true;air.connect(filter);filter.connect(this.ambience);air.start();
    }
    this.paused=false;await this.context.resume();
  }
  setVolume(value){this.volume=value;if(this.master)this.master.gain.setTargetAtTime(value*.48,this.context.currentTime,.05);}
  setVoice(value){this.voiceEnabled=value;if(!value)this.stopVoice(false);}
  async pause(){this.paused=true;this.stopVoice();if(this.context?.state==='running')await this.context.suspend();}
  stopVoice(clear=true){this.voiceToken++;if(this.playingVoice){this.playingVoice.onended=null;try{this.playingVoice.stop();}catch{}this.playingVoice=null;}clearTimeout(this.voiceTimer);if(clear)this.onSubtitle('');}
  reset(){this.stopVoice();this.lastStep=0;this.silent=false;if(this.ambience)this.ambience.gain.value=.13;}
  impulse(frequency,gain,duration,pan=0){
    if(!this.context||this.paused)return;const c=this.context,t=c.currentTime,o=c.createOscillator(),g=c.createGain(),p=c.createStereoPanner();
    o.type='sine';o.frequency.setValueAtTime(frequency,t);o.frequency.exponentialRampToValueAtTime(frequency*.55,t+duration);g.gain.setValueAtTime(gain,t);g.gain.exponentialRampToValueAtTime(.0001,t+duration);p.pan.value=pan;o.connect(g);g.connect(p);p.connect(this.master);o.start();o.stop(t+duration);
  }
  step(distance,speed){if(distance<this.lastStep)this.lastStep=distance;if(speed>.15&&distance-this.lastStep>.82){this.lastStep=distance;this.impulse(105+Math.random()*20,.14,.1,(Math.floor(distance/.82)%2?.16:-.16));this.impulse(460,.014,.045);}}
  effect(id){
    if(id==='drawer-open'||id==='drawer-close'){this.impulse(180,.07,.45,.4);this.impulse(62,.13,.16,.4);}
    if(id==='key'){this.impulse(1720,.06,.3,.3);this.impulse(2440,.025,.4,.3);}
    if(id==='unlocked'){this.impulse(110,.2,.22);this.impulse(620,.04,.12);}
    if(id==='locked')this.impulse(95,.15,.15);
    if(id==='knock'){this.impulse(72,.22,.16,.75);setTimeout(()=>this.impulse(65,.13,.2,.75),360);}
  }
  update(frozen){if(this.ambience)this.ambience.gain.setTargetAtTime(frozen?.003:.13,this.context.currentTime,.7);}
  async voice(id){
    const line=VOICES[id];if(!line)return;
    this.stopVoice();const token=this.voiceToken;this.onSubtitle(`${line.speaker} — “${line.text}”`);
    const fallbackDuration=Math.max(3500,line.text.length*65);
    this.voiceTimer=setTimeout(()=>{if(token===this.voiceToken)this.onSubtitle('');},fallbackDuration);
    if(!this.voiceEnabled||!this.context||this.paused)return;
    try{
      if(!this.buffers.has(id)){const r=await fetch(`assets/voice/${id}.ogg`);if(!r.ok)throw Error(`voice ${id}: ${r.status}`);const buffer=await this.context.decodeAudioData(await r.arrayBuffer());this.buffers.set(id,buffer);}
      if(token!==this.voiceToken||this.paused)return;
      const source=this.context.createBufferSource(),g=this.context.createGain(),filter=this.context.createBiquadFilter();source.buffer=this.buffers.get(id);g.gain.value=.85;filter.type='lowpass';filter.frequency.value=line.speaker==='THE GLASS'?3100:6000;
      source.connect(filter);filter.connect(g);g.connect(this.master);this.playingVoice=source;
      clearTimeout(this.voiceTimer);this.voiceTimer=setTimeout(()=>{if(token===this.voiceToken)this.onSubtitle('');},source.buffer.duration*1000+850);
      source.onended=()=>{if(this.playingVoice===source)this.playingVoice=null;};source.start();
    }catch(error){console.warn('Voice unavailable; subtitles retained.',error.message);}
  }
}
