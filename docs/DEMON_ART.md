# The Unkept — local 0.8 creature study

The creature is an original physical manifestation of Mara's concealed violence.
It does not replace her as the person who killed Evelyn. It should first read as
a human woman who is waiting and looking; the wrong articulation and backward
movement supply the second reading. The original character, funeral mourners,
covered body and final human reflection remain separate instances.

`src/demon.mjs` wraps the existing female figure and planted-contact solver. Its
private skin clone adds an asymmetric collapsed cheek and torn-down mouth corner.
The face retains the source skin texture, with original procedural bruising,
marbled vessels, localized blood, pores and neck strain. An original **AI-generated
RGBA tissue patch** supplies the torn-cheek detail; its generation record and
credits distinguish it from the existing CC0 human asset and procedural art.
The slack mouth opens once as the head orients; the ragged, wet tear connects its
corner to the collapsed cheek. The eyes retain wet, desaturated human irises;
neither eyes nor skin emit light. Dirty linen and dragged stains replace the
ordinary blouse treatment on this instance only.

The original fitted bob preserves Mara's recognizable crown and side volume,
with a dark, rough, low-specular material on this instance only. Eighty-four
original narrow strand clumps follow the measured scalp and fall beside the
face; they are merged into one rigid head-attached mesh over that volume. This
avoids displaced alpha shells and preserves the ordinary Mara hair geometry.
The extra hair adds one mesh and 6,720 triangles. The existing MakeHuman / MPFB
CC0 anatomy, rig, source skin and oral mask retain their credits. The new wound
image is generated original game art, rather than a downloaded third-party asset.

The director's `still` phase freezes the tiny idle head motion. In `orient`, the
head makes one eased additional turn toward the player, limited to twenty
degrees; its mouth opens from a held slackness to the exposed distorted interior,
then that attention remains as the body withdraws. The actual skeleton,
measured limb lengths and world-planted contacts stay in `figure-motion.mjs`.
The head turn also moves the rigid strands without leaving them behind.

The face receives the house's existing HDR indirect light at an independent
material strength. There are no extra creature lights or globally brighter rooms.
Review the ordinary eye-height/no-flash hallway view as well as the closer
flashlight detail study. A detail study is not evidence of what a player sees
during a normal encounter.

`preloadDemonAssets()` awaits the reviewed original RGBA cheek detail at
`assets/character/unkept-wound.png`; production startup awaits it alongside the
human character. A shared transparent fallback also supports isolated figure
fixtures that do not call that preload. Its rectangular
projection uses the skin's original three-dimensional rest coordinates rather
than a floating plane: the patch stays attached through the jaw, cheek, head
and crawl poses. Alpha coverage controls its soft edge, oral masking preserves
the actual open interior, and its surface changes remain limited to the wound.
When present, it replaces the fallback painted cheek seam. The texture is shared
between demon instances, and is not disposed when one instance is removed.

`resetPose()` clears phase/gaze state and restores the deterministic demon
treatment. A normal `createFigure()` does not acquire it. `dispose()` removes the
instance and disposes its private skin/strand geometry, independent
materials and custom depth materials; shared source textures and human geometry
remain available. The director normally reuses this one instance for finite
sightings rather than allocating a fresh model on every encounter.

Research motivates these choices but does not establish that one design scares
every player. See [FEAR_RESEARCH.md](FEAR_RESEARCH.md) for evidence, interpretation
and the proposed encounter grammar. Human playtesting still has to judge fear,
recognition, material quality and habituation.
