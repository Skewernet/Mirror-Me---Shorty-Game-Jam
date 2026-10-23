import * as T from 'three';
export function buildHouse(scene){
  const colliders=[],interactables=[];
  const plaster=new T.MeshStandardMaterial({color:0x777462,roughness:1}),wood=new T.MeshStandardMaterial({color:0x292b23,roughness:.85});
  function box(w,h,d,x,y,z,material=wood,solid=false,parent=scene){const mesh=new T.Mesh(new T.BoxGeometry(w,h,d),material);mesh.position.set(x,y,z);parent.add(mesh);if(solid)colliders.push({minX:x-w/2,maxX:x+w/2,minZ:z-d/2,maxZ:z+d/2});return mesh;}
  box(7,.15,15.2,1.75,-.08,0,wood);box(7,.15,15.2,1.75,3.05,0,plaster);
  box(.2,3,15.2,-1.75,1.5,0,plaster,true);box(.2,3,15.2,5.25,1.5,0,plaster,true);
  box(7.2,3,.2,1.75,1.5,-7.6,plaster,true);
  box(1.1,3,.2,-1.2,1.5,7.6,plaster,true);box(4.65,3,.2,2.975,1.5,7.6,plaster,true);
  // A continuous circuit, with two blind corners. No visible teleport.
  box(.2,3,8.4,1.75,1.5,0,plaster,true);
  const doorCollider={minX:-.65,maxX:.65,minZ:7.4,maxZ:7.75};colliders.push(doorCollider);
  const doorPivot=new T.Group();doorPivot.position.set(-.65,0,7.5);scene.add(doorPivot);
  const door=box(1.3,2.6,.12,.65,1.3,0,wood,false,doorPivot);
  box(.11,.11,.18,1.1,1.05,-.12,new T.MeshStandardMaterial({color:0xc1a268}),false,doorPivot);
  box(1.7,.15,3,0,-.08,9,wood);box(.2,3,3,-.85,1.5,9,plaster,true);box(.2,3,3,.85,1.5,9,plaster,true);box(1.9,3,.2,0,1.5,10.5,plaster,true);box(1.7,.15,3,0,3.05,9,plaster);
  const drawer=box(.65,.8,1,1.27,.4,.9,wood,true),drawerFace=box(.08,.25,.8,.9,.56,.9,wood);
  interactables.push({id:'drawer',mesh:drawer,label:'OPEN DRAWER',range:1.9});
  interactables.push({id:'door',mesh:door,label:'TRY FRONT DOOR',range:2.1});
  scene.add(new T.HemisphereLight(0xa3b4ad,0x272419,.8));
  const lights=[];for(const [x,z] of [[0,4],[0,-3],[3.5,-5],[3.5,4]]){const light=new T.PointLight(0xffd29c,13,9,2);light.position.set(x,2.6,z);scene.add(light);lights.push(light);}
  const exitLight=new T.PointLight(0xa7ced2,0,5);exitLight.position.set(0,2,9);scene.add(exitLight);
  return {colliders,interactables,box,wood,plaster,drawer,drawerFace,doorPivot,doorCollider,door,lights,exitLight};
}
