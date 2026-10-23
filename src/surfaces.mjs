import * as T from "three";
let seed = 1709;
const random = () => {
  seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
  return seed / 4294967296;
};
function canvas(w = 512, h = w) {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  return [c, c.getContext("2d", { willReadFrequently: true })];
}
function texture(c) {
  const t = new T.CanvasTexture(c);
  t.colorSpace = T.SRGBColorSpace;
  t.magFilter = T.LinearFilter;
  t.minFilter = T.LinearMipmapLinearFilter;
  t.wrapS = t.wrapT = T.RepeatWrapping;
  t.anisotropy = 4;
  return t;
}
function patina(g, size, amount = 6000) {
  for (let i = 0; i < amount; i++) {
    g.fillStyle =
      random() > 0.5 ? "rgba(0,0,0,.025)" : "rgba(255,235,200,.035)";
    g.fillRect(
      random() * size,
      random() * size,
      1 + random() * 2,
      1 + random() * 2,
    );
  }
}
function cloud(g, size, color, number = 18) {
  for (let i = 0; i < number; i++) {
    const x = random() * size,
      y = random() * size,
      r = 20 + random() * size * 0.55;
    const grad = g.createRadialGradient(x, y, 0, x, y, r);
    grad.addColorStop(0, color);
    grad.addColorStop(1, "transparent");
    g.fillStyle = grad;
    g.fillRect(x - r, y - r, r * 2, r * 2);
  }
}
async function imageAt(path) {
  const i = new Image();
  i.src = new URL(path, import.meta.url).href;
  await i.decode();
  return i;
}
function crop(image, x, y, w, h) {
  const [c, g] = canvas();
  g.drawImage(image, x, y, w, h, 0, 0, c.width, c.height);
  return c;
}
export async function createSurfaces() {
  const image = await imageAt("../assets/art/house-materials.png"),
    w = image.width / 2,
    h = image.height / 2;
  const maps = {
    wallpaper: texture(crop(image, 0, 0, w, h)),
    floor: texture(crop(image, w, 0, w, h)),
    tile: texture(crop(image, 0, h, w, h)),
    fabric: texture(crop(image, w, h, w, h)),
  };
  {
    const [c, g] = canvas();
    g.fillStyle = "#7d7c70";
    g.fillRect(0, 0, 512, 512);
    cloud(g, 512, "rgba(62,54,38,.17)", 34);
    cloud(g, 512, "rgba(184,182,161,.14)", 24);
    patina(g, 512, 16000);
    maps.plaster = texture(c);
  }
  {
    const [c, g] = canvas();
    g.fillStyle = "#3f3d31";
    g.fillRect(0, 0, 512, 512);
    for (let i = 0; i < 1300; i++) {
      const y = random() * 512;
      g.strokeStyle = `rgba(${random() > 0.4 ? "12,11,8" : "148,128,88"},${0.03 + random() * 0.08})`;
      g.beginPath();
      g.moveTo(0, y);
      g.bezierCurveTo(170, y + random() * 12, 280, y - random() * 12, 512, y);
      g.stroke();
    }
    g.strokeStyle = "#1f221b";
    g.lineWidth = 5;
    g.strokeRect(20, 18, 472, 476);
    g.strokeStyle = "#7b7250";
    g.lineWidth = 1;
    g.strokeRect(24, 22, 464, 468);
    cloud(g, 512, "rgba(0,0,0,.12)");
    patina(g, 512);
    maps.panel = texture(c);
    maps.wood = maps.floor;
  }
  {
    const [c, g] = canvas();
    g.fillStyle = "#948d76";
    g.fillRect(0, 0, 512, 512);
    cloud(g, 512, "rgba(39,35,28,.22)", 30);
    patina(g, 512, 22000);
    for (let i = 0; i < 9; i++) {
      g.strokeStyle = "rgba(23,23,21,.13)";
      g.lineWidth = 0.5;
      g.beginPath();
      let x = random() * 512,
        y = random() * 512;
      g.moveTo(x, y);
      for (let j = 0; j < 9; j++) {
        x += random() * 25 - 10;
        y += random() * 22;
        g.lineTo(x, y);
      }
      g.stroke();
    }
    maps.concrete = texture(c);
  }
  {
    const [c, g] = canvas();
    g.fillStyle = "#6a5845";
    g.fillRect(0, 0, 512, 512);
    cloud(g, 512, "rgba(19,12,9,.3)", 45);
    patina(g, 512, 25000);
    maps.rust = texture(c);
  }
  {
    const [c, g] = canvas();
    g.fillStyle = "#908b76";
    g.fillRect(0, 0, 512, 512);
    for (let i = 0; i < 512; i++) {
      g.fillStyle = i % 2 ? "#ffffff0b" : "#0000000a";
      g.fillRect(i, 0, 1, 512);
      g.fillRect(0, i, 512, 1);
    }
    cloud(g, 512, "rgba(57,40,27,.08)", 16);
    maps.linen = texture(c);
  }
  const bumps = {};
  for (const [name, map] of Object.entries(maps)) {
    const b = map.clone();
    b.colorSpace = T.NoColorSpace;
    bumps[name] = b;
  }
  function material(name, rx = 1, ry = 1, color = 0xffffff) {
    const map = maps[name].clone(),
      bump = bumps[name].clone();
    map.needsUpdate = bump.needsUpdate = true;
    map.repeat.set(rx, ry);
    bump.repeat.copy(map.repeat);
    return new T.MeshStandardMaterial({
      map,
      color,
      roughness: name === "tile" ? 0.5 : 0.88,
      bumpMap: bump,
      bumpScale:
        name === "wallpaper" ? 0.009 : name === "fabric" ? 0.015 : 0.018,
    });
  }
  return { material, maps };
}
export function writingTexture(
  lines,
  {
    background = "#c6bc94",
    color = "#39382b",
    size = 512,
    font = 30,
    mirrored = false,
  } = {},
) {
  const [c, g] = canvas(size);
  g.fillStyle = background;
  g.fillRect(0, 0, size, size);
  cloud(g, size, "rgba(55,41,19,.1)", 10);
  if (mirrored) {
    g.translate(size, 0);
    g.scale(-1, 1);
  }
  g.fillStyle = color;
  g.font = `${font}px Georgia`;
  g.textAlign = "center";
  lines.forEach((line, i) =>
    g.fillText(line, size / 2, size * 0.27 + i * font * 1.65),
  );
  patina(g, size, 1500);
  return texture(c);
}
export async function photoTextures() {
  const i = await imageAt("../assets/art/family-photographs.png");
  return [
    texture(crop(i, 0, 0, i.width / 2, i.height)),
    texture(crop(i, i.width / 2, 0, i.width / 2, i.height)),
  ];
}
export function rainTexture() {
  const [c, g] = canvas(256, 512);
  g.fillStyle = "#202d32";
  g.fillRect(0, 0, 256, 512);
  cloud(g, 512, "rgba(123,148,159,.22)", 12);
  for (let i = 0; i < 300; i++) {
    const x = random() * 256,
      y = random() * 512;
    g.strokeStyle = `rgba(160,186,190,${random() * 0.24})`;
    g.lineWidth = 0.4 + random();
    g.beginPath();
    g.moveTo(x, y);
    g.lineTo(x - 2, y + 20 + random() * 50);
    g.stroke();
  }
  return texture(c);
}
export function grimeTexture() {
  const [c, g] = canvas();
  cloud(g, 512, "rgba(11,14,10,.38)", 28);
  return texture(c);
}
