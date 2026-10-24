# Evelyn Vale — independent mother character

Evelyn is a separately built, rigged adult character, not a cloned or recolored
Mara. The original fictional family portrait supplies her identity: the mother
seated at the left has a broad oval face, strong nose, soft short waved hair and
a cream floral blouse. The new model interprets her at age 68, with an elderly
MakeHuman morphology, old-female skin, fuller cheeks/jowls, a shorter 1.62 m
stature, a separate short wavy ash/chestnut hairstyle, and a fitted blouse/skirt
and low shoes. This is an original game character guided by the portrait, not a
biometric reconstruction or a claim of a film-quality digital double.

## Distinct source and appearance

The body was generated independently with MPFB at the same pinned commit as the
existing licensed rig, using age .94, weight .59, muscle .24 and explicitly
recorded portrait-led face targets. It does not load `mara.glb`. The following
CC0 system assets differ from Mara's: `old_caucasian_female` skin,
`female_elegantsuit01` fitted clothing, `short02` wavy hair, and `shoes04`.
Original runtime shading supplies the softly faded cream/rose floral print,
dark skirt, gray hair strands and fine strand relief. The earlier experimental
procedural hair curls were discarded after render review; they are not shipped.

The same 53-bone game-engine naming makes the independent asset compatible with
the measured limb solver. Anatomical mouth-opening and left/right eyelid closure
morphs are embedded. The loader exposes `preloadEvelynAssets()` and, afterward,
`createEvelyn({ wounded: false })`, which returns body/rig/head, mouth and eyelid
controls, and a pose reset that preserves the caller's root placement.

Each instance owns its materials and pose. The clean casket Evelyn retains the
original topology. `wounded: true` adds original, measured, bone-attached injury
geometry and owned cut surfaces through `src/evelyn-wounds.mjs`; that helper does
not change the clean asset or Mara. The wounded and clean bodies keep the same
Evelyn identity.

## Provenance and reproduction

MakeHuman's base mesh, rig, targets and these system assets are CC0 1.0; creators
are the MakeHuman Team / Data Collection AB, Joel Palmius and Jonas Hauquier.
The repository's `LICENSE-CC0.md` and `MPFB-LICENSE.md` apply. MPFB is a build-time
GPL tool; its source and the source archive remain outside the runtime package.
`evelyn-sources.json` records the trusted archive hash, pinned MPFB revision,
selected source hashes, portrait reference hash and final output hash.
`evelyn.json` records measured build counts and morphology. See the existing
`sources.json` for authoritative license listings and the shared source archive.

From the repository with Blender 4.3 and the pinned sources outside the checkout:

```sh
XDG_CONFIG_HOME=/tmp/evelyn-blender blender -b --python-exit-code 1 \
  --python tools/build_evelyn.py -- \
  --mpfb /path/to/mpfb2/src --assets /path/to/unpacked/mh_system_CC0 \
  --output assets/character/evelyn.glb
```

`tests/evelyn-model.cjs` checks the independent vertex fingerprint, rig/morph
controls, clean/wounded isolation and actual rendered shader compatibility.
Diagnostic images are written outside the checkout.
