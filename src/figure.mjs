import * as T from 'three';
export function createFigure(house,layer=1){
 const body=new T.Group(),head=new T.Group(),arms=[],legs=[];
 const skin=new T.MeshStandardMaterial({color:0x9c9485,roughness:.77}),hair=new T.MeshStandardMaterial({color:0x1b1b18,roughness:1}),shirt=house.surfaces.material('linen',1.8,2.7,0x46534c),trousers=house.surfaces.material('linen',2,3,0x292f2b);
 function mesh(geometry,material,parent,x=0,y=0,z=0){const o=new T.Mesh(geometry,material);o.position.set(x,y,z);o.castShadow=true;parent.add(o);return o;}
 function ellipsoid(rx,ry,rz,x,y,z,material,parent=body){const o=mesh(new T.SphereGeometry(1,28,20),material,parent,x,y,z);o.scale.set(rx,ry,rz);return o;}
 const torso=mesh(new T.LatheGeometry([[.16,.78],[.2,.82],[.205,1.03],[.225,1.29],[.19,1.39],[.075,1.43]].map(p=>new T.Vector2(...p)),32),shirt,body);torso.scale.z=.64;
 ellipsoid(.19,.1,.125,0,.8,0,trousers);mesh(new T.CylinderGeometry(.061,.075,.14,24),skin,body,0,1.43,0);
 for(const side of[-1,1]){
  const arm=new T.Group();arm.position.set(side*.225,1.32,0);body.add(arm);arms.push(arm);
  const upper=mesh(new T.CapsuleGeometry(.066,.2,8,16),shirt,arm,side*.02,-.12,0);upper.rotation.z=side*.08;
  const lower=mesh(new T.CapsuleGeometry(.052,.2,8,16),shirt,arm,side*.035,-.39,-.025);lower.rotation.x=-.07;
  ellipsoid(.045,.073,.021,side*.04,-.59,-.03,skin,arm);
  for(let f=0;f<4;f++){const finger=mesh(new T.CapsuleGeometry(.0085,.06+(f===1?.015:0),4,8),skin,arm,side*.011+f*.018*side,-.67,-.03);finger.rotation.x=-.09;}
  const thumb=mesh(new T.CapsuleGeometry(.011,.045,4,8),skin,arm,-side*.007,-.61,-.04);thumb.rotation.z=side*.4;
  const leg=new T.Group();leg.position.set(side*.102,.77,0);body.add(leg);legs.push(leg);mesh(new T.CapsuleGeometry(.078,.23,8,16),trousers,leg,0,-.2,0);mesh(new T.CapsuleGeometry(.065,.23,8,16),trousers,leg,0,-.54,.01);ellipsoid(.078,.065,.15,0,-.704,-.055,house.black,leg);
 }
 head.position.y=1.61;body.add(head);
 ellipsoid(.139,.195,.15,0,0,0,skin,head);ellipsoid(.105,.09,.106,0,-.101,-.018,skin,head);
 const cap=mesh(new T.SphereGeometry(.146,32,18,0,Math.PI*2,0,Math.PI*.5),hair,head,0,.005,.012);cap.scale.set(1,1.34,1.04);
 ellipsoid(.112,.135,.05,0,.015,.12,hair,head);
 for(const side of[-1,1]){
  ellipsoid(.025,.045,.017,side*.14,-.005,0,skin,head);
  const socket=ellipsoid(.029,.014,.01,side*.052,.007,-.138,hair,head);
  ellipsoid(.014,.0065,.006,side*.052,.007,-.147,house.black,head);
  const brow=ellipsoid(.032,.006,.012,side*.052,.035,-.135,hair,head);brow.rotation.z=side*-.06;
 }
 ellipsoid(.018,.042,.029,0,-.026,-.149,skin,head);ellipsoid(.022,.016,.026,0,-.055,-.16,skin,head);
 ellipsoid(.035,.004,.005,0,-.094,-.128,hair,head);
 body.traverse(o=>o.layers.set(layer));
 function animate(time,speed=0,frozen=false){const walking=frozen?0:Math.min(speed/2,1);const phase=time*7.1;arms.forEach((arm,i)=>{arm.rotation.x=Math.sin(phase+i*Math.PI)*.15*walking;arm.rotation.z=(i===0?-.045:.045)+Math.sin(time*.6)*.004;});legs.forEach((leg,i)=>leg.rotation.x=Math.sin(phase+(i+1)*Math.PI)*.14*walking);torso.scale.x=1+(frozen?0:Math.sin(time*1.1)*.006);}
 return{body,head,arms,legs,animate};
}
