# MIRROR ME — Shorty Game Jam 2026

A first-person psychological horror game about a looping house and a reflection that learns to move without you. Theme: **INVERTED**. Original concept and direction by Skewernet; AI-assisted development with ChatGPT/Codex.

## House expansion — development build 0.3

Five furnished, enterable rooms connect to a continuous hallway circuit: sitting room, kitchen, bathroom, bedroom and utility room. Worn floral wallpaper, stained tile, timber, upholstered furniture, rain windows and practical lighting give the house a specific domestic identity. Smooth silhouettes and detailed materials replace the original blocky presentation; optional 480p rendering retains a restrained retro treatment.

Five authored passes form a complete short arc: restore power, confront the delayed reflection, recover a bedroom diary, interpret a backward-time clue, reverse a nightly sound sequence, then refuse the glass's final instruction. The ending visibly reverses who can leave. The reflection follows, delays, holds its ground, disappears and acts independently. Changes include a missing family, a breathing quilt, displaced furniture and a watcher in the return passage.

The owner-approved expansion is published at **[mirror-me.pages.dev](https://mirror-me.pages.dev)** from GitHub `main`. The first verified expansion release used gameplay revision `d5b3575`; `/build-id.json` identifies the exact current release. A known-solution collision-respecting test route takes about 3 minutes 50 seconds; first-time duration and scare effectiveness require human playtesting. The design target is 8–12 minutes of discovery, not artificial waits.

## Run locally

From this repository:

```sh
python3 -m http.server 8000 --bind 127.0.0.1
```

Open the server in a desktop WebGL browser. Click ENTER to capture the mouse and enable audio. Serve over HTTP; double-clicking `index.html` does not reliably load modules. No build, package install, API key, CDN or speech service is needed to play. Three.js, material/photo atlases and fifteen synthetic provisional voice clips are local assets. The cloud onboarding interface does not provide a supported local web preview.

## Controls

| Input         | Action                                                                               |
| ------------- | ------------------------------------------------------------------------------------ |
| WASD / arrows | Walk                                                                                 |
| Mouse         | Look                                                                                 |
| E             | Inspect, collect, open doors, use an item or operate an object                       |
| F             | Flashlight; no battery grind                                                         |
| Tab           | Inventory and journal; pauses play                                                   |
| H             | Optional contextual thought if stuck                                                 |
| Escape        | Pause; leave journal/clock for pause menu                                            |
| Settings      | Picture resolution, brightness, grain, sensitivity, volume, voice and walking motion |

Head motion is off by default. Pause, inventory and clock inspection suspend gameplay/audio. Restart clears the house and inventory while keeping current settings. No sprint, combat, mobile controls or persistent save is included.

## Validate

```sh
node --test tests/*.test.mjs
node tests/browser.cjs
node tests/browser-smoke.cjs
```

Browser validation requires the local server, Playwright and system Chromium, available in the prepared environment. Set `MIRROR_TEST_URL`, `MIRROR_TEST_OUTPUT` or `CHROMIUM_PATH` as needed. The explicit `?test=1` harness uses manual simulation/rendering for deterministic checks; it is absent from normal play.

Fifteen unit tests cover movement and progression. The full browser route uses actual collision-respecting movement through every room and all five passes, tests the clock form, wrong-order recovery, inventory, paused input/audio, ending/reset, flashlight, and decodes all fifteen non-silent voice files. See [current status](PROJECT_STATUS.md) for ordinary-mode verification and remaining limitations. Cloud software rendering does not establish performance on a player's GPU or subjective audio quality.

## Development and release

- [Current status](PROJECT_STATUS.md)
- [Direction, puzzle walkthrough and complete voice script — spoilers](GAME_DIRECTION.md)
- [Original audit and first-slice plan](DEVELOPMENT_PLAN.md)
- [Development log](DEVLOG.md)
- [Asset provenance](ATTRIBUTIONS.md)
- [Cloudflare connection and operating instructions](CLOUDFLARE_SETUP.md)

The existing production project is [mirror-me.pages.dev](https://mirror-me.pages.dev), connected to this GitHub repository with `main` as production branch. Production automation and branch previews are enabled; **a push can publish**. Earlier pushes did not create deployment records, so a successful push alone is not proof of release. The approved expansion was built from GitHub and all 39 runtime files were verified against its source/hash manifest.

Further production changes require the owner's approval of the specific build. Pushes and deployments are explicit release actions; the owner approved publication of this expansion. For an approved release, `python3 tools/deploy_pages.py --github-build` explicitly builds remote main and verifies its commit plus every public runtime hash; `--verify-only` is read-only. Build settings are `python3 tools/stage_pages.py --output-dir dist`, output `dist`, repository root. No deployment runs at environment startup. Do not modify Morlins Quest or Skewer Signals.
