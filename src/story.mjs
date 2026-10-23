import {ECHO_ORDER,CLOCK_SOLUTION} from './layout.mjs';
export class Story{
  constructor(){this.reset();}
  reset(){
    this.stage=0;this.laps=0;this.firstSeen=0;this.secondSeen=0;this.returnSeen=0;this.armed=false;this.frozen=false;this.encounter=false;this.crossing=false;
    this.drawerOpen=false;this.keyAvailable=false;this.hasKey=false;this.hasNote=false;this.hasFuse=false;this.power=false;this.heardArrival=false;this.hasDiary=false;this.hasTimeClue=false;this.clockHour=12;this.clockMinute=0;this.clockSolved=false;this.heardCall=false;this.echoIndex=0;this.finalFaced=false;this.finalDistance=0;this.finalAway=0;this.exitReleased=false;this.doorOpen=false;this.ended=false;
    this.doors={lounge:false,bathroom:false,kitchen:false,bedroom:false,utility:false};this.visited=[];this.events=[];
  }
  visit(room){if(room!=='hall'&&!this.visited.includes(room)){this.visited.push(room);return'enter-'+room;}return null;}
  observe(dt,looking,near,distance=10,moving=false){
    const events=[];
    if(this.stage===0&&looking)this.firstSeen+=dt;
    if(this.stage===1&&!this.frozen){if(looking)this.secondSeen+=dt;if(this.secondSeen>=2.1)this.armed=true;if(this.armed&&!looking&&near){this.frozen=true;events.push('held');}}
    if(this.frozen&&this.stage===1&&looking&&!this.encounter){this.returnSeen+=dt;if(this.returnSeen>=1.3){this.encounter=true;this.keyAvailable=true;events.push('returned');}}
    if(this.stage===4){
      if(looking&&near){this.finalFaced=true;this.finalDistance=distance;this.finalAway=0;}
      if(this.finalFaced&&!looking&&moving&&distance>this.finalDistance+.8)this.finalAway+=dt;
      if(!this.exitReleased&&this.finalAway>=1.6){this.exitReleased=true;events.push('released');}
    }
    return events;
  }
  ready(){
    return [this.firstSeen>=1.3&&this.heardArrival&&this.power,this.encounter&&this.hasDiary,this.clockSolved&&this.heardCall,this.echoIndex===ECHO_ORDER.length,false][this.stage];
  }
  traverse(x,z){
    if(x>2.2&&z<-2)this.crossing=true;
    if(!this.crossing||x<2.2||z<6.2)return null;
    this.crossing=false;this.laps++;
    if(this.stage<4&&this.ready()){this.stage++;return'pass-'+this.stage;}
    return'incomplete-pass';
  }
  setClock(hour,minute){
    const h=Number(hour),m=Number(minute);if(!Number.isInteger(h)||!Number.isInteger(m)||h<1||h>12||m<0||m>59)return'invalid-time';
    this.clockHour=h%12;this.clockMinute=m;
    if(this.stage>=2&&this.hasTimeClue&&this.clockHour===CLOCK_SOLUTION.hour&&this.clockMinute===CLOCK_SOLUTION.minute){this.clockSolved=true;return'clock-solved';}
    return'clock-set';
  }
  interact(id){
    if(id.startsWith('room-')){const room=id.slice(5);if(!(room in this.doors))return null;if(room==='bedroom'&&!this.hasKey)return'bedroom-locked';this.doors[room]=!this.doors[room];return this.doors[room]?'room-open':'room-close';}
    if(id==='note'){if(this.hasNote)return null;this.hasNote=true;return'note';}
    if(id==='radio'){
      if(this.stage===3)return this.silence('radio');
      if(this.stage===2&&this.clockSolved){if(this.heardCall)return'radio-static';this.heardCall=true;return'call';}
      if(!this.heardArrival){this.heardArrival=true;return'arrival-recording';}return this.stage===2?'radio-time':'radio-static';
    }
    if(id==='fuse'){if(this.hasFuse||this.power)return null;this.hasFuse=true;return'fuse';}
    if(id==='panel'){if(this.power)return'panel-on';if(!this.hasFuse)return'panel-empty';this.hasFuse=false;this.power=true;return'power';}
    if(id==='mirror')return this.stage===4?'mirror-command':this.encounter?'mirror-held':this.stage===0?'mirror-first':'mirror-late';
    if(id==='drawer'){if(!this.drawerOpen){this.drawerOpen=true;return'drawer-open';}if(this.keyAvailable&&!this.hasKey){this.hasKey=true;return'key';}this.drawerOpen=false;return'drawer-close';}
    if(id==='diary'){if(!this.hasKey)return'bedroom-locked';if(this.hasDiary)return'diary-repeat';this.hasDiary=true;return'diary';}
    if(id==='bath-clue'){if(this.stage<2)return'bath-clouded';this.hasTimeClue=true;if(this.clockHour===3&&this.clockMinute===17)this.clockSolved=true;return'time-clue';}
    if(id==='clock')return'clock';
    if(id==='musicbox')return this.stage===3?this.silence('musicbox'):'musicbox';
    if(id==='tap')return this.stage===3?this.silence('tap'):'tap';
    if(id==='photo')return this.stage>=2?'photo-changed':'photo';
    if(id==='door'){if(this.doorOpen)return null;if(!this.exitReleased)return this.stage===4?'door-wait':'locked';this.doorOpen=true;return'unlocked';}
    return null;
  }
  silence(id){
    if(this.echoIndex===ECHO_ORDER.length)return'already-quiet';
    if(ECHO_ORDER.indexOf(id)<this.echoIndex)return'already-quiet';
    if(id===ECHO_ORDER[this.echoIndex]){this.echoIndex++;return this.echoIndex===ECHO_ORDER.length?'house-quiet':'echo-silenced';}
    this.echoIndex=0;return'wrong-order';
  }
  hint(){
    if(this.doorOpen)return'The front door is open.';
    if(this.stage===0){if(!this.heardArrival)return'A voice is coming from the sitting room.';if(!this.hasFuse&&!this.power)return'The kitchen light is dead. Look for a spare fuse.';if(!this.power)return'The fuse box is in the utility room.';if(this.firstSeen<1.3)return'There is a mirror in the main hallway.';return'Follow the passage around the house.';}
    if(this.stage===1){if(!this.encounter)return'The glass is late. Watch it, then turn away.';if(!this.hasKey)return'Something fell into the hall drawer.';if(!this.hasDiary)return'The small key fits the bedroom.';return'The hallway is waiting for another pass.';}
    if(this.stage===2){if(!this.hasTimeClue)return'The diary mentioned writing on the bathroom glass.';if(!this.clockSolved)return'Read the time backward. Set the hall clock.';if(!this.heardCall)return'The sitting room telephone is ringing.';return'Follow the return passage.';}
    if(this.stage===3)return this.echoIndex===3?'The house is quiet. Return through the passage.':'Three sounds. What came first must be last. The diary remembers.';
    return this.exitReleased?'Go back to the front door.':'Face the glass. When it calls you closer, leave.';
  }
}
export const VOICES={
 arrival:{speaker:'YOU',text:'I know this house. I just don’t remember the way in.'},
 recording:{speaker:'THE TELEPHONE',text:'If you are hearing this, leave the lights on. There is a spare fuse in the kitchen.'},
 power:{speaker:'YOU',text:'There. Now why does that feel worse?'},
 repeat:{speaker:'YOU',text:'That picture. It was the other way up.'},
 late:{speaker:'YOU',text:'Did I move first?'},
 returned:{speaker:'THE GLASS',text:'You can stop now. I remember how to be you.'},
 key:{speaker:'YOU',text:'The bedroom key. Someone has been holding it.'},
 diary:{speaker:'YOU',text:'Radio. Water. A lullaby. Every night, in that order.'},
 time:{speaker:'YOU',text:'It isn’t a time. It’s the reflection of one.'},
 call:{speaker:'THE TELEPHONE',text:'You were never the one making the sounds. Make them stop. Last sound first.'},
 inverted:{speaker:'YOU',text:'This is the same house. Why does everything feel like the other side?'},
 command:{speaker:'THE GLASS',text:'Come closer. Do exactly what I do.'},
 released:{speaker:'YOU',text:'No. You can stay there.'},
 unlocked:{speaker:'THE GLASS',text:'You always needed someone to open the door.'},
 ending:{speaker:'THE GLASS',text:'There. Stay where I used to be. It’s my turn.'},
};
