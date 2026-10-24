# MIRROR ME — Shorty Game Jam 2026

A first-person psychological horror game about a looping house and a reflection that learns to move without you. Theme: **INVERTED**. Original concept and direction by Skewernet; AI-assisted development with ChatGPT/Codex.

## Demonic presence — 0.8

**Current local development — dialogue, evidence and ending:** the house starts without practical lights and Mara identifies the failed fuse. The returned family photograph is visible in the entrance hall, must be straightened, and carries a memory of Dad. After the glass crossing, a bloodied bathroom and connected handprint/footfall trail reveal Evelyn's flight to her bed. The completed funeral report and Mum's final accusation precede a wounded-human lunge and fade; reduced-scare mode keeps a quiet ending. There are 29 matching local synthetic voice takes. These changes are not pushed or deployed.

**Local development — Environment and Mirror Polish, Pass 1:** continuous architectural texture placement, fitted floor/skirting and door trim, a reflective bathroom mirror with uneven condensation and finger-wiped time, and capsule-aware hall-mirror collision/entry. The existing backward-time puzzle and PBR presentation are preserved. These changes have not been pushed or deployed; production remains the approved 0.8 described below. See [current status](PROJECT_STATUS.md) for validation.

**The owner-approved 0.8 is live at [mirror-me.pages.dev](https://mirror-me.pages.dev/?v=0.8), synchronized with GitHub `main`.** Reviewed revision `3d26ffb` deployed automatically, and all 116 public runtime/credit hashes match the tested package. `/build-id.json` identifies the exact deployed revision, including documentation-only release records. See [current status](PROJECT_STATUS.md).

The authored intruder has new appearance, timing and nonverbal sound. The demon owns its facial sculpt and surfaces; Mara's normal reflection, the truthful final reflection, the covered mother and the mourners keep their existing human model. The house, puzzle order and seamless returns retain the 0.7 baseline.

The familiar female face has a collapsed cheek and an original generated torn-tissue decal, dark matted hair and wet human eyes. It holds still, makes one bounded head/jaw response and withdraws with planted contacts. Three sightings begin silently and three have one local breath beforehand. New finite throat, breath and palm/fabric textures preserve dialogue priority, pause and restart; disabling sudden scares cancels a paused creature cue. [Art and implementation details](docs/DEMON_ART.md).

[Fear research and original creature direction](docs/FEAR_RESEARCH.md) separates literature, film interpretation and testable design ideas. Research-host access was blocked during this session; the bibliography is explicitly unverified here. No film assets or new external creature/sound libraries are used.

## The house and inverted confession

Mara Vale returns with a version of the evening in which she was a devoted daughter and her mother died from illness. The mirror keeps correcting what that account leaves out. The revised final chapter reveals a violent death in the familiar bedroom, followed by a separate funeral-room radio report that names Mara's responsibility. The horror comes from recognition, rather than an external demon taking the blame. The complete script and walkthrough contain spoilers in [GAME_DIRECTION.md](GAME_DIRECTION.md).

The building keeps the approved narrow L, five furnished rooms, readable kitchen entrance and seven ordered chapters. Restore the light; test the reflection; solve the reflected clock and kitchen radio; return the keepsakes; undo the evening's sounds; enter the empty mirror; then acknowledge what happened in Mum's room. The rear door stays physically locked until each of the first five chapters is complete. Its threshold returns Mara immediately to the front hall while preserving held movement, transformed velocity and facing, lateral position and crossing overshoot. There is no fade or forced stop.

The rear leaf now opens inward and folds flat along the hall wall, with corrected hinge/jamb clearance and a collider aligned to its closed position. It stays on the source side of the portal instead of being sliced by the view into the front room. Floor and ceiling crawlers use deliberate, world-planted contacts, measured limb solving and travel-driven movement; the standing walk and delayed/held reflection retain their separate gait.

The mirror progresses from faithful to late and held, then distorted and absent. After the physical crossing it returns Mara's ordinary human identity, visibly bloodied, against the revealed crime scene. The bedroom contains the covered mother, a blood-soaked bed, knife and blood on surrounding domestic surfaces. A finite broken-voice/cry beat precedes the bedside admission. Inspecting the bed establishes the truth; only then can Mara switch off the lamp and leave through the front entrance.

That exit leads to the pale playable funeral room. Its own visible radio delivers a complete one-shot news report, separate from the silent kitchen radio and the sitting-room telephone. The ending waits for the report, a quiet interval and Mum's final accusation before fading. It does not offer forgiveness. Free look, walking, flashlight and pause remain available, and pausing dialogue resumes from its current offset. Voice mute retains captions and equivalent pacing.

The house retains photographic wood/fabric, independent PBR normal/roughness maps, restrained indirect reflections, soft practical shadows and screen-space contact shading. Default output is up to 1080p, with 720p performance and 1440p detail options. Grain and walking motion start off. Six finite authored sightings, directional sound, falling décor and independent sudden-scare/light-flicker settings remain; changing comfort settings cannot block a puzzle.

The sitting-room **telephone carries calls only**. The **kitchen radio** retains the 93.7 FM puzzle and weather role. The **funeral radio** carries the late factual report. Keepsakes still follow the diary's care order, and the evening's sounds stop in reverse: bedroom music box → bathroom tap → kitchen radio. Wrong attempts remain recoverable. Twenty-five local Kokoro performances cover Mara/glass, Mum, weather, the funeral report and broken-word crying; all performances are synthetic.

The first-play target remains **10–15 minutes**, unvalidated by first-time human timing. The revised ending must be tested for clarity, pacing and headphone balance. Cloud software rendering cannot establish real desktop-GPU performance or how frightening the game feels.

## Run locally

```sh
python3 -m http.server 8000 --bind 127.0.0.1
```

Use a desktop WebGL browser and click ENTER to capture the mouse and enable audio. Serve over HTTP; opening `index.html` directly does not reliably load modules. No build, package install, API key, CDN or speech service is required to play. All runtime models, materials, code and audio are local. The cloud onboarding interface does not support a local web preview.

## Controls

| Input | Action |
| --- | --- |
| WASD / arrows | Walk |
| Mouse | Look |
| E | Inspect, collect, open doors or operate an object |
| F | Flashlight; no battery grind |
| Tab | Inventory and journal; pauses play |
| H | Optional contextual thought |
| Escape | Pause; leave journal/puzzle forms/credits for menu |
| Settings | Resolution, brightness, contact shadows, grain, sudden scares, irregular light flicker, sensitivity, volume, voices and walking motion |

Pause, journal and puzzle forms suspend gameplay/audio. Restart clears the house and inventory while keeping settings. Credits are accessible before play, from pause, and at the ending. No sprint, combat, mobile controls or persistent save is included.

## Validate

```sh
python3 tools/check_credits.py
node --test tests/*.test.mjs
node tests/browser.cjs
node tests/browser-smoke.cjs
node tests/creature-bounds.cjs
node tests/demon.cjs
node tests/demon-director.cjs
node tests/demon-sound.cjs
node tests/bathroom-mirror.cjs
node tests/mirror-transition.cjs
node tests/opening-photo.cjs
node tests/crime-scene.cjs
node tests/funeral-scare.cjs
node tests/door-transitions.cjs
node tests/portal-warmup.cjs
```

Browser checks require a running local server, Playwright and system Chromium, available in the prepared environment. Set `MIRROR_TEST_URL`, `MIRROR_TEST_OUTPUT` or `CHROMIUM_PATH` when needed. `?test=1` enables explicit simulation/render controls for deterministic validation; those controls are absent from ordinary play.

The 0.8 source passes all 29 unit tests, 40 creature geometry/gaze/contact cases and eight director lifecycle checks. These include normal-human isolation, all authored anatomical strengths, ceiling/floor limits, real occlusion, silence/anticipation, dialogue priority, reduced flashing, reset and the still-to-backward handoff. Real Web Audio checks cover finite tails, headroom, pause/resume, cancellation and cleanup. The exact 117-file immutable package passes both ordinary-mode startup/controls and the complete seven-chapter collision route, including the full funeral report and reset. All 116 runtime/credit hashes match source; evidence is recorded in [current status](PROJECT_STATUS.md). Credits cover 11 entries, 59 media/model assets and seven vendor modules. Human playtesting must judge fear, material quality, headphone mix and first-play duration; cloud software rendering does not establish target-GPU performance.

## Development, credits and release

- [Current status](PROJECT_STATUS.md)
- [Direction, complete script and walkthrough — spoilers](GAME_DIRECTION.md)
- [Original audit and first-slice plan](DEVELOPMENT_PLAN.md)
- [Development log](DEVLOG.md)
- [Fear research and creature direction](docs/FEAR_RESEARCH.md)
- [Full asset provenance](ATTRIBUTIONS.md) and [machine-readable register](assets/credits.json)
- [Copy-ready game description and public asset credits](GAME_DESCRIPTION.md)
- [Cloudflare operating instructions](CLOUDFLARE_SETUP.md)

Every externally sourced asset must have a register entry identifying creator, source, license, local files and modifications. In-game credits and ending credits read the register. Keep the public description's credit list synchronized when adding assets. Free does not mean attribution-free: the wood maps carry CC BY 4.0, while the MakeHuman and Poly Haven assets are CC0. Runtime Three.js license text is retained; voice model/tool provenance is documented.

Cloudflare Pages project `mirror-me` is connected to this repository with `main` as production branch. Production automation and branch previews are enabled, so **a push can publish**. The owner specifically approved publication of this 0.8 build; its automatic deployment and all 116 public payload hashes are verified. Future game changes require their own approval before a potentially publishing push or deployment. Check the deployment result and public asset hashes rather than treating a push alone as proof; `/build-id.json` identifies the deployed revision.

For an approved release, `python3 tools/deploy_pages.py --github-build` explicitly builds remote main and verifies its commit and every public runtime hash. `--verify-only` is read-only. Build settings remain `python3 tools/stage_pages.py --output-dir dist`, output `dist`, repository root. No deployment occurs at environment startup. Do not modify Morlins Quest or Skewer Signals.
