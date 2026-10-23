// Authored state, independent of rendering. All clocks advance only during play.
export class Story{
  constructor(){this.reset();}
  reset(){
    this.stage=0;this.laps=0;this.firstSeen=0;this.secondSeen=0;this.returnSeen=0;
    this.armed=false;this.frozen=false;this.encounter=false;this.crossing=false;
    this.drawerOpen=false;this.keyAvailable=false;this.hasKey=false;this.hasNote=false;this.doorOpen=false;this.ended=false;
  }
  observe(dt,looking,near){
    const events=[];
    if(this.stage===0&&looking)this.firstSeen+=dt;
    if(this.stage===1&&!this.frozen){
      if(looking)this.secondSeen+=dt;
      if(this.secondSeen>=1.6)this.armed=true;
      if(this.armed&&!looking&&near){this.frozen=true;events.push('held');}
    }
    if(this.frozen&&looking&&!this.encounter){
      this.returnSeen+=dt;
      if(this.returnSeen>=1){this.encounter=true;this.keyAvailable=true;events.push('returned');}
    }
    return events;
  }
  traverse(x,z){
    // A complete trip around the partition is required, in either direction.
    // Returning north cannot farm a transition at the southern threshold.
    if(x>2.2&&z<0)this.crossing=true;
    if(!this.crossing||x<2.2||z<3.7)return null;
    this.crossing=false;this.laps++;
    if(this.stage===0&&this.firstSeen>=1){this.stage=1;return 'second-pass';}
    if(this.stage===1&&this.encounter){this.stage=2;return 'third-pass';}
    return this.stage===0?'missed-mirror':this.stage===1&&!this.encounter?'return-mirror':null;
  }
  interact(id){
    if(id==='note'){if(this.hasNote)return null;this.hasNote=true;return 'note';}
    if(id==='mirror')return this.encounter?'mirror-held':this.stage===0?'mirror-first':'mirror-late';
    if(id==='drawer'){
      if(!this.drawerOpen){this.drawerOpen=true;return 'drawer-open';}
      if(this.keyAvailable&&!this.hasKey){this.hasKey=true;return 'key';}
      this.drawerOpen=false;return 'drawer-close';
    }
    if(id==='door'){
      if(this.doorOpen)return null;
      if(!this.hasKey)return 'locked';
      this.doorOpen=true;return 'unlocked';
    }
    return null;
  }
}
export const VOICES={
  arrival:{speaker:'YOU',text:'I know this house. I just don’t remember the way in.'},
  repeat:{speaker:'YOU',text:'That picture. It was the other way up.'},
  late:{speaker:'YOU',text:'Did I move first?'},
  returned:{speaker:'THE GLASS',text:'You can stop now. I remember how to be you.'},
  key:{speaker:'YOU',text:'It’s warm.'},
  unlocked:{speaker:'THE GLASS',text:'You always needed someone to open the door.'},
  ending:{speaker:'THE GLASS',text:'Stay there. It’s my turn.'},
};
