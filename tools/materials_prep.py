#!/usr/bin/env python3
"""Rebuild MIRROR ME's original, tileable PBR surfaces. Requires numpy/Pillow.

Albedo is deliberately independent of the millimetre-scale height model. Normal
and roughness maps are data maps, never a colour photograph reused as relief.
The photographic sets in assets/materials/photographic are not modified here.
"""
from pathlib import Path
import hashlib
import json
import numpy as np
from PIL import Image, ImageDraw, ImageFilter

SIZE = 1024
ROOT = Path(__file__).resolve().parents[1] / "assets/materials"
OUT = ROOT / "original"
OUT.mkdir(parents=True, exist_ok=True)
rng = np.random.default_rng(1709)
y, x = np.mgrid[0:SIZE, 0:SIZE].astype(np.float32) / SIZE


def noise(cells):
    """Periodic interpolated noise, including the shared boundary texels."""
    a = rng.random((cells, cells), dtype=np.float32)
    tiled = np.tile(a, (3, 3))
    im = Image.fromarray(np.uint8(tiled * 255)).resize(
        (SIZE * 3, SIZE * 3), Image.Resampling.BICUBIC)
    return np.asarray(im, np.float32)[SIZE:SIZE * 2, SIZE:SIZE * 2] / 255 - .5


def field():
    return noise(4) * .5 + noise(16) * .25 + noise(64) * .15 + noise(256) * .1


def rgb(base, variation):
    return np.array(base, np.float32)[None, None, :] + variation[..., None]


generated = []


def save(name, color, height_m, roughness, span_m=1.8):
    # Central differences in metres produce a tangent-space OpenGL normal.
    dx = (np.roll(height_m, -1, 1) - np.roll(height_m, 1, 1)) / (2 * span_m / SIZE)
    dy = (np.roll(height_m, 1, 0) - np.roll(height_m, -1, 0)) / (2 * span_m / SIZE)
    n = np.stack((-dx, -dy, np.ones_like(dx)), axis=-1)
    n /= np.linalg.norm(n, axis=-1, keepdims=True)
    outputs = {
        "color": np.uint8(np.clip(color, 0, 255)),
        "normal": np.uint8(np.clip(n * .5 + .5, 0, 1) * 255),
        "roughness": np.uint8(np.clip(roughness, 0, 1) * 255),
    }
    for role, data in outputs.items():
        path = OUT / f"{name}-{role}.webp"
        Image.fromarray(data).save(path, quality=96 if role == "normal" else 92,
                                   method=6)
        generated.append({"file": str(path.relative_to(ROOT)), "role": role,
                          "bytes": path.stat().st_size,
                          "sha256": hashlib.sha256(path.read_bytes()).hexdigest(),
                          "license": "Project original", "generator": "tools/materials_prep.py",
                          "nominalRepeatMetres": span_m})


# A small-scale botanical paper: actual ink motifs and paper fibres. Unlike the
# old four-up atlas it contains no painted highlights, contact shadows or framing.
paper = field()
motif = Image.new("L", (SIZE, SIZE))
d = ImageDraw.Draw(motif)
for cy in range(-128, SIZE + 128, 256):
    for cx in range(-128, SIZE + 128, 256):
        cx += 128 if (cy // 256) % 2 else 0
        # A fine scrolling stem with paired leaves and small five-petalled heads.
        points = [(cx + np.sin(t * np.pi * 2) * 22, cy + t * 180) for t in np.linspace(-.5, .5, 70)]
        d.line(points, fill=110, width=2)
        for k in (-1, 0, 1):
            sy = cy + k * 36
            sx = cx + np.sin(k * .4 * np.pi) * 22
            for side in (-1, 1):
                d.polygon([(sx, sy), (sx + side * 25, sy - 15),
                           (sx + side * 37, sy - 12), (sx + side * 23, sy + 1)], fill=125)
                d.line([(sx, sy), (sx + side * 31, sy - 11)], fill=190, width=1)
        for fy in (cy - 88, cy + 88):
            for angle in np.linspace(0, np.pi * 2, 6)[:-1]:
                px = cx + np.cos(angle) * 7
                py = fy + np.sin(angle) * 7
                d.ellipse((px - 4, py - 5, px + 4, py + 5), fill=145)
            d.ellipse((cx - 3, fy - 3, cx + 3, fy + 3), fill=220)
ink = np.asarray(motif, np.float32) / 255
fibres = noise(400)
color = rgb([202, 195, 171], paper * 17 + fibres * 3)
color -= ink[..., None] * np.array([49, 48, 39])
save("wallpaper", color, fibres * .000045 + ink * .000035,
     .88 + paper * .07 - ink * .04)

# Warm, hand-painted plaster, with orange-peel texture rather than black grit.
f = field()
fine = noise(300)
save("plaster", rgb([210, 207, 192], f * 15 + fine * 3),
     f * .0004 + fine * .00012, .91 + f * .08)

# Painted joinery: subtle longitudinal grain and tiny worn paint pinholes.
f = field()
grain = np.sin(x * np.pi * 130 + noise(12) * 3) * .5
pits = np.maximum(noise(220) - .33, 0)
save("panel", rgb([185, 191, 173], f * 9 + grain * 1.7 - pits * 22),
     grain * .000065 + f * .00013 - pits * .00045,
     .58 + f * .1 + pits * .8)

# Real dimensional grout and a gently rounded ceramic lip. All six tiles are
# glazed ivory; low chromatic variation avoids a distracting checkerboard.
tiles = 6
u, v = np.mod(x * tiles, 1), np.mod(y * tiles, 1)
edge = np.minimum.reduce([u, 1 - u, v, 1 - v])
glaze = np.clip((edge - .008) / .025, 0, 1)
f = field()
tile_noise = noise(6)
tile_color = rgb([205, 211, 196], f * 4 + tile_noise * 9)
grout_color = rgb([128, 126, 108], f * 10)
color = tile_color * glaze[..., None] + grout_color * (1 - glaze[..., None])
save("tile", color, glaze * .0018 + noise(180) * .000025,
     .27 * glaze + .92 * (1 - glaze) + f * .04)

# Undyed woven linen, separate from the red/cream photographic upholstery.
warp = np.sin(x * np.pi * 360)
weft = np.sin(y * np.pi * 360)
weave = warp * weft
f = field()
save("linen", rgb([210, 203, 183], f * 10 + weave * 3),
     weave * .00009 + noise(300) * .000035, .95 + f * .025)

# Mineral aggregate for the worktop/utility room, not a flat grey block.
f = field()
vein = np.exp(-np.abs(np.sin(x * 16 + y * 9 + noise(9) * 4)) * 28)
save("concrete", rgb([160, 164, 151], f * 28 - vein * 11),
     f * .00025 + noise(400) * .00005, .67 + f * .2 + vein * .08)

# Oxidised hardware. Metallic response is assigned in the runtime material.
f = field()
rust = np.clip((f + .12) * 4, 0, 1)
color = rgb([101, 105, 100], f * 15) * (1 - rust[..., None])
color += rgb([111, 68, 35], f * 35) * rust[..., None]
save("rust", color, rust * .0003 + noise(250) * .00012,
     .45 + rust * .48)

registry = ROOT / "original-sources.json"
external_originals = [a for a in json.loads(registry.read_text())
                      if a.get("generator") != "tools/materials_prep.py"] if registry.exists() else []
registry.write_text(json.dumps(generated + external_originals, indent=2) + "\n")
print(f"Built {len(generated)} original maps: {sum(x['bytes'] for x in generated):,} bytes")
