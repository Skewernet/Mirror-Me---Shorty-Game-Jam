# MIRROR ME — direction and performance script

Working script, October 22, 2026 (America/Denver). Original setting and dialogue. The current build implements the first encounter, not the entire proposed final game.

## The promise

A house is rehearsing how to be you. At first the glass is an ordinary reflection. Then it becomes a delayed recording. Finally, the person in it can stay behind. The horror comes from losing ownership of a familiar movement, not from a monster attack. INVERTED means the copy slowly acquires the original's freedom.

The house is a modest, lived-in domestic interior: faded olive patterned wallpaper; almost black green wood; an oxblood runner with tarnished gold threads; warm, dirty practical lamps; a cold transom with no visible outside world. Objects should suggest someone stopped living here very recently. No abandoned asylum clichés, blood messages or red emergency lights as the main visual language.

Render at a deliberate low internal resolution with nearest-neighbour sampling and simple silhouettes. Keep text crisp outside the game canvas. Limit overlays: a little vignette and scanline texture, no constant camera shake or aggressive VHS distortion. The mirror must be readable enough to establish trust before it breaks it. Darkness is a composition tool, not a substitute for art.

## First encounter — implemented script

Timing follows the player's actions; do not force a walking speed to hit a timestamp. A new player should have time to inspect, backtrack and test the glass. Experienced players can finish this slice much faster than the intended final game.

| Beat / trigger | Picture and action | Sound / performance |
| --- | --- | --- |
| Title | The hallway continues behind a quiet editorial title. No animated monster or jump scare. | Silence until ENTER. |
| Arrival / one second after entering | Warm lamps; front door behind you; an ordinary hallway. | YOU: “I know this house. I just don’t remember the way in.” Tired recognition, almost to yourself. |
| Console note / E | Pick up the folded paper. It enters the pocket. | Paper text: “IF THE HALL RETURNS, WATCH THE GLASS. WAIT FOR IT TO MOVE. THEN LOOK AWAY.” No voiced exposition. |
| First mirror | A low-poly person follows position and orientation immediately in a real reflection of the room. Let the player test it. | Hum and footsteps continue. No warning sound. Inspect thought: “You. Exactly where you should be.” |
| Blind return corner / after seeing the mirror | A continuous circuit returns to the same hall. The landscape is now upside down. The clock runs backward. | One restrained knock to the right. YOU: “That picture. It was the other way up.” |
| Second mirror / sustained attention | A roughly half-second delay. The reflection's room remains optically correct; its occupant is late. | YOU: “Did I move first?” Do not perform this as a scream. |
| Turn away / after sustained observation | The occupant stays behind and moves up to the glass while unseen. No cut, flash or camera takeover. | Electrical ambience recedes. No scare sting. Footsteps remain grounded in the real room. |
| Look back | The occupant holds its position and gaze while the player can still move. Allow a full second to notice. | A tiny metallic sound from the drawer. Hold another 2.4 seconds. THE GLASS: “You can stop now. I remember how to be you.” Familiar tone, too composed. |
| Drawer / open, then take | The formerly empty drawer now contains a key. It enters the pocket; its tag reads FRONT. | Wood slide, small metal contact. YOU: “It’s warm.” Disgust kept beneath the words. |
| Front door / E with key | A real door swings open into a cold, narrow exit. | Lock, hinge undertone. THE GLASS: “You always needed someone to open the door.” Almost helpful. |
| Cross exit | View gradually closes into darkness. Player remains on the wrong side of the ending. | THE GLASS: “Stay there. It’s my turn.” No shouting, no laugh. End on space after the last word. |
| Ending / replay | “Somewhere behind you, a reflection leaves the glass. You are still in the house.” PLAY AGAIN resets the house. | Silence. |

## Performance and audio rules

YOU and THE GLASS should sound like the same person. YOU is uncertain, dry and close, with small pauses. THE GLASS is the same voice without hesitation; it does not announce itself as a villain. A human actor can record both roles in one session. Ask for two restrained takes per line, 48 kHz mono WAV, no baked music/reverb, with two seconds of room tone at either end. Do not impersonate a real performer without permission.

The current seven shipped takes are **synthetic provisional performances**, generated offline from the public-domain LJ Speech dataset model. They are not recordings by an actor. The glass takes have a mild pitch reduction, restricted bandwidth and short echo. These establish timing and playable dialogue; a directed human performance remains the preferred final polish. Subtitles remain available even with voices muted. Source lines and a reproducible render tool are checked in.

Sound is sparse: low mains hum and filtered air, alternating soft footsteps, one wood knock, drawer scrape, metal key contact. Keep peak transients controlled and voices intelligible. Avoid constantly telling the player when to be afraid. The held-reflection beat removes the electrical bed instead of adding a loud event. Audio starts after a user gesture, pauses with play and has a master slider plus a separate voice toggle.

## Remaining short-game arc — planned, not implemented

Do not build these until the first encounter is convincing in desktop playtests.

1. **Familiarity:** the current ordinary/late/held progression, tightened from feedback.
2. **Inverted instruction:** one additional pass. A message in the mirror gives an apparently helpful instruction. A single object changes between the visible room and its mirrored state. Solving it requires reversing a learned action, not collecting several keys. Candidate line: THE GLASS — “Do it just like I showed you.”
3. **Replacement:** the final door opens only after the player stops copying the figure. A short ending reverses who is in the mirror. Candidate final thought: YOU — “Which one of us came home?”

Target a complete 5–8 minutes with 3–5 authored passes. Expand toward 10–15 minutes only if the extra time contains meaningful discovery. Cut extra rooms, enemies and alternate endings before cutting a readable ending, good movement, good sound or the mirror.

## Art review checklist

- The initial hallway reads as a specific home in one screenshot.
- Lamps create warm pools separated by quiet, readable shadow.
- The mirror is colder than its surroundings but not a glowing portal.
- Low-poly human proportions hold up when approached and viewed obliquely.
- The first anomaly can be noticed without an explanatory pop-up.
- Contrast and subtitles survive the low-resolution treatment.
- No asset enters the project without an attribution/license record.
