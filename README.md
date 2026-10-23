# MIRROR ME — Shorty Game Jam 2026

A first-person psychological horror game about a looping house and a reflection that learns to move without you. Theme: **INVERTED**. Original concept and direction by Skewernet; AI-assisted development with ChatGPT/Codex.

## Crescendo / through the glass — local 0.6

**0.6 is a local development build on `develop/crescendo-mirror-world`; it has not been pushed or deployed.** The last verified, owner-approved production release is **0.5 at `db45d9b`**, at [mirror-me.pages.dev](https://mirror-me.pages.dev). The changes described below have not been published; validation below covers the local build. See [current status](PROJECT_STATUS.md).

Mara Vale returns to collect her mother's belongings. An impossible telephone call asks her to finish an ordinary evening. A reflection learns the routine, then offers to take her place.

The building follows one narrow L: five furnished rooms, a low ceiling, and a mirror directly ahead after the corner. Seven chapters build an ordered routine: restore the light and establish the reflection; test the glass and find the diary; solve the reflected clock and radio; return three keepsakes; undo the evening's sounds; enter the empty mirror; and say farewell in the inverted house.

The rear door stays physically locked until the current chapter's puzzle is complete. Walking through it returns Mara immediately to the front entrance, preserving held movement, transformed velocity and facing, and the distance already travelled through the threshold. There is no fade or forced stop. Five rear returns lead to a missing door and an empty mirror; crossing the glass opens the inverted farewell, then the front door leads into a playable wake.

Mara is a rigged MakeHuman female character with detailed skin, strand hair, fitted clothes and shoes. Distance-driven strides now use planted feet, limb solving and weight shifts. Her reflection progresses from faithful to late and held, then develops a hollow face and distorted anatomy before disappearing. Six authored room and hallway sightings use crawling, ceiling and folded-body poses, directional sound and local light disturbances. Décor moves and falls, wall markings accumulate, and crossing the mirror changes the house's colors and light. Sudden scares and irregular light flicker have separate settings; neither is needed to solve the game.

The house retains photographic wood/fabric, independent PBR normal/roughness maps, restrained indirect reflections, soft practical shadows and screen-space contact shading. The default image is up to 1080p, with 720p performance and 1440p detail options. Grain and walking motion start off. The wake uses seated, veiled clones of Mara's actual rig, with room to walk and look around during its final sequence.

The sitting-room **telephone carries calls only**. The separate **kitchen radio** has a tuning form and its own station puzzle. The watch, ring and ribbon must be returned to the correct places in the diary's care order; the evening's sounds are later stopped in reverse: bedroom music box → bathroom tap → kitchen radio. Wrong attempts can be corrected, and checking the telephone cannot spoil the sound puzzle. Twenty-three dialogue/radio takes use distinct offline Kokoro voices for Mara, Mum and the radio; all performances are synthetic.

The first-play target is **10–15 minutes**, still unvalidated by human timing. The automated known-solution route took 317.895 simulated game seconds, excluding real voice waits. That result does not establish discovery time, scare effectiveness, subjective voice quality or performance on a real desktop GPU.

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
```

Browser checks require a running local server, Playwright and system Chromium, available in the prepared environment. Set `MIRROR_TEST_URL`, `MIRROR_TEST_OUTPUT` or `CHROMIUM_PATH` when needed. `?test=1` enables explicit simulation/render controls for deterministic validation; those controls are absent from ordinary play.

All 25 unit tests pass. The integrated browser route passes all seven chapters through actual collision-respecting movement: locked puzzle gates, five motion-preserving rear returns, radio and keepsake forms, reverse sound order, floor/ceiling sightings, the vanished rear wall, mirror crossing, inverted farewell, playable wake, credits and reset. All 23 voice files decode and match their script text. A fresh ordinary-mode smoke passes startup, credits, mouse capture, movement, flashlight, journal/pause and graphics/comfort controls. Both browser runs report no JavaScript, console or failed-request errors. The credits checker verifies 11 register entries covering 56 media/model assets and seven vendor modules. See [current status](PROJECT_STATUS.md) for the evidence and its limits. Cloud software rendering is not a target-GPU performance benchmark.

## Development, credits and release

- [Current status](PROJECT_STATUS.md)
- [Direction, complete script and walkthrough — spoilers](GAME_DIRECTION.md)
- [Original audit and first-slice plan](DEVELOPMENT_PLAN.md)
- [Development log](DEVLOG.md)
- [Full asset provenance](ATTRIBUTIONS.md) and [machine-readable register](assets/credits.json)
- [Copy-ready game description and public asset credits](GAME_DESCRIPTION.md)
- [Cloudflare operating instructions](CLOUDFLARE_SETUP.md)

Every externally sourced asset must have a register entry identifying creator, source, license, local files and modifications. In-game credits and ending credits read the register. Keep the public description's credit list synchronized when adding assets. Free does not mean attribution-free: the wood maps carry CC BY 4.0, while the MakeHuman and Poly Haven assets are CC0. Runtime Three.js license text is retained; voice model/tool provenance is documented.

Cloudflare Pages project `mirror-me` is connected to this repository with `main` as production branch. Production automation and branch previews are enabled, so **a push can publish**. Only the 0.5 release at `db45d9b` is approved for production; its deployment verification recorded 96 matching public runtime files. Local 0.6 requires the owner's specific approval before a potentially publishing push or deployment. Check the deployment result and public asset hashes rather than treating a push alone as proof; `/build-id.json` identifies the deployed revision.

For an approved release, `python3 tools/deploy_pages.py --github-build` explicitly builds remote main and verifies its commit and every public runtime hash. `--verify-only` is read-only. Build settings remain `python3 tools/stage_pages.py --output-dir dist`, output `dist`, repository root. No deployment occurs at environment startup. Do not modify Morlins Quest or Skewer Signals.
