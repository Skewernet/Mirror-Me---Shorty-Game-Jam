import * as T from "three";
import { createFigure } from "./figure.mjs";
import { FigureRig } from "./figure-motion.mjs";

// The house kept the same furniture while Mara kept a different account of it.
// Every new image below is deterministic canvas artwork; no external gore asset
// or sound is loaded. The covered figure reuses the already credited CC0 rig.
export function buildRevelation(b, m, surfaces) {
  const group = b.group();
  group.name = "What the mirror remembers";
  group.userData.revelation = true;
  group.visible = false;
  const initialColliders = b.colliders.length;
  let originalQuilt = null;
  b.scene.traverse((object) => {
    if (
      object.geometry?.type === "PlaneGeometry" &&
      object.geometry.parameters.width === 1.67 &&
      object.geometry.parameters.height === 1.65 &&
      object.parent?.position.x === 7.4 &&
      object.parent?.position.z === -3.28
    )
      originalQuilt = object;
  });
  const materials = [];
  const stains = [];
  const own = (material) => {
    material.userData.revelation = true;
    materials.push(material);
    return material;
  };
  const plain = (color, roughness = 0.8, metalness = 0) =>
    own(
      new T.MeshStandardMaterial({
        color,
        roughness,
        metalness,
        envMapIntensity: 0.06,
      }),
    );
  function add(geometry, material, x, y, z, name) {
    const mesh = new T.Mesh(geometry, material);
    mesh.name = name;
    mesh.position.set(x, y, z);
    mesh.receiveShadow = true;
    mesh.castShadow = false;
    mesh.userData.revelation = true;
    group.add(mesh);
    return mesh;
  }
  function decal(kind, seed, w, h, x, y, z, rotation = 0, wall = false) {
    const material = own(
      new T.MeshStandardMaterial({
        map: bloodMap(kind, seed),
        color: 0xffffff,
        transparent: true,
        opacity: 0.98,
        alphaTest: 0.018,
        depthWrite: false,
        side: T.DoubleSide,
        forceSinglePass: true,
        roughness: kind === "pool" ? 0.25 : 0.58,
        metalness: 0,
        envMapIntensity: 0.14,
        polygonOffset: true,
        polygonOffsetFactor: -1,
        polygonOffsetUnits: -1,
      }),
    );
    const mesh = add(
      wall ? wallDecalGeometry(w, h, y) : new T.PlaneGeometry(w, h),
      material,
      x,
      y,
      z,
      `Blood / ${kind}`,
    );
    mesh.rotation.y = rotation;
    stains.push(mesh);
    return mesh;
  }
  function floorDecal(kind, seed, w, d, x, z, angle = 0) {
    const mesh = decal(kind, seed, w, d, x, 0.006, z);
    mesh.rotation.set(-Math.PI / 2, 0, angle);
    return mesh;
  }

  // A single continuous spill joins the bed, the care tray and the way Mara
  // stood. Its broken edge leaves floor grain readable instead of painting a
  // rectangular red carpet over the room.
  floorDecal("pool", 712, 3.02, 3.34, 7.38, -2.79, -0.06);
  floorDecal("drag", 970, 0.86, 1.34, 7.47, -1.25, 0.025);
  floorDecal("transfer", 225, 0.75, 0.61, 7.38, -0.47, -0.14);
  // A partial transfer on the hall side is only visible after crossing the
  // mirror. The room, rather than an arbitrary written symbol, is the source.
  floorDecal("transfer", 226, 0.42, 0.56, 7.26, 0.13, 0.23);

  // Cast-off above the bed continues onto the east wall; downward drips share
  // gravity even in the inverted house. Keep these clear of the window opening.
  decal("cast", 551, 1.2, 1.77, 6.12, 1.39, -4.599, 0, true);
  decal("cast", 552, 1.13, 1.98, 8.49, 1.28, -4.599, 0, true);
  decal("impact", 412, 2.72, 1.91, 9.199, 1.27, -2.92, -Math.PI / 2, true);
  decal("hand", 391, 0.57, 0.87, 9.199, 1.22, -1.66, -Math.PI / 2, true);
  const overhead = decal("cast", 553, 1.91, 1.18, 7.61, 2.318, -3.3);
  overhead.rotation.x = Math.PI / 2;
  overhead.rotation.z = -0.19;

  const shroudMaps = linenMaps();
  const shroudMaterial = own(surfaces.material("linen", 1.6, 2.2, 0xffffff));
  shroudMaterial.map = shroudMaps.color;
  shroudMaterial.roughnessMap = shroudMaps.roughness;
  shroudMaterial.roughness = 1;
  shroudMaterial.side = T.DoubleSide;
  shroudMaterial.envMapIntensity = 0.08;
  shroudMaterial.normalScale.set(0.34, 0.34);
  const shroud = add(
    shroudGeometry(),
    shroudMaterial,
    7.4,
    0.705,
    -3.18,
    "The covered bed",
  );
  shroud.rotation.x = -Math.PI / 2;
  shroud.castShadow = true;

  // The old bed still exists below this one continuous drape. A soaked fall
  // carries the stain over its right edge, linking linen and floor physically.
  const sideCloth = add(
    sideClothGeometry(),
    shroudMaterial,
    8.126,
    0.66,
    -3.23,
    "Soaked hanging linen",
  );
  sideCloth.castShadow = true;
  const pillowStain = decal("impact", 760, 0.97, 0.48, 7.42, 0.739, -3.98);
  pillowStain.rotation.x = -Math.PI / 2;

  // A caregiving tray has been left on the floor with the household knife in
  // it. The silhouette stays readable: dull steel blade, black handle, rivets.
  const tray = b.group(8.46, 0.008, -1.78, -0.25, group);
  tray.name = "The care tray on the floor";
  const trayMetal = plain(0x888c81, 0.42, 0.72);
  b.box(0.49, 0.016, 0.37, 0, 0, 0, trayMetal, false, tray, 0.012);
  for (const side of [-1, 1]) {
    b.box(
      0.49,
      0.018,
      0.012,
      0,
      0.013,
      side * 0.181,
      trayMetal,
      false,
      tray,
      0.004,
    );
    b.box(
      0.012,
      0.018,
      0.36,
      side * 0.239,
      0.013,
      0,
      trayMetal,
      false,
      tray,
      0.004,
    );
  }
  const trayBlood = new T.Mesh(
    new T.PlaneGeometry(0.45, 0.33),
    own(
      new T.MeshStandardMaterial({
        map: bloodMap("pool", 752),
        transparent: true,
        depthWrite: false,
        roughness: 0.22,
        polygonOffset: true,
        polygonOffsetFactor: -1,
      }),
    ),
  );
  trayBlood.position.y = 0.0085;
  trayBlood.rotation.x = -Math.PI / 2;
  tray.add(trayBlood);
  const knife = b.group(0, 0.02, 0.005, -0.48, tray);
  knife.name = "The kitchen knife";
  const handle = plain(0x25251f, 0.54);
  b.box(0.036, 0.024, 0.135, 0, 0, 0.095, handle, false, knife, 0.009);
  for (let i = 0; i < 3; i++)
    b.cylinder(
      0.0038,
      0.0038,
      0.026,
      0,
      0,
      0.05 + i * 0.044,
      trayMetal,
      knife,
      10,
    );
  const bladeShape = new T.Shape();
  bladeShape.moveTo(-0.017, 0.03);
  bladeShape.lineTo(-0.021, -0.075);
  bladeShape.quadraticCurveTo(-0.017, -0.141, 0.025, -0.188);
  bladeShape.lineTo(0.028, 0.03);
  bladeShape.closePath();
  const bladeGeometry = new T.ExtrudeGeometry(bladeShape, {
    depth: 0.0025,
    bevelEnabled: false,
  });
  const blade = new T.Mesh(bladeGeometry, plain(0x9b9f96, 0.29, 0.86));
  blade.rotation.x = Math.PI / 2;
  blade.position.y = 0.002;
  blade.castShadow = true;
  knife.add(blade);
  const bladeBlood = new T.Mesh(
    new T.ShapeGeometry(bladeShape),
    own(
      new T.MeshStandardMaterial({
        map: bloodMap("blade", 814),
        transparent: true,
        depthWrite: false,
        roughness: 0.31,
        side: T.DoubleSide,
      }),
    ),
  );
  const bladeUV = bladeBlood.geometry.attributes.uv;
  const bladePositions = bladeBlood.geometry.attributes.position;
  for (let i = 0; i < bladeUV.count; i++)
    bladeUV.setXY(
      i,
      (bladePositions.getX(i) + 0.021) / 0.049,
      (bladePositions.getY(i) + 0.188) / 0.218,
    );
  bladeBlood.rotation.x = Math.PI / 2;
  bladeBlood.position.y = 0.0023;
  knife.add(bladeBlood);

  // An ordinary enamel wash basin, a folded towel and bloody water retain the
  // sickroom's purpose. They remain outside both bedside approaches.
  const basin = b.group(6.06, 0.002, -2.96, 0.17, group);
  basin.name = "The washing bowl";
  const enamel = plain(0xc7c6af, 0.34);
  const rim = b.lathe(
    [
      [0, 0],
      [0.12, 0],
      [0.17, 0.02],
      [0.205, 0.085],
      [0.206, 0.105],
      [0.193, 0.11],
      [0.18, 0.07],
      [0.12, 0.024],
      [0, 0.024],
    ],
    0,
    0,
    0,
    enamel,
    basin,
  );
  rim.castShadow = true;
  const water = new T.Mesh(
    new T.CircleGeometry(0.179, 40),
    plain(0x4e171a, 0.14),
  );
  water.rotation.x = -Math.PI / 2;
  water.position.y = 0.072;
  basin.add(water);
  const towel = new T.Mesh(
    new T.PlaneGeometry(0.28, 0.4, 12, 16),
    shroudMaterial,
  );
  const towelPositions = towel.geometry.attributes.position;
  for (let i = 0; i < towelPositions.count; i++) {
    const x = towelPositions.getX(i),
      y = towelPositions.getY(i);
    towelPositions.setZ(
      i,
      0.015 * Math.sin(x * 42 + y * 11) - Math.max(0, y + 0.015) * 0.55,
    );
  }
  towel.geometry.computeVertexNormals();
  towel.position.set(-0.12, 0.095, 0.02);
  towel.rotation.x = -Math.PI / 2;
  basin.add(towel);

  const fill = new T.PointLight(0xe1d7c5, 0, 3.5, 2);
  fill.position.set(7.0, 1.39, -2.25);
  group.add(fill);
  let prepared = false;
  let patient = null;
  let lastTime = -1;
  let truth = false;
  const addedColliders = b.colliders.length - initialColliders;

  function prepare() {
    if (prepared) return true;
    // The same licensed adult mesh supplies only the exposed arm and hand. Its
    // head and body are covered; no healthy Mara duplicate is presented as Mum.
    const figure = createFigure(null, 0);
    figure.setEvidenceBlood?.(0.74);
    const body = figure.body;
    body.name = "Evelyn beneath the linen";
    body.position.set(7.4, 0.685, -2.35);
    body.rotation.set(-Math.PI / 2, Math.PI, 0, "XYZ");
    group.add(body);
    const visual = body.children[0];
    const rig = new FigureRig(body, visual);
    const side = rig.sides.find((s) => s.shoulder.x < 0) || rig.sides[0];
    const suffix = side.side;
    const wrist = rig.bodyPoint(new T.Vector3(-0.76, 1.2, 0.06));
    const elbow = rig.bodyPoint(new T.Vector3(-0.55, 1.37, 0.02));
    rig.solveLimb(
      `upperarm_${suffix}`,
      `lowerarm_${suffix}`,
      `hand_${suffix}`,
      wrist,
      elbow,
      side.upperArm,
      side.lowerArm,
    );
    for (const finger of ["index", "middle", "ring", "pinky"])
      for (let segment = 1; segment <= 3; segment++)
        rig.rotate(`${finger}_0${segment}_${suffix}`, -0.08 * segment, 0, 0);
    rig.update();
    body.traverse((object) => {
      object.userData.revelation = true;
      if (!object.isMesh) return;
      object.castShadow = false;
      if (/Eyes|Hair|Brows|Lashes|Clothes|Shoes/.test(object.name))
        object.visible = false;
      for (const material of Array.isArray(object.material)
        ? object.material
        : [object.material]) {
        material.userData.revelation = true;
        material.envMapIntensity = 0.035;
        material.roughness = 0.86;
        if (/Skin/.test(material.name)) {
          material.color.set(0xa39c87);
          const previous = material.onBeforeCompile;
          material.onBeforeCompile = function (shader, renderer) {
            previous.call(this, shader, renderer);
            shader.vertexShader =
              "varying vec3 vRevelationPatientWorld;\n" + shader.vertexShader;
            shader.vertexShader = shader.vertexShader.replace(
              "#include <project_vertex>",
              "#include <project_vertex>\nvRevelationPatientWorld=(modelMatrix*vec4(transformed,1.)).xyz;",
            );
            shader.fragmentShader =
              "varying vec3 vRevelationPatientWorld;\n" + shader.fragmentShader;
            shader.fragmentShader = shader.fragmentShader.replace(
              "#include <clipping_planes_fragment>",
              `#include <clipping_planes_fragment>
              if(vRevelationPatientWorld.x<7.97||vRevelationPatientWorld.z< -3.82||vRevelationPatientWorld.z> -3.04)discard;`,
            );
            shader.fragmentShader = shader.fragmentShader.replace(
              "#include <map_fragment>",
              `#include <map_fragment>
              float oldSkin=dot(diffuseColor.rgb,vec3(.2126,.7152,.0722));
              diffuseColor.rgb=mix(diffuseColor.rgb,vec3(oldSkin)*vec3(.78,.76,.64),.64);`,
            );
          };
          material.customProgramCacheKey = () =>
            "revelation-covered-aged-hand-v2";
        }
        if (/Clothes|Shoes/.test(material.name)) material.color.set(0x51564e);
      }
    });
    patient = { body, rig, hand: rig.point(`hand_${suffix}`) };
    prepared = true;
    return true;
  }
  function reset() {
    group.visible = false;
    if (originalQuilt) originalQuilt.visible = true;
    fill.intensity = 0;
    truth = false;
    lastTime = -1;
  }
  function animate(time, state) {
    if (time < lastTime) reset();
    lastTime = time;
    group.visible = Boolean(state.inverted || state.stage >= 6);
    if (originalQuilt) originalQuilt.visible = !group.visible;
    truth = Boolean(state.truthFound || state.farewellSaid);
    fill.intensity = group.visible ? (state.lampOff ? 0.12 : 0.55) : 0;
  }
  return {
    group,
    prepare,
    animate,
    reset,
    snapshot: () => ({
      visible: group.visible,
      truthAcknowledged: truth,
      patientPrepared: prepared,
      coveredBody: prepared && group.visible,
      bloodSurfaces: group.visible ? stains.length : 0,
      knife: group.visible,
      newColliders: addedColliders,
      handPosition: patient?.hand.toArray() || null,
    }),
  };
}

function generator(seed) {
  return () =>
    (seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 4294967296;
}
function canvas(w = 768, h = w) {
  const image = document.createElement("canvas");
  image.width = w;
  image.height = h;
  return [image, image.getContext("2d")];
}
function map(image) {
  const texture = new T.CanvasTexture(image);
  texture.colorSpace = T.SRGBColorSpace;
  texture.anisotropy = 4;
  texture.minFilter = T.LinearMipmapLinearFilter;
  texture.magFilter = T.LinearFilter;
  return texture;
}
function blob(g, x, y, rx, ry, rand, color, alpha = 1, wobble = 0.15) {
  g.save();
  g.translate(x, y);
  g.scale(rx, ry);
  g.beginPath();
  for (let i = 0; i <= 70; i++) {
    const a = (i / 70) * Math.PI * 2;
    const r =
      1 +
      wobble * Math.sin(a * 7 + x * 4) +
      wobble * 0.6 * Math.sin(a * 13 + y * 3);
    const px = Math.cos(a) * r,
      py = Math.sin(a) * r;
    if (!i) g.moveTo(px, py);
    else g.lineTo(px, py);
  }
  g.closePath();
  g.globalAlpha = alpha;
  g.fillStyle = color;
  g.fill();
  g.restore();
}
function bloodMap(kind, seed) {
  const [image, g] = canvas();
  const r = generator(seed);
  g.scale(image.width, image.height);
  g.lineCap = "round";
  if (kind === "pool") {
    blob(g, 0.5, 0.52, 0.38, 0.34, r, "#421c1b", 0.56, 0.16);
    for (let i = 0; i < 52; i++) {
      const a = r() * Math.PI * 2,
        d = Math.sqrt(r());
      const x = 0.5 + Math.cos(a) * d * 0.33,
        y = 0.52 + Math.sin(a) * d * 0.3;
      blob(
        g,
        x,
        y,
        0.025 + r() * 0.15,
        0.02 + r() * 0.105,
        r,
        i % 3 ? "#551418" : "#761c20",
        0.45 + r() * 0.4,
        0.13,
      );
    }
    for (let i = 0; i < 180; i++) {
      const x = 0.09 + r() * 0.82,
        y = 0.09 + r() * 0.83;
      blob(
        g,
        x,
        y,
        0.001 + r() * 0.006,
        0.001 + r() * 0.008,
        r,
        "#63171b",
        0.25 + r() * 0.55,
      );
    }
    // Thin brighter edges separate a wet surface from the almost black centre.
    for (let i = 0; i < 16; i++) {
      const x = 0.18 + r() * 0.64,
        y = 0.22 + r() * 0.58;
      g.strokeStyle = "rgba(139,43,39,.16)";
      g.lineWidth = 0.002 + r() * 0.003;
      g.beginPath();
      g.ellipse(x, y, 0.015 + r() * 0.08, 0.005 + r() * 0.012, r(), 0, Math.PI);
      g.stroke();
    }
  } else if (kind === "hand") {
    blob(g, 0.52, 0.42, 0.15, 0.12, r, "#65191c", 0.74, 0.08);
    for (const [x, y, tx, ty, width] of [
      [0.38, 0.43, 0.23, 0.3, 0.055],
      [0.42, 0.37, 0.37, 0.12, 0.047],
      [0.5, 0.34, 0.5, 0.07, 0.047],
      [0.59, 0.36, 0.63, 0.13, 0.043],
      [0.65, 0.41, 0.75, 0.24, 0.037],
    ]) {
      g.strokeStyle = "rgba(94,17,22,.82)";
      g.lineWidth = width;
      g.beginPath();
      g.moveTo(x, y);
      g.bezierCurveTo(x - 0.01, y - 0.08, tx, ty + 0.06, tx, ty);
      g.stroke();
    }
    for (let i = 0; i < 14; i++) {
      const x = 0.35 + r() * 0.33;
      g.strokeStyle = `rgba(94,21,22,${0.16 + r() * 0.24})`;
      g.lineWidth = 0.003 + r() * 0.016;
      g.beginPath();
      g.moveTo(x, 0.48 + r() * 0.05);
      g.bezierCurveTo(x + 0.025, 0.62, x - 0.015, 0.77, x + 0.06, 0.91);
      g.stroke();
    }
    g.globalCompositeOperation = "destination-out";
    for (let i = 0; i < 320; i++) {
      g.fillStyle = `rgba(0,0,0,${r() * 0.5})`;
      g.fillRect(r(), r() * 0.58, 0.001 + r() * 0.006, 0.001 + r() * 0.003);
    }
  } else if (kind === "drag" || kind === "transfer") {
    const count = kind === "drag" ? 29 : 13;
    for (let i = 0; i < count; i++) {
      const x = 0.18 + r() * 0.64,
        y = 0.12 + r() * 0.28;
      g.lineWidth = 0.004 + r() * 0.032;
      g.strokeStyle = `rgba(93,20,22,${0.15 + r() * 0.46})`;
      g.beginPath();
      g.moveTo(x, y);
      g.bezierCurveTo(
        x - 0.035,
        0.4,
        x + 0.06,
        0.55,
        x + (r() - 0.5) * 0.2,
        0.61 + r() * 0.27,
      );
      g.stroke();
    }
    for (let i = 0; i < 50; i++)
      blob(
        g,
        r(),
        r(),
        0.001 + r() * 0.009,
        0.002 + r() * 0.013,
        r,
        "#66161b",
        0.2 + r() * 0.45,
      );
  } else if (kind === "blade") {
    g.fillStyle = "rgba(83,12,18,.62)";
    g.fillRect(0.25, 0.06, 0.75, 0.86);
    for (let i = 0; i < 10; i++)
      blob(
        g,
        r(),
        r(),
        0.08 + r() * 0.15,
        0.08 + r() * 0.23,
        r,
        "#8e2026",
        0.5,
      );
  } else {
    const impact = kind === "impact";
    if (impact)
      for (let i = 0; i < 14; i++)
        blob(
          g,
          0.35 + r() * 0.4,
          0.3 + r() * 0.32,
          0.025 + r() * 0.08,
          0.015 + r() * 0.05,
          r,
          "#642025",
          0.28 + r() * 0.55,
        );
    const count = impact ? 360 : 230;
    for (let i = 0; i < count; i++) {
      const angle = -1.0 + r() * 1.3,
        d = Math.pow(r(), 0.68);
      const x = impact ? 0.51 + Math.cos(angle) * d * 0.43 : 0.08 + r() * 0.86;
      const y = impact
        ? 0.6 + Math.sin(angle) * d * 0.46
        : 0.2 + 0.23 * Math.sin(x * 4.7) + r() * 0.16;
      const radius = 0.0008 + Math.pow(r(), 3) * 0.012;
      blob(
        g,
        x,
        y,
        radius,
        radius * (0.7 + r() * 1.6),
        r,
        i % 4 ? "#712027" : "#8a282b",
        0.38 + r() * 0.46,
      );
      if (i % 9 === 0) {
        g.strokeStyle = "rgba(89,20,24,.60)";
        g.lineWidth = radius * 0.9;
        g.beginPath();
        g.moveTo(x, y);
        g.lineTo(x + (r() - 0.5) * 0.01, y + 0.02 + r() * 0.21);
        g.stroke();
      }
    }
    // Several long, interrupted arcs, rather than a uniform random spray.
    for (let j = 0; j < 5; j++) {
      g.strokeStyle = `rgba(100,25,29,${0.15 + r() * 0.3})`;
      g.lineWidth = 0.001 + r() * 0.0026;
      g.beginPath();
      g.moveTo(0.06, 0.39 + j * 0.04);
      g.bezierCurveTo(
        0.28,
        0.02 + j * 0.055,
        0.54,
        0.05 + j * 0.03,
        0.91,
        0.29 + j * 0.075,
      );
      g.stroke();
    }
  }
  return map(image);
}
function linenMaps() {
  const [color, g] = canvas(1024, 1536),
    [roughness, rg] = canvas(1024, 1536);
  const r = generator(7158);
  g.fillStyle = "#c5c2ae";
  g.fillRect(0, 0, 1024, 1536);
  rg.fillStyle = "#ececec";
  rg.fillRect(0, 0, 1024, 1536);
  g.scale(1024, 1536);
  rg.scale(1024, 1536);
  for (let i = 0; i < 26000; i++) {
    g.fillStyle = i % 2 ? "rgba(66,56,42,.035)" : "rgba(255,255,232,.05)";
    g.fillRect(r(), r(), 0.001 + r() * 0.002, 0.0003 + r() * 0.001);
  }
  for (let i = 0; i < 85; i++) {
    const x = 0.5 + (r() - 0.5) * 0.78,
      y = 0.22 + (r() - 0.5) * 0.35;
    const rx = 0.025 + r() * 0.18,
      ry = 0.017 + r() * 0.075;
    blob(
      g,
      x,
      y,
      rx,
      ry,
      r,
      i % 3 ? "#612225" : "#873036",
      0.29 + r() * 0.44,
      0.13,
    );
    blob(rg, x, y, rx, ry, r, "#d0d0d0", 0.48, 0.13);
  }
  for (let i = 0; i < 44; i++) {
    const x = 0.36 + r() * 0.38,
      y = 0.15 + r() * 0.24;
    blob(
      g,
      x,
      y,
      0.02 + r() * 0.08,
      0.015 + r() * 0.05,
      r,
      i % 3 ? "#4c161b" : "#781b24",
      0.6,
      0.1,
    );
    blob(
      rg,
      x,
      y,
      0.02 + r() * 0.08,
      0.015 + r() * 0.05,
      r,
      "#b8b8b8",
      0.64,
      0.1,
    );
  }
  g.lineCap = "round";
  for (let i = 0; i < 42; i++) {
    const x = 0.19 + r() * 0.68,
      y = 0.23 + r() * 0.17;
    g.strokeStyle = `rgba(102,27,29,${0.12 + r() * 0.39})`;
    g.lineWidth = 0.002 + r() * 0.011;
    g.beginPath();
    g.moveTo(x, y);
    g.bezierCurveTo(
      x - 0.02,
      0.4,
      x + 0.025,
      0.5,
      x + (r() - 0.5) * 0.06,
      0.49 + r() * 0.39,
    );
    g.stroke();
  }
  for (let i = 0; i < 460; i++)
    blob(
      g,
      r(),
      0.12 + r() * 0.72,
      0.0006 + r() * 0.004,
      0.001 + r() * 0.006,
      r,
      "#6f2428",
      0.25 + r() * 0.35,
    );
  const colorMap = map(color),
    roughnessMap = map(roughness);
  roughnessMap.colorSpace = T.NoColorSpace;
  return { color: colorMap, roughness: roughnessMap };
}
function shroudGeometry() {
  const geo = new T.PlaneGeometry(1.72, 2.28, 64, 88),
    p = geo.attributes.position;
  const bump = (x, z, cx, cz, rx, rz, h) =>
    h * Math.exp(-(((x - cx) / rx) ** 2 + ((z - cz) / rz) ** 2) * 2);
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i),
      localY = p.getY(i),
      z = -3.18 - localY;
    let height =
      bump(x, z, 0, -3.95, 0.24, 0.29, 0.165) +
      bump(x, z, 0, -3.53, 0.39, 0.44, 0.165) +
      bump(x, z, -0.13, -2.91, 0.16, 0.48, 0.115) +
      bump(x, z, 0.13, -2.91, 0.16, 0.48, 0.115) +
      bump(x, z, -0.12, -2.34, 0.11, 0.18, 0.1) +
      bump(x, z, 0.12, -2.34, 0.11, 0.18, 0.1);
    height +=
      0.006 * Math.sin(x * 48 + z * 14) + 0.004 * Math.cos(x * 27 - z * 26);
    height -= Math.max(0, Math.abs(x) - 0.66) * 1.8;
    height -= Math.max(0, z + 2.2) * 1.1;
    p.setZ(i, height);
  }
  geo.computeVertexNormals();
  return geo;
}
function sideClothGeometry() {
  const geo = new T.PlaneGeometry(0.59, 1.91, 18, 54),
    p = geo.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const u = (p.getX(i) + 0.295) / 0.59,
      v = p.getY(i);
    p.setXYZ(
      i,
      0.035 * Math.sin(v * 21 + u * 4) * u,
      -u * 0.55 + Math.sin(v * 16) * 0.006,
      -v,
    );
  }
  geo.computeVertexNormals();
  return geo;
}

// Architecture uses 4mm panel skins, a 9mm dado and 12.5mm skirting. Fold the
// stain across those actual surfaces instead of floating a flat billboard in
// front of the room. The caller places the wallpaper portion 1mm off its face.
function wallDecalGeometry(width, height, centreY) {
  const rows = [-height / 2, height / 2];
  for (const y of [0.005, 0.105, 0.72, 0.7625, 0.7975, 2.24, 2.31])
    for (const edge of [-0.00025, 0.00025]) {
      const localY = y + edge - centreY;
      if (localY > -height / 2 && localY < height / 2) rows.push(localY);
    }
  rows.sort((a, b) => a - b);
  const positions = [],
    uv = [],
    indices = [];
  function depth(y) {
    if ((y >= 0.005 && y <= 0.105) || (y >= 2.24 && y <= 2.31)) return 0.0125;
    if (y >= 0.7625 && y <= 0.7975) return 0.009;
    return y <= 0.72 ? 0.004 : 0;
  }
  rows.forEach((y, row) => {
    positions.push(
      -width / 2,
      y,
      depth(y + centreY),
      width / 2,
      y,
      depth(y + centreY),
    );
    uv.push(0, y / height + 0.5, 1, y / height + 0.5);
    if (row) {
      const a = (row - 1) * 2,
        b = row * 2;
      indices.push(a, a + 1, b, a + 1, b + 1, b);
    }
  });
  const geometry = new T.BufferGeometry();
  geometry.setAttribute("position", new T.Float32BufferAttribute(positions, 3));
  geometry.setAttribute("uv", new T.Float32BufferAttribute(uv, 2));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}
