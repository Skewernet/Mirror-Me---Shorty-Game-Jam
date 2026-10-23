# MIRROR ME — audit and first vertical slice

Recorded October 22, 2026 (America/Denver). Baseline: `afd4f77`, matching remote main when inspected. The supplied handoff is design context; the owner's current request controls scope and production approval.

## What currently works

The four original repository files and the complete handoff were inspected. There are no package manifests, automated tests, CI workflows, agent instructions, build configuration or Pages configuration in this checkout. Static serving is sufficient; Three.js 0.160.1 loads from jsDelivr.

A local Chromium/Playwright diagnostic verified canvas creation, pointer lock after ENTER, backward movement through the positive-z boundary into LOOP 02, and the menu returning after pointer lock was released programmatically. No page exceptions occurred in that diagnostic. This does not verify physical Escape handling, Firefox, gameplay completion, frame rate on target hardware or production behavior.

Ordinary Chromium loading failed with ERR_CERT_AUTHORITY_INVALID for the CDN. TLS-verified curl fetched the exact module successfully; the diagnostic routed only that module URL to the downloaded copy, without changing source or disabling verification. Normal browser dependency loading remains an environment limitation. Python's server returned the application successfully.

## Code audit

- Movement normalizes diagonals and caps frame delta, but instantly starts/stops. Bob runs while standing still. Input is not cleared on blur/pause; E interactions require `started` but not pointer lock, so paused interactions can still run.
- Collision only clamps coordinates. Furniture, door and mirror have no colliders. The negative-z end is always blocked; the unlocked door never moves and `doorOpen` is never read.
- Looping uses the opposite, positive-z end, teleports from about +7.65 to -6.6 and preserves facing. There is no concealed transition or objective gate. Three trips through that boundary reach the ending without the key or mirror.
- Mirror glass is a metallic box, with a fixed head/body silhouette in front. It does not reflect the room or track the player. E nudges the head indefinitely. Text describing delay is not a delay mechanic.
- Interactions use distance only, with mirror-first priority; they do not require facing or line of sight. Drawer repeatedly grants the same key with no visual change.
- Geometry is a straight box with repeated trim and frames. Lighting changes are global color/intensity cues. There are no textures, audio, animation systems or authored domestic details.
- CSS pixelation does not create a deliberate low-resolution render target. Rendering is near display resolution, without an adjustable quality budget.
- Pause reuses ENTER; the ending reuses the same handler and does not reset inventory, loop count, text or lighting. No proper restart, settings, credits or complete puzzle exists.
- All logic lives in a compressed inline script, making state dependencies difficult to review.

## Technical approach

Retain Three.js and static hosting. Do not add an engine or build tool for the slice. Extract small JavaScript modules for player/input, house/collision, interactions, progression, mirror and UI while preserving a runnable page at every commit. Initially keep the existing Three.js version; before release, consider serving its licensed distribution locally to remove the CDN runtime dependency and simplify itch.io packaging.

Use simple player-radius collision against authored wall and prop boxes, movement acceleration/deceleration, bounded look sensitivity, movement-only optional bob, and clean input release on pause/blur. No physics engine is needed.

Build one original compact domestic hallway with a corner/vestibule that hides the reset. Match position and facing across paired thresholds, preserve travel overshoot, and gate each transition once so backtracking cannot repeatedly advance the story. Use a small explicit sequence of authored states rather than scattered coordinate conditions.

For the mirror, prototype a planar reflected room view with an original low-poly player proxy visible only to the reflection camera. Correct the camera across the mirror plane and clip geometry behind the glass. Drive the proxy from a short player-pose history: faithful, delayed, then held independently. Keep the mirror small and its render target modest; avoid recursive mirrors. If clipping or performance cannot be made convincing quickly, use a bounded duplicate room behind the glass with a mirrored proxy rather than introducing a complex rendering stack. The first check is visual plausibility from oblique angles and while approaching/leaving, before any scare scripting.

## First playable slice: approximately 3–5 minutes

1. **Foundation increment:** extract modules, fix input/pause/reset, collisions and facing-based interactions. The player can walk comfortably, inspect a drawer and restart cleanly. No new horror content yet.
2. **House increment:** author one readable hallway, mirror alcove and concealed loop threshold. Add restrained original procedural surfaces, warm practical light and recognizable furniture. First traversal repeats familiar architecture with one unmistakable changed detail.
3. **Mirror increment:** establish an obedient reflection; introduce a short delay on the next pass. After the player has clearly seen it, freeze the proxy as they turn away. On looking back, it remains at the glass, watching. Use silence and careful timing; do not hide the effect behind text or a loud sting.
4. **Closure increment:** add one interaction informed by the mirror, one small reversal, and a definite slice ending/restart. Reserve the full inverted-world puzzle for the next milestone.

Acceptance: current desktop Chrome and Firefox load without fatal errors; pointer lock and Escape/resume work; diagonal movement is consistent; walls and furniture block the player; frame stalls do not skip walls; paused inputs do nothing; loops are concealed and advance once; backtracking cannot softlock; the reflection initially tracks plausibly then visibly disobeys; interaction prompts require a reachable visible target; restart restores every state. Test a complete playthrough and an out-of-order interaction run. Performance must be measured on a real desktop browser; cloud software rendering is insufficient evidence.

## Deadline and cuts

Use October 25 as the delivery boundary. The handoff's 8 PM Mountain time is unverified, so do not depend on it for the schedule. October 23: foundations and hallway; October 24: convincing mirror slice, then one mirrored-logic puzzle only if the slice works; October 25: complete ending, audio/UX, browser testing and packaging with submission buffer. These are targets, not claims of completed work.

Prefer a complete 5–8 minute game over padding to the handoff's desired 10–15 minutes. Cap content at 3–5 authored passes. Cut extra rooms, combat, AI, extra endings, inventory systems and elaborate postprocessing first. Protect movement, mirror credibility, readable progression and ending/restart. New assets must be original or have documented licenses.

## Deployment safety

Git read access succeeded; local HEAD matches main. No repository workflow proves deployment behavior. A read-only request to mirror-me.pages.dev was denied by the environment egress proxy (403), so hosted content could not be compared. No Cloudflare management integration is available here. The handoff says main is connected to Pages; treat any main push as potentially production-deploying. Branch previews are also unverified.

No pushes, deployments or Cloudflare changes are authorized by this audit. Before pushing, verify Pages production branch and automatic deployment/preview settings through a supported read-only source. If unavailable, keep commits local and report the uncertainty. Obtain approval of the specific production changes before promoting. The old DEVLOG project-name entry is historical, not authoritative current configuration.
