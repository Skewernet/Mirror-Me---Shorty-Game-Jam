# Mara Vale character asset

Mara is an original fictional adult woman assembled from MakeHuman's **CC0**
anatomical mesh, morphology, rig and system assets. The reflection, passage
apparition and replacement use the same model. She is 1.74 metres tall, with a
chestnut bob, a long-sleeved burgundy blouse, dark jeans and ordinary black shoes.
The base anatomy is a continuous subdivided, UV-mapped mesh, rather than a
collection of primitives. This is a game-ready human asset; it is not a scan or
a claim of a film-quality digital double.

`mara.glb` contains the seven skinned meshes, their PBR materials and embedded
textures, plus the 53-bone game rig. Skin, costume and hair use 2048px source
atlases. Exported JPEG textures preserve face detail while keeping the complete
bundle around 8 MB; eyes and hair retain alpha cutouts. `mara.json` records the
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

At runtime, `preloadCharacterAssets()` loads the single local GLB once.
`createFigure()` clones the skeleton and materials synchronously, retaining
shared geometry and base textures. Head and limb controls apply offsets to
saved rest rotations. The horror variants add tired eye sockets, pallor, a
dried tear and a split lip to her own UV skin; they keep Mara recognizably the
same woman. Variants use independent texture Sources so the normal skin is not
mutated when another instance changes.
