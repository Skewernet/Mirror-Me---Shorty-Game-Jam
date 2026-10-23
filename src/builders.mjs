import * as T from 'three';
import {RoundedBoxGeometry} from '../vendor/RoundedBoxGeometry.js';
export function builders(scene){
  const colliders=[],occluders=[],interactables=[];
  const geometryCache=new Map();
  function solid(mesh){mesh.updateWorldMatrix(true,false);const b=new T.Box3().setFromObject(mesh);const c={minX:b.min.x,maxX:b.max.x,minZ:b.min.z,maxZ:b.max.z};colliders.push(c);return c;}
  function mesh(geometry,material,x,y,z,parent=scene,collision=false){const m=new T.Mesh(geometry,material);m.position.set(x,y,z);m.castShadow=true;m.receiveShadow=true;parent.add(m);if(!material.transparent||material.opacity>=1)occluders.push(m);else if(material.opacity===0){m.castShadow=false;m.receiveShadow=false;}if(collision)solid(m);return m;}
  function box(w,h,d,x,y,z,material,collision=false,parent=scene,round=0){
    const key=[w,h,d,round].join('/');if(!geometryCache.has(key))geometryCache.set(key,round?new RoundedBoxGeometry(w,h,d,2,Math.min(round,w*.3,h*.3,d*.3)):new T.BoxGeometry(w,h,d));
    return mesh(geometryCache.get(key),material,x,y,z,parent,collision);
  }
  function cylinder(r1,r2,h,x,y,z,material,parent=scene,segments=24){return mesh(new T.CylinderGeometry(r1,r2,h,segments),material,x,y,z,parent);}
  function sphere(rx,ry,rz,x,y,z,material,parent=scene){const m=mesh(new T.SphereGeometry(1,24,16),material,x,y,z,parent);m.scale.set(rx,ry,rz);return m;}
  function tube(points,radius,material,parent=scene){const curve=new T.CatmullRomCurve3(points.map(p=>new T.Vector3(...p)));return mesh(new T.TubeGeometry(curve,24,radius,8,false),material,0,0,0,parent);}
  function lathe(points,x,y,z,material,parent=scene){return mesh(new T.LatheGeometry(points.map(p=>new T.Vector2(...p)),32),material,x,y,z,parent);}
  function group(x=0,y=0,z=0,rotation=0,parent=scene){const g=new T.Group();g.position.set(x,y,z);g.rotation.y=rotation;parent.add(g);return g;}
  function target(id,object,label,range=2.1,owner=object){owner.userData.interactionId=id;interactables.push({id,mesh:object,label,range,owner});return object;}
  function plane(w,h,x,y,z,material,rotation=0,parent=scene){const m=mesh(new T.PlaneGeometry(w,h),material,x,y,z,parent);m.rotation.y=rotation;return m;}
  const c=document.createElement('canvas');c.width=c.height=64;const ctx=c.getContext('2d'),g=ctx.createRadialGradient(32,32,0,32,32,32);g.addColorStop(0,'rgba(0,0,0,.7)');g.addColorStop(1,'rgba(0,0,0,0)');ctx.fillStyle=g;ctx.fillRect(0,0,64,64);const aoMap=new T.CanvasTexture(c),aoMat=new T.MeshBasicMaterial({map:aoMap,transparent:true,depthWrite:false,polygonOffset:true,polygonOffsetFactor:-1});
  function contact(w,d,x,z,opacity=.65,parent=scene){const mat=aoMat.clone();mat.opacity=opacity;const p=mesh(new T.PlaneGeometry(w,d),mat,x,.023,z,parent);p.rotation.x=-Math.PI/2;p.castShadow=false;p.receiveShadow=false;return p;}
  return{scene,colliders,occluders,interactables,box,cylinder,sphere,tube,lathe,group,target,plane,contact,solid,mesh};
}
