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
