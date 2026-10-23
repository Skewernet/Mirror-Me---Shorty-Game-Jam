# MIRROR ME — current status

Updated October 23, 2026 (UTC).

**Local development:** 0.6, Crescendo / Through the Glass, is implemented and tested on `develop/crescendo-mirror-world`. It has not been pushed or deployed. The integrated route is complete; duration, subjective quality and target-device performance still need human playtesting.

**Last verified production release:** owner-approved 0.5 at https://mirror-me.pages.dev, revision `db45d9b`. Its gameplay revision `6473461` deployed automatically from GitHub, and release verification recorded 96 matching public runtime files. `/build-id.json` identifies the deployed release. No 0.6 changes have been published.

## Implemented locally in 0.6

- One complete L-shaped house, 1.28 m hall width and 2.32 m ceiling, with five fully furnished rooms. The kitchen doorway remains lit and labelled before power restoration.
- Seven puzzle-gated chapters. The first five require, in order: the arrival call/power/faithful reflection; the held reflection/key/diary; the reflected clock/radio tuning/second call; the three keepsakes in care order; and music box → tap → radio in reverse order. The rear door remains physically locked until that chapter is complete, then unlocks automatically. Wrong puzzle attempts remain recoverable.
- Five instant rear-door portals return Mara to the front entrance. The threshold transform preserves held inputs, velocity, facing relative to the new doorway, lateral offset and crossing overshoot, with no fade, forced stop or physical return passage. Walking the L alone never advances a chapter.
- A rigged 1.74 m female Mara with 2K skin/clothing/hair, detailed eyes and a 53-bone rig. Distance-driven walking uses measured bind-pose limb solving, world-space foot plants, heel/toe movement and weight shifts, including backward/sideways travel. Delayed and held mirror poses retain their movement history.
- The reflection escalates from faithful to delayed/held, then hollow eyes, a changed jaw, elongated hands and distorted body poses before vanishing. Six optional authored sightings use floor crawling, ceiling crawling and folded poses, withdrawing through real room approaches; these are scripted encounters rather than chase AI. Directional cues, blood-like wall markings, falling décor and local light dips accompany the progression. Sudden scares and irregular light flicker can be disabled separately without blocking puzzles.
- The vanished reflection is paired with an actual solid wall where the rear door stood. Walking into the empty mirror begins chapter seven in the inverted house. The player must say farewell at Mum's bed, switch off her lamp, then leave through the front door. That threshold leads to a 20-second playable wake with free look, walking, seated veiled clones of Mara's real rig, a final voice line and ending credits. Pause and full replay work through the ending.
- The existing photographic materials, independent PBR normal/roughness maps, interior HDR specular light, soft practical shadows and optional contact shading remain. Default output is capped at 1080p, with 720p and 1440p options; grain and head motion start off.
- Twenty-three local Kokoro-82M v1.0 voice takes now cover Mara/glass, Mum and the separate radio. The sitting-room telephone carries calls; the kitchen radio has its own tuning interface. Inventory/journal and clock, tuning and keepsake forms pause the game. Performances are synthetic, with voice/model/tool provenance documented.
- The credit register contains 11 entries covering 56 media/model assets and seven vendor modules. It powers title/pause and ending credits; full source/license texts and the public game description include the free assets and required CC BY wood attribution. The wake reuses the credited Mara asset.

## Local 0.6 validation

- All 25 movement, threshold and story unit tests pass. Coverage includes closed doors, chapter gates, one-L layout, portal transforms, radio/phone independence, numeric input validation, keepsake order, reverse sounds, mirror/farewell gates and reset. A corrected radio test distinguishes a valid wrong station from invalid form input; the story gate was not relaxed.
- The full Chromium route passes all seven chapters using actual player acceleration/collision through all five rooms. It exercises early locked-door attempts, exactly-once unlocks, five rear portals without a transition fade, continued held movement and transformed velocity/overshoot, radio and keepsake form mistakes/recovery, the clock clue, separate second-call playback, reverse-sound mistakes/recovery, the solid vanished-door wall, physical mirror crossing and inverted farewell.
- The same route exercises the bathroom ceiling sighting, hallway floor crawler, scares with light flicker disabled, free movement/look/pause in the wake, ending credits and a complete restart. Other sightings are optional; this route is not evidence that every possible encounter appeared during a single playthrough.
- All 23 Ogg voice files decode to non-silent audio and match their current script/subtitle text. Browser runs report no JavaScript, console or failed-request errors.
- A fresh ordinary-mode smoke passes the real render loop without exposing the test harness: pointer lock, walking, flashlight, journal/pause, credits, 720p/1080p/1440p selection and resize, brightness, grain, contact shadows, scare/flicker controls, Escape and hints. Browser GPU checks ran sequentially under SwiftShader.
- Seven isolated mirror render checks report no WebGL errors. A forced unsigned-byte portal target fallback renders successfully. The wake's seated-clone preparation keeps its collider count stable across repeated preparation and leaves the central walking route clear.
- `python3 tools/check_credits.py` passes: 11 entries, 56 media/model assets, seven vendor modules, and synchronized attribution/public-description documents.
- The known-solution route takes **317.895 simulated game seconds**, excluding real voice waits. This is not a first-time duration measurement. Screenshots from the integrated route and normal smoke are in `/workspace/artifacts/crescendo-qa/` in this development environment.

Production HTTPS checks recorded for the earlier 0.5 release remain release evidence for 0.5 only. A fresh read-only scripted request to public `/build-id.json` returned HTTP 403 / Cloudflare code 1010; a normal-TLS Chromium attempt rejected the local certificate issuer. Neither attempt reverified the live release. No 0.6 production or public-URL validation has occurred. No push, deployment or Cloudflare mutation was performed during this local work.

## Remaining before jam submission

The local 0.6 route is complete and its automated checks pass. It still needs the owner's review and specific publication approval before a potentially publishing push or deployment. For an approved release, stage an immutable, revision-identified payload, verify asset hashes and license coverage, then validate the public build separately.

Human playtesting must judge first-time puzzle clarity, scare effectiveness, perceived duration, voice acting and headphone balance. The target is **10–15 minutes on a first play**, without added idle timers; automated known-solution timing does not establish that target. Test Chrome/Firefox and real desktop GPUs before jam submission; cloud software rendering is not performance evidence. Gait, faces and creature poses remain procedural. There is no save system, combat, chase AI, second floor or branching ending.

October 25 remains the deadline. Freeze scope around the five-room/seven-chapter route and prioritize fixes and playtesting. Exact jam submission time has not been independently confirmed.

## Publication

The Pages project is Git-connected to `main`, with production and branch-preview deployment enabled. Pushing any branch may publish. The owner approved the specific 0.5 release now identified by `db45d9b`; automatic deployment `282d572e-4daa-49ad-bec3-046c7d68f98b` succeeded for gameplay revision `6473461`, and all 96 public payload hashes matched. That approval does not authorize publication of local 0.6. Keep this branch local until its changes receive specific approval, then check the deployment result and public hashes. Do not change other Cloudflare projects.
