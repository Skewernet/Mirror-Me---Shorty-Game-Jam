import * as T from 'three';
import {writingTexture,rainTexture} from './surfaces.mjs';
export function furnish(b,m){
 const{box,cylinder,sphere,tube,lathe,group,target,contact,scene}=b;
 const animated=[],roomGroups={};
 const paper=(lines,font=24,mirrored=false)=>new T.MeshStandardMaterial({map:writingTexture(lines,{font,mirrored}),roughness:1,side:T.DoubleSide});
 function slab(w,h,d,x,y,z,mat,parent,round=.035){return box(w,h,d,x,y,z,mat,false,parent,round);}
 function table(x,z,w=1.15,d=.7,h=.76,parent=scene){const g=group(x,0,z,0,parent);slab(w,.08,d,0,h,0,m.wood,g);for(const sx of[-1,1])for(const sz of[-1,1])cylinder(.025,.04,h,sx*(w/2-.08),h/2,sz*(d/2-.08),m.wood,g);b.solid(box(w,h,d,0,h/2,0,m.invisible,false,g));contact(w*1.4,d*1.5,x,z,.8,parent);return g;}
 function lamp(x,y,z,parent=scene){const g=group(x,y,z,0,parent);lathe([[0,0],[.14,.02],[.15,.05],[.08,.1],[.065,.24],[.02,.29]],0,0,0,m.ceramic,g);cylinder(.012,.012,.18,0,.35,0,m.brass,g);lathe([[.24,0],[.23,.025],[.12,.31],[.115,.32]],0,.35,0,m.shade,g);sphere(.035,.05,.035,0,.42,0,m.bulb,g);return g;}
 function chair(x,z,rotation,parent=scene){const g=group(x,0,z,rotation,parent);slab(.46,.09,.48,0,.48,0,m.wood,g);for(const sx of[-1,1])for(const sz of[-1,1])cylinder(.022,.028,.46,sx*.19,.23,sz*.19,m.wood,g);for(const sx of[-1,1])cylinder(.025,.025,.55,sx*.2,.78,.2,m.wood,g);for(let i=-1;i<=1;i++)cylinder(.012,.012,.4,i*.1,.8,.2,m.wood,g);slab(.46,.08,.06,0,1.02,.2,m.wood,g,.02);b.solid(box(.48,.8,.52,0,.4,0,m.invisible,false,g));return g;}
 function window(x,y,z,rotation,parent=scene,w=1.6,h=1.45){
  const g=group(x,y,z,rotation,parent);box(w+.15,h+.18,.08,0,0,0,m.wood,false,g);const glass=new T.MeshBasicMaterial({map:rainTexture(),color:0x6e858c});box(w,h,.035,0,0,.055,glass,false,g);for(const sx of[-1,0,1])box(.035,h,.08,sx*w/2,0,.09,m.windowTrim,false,g);for(const sy of[-1,0,1])box(w,.04,.08,0,sy*h/2,.09,m.windowTrim,false,g);box(w+.28,.065,.26,0,-h/2-.06,.12,m.windowTrim,false,g);
  const rail=cylinder(.015,.015,w+.6,0,h/2+.17,.15,m.brass,g);rail.rotation.z=Math.PI/2;
  for(const side of[-1,1]){
   const geometry=new T.PlaneGeometry(w*.33,h+.36,12,18),a=geometry.attributes.position;
   for(let i=0;i<a.count;i++)a.setZ(i,Math.sin(a.getX(i)*45)*.035+.025*Math.cos(a.getY(i)*3));geometry.computeVertexNormals();
   const mesh=new T.Mesh(geometry,m.curtain);mesh.position.set(side*w*.43,-.04,.2);g.add(mesh);animated.push({type:'curtain',mesh,side});
  }
  return g;
 }
 function frame(x,y,z,rotation,map,parent=scene,w=.65,h=.82){const g=group(x,y,z,rotation,parent);box(w+.14,h+.14,.07,0,0,0,m.wood,false,g);box(w+.04,h+.04,.025,0,0,.05,m.brass,false,g);const face=box(w,h,.01,0,0,.067,new T.MeshStandardMaterial({map,roughness:.82}),false,g);return{group:g,face};}
 // Sitting room: soft furniture, old CRT, phone, family photograph.
 const lounge=group();roomGroups.lounge=lounge;
 const sofa=group(-5.75,0,6.85,0,lounge);
 for(const sx of[-1,1])for(const sz of[-1,1])cylinder(.05,.035,.18,sx*1.0,.09,sz*.38,m.wood,sofa);
 slab(2.38,.3,.96,0,.29,0,m.fabric,sofa,.12);slab(2.4,.75,.24,0,.79,.4,m.fabric,sofa,.1);
 for(const sx of[-1,1]){slab(.25,.57,1.0,sx*1.16,.56,0,m.fabric,sofa,.11);const pillow=slab(.75,.3,.6,sx*.55,.6,-.06,m.fabric,sofa,.14);pillow.rotation.x=.06;}
 b.solid(box(2.65,.95,1.15,0,.48,.05,m.invisible,false,sofa));contact(3.2,1.6,-5.75,6.85,.85,lounge);
 const coffee=table(-5.7,4.7,1.7,.88,.42,lounge);slab(.37,.035,.26,-.4,.48,.06,m.paper,coffee,.01);cylinder(.09,.08,.1,.4,.51,.12,m.ceramic,coffee);cylinder(.03,.03,.06,-.06,.49,-.1,m.rust,coffee);
 const tvStand=table(-5.7,2.35,1.42,.6,.56,lounge);slab(.95,.64,.48,0,.95,0,m.tvBody,tvStand,.065);
 const screenCanvas=document.createElement('canvas');screenCanvas.width=128;screenCanvas.height=96;const screenCtx=screenCanvas.getContext('2d'),screenMap=new T.CanvasTexture(screenCanvas);
 const tvScreen=box(.71,.48,.025,-.07,.98,.255,new T.MeshBasicMaterial({map:screenMap,color:0x6b7973}),false,tvStand,.07);for(let i=0;i<2;i++){const o=cylinder(.035,.035,.03,.38,.87+i*.19,.27,m.black,tvStand);o.rotation.x=Math.PI/2;}
 tube([[-.2,1.3,0],[-.35,1.55,0],[-.6,1.72,0]],.008,m.steel,tvStand);tube([[.15,1.3,0],[.3,1.55,0],[.6,1.7,0]],.008,m.steel,tvStand);
 const phoneTable=table(-3.0,6.75,1.1,.68,.78,lounge),phone=group(0,.84,0,0,phoneTable);
 const phoneTarget=slab(.39,.12,.3,0,0,0,m.black,phone,.035);target('radio',phoneTarget,'LISTEN TO TELEPHONE',2.3,phone);
 const dial=new T.Mesh(new T.TorusGeometry(.07,.013,8,32),m.brass);dial.rotation.x=-Math.PI/2;dial.position.set(0,.075,-.02);phone.add(dial);
 for(let i=0;i<10;i++){const a=i/10*Math.PI*2;cylinder(.009,.009,.014,Math.cos(a)*.052,.084,Math.sin(a)*.052-.02,m.black,phone,8);}
 tube([[-.17,.14,.08],[-.15,.17,.08],[0,.2,.08],[.15,.17,.08],[.17,.14,.08]],.035,m.black,phone);
 const cord=[];for(let i=0;i<100;i++){const a=i*.65;cord.push([.18+Math.sin(a)*.015,.11-i*.0065,.1+Math.cos(a)*.015]);}tube(cord,.004,m.black,phone);
 const family=frame(-3.23,1.09,6.55,Math.PI,m.photos[0],lounge,.28,.32);target('photo',family.face,'EXAMINE FAMILY PHOTOGRAPH',2,family.group);
 lamp(-2.8,.83,6.8,lounge);window(-7.95,1.73,5.1,Math.PI/2,lounge,1.8,1.45);
 const bookcase=group(-2.25,0,2.3,0,lounge);box(.65,1.9,.3,0,.95,0,m.wood,false,bookcase);for(let row=0;row<4;row++){box(.64,.035,.34,0,.16+row*.45,.02,m.wood,false,bookcase);for(let j=0;j<7;j++){const book=box(.055,.2+(j%3)*.035,.18,-.25+j*.074,.29+row*.45,.08,[m.book,m.fabric,m.linen][j%3],false,bookcase);book.rotation.z=(j%3-1)*.035;}}
 // Kitchen: cabinetry with proper edge gaps, stainless basin, crockery.
 const kitchen=group();roomGroups.kitchen=kitchen;
 for(const z of[-3.25,-2.35,-.15,.75,1.65]){
  const cabinet=group(11.1,0,z,-Math.PI/2,kitchen);box(.83,.85,.65,0,.44,0,m.cabinet,false,cabinet,.02);box(.79,.7,.035,0,.45,.35,m.cabinetFront,false,cabinet,.012);box(.16,.025,.06,0,.7,.4,m.steel,false,cabinet);box(.94,.07,.78,0,.91,0,m.counter,false,cabinet,.025);
  b.solid(box(.93,.95,.82,0,.47,0,m.invisible,false,cabinet));
 }
 const sink=lathe([[0,-.22],[.14,-.21],[.29,-.1],[.35,0],[.39,.025]],10.95,.95,-1.3,m.steel,kitchen);sink.scale.set(.8,1,1.05);
 cylinder(.07,.07,.009,10.95,.74,-1.3,m.black,kitchen);
 tube([[11.32,.94,-1.3],[11.32,1.25,-1.3],[11.13,1.37,-1.3],[10.99,1.3,-1.3],[10.99,1.15,-1.3]],.021,m.steel,kitchen);
 for(const z of[-1.75,-.85])box(.2,.07,.2,11.15,.91,z,m.counter,false,kitchen);
 const fuseGroup=group(10.84,.975,-2.2,0,kitchen);const fuse=cylinder(.022,.022,.12,0,0,0,m.ceramic,fuseGroup);fuse.rotation.z=Math.PI/2;for(const x of[-.06,.06]){const cap=cylinder(.024,.024,.02,x,0,0,m.brass,fuseGroup);cap.rotation.z=Math.PI/2;}
 const fuseTarget=box(.22,.1,.2,0,.03,0,m.invisible,false,fuseGroup);target('fuse',fuseTarget,'TAKE CERAMIC FUSE',2.25,fuseGroup);
 const fridge=group(10.85,0,2.8,-Math.PI/2,kitchen);box(.85,1.8,.75,0,.91,0,m.enamel,false,fridge,.055);box(.8,1.2,.045,0,1.16,.39,m.enamel,false,fridge,.025);box(.8,.45,.045,0,.31,.39,m.enamel,false,fridge,.025);box(.035,.37,.08,-.31,1.24,.45,m.black,false,fridge,.012);b.solid(box(.9,1.8,.88,0,.9,0,m.invisible,false,fridge));
 box(.36,.4,.006,.08,1.22,.425,paper(['SPARES','BY THE SINK'],42),false,fridge);
 const dining=table(8.15,1.6,1.25,1.05,.76,kitchen);chair(7.3,1.6,Math.PI/2,kitchen);chair(8.95,1.6,-Math.PI/2,kitchen);
 for(const x of[-.35,.35]){cylinder(.17,.17,.018,x,.813,0,m.ceramic,dining);cylinder(.065,.05,.12,x,.87,-.28,m.ceramic,dining);}
 window(11.64,1.83,-1.3,-Math.PI/2,kitchen,1.75,1.25);
 // Bathroom: curved tub, wet ceramic, sink, obscured glass with mirrored writing.
 const bathroom=group();roomGroups.bathroom=bathroom;
 const tub=lathe([[0,.12],[.25,.12],[.48,.2],[.62,.5],[.66,.6],[.63,.66],[.57,.64],[.51,.49],[.35,.24],[0,.23]],-6.1,0,-6.0,m.ceramic,bathroom);tub.scale.z=2.05;b.solid(box(1.35,.65,2.8,-6.1,.33,-6,m.invisible,false,bathroom));
 const water=new T.Mesh(new T.CircleGeometry(.5,48),m.water);water.rotation.x=-Math.PI/2;water.scale.y=2.05;water.position.set(-6.1,.38,-6);bathroom.add(water);
 tube([[-6.1,.55,-7.2],[-6.1,.92,-7.2],[-6.1,.99,-6.99]],.024,m.steel,bathroom);
 const curtainGeometry=new T.PlaneGeometry(2.5,1.95,30,24),ca=curtainGeometry.attributes.position;for(let i=0;i<ca.count;i++)ca.setZ(i,Math.sin(ca.getX(i)*26)*.045);curtainGeometry.computeVertexNormals();
 const curtain=new T.Mesh(curtainGeometry,m.curtain);curtain.position.set(-5.24,1.5,-6.9);curtain.rotation.y=Math.PI/2;bathroom.add(curtain);
 tube([[-5.25,2.55,-8.3],[-5.25,2.55,-4.6]],.015,m.steel,bathroom);
 b.solid(box(.75,1.0,.6,-3.5,.5,-8.9,m.invisible,false,bathroom));
 const basin=lathe([[0,-.12],[.14,-.1],[.27,0],[.36,.12],[.35,.18],[.31,.2],[.25,.12],[0,.07]],-3.5,.83,-8.85,m.ceramic,bathroom);basin.scale.z=.8;
 lathe([[.12,0],[.1,.3],[.08,.6],[.12,.74]],-3.5,0,-8.85,m.ceramic,bathroom);
 const tap=tube([[-3.5,.98,-9.02],[-3.5,1.19,-9.02],[-3.5,1.2,-8.87]],.018,m.steel,bathroom);target('tap',tap,'INSPECT RUNNING TAP',2.1);
 const tapTarget=box(.35,.27,.28,-3.5,1.11,-8.96,m.invisible,false,bathroom);target('tap',tapTarget,'INSPECT RUNNING TAP',2.1);
 const bathroomGlass=box(1.1,.96,.03,-3.5,1.92,-9.34,m.foggedGlass,false,bathroom,.03);target('bath-clue',bathroomGlass,'WIPE THE FOGGED GLASS',2.15);
 const clue=box(.76,.33,.005,-3.5,1.97,-9.31,new T.MeshBasicMaterial({map:writingTexture(['03:17'],{background:'#858e88',color:'#3c423b',font:96,mirrored:true}),transparent:true,opacity:.6}),false,bathroom);clue.visible=false;
 lathe([[.14,0],[.11,.2],[.24,.37],[.25,.43],[.2,.47]],-6.1,0,-8.65,m.ceramic,bathroom);const seat=new T.Mesh(new T.TorusGeometry(.23,.035,10,32),m.ceramic);seat.rotation.x=Math.PI/2;seat.scale.y=1.25;seat.position.set(-6.1,.47,-8.65);bathroom.add(seat);box(.5,.6,.23,-6.1,.76,-9.1,m.ceramic,false,bathroom,.07);
 const towelRail=tube([[-2.05,1.35,-7.4],[-2.18,1.35,-7.4],[-2.18,1.35,-8.1],[-2.05,1.35,-8.1]],.015,m.steel,bathroom);box(.04,.65,.5,-2.2,1.05,-7.7,m.linen,false,bathroom,.015);
 // Bedroom: creased bedding, diary, music box, wardrobe shadow.
 const bedroom=group();roomGroups.bedroom=bedroom;
 const bed=group(9.5,0,6.8,0,bedroom);box(1.85,.3,2.35,0,.28,0,m.wood,false,bed,.05);box(1.78,.23,2.27,0,.55,0,m.linen,false,bed,.1);box(1.96,1.15,.12,0,.65,1.15,m.wood,false,bed,.05);
 for(const x of[-.47,.47]){const pillow=slab(.7,.17,.46,x,.74,.72,m.linen,bed,.08);pillow.rotation.y=x*.14;}
 const quiltGeo=new T.PlaneGeometry(2.04,1.9,32,32),qa=quiltGeo.attributes.position;for(let i=0;i<qa.count;i++){const x=qa.getX(i),y=qa.getY(i);qa.setZ(i,.015*Math.sin(x*35+y*7)+.024*Math.sin(y*12)+.025*Math.cos(x*18));}quiltGeo.computeVertexNormals();const quilt=new T.Mesh(quiltGeo,m.blanket);quilt.rotation.x=-Math.PI/2;quilt.position.set(0,.705,-.24);bed.add(quilt);b.solid(box(1.98,.85,2.4,0,.4,0,m.invisible,false,bed));contact(2.8,3.3,9.5,6.8,.85,bedroom);
 const nightstand=table(7.95,7.5,.65,.6,.69,bedroom);lamp(7.95,.75,7.5,bedroom);const diary=box(.34,.028,.26,7.84,.755,7.2,paper(['I REMEMBER','RADIO','WATER','A LULLABY'],32),false,bedroom,.012);diary.rotation.y=-.15;target('diary',diary,'READ BEDSIDE DIARY',2.15);
 const musicTable=table(10.65,4.3,1.15,.55,.7,bedroom),music=group(0,.8,0,0,musicTable);const musicBase=box(.36,.15,.25,0,0,0,m.wood,false,music,.025);target('musicbox',musicBase,'LISTEN TO MUSIC BOX',2.1,music);const musicLid=group(-.18,.08,0,0,music);box(.36,.025,.25,.18,0,0,m.wood,false,musicLid,.01);musicLid.rotation.z=.55;cylinder(.035,.035,.1,0,.13,0,m.brass,music);sphere(.025,.025,.025,0,.21,0,m.ceramic,music);
 const wardrobe=group(6.25,0,7.7,0,bedroom);box(1.1,2.2,.65,0,1.1,0,m.wood,false,wardrobe,.025);box(.98,2.03,.02,0,1.1,-.35,m.black,false,wardrobe);const wardrobeDoor=group(-.52,0,-.36,-.45,wardrobe);box(.49,2.08,.035,.245,1.1,0,m.wood,false,wardrobeDoor,.015);b.solid(box(1.18,2.25,.9,0,1.1,0,m.invisible,false,wardrobe));
 window(11.64,1.82,5.4,-Math.PI/2,bedroom,1.5,1.5);
 // Utility room: fuse board, conduit, laundry and storage.
 const utility=group();roomGroups.utility=utility;
 const panelGroup=group(11.6,1.52,-6.9,-Math.PI/2,utility);const panel=box(.62,.8,.12,0,0,0,m.rust,false,panelGroup,.025);target('panel',panel,'INSPECT FUSE BOX',2.2,panelGroup);box(.51,.66,.025,0,0,.075,m.black,false,panelGroup);
 for(let row=0;row<3;row++)for(let col=0;col<2;col++){box(.15,.12,.04,-.14+col*.28,.2-row*.2,.105,m.enamel,false,panelGroup,.01);box(.04,.06,.055,-.14+col*.28,.2-row*.2,.13,m.black,false,panelGroup);}
 const fuseGlow=sphere(.018,.018,.008,.22,-.31,.155,m.redBulb,panelGroup);
 tube([[11.62,1.93,-6.9],[11.62,2.65,-6.9],[9,2.65,-6.9],[9,2.65,-9.3]],.015,m.steel,utility);
 box(.9,1.0,.85,10.9,.51,-8.7,m.enamel,false,utility,.045);const machineDoor=new T.Mesh(new T.TorusGeometry(.28,.05,12,32),m.steel);machineDoor.position.set(10.9,.49,-8.25);utility.add(machineDoor);const machineGlass=new T.Mesh(new T.CircleGeometry(.235,32),m.foggedGlass);machineGlass.position.set(10.9,.49,-8.24);utility.add(machineGlass);b.solid(box(.95,1.0,.95,10.9,.5,-8.7,m.invisible,false,utility));
 const shelf=group(7,0,-9.05,0,utility);for(const x of[-.8,.8])box(.05,2.3,.45,x,1.15,0,m.steel,false,shelf);for(let row=0;row<4;row++){box(1.75,.04,.5,0,.25+row*.55,0,m.wood,false,shelf);for(let col=0;col<3;col++)box(.34,.3,.35,-.55+col*.54,.42+row*.55,0,[m.paper,m.rust,m.cabinet][col],false,shelf,.015);}
 function animate(time,state){
  const frameNumber=Math.floor(time*8);if(frameNumber!==animate.lastFrame){animate.lastFrame=frameNumber;const im=screenCtx.createImageData(128,96);for(let i=0;i<im.data.length;i+=4){const v=(Math.random()*35+12)*(state.stage>=3?.15:1);im.data[i]=v*.8;im.data[i+1]=v;im.data[i+2]=v*.95;im.data[i+3]=255;}screenCtx.putImageData(im,0,0);screenMap.needsUpdate=true;}
  for(const a of animated)a.mesh.rotation.y=Math.sin(time*.4+a.side)*.016;
  family.face.material.map=m.photos[state.stage>=2?1:0];clue.visible=state.stage>=2;fuseGroup.visible=!state.hasFuse&&!state.power;
  fuseGlow.material=state.power?m.greenBulb:m.redBulb;
  musicLid.rotation.z=state.stage===3&&state.echoIndex>=1?0:.55+Math.sin(time*1.1)*.015;
  water.material.opacity=.55+Math.sin(time*.4)*.025;
  return{screen:tvScreen};
 }
 return{roomGroups,animated,animate,window,frame,lamp,table,family,diary,fuse: fuseTarget,panel,musicBase,tap,clue};
}
