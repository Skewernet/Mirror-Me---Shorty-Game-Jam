import * as T from 'three';
import {createSurfaces,paintingTexture,writingTexture} from './surfaces.mjs';
export function buildHouse(scene){
  const colliders=[],interactables=[],occluders=[],surfaces=createSurfaces();
  const wood=new T.MeshStandardMaterial({color:0x302c20,roughness:.85}),brass=new T.MeshStandardMaterial({color:0x9e8151,metalness:.65,roughness:.55}),black=new T.MeshStandardMaterial({color:0x161d19,roughness:.8}),cream=new T.MeshStandardMaterial({color:0xb7ad86,roughness:1});
  function box(w,h,d,x,y,z,material=wood,solid=false,parent=scene){const mesh=new T.Mesh(new T.BoxGeometry(w,h,d),material);mesh.position.set(x,y,z);parent.add(mesh);if(solid){colliders.push({minX:x-w/2,maxX:x+w/2,minZ:z-d/2,maxZ:z+d/2});occluders.push(mesh);}return mesh;}
  function cylinder(r1,r2,h,x,y,z,material=wood,parent=scene,segments=10){const o=new T.Mesh(new T.CylinderGeometry(r1,r2,h,segments),material);o.position.set(x,y,z);parent.add(o);return o;}
  function wall(w,d,x,z){
    box(w,3,d,x,1.5,z,surfaces.material('wallpaper',Math.max(w,d)*1.4,2.8),true);
    box(w+.025,.95,d+.025,x,.475,z,surfaces.material('panel',Math.max(w,d)*.85,1));
    for(const [y,h] of [[.09,.13],[.96,.065],[1.02,.025],[2.92,.12]])box(w+.05,h,d+.05,x,y,z,wood);
  }
  box(7,.15,15.2,1.75,-.08,0,surfaces.material('floor',5,9));
  box(7,.15,15.2,1.75,3.05,0,surfaces.material('ceiling',4,8));
  wall(.2,15.2,-1.75,0);wall(.2,15.2,5.25,0);wall(7.2,.2,1.75,-7.6);
  wall(1.1,.2,-1.2,7.6);wall(4.65,.2,2.975,7.6);
  wall(.2,8.4,1.75,0);
  box(1.12,.018,12.8,0,.01,0,surfaces.material('rug',1,7));
  box(.85,.016,8,3.5,.01,0,surfaces.material('rug',1,5,0x6a755f));
  // Front door and narrow exit space.
  const doorCollider={minX:-.65,maxX:.65,minZ:7.4,maxZ:7.75};colliders.push(doorCollider);
  const doorPivot=new T.Group();doorPivot.position.set(-.65,0,7.5);scene.add(doorPivot);
  const door=box(1.3,2.62,.12,.65,1.31,0,black,false,doorPivot);
  for(const x of [.3,1])for(const y of [.65,1.8]){box(.48,.88,.025,x,y,-.075,wood,false,doorPivot);box(.4,.8,.025,x,y,-.095,black,false,doorPivot);}
  const handle=cylinder(.05,.05,.12,1.1,1.08,-.15,brass,doorPivot);handle.rotation.x=Math.PI/2;
  box(.15,.035,.05,1.04,1.08,-.2,brass,false,doorPivot);
  for(const x of [-.72,.72])box(.12,2.76,.18,x,1.38,7.46,wood);
  box(1.55,.14,.18,0,2.75,7.46,wood);box(1.3,.4,.2,0,2.84,7.6,surfaces.material('wallpaper',2,.5));
  box(1.7,.15,3,0,-.08,9,surfaces.material('floor',1,2));wall(.2,3,-.85,9);wall(.2,3,.85,9);wall(1.9,.2,0,10.5);box(1.7,.15,3,0,3.05,9,black);
  const number=box(.32,.18,.02,0,2.02,7.42,new T.MeshStandardMaterial({map:writingTexture(['04'],{background:'#222a23',color:'#c1aa77',font:72}),roughness:.7}));
  // Console table: the drawers really move and the key sits inside.
  const consoleGroup=new T.Group();consoleGroup.position.set(1.26,0,1.05);scene.add(consoleGroup);
  const drawer=box(.62,.56,1.18,0,.62,0,wood,false,consoleGroup);
  for(const z of [-.47,.47])for(const x of [-.2,.2])box(.07,.4,.07,x,.2,z,black,false,consoleGroup);
  box(.72,.08,1.28,0,.94,0,black,false,consoleGroup);
  const drawerSlide=new T.Group();drawerSlide.position.set(-.32,.64,0);consoleGroup.add(drawerSlide);
  const drawerFace=box(.07,.3,1.05,0,0,0,wood,false,drawerSlide);
  box(.09,.045,.16,-.07,0,0,brass,false,drawerSlide);box(.47,.025,.94,.25,-.12,0,black,false,drawerSlide);
  colliders.push({minX:.6,maxX:1.62,minZ:.4,maxZ:1.7});
  const key=new T.Group();key.position.set(.18,-.08,0);drawerSlide.add(key);key.visible=false;
  const ring=new T.Mesh(new T.TorusGeometry(.055,.012,4,10),brass);ring.rotation.x=Math.PI/2;key.add(ring);box(.025,.022,.18,0,0,.1,brass,false,key);box(.07,.025,.025,.02,0,.18,brass,false,key);
  occluders.push(drawer);
  interactables.push({id:'drawer',mesh:drawer,label:'OPEN DRAWER',range:1.9});
  // A folded instruction; it is collected into the pocket.
  const note=box(.3,.008,.23,1.08,1,.78,new T.MeshStandardMaterial({map:writingTexture(['IF THE HALL','RETURNS,','WATCH THE GLASS.'],{font:22}),roughness:1}));note.rotation.y=.2;
  interactables.push({id:'note',mesh:note,label:'READ FOLDED NOTE',range:1.8});
  // Ceramic table lamp.
  cylinder(.11,.16,.16,1.29,1.06,1.37,cream);cylinder(.025,.025,.25,1.29,1.22,1.37,brass);
  cylinder(.16,.27,.3,1.29,1.46,1.37,new T.MeshStandardMaterial({color:0xb09b6f,emissive:0x8a572b,emissiveIntensity:.35}));
  const tableLight=new T.PointLight(0xffc077,5,4,2);tableLight.position.set(1.15,1.55,1.35);scene.add(tableLight);
  interactables.push({id:'door',mesh:door,label:'TRY FRONT DOOR',range:2.5});
  // Framed original landscape. The second pass turns it upside down.
  const painting=new T.Group();painting.position.set(-1.61,1.94,3.15);painting.rotation.y=Math.PI/2;scene.add(painting);
  box(.91,1.12,.07,0,0,0,wood,false,painting);box(.81,1.02,.025,0,0,.05,brass,false,painting);box(.72,.93,.025,0,0,.07,new T.MeshStandardMaterial({map:paintingTexture(),roughness:1}),false,painting);
  // Side doors make the hallway domestic without adding rooms.
  function sideDoor(x,z,rotation){const g=new T.Group();g.position.set(x,0,z);g.rotation.y=rotation;scene.add(g);box(.99,2.48,.07,0,1.24,0,wood,false,g);for(const y of [.65,1.73])box(.77,.83,.03,0,y,.055,black,false,g);box(.085,.085,.1,.34,1.06,.09,brass,false,g);for(const sx of [-.57,.57])box(.12,2.63,.12,sx,1.3,0,black,false,g);box(1.25,.12,.12,0,2.6,0,black,false,g);return g;}
  sideDoor(-1.61,-4.65,Math.PI/2);sideDoor(1.61,-2.75,-Math.PI/2);sideDoor(5.11,2.5,-Math.PI/2);
  // Pendulum clock, visible on approach to the first corner.
  const clock=new T.Group();clock.position.set(.6,1.88,-7.44);scene.add(clock);
  box(.67,1.14,.16,0,0,0,wood,false,clock);
  const face=new T.Mesh(new T.CircleGeometry(.265,20),cream);face.position.set(0,.2,.091);clock.add(face);
  for(let i=0;i<12;i++){const a=i*Math.PI/6;box(.025,.04,.009,Math.sin(a)*.22,.2+Math.cos(a)*.22,.1,black,false,clock);}
  const hands=new T.Group();hands.position.set(0,.2,.11);clock.add(hands);box(.02,.19,.01,0,.08,0,black,false,hands);box(.14,.02,.01,.055,0,.005,black,false,hands);
  const pendulum=new T.Group();pendulum.position.set(0,-.12,.1);clock.add(pendulum);box(.015,.3,.015,0,-.14,0,brass,false,pendulum);const bob=cylinder(.08,.08,.025,0,-.32,0,brass,pendulum);bob.rotation.x=Math.PI/2;
  // Narrow transom with impossible cold night light.
  box(.05,.75,1.22,5.12,2,-3.2,wood);box(.055,.61,1.08,5.08,2,-3.2,new T.MeshBasicMaterial({color:0x526e6b}));box(.07,.04,1.1,5.04,2,-3.2,black);box(.07,.65,.035,5.04,2,-3.2,black);
  const nightLight=new T.PointLight(0x8cb8bb,4.5,6,2);nightLight.position.set(4.7,2,-3.2);scene.add(nightLight);
  const lights=[tableLight];
  for(const [x,z] of [[0,4.65],[0,-4.9],[3.5,-6],[3.5,5.9]]){
    cylinder(.08,.08,.16,x,2.87,z,brass);cylinder(.015,.015,.24,x,2.65,z,black);
    cylinder(.15,.32,.23,x,2.44,z,wood);
    const bulb=new T.Mesh(new T.SphereGeometry(.075,8,6),new T.MeshBasicMaterial({color:0xffd496}));bulb.position.set(x,2.34,z);scene.add(bulb);
    const light=new T.PointLight(0xffcc8b,17,8,2);light.position.set(x,2.26,z);scene.add(light);lights.push(light);
  }
  const ambient=new T.HemisphereLight(0x9da99b,0x30291e,.65);scene.add(ambient);
  const mirrorLight=new T.PointLight(0xc5d2c7,3.8,4.5,2);mirrorLight.position.set(-.7,2.1,-.3);scene.add(mirrorLight);
  const exitLight=new T.PointLight(0xa7ced2,0,5);exitLight.position.set(0,2,9);scene.add(exitLight);
  // Small authored clutter: umbrella stand, phone, coat hooks, skirting stains.
  cylinder(.18,.14,.55,-1.22,.28,5.8,black);for(let i=0;i<3;i++){const o=cylinder(.015,.015,1.05,-1.2+i*.055,.9,5.8,wood);o.rotation.z=(i-1)*.1;}
  box(.14,.22,.55,1.25,1.08,.7,black);box(.17,.06,.64,1.25,1.21,.7,black);
  for(let i=0;i<3;i++){box(.08,.06,.12,-1.56,1.7,5+i*.26,brass);}
  function setStage(stage){painting.rotation.z=stage>=1?Math.PI:0;mirrorLight.color.set(stage>=1?0xb0c9c8:0xc5d2c7);}
  function animate(time,dt,state){
    hands.rotation.z=time*(state.stage>0?.06:-.06);pendulum.rotation.z=Math.sin(time*2.2)*.14;
    drawerSlide.position.x=T.MathUtils.damp(drawerSlide.position.x,state.drawerOpen?-.74:-.32,8,dt);
    key.visible=state.keyAvailable&&!state.hasKey;
    doorPivot.rotation.y=T.MathUtils.damp(doorPivot.rotation.y,state.doorOpen?-Math.PI*.51:0,2.2,dt);
    doorCollider.disabled=state.doorOpen&&doorPivot.rotation.y<-.95;
    exitLight.intensity=T.MathUtils.damp(exitLight.intensity,state.doorOpen?13:0,3,dt);
    // One sick bulb; irregular low-amplitude flutter rather than flashing the room.
    lights[3].intensity=16+Math.sin(time*7.3)*.45+Math.sin(time*11.1)*.25;
  }
  return {colliders,interactables,occluders,box,cylinder,wood,brass,black,cream,drawer,drawerFace,drawerSlide,key,note,doorPivot,doorCollider,door,lights,mirrorLight,exitLight,setStage,animate};
}
