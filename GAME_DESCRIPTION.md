# MIRROR ME

**A first-person psychological horror game for Shorty Game Jam 2026. Theme: INVERTED.**

Mara Vale returns to her mother's house to collect what remains. A light is still on. The telephone carries a familiar voice. In the hall, her reflection is learning the evening's routine.

Explore a cramped, furnished home across seven chapters. Solve each part of the evening before the back door opens. Stepping through it carries you straight into the front hall again, without a fade or a break in your movement. Each return changes what the house remembers.

Read the diary, listen between radio stations and return the keepsakes her hands once knew. Then undo the routine in reverse. The sitting-room telephone carries calls; the separate kitchen radio carries the weather and its own part of the ritual. When the familiar exit is gone, the empty glass offers another way through.

The woman in the mirror no longer moves like you. Bodies fold into impossible postures, crawl through doorways and vanish from rooms you thought were empty. Blood marks the walls. Irregular electrical dips and sounds behind the plaster build toward an altered house and a final departure through the front entrance.

MIRROR ME combines a detailed female character, physically based house surfaces, local sound and synthetic dialogue with authored horror encounters. Its first-play target is **10–15 minutes**; that target still needs confirmation with first-time human players.

Built for a desktop browser with keyboard and mouse. Headphones recommended. WASD or arrows to walk, mouse to look, E to interact, F for the flashlight, Tab for inventory/journal, H for a contextual thought and Escape to pause. Settings include brightness, picture quality, walking motion, sound, sudden encounters and irregular light flicker.

Contains bereavement, blood imagery, distorted figures, sudden appearances and flickering lights. The sudden-encounter and light-flicker settings are separate; changing them does not block puzzles or the ending.

## Credits and assets

Original concept and direction by **Skewernet**, with AI-assisted development using OpenAI ChatGPT/Codex. All twenty-three spoken takes are synthetic Kokoro performances: twenty-two story performances and one ambient radio bulletin. No human voice actor is represented. The complete current credits below name third-party creators, sources, licenses and the game's changes. These records also appear in the game's ending/menu credits and in [`assets/credits.json`](assets/credits.json). Detailed source manifests and notices are linked from [`ATTRIBUTIONS.md`](ATTRIBUTIONS.md).

- **MIRROR ME — concept, story, house and sound** — Skewernet; AI-assisted development with OpenAI ChatGPT/Codex. Original project work; no separate asset-license grant. [Source](https://github.com/Skewernet/Mirror-Me---Shorty-Game-Jam). Original game direction, writing, L-shaped house, seamless threshold portal, seven-chapter progression, keepsake puzzles, wake room, authored props, blood/handprint/vein artwork, interface and procedural animation. Ambience, footsteps, crawling, knocks, mechanical sounds and music-box tones are authored Web Audio synthesis; no external sound library.

- **Three.js 0.160.1 and addons** — Three.js authors; copyright 2010–2023. [MIT](https://github.com/mrdoob/three.js/blob/r160/LICENSE). [Source](https://github.com/mrdoob/three.js/tree/r160). Vendored locally for rendering, mirrors, glTF loading, skeletal posing, geometry and HDR decoding. License text retained in vendor/THREE-LICENSE.txt.

- **Kokoro-82M v1.0 — synthetic dialogue** — Kokoro / hexgrad; ONNX conversion and runtime by k2-fsa / sherpa-onnx; original dialogue by MIRROR ME. [Engine and model weights: Apache-2.0; dialogue: original project writing](https://github.com/hexgrad/kokoro/blob/main/LICENSE). [Source](https://github.com/k2-fsa/sherpa-onnx/releases/tag/tts-models). Twenty-three original takes synthesized offline: twenty-two story performances and one ambient radio bulletin. Mara and the glass: bf_emma; Mum: bf_isabella; weather bulletin: bm_george. The first Mum call uses telephone bandwidth; the final Mum line uses clear full-range speech. Pacing, telephone/radio filtering, restrained glass echo and loudness/headroom mastering by the project. Supplied synthetic presets; no human actor performance or real-person voice clone is claimed.

- **MakeHuman / MPFB — female base, morphology and game rig** — MakeHuman Team — Data Collection AB, Joel Palmius and Jonas Hauquier. [CC0 1.0](https://github.com/makehumancommunity/mpfb2/blob/b1a2dc98776da9d1eea751b159d42cf61778fe2e/LICENSE.ASSETS.md). [Source](https://github.com/makehumancommunity/mpfb2/tree/b1a2dc98776da9d1eea751b159d42cf61778fe2e/src/mpfb/data). Adult female morphological blend at 1.74 m; helper removal, anatomical subdivision, resting pose and glTF export. MPFB mouth-opening expression added as a jaw morph; the CC0 inside-mouth texture is copied unmodified as inside-mouth-mask.jpg. The project adds distance-driven foot planting, measured-bind-axis limb solving, crawling/ceiling poses and anatomical horror deformation.

- **MakeHuman — system skin, eyes, hair, clothing and shoes** — MakeHuman Team — Data Collection AB, Joel Palmius and Jonas Hauquier. [CC0 1.0](https://github.com/makehumancommunity/mpfb2/blob/b1a2dc98776da9d1eea751b159d42cf61778fe2e/LICENSE.ASSETS.md). [Source](https://static.makehumancommunity.org/assets/assetpacks/makehuman_system_assets.html). System skin, detailed eyes, bob hairstyle, brows, lashes, casual clothing and shoes03 black shoes fitted to the female character; chestnut hair tint, PBR tuning and authored horror variants. The clothed mesh and skeleton are reused for the crawling and distorted figures; those poses are project-authored, not a separately downloaded monster asset.

- **Red Shirt with Black Jeans — costume material** — Margaret Toigo. [CC0 1.0](https://static.makehumancommunity.org/assets/assetpacks/system_clothes_materials01.html). [Source](http://www.makehumancommunity.org/node/997). Material used on the refitted female blouse/jeans costume, with roughness and scene-lighting adjustments. Current official MakeHuman asset-pack listing identifies this material as CC0.

- **Chair Damask Purplegold — wood PBR maps** — Eric Chadwick (models and textures); © 2021 Wayfair. [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/). [Source](https://github.com/KhronosGroup/glTF-Sample-Assets/tree/15cd02d304e54cb42a4db4eefe719f76190f4b68/Models/ChairDamaskPurplegold). Only the tiling wood texture maps are used. Image files copied unmodified and renamed; runtime tint, repeat and original floorboard joins applied. No chair model is included.

- **Fabric Pattern 07 — fabric PBR maps** — Poly Haven (publisher). [CC0 1.0](https://polyhaven.com/license). [Source](https://polyhaven.com/a/fabric_pattern_07). Color, OpenGL normal and packed AO/roughness/metallic maps from the Godot demo-project mirror. Source images unmodified; repeat, channel interpretation and material tint configured in the game.

- **St Fagans Interior — HDR environment** — Poly Haven (publisher). [CC0 1.0](https://polyhaven.com/license). [Source](https://polyhaven.com/a/st_fagans_interior). Unmodified 1k HDR from the pmndrs/drei-assets mirror, decoded and prefiltered for restrained indirect/specular interior reflections. It is not used as a visible background.

- **Original house PBR surfaces** — MIRROR ME — AI-assisted procedural artwork/code. Original project work; no separate asset-license grant. [Source](https://github.com/Skewernet/Mirror-Me---Shorty-Game-Jam/blob/main/tools/materials_prep.py). Original wallpaper, plaster, panelling, tile, linen, concrete and rust generated at 1024 px. Separate albedo, tangent-space normal and roughness maps; no third-party image used as their source.

- **Original fictional family images and house material atlases** — Created for MIRROR ME with OpenAI image generation. Original project artwork; no third-party asset-license grant. [Source](https://github.com/Skewernet/Mirror-Me---Shorty-Game-Jam/tree/main/assets). Original AI-generated fictional family images and house material artwork. Current tactile atlas supplies wallpaper, plaster and painted-panel albedos through quadrant crops; framed photos sample the family atlas. The earlier house atlas remains recorded. Generated artwork, not photographic capture.
