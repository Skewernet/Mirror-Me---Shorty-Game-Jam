# Material sources

The game loads local files only. The complete material payload is under 9 MB.
`sources.json` records the exact source revision, original path, SHA-256, license,
and any runtime changes for every downloaded file. `original-sources.json` records
the generated assets and their physical repeat size.

## External photographs and PBR data

* **Tiling wood:** Eric Chadwick / Wayfair, © 2021, from the Khronos
  [Chair Damask Purplegold asset](https://github.com/KhronosGroup/glTF-Sample-Assets/tree/15cd02d304e54cb42a4db4eefe719f76190f4b68/Models/ChairDamaskPurplegold),
  **CC BY 4.0**. The three source images are unmodified. Runtime materials tint
  and repeat them; an original shader adds staggered floorboard joints.
  The asset's explicit image license and provenance are reproduced in `licenses/`.
* **Fabric Pattern 07:** published by [Poly Haven](https://polyhaven.com/a/fabric_pattern_07),
  **CC0 1.0**. The 1K color, OpenGL normal and packed AO/roughness/metalness maps
  are copied unmodified from the Godot demo mirror, with the original paths and
  pinned revision in `sources.json`. Red is AO and green is roughness. The game
  treats the cloth as a dielectric, so the metalness channel is not used.
* **St Fagans Interior:** published by [Poly Haven](https://polyhaven.com/a/st_fagans_interior),
  **CC0 1.0**. The unmodified 1K HDR is copied from the `pmndrs/drei-assets` mirror.
  Its README attributes the HDR collection to HDRI Haven, now Poly Haven. The HDR
  supplies faint rough specular fill, never the house background.

Individual Poly Haven artist names were not verifiable through this environment's
network policy, so the credits identify the verified publisher rather than guess.
The authoritative Poly Haven global asset license policy is copied verbatim to
`licenses/polyhaven-policy.json` from [this pinned official website source](https://github.com/Poly-Haven/polyhaven.com/blob/b1a6aa13afc03ae00860f6ac5fe6d5daf8e95356/public/locales/en/license.json).
It explicitly licenses all site HDRIs, textures and models under CC0 and permits
commercial use and redistribution. Full CC0 and CC BY 4.0 texts are included.

## Original materials

`tools/materials_prep.py` creates the botanical paper, plaster, painted joinery,
ceramic tiles, linen, mineral worktop and oxidized hardware. These are original
project assets. Run `python tools/materials_prep.py` with NumPy and Pillow to
reproduce them deterministically. Their license follows the project's original
assets; the generator does not grant an additional third-party license.

`original/tactile-house-albedos.png` is original project art generated with OpenAI
image generation on 2026-10-23. Its top-left, top-right and bottom-left quadrants
supply the active floral wallpaper, plaster and sage painted-wood albedos. The
image is unmodified; runtime code crops the exact quadrants, then uploads them at
a power-of-two size for WebGL1 repeat/mipmap compatibility, with mirrored repeat
to keep matching edge texels continuous. Each source quadrant
has 627 × 627 pixels. Upsampling does not create additional source detail. The
prompt and SHA-256 are recorded in `original-sources.json`. The fourth quadrant
is unused. These are generated photographic-style surfaces, not real scans.
The independently authored procedural normal/roughness maps remain active;
color variation and printed ink do not become false surface depth.

Each material has independent albedo, tangent-space normal, and roughness data.
The normal generator differentiates a physical height field in metres. Colored
ink, stains and photographs are not reused as height maps. Color textures use
sRGB; normal, roughness and AO use linear data space. The nominal repeat is 1.8 m
and geometry chooses repeats in metres. Tiny tile lips and woven fibres are
surface relief; paper motifs are ink with only a shallow emboss.

`vendor/RGBELoader.js` is unmodified Three.js r160 loader code, under the project's
existing Three.js MIT notice in `vendor/THREE-LICENSE.txt`.
