import * as T from "three";
import { TARGETS } from "./layout.mjs";
import { writingTexture } from "./surfaces.mjs";
import { WRITINGS } from "./story.mjs";

// Original keepsake models and receiver artwork. They sit on existing furniture
// and add no navigation colliders. Each object has its own readable silhouette.
export function addPuzzleProps(b, m, rooms, { diary, bedsideLamp }) {
  const { box, cylinder, sphere, lathe, tube, group, target } = b;
  const pickupGroups = {},
    receiverGroups = {},
    offerings = {};
  const gold = m.brass.clone();
  gold.color.set(0xa49a66);
  gold.roughness = 0.38;
  const leather = new T.MeshStandardMaterial({
    color: 0x382b24,
    roughness: 0.84,
  });
  const ribbonMaterial = new T.MeshStandardMaterial({
    color: 0xb6acb7,
    roughness: 0.68,
    side: T.DoubleSide,
  });
  const ink = new T.MeshStandardMaterial({ color: 0x302d23, roughness: 0.8 });
  const white = m.ceramic.clone();
  white.color.set(0xc7c5b6);
  const paper = (lines) =>
    new T.MeshStandardMaterial({
      map: writingTexture(lines, {
        font: 31,
        background: "#c9c1a6",
        color: "#423d32",
      }),
      roughness: 0.96,
    });

  function watch(parent, scale = 1) {
    const g = group(0, 0, 0, 0, parent);
    g.scale.setScalar(scale);
    box(0.031, 0.007, 0.2, 0, -0.014, 0, leather, false, g, 0.004);
    cylinder(0.039, 0.039, 0.016, 0, -0.008, 0, gold, g, 36);
    const face = new T.Mesh(
      new T.CircleGeometry(0.032, 40),
      new T.MeshStandardMaterial({ map: watchFace(), roughness: 0.38 }),
    );
    face.rotation.x = -Math.PI / 2;
    face.position.y = 0.001;
    g.add(face);
    for (const z of [-0.075, 0.075])
      box(0.038, 0.004, 0.008, 0, -0.008, z, gold, false, g, 0.002);
    cylinder(0.006, 0.006, 0.009, 0.041, -0.007, 0, gold, g, 12).rotation.z =
      Math.PI / 2;
    return g;
  }
  function ring(parent, scale = 1) {
    const g = group(0, 0, 0, 0, parent);
    g.scale.setScalar(scale);
    const mesh = new T.Mesh(new T.TorusGeometry(0.024, 0.005, 10, 40), gold);
    mesh.rotation.x = Math.PI / 2;
    mesh.position.y = -0.019;
    g.add(mesh);
    return g;
  }
  function ribbon(parent, scale = 1) {
    const g = group(0, 0, 0, 0, parent);
    g.scale.setScalar(scale);
    for (const side of [-1, 1]) {
      const geometry = new T.PlaneGeometry(0.028, 0.2, 5, 28),
        p = geometry.attributes.position;
      for (let i = 0; i < p.count; i++) {
        const y = p.getY(i);
        p.setX(i, p.getX(i) + side * Math.sin((y + 0.1) * 17) * 0.035);
        p.setZ(i, Math.sin(y * 34 + side) * 0.008 + 0.007);
      }
      geometry.computeVertexNormals();
      const strip = new T.Mesh(geometry, ribbonMaterial);
      strip.rotation.x = -Math.PI / 2;
      strip.rotation.z = side * 0.38;
      strip.position.set(side * 0.021, -0.025, 0);
      strip.castShadow = strip.receiveShadow = true;
      g.add(strip);
    }
    const knot = box(
      0.046,
      0.02,
      0.031,
      0,
      -0.018,
      0,
      ribbonMaterial,
      false,
      g,
      0.012,
    );
    knot.rotation.y = 0.15;
    return g;
  }
  const makers = { watch, ring, ribbon };
  const roomsFor = {
    watch: rooms.kitchen,
    ring: rooms.utility,
    ribbon: rooms.lounge,
  };
  for (const item of ["watch", "ring", "ribbon"]) {
    const id = "keepsake-" + item,
      p = TARGETS[id],
      g = group(p.x, p.y, p.z, 0, roomsFor[item]);
    g.name = "Mum's " + item;
    pickupGroups[item] = g;
    if (item === "ring") {
      lathe(
        [
          [0.07, 0],
          [0.085, 0.006],
          [0.092, 0.025],
          [0.083, 0.029],
          [0.07, 0.012],
        ],
        0,
        -0.055,
        0,
        white,
        g,
      );
      ring(g);
    } else makers[item](g);
    const proxy = box(
      item === "ribbon" ? 0.24 : 0.19,
      0.15,
      0.25,
      0,
      0,
      0,
      m.invisible,
      false,
      g,
    );
    target(id, proxy, "TAKE MUM'S " + item.toUpperCase(), 2.3, g);
    // One small handwritten tag makes a tiny keepsake discoverable in low light.
    const tag = box(
      0.12,
      0.003,
      0.055,
      0,
      -0.035,
      item === "ribbon" ? 0.13 : 0.15,
      paper([item.toUpperCase()]),
      false,
      g,
    );
    tag.rotation.y = item === "ring" ? 0.12 : -0.08;
  }

  const definitions = [
    {
      id: "radio-altar",
      item: "watch",
      room: rooms.kitchen,
      rotation: Math.PI / 2,
      number: "I",
      caption: "TIME",
    },
    {
      id: "bath-dish",
      item: "ring",
      room: rooms.bathroom,
      rotation: 0,
      number: "II",
      caption: "WATER",
    },
    {
      id: "musicbox-base",
      item: "ribbon",
      room: rooms.bedroom,
      rotation: 0,
      number: "III",
      caption: "SLEEP",
    },
  ];
  for (const d of definitions) {
    const p = TARGETS[d.id],
      g = group(p.x, p.y, p.z, d.rotation, d.room);
    receiverGroups[d.id] = g;
    // A shallow tray beneath the marking holds the offered object physically.
    lathe(
      [
        [0.055, -0.035],
        [0.071, -0.032],
        [0.081, -0.018],
        [0.077, -0.009],
        [0.065, -0.018],
      ],
      0,
      0,
      0,
      d.item === "ring" ? white : gold,
      g,
    );
    const glyph = new T.Mesh(
      new T.CircleGeometry(0.057, 40),
      new T.MeshStandardMaterial({
        map: offeringGlyph(d.item),
        roughness: 0.86,
      }),
    );
    glyph.rotation.x = -Math.PI / 2;
    glyph.position.y = -0.016;
    g.add(glyph);
    const card = box(
      0.135,
      0.105,
      0.007,
      0,
      0.052,
      -0.1,
      new T.MeshStandardMaterial({
        map: receiverCard(d.number, d.caption),
        roughness: 0.96,
      }),
      false,
      g,
      0.003,
    );
    card.rotation.x = -0.16;
    const proxy = box(0.16, 0.16, 0.19, 0, 0.01, 0, m.invisible, false, g);
    target(d.id, proxy, "PLACE A KEEPSAKE · " + d.number, 2.3, g);
    const offered = makers[d.item](g, d.item === "watch" ? 0.63 : 0.85);
    if (d.item === "ring") offered.position.y = 0.018;
    else if (d.item === "ribbon") offered.position.y = 0.03;
    else offered.position.y = 0.014;
    offered.visible = false;
    offerings[d.item] = offered;
  }

  // The frequency is a physical clue on the diary, so looking at a rendered
  // bedside prop agrees with reading the memory in the inventory.
  const tuningCard = box(
    0.225,
    0.002,
    0.16,
    0,
    0.013,
    0,
    paper([
      "HER EVENING · HER STATION",
      WRITINGS.diary.match(/\d+\.\d+ FM/)?.[0] || "93.7 FM",
    ]),
    false,
    diary,
  );
  tuningCard.rotation.y = 0.025;
  const farewell = group(
    TARGETS["bed-farewell"].x,
    TARGETS["bed-farewell"].y,
    TARGETS["bed-farewell"].z,
    0,
    rooms.bedroom,
  );
  const farewellPaper = box(
    0.31,
    0.006,
    0.37,
    0,
    -0.014,
    0,
    paper([
      "MUM,",
      "I CAN'T KEEP THE HOUSE",
      "AWAKE FOR YOU.",
      "I CAN SAY GOODBYE.",
    ]),
    false,
    farewell,
  );
  farewellPaper.rotation.y = -0.06;
  const farewellProxy = box(
    0.4,
    0.17,
    0.44,
    0,
    0.025,
    0,
    m.invisible,
    false,
    farewell,
  );
  target(
    "bed-farewell",
    farewellProxy,
    "SAY GOODBYE AT THE BED",
    2.4,
    farewell,
  );
  const switchPlate = box(
    0.035,
    0.032,
    0.035,
    0,
    0.265,
    0.075,
    m.black,
    false,
    bedsideLamp,
    0.005,
  );
  const lampPos = TARGETS["bedside-lamp"],
    lampProxy = box(
      0.29,
      0.39,
      0.29,
      lampPos.x,
      lampPos.y,
      lampPos.z,
      m.invisible,
      false,
      rooms.bedroom,
    );
  target("bedside-lamp", lampProxy, "SWITCH OFF MUM'S LAMP", 2.4, bedsideLamp);
  // The proxy is a sibling of the fixture to preserve world-space TARGETS.
  lampProxy.userData.interactionId = "bedside-lamp";
  const lampMaterials = [];
  bedsideLamp.traverse((o) => {
    if (o.isMesh) {
      o.material = o.material.clone();
      lampMaterials.push({
        material: o.material,
        emissive: o.material.emissiveIntensity,
        color: o.material.color.clone(),
        unlit: o.material.isMeshBasicMaterial,
      });
    }
  });
  function reset() {
    Object.values(pickupGroups).forEach((g) => (g.visible = false));
    Object.values(receiverGroups).forEach((g) => (g.visible = false));
    Object.values(offerings).forEach((g) => (g.visible = false));
    farewell.visible = false;
    lampProxy.visible = false;
    for (const e of lampMaterials) {
      e.material.color.copy(e.color);
      if (e.material.emissive) e.material.emissiveIntensity = e.emissive;
    }
  }
  function animate(_time, state) {
    const ritual = state.stage >= 3;
    for (const item of ["watch", "ring", "ribbon"]) {
      const taken =
        !!state.keepsakes?.[item] || state.placedKeepsakes?.includes(item);
      pickupGroups[item].visible = ritual && !taken;
      offerings[item].visible = !!state.placedKeepsakes?.includes(item);
    }
    Object.values(receiverGroups).forEach((g) => (g.visible = ritual));
    farewell.visible = state.stage >= 6 && !state.farewellSaid;
    lampProxy.visible = state.stage >= 6;
    switchPlate.rotation.x = state.lampOff ? -0.5 : 0.5;
    for (const e of lampMaterials) {
      e.material.color
        .copy(e.color)
        .multiplyScalar(state.lampOff ? (e.unlit ? 0.06 : 0.34) : 1);
      if (e.material.emissive)
        e.material.emissiveIntensity = state.lampOff ? 0 : e.emissive;
    }
  }
  reset();
  return {
    animate,
    reset,
    pickupGroups,
    receiverGroups,
    offerings,
    farewell,
    lampProxy,
    bedsideLamp,
    snapshot: () => ({
      pickups: Object.fromEntries(
        Object.entries(pickupGroups).map(([k, g]) => [k, g.visible]),
      ),
      offered: Object.fromEntries(
        Object.entries(offerings).map(([k, g]) => [k, g.visible]),
      ),
      farewell: farewell.visible,
      lampTarget: lampProxy.visible,
    }),
  };
}
function canvas(w = 256, h = w) {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  return [c, c.getContext("2d")];
}
function map(c) {
  const t = new T.CanvasTexture(c);
  t.colorSpace = T.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}
function watchFace() {
  const [c, g] = canvas();
  g.fillStyle = "#b8b49b";
  g.fillRect(0, 0, 256, 256);
  g.strokeStyle = "#37392d";
  g.lineWidth = 4;
  for (let i = 0; i < 12; i++) {
    const a = (i * Math.PI) / 6;
    g.beginPath();
    g.moveTo(128 + Math.sin(a) * 89, 128 - Math.cos(a) * 89);
    g.lineTo(128 + Math.sin(a) * 104, 128 - Math.cos(a) * 104);
    g.stroke();
  }
  g.lineWidth = 7;
  g.beginPath();
  g.moveTo(128, 128);
  g.lineTo(178, 134);
  g.moveTo(128, 128);
  g.lineTo(204, 145);
  g.stroke();
  return map(c);
}
function offeringGlyph(item) {
  const [c, g] = canvas();
  g.fillStyle = "#b7b29c";
  g.fillRect(0, 0, 256, 256);
  g.strokeStyle = "#4b4638";
  g.lineWidth = 8;
  g.beginPath();
  if (item === "watch") {
    g.arc(128, 128, 59, 0, Math.PI * 2);
    g.moveTo(128, 69);
    g.lineTo(128, 27);
    g.moveTo(128, 187);
    g.lineTo(128, 229);
    g.moveTo(128, 128);
    g.lineTo(128, 91);
    g.moveTo(128, 128);
    g.lineTo(162, 139);
  } else if (item === "ring") {
    g.arc(128, 137, 60, 0, Math.PI * 2);
    g.moveTo(94, 81);
    g.lineTo(128, 38);
    g.lineTo(162, 81);
  } else {
    g.moveTo(124, 126);
    g.bezierCurveTo(33, 32, 15, 170, 119, 137);
    g.moveTo(132, 126);
    g.bezierCurveTo(222, 32, 242, 170, 137, 137);
    g.moveTo(117, 139);
    g.lineTo(78, 221);
    g.moveTo(139, 139);
    g.lineTo(180, 221);
  }
  g.stroke();
  return map(c);
}

function receiverCard(number, caption) {
  const [c, g] = canvas(256, 192);
  g.fillStyle = "#c9c1a6";
  g.fillRect(0, 0, 256, 192);
  g.fillStyle = "#423d32";
  g.textAlign = "center";
  g.font = "58px Georgia";
  g.fillText(number, 128, 75);
  g.font = "34px Georgia";
  g.fillText(caption, 128, 145);
  return map(c);
}
