# MIRROR ME — itch.io jam upload

The game is already a self-contained HTML5/WebGL desktop game. No executable, backend, Cloudflare account or engine installation is required for the itch.io build.

## Build the upload

1. Commit the approved build; run `python3 tools/package_itch.py` from the repository.
2. Upload the resulting `MIRROR-ME-<commit>-itch.zip`. `index.html` is at the ZIP root; `src/`, `vendor/`, `assets/`, full asset credits and licenses are included. Do not ZIP an extra enclosing folder or upload the whole development repository.
3. Keep the ZIP's build-id.json and printed SHA256 with the submission record.

## Set up the page

1. Create an itch.io project named **MIRROR ME**, publisher **Skewer Games**. Select **HTML** / browser-playable game, upload the ZIP, and mark it as playable in the browser.
2. Use click-to-play, a resizable embed around **1280 × 800**, and fullscreen support. Target desktop mouse/keyboard; do not advertise mobile or controller support.
3. Add a cover (630 × 500 is a useful target), screenshots, a short spoiler-free description and controls. The main public copy/credit sources are GAME_DESCRIPTION.md and ATTRIBUTIONS.md. Set the price/free status to match the jam rules.
4. Put this warning visibly on the page: **Flashing lights, graphic blood/gore, violence and family violence.** Describe synthetic voice/generated artwork and AI-assisted development accurately wherever the jam or platform asks.
5. Save as draft/restricted for testing. Test the actual itch.io iframe in Opera GX and another desktop browser: click-to-start audio, pointer capture, Escape, fullscreen, settings, journal, flashlight, all puzzles, finale, automatic credits return and a fresh replay. Test a cold load too. Local/Cloudflare testing does not replace this iframe check.
6. Make the page publicly playable when ready. Join [Shorty Jam](https://itch.io/jam/shorty-jam), choose **Submit your project**, select MIRROR ME and complete the jam's questions before its displayed deadline. Uploading a project alone does not enter it in a jam.

## Jam-specific checks still required

The supplied jam URL and official itch.io documentation were requested on October 25, 2026, but this execution environment returned HTTP tunnel 403 for both itch.io and a public text reader. No current deadline, entry window, AI policy or required submission fields were successfully read. Do not treat those details as verified.

Before submitting, read the jam page for: deadline/timezone; theme and duration limits; allowed development dates and pre-existing assets; generative-AI rules; browser/download requirements; required tags/questions; and whether post-deadline fixes are allowed. This project uses AI-assisted code, generated artwork and Kokoro synthetic speech, so its eligibility depends on that exact policy. If a Windows executable is mandatory, this HTML5 ZIP alone will not meet that requirement.

Official references to check:
- https://itch.io/jam/shorty-jam
- https://itch.io/docs/creators/html5
- https://itch.io/docs/creators/quality-guidelines
- https://itch.io/docs/creators/game-jams

No itch.io project has been created, published or submitted by this packaging step.
