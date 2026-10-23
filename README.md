# MIRROR ME — Shorty Game Jam 2026

A first-person psychological horror game about a looping house and a reflection that learns to move without you. Theme: **INVERTED**. Original concept and direction by Skewernet; AI-assisted development with ChatGPT/Codex.

## Inverted confession — local 0.7

**0.7 is a local review build on `develop/inverted-confession`; it has not been pushed or deployed.** The last verified, owner-approved production release remains **0.6 at `d354651`**, at [mirror-me.pages.dev](https://mirror-me.pages.dev). Its 110 public runtime/credit files matched the tested package. The integrated route, source-browser, creature-clearance and immutable-package checks pass; specific publication approval remains. See [current status](PROJECT_STATUS.md).

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
```

Browser checks require a running local server, Playwright and system Chromium, available in the prepared environment. Set `MIRROR_TEST_URL`, `MIRROR_TEST_OUTPUT` or `CHROMIUM_PATH` when needed. `?test=1` enables explicit simulation/render controls for deterministic validation; those controls are absent from ordinary play.

All 29 unit tests, the full seven-chapter collision-respecting browser route and the final ordinary-mode smoke pass. The route verifies the repaired door, instant returns, required truth acknowledgment, bloodied reflection, crime scene, all 25 script-matching decoded voices and the complete spatial funeral report, including pause/resume and no early ending. A separate actual-skinned-geometry check verifies narrow crawlers clear the 0.88 m bedroom doorway with planted contacts and fit below the 2.32 m ceiling; standing locomotion is unchanged. Passing browser checks report no page/console errors or failed requests. The register covers 11 credit entries, 58 media/model assets and seven vendor modules. The immutable package also passes normal startup/play/pause, with all 113 runtime hashes matching source and all 25 voice files accessible. See [current status](PROJECT_STATUS.md) for the evidence and its limits; cloud software rendering is not a target-GPU performance benchmark.

## Development, credits and release

- [Current status](PROJECT_STATUS.md)
- [Direction, complete script and walkthrough — spoilers](GAME_DIRECTION.md)
- [Original audit and first-slice plan](DEVELOPMENT_PLAN.md)
- [Development log](DEVLOG.md)
- [Full asset provenance](ATTRIBUTIONS.md) and [machine-readable register](assets/credits.json)
- [Copy-ready game description and public asset credits](GAME_DESCRIPTION.md)
- [Cloudflare operating instructions](CLOUDFLARE_SETUP.md)

Every externally sourced asset must have a register entry identifying creator, source, license, local files and modifications. In-game credits and ending credits read the register. Keep the public description's credit list synchronized when adding assets. Free does not mean attribution-free: the wood maps carry CC BY 4.0, while the MakeHuman and Poly Haven assets are CC0. Runtime Three.js license text is retained; voice model/tool provenance is documented.

Cloudflare Pages project `mirror-me` is connected to this repository with `main` as production branch. Production automation and branch previews are enabled, so **a push can publish**. The owner-approved 0.6 release is last verified at `d354651`, with 110 matching public payload hashes. Local 0.7 has no publication approval. Keep it local until the owner approves these specific changes, then verify the deployment and public payload before claiming it is live. Check the deployment result and public asset hashes rather than treating a push alone as proof; `/build-id.json` identifies the deployed revision.

For an approved release, `python3 tools/deploy_pages.py --github-build` explicitly builds remote main and verifies its commit and every public runtime hash. `--verify-only` is read-only. Build settings remain `python3 tools/stage_pages.py --output-dir dist`, output `dist`, repository root. No deployment occurs at environment startup. Do not modify Morlins Quest or Skewer Signals.
