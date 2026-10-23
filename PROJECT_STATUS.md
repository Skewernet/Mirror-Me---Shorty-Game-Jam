# MIRROR ME — Current status

**Version:** House expansion 0.3, October 22, 2026 (America/Denver).
**Development:** Local branch `develop/house-expansion`. Not pushed or deployed. GitHub main and approved production remain at `e90d894`; `/build-id.json` identifies the live version.

## Implemented

- Five actual rooms with operable doors and furniture collision, connected to a blind-corner hallway circuit. The bedroom key unlocks the bedroom, not an early exit.
- Detailed original material/photo atlases, smooth furniture and anatomical figure geometry, cloth, rain-lit windows, restrained bump/roughness, warm practical lamps, a static hero shadow and flashlight shadows. Balanced 720p, detailed 900p and retro 480p choices; brightness and grain controls.
- Accelerated walking, wall sliding, collision substeps, normalized diagonals, clean input release and optional head motion. Visible geometry occludes interaction prompts.
- Real planar room reflection and reflection-only occupant: faithful, delayed, held, absent, then commanding. A visible replacement sequence leaves the player behind glass.
- Five gated passes: telephone/fuse/power/normal mirror; delayed mirror/bedroom diary; bathroom time/hall clock/second telephone call; reversed three-room sound sequence; disobedience/exit/replacement. Exploration tasks, not added wait timers, provide length.
- Environmental changes: family disappears from photograph, quilt breathes, furniture inverts, lighting shifts, clock reverses, a passage watcher appears and vanishes. Watcher observation respects physical sightlines.
- Inventory/journal records items and puzzle clues. Real clock form validates its time. Optional H hints and recoverable wrong puzzle order prevent permanent failure.
- Positional room audio, low electrical/air bed, material footsteps, water, telephone, lullaby, sparse knocks and effects. Fifteen original synthetic provisional voiced lines with subtitles, gesture-started playback, pause/resume and voice/volume controls.
- Title, pause, picture/comfort/audio settings, complete ending and reset. No external runtime service.

## Verification

- Fifteen unit tests pass for collision and the expanded progression, including early actions, all gates, incorrect sound order, clock validation, final disobedience and reset.
- A full deterministic Chromium playthrough traverses all five rooms with actual collision-respecting movement, uses the clock UI, checks watcher occlusion/disappearance and persistent final-pass silence, completes all five passes, and verifies inventory, pause/audio, flashlight, ending/reset and fifteen non-silent decoded voice clips. No page errors or failed requests in the passing run.
- The known-solution route takes approximately 230 seconds of simulation. This does not measure first-time play length or establish that the experience is frightening.
- Room, mirror and ending screenshots reviewed. A separate normal-mode Chromium check passed live rendering, walking/pointer lock, flashlight, journal pause/resume, Escape, picture settings, brightness/grain controls, hints and resize without errors. The test harness is absent in this mode.
- Static release staging includes a source revision and SHA256 manifest. Production publication remains withheld pending specific owner approval.

## Remaining before the October 25 deadline

Human desktop/headphone playtesting is the priority: route readability, puzzle comprehension, scare timing, voice mix, brightness and frame rate on a real GPU. Target 8–12 minutes for a first-time player; measure before claiming it. Tune existing content from feedback before adding more rooms or systems. Human voice acting and a more expressive reflected face are desirable polish if time allows.

Firefox is unverified; its browser download was blocked by environment egress policy. No mobile controls, persistent save, combat, enemy AI, alternate ending or large asset pipeline is planned. The character and furniture remain original procedural models, not scanned or photorealistic assets.

## Release connection

Cloudflare Pages `mirror-me` exists and is connected to the correct GitHub repository and `main`. Production automation and all-branch previews are enabled. Explicit Git-source builds have succeeded and their source commit/public runtime hashes were verified. Push webhook delivery remains unproven despite enabled settings; use the explicit release command after approval and verify the public manifest. Never equate Git push success with a live build. See [CLOUDFLARE_SETUP.md](CLOUDFLARE_SETUP.md).

Do not modify Morlins Quest or Skewer Signals. Keep credentials out of Git and record asset provenance.
