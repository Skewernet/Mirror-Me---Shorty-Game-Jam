# Development log

## 2026-10-22 — Day 1

- Shorty Jam theme announced: INVERTED.
- MIRROR ME conceived as an original first-person psychological horror game.
- Public GitHub repository initialized.
- AI-assisted PS1-style hallway prototype implemented using Three.js.
- Cloudflare Pages project requested under `mirror-me-shorty-jam`.

## 2026-10-22 — Development handoff audit

- Read the complete handoff and all prototype files; compared local HEAD with remote main.
- Documented movement, collision, loop, interaction, mirror and restart limitations in DEVELOPMENT_PLAN.md.
- Ran a local Chromium diagnostic with a TLS-verified module copy; confirmed rendering, pointer lock, loop-two progression and pause on pointer-lock release. Normal Chromium CDN loading failed certificate validation; hosted Pages inspection was blocked by egress policy.
- Proposed incremental Three.js work toward a short hallway/mirror slice. No gameplay rewrite, GitHub push, production deployment or Cloudflare change.

## 2026-10-22 — Foundation increment

- Began development on `develop/first-mirror-slice`; no remote push.
- Separated player movement, collision and house construction from the page. Added acceleration, collision substeps, wall sliding, pointer-lock pause and input cleanup.
- Bundled the pinned Three.js distribution and its license locally, removing the runtime CDN/certificate dependency.
- Added title/pause interface and comfort controls. Geometry and progression are still scaffolding in this increment.
- Validation: four physics tests passed; local Chromium created the scene, captured the mouse and returned to pause without page exceptions.

## 2026-10-22 — The house and the first encounter

- Replaced the visual scaffold with original procedural olive wallpaper, wood panelling, floorboards, an oxblood runner, framed landscape, domestic props, practical lamps and a working clock. Deliberate low-resolution rendering keeps the HUD readable.
- Built a continuous hallway circuit with blind corners. Seeing the normal mirror is required before the first authored inversion; the painting turns upside down and the clock reverses.
- Added a real planar room reflection and a reflection-only low-poly player proxy. The occupant first follows, then delays, then remains at the glass when the player turns away.
- Connected a collectible note, two-item pocket inventory, opening drawer, encounter-gated key, animated front door and a definite ending/replay. Added mouse, sound, voice and walking-motion controls.
- Added restrained Web Audio ambience/effects and seven locally generated synthetic provisional dialogue takes, with subtitles, provenance and a regeneration tool. Written direction and performance script: GAME_DIRECTION.md.
- Validation: nine physics/progression tests passed; a deterministic Chromium playthrough used actual movement/collision around both corners and checked the encounter, early drawer recovery, inventory, paused input/audio, wall occlusion, unlocked exit, ending/reset and all seven decoded non-silent voice clips. Fixed overly strict door interaction range during this run. No production or Cloudflare changes; no remote push.

## 2026-10-22 — Playability and review pass

- Refined the held figure's head to follow the reflected viewer independently while its body stays in place; added explicit delay/gaze checks.
- Added textured foot scuffs and drawer friction, with softer carpet footfalls. Gave the ending enough space for the last dialogue lines and an actual closing door.
- Fixed menu keyboard navigation so Tab remains available outside play/inventory; Escape now explicitly releases pointer lock.
- Formatted source modules for further iteration and updated README/status with actual running instructions and outstanding limitations.
- The second deterministic playthrough passed its expanded checks; a separate normal-mode browser check passed movement, Escape, settings, inventory pause and resize with no page exceptions. Firefox remains untested because its download was denied by egress policy. Human headphone/performance review remains necessary.
- Final rerun after the sound/ending polish passed all nine unit tests and the expanded Chromium playthrough with no errors. Packaged the exact verified static runtime into a local review ZIP; validated archive integrity, required assets and byte-for-byte source equality. No distribution/upload performed.

## 2026-10-22 — Owner-approved publication

- Owner explicitly approved deploying the tested first encounter to the existing Cloudflare site, including the potentially deployment-triggering push.
- Fetched main, verified a fast-forward, and pushed the tested source at `c1d60bd`; a native read-only Git check confirmed that exact commit on remote main.
- The handoff identifies main as the connected Pages production branch. Repository configuration contains no independently verifiable Pages connection settings.
- GitHub deployment/check APIs and the live mirror-me.pages.dev site are denied by the environment egress proxy. Cloudflare build completion and live behavior are therefore unverified; a successful Git push is not a verified deployment. No Cloudflare resources or settings were changed.

## 2026-10-22 — Direct Cloudflare connection preparation

- Corrected the deployment assumption: the GitHub push published source only. No Cloudflare deployment was verified or performed. The owner clarified that Pages setup must be checked/created and authorized creating or reusing `mirror-me` and deploying this slice.
- Checked actual credential names, Wrangler auth/config locations and available connectors: no Cloudflare credential/login/integration was available. Wrangler whoami confirmed unauthenticated status; API access was denied by egress policy.
- Installed official Wrangler 4.152.0 outside the checkout and verified its version/deployment/project-create commands against Cloudflare documentation.
- Saved an environment draft with pinned installation/startup instructions, the secure CLOUDFLARE_API_TOKEN requirement, CLOUDFLARE_ACCOUNT_ID variable, and Cloudflare API/Pages host access. Saving does not supply values, apply runtime access or create a Pages project.
- Added immutable static staging with revision/asset hashes and an explicit deployment command that creates only after an authenticated 404, reuses the actual production branch and verifies public content. Its missing-credential guard was exercised; authenticated creation/upload/live validation remain blocked until secure account settings are supplied. Added step-by-step setup and a reusable environment prompt in CLOUDFLARE_SETUP.md.
- Exercised staging twice for repeatability and booted the staged upload directory in Chromium: HTTP 200, rendered canvas, mouse capture and the expected build-id with 24 hashed runtime assets. Configured Wrangler to run from its external tooling directory so deployment caches cannot dirty the game checkout. Authenticated upload remains unrun until credentials are supplied.

## 2026-10-22 — Cloudflare connection verified and first live release

- Secure account bindings became available. Authenticated inspection found the existing mirror-me Pages project, its correct Skewernet GitHub repository, main production branch and enabled Git deployment settings. No project was created or renamed; other projects were untouched.
- Confirmed the only existing deployment was the old afd4f77 prototype; newer Git pushes had not created deployments. Uploaded the approved 11c84c7 slice with official Wrangler. Cloudflare confirmed a successful production deployment, and all 24 public runtime assets matched the manifest.
- Diagnosed Cloudflare error 1010 on the public verifier's default Python user-agent. A descriptive build-verifier user-agent works without disabling TLS or altering site security settings.
- Configured this project's build command to stage a clean dist artifact with build-id/asset hashes. Added portable fixed-directory staging, explicit Git-source builds and read-only live comparison. A Git-source build will now be exercised; source configuration alone does not prove webhook delivery.

- Git-source pipeline verification succeeded for 1b52651: Cloudflare fetched the correct main commit, built the dist artifact, completed the production deployment and served all 24 exact runtime assets. The source checkout and remote main matched. Automatic push webhook delivery was not established, so the explicit Git-build release command remains the verified publishing path.

## 2026-10-22 — House expansion and material overhaul

- Started `develop/house-expansion` from verified production e90d894. Kept all new work local because this expansion has not been approved for production.
- Expanded the actual collision/door floor plan with an enterable sitting room, kitchen, bathroom, bedroom and utility room. Added original detailed material/photo atlases, curved furniture/ceramics, cloth geometry, scene shadows, rain windows and optional flashlight/quality controls.
- Replaced the quick key-to-exit sequence with five authored passes: restore power; confront the reflection and reach the bedroom; reverse the bathroom clue into a clock setting; silence three sounds in reverse; disobey the final instruction and witness replacement from behind the glass.
- Rebuilt the reflected figure with smoother anatomy and hands, added a visible replacement ending, expanded journal/inventory and clock interaction, and rendered fifteen synthetic dialogue takes. Sound sources now occupy actual room positions.
- Validation at this checkpoint: 15 movement/progression tests passed; full deterministic browser playthrough navigated every room/door and all five stages, including wrong-order recovery, pause, reset, flashlight and fifteen decoded voice files. Known-solution traversal measured about 230 seconds of game time; no first-time human length claim. Fixed an invisible collision proxy obscuring drawer interactions. Reviewed room/mirror screenshots. Further visual/scare and ordinary-mode checks remain.

## 2026-10-22 — Expansion readability, scares and control polish

- Improved pre-power kitchen moonlight, tiled the bathroom's remaining shared wall, reduced lamp glare and corrected quilt/mattress intersections. Added a subtle breathing form, inverted kitchen chair, backward second hand and empty-family television image.
- Added the return-passage watcher and two unclaimed footfalls. Visibility checks include real house occlusion; a glance through a wall cannot consume the event. Browser checks verified the watcher becomes visible around the corner and disappears after observation/turning away.
- Preserved the solved sound sequence through the final pass and replacement ending; the faucet stream and music-box lid follow the same persistent state. Refined the reflected head's proportions.
- Fixed settings clipping on shorter desktop windows. Paused/title views render only when needed rather than continuously consuming GPU time; normal play retains continuous rendering.
- Fifteen unit tests passed. Separate ordinary-mode Chromium smoke passed live rendering, movement/pointer lock, flashlight, journal pause/resume, Escape, picture resolution/resize, brightness/grain controls and hints, with no errors or failed requests. A too-early automated Escape after pointer capture was corrected by waiting for the actual playing interface.
- Rewrote current status, README and complete creative/puzzle/voice script around the five-pass implementation. Updated voice provenance to fifteen synthetic takes and the release manifest version to house-expansion-0.3.
- Read-only checks confirmed GitHub main and the live Pages manifest still identify e90d894. No push, production upload or Cloudflare setting change was made.
- Final complete browser rerun passed all five stages with the watcher sightline/disappearance regression and persistent final-pass silence checks, fifteen decoded voices, ending and reset. No console/page errors or failed asset requests. Known-solution traversal: 232.3 seconds.
- Staged the clean committed expansion outside the checkout. All 39 runtime files matched both source bytes and their SHA256 manifest; Git metadata, development tools and tests are excluded. This is a local release candidate, not a published build.

## 2026-10-22 — Owner-approved house expansion release

- Owner approved pushing and publishing the completed expansion. Fetched remote main, verified a fast-forward from e90d894 to d5b3575, and pushed the three reviewed development commits to main.
- Rechecked the correct mirror-me Pages/GitHub connection and enabled deployment settings before pushing. No Cloudflare resource or build-setting changes were needed.
- The explicit Git-source build 4deb402c-9a6b-426e-b9d7-5ab915515ca4 succeeded for d5b3575; the public build-id and all 39 runtime hashes matched. All fifteen unit tests passed as release prerequisites.
- Updated the README/status release record. These documentation changes do not alter the tested game runtime; the release helper verifies the final source revision and public asset hashes after synchronization.

## 2026-10-22 — Mara, the mirror approach and a coherent evening

- Started develop/character-and-story-polish from verified live/main 6d20a88. The owner authorized development; this new pass remains local and has not been pushed or deployed.
- Split the overloaded telephone/radio into independent props and state. The sitting-room rotary telephone carries the two calls, rings from its own position and lifts its receiver. The kitchen radio has speaker cloth, tuning scale, knobs, aerial, independent power/volume state, local static and an original sparse weather bulletin. Checking the dead phone never advances or resets the climax sequence.
- Rewrote the story around Mara Vale returning for her mother's belongings. Added an optional personal-effects envelope, a more personal diary, room-specific puzzle language, contradictory calls and a final offer that exploits Mara's nightly care routine. Updated all existing synthetic takes and added the letter/broadcast, for seventeen total; retained explicit synthetic provenance and a complete performance script.
- Moved the entry/exit to the south return wing and the mirror to the north wall. Entering left into the main corridor now creates an L approach aligned with the mirror; the connected return passage still closes one actual house circuit. Relocated the clock to the adjoining wall, generalized optical/head tracking to the new plane and delayed the ending's walk until the camera has turned.
- Replaced the generic figure with a consistent female Mara model: sculpted face, shoulder-length hair, layered blouse/cardigan, pendant and continuous shaped sleeves/trousers. Fixed hair masking the eyes, embedded mouth and cloth intersections during close review. The reflection gradually pales and gains restrained blood-like face staining while retaining her identity.
- Added an original depth/contact-shading and edge-smoothing picture pass, film response, picture control and capability fallbacks. Verified native WebGL2 HDR/AO, WebGL1 8-bit/AO and a simulated missing-depth/derivatives fallback with no graphics errors. Restricted mirror rendering to the hall/north landing so hidden reflection work is avoided.
- Made the kitchen door pale, labelled and lit by an always-on practical. Actual-game screenshots verify it is readable before power with the flashlight off. Added room-specific domestic dressing, a one-time falling botanical frame and sliding/falling kitchen cup with spatial creak/scrape/impact cues. Local negative wallpaper/panelling/runner, blue underlight and inverted vase reinforce INVERTED without full-screen flashing. Refined the frame landing and kept collision routes clear.
- Added quiet window rain and sparse structural creaks while preserving the silence earned by the reversed sound puzzle. Narrative voices, radio broadcast and ringing occupy distinct sound routes; voice mute also mutes the broadcast. All pause/resume behavior remains gesture-started and local.
- Validation: sixteen physics/progression tests passed. Complete collision-respecting Chromium route passed all five stages, distinct phone/radio behavior including a phone check mid-puzzle, letter collection, shifted mirror/clock/exit, watcher sightlines, prop falls/inversion/reset, final silence, ending/reset and seventeen decoded non-silent takes; no page/console errors or failed requests. Known-solution validation route: 275.9 seconds, not a human first-play duration.
- Separate ordinary-mode smoke passed rendering, walking/pointer lock, flashlight, journal pause/resume, Escape, quality/resize, brightness/grain/contact-shadow controls and hints. Targeted actual-game checks verified no blocked passage after falls and spatial event execution; close model and room images reviewed. Human headphone mix review and real-GPU performance remain outstanding.
- Final staged-artifact smoke also passed against the immutable upload folder, including contact-shadow controls. All 43 runtime files matched source bytes and SHA256 manifest; no Git metadata, tools or tests are published in that folder. Remote main and the live public manifest remain unchanged at 6d20a88.


## 2026-10-22 — Owner-approved Mara 0.4 publication
- Owner explicitly approved publishing the completed 0.4 build. Fetched main, verified the fast-forward, and pushed approved gameplay/source revision d55c2cf to GitHub main.
- Reconfirmed the existing mirror-me Pages project, correct GitHub source, main production branch and enabled production/preview automation before pushing. No Cloudflare resource or build-setting changes were needed.
- Explicit Git-source deployment bc5a9ed1-4b58-431c-8b0d-c204fa79ae65 completed successfully for d55c2cf. The live mara-story-0.4 build-id and all 43 runtime SHA256 hashes matched. All sixteen release prerequisite tests passed.
- Updated README/status to record publication. This release-record commit changes no tested runtime asset; the final source revision and live hashes are verified again after synchronization.


## October 23, 2026 — realism development: distinct Kokoro cast

- Started local `develop/realism-threshold-loop` from the verified 0.4 production revision. The owner requested a realistic female protagonist, a tighter complete L-shaped house, rear-door spatial return, redone voices and authored sudden scares. No push or deployment accompanies development.
- Replaced all seventeen local takes with Kokoro-82M v1.0 through sherpa-onnx CPU: distinct British Mara, Mum and radio presets, with the glass retaining Mara’s natural pitch. Updated reproducible synthesis, exact text/casting manifest, source/model checksums and Apache 2 license.
- Verified all seventeen encoded hashes and subtitle inputs; every clip decodes and measured true peaks range from -6.6 to -3.7 dBFS. Total encoded voice payload is 493,933 bytes. Integrated headphone balance remains part of the pending scene review.


## October 23, 2026 — realistic house and rear-door spatial loop

- Replaced the around-partition circuit with one complete, claustrophobic L-shaped house: 1.28 m corridors, 2.32 m ceiling, five compact decorated rooms and a small rear vestibule. The kitchen entrance has an always-visible light and plaque. Opening and physically crossing the rear door closes the view briefly and returns Mara to the front entrance with coherent facing; premature exits retain discoveries and repeat the current pass.
- Replaced the primitive mannequin with a locally bundled MakeHuman/MPFB female character: 1.74 m tall, 1.623 m eye height, 53 bones, 87,648 triangles, detailed skin/eyes/hair and fitted blouse/jeans/shoes. The mirror, apparition and replacement share identity and geometry while retaining independent skeletons and material state. Authoritative CC0 source/header checks, source hashes, full license and reproducible Blender build are recorded.
- Added independent PBR normal/roughness data, explicitly licensed Eric Chadwick/Wayfair wood and Poly Haven fabric/HDR, plus original generated aged floral wallpaper, plaster and painted joinery. Removed an earlier uncertain-license wood candidate before inclusion. Balanced practical lights, realistic mirror sizing, smooth lag, correct held gaze, native-size 1080p default and 2x/4x MSAA replace the old retro choices; 720p remains a performance setting.
- Added two optional, once-per-run authored sudden encounters. The mirror snaps its head on the sustained look back; damaged Mara appears at a safe hallway sightline after the call finishes. Looking at the floor cannot consume that encounter, and walking during dialogue keeps it available in the next pass until the sound puzzle is finished. No strobe, forced camera shake or random repeated attack is used.
- Preserved distinct telephone/radio roles and the five-pass care-routine script. Fixed closed music-box figurine clipping and off-state prompts/responses, final silence, oriented door threshold guards and a subtitle-only/no-AudioContext drip fallback. The final rear exit traps Mara behind glass while her replacement walks into Mum’s room.
- Added an eleven-entry asset register with creator, source, license, local files and changes. Full title/pause and ending credits read it directly. The copy-ready game description and attribution document include every external credit. Persistent coverage validation checks all 49 media/model assets and seven vendor modules and detects stale/missing publication credits.
- Validation: 21 physics/progression tests pass. Complete collision-respecting Chromium playthrough passes all five rooms/passes, early-return/pause behavior, both sudden encounters, actual second-call playback, clock UI, independent phone/radio, quieting/recovery, ending credits and full reset. All seventeen voice files decode, contain speech and match the script. Ordinary-mode browser smoke passes without the harness, including pointer lock, walking, flashlight, pause/journal, credits, quality/resize and sound/comfort controls. Passing runs have zero page/console/network errors.
- Final known-solution simulation is 220.9 game seconds, excluding the real voice-drain wait used by the test. This does not establish first-time duration or scare quality. Target-GPU performance, Firefox and subjective headphone/acting quality still need human testing. No push or deployment was performed.


## October 23, 2026 — review and release preparation

- Independent review found three player-facing edge cases and verified the corrections: looking far above/below a hallway appearance no longer consumes it unseen; rechecking the final tap/music box reports the established silence; bathroom drip events are safe when Web Audio cannot initialize.
- Updated the complete direction/script, README and current status for the single L, rear-door return, real character, Kokoro cast, scare comfort control and full end/public asset credits. Kept the original audit as historical context.
- Added credit coverage as a mandatory guard in static staging and local packaging, and included the copy-ready game description in both payloads. Local voice and game implementation commits remain on `develop/realism-threshold-loop`; no GitHub push, production deployment or Cloudflare resource change accompanies this revision.


## October 23, 2026 — owner-approved 0.5 production release

- The owner approved publication of the reviewed 0.5 build `6473461`. Rechecked the correct Cloudflare project, GitHub repository, production branch, build command and automatic-deployment settings before pushing. Fast-forwarded `main` without changing the tested game.
- GitHub push automatically created successful production deployment `282d572e-4daa-49ad-bec3-046c7d68f98b`. This confirms webhook operation for this release; no extra deployment, project creation or Cloudflare setting change was needed.
- Verified the public 0.5 manifest and all 96 payload SHA256 hashes against the immutable tested build. Retained the gameplay-release receipt outside the checkout at `/workspace/artifacts/mirror-me-6473461-production-receipt.json`.
- Normal-TLS live Chromium smoke passed exact revision, local character/material/HDR loading, complete free-asset credits, pointer lock, walking, flashlight and pause. Arrival, second-call and radio audio decoded with non-silent data from production. No external runtime requests, page/console errors, failed requests or HTTP errors occurred. Existing approved certificate trust was reused; no certificate import or TLS bypass was performed.
- Updated the release documentation only. Its follow-up manifest revision carries the same 96 game/credit payload hashes as approved `6473461`. Future gameplay changes still require their own production approval.


## October 23, 2026 — 0.6 ordered crescendo and new script

- Started local `develop/crescendo-mirror-world` from the verified 0.5 release. The owner requested a better walk, monstrous reflection/crawling sightings, stronger blood/light/sound staging, puzzle-gated loops, an inverted mirror crossing and a more somber ending. The owner then clarified that rear returns must be instant portals, preserving motion without a fade.
- Replaced early/incomplete loops with seven ordered chapters. Each of the first five puzzles releases the rear latch exactly once; unfinished chapters cannot open or consume the exit. Added 93.7 FM tuning after the reflected clock, three keepsake offerings in diary order, and the existing sound routine undone in reverse. The spent rear door and reflection disappear; only a physical mirror crossing reaches the inverted house. Bedside farewell, lamp and front exit remain ordered.
- Reworked the original script around repeated care, returned personal effects and a place reserved for Mara. Retained the Kokoro cast and opening performances; added six takes and revised four, with 23 local voiced lines total. The final voice belongs to Mum in the wake, rather than the old replacement walking away. Script/subtitles/casting/production hashes are synchronized.
- Validation: 25 physics/progression/instant-transform unit tests pass. Complete seven-chapter Chromium route passes actual walking, five instant rear returns, mirror world, all ordered puzzles, ceiling/floor sightings, playable wake controls, credits/reset and 23 decoded script-matching voices, with no page/console/network errors. Known-solution simulation is 317.895 game seconds, excluding real voice waits; 10–15 minutes remains a first-play target requiring human playtesting.
- A platform model-capacity interruption paused the root session; shared source and completed agent work remained saved. Resumed by auditing the saved files and tests. No 0.6 push or deployment has been authorized or performed.

## October 23, 2026 — 0.6 motion, encounters and visual review

- Replaced the mirrored walk with distance-driven foot placement, heel strike, toe roll, stride and body counter-rotation. Delayed reflection samples now carry distance and velocity; holding a reflection preserves its captured pose, and portal returns reset gait anchors without stopping the player.
- Added an original anatomical horror progression to the existing MakeHuman identity: recessed eyes, an articulated open jaw and dark mouth interior, elongated hands and twisted body poses. The last visible reflection faces away while its neck turns back toward the player. This orientation was selected from actual-house mirror captures after review found that the original pose hid the face behind hair.
- Added six finite, optional crawling/ceiling encounters with visibility checks, room-to-hall movement and spatial scrape/retreat cues. Original staged blood marks, falling décor and local irregular light dips follow the ordered chapters. Sudden scares and light flicker have independent settings. The earned silence remains quiet.
- The open rear door renders the front hall through a clipped portal camera. Crossing applies the same rigid half turn immediately, preserving held input, lateral offset, overshoot, view pitch and momentum. No fade, reset timer or physical return passage is involved. An isolated forced 8-bit render-target fallback passed with no WebGL errors.
- Preserved the furnished L-shaped house. The rear door becomes continuous wallpaper when the reflection disappears; walking through the empty mirror reaches a cold, drained version of the same interior. Saying goodbye at the bed and switching off the lamp release the front exit.
- Replaced the old replacement ending with a playable, ordinary-daylight wake and a chair reserved for Mara. Three seated versions of her wear original mourning cloth; their heads turn before Mum speaks. Walking, looking, flashlight and pause remain available during the ending. Removed the unused old ending clone and animation.
- Fresh ordinary-mode Chromium smoke passes mouse capture, walking, flashlight, journal/pause, credits, all resolution options, resize and comfort/picture controls, with no page, console or network errors. The deterministic route separately verifies the full ordered progression, instant movement transforms, inverted crossing, wake, ending and reset. Software-rendered checks do not establish real-GPU performance or first-time scare quality.
- Asset coverage passes for 11 register entries, 56 media/model files and 7 vendor modules, with the in-game and public-description credits synchronized. The mouth mask is an unmodified pinned CC0 MPFB texture; the wake reuses the existing credited character and adds no external assets. All 23 voice production hashes match; their combined payload is 699,560 bytes, with measured true peaks no higher than -3.6 dBFS.
