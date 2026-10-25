import * as T from "three";
import { createFigure, preloadCharacterAssets } from "./figure.mjs";
import { CEILING_HEIGHT } from "./layout.mjs";

const UP = new T.Vector3(0, 1, 0);
const ORIGIN = new T.Vector3();
const clamp = T.MathUtils.clamp;
const smooth = T.MathUtils.smoothstep;
const WALL = .637;
// Irregular bare plaster, avoiding the kitchen/bedroom door openings, clock,
// pendant and the mirror frame. Shoulder cuts remain buried in the surfaces.
export const UNRAVELING_ARMS = Object.freeze([
  ...[[3.18,1.22],[3.83,1.98],[4.32,1.44],[5.24,.79],[5.91,1.91],[6.57,1.13],[7.26,1.86],[8.08,1.26],[8.29,1.96]]
    .map(([x,y],i)=>({at:[x,y,WALL],normal:[0,0,-1],roll:-.91+i*.73,delay:(i%4)*.13,zone:"wall"})),
  ...[[3.16,1.83],[3.72,.97],[4.39,1.94],[5.43,1.18],[6.04,1.89],[6.57,.83],[8.02,1.91],[8.26,1.02]]
    .map(([x,y],i)=>({at:[x,y,-WALL],normal:[0,0,1],roll:.57-i*.81,delay:.11+(i%5)*.12,zone:"wall"})),
  ...[[3.43,.19],[4.05,-.22],[5.67,.22],[6.33,-.21],[7.13,.20],[7.79,-.23],[8.28,.04]]
    .map(([x,z],i)=>({at:[x,CEILING_HEIGHT-.002,z],normal:[0,-1,0],roll:.24+i*.97,delay:.2+(i%4)*.14,zone:"ceiling"})),
]);

// Source arm skin weights collapse to three continuously blended anatomical
// regions. Finger closure is a second pose of that same source hand, not extra
// tubes or detached knuckles. Every instance uses one standard PBR program.
const ARM_SHADER = `
attribute vec3 armBlend;
attribute vec3 armGripDelta;
attribute vec3 armGripNormal;
attribute vec4 armUpper;
attribute vec4 armLower;
attribute vec4 armHand;
attribute vec2 armMotion;
attribute float armSurface;
varying float vArmSurface;
varying float vArmTone;
uniform vec3 armRestElbow;
uniform vec3 armRestWrist;
vec3 armRotate(vec4 q, vec3 p) { return p+2.0*cross(q.xyz,cross(q.xyz,p)+q.w*p); }
`;

function disposeInstance(figure) {
  const materials = new Set(), skeletons = new Set();
  figure.body.traverse(o=>{if(o.isMesh){materials.add(o.material);if(o.skeleton)skeletons.add(o.skeleton);}});
  for(const material of materials)material.dispose();
  for(const skeleton of skeletons)skeleton.dispose();
}

async function extractArm(yieldTask) {
  await preloadCharacterAssets();
  await yieldTask();
  const figure = createFigure(null, 0), rig = figure.anatomy;
  const source = figure.body.getObjectByName("Mara_Skin");
  const shoulder = rig.point("upperarm_r"), elbow = rig.point("lowerarm_r"), wrist = rig.point("hand_r");
  const along = elbow.clone().sub(shoulder).normalize();
  const across = rig.point("index_01_r").sub(rig.point("pinky_01_r"));
  across.addScaledVector(along,-across.dot(along)).normalize();
  const normal = across.clone().cross(along).normalize();
  const inverse = new T.Matrix4().makeBasis(across,along,normal).setPosition(shoulder).invert();
  const restElbow = elbow.clone().applyMatrix4(inverse), restWrist = wrist.clone().applyMatrix4(inverse);
  const handDirection = rig.point("middle_03_r").sub(wrist).transformDirection(inverse);
  const sources = [source, figure.body.getObjectByName("Mara_Clothes")];
  const parts = [];let totalVertices = 0;
  for (let surface = 0; surface < sources.length; surface++) {
    const mesh = sources[surface], count = mesh.geometry.attributes.position.count;
    parts.push({mesh,surface,start:totalVertices,count,
      skinIndex:mesh.geometry.getAttribute("skinIndex"),skinWeight:mesh.geometry.getAttribute("skinWeight"),uv:mesh.geometry.getAttribute("uv"),
      boneRegions:mesh.skeleton.bones.map(bone=>bone.name==="upperarm_r"?0:bone.name==="lowerarm_r"?1:
        /^(?:hand_r|(?:index|middle|ring|pinky|thumb)_\d+_r)$/.test(bone.name)?2:-1)});
    totalVertices += count;
  }
  const combinedIndices=[],sourceUv=new Float32Array(totalVertices*2),surfaces=new Uint8Array(totalVertices);
  for (const part of parts) {
    const index=part.mesh.geometry.index;
    for(let i=0;i<index.count;i++)combinedIndices.push(index.getX(i)+part.start);
    for(let i=0;i<part.count;i++){sourceUv[(i+part.start)*2]=part.uv.getX(i);sourceUv[(i+part.start)*2+1]=part.uv.getY(i);surfaces[i+part.start]=part.surface;}
  }
  const indices={count:combinedIndices.length,getX:i=>combinedIndices[i]};
  const uv={getX:i=>sourceUv[i*2],getY:i=>sourceUv[i*2+1]};
  const candidates = new Uint8Array(totalVertices), blend = new Float32Array(totalVertices*3);
  const open = new Float32Array(totalVertices*3), closed = new Float32Array(totalVertices*3);
  const point = new T.Vector3();
  for (const part of parts) {
    part.mesh.skeleton.update();
    for(let offset=0;offset<part.count;offset+=4096){
      await yieldTask();
      for(let local=offset;local<Math.min(offset+4096,part.count);local++){
        const i=local+part.start;let sum=0;
        for(let j=0;j<4;j++){
          const region=part.boneRegions[part.skinIndex.getComponent(local,j)],weight=part.skinWeight.getComponent(local,j);
          if(region>=0){blend[i*3+region]+=weight;sum+=weight;}
        }
        if(sum<.47)continue;
        part.mesh.getVertexPosition(local,point);part.mesh.localToWorld(point);point.applyMatrix4(inverse);
        if(point.y<-.05)continue;
        candidates[i]=1;point.toArray(open,i*3);
        for(let j=0;j<3;j++)blend[i*3+j]/=sum;
      }
    }
  }
  await yieldTask();
  // Rotate each finger about a measured flexion plane, retaining all original
  // joint lengths. The thumb opposes rather than folding through the palm.
  const palmAxis = rig.point("middle_01_r").sub(wrist).normalize();
  const palmAcross = rig.point("index_01_r").sub(rig.point("pinky_01_r")).normalize();
  const flexion = palmAxis.clone().cross(palmAcross).normalize();
  const hinge = palmAxis.clone().cross(flexion).normalize();
  const q = new T.Quaternion(), current = new T.Quaternion();
  for(const finger of ["index","middle","ring","pinky"])
    for(let segment=1;segment<=3;segment++){
      const name=`${finger}_0${segment}_r`, bone=rig.joint(name).bone;
      bone.getWorldQuaternion(current);
      q.setFromAxisAngle(hinge,[0,.67,1.02,.79][segment]).multiply(current);
      rig.setWorldQuaternion(name,q);
    }
  rig.rotate("thumb_01_r",-.2,-.42,.41);rig.rotate("thumb_02_r",0,0,.57);rig.rotate("thumb_03_r",0,0,.28);
  rig.update();
  for (const part of parts) {
    part.mesh.skeleton.update();
    for(let offset=0;offset<part.count;offset+=4096){
      await yieldTask();
      for(let local=offset;local<Math.min(offset+4096,part.count);local++){
        const i=local+part.start;if(!candidates[i])continue;
        part.mesh.getVertexPosition(local,point);part.mesh.localToWorld(point);point.applyMatrix4(inverse);point.toArray(closed,i*3);
      }
    }
  }
  await yieldTask();
  // A small spatial weld removes redundant anatomical subdivisions. UV seam
  // islands remain separate; the palm/fingers keep the finer1.8mm grid.
  const vertices=[],outIndices=[],buckets=new Map(),remap=new Int32Array(candidates.length).fill(-1);
  const used=new Set();
  for(let i=0;i<indices.count;i+=3){
    const a=indices.getX(i),b=indices.getX(i+1),c=indices.getX(i+2);
    if(candidates[a]&&candidates[b]&&candidates[c]){used.add(a);used.add(b);used.add(c);}
  }
  let step=0;
  for(const i of used){
    if((step++%4096)===0)await yieldTask();
    const grid=blend[i*3+2]>.25?.0018:.0032;
    const key=[Math.round(open[i*3]/grid),Math.round(open[i*3+1]/grid),Math.round(open[i*3+2]/grid),
      Math.floor(uv.getX(i)*96),Math.floor(uv.getY(i)*96),blend[i*3+2]>.25?1:0,surfaces[i]].join('/');
    let id=buckets.get(key);
    if(id===undefined){id=vertices.length;buckets.set(key,id);vertices.push({p:[0,0,0],c:[0,0,0],b:[0,0,0],uv:[0,0],surface:surfaces[i],count:0});}
    const v=vertices[id];remap[i]=id;v.count++;
    for(let j=0;j<3;j++){v.p[j]+=open[i*3+j];v.c[j]+=closed[i*3+j];v.b[j]+=blend[i*3+j];}
    v.uv[0]+=uv.getX(i);v.uv[1]+=uv.getY(i);
  }
  await yieldTask();
  for(let i=0;i<indices.count;i+=3){
    const a=remap[indices.getX(i)],b=remap[indices.getX(i+1)],c=remap[indices.getX(i+2)];
    if(a>=0&&b>=0&&c>=0&&a!==b&&b!==c&&a!==c)outIndices.push(a,b,c);
  }
  const positions=[],deltas=[],uvs=[],weights=[],surfaceIds=[],closedPositions=[];
  for(const v of vertices){
    for(let j=0;j<3;j++){positions.push(v.p[j]/v.count);closedPositions.push(v.c[j]/v.count);deltas.push((v.c[j]-v.p[j])/v.count);weights.push(v.b[j]/v.count);}
    uvs.push(v.uv[0]/v.count,v.uv[1]/v.count);surfaceIds.push(v.surface);
  }
  const geometry = new T.BufferGeometry();
  geometry.setAttribute("position",new T.Float32BufferAttribute(positions,3));
  geometry.setAttribute("uv",new T.Float32BufferAttribute(uvs,2));geometry.setIndex(outIndices);geometry.computeVertexNormals();
  geometry.setAttribute("armBlend",new T.Float32BufferAttribute(weights,3));
  geometry.setAttribute("armSurface",new T.Float32BufferAttribute(surfaceIds,1));
  geometry.setAttribute("armGripDelta",new T.Float32BufferAttribute(deltas,3));
  const gripGeometry=new T.BufferGeometry();gripGeometry.setAttribute("position",new T.Float32BufferAttribute(closedPositions,3));gripGeometry.setIndex(outIndices);gripGeometry.computeVertexNormals();
  const normals=geometry.getAttribute("normal"),gripNormals=gripGeometry.getAttribute("normal"),normalDeltas=[];
  for(let i=0;i<normals.count;i++)normalDeltas.push(gripNormals.getX(i)-normals.getX(i),gripNormals.getY(i)-normals.getY(i),gripNormals.getZ(i)-normals.getZ(i));
  geometry.setAttribute("armGripNormal",new T.Float32BufferAttribute(normalDeltas,3));gripGeometry.dispose();
  const regions=[new T.Box3(),new T.Box3(),new T.Box3()];
  for(let i=0;i<vertices.length;i++)for(let region=0;region<3;region++)if(weights[i*3+region]>.001){
    point.fromArray(positions,i*3);if(region===1)point.sub(restElbow);if(region===2)point.sub(restWrist);regions[region].expandByPoint(point);
    if(region===2){point.fromArray(closedPositions,i*3).sub(restWrist);regions[region].expandByPoint(point);}
  }
  const clothMap=sources[1].material.map;
  const material=new T.MeshStandardMaterial({map:source.material.map,color:0xc0c7c1,roughness:.73,envMapIntensity:.055,
    emissive:0x49534b,emissiveIntensity:.055});
  material.onBeforeCompile=shader=>{
    shader.uniforms.armClothMap={value:clothMap};
    shader.uniforms.armRestElbow={value:restElbow};shader.uniforms.armRestWrist={value:restWrist};
    shader.vertexShader=ARM_SHADER+shader.vertexShader;
    shader.vertexShader=shader.vertexShader.replace('#include <beginnormal_vertex>',`
      vec3 objectNormal=normalize(
        armBlend.x*armRotate(armUpper,normal)+armBlend.y*armRotate(armLower,normal)+
        armBlend.z*armRotate(armHand,normalize(normal+armGripNormal*armMotion.x)));
      #ifdef USE_TANGENT
        vec3 objectTangent=vec3(tangent.xyz);
      #endif`);
    shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>',`
      vArmSurface=armSurface;vArmTone=armMotion.y;
      vec3 armE=armRotate(armUpper,armRestElbow);
      vec3 armW=armE+armRotate(armLower,armRestWrist-armRestElbow);
      vec3 transformed=armBlend.x*armRotate(armUpper,position)+
        armBlend.y*(armE+armRotate(armLower,position-armRestElbow))+
        armBlend.z*(armW+armRotate(armHand,position-armRestWrist+armGripDelta*armMotion.x));`);
    shader.fragmentShader="uniform sampler2D armClothMap;\nvarying float vArmSurface;\nvarying float vArmTone;\n"+shader.fragmentShader;
    shader.fragmentShader=shader.fragmentShader.replace('#include <map_fragment>',`
      #ifdef USE_MAP
        vec4 armSkin=texture2D(map,vMapUv),armCloth=texture2D(armClothMap,vMapUv);
        float armLuma=dot(armCloth.rgb,vec3(.2126,.7152,.0722));
        armCloth.rgb=mix(armCloth.rgb,vec3(armLuma),.93)*mix(vec3(.61,.68,.62),vec3(.97,.89,.76),vArmTone);
        float armGrime=.81+.19*sin(vMapUv.y*219.+sin(vMapUv.x*83.)*2.);
        armCloth.rgb*=armGrime;
        diffuseColor*=mix(armSkin,armCloth,vArmSurface);
      #endif`);
  };
  material.customProgramCacheKey=()=>"unraveling-complete-arm-v1";
  disposeInstance(figure);
  const restLower=restWrist.clone().sub(restElbow);
  return {geometry,material,restElbow,restWrist,restLower,upperLength:restElbow.length(),
    lowerLength:restLower.length(),handDirection,regions,sourceVertices:used.size};
}

export function createReachingArms(parent,warmupObjects){
  let pending=null,mesh=null,asset=null;
  const records=[];
  const v=new T.Vector3(),target=new T.Vector3(),forward=new T.Vector3(),pole=new T.Vector3(),cross=new T.Vector3();
  const elbow=new T.Vector3(),wrist=new T.Vector3(),upperDir=new T.Vector3(),lowerDir=new T.Vector3(),handDir=new T.Vector3();
  const upperQ=new T.Quaternion(),lowerQ=new T.Quaternion(),handQ=new T.Quaternion(),rollQ=new T.Quaternion();
  const matrix=new T.Matrix4(),jointMatrix=new T.Matrix4(),transformedBounds=new T.Box3(),scale=new T.Vector3(1,1,1);
  let attributes=null, attributeList=null, visible=0,poseTime=0;
  async function prepare({yieldTask=()=>Promise.resolve()}={}){
    if(pending)return pending;
    pending=(async()=>{
      asset=await extractArm(yieldTask);await yieldTask();
      const count=UNRAVELING_ARMS.length,geometry=asset.geometry;
      attributes={upper:new T.InstancedBufferAttribute(new Float32Array(count*4),4),lower:new T.InstancedBufferAttribute(new Float32Array(count*4),4),
        hand:new T.InstancedBufferAttribute(new Float32Array(count*4),4),motion:new T.InstancedBufferAttribute(new Float32Array(count*2),2)};
      attributeList=Object.values(attributes);
      for(const [name,attribute] of Object.entries(attributes)){attribute.setUsage(T.DynamicDrawUsage);geometry.setAttribute('arm'+name[0].toUpperCase()+name.slice(1),attribute);}
      mesh=new T.InstancedMesh(geometry,asset.material,count);mesh.name="Twenty-four arms reaching through the plaster";
      mesh.castShadow=mesh.receiveShadow=false;mesh.frustumCulled=false;mesh.instanceMatrix.setUsage(T.DynamicDrawUsage);parent.add(mesh);warmupObjects.push(mesh);
      for(let i=0;i<count;i++){
        const spec=UNRAVELING_ARMS[i],normal=new T.Vector3(...spec.normal),rootQ=new T.Quaternion().setFromUnitVectors(UP,normal);
        rootQ.multiply(new T.Quaternion().setFromAxisAngle(UP,spec.roll));
        records.push({spec,normal,rootQ,inverse:rootQ.clone().invert(),root:new T.Vector3(),bounds:new T.Box3(),elbow:new T.Vector3(),wrist:new T.Vector3(),tip:new T.Vector3(),grasp:0,emerged:0});
        attributes.upper.setXYZW(i,0,0,0,1);attributes.lower.setXYZW(i,0,0,0,1);attributes.hand.setXYZW(i,0,0,0,1);mesh.setMatrixAt(i,new T.Matrix4());
      }
      geometry.boundingBox=new T.Box3(new T.Vector3(-1,-1,-1),new T.Vector3(1,1,1));geometry.boundingSphere=new T.Sphere(new T.Vector3(),2);
      mesh.visible=false;
    })();return pending;
  }
  function update(time,age,player,approaching){
    if(!mesh)return;
    poseTime=time;visible=0;
    const {upperLength,lowerLength,restLower}=asset;
    for(let i=0;i<records.length;i++){
      const r=records[i],{spec,normal,rootQ}=r,phase=i*2.399;
      const emerged=smooth(age-spec.delay,0,1.7);r.emerged=emerged;
      if(emerged>.05)visible++;
      const pulse=.5+.5*Math.sin(time*(.72+(i%5)*.071)+phase);
      const extension=clamp(.08+approaching*.92+Math.sin(time*.37+phase)*.04,0,1)*emerged;
      const behind=.12+(1-emerged)*.67;
      r.root.fromArray(spec.at).addScaledVector(normal,-behind);
      matrix.compose(r.root,rootQ,scale);mesh.setMatrixAt(i,matrix);
      const dx=clamp((player?.x??7)-spec.at[0],-.9,.9)*(.12+extension*.15);
      if(spec.zone==="ceiling")target.set(clamp(spec.at[0]+dx,3.15,8.45),2.37-extension*.22,
        spec.at[2]+Math.sin(time*.49+phase)*.055);
      else target.set(clamp(spec.at[0]+dx,3.05,8.45),spec.at[1]+clamp(1.43-spec.at[1],-.32,.32)*extension+
        Math.sin(time*.57+phase)*.045,spec.at[2]>0?.63-extension*.18:-.63+extension*.18);
      target.sub(r.root).applyQuaternion(r.inverse);
      // Reserve the requested out-of-plaster extension before following Mara
      // tangentially. A distant/high root should not lose its visible reach
      // simply because the two measured bones cannot also reach her height.
      const maximum=upperLength+lowerLength-.045;
      target.y=Math.min(target.y,maximum*.98);
      const tangential=Math.hypot(target.x,target.z),room=Math.sqrt(Math.max(0,maximum*maximum-target.y*target.y));
      if(tangential>room&&tangential>0){target.x*=room/tangential;target.z*=room/tangential;}
      const distance=clamp(target.length(),.14,upperLength+lowerLength-.045);
      forward.copy(target).normalize();target.copy(forward).multiplyScalar(distance);
      pole.set(Math.sin(phase)*.7,.1,Math.cos(phase)*.7);
      cross.copy(forward).cross(pole);if(cross.lengthSq()<.01)cross.set(1,0,0);cross.normalize();
      pole.copy(cross).cross(forward).normalize();
      const along=(upperLength*upperLength-lowerLength*lowerLength+distance*distance)/(2*distance);
      const height=Math.sqrt(Math.max(.0001,upperLength*upperLength-along*along));
      elbow.copy(forward).multiplyScalar(along).addScaledVector(pole,height);
      // Elbow poles can move organically along the wall but cannot punch into
      // the central capsule/head lane. Correct in world space before the IK
      // quaternions are computed, preserving actual bone lengths.
      const worldElbow=v.copy(elbow).applyQuaternion(rootQ).add(r.root);
      if(spec.zone==="ceiling")worldElbow.y=Math.max(2.04,worldElbow.y);
      else worldElbow.z=spec.at[2]>0?Math.max(.34,worldElbow.z):Math.min(-.34,worldElbow.z);
      // Reproject a constrained elbow pole into the solution's exact circle.
      pole.copy(worldElbow).sub(r.root).applyQuaternion(r.inverse);
      pole.addScaledVector(forward,-pole.dot(forward)).normalize();
      elbow.copy(forward).multiplyScalar(along).addScaledVector(pole,height);
      wrist.copy(target);
      upperDir.copy(elbow).normalize();lowerDir.copy(wrist).sub(elbow).normalize();
      upperQ.setFromUnitVectors(UP,upperDir);lowerQ.setFromUnitVectors(v.copy(restLower).normalize(),lowerDir);
      handDir.copy(lowerDir).lerp(forward,.35).normalize();
      handQ.setFromUnitVectors(asset.handDirection,handDir);
      rollQ.setFromAxisAngle(handDir,Math.sin(time*.43+phase)*.13);handQ.premultiply(rollQ);
      attributes.upper.setXYZW(i,upperQ.x,upperQ.y,upperQ.z,upperQ.w);attributes.lower.setXYZW(i,lowerQ.x,lowerQ.y,lowerQ.z,lowerQ.w);
      attributes.hand.setXYZW(i,handQ.x,handQ.y,handQ.z,handQ.w);
      r.grasp=.08+.9*smooth(pulse,.15,.89);attributes.motion.setXY(i,r.grasp,.12+(i*7%19)/21);
      r.elbow.copy(elbow).applyQuaternion(rootQ).add(r.root);r.wrist.copy(wrist).applyQuaternion(rootQ).add(r.root);
      r.tip.copy(handDir).multiplyScalar(.18).add(wrist).applyQuaternion(rootQ).add(r.root);
    }
    for(const attribute of attributeList)attribute.needsUpdate=true;
    mesh.instanceMatrix.needsUpdate=true;mesh.visible=visible>0;
  }
  function reset(){if(mesh)mesh.visible=false;visible=0;for(const r of records)r.emerged=0;}
  function updateBounds() {
    if(!mesh)return;
    for(let i=0;i<records.length;i++) {
      const r=records[i];if(r.emerged<=.05)continue;
      matrix.fromArray(mesh.instanceMatrix.array,i*16);
      upperQ.fromArray(attributes.upper.array,i*4);lowerQ.fromArray(attributes.lower.array,i*4);handQ.fromArray(attributes.hand.array,i*4);
      elbow.copy(asset.restElbow).applyQuaternion(upperQ);
      wrist.copy(asset.restLower).applyQuaternion(lowerQ).add(elbow);
      r.bounds.makeEmpty();
      for(let region=0;region<3;region++) {
        jointMatrix.compose(region===0?ORIGIN:region===1?elbow:wrist,region===0?upperQ:region===1?lowerQ:handQ,scale);
        jointMatrix.premultiply(matrix);transformedBounds.copy(asset.regions[region]).applyMatrix4(jointMatrix);r.bounds.union(transformedBounds);
      }
    }
  }
  return {prepare,update,reset,snapshot:()=>{updateBounds();return {ready:!!mesh,count:records.length,visible,
    triangles:mesh?.geometry.index.count/3||0,draws:mesh?1:0,sourceVertices:asset?.sourceVertices||0,poseTime,
    upperLength:asset?.upperLength||0,lowerLength:asset?.lowerLength||0,
    restElbow:asset?.restElbow.toArray()||[],restWrist:asset?.restWrist.toArray()||[],
    armBounds:records.filter(r=>r.emerged>.05).map(r=>({min:r.bounds.min.toArray(),max:r.bounds.max.toArray(),zone:r.spec.zone,
      shoulder:r.root.toArray(),elbow:r.elbow.toArray(),wrist:r.wrist.toArray(),tip:r.tip.toArray(),grasp:r.grasp})),
    vertices:mesh?.geometry.attributes.position.count||0};}};
}
