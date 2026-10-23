# MIRROR ME — current status

Updated October 23, 2026 (America/Denver).

**Production:** the owner-approved 0.5 realism / threshold-loop game is live at https://mirror-me.pages.dev. GitHub `main` and local `main` contain the approved changes. Gameplay revision `6473461` deployed automatically from GitHub; all 96 public runtime hashes matched the tested build. `/build-id.json` identifies the exact current release, including release-record-only commits.

## Implemented in 0.5

- One complete L-shaped house, 1.28 m hall width and 2.32 m ceiling, with five fully furnished rooms. The kitchen doorway remains lit and labelled before power restoration.
- The physical back door leads to a brief concealed transition and returns Mara to the front entrance with coherent facing and no residual movement. Incomplete exits retain discoveries. Completing a pass advances the next return; walking around the house never advances it.
- A real rigged 1.74 m female character: continuous anatomy, 2K skin/clothing/hair, detailed eyes and 53-bone game rig. The same identity appears in the faithful/delayed/held mirror, sudden hallway encounter and replacement ending.
- Realistic surface response: licensed photographic wood and fabric; independent normal/roughness maps for original wallpaper, plaster, panelling, tile, linen, concrete and rust; subdued interior HDR specular light; soft practical shadows and optional contact shading. Native-size output capped at 1080p by default, 720p performance or 1440p detail. Grain and head motion off initially.
- All seventeen voice takes regenerated offline with Kokoro-82M v1.0. Mara/glass, Mum and radio have distinct, documented roles; no actor or real-person voice clone is claimed. 24 kHz mono Oggs total 493,933 bytes, with measured true peaks below -3 dBFS.
- Two finite, optional sudden encounters: the held mirror's head movement and a brief damaged-Mara sighting after the second call finishes. They do not gate progression. Environmental frame/cup movements have local sound and full reset.
- The existing five-pass care-routine story, separate telephone/radio identities, reversed sound puzzle, journal, clock form, final refusal and complete replay remain in scope. The final exit reveals the replacement walking into Mum's bedroom.
- A creator/source/license/modification register powers title/pause and ending credits. Full source/license texts and a copy-ready game description include every free external asset, including required CC BY wood attribution.

## Validation

- Twenty-one movement/progression unit tests pass, including closed/early rear exits, one-L layout, explicit threshold progression, phone/radio independence, out-of-order recovery, final refusal and restart.
- Architectural and furnishing checks passed all five door/room approaches and the final path using actual player acceleration/collision. Target rays are unobstructed from the intended approaches. Décor one-shot events and reset passed isolated checks.
- All seventeen voice files decode, match current subtitle inputs and match their production hashes; decoded headroom measured for every take.
- Full integrated Chromium route passes all five physically visited rooms and five stages, incomplete rear returns, portal pause/resume, both authored scares, actual second-call playback, clock UI, phone/radio separation, final silence, ending credits and restart. The hall appearance waits until dialogue/subtitles have cleared and then disappears on time. No JavaScript, console or network errors.
- Ordinary-mode browser smoke passes the real render loop without a test harness: pointer lock, walking, flashlight, journal/pause, credits, resolution/resize and picture/sound/comfort controls. A first active-render assertion timed out under concurrent SwiftShader load; the solo run with paused inspection passed.
- Final visual review corrected overlit skin, eye alpha, hair highlights, mirror fill and overly simple wallpaper. Independent read-only review found and verified fixes for off-screen scare consumption, quiet-state interaction messages and the no-AudioContext bathroom fallback.
- The final known-solution simulation takes 220.9 game seconds, excluding real voice waiting. It is not a first-time play-duration measurement.
- Production HTTPS smoke passed with normal certificate validation: model/material/HDR loads, full credits, controls/play/pause and non-silent voice decoding, without a test harness, external runtime requests or browser/network errors.

## Remaining before jam submission

The local runtime is complete and the automated route passes. Release preparation includes an immutable, revision-identified payload with asset hashes, checked source/license coverage and staged browser startup. The owner subsequently approved publication of this 0.5 build; future game changes need their own release approval.

Human playtesting must judge first-time clarity, scare effectiveness, perceived duration, voice acting and headphone balance. The target is 8–12 minutes of discovery, not enforced idle time; automated known-solution timing does not establish that. Test Chrome/Firefox and real desktop GPUs before jam submission; cloud software rendering is not performance evidence. Facial animation remains procedural rather than performance captured. The realistic model and material pass is not a claim of scan-based or film-quality graphics. There is no save system, combat, chase AI, second floor or branching ending.

October 25 remains the deadline. Freeze scope around this complete five-room/five-pass route and prioritize fixes and playtesting. Exact jam submission time has not been independently confirmed.

## Publication

The Pages project is Git-connected to `main`, with production and branch-preview deployment enabled. Pushing any branch may publish. The owner approved the specific 0.5 build before promotion. Automatic deployment `282d572e-4daa-49ad-bec3-046c7d68f98b` succeeded for gameplay revision `6473461`, and all 96 public payload hashes matched. The GitHub push webhook is now proven for this release. Release-record documentation may advance the manifest revision without changing game assets. Future game changes require their own approval; do not change other Cloudflare projects.
