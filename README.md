# MIRROR ME — Shorty Game Jam 2026

A first-person psychological horror game about a looping house and a reflection that learns to move without you. Theme: **INVERTED**. Original concept and direction by Skewernet; AI-assisted development with ChatGPT/Codex.

## Mara — playable picture and story pass 0.4

Mara Vale returns to collect her mother's belongings. An impossible telephone call asks her to finish an ordinary evening. A reflection learns the routine, then offers to take her place.

Five furnished, enterable rooms connect to one house. The entry now turns into an L-shaped hall with a mirror on its forward sightline; a separate return passage completes the circuit. The kitchen doorway has lighter panels, a plaque and its own always-on practical light, including before power restoration.

The sitting-room **telephone handles calls only**. A physically separate **kitchen radio** has speaker cloth, tuning scale, knobs, aerial and its own local weather/static audio. The final routine is undone in reverse: bedroom music box → bathroom tap → kitchen radio. Checking the telephone cannot advance or spoil that puzzle.

Mara has a new female model with sculpted face, shoulder-length hair, cardigan, blouse, trousers and pendant. Her reflection becomes late, held, pale, blood-stained, absent, then independent. New domestic dressing establishes objects before a frame falls and a cup slides off the counter. A bounded section of familiar wallpaper, panelling and runner becomes a photographic negative; light and selected objects invert locally.

The picture pass adds restrained screen-space contact shadows, edge smoothing and a filmic response. Contact shadows can be disabled and are omitted at 480p; rendering has an 8-bit/no-AO capability fallback. No full-screen inversion flash, persistent camera shake or forced head motion is added.

**The owner-approved 0.4 build is live at [mirror-me.pages.dev](https://mirror-me.pages.dev), synchronized with GitHub `main`.** Gameplay release `d55c2cf` was built through Cloudflare and all 43 runtime assets matched. `/build-id.json` identifies the exact current revision, including release-record updates. The new collision-respecting known-solution validation route takes roughly 4 minutes 36 seconds; first-time duration and scare effectiveness need human playtesting. The target remains 8–12 minutes of discovery, not added wait timers.

## Run locally

From this repository:

```sh
python3 -m http.server 8000 --bind 127.0.0.1
```

Open the server in a desktop WebGL browser. Click ENTER to capture the mouse and enable audio. Serve over HTTP; double-clicking `index.html` does not reliably load modules. No build, package install, API key, CDN or speech service is needed to play. Three.js, material/photo atlases and seventeen synthetic provisional voice clips are local assets. The cloud onboarding interface does not provide a supported local web preview.

## Controls

| Input         | Action                                                                                                |
| ------------- | ----------------------------------------------------------------------------------------------------- |
| WASD / arrows | Walk                                                                                                  |
| Mouse         | Look                                                                                                  |
| E             | Inspect, collect, open doors, use an item or operate an object                                        |
| F             | Flashlight; no battery grind                                                                          |
| Tab           | Inventory and journal; pauses play                                                                    |
| H             | Optional contextual thought if stuck                                                                  |
| Escape        | Pause; leave journal/clock for pause menu                                                             |
| Settings      | Picture resolution, brightness, contact shadows, grain, sensitivity, volume, voice and walking motion |

Head motion is off by default. Pause, inventory and clock inspection suspend gameplay/audio. Restart clears the house and inventory while keeping current settings. No sprint, combat, mobile controls or persistent save is included.

## Validate

```sh
node --test tests/*.test.mjs
node tests/browser.cjs
node tests/browser-smoke.cjs
```

Browser validation requires the local server, Playwright and system Chromium, available in the prepared environment. Set `MIRROR_TEST_URL`, `MIRROR_TEST_OUTPUT` or `CHROMIUM_PATH` as needed. The explicit `?test=1` harness uses manual simulation/rendering for deterministic checks; it is absent from normal play.

Sixteen unit tests cover movement and progression. The full browser route uses actual collision-respecting movement through every room and all five passes, tests the clock form, wrong-order recovery, inventory, paused input/audio, ending/reset, flashlight, and decodes all seventeen non-silent voice files. It also verifies independent telephone/radio behavior, the optional hospital letter, falling props, local inversion and their full reset. See [current status](PROJECT_STATUS.md) for ordinary-mode verification and remaining limitations. Cloud software rendering does not establish performance on a player's GPU or subjective audio quality.

## Development and release

- [Current status](PROJECT_STATUS.md)
- [Direction, puzzle walkthrough and complete voice script — spoilers](GAME_DIRECTION.md)
- [Original audit and first-slice plan](DEVELOPMENT_PLAN.md)
- [Development log](DEVLOG.md)
- [Asset provenance](ATTRIBUTIONS.md)
- [Cloudflare connection and operating instructions](CLOUDFLARE_SETUP.md)

The existing production project is [mirror-me.pages.dev](https://mirror-me.pages.dev), connected to this GitHub repository with `main` as production branch. Production automation and branch previews are enabled; **a push can publish**. Earlier pushes did not create deployment records, so a successful push alone is not proof of release. The approved 0.4 build was built from GitHub and all 43 runtime files were verified against its source/hash manifest.

Further production changes require the owner's approval of the specific build. Pushes and deployments are explicit release actions; the owner approved publication of this 0.4 build. Future production changes require their own specific approval. For an approved release, `python3 tools/deploy_pages.py --github-build` explicitly builds remote main and verifies its commit plus every public runtime hash; `--verify-only` is read-only. Build settings are `python3 tools/stage_pages.py --output-dir dist`, output `dist`, repository root. No deployment runs at environment startup. Do not modify Morlins Quest or Skewer Signals.
