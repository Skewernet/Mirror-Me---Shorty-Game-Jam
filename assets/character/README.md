# Mara Vale character asset

Mara is an original fictional adult woman assembled from MakeHuman's **CC0**
anatomical mesh, morphology, rig and system assets. The reflection, crawling
apparitions and wake mourners use the same model. She is 1.74 metres tall, with a
chestnut bob, a long-sleeved burgundy blouse, dark jeans and ordinary black shoes.
The base anatomy is a continuous subdivided, UV-mapped mesh, rather than a
collection of primitives. This is a game-ready human asset; it is not a scan or
a claim of a film-quality digital double.

`mara.glb` contains the seven skinned meshes, their PBR materials and embedded
textures, plus the 53-bone game rig. Skin, costume and hair use 2048px source
atlases. Exported JPEG textures preserve face detail while keeping the complete
bundle around 9 MB; eyes and hair retain alpha cutouts. The skin also contains
the anatomical `Mara_Jaw_Open` expression, with a separate CC0 oral-cavity mask.
`mara.json` records the
actual mesh counts, body parameters, bone names and generated GLB SHA-256.

## Creators and licenses

| Component | Creator | License | Source asset |
| --- | --- | --- | --- |
| Female base, adult morphology, game rig | MakeHuman Team | CC0 1.0 | MPFB `data/3dobjs/base.obj`, `data/targets/`, `data/rigs/standard/rig.game_engine*` |
| Skin | MakeHuman Team | CC0 1.0 | `skins/young_caucasian_female/` |
| Brown eyes | MakeHuman Team | CC0 1.0 | `eyes/high-poly/`, `eyes/materials/brown*` |
| Bob hair | MakeHuman Team | CC0 1.0 | `hair/bob02/` |
| Eyebrows and lashes | MakeHuman Team | CC0 1.0 | `eyebrows/eyebrow001/`, `eyelashes/eyelashes01/` |
| Blouse and jeans mesh | MakeHuman Team | CC0 1.0 | `clothes/male_casualsuit01/` |
| Red Shirt with Black Jeans material | Margaret Toigo | CC0 1.0 | `toigo_male_casual_suit_01_red_shirt_with_black_jeans/` |
| Black shoes | MakeHuman Team | CC0 1.0 | `clothes/shoes03/` |
| Mouth-opening expression and oral mask | MakeHuman Team | CC0 1.0 | MPFB `data/targets/expression/units/caucasian/mouth-open.target.gz`, `data/textures/mpfb_inside-mouth.jpg` |

MakeHuman's asset headers identify Data Collection AB, Joel Palmius and Jonas
Hauquier as copyright holders when the system assets were explicitly released
as CC0 in September 2020. The clothing template's `male_` name describes its
original template: MPFB fitted its continuous cloth surface and skin weights to
Mara's female anatomy. The character has no association with a real person.

The full CC0 license is in [LICENSE-CC0.md](LICENSE-CC0.md). MPFB's
[license explanation](MPFB-LICENSE.md) expressly distinguishes its GPL tool code
from its CC0 meshes, targets, textures, clothes, rigs and generated output. MPFB
Python source is a build-time dependency and is not distributed in this game.
The bundled Three.js addons use the repository's existing Three.js MIT license.

Although CC0 does not require attribution, the game's credits and description
credit MakeHuman and Margaret Toigo, as requested by the project owner.

## Authoritative provenance

The official MakeHuman website lists both the system assets and Margaret
Toigo's costume material as CC0:

- [System assets](https://static.makehumancommunity.org/assets/assetpacks/makehuman_system_assets.html)
- [System clothes materials](https://static.makehumancommunity.org/assets/assetpacks/system_clothes_materials01.html)
- [Original costume material page](http://www.makehumancommunity.org/node/997)
- [MPFB asset and output license](https://github.com/makehumancommunity/mpfb2/blob/b1a2dc98776da9d1eea751b159d42cf61778fe2e/LICENSE.md)

The asset pack was fetched from the public
[Makehuman-2 CC0 release mirror](https://github.com/Makehuman-2/MH2_Asset_Repository_CCO/releases/download/CC0/mh_system_CC0.zip),
because the original download host was unavailable in the build environment.
This mirror is a redistribution source; license verification comes from the
official MakeHuman listings, MPFB license and the system asset headers. The
costume material's older `.mhmat` retains a 2016 header, while the official
MakeHuman listing explicitly identifies that named Margaret Toigo material as
CC0. Its source image is used unchanged. `sources.json` pins official website
revisions, MPFB revision, archive SHA-256 and individual source file hashes.

## Rebuilding

Install Blender 4.3, check out MPFB at the commit in `sources.json`, and unpack
the CC0 asset archive. From the repository root:

```sh
XDG_CONFIG_HOME=/tmp/mara-blender blender -b --python-exit-code 1 \
  --python tools/build_character.py -- \
  --mpfb /path/to/mpfb2/src --assets /path/to/unpacked/pack \
  --output assets/character/mara.glb
```

The build applies an adult female morphology, fits the clothing, removes
hidden anatomy and helper geometry, subdivides the visible anatomy, normalizes
height, lowers the arms into a resting pose, and exports the rig and portable
PBR materials. `--preview /tmp/mara.png` optionally creates a studio render and
editable diagnostic `.blend` outside the game bundle.

At runtime, `preloadCharacterAssets()` loads the local GLB and oral mask once.
`createFigure()` clones the skeleton and materials synchronously, retaining
shared geometry and base textures. Head and limb controls apply offsets above
the solved movement and anatomical horror pose. The early variants add tired
eye sockets and pallor. Later distortion opens the actual mouth, recesses the
eyes, changes the facial surface and stretches the neck, forearms and phalanges.
The skin shader makes the existing oral interior a lightless throat. Floor and
ceiling crawls reuse the same clothed anatomy with solved limbs and a low,
narrow silhouette. No primitive monster body is substituted. All changes reset
to the healthy Mara. Variants use independent texture Sources so the normal
skin is not mutated when another instance changes.

## Locomotion and pose API

`animate(time, speed, frozen, options)` accepts the cumulative `distance`,
`delta`, `x`, `z`, `yaw`, `vx` and `vz` of the pose being shown. Mirror history
interpolates those values together, so a delayed reflection also has delayed
feet and arm motion. Strides advance with distance, rather than elapsed time.
The full same-foot stride is 1.24m; alternating footfalls occur every .62m.

`figure-motion.mjs` measures the imported bind axes, limb lengths and shoe
heel/toe positions. Two-bone IK holds stance ankles in world coordinates;
heel strike, toe-off, swing clearance and pelvis height follow those measured
lengths. Backward steps reverse the roll, and a side step turns the hips toward
travel while the torso and neck counterturn. Start/stop blends into idle.
`resetMotion()` clears anchors after a portal; a frozen pose preserves its
distance, weight and anchors. Head/limb Euler proxies remain additive above
the solved motion.

`setHorror(level, time, options)` ranges from 0 to 1. `setCreaturePose(time,
progress, {mode, intensity, distance})` supports `crawl`, `ceiling`, `twisted`
and `retreat`. These functions alter the inner model and rig; the encounter
director owns the outer `body` transform. `resetPose()` restores the healthy
standing character. The ceiling pose assumes a body origin .08m below the roof
and applies .075m internal clearance, placing the fingers against the surface.

Creature locomotion is separate from `FigureGait`. `CreatureGait` uses a .82 m
travelled stride with alternating .41 m scrape cues; palms and feet hold fixed
room-space anchors during stance, then lift and land ahead of the moving root.
Travel direction also supports a backward withdrawal without reversing the
contact physics. An inverted surface frame applies the same contacts to the
ceiling. Stable sagittal knee bend planes keep the folded legs within narrow
doorways rather than letting a near-parallel pole flip both knees sideways.
The director eases corner turns and upright-to-low folds and limits the speed
of an accelerated retreat. These changes do not modify the human walking gait.

`setEvidenceBlood(level)` adds an independent 0–1 blood layer to palms,
fingers, forearms and clothing cuffs. The fixed mask comes from the actual
skin weights; original procedural smears and roughness changes use a per-figure
uniform. It does not open the jaw, hollow the face or alter the skeleton, so
the truthful reflection can remain recognizably human. `resetPose()` clears
this layer. No additional texture or external asset is used.

## Separate intruder, local 0.8

`src/demon.mjs` wraps this existing adult female rig with a private facial sculpt
and independent skin, hair and clothing materials. The original dark bob retains
Mara's recognizable proportions; one merged project-authored wet-strand overlay
adds 6,720 triangles. Its mouth opens once during an authored gaze response.
Ordinary Mara, the truthful bloodied reflection, covered mother and mourners do
not receive this treatment. The shared `mara.glb` remains unchanged.

The torn-cheek detail in `unkept-wound.png` is original AI-generated project
artwork, not a MakeHuman image or downloaded film asset. `unkept-wound.json`
records its generation brief, unchanged-output SHA-256 and runtime use. The
register and menu/end/public credits distinguish these sources. Rest-coordinate
projection keeps the patch on the skin during jaw and head deformation.

The creature's stationary contacts accept the director's planned travel direction
before a backward withdrawal. This initializes real planted anchors without a
reset or snap; actual velocity takes precedence once movement starts. The normal
human gait remains separate. See `docs/DEMON_ART.md` for ownership and reset details.
