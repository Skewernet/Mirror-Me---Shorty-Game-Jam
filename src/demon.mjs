import * as T from "three";
import { createFigure } from "./figure.mjs";

// The intruder owns its surfaces and facial geometry. A healthy Mara, a wake
// mourner and the final truthful reflection never acquire this treatment.
// Its skeleton and planted-contact solver remain the existing human anatomy.
const PALE = new T.Color(0xd8d0b9);
const LINEN = new T.Color(0xb5a98d);
const HAIR = new T.Color(0x15120f);
const emptyWound = new T.DataTexture(new Uint8Array([0, 0, 0, 0]), 1, 1);
emptyWound.colorSpace = T.SRGBColorSpace;
emptyWound.needsUpdate = true;
const woundUniform = { value: emptyWound };
const woundReady = { value: 0 };
let woundLoading;

// Optional until the reviewed original texture is bundled. The transparent
// fallback preserves the existing art pass if a fixture only loads the figure.
// Production startup can await this alongside the existing character preload.
export function preloadDemonAssets() {
  if (!woundLoading)
    woundLoading = new T.TextureLoader()
      .loadAsync(
        new URL("../assets/character/unkept-wound.png", import.meta.url).href,
      )
      .then((texture) => {
        texture.colorSpace = T.SRGBColorSpace;
        texture.flipY = true;
        texture.wrapS = texture.wrapT = T.ClampToEdgeWrapping;
        woundUniform.value = texture;
        woundReady.value = 1;
        return texture;
      });
  return woundLoading;
}

const NOISE = /* glsl */ `
float demonHash(vec3 p) {
  p=fract(p*.1031); p+=dot(p,p.yzx+33.33);
  return fract((p.x+p.y)*p.z);
}
float demonNoise(vec3 p) {
  vec3 i=floor(p), f=fract(p); f=f*f*(3.-2.*f);
  return mix(mix(mix(demonHash(i),demonHash(i+vec3(1,0,0)),f.x),
                 mix(demonHash(i+vec3(0,1,0)),demonHash(i+vec3(1,1,0)),f.x),f.y),
             mix(mix(demonHash(i+vec3(0,0,1)),demonHash(i+vec3(1,0,1)),f.x),
                 mix(demonHash(i+vec3(0,1,1)),demonHash(i+vec3(1,1,1)),f.x),f.y),f.z);
}
`;

const SKIN = /* glsl */ `
vec3 dp=vDemonRest;
vec3 originalSkin=texture2D(map,vMapUv).rgb;
float originalValue=dot(originalSkin,vec3(.2126,.7152,.0722));
float cloud=demonNoise(dp*37.+vec3(2.3,0.,7.1));
float smallCloud=demonNoise(dp*116.);
float grain=demonNoise(dp*530.);
float faceFront=smoothstep(.035,.105,dp.z)*smoothstep(1.46,1.55,dp.y);
float neck=smoothstep(1.25,1.4,dp.y)*(1.-smoothstep(1.49,1.57,dp.y));
float eyeLeft=exp(-pow((dp.x-.036)/.026,2.)-pow((dp.y-1.621)/.024,2.));
float eyeRight=exp(-pow((dp.x+.041)/.025,2.)-pow((dp.y-1.619)/.025,2.));
float orbital=clamp(eyeLeft+eyeRight,0.,1.)*faceFront;
float mouthRegion=exp(-pow(dp.x/.037,2.)-pow((dp.y-1.55)/.035,2.))*faceFront;
float veinPath=abs(sin(dp.y*81.+dp.x*138.+sin(dp.y*37.+dp.z*94.)*1.1+cloud*1.7));
float veins=1.-smoothstep(.018,.075,veinPath);
veins*=smoothstep(.28,.66,smallCloud)*(.24+.76*faceFront);
float bruise=smoothstep(.52,.83,cloud)*smoothstep(.23,.8,smallCloud);
vec3 flesh=mix(originalSkin,vec3(originalValue)*vec3(.82,.86,.79),.84)*.32;
flesh=mix(flesh,vec3(.073,.042,.048),bruise*.58);
flesh=mix(flesh,vec3(.028,.053,.05),veins*.54);
flesh*=.74+smallCloud*.27+grain*.1;
flesh=mix(flesh,vec3(.026,.012,.016),orbital*.87);
float lip=texture2D(maraMouthMask,vMapUv).r;
float lipRim=smoothstep(.03,.35,lip)*(1.-smoothstep(.52,.96,lip));
flesh=mix(flesh,vec3(.085,.004,.004),lipRim*.96);
flesh=mix(flesh,vec3(.0018,.0005,.00045),smoothstep(.2,.74,lip));
float driedBlood=smoothstep(.57,.85,cloud+.14*sin(dp.y*192.+dp.x*77.));
float bloodArea=clamp(mouthRegion*.47+vMaraBloodWeight*.62,0.,.76);
flesh=mix(flesh,vec3(.085,.003,.002),driedBlood*bloodArea);
float cheekDistance=abs(-dp.x+.028+(dp.y-1.558)*.72);
float cheekWidth=.0065+.0015*sin(dp.y*193.+dp.x*77.);
float cheekExtent=smoothstep(1.546,1.558,dp.y)*(1.-smoothstep(1.591,1.607,dp.y))*faceFront;
float cheekStrain=(1.-smoothstep(cheekWidth*.2,cheekWidth,cheekDistance))*cheekExtent;
float cheekRim=(1.-smoothstep(cheekWidth*.6,cheekWidth*1.7,cheekDistance))*cheekExtent;
flesh=mix(flesh,vec3(.055,.006,.005),cheekRim*.7*(1.-demonWoundReady));
flesh=mix(flesh,vec3(.012,.0007,.0006),cheekStrain*(.79+.2*smallCloud)*(1.-demonWoundReady));
float scalp=smoothstep(1.664,1.704,dp.y);
flesh=mix(flesh,vec3(.017,.012,.01),scalp*.83);
vec2 woundUv=vec2((.046-dp.x)/.066+.5,(dp.y-1.577)/.077+.5);
float woundRect=step(0.,woundUv.x)*step(woundUv.x,1.)*step(0.,woundUv.y)*step(woundUv.y,1.);
vec4 woundTexel=texture2D(demonWoundMap,clamp(woundUv,0.,1.));
float woundAlpha=smoothstep(.25,.7,woundTexel.a)*woundRect*faceFront*(1.-smoothstep(.4,.85,lip))*demonWoundReady;
flesh=mix(flesh,woundTexel.rgb*.42,woundAlpha);
diffuseColor.rgb=flesh;
float demonWet=clamp(lipRim*.9+smoothstep(.63,.9,lip)*.24+orbital*.2+cheekStrain*.75*(1.-demonWoundReady)+woundAlpha*.65,0.,1.);
float neckFront=smoothstep(-.005,.045,dp.z);
float tendonRidge=pow(abs(sin(dp.x*121.+dp.y*9.)),12.)*neck*neckFront;
float woundRelief=woundAlpha*(dot(woundTexel.rgb,vec3(.3,.59,.11))-.3)*.006;
float demonRelief=grain*.007+veins*.003+tendonRidge*.012+cheekStrain*.006*(1.-demonWoundReady)+woundRelief;
`;

const CLOTH = /* glsl */ `
vec3 dp=vDemonRest;
vec3 originalCloth=texture2D(map,vMapUv).rgb;
float clothValue=dot(originalCloth,vec3(.2126,.7152,.0722));
float clothCloud=demonNoise(dp*23.);
float clothGrain=demonNoise(dp*380.);
float blouse=smoothstep(.85,1.03,dp.y);
vec3 linen=vec3(.084,.063,.046)*(.65+clothValue*1.6);
vec3 denim=vec3(.027,.03,.027)*(.65+clothValue*1.8);
vec3 garment=mix(denim,linen,blouse);
garment*=.87+clothCloud*.2+clothGrain*.06;
float streak=demonNoise(vec3(dp.x*37.+sin(dp.y*14.)*.7,dp.y*4.5,dp.z*42.));
float dragged=demonNoise(vec3(dp.x*62.,dp.y*9.,dp.z*52.));
float stain=smoothstep(.49,.72,streak)*smoothstep(.35,.64,dragged)*blouse*.23;
float smearX=dp.x+.044+sin((dp.y-1.25)*9.)*.019;
float fingers=exp(-pow((smearX+.014)/.0045,2.))+exp(-pow(smearX/.005,2.))+exp(-pow((smearX-.014)/.004,2.));
float fingerLength=smoothstep(1.15,1.205,dp.y)*(1.-smoothstep(1.36,1.42,dp.y));
float handDrag=clamp(fingers,0.,1.)*fingerLength*smoothstep(.025,.085,dp.z)*(.6+.4*dragged);
garment=mix(garment,vec3(.034,.003,.002),clamp(stain+handDrag*.87,0.,.94));
float cuff=clamp(vMaraBloodWeight,0.,1.);
garment=mix(garment,vec3(.055,.003,.002),cuff*.66);
diffuseColor.rgb=garment;
`;

export function createDemon(house, layer = 0) {
  const figure = createFigure(house, layer);
  const skin = figure.body.getObjectByName("Mara_Skin");
  const eyes = figure.body.getObjectByName("Mara_Eyes");
  const head = figure.body.getObjectByName("head");
  const ownedGeometry = [];
  const ownedMaterials = new Set();
  const originalSkin = skin.material.map;
  figure.body.updateMatrixWorld(true);
  const headForward = new T.Vector3(0, 0, -1).applyQuaternion(
    head.getWorldQuaternion(new T.Quaternion()).invert(),
  );
  const worldHead = new T.Vector3(),
    targetDirection = new T.Vector3();
  const currentForward = new T.Vector3(),
    turnAxis = new T.Vector3();
  const worldQuaternion = new T.Quaternion(),
    parentInverse = new T.Quaternion();
  const gazeTurn = new T.Quaternion();
  let lastPhase = null,
    stillStarted = 0,
    orientStarted = null,
    jawOpen = 0.58;

  // cloneSkeleton intentionally shares the human source geometry. Only the
  // intruder's additional sculpt may own and modify another BufferGeometry.
  skin.geometry = skin.geometry.clone();
  ownedGeometry.push(skin.geometry);
  skin.morphTargetDictionary = { ...skin.morphTargetDictionary };
  skin.morphTargetInfluences = [...skin.morphTargetInfluences];
  addCollapsedFace(skin);
  const hair = figure.body.getObjectByName("Mara_Hair");
  // Keep Mara's recognizable fitted crown and sides. Only this instance gets
  // a dark, matted surface and wet clumps; the shared bob geometry is untouched.
  if (hair) {
    const oldMaterial = hair.material;
    ownedMaterials.add(oldMaterial);
    hair.material = new T.MeshPhysicalMaterial({
      name: oldMaterial.name,
      map: oldMaterial.map,
      alphaTest: 0.35,
      side: T.DoubleSide,
      color: 0x15120f,
      roughness: 0.82,
      metalness: 0,
      envMapIntensity: 0.08,
      specularIntensity: 0.1,
    });
  }
  const wetHair = makeWetHair(skin, head, layer);
  ownedGeometry.push(wetHair.geometry);
  ownedMaterials.add(wetHair.material);
  if (eyes) {
    const previous = eyes.material.onBeforeCompile;
    eyes.material.onBeforeCompile = (shader, renderer) => {
      previous.call(eyes.material, shader, renderer);
      shader.fragmentShader = shader.fragmentShader.replace(
        "#include <alphamap_fragment>",
        `float eyeValue=dot(diffuseColor.rgb,vec3(.2126,.7152,.0722));
        diffuseColor.rgb=mix(vec3(eyeValue)*vec3(.77,.84,.8),diffuseColor.rgb,.12);
        #include <alphamap_fragment>`,
      );
    };
    eyes.material.customProgramCacheKey = () => "unkept-human-eye-v1";
    eyes.material.needsUpdate = true;
  }
  const demonInfo = {
    name: "The Unkept",
    role: "Mara's concealed violence, never a replacement culprit",
    sculpt: "asymmetric human collapse",
    surface: "original procedural marbling, bruising and ruined linen",
    extraMeshes: 1,
    extraTriangles: wetHair.geometry.index.count / 3,
    glowingEyes: false,
    gazePhase: null,
  };
  figure.body.userData.demon = demonInfo;

  figure.body.traverse((mesh) => {
    if (!mesh.isMesh || mesh === wetHair) return;
    if (mesh.customDepthMaterial) ownedMaterials.add(mesh.customDepthMaterial);
    const materials = Array.isArray(mesh.material)
      ? mesh.material
      : [mesh.material];
    for (const material of materials) {
      ownedMaterials.add(material);
      if (/Skin|Clothes/.test(material.name)) {
        const previous = material.onBeforeCompile;
        const previousKey = material.customProgramCacheKey();
        material.onBeforeCompile = (shader, renderer) => {
          previous.call(material, shader, renderer);
          shader.uniforms.demonWoundMap = woundUniform;
          shader.uniforms.demonWoundReady = woundReady;
          shader.vertexShader =
            "varying vec3 vDemonRest;\n" + shader.vertexShader;
          shader.vertexShader = shader.vertexShader.replace(
            "#include <begin_vertex>",
            "#include <begin_vertex>\nvDemonRest=position;",
          );
          shader.fragmentShader =
            "varying vec3 vDemonRest;\nuniform sampler2D demonWoundMap;\nuniform float demonWoundReady;\n" +
            NOISE +
            shader.fragmentShader;
          const flesh = /Skin/.test(material.name);
          shader.fragmentShader = shader.fragmentShader.replace(
            "#include <alphamap_fragment>",
            (flesh ? SKIN : CLOTH) + "\n#include <alphamap_fragment>",
          );
          if (flesh)
            shader.fragmentShader = shader.fragmentShader.replace(
              "#include <roughnessmap_fragment>",
              "#include <roughnessmap_fragment>\nroughnessFactor=mix(.72,.21,demonWet);",
            );
          if (flesh)
            shader.fragmentShader = shader.fragmentShader.replace(
              "#include <normal_fragment_maps>",
              `#include <normal_fragment_maps>
              vec3 fleshDx=normalize(dFdx(-vViewPosition));
              vec3 fleshDy=normalize(dFdy(-vViewPosition));
              vec3 fleshR1=cross(fleshDy,normal);
              vec3 fleshR2=cross(normal,fleshDx);
              float fleshDet=dot(fleshDx,fleshR1)*faceDirection;
              vec3 fleshGrad=sign(fleshDet)*(dFdx(demonRelief)*fleshR1+dFdy(demonRelief)*fleshR2);
              normal=normalize(max(abs(fleshDet),.0001)*normal-fleshGrad);`,
            );
        };
        material.customProgramCacheKey = () =>
          previousKey + "|unkept-surface-v4";
        material.needsUpdate = true;
      }
    }
  });

  function appearance() {
    skin.material.map = originalSkin;
    skin.material.color.copy(PALE);
    skin.material.roughness = 0.74;
    // Receive the house's existing room HDR rather than disappearing between
    // ceiling bulbs. This is reflected/indirect light, never an emissive face.
    skin.material.envMapIntensity = 0.42;
    const dict = skin.morphTargetDictionary;
    skin.morphTargetInfluences[dict.Mara_Jaw_Open] = jawOpen;
    skin.morphTargetInfluences[dict.Mara_Hollow] = 0.4;
    skin.morphTargetInfluences[dict.Demon_Collapse] = 1;
    if (eyes) {
      eyes.material.color.set(0x5f635b);
      eyes.material.roughness = 0.14;
      eyes.material.envMapIntensity = 0.24;
      // Preserve a human iris and wet eyeball. Fully black or luminous sockets
      // read as a familiar game enemy, and cannot sustain an accusing gaze.
      eyes.morphTargetInfluences[eyes.morphTargetDictionary.Mara_Recessed] =
        0.18;
    }
    figure.body.traverse((mesh) => {
      if (!mesh.isMesh || Array.isArray(mesh.material)) return;
      const material = mesh.material;
      if (/Clothes/.test(material.name)) {
        material.color.copy(LINEN);
        material.envMapIntensity = 0.18;
      }
      if (/Hair/.test(material.name)) {
        material.color.copy(HAIR);
        material.roughness = 0.82;
      }
      if (/Brows|Lashes/.test(material.name)) {
        material.color.set(0x6e6359);
        material.roughness = 0.9;
      }
      if (/Shoes/.test(material.name)) material.color.set(0x777064);
    });
  }

  const wrapped = { ...figure };
  for (const method of [
    "setCreaturePose",
    "setHorror",
    "setUnease",
    "resetPose",
    "animate",
  ]) {
    wrapped[method] = (...args) => {
      const result = figure[method](...args);
      appearance();
      return result;
    };
  }
  wrapped.setCreaturePose = (time, progress = 0, options = {}) => {
    const phase = options.phase || null;
    if (phase === "still" && lastPhase !== "still") {
      stillStarted = time;
      orientStarted = null;
    }
    if (phase === "orient" && lastPhase !== "orient") orientStarted = time;
    lastPhase = phase;
    jawOpen =
      phase === "still"
        ? 0.18
        : orientStarted === null
          ? 0.58
          : 0.18 + 0.56 * T.MathUtils.smoothstep(time - orientStarted, 0, 0.42);
    // The body does not idly bob while it is supposed to be waiting for us.
    // Contact distance still comes from the director's real travelled metres.
    figure.setCreaturePose(
      options.still ? stillStarted : time,
      progress,
      options,
    );
    appearance();
    if (
      options.gazeTarget &&
      options.gazeWeight > 0 &&
      orientStarted !== null
    ) {
      figure.body.updateMatrixWorld(true);
      head.getWorldPosition(worldHead);
      targetDirection.fromArray(options.gazeTarget).sub(worldHead).normalize();
      head.getWorldQuaternion(worldQuaternion);
      currentForward
        .copy(headForward)
        .applyQuaternion(worldQuaternion)
        .normalize();
      const angle = Math.acos(
        T.MathUtils.clamp(currentForward.dot(targetDirection), -1, 1),
      );
      turnAxis.crossVectors(currentForward, targetDirection);
      if (turnAxis.lengthSq() > 1e-8) {
        // A single restrained orientation, never an all-angle tracking turret.
        // Cap the additional turn at twenty degrees, including upward glances.
        const eased = T.MathUtils.smoothstep(time - orientStarted, 0, 0.42);
        const amount =
          Math.min(angle, 0.35) *
          eased *
          T.MathUtils.clamp(options.gazeWeight, 0, 1);
        gazeTurn.setFromAxisAngle(turnAxis.normalize(), amount);
        worldQuaternion.premultiply(gazeTurn);
        head.parent.getWorldQuaternion(parentInverse).invert();
        head.quaternion
          .copy(parentInverse.multiply(worldQuaternion))
          .normalize();
        head.updateMatrixWorld(true);
      }
    }
    figure.body.userData.demon.gazePhase = phase;
  };
  wrapped.resetPose = () => {
    figure.resetPose();
    lastPhase = null;
    stillStarted = 0;
    orientStarted = null;
    jawOpen = 0.18;
    demonInfo.gazePhase = null;
    appearance();
  };
  wrapped.identity = "The Unkept";
  wrapped.dispose = () => {
    figure.body.removeFromParent();
    ownedGeometry.forEach((geometry) => geometry.dispose());
    ownedMaterials.forEach((material) => material.dispose());
    // Base maps, oral mask and normal human geometry remain shared, live assets.
  };
  figure.body.name = "The Unkept — the wrong daughter";
  appearance();
  return wrapped;
}

function addCollapsedFace(skin) {
  const geometry = skin.geometry;
  const positions = geometry.attributes.position;
  const sourceNormals = geometry.attributes.normal;
  const deltas = new Float32Array(positions.count * 3);
  const deformed = new Float32Array(positions.array);
  const gauss = (value, centre, radius) =>
    Math.exp(-(((value - centre) / radius) ** 2));
  for (let i = 0; i < positions.count; i++) {
    const x = positions.getX(i),
      y = positions.getY(i),
      z = positions.getZ(i);
    const front = T.MathUtils.smoothstep(z, 0.045, 0.105);
    const collapsedCheek =
      gauss(x, 0.052, 0.031) * gauss(y, 1.575, 0.036) * front;
    const oppositeOrbit =
      gauss(x, -0.035, 0.028) * gauss(y, 1.627, 0.023) * front;
    const lowerMouth = gauss(x, 0.013, 0.037) * gauss(y, 1.551, 0.021) * front;
    const tornCorner = gauss(x, 0.029, 0.018) * gauss(y, 1.558, 0.017) * front;
    const jaw = gauss(x, 0, 0.073) * gauss(y, 1.53, 0.035) * front;
    const dx =
      -0.01 * collapsedCheek -
      0.005 * oppositeOrbit -
      x * 0.2 * jaw +
      0.014 * tornCorner;
    const dy =
      -0.014 * collapsedCheek +
      0.006 * oppositeOrbit -
      0.014 * lowerMouth -
      0.018 * tornCorner;
    const dz =
      -0.013 * collapsedCheek +
      0.004 * oppositeOrbit -
      0.007 * lowerMouth -
      0.006 * tornCorner;
    deltas.set([dx, dy, dz], i * 3);
    deformed[i * 3] += dx;
    deformed[i * 3 + 1] += dy;
    deformed[i * 3 + 2] += dz;
  }
  const normalGeometry = geometry.clone();
  normalGeometry.morphAttributes = {};
  normalGeometry.setAttribute("position", new T.BufferAttribute(deformed, 3));
  normalGeometry.computeVertexNormals();
  const normalDeltas = new Float32Array(sourceNormals.count * 3);
  for (let i = 0; i < normalDeltas.length; i++)
    normalDeltas[i] =
      normalGeometry.attributes.normal.array[i] - sourceNormals.array[i];
  normalGeometry.dispose();
  const index = geometry.morphAttributes.position.length;
  const delta = new T.BufferAttribute(deltas, 3);
  delta.name = "Demon_Collapse";
  geometry.morphAttributes.position.push(delta);
  geometry.morphAttributes.normal.push(new T.BufferAttribute(normalDeltas, 3));
  skin.morphTargetDictionary.Demon_Collapse = index;
  skin.morphTargetInfluences[index] = 1;
}

function makeWetHair(skin, head, layer) {
  const pieces = [];
  const random = (value) =>
    T.MathUtils.euclideanModulo(
      Math.sin(value * 127.1 + 311.7) * 43758.5453,
      1,
    );
  // These are small clumps, not eighty separate render objects. Their curves
  // follow the actual 1.74m asset's scalp before falling beside the exposed face.
  // Only the narrow ends leave the skin; nothing reaches the floor or ceiling.
  for (let i = 0; i < 84; i++) {
    const angle = i * 2.3999632297;
    const side = Math.sin(angle) < 0 ? -1 : 1;
    const front = Math.cos(angle) > 0.45;
    const crown = 0.16 + random(i + 3) * 0.77;
    const root = new T.Vector3(
      Math.sin(angle) * Math.sin(crown) * 0.088,
      1.643 + Math.cos(crown) * 0.098,
      0.023 + Math.cos(angle) * Math.sin(crown) * 0.089,
    );
    const sideX = front
      ? side * (0.07 + random(i + 5) * 0.018)
      : Math.sin(angle) * 0.098;
    const sideZ = front
      ? 0.096 + random(i + 8) * 0.012
      : 0.02 + Math.cos(angle) * 0.096;
    const arc = new T.Vector3(
      front ? side * 0.052 : Math.sin(angle) * 0.091,
      1.694 - random(i + 12) * 0.023,
      front ? 0.094 : 0.022 + Math.cos(angle) * 0.094,
    );
    const temple = new T.Vector3(sideX, 1.612 + random(i + 17) * 0.023, sideZ);
    const end = new T.Vector3(
      sideX + (random(i + 21) - 0.5) * 0.012,
      1.515 + random(i + 29) * 0.081,
      sideZ - 0.014 + random(i + 34) * 0.02,
    );
    const curve = new T.CatmullRomCurve3([root, arc, temple, end]);
    const piece = new T.TubeGeometry(
      curve,
      10,
      0.00085 + random(i + 41) * 0.0009,
      4,
      false,
    );
    pieces.push(piece);
  }
  const geometry = mergeGeometry(pieces);
  skin.updateWorldMatrix(true, false);
  head.updateWorldMatrix(true, false);
  geometry.applyMatrix4(
    head.matrixWorld.clone().invert().multiply(skin.matrixWorld),
  );
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();
  const material = new T.MeshPhysicalMaterial({
    name: "Unkept matted strand clumps",
    color: 0x16120f,
    roughness: 0.78,
    metalness: 0,
    envMapIntensity: 0.08,
    specularIntensity: 0.15,
  });
  const mesh = new T.Mesh(geometry, material);
  mesh.name = "Uneven wet strands rooted in the scalp";
  mesh.layers.set(layer);
  mesh.castShadow = false;
  mesh.receiveShadow = true;
  head.add(mesh);
  return mesh;
}

function mergeGeometry(pieces) {
  const positions = [],
    normals = [],
    indices = [];
  for (const piece of pieces) {
    const base = positions.length / 3;
    positions.push(...piece.attributes.position.array);
    normals.push(...piece.attributes.normal.array);
    for (let i = 0; i < piece.index.count; i++)
      indices.push(base + piece.index.getX(i));
    piece.dispose();
  }
  const geometry = new T.BufferGeometry();
  geometry.setAttribute("position", new T.Float32BufferAttribute(positions, 3));
  geometry.setAttribute("normal", new T.Float32BufferAttribute(normals, 3));
  geometry.setIndex(indices);
  return geometry;
}
