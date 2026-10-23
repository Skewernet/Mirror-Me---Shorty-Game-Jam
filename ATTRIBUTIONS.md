# MIRROR ME — assets, creators and licenses

Updated 2026-10-23. The current credits register is [`assets/credits.json`](assets/credits.json), used for the game's ending/menu credits. [`GAME_DESCRIPTION.md`](GAME_DESCRIPTION.md) includes the same creator, source, license and modification records for publication with the game. Keep all three synchronized when adding or replacing an asset. Run `python3 tools/check_credits.py` to verify file coverage and creator/source/license consistency before release.

The game combines original project work with the third-party assets listed below. A third-party asset's license applies to that asset; it does not establish a new license for the project's original writing, artwork or code. No repository-wide license grant is inferred. Asset models, textures and audio are local files; gameplay does not request paid services or remote asset CDNs.

## Current asset register

### MIRROR ME — concept, story, house and sound

**Creator:** Skewernet; AI-assisted development with OpenAI ChatGPT/Codex. **License:** Original project work; no separate asset-license grant. [Source](https://github.com/Skewernet/Mirror-Me---Shorty-Game-Jam).

Original game direction, writing, L-shaped house, seamless threshold portal, seven-chapter progression, keepsake puzzles, wake room, funeral-radio geometry, authored props, interface and procedural animation. Layered blood, pools, bedding/shroud forms, knife and care-room evidence in src/revelation.mjs are original project geometry and canvas artwork. Ambience, footsteps, crawling, breaths, sob-like textures, knocks, mechanical sounds and music-box tones are authored Web Audio synthesis; no external sound or prop library. The separate intruder in src/demon.mjs adds an original asymmetric facial sculpt, marbled tissue and ruined-cloth shaders, and layered wet strand hair while reusing the credited MakeHuman base. Its finite nonverbal breath, throat and contact textures are synthesized by project code; no film monster, likeness, chant, sound recording or new external asset is included.

Files: `src/**`, `index.html`, `style.css`.

### Three.js 0.160.1 and addons

**Creator:** Three.js authors; copyright 2010–2023. **License:** [MIT](https://github.com/mrdoob/three.js/blob/r160/LICENSE). [Source](https://github.com/mrdoob/three.js/tree/r160).

Vendored locally for rendering, mirrors, glTF loading, skeletal posing, geometry and HDR decoding. License text retained in vendor/THREE-LICENSE.txt.

Files: `vendor/three.module.js`, `vendor/Reflector.js`, `vendor/RoundedBoxGeometry.js`, `vendor/GLTFLoader.js`, `vendor/BufferGeometryUtils.js`, `vendor/SkeletonUtils.js`, `vendor/RGBELoader.js`, `vendor/THREE-LICENSE.txt`.

### Kokoro-82M v1.0 — synthetic dialogue

**Creator:** Kokoro / hexgrad; ONNX conversion and runtime by k2-fsa / sherpa-onnx; original dialogue by MIRROR ME. **License:** [Engine and model weights: Apache-2.0; dialogue: original project writing](https://github.com/hexgrad/kokoro/blob/main/LICENSE). [Source](https://github.com/k2-fsa/sherpa-onnx/releases/tag/tts-models).

Twenty-five original takes synthesized offline: twenty-three narrative/broken-word performances, one ambient kitchen weather bulletin and one finite fictional funeral news report. Mara and the glass: bf_emma; Mum: bf_isabella; both radio readers: bm_george. The first Mum call uses telephone bandwidth; the final Mum line uses clear full-range speech. The broken-word take uses scripted phrase spacing and restrained amplitude modulation; it is not a recorded human sob. Telephone/radio filtering, restrained glass echo, spatial playback and loudness/headroom mastering are project work. Only the weather loop has a padded quiet tail; the funeral report plays once. Supplied synthetic presets; no human actor performance or real-person voice clone is claimed.

Files: `assets/voice/*.ogg`, `assets/voice/lines.json`, `assets/voice/production.json`, `assets/voice/MODEL_CARD.txt`, `assets/voice/LICENSE_APACHE_2.0.txt`.

### MakeHuman / MPFB — female base, morphology and game rig

**Creator:** MakeHuman Team — Data Collection AB, Joel Palmius and Jonas Hauquier. **License:** [CC0 1.0](https://github.com/makehumancommunity/mpfb2/blob/b1a2dc98776da9d1eea751b159d42cf61778fe2e/LICENSE.ASSETS.md). [Source](https://github.com/makehumancommunity/mpfb2/tree/b1a2dc98776da9d1eea751b159d42cf61778fe2e/src/mpfb/data).

Adult female morphological blend at 1.74 m; helper removal, anatomical subdivision, resting pose and glTF export. MPFB mouth-opening expression added as a jaw morph; the CC0 inside-mouth texture is copied unmodified as inside-mouth-mask.jpg. The project adds distance-driven foot planting, measured-bind-axis limb solving, crawling/ceiling poses and anatomical horror deformation. The existing credited rig is also reused for the seated wake figures and covered adult hand in the revealed room; no new body or monster model is downloaded.

Files: `assets/character/mara.glb`, `assets/character/inside-mouth-mask.jpg`, `assets/character/mara.json`, `assets/character/sources.json`, `assets/character/README.md`, `assets/character/LICENSE-CC0.md`, `assets/character/MPFB-LICENSE.md`.

### MakeHuman — system skin, eyes, hair, clothing and shoes

**Creator:** MakeHuman Team — Data Collection AB, Joel Palmius and Jonas Hauquier. **License:** [CC0 1.0](https://github.com/makehumancommunity/mpfb2/blob/b1a2dc98776da9d1eea751b159d42cf61778fe2e/LICENSE.ASSETS.md). [Source](https://static.makehumancommunity.org/assets/assetpacks/makehuman_system_assets.html).

System skin, detailed eyes, bob hairstyle, brows, lashes, casual clothing and shoes03 black shoes fitted to the female character; chestnut hair tint, PBR tuning, authored blood/material variants and desaturated mourning clothes. The clothed mesh and skeleton are reused for crawling and distorted figures, seated mourners and the covered adult hand; those poses and variants are project-authored, not separately downloaded assets.

Files: `assets/character/mara.glb`, `assets/character/mara.json`.

### Red Shirt with Black Jeans — costume material

**Creator:** Margaret Toigo. **License:** [CC0 1.0](https://static.makehumancommunity.org/assets/assetpacks/system_clothes_materials01.html). [Source](http://www.makehumancommunity.org/node/997).

Material used on the refitted female blouse/jeans costume, with roughness and scene-lighting adjustments. Current official MakeHuman asset-pack listing identifies this material as CC0.

Files: `assets/character/mara.glb`, `assets/character/mara.json`.

### Chair Damask Purplegold — wood PBR maps

**Creator:** Eric Chadwick (models and textures); © 2021 Wayfair. **License:** [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/). [Source](https://github.com/KhronosGroup/glTF-Sample-Assets/tree/15cd02d304e54cb42a4db4eefe719f76190f4b68/Models/ChairDamaskPurplegold).

Only the tiling wood texture maps are used. Image files copied unmodified and renamed; runtime tint, repeat and original floorboard joins applied. No chair model is included.

Files: `assets/materials/photographic/wood-color.jpg`, `assets/materials/photographic/wood-normal.jpg`, `assets/materials/photographic/wood-roughness.jpg`, `assets/materials/licenses/khronos-wood-CC-BY-4.0.md`, `assets/materials/licenses/khronos-wood-source.md`.

### Fabric Pattern 07 — fabric PBR maps

**Creator:** Poly Haven (publisher). **License:** [CC0 1.0](https://polyhaven.com/license). [Source](https://polyhaven.com/a/fabric_pattern_07).

Color, OpenGL normal and packed AO/roughness/metallic maps from the Godot demo-project mirror. Source images unmodified; repeat, channel interpretation and material tint configured in the game.

Files: `assets/materials/photographic/fabric-color.jpg`, `assets/materials/photographic/fabric-normal.jpg`, `assets/materials/photographic/fabric-arm.jpg`, `assets/materials/licenses/polyhaven-policy.json`.

### St Fagans Interior — HDR environment

**Creator:** Poly Haven (publisher). **License:** [CC0 1.0](https://polyhaven.com/license). [Source](https://polyhaven.com/a/st_fagans_interior).

Unmodified 1k HDR from the pmndrs/drei-assets mirror, decoded and prefiltered for restrained indirect/specular interior reflections. It is not used as a visible background.

Files: `assets/materials/photographic/interior-reflections.hdr`.

### Original house PBR surfaces

**Creator:** MIRROR ME — AI-assisted procedural artwork/code. **License:** Original project work; no separate asset-license grant. [Source](https://github.com/Skewernet/Mirror-Me---Shorty-Game-Jam/blob/main/tools/materials_prep.py).

Original wallpaper, plaster, panelling, tile, linen, concrete and rust generated at 1024 px. Separate albedo, tangent-space normal and roughness maps; no third-party image used as their source.

Files: `assets/materials/original/*.webp`, `assets/materials/original-sources.json`, `tools/materials_prep.py`.

### Original generated family images, material atlases and wound decal

**Creator:** Created for MIRROR ME with OpenAI image generation. **License:** Original project artwork; no third-party asset-license grant. [Source](https://github.com/Skewernet/Mirror-Me---Shorty-Game-Jam/tree/main/assets).

Original AI-generated fictional family images and house material artwork. Current tactile atlas supplies wallpaper, plaster and painted-panel albedos through quadrant crops; framed photos sample the family atlas. The earlier house atlas remains recorded. Generated artwork, not photographic capture. The intruder's original RGBA torn-tissue decal was generated for this project and projected onto its facial sculpt. Its generation brief and exact output hash are recorded in assets/character/unkept-wound.json; no existing film face, likeness or wound asset is used.

Files: `assets/art/family-photographs.png`, `assets/art/house-materials.png`, `assets/materials/original/tactile-house-albedos.png`, `assets/character/unkept-wound.png`, `assets/character/unkept-wound.json`.

## Detailed source records

- **Rendering:** `vendor/THREE-LICENSE.txt` preserves the Three.js MIT notice. Three.js 0.160.1 and all seven vendored rendering/addon files are listed above; addons share the Three.js license.
- **Photographic materials:** `assets/materials/sources.json` records local names, byte counts, SHA256, source repository, commit, original path, role and license. Fabric files are mirrored from `godotengine/godot-demo-projects` at `b761b4cd5718a7118f2c95eb55f181d0a5f004f1`; the interior HDR is mirrored from `pmndrs/drei-assets` at `456060a26bbeb8fdf79326f224b6d99b8bcce736`. Their original Poly Haven CC0 licenses apply. Poly Haven's authoritative license policy is retained verbatim in `assets/materials/licenses/polyhaven-policy.json`, from its website repository at `b1a6aa13afc03ae00860f6ac5fe6d5daf8e95356`. It explicitly covers original staff/donated HDRIs, textures and models as CC0. Individual artist names were not independently verified from the available metadata; the verified publisher and original asset pages are credited. A mirror repository's general code license is not used to relicense its third-party images.
- **Wood:** the three maps originate from the Khronos sample's `chair_wood_albedo.jpg`, `chair_wood_normal.jpg` and `chair_wood_roughness0.jpg`. The pinned source's `LICENSE.md` explicitly covers all associated image files. Its license and creator/source notice are retained in `assets/materials/licenses/khronos-wood-CC-BY-4.0.md` and `khronos-wood-source.md`. Only textures are included; no Wayfair chair model is used. The earlier, uncertain `hardwood2` set has been replaced.
- **Character:** MPFB base/morph/rig data is pinned to `b1a2dc98776da9d1eea751b159d42cf61778fe2e`. System assets come from the official MakeHuman CC0 release and the current official asset-pack listings. Components include high-poly eyes/brown material, `young_caucasian_female` skin, `bob02`, `eyebrow001`, `eyelashes01`, `male_casualsuit01` and `shoes03`, refitted to Mara's adult female anatomy. The source component names do not describe the playable character's gender. Margaret Toigo's identified clothing material has its own credit above. The 0.6 character also uses MPFB's `mouth-open.target.gz` expression and `mpfb_inside-mouth.jpg` oral mask, both from the CC0 data collection. The local mask is an unmodified copy; `assets/character/sources.json` records its original path and SHA256. The project supplies the new gait, inverse-kinematics solving and anatomical/crawling animation. See the character provenance records alongside `assets/character/mara.glb`.
- **Original surfaces:** `assets/materials/original-sources.json` records all twenty-one generated color/normal/roughness maps and their hashes. `tools/materials_prep.py` is their source generator. Procedural normal/roughness maps are independent data maps, not color photographs reused as relief.
- **Speech:** `assets/voice/MODEL_CARD.txt`, `README.md`, `lines.json` and `production.json` record the official Kokoro package, exact model hashes, voice IDs, twenty-five original spoken takes (including the separate fictional funeral report and broken-word take), phrase spacing, processing, output hashes and decoded true peaks. The official model's unmodified Apache 2.0 text is in `assets/voice/LICENSE_APACHE_2.0.txt`. Inference packages, model weights and eSpeak development data remain outside the shipped game. The ending's voices are supplied synthetic presets, not credited human actors. The finite news report has no weather-loop padding; the broken-word take is not a captured human cry.
- **Original sound and props:** ambience, foley, music-box tones and scares use authored Web Audio synthesis. Props, keepsakes, notes, separate funeral-radio markings/geometry, botanical/calendar imagery, blood decals, layered pools/splashes, damaged bedding, shroud, knife, shrouded mourners and dressing are authored project geometry/canvas artwork. The final room reuses the existing credited character rig for its covered adult hand, and Mara's hand stains are original runtime material variants. No downloaded prop or sound-effect library is included.
- **Original generated art:** the family images are AI-generated fictional people, created for this project. The legacy house atlas remains recorded even though the current PBR surfaces replace its runtime surface role. There are no external font files.

## Historical records

The former Piper/LJ Speech model is not used in the current shipped voice takes. Earlier development-log references describe those historical builds and are retained as history; current voice credits belong to Kokoro. No source code, imagery, audio or character asset from P.T. or Silent Hill is included.
