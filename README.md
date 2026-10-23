# MIRROR ME — Shorty Game Jam 2026

A first-person psychological horror game about a looping house and a reflection that learns to move without you. Theme: **INVERTED**. Original concept and direction by Skewernet; AI-assisted development with ChatGPT/Codex.

## Realism / threshold-loop pass 0.5

Mara Vale returns to collect her mother's belongings. An impossible telephone call asks her to finish an ordinary evening. A reflection learns the routine, then offers to take her place.

The building follows one narrow L: five furnished rooms, a low ceiling, and a mirror directly ahead after the corner. Leaving through the back door returns Mara to the front entrance of the same house. There is no physical return passage around a partition. Early exits retain discoveries and repeat the current pass; completing its clues changes the next return.

This revision replaces the primitive character with a rigged MakeHuman female mesh, detailed skin, strand hair, fitted clothes and shoes. The house uses photographic wood/fabric, independent PBR normal/roughness maps, restrained indirect reflections, soft practical shadows and screen-space contact shading. The default image is up to 1080p, with 720p performance and 1440p detail options. Grain and walking motion start off.

Mara's reflection becomes late, held, damaged, absent and independent across five authored passes. Objects move and fall; a bounded section of the hall becomes a photographic negative. Two sudden encounters have one-time story triggers and a settings switch. No strobe or forced camera shake is used.

The sitting-room **telephone carries calls only**. The separate **kitchen radio** has its own weather bulletin, tuning light, speaker and knobs. The last routine is undone in reverse: bedroom music box → bathroom tap → kitchen radio. Checking the telephone cannot spoil that puzzle. Seventeen dialogue/radio takes now use distinct offline Kokoro voices for Mara, Mum and the radio; all performances are synthetic.

**0.5 is a local development build, not the production release.** The approved 0.4 remains at [mirror-me.pages.dev](https://mirror-me.pages.dev) on GitHub `main`; its release manifest identifies the exact revision. First-time duration, scare effectiveness, subjective voice quality and target-GPU performance need human playtesting. The discovery target is 8–12 minutes, with no added wait timers.

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
| Escape | Pause; leave journal/clock/credits for menu |
| Settings | Resolution, brightness, contact shadows, grain, sudden scares, sensitivity, volume, voices and walking motion |

Pause, journal and clock inspection suspend gameplay/audio. Restart clears the house and inventory while keeping settings. Credits are accessible before play, from pause, and at the ending. No sprint, combat, mobile controls or persistent save is included.

## Validate

```sh
python3 tools/check_credits.py
node --test tests/*.test.mjs
node tests/browser.cjs
node tests/browser-smoke.cjs
```

Browser checks require a running local server, Playwright and system Chromium, available in the prepared environment. Set `MIRROR_TEST_URL`, `MIRROR_TEST_OUTPUT` or `CHROMIUM_PATH` when needed. `?test=1` enables explicit simulation/render controls for deterministic validation; those controls are absent from ordinary play.

Twenty-one unit tests cover movement, rear-door progression, early exits, puzzle recovery and reset. The browser route exercises actual collision-respecting movement through the five rooms and five passes, interactions, mirror states, portal pause/return, sound puzzle, sudden encounters, credits, ending/replay and seventeen decoded voice files. Ordinary-mode smoke checks cover startup, menu, settings, mouse capture, movement and pause. See [current status](PROJECT_STATUS.md) for results and limitations. Cloud software rendering is not a target-GPU performance benchmark.

## Development, credits and release

- [Current status](PROJECT_STATUS.md)
- [Direction, complete script and walkthrough — spoilers](GAME_DIRECTION.md)
- [Original audit and first-slice plan](DEVELOPMENT_PLAN.md)
- [Development log](DEVLOG.md)
- [Full asset provenance](ATTRIBUTIONS.md) and [machine-readable register](assets/credits.json)
- [Copy-ready game description and public asset credits](GAME_DESCRIPTION.md)
- [Cloudflare operating instructions](CLOUDFLARE_SETUP.md)

Every externally sourced asset must have a register entry identifying creator, source, license, local files and modifications. In-game credits and ending credits read the register. Keep the public description's credit list synchronized when adding assets. Free does not mean attribution-free: the wood maps carry CC BY 4.0, while the MakeHuman and Poly Haven assets are CC0. Runtime Three.js license text is retained; voice model/tool provenance is documented.

Cloudflare Pages project `mirror-me` is connected to this repository with `main` as production branch. Production automation and branch previews are enabled, so **a push can publish**. Do not push the development branch or deploy without the owner's approval of the specific build. Earlier webhook behavior was unreliable; a push alone is not proof of deployment.

For an approved release, `python3 tools/deploy_pages.py --github-build` explicitly builds remote main and verifies its commit and every public runtime hash. `--verify-only` is read-only. Build settings remain `python3 tools/stage_pages.py --output-dir dist`, output `dist`, repository root. No deployment occurs at environment startup. Do not modify Morlins Quest or Skewer Signals.
