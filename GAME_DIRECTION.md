# MIRROR ME — direction and performance script

House expansion 0.3, October 22, 2026 (America/Denver). Original setting, dialogue and assets. This document contains the implemented puzzle solutions and ending.

## The promise

A house is rehearsing how to be you. At first the glass is ordinary. Then its occupant becomes a delayed recording. Finally, the copy can leave and you cannot. INVERTED means the reflection acquires the original's freedom.

Take structural inspiration from P.T.: repeat a legible domestic circuit, change something while the player cannot see it, let familiar sounds acquire new meaning, and use uncertain observation rather than combat. Do not reproduce its hallway, characters, recordings or assets.

The house should feel recently occupied: faded floral paper, worn timber, stained tile, oxblood upholstery, yellowed linen, photographs and appliances. Warm practical lamps compete with cold rain windows. Smooth silhouettes, believable proportions and detailed materials carry the image. Low internal resolution is optional; it must not excuse primitive shapes or unreadable darkness. Keep UI crisp, grain quiet and head motion optional. No blood-message clichés, constant red lights or loud scare stings.

## Floor plan and pacing

The main hall runs past the console mirror to the bathroom and north clock. A parallel return passage hides changes behind a central partition. The sitting room and bathroom open off the main hall; kitchen, bedroom and utility room open off the return passage. Doors are real navigable openings. The front door begins behind the player.

Five passes carry distinct discoveries. Progress requires the current task and a physical return through the passage. Incomplete circuits retain progress and give a contextual thought. The small key opens only the bedroom. Avoid time padding: the known-solution route is roughly 3:50; the first-time target of 8–12 minutes must be established through human playtests. The player may pause or consult the journal at any point.

## Implemented beat script

| Pass              | Action and trigger                                                                                                                                                      | Picture and sound                                                                                                                                                                                                                                         |
| ----------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Arrival           | Enter; inspect the sitting-room telephone. Find the spare ceramic fuse on the kitchen counter and install it in the utility fuse board. Observe the normal mirror.      | A specific warm home, dead kitchen power, distant recording. The mirror is optically correct and obedient. Optional folded note: “IF THE HALL RETURNS, WATCH THE GLASS. WHEN IT LEADS, YOU LEAVE.”                                                        |
| First return      | Complete the north-to-south return passage after those tasks.                                                                                                           | The framed picture inverts; the clock runs backward. One knock, no flash or camera takeover.                                                                                                                                                              |
| The glass is late | Watch the mirror for roughly two seconds, turn away nearby, then look back.                                                                                             | Roughly 0.68-second body delay becomes a stationary occupant near the glass with independent gaze. The electrical bed recedes. A small metallic contact reveals a key in the console drawer.                                                              |
| Bedroom           | Open the drawer and take the key; enter the bedroom and read the diary.                                                                                                 | Radio → running water → lullaby, every night. A breathing shape under the quilt begins on the next pass. The diary mentions writing on the bathroom glass and “What came first must be last.”                                                             |
| An hour reflected | Complete another circuit; wipe the bathroom glass with E. Set the hall clock to **03:17**, reversing the clue recorded as **71:30**. Answer the sitting-room telephone. | The family vanishes from its photograph. The call reverses the nightly routine. A human silhouette waits in the return passage, vanishing after it is seen and the player looks away or approaches. Two unclaimed footfalls follow.                       |
| The other side    | Complete the circuit after clock and call. Silence **bedroom music box → bathroom tap → sitting-room telephone/radio**, then return through the passage.                | The mirror loses its occupant. Lighting turns colder, a kitchen chair sits against the ceiling, the television carries the empty family image. Each correct action removes a sound. Incorrect order restarts the sequence; it never locks the player out. |
| Refusal           | Face the returned mirror occupant. It asks you to come closer. Turn away and walk away instead.                                                                         | The front latch releases. No victory sting. The note's instruction now has a literal use.                                                                                                                                                                 |
| Replacement       | Open the front door and cross the exit.                                                                                                                                 | A sheet of glass blocks the apparent way out. The view turns back toward the house; a person in your body walks away. The last line has room to finish before darkness.                                                                                   |
| End / replay      | “You watched someone leave in your body. In the glass, the house is finally quiet.”                                                                                     | Silence; PLAY AGAIN resets the entire house.                                                                                                                                                                                                              |

## Complete voice script

These fifteen lines are implemented; exact subtitle/synthesis input is in `src/story.mjs` and `assets/voice/lines.json`.

| ID / trigger                           | Speaker and line                                                                                     | Direction                                               |
| -------------------------------------- | ---------------------------------------------------------------------------------------------------- | ------------------------------------------------------- |
| arrival / shortly after entry          | YOU: “I know this house. I just don’t remember the way in.”                                          | Tired recognition, close and dry.                       |
| recording / first telephone inspection | THE TELEPHONE: “If you are hearing this, leave the lights on. There is a spare fuse in the kitchen.” | An old practical message, no menace in delivery.        |
| power / install fuse                   | YOU: “There. Now why does that feel worse?”                                                          | Relief catches in the second sentence.                  |
| repeat / first changed circuit         | YOU: “That picture. It was the other way up.”                                                        | Testing a memory, not announcing a scare.               |
| late / delayed reflection              | YOU: “Did I move first?”                                                                             | Small and uncertain.                                    |
| returned / held reflection             | THE GLASS: “You can stop now. I remember how to be you.”                                             | Familiar, helpful, too composed.                        |
| key / collect bedroom key              | YOU: “The bedroom key. Someone has been holding it.”                                                 | Revulsion beneath observation.                          |
| diary / read bedroom diary             | YOU: “Radio. Water. A lullaby. Every night, in that order.”                                          | Remembering a routine rather than reading instructions. |
| time / wipe bathroom clue              | YOU: “It isn’t a time. It’s the reflection of one.”                                                  | Quiet recognition.                                      |
| call / telephone after setting clock   | THE TELEPHONE: “You were never the one making the sounds. Make them stop. Last sound first.”         | Same recording voice, newly personal.                   |
| inverted / enter inverted pass         | YOU: “This is the same house. Why does everything feel like the other side?”                         | Control the breathing; no scream.                       |
| command / face final occupant          | THE GLASS: “Come closer. Do exactly what I do.”                                                      | Patient expectation.                                    |
| released / refuse and leave            | YOU: “No. You can stay there.”                                                                       | First decisive line, still restrained.                  |
| unlocked / open front door             | THE GLASS: “You always needed someone to open the door.”                                             | Almost kind.                                            |
| ending / replacement walks away        | THE GLASS: “There. Stay where I used to be. It’s my turn.”                                           | Ordinary finality; space after the last word.           |

## Performance and sound

YOU and THE GLASS should sound like the same person. The glass has removed hesitation, not acquired a villain voice. A human actor can record both in one session: two restrained takes per line, 48 kHz mono WAV, no baked music/reverb and two seconds of room tone. Do not imitate a real performer without permission.

All fifteen current takes are **synthetic provisional performances**, generated offline with the public-domain LJ Speech dataset model. No human acting is claimed. Glass takes have modest pitch/filter/short-echo treatment; telephone takes have restricted bandwidth. Directed human performances remain a preferred polish step. Subtitles continue when voice playback is muted.

Room sources occupy physical positions: telephone/static in the sitting room, water in the bathroom, lullaby in the bedroom. Use headphones to orient the player. Silence is an authored change. Footfalls remain grounded in movement, except the two deliberately unclaimed steps after the watcher. Keep voices intelligible, peaks controlled and the hum low. The browser starts audio only after a gesture; pause, journal and clock inspection suspend it.

## Scope through October 25

Finish and tune this five-room, five-pass arc. Prioritize human playtesting, clearer environmental storytelling, believable reflection and sound balancing. Add no combat, chase AI, second floor, alternate ending, large inventory puzzle tree or save system before the existing route is compelling. Measure first-time duration and real-device performance before making claims. Scanned props and human acting are optional improvements, not dependencies for a complete ending.
