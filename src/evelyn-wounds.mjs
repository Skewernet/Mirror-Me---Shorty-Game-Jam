import * as T from "three";
import { mergeGeometries } from "../vendor/BufferGeometryUtils.js";
import { RoundedBoxGeometry } from "../vendor/RoundedBoxGeometry.js";

const TAU = Math.PI * 2;
const noise = (x, y) => Math.sin(x * 83.17 + y * 131.93) * .54 + Math.sin(x * 217.31 - y * 91.71) * .29;
const SURFACE_NOISE = `
float ewHash(vec3 p){return fract(sin(dot(p,vec3(127.1,311.7,74.7)))*43758.5453);}
float ewNoise(vec3 p){
 vec3 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);
 return mix(mix(mix(ewHash(i),ewHash(i+vec3(1,0,0)),f.x),mix(ewHash(i+vec3(0,1,0)),ewHash(i+vec3(1,1,0)),f.x),f.y),
 mix(mix(ewHash(i+vec3(0,0,1)),ewHash(i+vec3(1,0,1)),f.x),mix(ewHash(i+vec3(0,1,1)),ewHash(i+vec3(1,1,1)),f.x),f.y),f.z);
}`;

function woundPoint(wound, angle, scale = 1) {
  const edge = 1 + .11 * Math.sin(angle * 3 + wound.seed) + .065 * Math.sin(angle * 7 + wound.seed) + .035 * Math.sin(angle * 13 - wound.seed);
  const x = Math.cos(angle) * wound.w * .5 * scale * edge;
  const y = Math.sin(angle) * wound.h * .5 * scale * edge;
  const c = Math.cos(wound.angle), s = Math.sin(wound.angle);
  return [wound.x + x * c - y * s, wound.y + x * s + y * c];
}

function inside(wound, x, y, scale = 1) {
  const c = Math.cos(wound.angle), s = Math.sin(wound.angle);
  const dx = x - wound.x, dy = y - wound.y;
  const u = (dx * c + dy * s) / (wound.w * .5);
  const v = (-dx * s + dy * c) / (wound.h * .5);
  const angle = Math.atan2(v, u);
  const edge = 1 + .11 * Math.sin(angle * 3 + wound.seed) + .065 * Math.sin(angle * 7 + wound.seed) + .035 * Math.sin(angle * 13 - wound.seed);
  return Math.hypot(u, v) < scale * edge;
}

// The projection is measured from the actual rigged Evelyn geometry, in her
// body frame. Front is -Z; no assumed Mara dimensions/UV islands are reused.
function surface(body, mesh) {
  body.updateMatrixWorld(true);
  mesh.skeleton?.update();
  const points = [], cells = new Map(), size = .008;
  const point = new T.Vector3();
  for (let i = 0; i < mesh.geometry.attributes.position.count; i++) {
    mesh.getVertexPosition(i, point);
    body.worldToLocal(mesh.localToWorld(point));
    points.push(point.clone());
    const key = `${Math.round(point.x / size)},${Math.round(point.y / size)}`;
    const previous = cells.get(key);
    if (previous === undefined || point.z < previous) cells.set(key, point.z);
  }
  const at = (x, y) => {
    const ix = Math.round(x / size), iy = Math.round(y / size);
    for (let r = 2; r <= 8; r++) {
      const nearby = [];
      for (let dx = -r; dx <= r; dx++) for (let dy = -r; dy <= r; dy++) {
        const z = cells.get(`${ix + dx},${iy + dy}`);
        if (z !== undefined) nearby.push({ z, distance: (x - (ix + dx) * size) ** 2 + (y - (iy + dy) * size) ** 2 });
      }
      if (nearby.length) {
        const front = Math.min(...nearby.map(point => point.z));
        let weighted = 0, total = 0;
        for (const point of nearby) if (point.z < front + .045) {
          const weight = 1 / (point.distance + .000025);
          weighted += point.z * weight;
          total += weight;
        }
        return weighted / total;
      }
    }
    return 0;
  };
  return { points, at };
}

function removeFrontFaces(mesh, samples, wounds) {
  const geometry = mesh.geometry.clone();
  const positions = samples.points;
  const original = geometry.index ? Array.from(geometry.index.array) : Array.from({ length: positions.length }, (_, i) => i);
  const index = [];
  let removed = 0;
  for (let i = 0; i < original.length; i += 3) {
    const a = positions[original[i]], b = positions[original[i + 1]], c = positions[original[i + 2]];
    const x = (a.x + b.x + c.x) / 3, y = (a.y + b.y + c.y) / 3, z = (a.z + b.z + c.z) / 3;
    const cut = wounds.some(wound => inside(wound, a.x, a.y, .94) && inside(wound, b.x, b.y, .94) && inside(wound, c.x, c.y, .94)) && z < samples.at(x, y) + .025;
    if (cut) removed++;
    else index.push(original[i], original[i + 1], original[i + 2]);
  }
  geometry.setIndex(index);
  const rest = new Float32Array(positions.length * 3);
  positions.forEach((point, i) => point.toArray(rest, i * 3));
  geometry.setAttribute("evelynWoundRest", new T.BufferAttribute(rest, 3));
  // All source meshes have one material; preserving the original group count
  // after changing the index would otherwise refer beyond the new triangles.
  geometry.clearGroups();
  mesh.geometry = geometry;
  return removed;
}

function stainMaterial(material, kind, metrics, wounds) {
  const own = material.clone();
  const previous = material.onBeforeCompile;
  const previousKey = material.customProgramCacheKey();
  own.userData.evelynWounded = true;
  own.onBeforeCompile = function(shader, renderer) {
    previous.call(this, shader, renderer);
    shader.vertexShader = "attribute vec3 evelynWoundRest; varying vec3 vEvelynWoundRest;\n" + shader.vertexShader;
    shader.vertexShader = shader.vertexShader.replace("#include <begin_vertex>", "#include <begin_vertex>\nvEvelynWoundRest=evelynWoundRest;");
    shader.fragmentShader = "varying vec3 vEvelynWoundRest;\n" + SURFACE_NOISE + "\n" + shader.fragmentShader;
    const neck = metrics.neck.toFixed(6), chest = (metrics.neck - .22).toFixed(6), abdomen = (metrics.neck - .42).toFixed(6);
    shader.fragmentShader = shader.fragmentShader.replace("#include <alphamap_fragment>", `
      vec3 ew=vEvelynWoundRest;
      ${kind === "hair" ? "" : wounds.filter(wound => kind !== "cloth" || wound.area === "both").map((wound, i) => `
        vec2 ewDelta${i}=ew.xy-vec2(${wound.x.toFixed(6)},${wound.y.toFixed(6)});
        vec2 ewCut${i}=mat2(${Math.cos(wound.angle).toFixed(6)},${(-Math.sin(wound.angle)).toFixed(6)},${Math.sin(wound.angle).toFixed(6)},${Math.cos(wound.angle).toFixed(6)})*ewDelta${i}/vec2(${(wound.w * .5).toFixed(6)},${(wound.h * .5).toFixed(6)});
        float ewAngle${i}=atan(ewCut${i}.y,ewCut${i}.x);
        float ewEdge${i}=1.+.11*sin(ewAngle${i}*3.+${wound.seed.toFixed(1)})+.065*sin(ewAngle${i}*7.+${wound.seed.toFixed(1)})+.035*sin(ewAngle${i}*13.-${wound.seed.toFixed(1)});
        if(length(ewCut${i})<ewEdge${i}*.82 && ew.z<${(wound.frontZ + .08).toFixed(6)}) discard;
      `).join("\n")}
      float ewFront=1.-smoothstep(-.012,.055,ew.z);
      float ewGrain=ewNoise(ew*430.);
      float ewCloud=ewNoise(ew*39.+vec3(2.1,7.3,1.9));
      float ewChest=exp(-pow(ew.x/.17,2.)-pow((ew.y-${chest})/.24,2.));
      float ewBelly=exp(-pow((ew.x+.008)/.17,2.)-pow((ew.y-${abdomen})/.25,2.));
      float ewJaw=exp(-pow((ew.x-.038)/.071,2.)-pow((ew.y-${neck}-.10)/.17,2.));
      float ewSocket=exp(-pow((ew.x-.031)/.030,2.)-pow((ew.y-${(metrics.head + .049).toFixed(6)})/.024,2.));
      float ewOtherSocket=exp(-pow((ew.x+.028)/.031,2.)-pow((ew.y-${(metrics.head + .049).toFixed(6)})/.022,2.));
      float ewFaceRun=exp(-pow((ew.x-.032-sin(ew.y*118.)*.0028)/.0028,2.))
        *smoothstep(${(metrics.head - .038).toFixed(6)},${(metrics.head - .014).toFixed(6)},ew.y)
        *(1.-smoothstep(${(metrics.head + .083).toFixed(6)},${(metrics.head + .102).toFixed(6)},ew.y))*(.48+.52*ewCloud);
      ${kind === "skin" ? `
        float ewFace=exp(-pow((ew.y-${(metrics.head + .015).toFixed(6)})/.105,2.))*ewFront;
        float ewSkinValue=dot(diffuseColor.rgb,vec3(.2126,.7152,.0722));
        diffuseColor.rgb=mix(diffuseColor.rgb,vec3(ewSkinValue)*vec3(.78,.80,.70),ewFace*.32);
        diffuseColor.rgb=mix(diffuseColor.rgb,vec3(.043,.017,.019),(ewSocket*.77+ewOtherSocket*.39)*ewFront);
      ` : ""}
      float ewRun=exp(-pow((ew.x+.017+sin(ew.y*93.)*.008)/.046,2.))
        *smoothstep(${abdomen}-.30,${abdomen}-.10,ew.y)*(1.-smoothstep(${neck}+.03,${neck}+.12,ew.y));
      float ewBlood=clamp((ewChest*.84+ewBelly*.78+ewJaw*.96+ewRun*.8+ewFaceRun*.82)*(.86+.14*ewCloud)*ewFront,0.,1.);
      ${kind === "hair" ? `ewBlood=clamp(exp(-pow((ew.x-.08)/.12,2.))*smoothstep(${neck}+.02,${neck}+.11,ew.y)*.95,0.,.95);` : ""}
      vec3 ewDry=vec3(.075,.006,.0045), ewWet=vec3(.16,.0065,.004);
      diffuseColor.rgb=mix(diffuseColor.rgb,mix(ewDry,ewWet,ewGrain*.6),ewBlood);
      diffuseColor.rgb*=1.-ewBlood*(.03+.04*ewGrain);
      #include <alphamap_fragment>
    `);
    shader.fragmentShader = shader.fragmentShader.replace("#include <roughnessmap_fragment>", "#include <roughnessmap_fragment>\nroughnessFactor=mix(roughnessFactor,.23,ewBlood*(.5+.5*ewCloud));");
  };
  own.customProgramCacheKey = () => previousKey + `|evelyn-physical-wounds-v2-${kind}`;
  return own;
}

// Original tissue/cavity artwork expressed as real geometry. Every attachment
// is transformed into the measured bone's bind frame, so it follows the body
// through the abrupt reach and cannot float in front of a moving face/shirt.
export function addEvelynWounds(body, rig) {
  const skin = body.getObjectByName("Evelyn_Skin");
  const clothes = body.getObjectByName("Evelyn_Clothes");
  if (!skin?.isMesh || !rig?.joint) throw new Error("Evelyn wounds require her independent skin and measured rig.");
  body.updateMatrixWorld(true);
  const neck = rig.restPoint("neck_01").y;
  const head = rig.restPoint("head").y;
  const metrics = { neck, head };
  const wounds = [
    { name: "Torn left cheek", x: .037, y: head - .029, w: .076, h: .105, angle: -.53, depth: .023, seed: 2, bone: "head", area: "skin" },
    { name: "Open neck slash", x: -.009, y: neck + .005, w: .083, h: .022, angle: -.18, depth: .021, seed: 7, bone: "neck_01", area: "skin" },
    { name: "Upper chest stab", x: -.065, y: neck - .152, w: .080, h: .054, angle: .52, depth: .030, seed: 11, bone: "spine_03", area: "both" },
    { name: "Lower chest stab", x: .060, y: neck - .252, w: .056, h: .086, angle: -.33, depth: .029, seed: 13, bone: "spine_03", area: "both" },
    { name: "Abdominal rupture", x: -.008, y: neck - .421, w: .174, h: .228, angle: .10, depth: .036, seed: 19, bone: "spine_01", area: "both" },
  ];
  const skinSamples = surface(body, skin);
  const clothSamples = clothes ? surface(body, clothes) : null;
  for (const wound of wounds) {
    const sample = wound.area === "both" && clothSamples ? clothSamples : skinSamples;
    wound.frontZ = sample.at(wound.x, wound.y);
  }
  let removedFaces = removeFrontFaces(skin, skinSamples, wounds);
  if (clothes) removedFaces += removeFrontFaces(clothes, clothSamples, wounds.filter(wound => wound.area === "both"));
  const woundMeshes = [];
  const materials = [];
  const own = (material) => { material.userData.evelynWound = true; materials.push(material); return material; };
  const flesh = own(new T.MeshStandardMaterial({ color: 0xffffff, vertexColors: true, roughness: .49, metalness: 0, envMapIntensity: .065, side: T.DoubleSide }));
  // Recess backs represent occluded interior, not a reflective flat fan. The
  // surrounding tissue keeps full PBR shading; the deep cavity stays lightless.
  const cavity = own(new T.MeshBasicMaterial({ color: 0x110202, side: T.DoubleSide }));
  const connective = own(new T.MeshStandardMaterial({ color: 0x65261e, roughness: .39, envMapIntensity: .08 }));
  const boneMaterial = own(new T.MeshStandardMaterial({ color: 0x9d7560, roughness: .55, envMapIntensity: .05 }));
  const teethMaterial = own(new T.MeshStandardMaterial({ color: 0x8d8069, roughness: .42, envMapIntensity: .055 }));
  const fatMaterial = own(new T.MeshStandardMaterial({ color: 0x76573f, roughness: .52, envMapIntensity: .045 }));
  for (const material of [flesh, connective, boneMaterial]) {
    material.onBeforeCompile = shader => {
      shader.vertexShader = "varying vec3 vEwTissue;\n" + shader.vertexShader;
      shader.vertexShader = shader.vertexShader.replace("#include <begin_vertex>", "#include <begin_vertex>\nvEwTissue=position;");
      shader.fragmentShader = "varying vec3 vEwTissue;\n" + SURFACE_NOISE + "\n" + shader.fragmentShader;
      shader.fragmentShader = shader.fragmentShader.replace("#include <color_fragment>", `#include <color_fragment>
        float ewTissueGrain=ewNoise(vEwTissue*420.);
        float ewCollagen=ewNoise(vEwTissue*vec3(210.,1050.,270.));
        float ewVein=1.-smoothstep(.025,.075,abs(ewNoise(vEwTissue*88.)-.49));
        diffuseColor.rgb*=.84+ewTissueGrain*.19+ewCollagen*.07;
        diffuseColor.rgb=mix(diffuseColor.rgb,diffuseColor.rgb*vec3(.56,.37,.32),ewVein*.24);
        float ewRelief=ewTissueGrain*.00032+ewCollagen*.00008;
      `);
      shader.fragmentShader = shader.fragmentShader.replace("#include <roughnessmap_fragment>", "#include <roughnessmap_fragment>\nroughnessFactor=clamp(roughnessFactor+(ewTissueGrain-.5)*.16-ewVein*.07,.20,.76);");
      shader.fragmentShader = shader.fragmentShader.replace("#include <normal_fragment_maps>", `#include <normal_fragment_maps>
        vec3 ewQ0=dFdx(-vViewPosition), ewQ1=dFdy(-vViewPosition);
        vec3 ewR1=cross(ewQ1,normal), ewR2=cross(normal,ewQ0);
        float ewDet=dot(ewQ0,ewR1);
        if(abs(ewDet)>.00000001)
          normal=normalize(abs(ewDet)*normal-sign(ewDet)*(dFdx(ewRelief)*ewR1+dFdy(ewRelief)*ewR2));
      `);
      if (material === flesh) {
        shader.vertexShader = "attribute vec2 evelynRim; varying vec2 vEwRim;\n" + shader.vertexShader;
        shader.vertexShader = shader.vertexShader.replace("#include <begin_vertex>", "#include <begin_vertex>\nvEwRim=evelynRim;");
        shader.fragmentShader = "varying vec2 vEwRim;\n" + shader.fragmentShader;
        shader.fragmentShader = shader.fragmentShader.replace("#include <alphamap_fragment>", `
          float ewClothEdge=vEwRim.x*smoothstep(.96,1.13,vEwRim.y);
          float ewFray=ewNoise(vEwTissue*vec3(970.,390.,570.));
          diffuseColor.rgb=mix(diffuseColor.rgb,vec3(.045,.024,.018),ewClothEdge*(.62+.25*ewFray));
          if(ewClothEdge>.75 && ewFray>.63) discard;
          #include <alphamap_fragment>
        `);
      }
    };
    material.customProgramCacheKey = () => material === flesh ? "evelyn-original-ragged-tissue-v2" : "evelyn-original-tissue-grain-v2";
  }
  const marker = new T.Group();
  marker.name = "Evelyn's physical wounds";
  marker.userData.evelynWounds = true;
  body.add(marker);
  const bind = (geometry, material, name, boneName) => {
    const bone = rig.joint(boneName).bone;
    const transform = bone.matrixWorld.clone().invert().multiply(body.matrixWorld);
    geometry.applyMatrix4(transform);
    const mesh = new T.Mesh(geometry, material);
    mesh.name = name;
    mesh.userData.evelynWound = true;
    mesh.userData.attachmentBone = boneName;
    mesh.receiveShadow = true;
    mesh.castShadow = false;
    bone.add(mesh);
    woundMeshes.push(mesh);
    return mesh;
  };
  for (const wound of wounds) {
    const sample = wound.area === "both" && clothSamples ? clothSamples : skinSamples;
    const ring = [], color = [], rim = [], indices = [], count = 52;
    // The margin falls into the wound; a narrow raised red ring around a black
    // circle reads as stage makeup. These thin, uneven layers instead expose
    // pallid dermis, raw wall and deep muscle as a continuous recession.
    const tones = [new T.Color(0x793a2f), new T.Color(0x78291d), new T.Color(0x6e2019), new T.Color(0x4b110e), new T.Color(0x300807), new T.Color(0x1c0403)];
    const scales = [1.12, 1.025, .955, .86, .64, .36];
    for (let layer = 0; layer < scales.length; layer++) for (let i = 0; i <= count; i++) {
      const angle = i / count * TAU;
      const [x, y] = woundPoint(wound, angle, scales[layer]);
      const pull = .0013 * Math.sin(angle * 5.3 + wound.seed) + .0009 * Math.sin(angle * 11.7);
      const z = sample.at(x, y) + [-.0005, -.0012, .003 + pull, wound.depth * .23, wound.depth * .63, wound.depth * .94][layer] + noise(x, y) * .0007;
      ring.push(x, y, z);
      const tone = tones[layer].clone().multiplyScalar(.96 + .05 * Math.sin(i * 2.13 + wound.seed));
      color.push(tone.r, tone.g, tone.b);
      rim.push(wound.area === "both" ? 1 : 0, scales[layer]);
      if (layer && i < count) {
        const a = (layer - 1) * (count + 1) + i, b = layer * (count + 1) + i;
        indices.push(a, b, a + 1, a + 1, b, b + 1);
      }
    }
    const rimGeometry = new T.BufferGeometry();
    rimGeometry.setAttribute("position", new T.Float32BufferAttribute(ring, 3));
    rimGeometry.setAttribute("color", new T.Float32BufferAttribute(color, 3));
    rimGeometry.setAttribute("evelynRim", new T.Float32BufferAttribute(rim, 2));
    rimGeometry.setIndex(indices);
    rimGeometry.computeVertexNormals();
    bind(rimGeometry, flesh, wound.name + " / ragged skin and cloth margin", wound.bone);
    const recess = [wound.x, wound.y, sample.at(wound.x, wound.y) + wound.depth];
    const recessIndex = [];
    for (let i = 0; i <= count; i++) {
      const [x, y] = woundPoint(wound, i / count * TAU, .88);
      recess.push(x, y, sample.at(x, y) + wound.depth);
      if (i < count) recessIndex.push(0, i + 1, i + 2);
    }
    const inner = new T.BufferGeometry();
    inner.setAttribute("position", new T.Float32BufferAttribute(recess, 3));
    inner.setIndex(recessIndex);
    inner.computeVertexNormals();
    bind(inner, cavity, wound.name + " / recessed cavity", wound.bone);
    if (wound.name === "Torn left cheek") {
      // A damaged mouth corner needs an oral structure, not another circular
      // black decal. The exposed upper row is fixed to the skull; the lower
      // end is deliberately broken rather than pretending to animate a jaw.
      const teeth = [];
      for (let j = 0; j < 5; j++) {
        const x = .019 + j * .0060;
        const y = head - .025 - Math.sin(j * .6) * .0022;
        const tooth = new RoundedBoxGeometry(.0049 + (j % 2) * .0005, .0074 - j * .0004, .0045, 1, .0007);
        tooth.rotateZ(-.16 + j * .087);
        tooth.rotateY((j - 2) * .11);
        tooth.translate(x, y, sample.at(x, y) + .0095);
        teeth.push(tooth);
      }
      for (let j = 0; j < 2; j++) {
        const x = .046 + j * .0051, y = head - .058 - j * .003;
        const tooth = new RoundedBoxGeometry(.0038, .0057, .004, 1, .0007);
        tooth.rotateZ(.4 + j * .19);
        tooth.translate(x, y, sample.at(x, y) + .007);
        teeth.push(tooth);
      }
      bind(mergeGeometries(teeth), teethMaterial, "Exposed cheek teeth and broken jaw fragments", "head");
      const gumPath = Array.from({ length: 9 }, (_, j) => {
        const x = .017 + j * .0041, y = head - .020 - Math.sin(j * .48) * .0022;
        return new T.Vector3(x, y, sample.at(x, y) + .011);
      });
      bind(new T.TubeGeometry(new T.CatmullRomCurve3(gumPath), 20, .0026, 7, false), connective, "Torn cheek / exposed gingiva", "head");
      const strips = [];
      for (let j = 0; j < 3; j++) {
        const x = .038 + j * .009;
        const path = [
          new T.Vector3(x, head + .014, sample.at(x, head + .014) + .003),
          new T.Vector3(x + .007, head - .012, sample.at(x, head - .012) + .015),
          new T.Vector3(x - .002, head - .048 - j * .003, sample.at(x, head - .048) + .009),
        ];
        strips.push(new T.TubeGeometry(new T.CatmullRomCurve3(path), 14, .0014 + j * .00025, 5, false));
      }
      bind(mergeGeometries(strips), connective, "Torn cheek / stretched connective strips", "head");
      continue;
    }
    if (wound.name === "Abdominal rupture") {
      // A folded serosal sheet and crossing, locally lobed loops replace the
      // old four parallel red cylinders. Their ends remain inside the cavity.
      const sheet = new T.BufferGeometry(), sheetPositions = [], sheetIndex = [];
      const sheetRows = 7, sheetSegments = 44;
      for (let row = 0; row <= sheetRows; row++) for (let segment = 0; segment <= sheetSegments; segment++) {
        const [x, y] = woundPoint(wound, segment / sheetSegments * TAU, row / sheetRows * .84);
        const z = sample.at(x, y) + wound.depth * .42 + Math.sin(y * 135. + x * 21.) * .007 + Math.sin(x * 110.) * .003;
        sheetPositions.push(x, y, z);
        if (row && segment < sheetSegments) {
          const a = (row - 1) * (sheetSegments + 1) + segment, b = row * (sheetSegments + 1) + segment;
          sheetIndex.push(a, b, a + 1, a + 1, b, b + 1);
        }
      }
      sheet.setAttribute("position", new T.Float32BufferAttribute(sheetPositions, 3));
      sheet.setIndex(sheetIndex);
      sheet.computeVertexNormals();
      bind(sheet, connective, "Abdominal rupture / folded visceral wall", wound.bone);
      const loopParts = [];
      for (let j = 0; j < 2; j++) {
        const route = j === 0
          ? [[-.060,.073],[-.033,.043],[.042,.021],[.050,-.015],[-.036,-.045],[-.025,-.090],[.051,-.092]]
          : [[.060,.068],[.023,.051],[-.038,.021],[-.040,-.012],[.029,-.040],[.035,-.076],[-.051,-.091]];
        const path = route.map(([x, y], k) => {
          x += wound.x; y += wound.y;
          const attachment = k === 0 || k === route.length - 1;
          return new T.Vector3(x, y, sample.at(x, y) + (attachment ? .014 : -.010 + Math.sin(k * 1.7 + j) * .004));
        });
        const curve = new T.CatmullRomCurve3(path);
        const loop = new T.TubeGeometry(curve, 46, .0090, 8, false);
        const p = loop.attributes.position;
        for (let segment = 0; segment <= 46; segment++) {
          const centre = curve.getPointAt(segment / 46);
          const strength = .78 + .17 * Math.sin(segment * 1.37 + j) + .10 * Math.sin(segment * .41);
          for (let radial = 0; radial <= 8; radial++) {
            const i = segment * 9 + radial;
            const point = new T.Vector3().fromBufferAttribute(p, i).sub(centre);
            point.multiplyScalar(strength + .06 * Math.sin(radial * 2.8 + segment));
            point.z *= .67;
            point.add(centre);
            p.setXYZ(i, point.x, point.y, point.z);
          }
        }
        loop.computeVertexNormals();
        loopParts.push(loop);
      }
      bind(mergeGeometries(loopParts), connective, "Abdominal rupture / exposed irregular visceral loops", wound.bone);
      const lobules = [];
      for (let j = 0; j < 9; j++) {
        const x = wound.x - .032 + j * .0066, y = wound.y + .062 + Math.sin(j * .83) * .004;
        const lobe = new T.SphereGeometry(1, 9, 7);
        lobe.scale(.005 + (j % 3) * .0012, .0040, .0027);
        lobe.rotateZ(j * .53);
        lobe.translate(x, y, sample.at(x, y) + .016);
        lobules.push(lobe);
      }
      bind(mergeGeometries(lobules), fatMaterial, "Abdominal rupture / torn mesenteric fat", wound.bone);
      continue;
    }
    // Short, irregular connective folds stay inside each opening. The large
    // abdominal opening has layered exposed tissue and two broken rib edges.
    const folds = wound.name === "Abdominal rupture" ? 4 : 2;
    for (let j = 0; j < folds; j++) {
      const side = j % 2 ? -1 : 1;
      const y = wound.y + (j / Math.max(1, folds - 1) - .5) * wound.h * .58;
      const points = [];
      for (let k = 0; k < 7; k++) {
        const x = wound.x + (k / 6 - .5) * wound.w * .64;
        const py = y + Math.sin(k * .75 + j) * wound.h * .055;
        points.push(new T.Vector3(x, py, sample.at(x, py) + wound.depth * (.46 + .10 * Math.sin(k + j))));
      }
      const curve = new T.CatmullRomCurve3(points);
      const radius = wound.name === "Abdominal rupture" ? .0087 + (j % 2) * .001 : .0022;
      const tissue = new T.TubeGeometry(curve, 18, radius, 8, false);
      const tissuePositions = tissue.attributes.position;
      for (let segment = 0; segment <= 18; segment++) {
        const centre = curve.getPointAt(segment / 18);
        for (let radial = 0; radial <= 8; radial++) {
          const i = segment * 9 + radial;
          const point = new T.Vector3().fromBufferAttribute(tissuePositions, i).sub(centre);
          point.multiplyScalar(.86 + .12 * Math.sin(segment * 1.1 + radial * 2.8 + j)).add(centre);
          tissuePositions.setXYZ(i, point.x, point.y, point.z);
        }
      }
      tissue.computeVertexNormals();
      bind(tissue, connective, wound.name + ` / tissue fold ${j + 1}`, wound.bone);
      if (wound.name === "Upper chest stab" && j < 2) {
        const rib = [new T.Vector3(wound.x + side * .031, wound.y + .009 - j * .019, sample.at(wound.x, wound.y) + .014), new T.Vector3(wound.x + side * .014, wound.y + .015 - j * .019, sample.at(wound.x, wound.y) + .023)];
        bind(new T.TubeGeometry(new T.CatmullRomCurve3(rib), 7, .0033, 6, false), boneMaterial, `Exposed rib edge ${j + 1}`, wound.bone);
      }
    }
  }
  // Blood transfer and matted hair use rest-space attributes on owned geometry;
  // the clean Evelyn in the casket retains her original meshes and materials.
  body.traverse(mesh => {
    if (!mesh.isMesh || mesh.userData.evelynWound) return;
    const kind = /Hair/.test(mesh.name) ? "hair" : /Skin/.test(mesh.name) ? "skin" : /Clothes/.test(mesh.name) ? "cloth" : null;
    if (!kind) return;
    if (!mesh.geometry.getAttribute("evelynWoundRest")) {
      const samples = surface(body, mesh);
      const geometry = mesh.geometry.clone();
      const rest = new Float32Array(samples.points.length * 3);
      samples.points.forEach((point, i) => point.toArray(rest, i * 3));
      geometry.setAttribute("evelynWoundRest", new T.BufferAttribute(rest, 3));
      mesh.geometry = geometry;
    }
    mesh.material = Array.isArray(mesh.material)
      ? mesh.material.map(material => stainMaterial(material, kind, metrics, wounds))
      : stainMaterial(mesh.material, kind, metrics, wounds);
  });
  const triangles = woundMeshes.reduce((sum, mesh) => sum + (mesh.geometry.index ? mesh.geometry.index.count : mesh.geometry.attributes.position.count) / 3, 0);
  const stats = { wounds: wounds.length, meshes: woundMeshes.length, triangles, removedFaces, attachedBones: [...new Set(woundMeshes.map(mesh => mesh.userData.attachmentBone))] };
  marker.userData.stats = stats;
  body.userData.evelynWounded = true;
  return { group: marker, meshes: woundMeshes, stats, wounds: wounds.map(wound => ({ ...wound })) };
}
