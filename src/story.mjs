import { ECHO_ORDER, CLOCK_SOLUTION } from "./layout.mjs";
import { KEEPSAKE_ORDER, RADIO_SOLUTION } from "./chapters.mjs";
import { EXTRA_VOICES } from "./extra-voices.mjs";

const numeric = (value) =>
  typeof value === "number" || (typeof value === "string" && value.trim())
    ? Number(value)
    : NaN;

export class Story {
  constructor() {
    this.reset();
  }
  reset() {
    this.stage = 0;
    this.laps = 0;
    this.firstSeen = 0;
    this.secondSeen = 0;
    this.returnSeen = 0;
    this.armed = false;
    this.frozen = false;
    this.encounter = false;
    this.drawerOpen = false;
    this.keyAvailable = false;
    this.hasKey = false;
    this.hasNote = false;
    this.hasFuse = false;
    this.power = false;
    this.heardArrival = false;
    this.hasDiary = false;
    this.hasLetter = false;
    this.photoNoticed = false;
    this.photoStraightened = false;
    this.radioOn = true;
    this.radioFrequency = 88.0;
    this.radioTuned = false;
    this.phoneLiftUntil = 0;
    this.hasTimeClue = false;
    this.clockHour = 12;
    this.clockMinute = 0;
    this.clockSolved = false;
    this.heardCall = false;
    this.heardRoutineCall = false;
    this.hasStationClue = false;
    this.mirrorTauntCursor = 0;
    this.keepsakes = { watch: false, ring: false, ribbon: false };
    this.placedKeepsakes = [];
    this.ritualIndex = 0;
    this.ritualTarget = null;
    this.lastPlacement = null;
    this.echoIndex = 0;
    this.musicboxOn = true;
    this.tapOn = true;
    this.doorOpen = false;
    this.backdoorUnlocked = false;
    this.backdoorGone = false;
    this.mirrorReady = false;
    this.inverted = false;
    this.farewellSaid = false;
    this.truthFound = false;
    this.lampOff = false;
    this.frontReleased = false;
    this.frontOpen = false;
    this.frontOpening = false;
    this.wakeEntered = false;
    this.endingStarted = false;
    this.ended = false;
    this.doors = {
      lounge: false,
      bathroom: false,
      kitchen: false,
      bedroom: false,
      utility: false,
    };
    this.visited = [];
    // Only additional automatic events are queued. Interaction return values
    // remain synchronous and are never duplicated in this queue.
    this.events = [];
  }
  get silenceComplete() {
    return this.echoIndex === ECHO_ORDER.length;
  }
  ready() {
    switch (this.stage) {
      case 0:
        return this.firstSeen >= 1.3 && this.heardArrival && this.power;
      case 1:
        return this.photoStraightened && this.encounter && this.hasDiary;
      case 2:
        return this.clockSolved && this.radioTuned && this.heardCall;
      case 3:
        return this.ritualIndex === KEEPSAKE_ORDER.length;
      case 4:
        return this.silenceComplete;
      default:
        return false;
    }
  }
  refreshGate() {
    if (
      this.stage >= 0 &&
      this.stage <= 4 &&
      this.ready() &&
      !this.backdoorUnlocked
    ) {
      this.backdoorUnlocked = true;
      this.doorOpen = true;
      this.events.push("backdoor-unlocked");
    }
  }
  result(event) {
    this.refreshGate();
    return event;
  }
  drainEvents() {
    const events = this.events;
    this.events = [];
    return events;
  }
  visit(room) {
    if (room !== "hall" && !this.visited.includes(room)) {
      this.visited.push(room);
      return "enter-" + room;
    }
    return null;
  }
  noticePhoto() {
    if (this.stage !== 1 || this.photoNoticed || this.photoStraightened)
      return null;
    this.photoNoticed = true;
    return "photo-crooked";
  }
  observe(dt, looking, near, distance = 10, moving = false) {
    const events = [];
    const seconds = Number.isFinite(dt) ? Math.max(0, dt) : 0;
    if (this.stage === 0 && looking) this.firstSeen += seconds;
    if (this.stage === 1 && !this.frozen) {
      if (looking) this.secondSeen += seconds;
      if (this.secondSeen >= 2.1) this.armed = true;
      if (this.armed && !looking && near) {
        this.frozen = true;
        events.push("held");
      }
    }
    if (this.frozen && this.stage === 1 && looking && !this.encounter) {
      this.returnSeen += seconds;
      if (this.returnSeen >= 1.3) {
        this.encounter = true;
        this.keyAvailable = true;
        events.push("returned");
      }
    }
    this.refreshGate();
    return events.concat(this.drainEvents());
  }
  // Walking the L never consumes a pass. Only the controller's physical rear
  // crossing can advance, and an unfinished chapter cannot open that door.
  traverse() {
    return null;
  }
  crossBackDoor() {
    if (this.stage < 0 || this.stage > 4 || !this.doorOpen || !this.ready())
      return null;
    this.stage++;
    this.laps++;
    this.doorOpen = false;
    this.backdoorUnlocked = false;
    this.events = [];
    if (this.stage === 4) {
      this.echoIndex = 0;
      this.musicboxOn = true;
      this.tapOn = true;
      this.radioOn = true;
    }
    if (this.stage === 5) {
      this.backdoorGone = true;
      this.mirrorReady = true;
    }
    return "pass-" + this.stage;
  }
  crossMirror() {
    if (this.stage !== 5 || !this.mirrorReady) return null;
    this.stage = 6;
    this.inverted = true;
    this.mirrorReady = false;
    this.backdoorGone = true;
    this.doorOpen = false;
    this.events = [];
    return "mirror-crossed";
  }
  enterWake() {
    if (
      this.stage !== 6 ||
      !this.truthFound ||
      !this.frontReleased ||
      !this.frontOpen ||
      this.wakeEntered
    )
      return null;
    this.wakeEntered = true;
    this.endingStarted = true;
    return "wake-entered";
  }
  setClock(hour, minute) {
    const h = numeric(hour),
      m = numeric(minute);
    if (
      !Number.isInteger(h) ||
      !Number.isInteger(m) ||
      h < 1 ||
      h > 12 ||
      m < 0 ||
      m > 59
    )
      return "invalid-time";
    this.clockHour = h % 12;
    this.clockMinute = m;
    if (
      this.stage >= 2 &&
      this.hasTimeClue &&
      this.clockHour === CLOCK_SOLUTION.hour &&
      this.clockMinute === CLOCK_SOLUTION.minute
    ) {
      this.clockSolved = true;
      return this.result("clock-solved");
    }
    return this.result("clock-set");
  }
  tuneRadio(frequency) {
    if (!this.power) return "radio-no-power";
    if (this.stage !== 2 || !this.clockSolved) return "radio-await-clock";
    const f = numeric(frequency);
    if (!Number.isFinite(f) || f < 87.5 || f > 108) return "radio-static";
    if (this.radioTuned) return "radio-tuned";
    this.radioFrequency = f;
    if (Math.abs(f - RADIO_SOLUTION) > 0.001) return "radio-static";
    this.radioFrequency = RADIO_SOLUTION;
    this.radioTuned = true;
    this.radioOn = true;
    return this.result("radio-tuned");
  }
  keepsakeTaken(item) {
    return Boolean(this.keepsakes[item]) || this.placedKeepsakes.includes(item);
  }
  placeKeepsake(target, item) {
    if (this.stage !== 3) return "ritual-inactive";
    if (!KEEPSAKE_ORDER.some((step) => step.item === item))
      return "ritual-wrong";
    if (this.placedKeepsakes.includes(item)) return "keepsake-already-placed";
    if (!this.keepsakes[item]) return "keepsake-not-held";
    const expected = KEEPSAKE_ORDER[this.ritualIndex];
    if (!expected || target !== expected.target || item !== expected.item)
      return "ritual-wrong";
    this.keepsakes[item] = false;
    this.placedKeepsakes.push(item);
    this.lastPlacement = { item, target, index: this.ritualIndex };
    this.ritualIndex++;
    return this.result(
      this.ritualIndex === KEEPSAKE_ORDER.length
        ? "ritual-complete"
        : "keepsake-placed",
    );
  }
  interact(id) {
    if (typeof id !== "string") return null;
    if (id.startsWith("room-")) {
      const room = id.slice(5);
      if (!(room in this.doors)) return null;
      if (room === "bedroom" && !this.hasKey) return "bedroom-locked";
      this.doors[room] = !this.doors[room];
      return this.doors[room] ? "room-open" : "room-close";
    }
    if (id.startsWith("keepsake-")) {
      const item = id.slice(9);
      if (!Object.hasOwn(this.keepsakes, item)) return null;
      if (this.keepsakeTaken(item)) return "keepsake-repeat";
      if (this.stage !== 3) return "keepsake-unavailable";
      this.keepsakes[item] = true;
      return "keepsake-" + item;
    }
    if (KEEPSAKE_ORDER.some((step) => step.target === id)) {
      if (this.stage !== 3) return "ritual-inactive";
      this.ritualTarget = id;
      return "ritual-choice";
    }
    if (id === "note") {
      if (this.hasNote) return null;
      this.hasNote = true;
      return "note";
    }
    if (id === "telephone") {
      if (!this.heardArrival) {
        this.heardArrival = true;
        return this.result("arrival-recording");
      }
      if (
        this.stage === 2 &&
        this.clockSolved &&
        this.radioTuned &&
        !this.heardCall
      ) {
        this.heardCall = true;
        return this.result("call");
      }
      if (((this.stage === 3 && this.ritualIndex === KEEPSAKE_ORDER.length) || (this.stage === 4 && !this.silenceComplete)) && !this.heardRoutineCall) {
        this.heardRoutineCall = true;
        return "routine-call";
      }
      return this.stage >= 3 ? "telephone-dead" : "telephone-repeat";
    }
    if (id === "radio") {
      if (this.stage === 4) return this.silence("radio");
      if (this.stage >= 5) return "already-quiet";
      if (!this.power) return "radio-no-power";
      if (this.stage === 2)
        return this.clockSolved ? "radio-tune" : "radio-await-clock";
      this.radioOn = !this.radioOn;
      return this.radioOn ? "radio-on" : "radio-off";
    }
    if (id === "letter") {
      if (this.hasLetter) return "letter-repeat";
      this.hasLetter = true;
      return "letter";
    }
    if (id === "fuse") {
      if (this.hasFuse || this.power) return null;
      this.hasFuse = true;
      return "fuse";
    }
    if (id === "panel") {
      if (this.power) return "panel-on";
      if (!this.hasFuse) return "panel-empty";
      this.hasFuse = false;
      this.power = true;
      return this.result("power");
    }
    if (id === "mirror") {
      if (this.stage === 5) return "mirror-enter";
      if (this.stage === 6) return "mirror-inverted";
      if (this.stage === 0) return "mirror-first";
      if (this.hasKey && this.frozen) {
        const event = "mirror" + (this.mirrorTauntCursor % 8);
        this.mirrorTauntCursor = (this.mirrorTauntCursor + 1) % 8;
        return event;
      }
      return this.encounter ? "mirror-held" : "mirror-late";
    }
    if (id === "drawer") {
      if (!this.drawerOpen) {
        this.drawerOpen = true;
        return "drawer-open";
      }
      if (this.keyAvailable && !this.hasKey) {
        this.hasKey = true;
        return "key";
      }
      this.drawerOpen = false;
      return "drawer-close";
    }
    if (id === "diary") {
      if (!this.hasKey) return "bedroom-locked";
      if (this.hasDiary && this.stage >= 3) return "diary-routine";
      if (this.hasDiary) return "diary-repeat";
      this.hasDiary = true;
      return this.result("diary");
    }
    if (id === "station-clue") {
      if (this.stage !== 2 || !this.clockSolved) return null;
      this.hasStationClue = true;
      return "station-clue";
    }
    if (id === "bath-clue") {
      if (this.stage < 2) return "bath-clouded";
      this.hasTimeClue = true;
      if (
        this.clockHour === CLOCK_SOLUTION.hour &&
        this.clockMinute === CLOCK_SOLUTION.minute
      )
        this.clockSolved = true;
      return this.result("time-clue");
    }
    if (id === "clock") return "clock";
    if (id === "musicbox" || id === "tap") {
      if (this.stage >= 5) return "already-quiet";
      return this.stage === 4 ? this.silence(id) : id;
    }
    if (id === "photo") {
      if (this.stage === 1 && !this.photoStraightened) {
        this.photoNoticed = true;
        this.photoStraightened = true;
        return this.result("photo-straightened");
      }
      return this.stage >= 2 ? "photo-changed" : "photo";
    }
    if (id === "door") {
      if (this.backdoorGone || this.stage >= 5) return "backdoor-gone";
      if (!this.ready()) return "backdoor-locked";
      this.refreshGate();
      return "backdoor-open";
    }
    if (id === "bed-farewell") {
      if (this.stage !== 6) return "bed-waiting";
      if (this.farewellSaid) return "farewell-repeat";
      this.truthFound = true;
      this.farewellSaid = true;
      return "farewell";
    }
    if (id === "bedside-lamp") {
      if (this.stage !== 6) return "lamp-stay";
      if (!this.truthFound || !this.farewellSaid) return "lamp-not-yet";
      if (this.lampOff) return "lamp-already-off";
      this.lampOff = true;
      this.frontReleased = true;
      this.events.push("front-unlocked");
      return "lamp-off";
    }
    if (id === "front-door") {
      if (!this.truthFound || !this.frontReleased) return "front-locked";
      if (this.frontOpening) return "front-open";
      this.frontOpen = true;
      this.frontOpening = true;
      return "ending-open";
    }
    return null;
  }
  silence(id) {
    if (this.stage !== 4) return "ritual-inactive";
    if (!ECHO_ORDER.includes(id)) return "wrong-order";
    if (this.silenceComplete || ECHO_ORDER.indexOf(id) < this.echoIndex)
      return "already-quiet";
    if (id === ECHO_ORDER[this.echoIndex]) {
      this.echoIndex++;
      if (id === "musicbox") this.musicboxOn = false;
      if (id === "tap") this.tapOn = false;
      if (id === "radio") this.radioOn = false;
      return this.result(
        this.silenceComplete ? "house-quiet" : "echo-silenced",
      );
    }
    this.echoIndex = 0;
    this.musicboxOn = true;
    this.tapOn = true;
    this.radioOn = true;
    return "wrong-order";
  }
  hint() {
    if (this.stage === 3 && this.ritualIndex === KEEPSAKE_ORDER.length && !this.heardRoutineCall)
      return "The sitting-room telephone is ringing once more. Mum's diary is beside her bed.";
    if (this.stage <= 4 && this.doorOpen)
      return "The rear latch has opened. Leave through the back door.";
    if (this.stage === 0) {
      if (!this.heardArrival) return "The sitting-room telephone is ringing.";
      if (!this.hasFuse && !this.power)
        return "The kitchen light is dead. There is a spare fuse by the sink.";
      if (!this.power) return "The fuse box is in the utility room.";
      if (this.firstSeen < 1.3)
        return "Look into the large mirror at the end of the hall.";
    }
    if (this.stage === 1) {
      if (!this.photoStraightened)
        return "The family photograph is crooked at the end of the entrance hall. Straighten it.";
      if (!this.encounter)
        return "Watch the glass. Turn away nearby, then look back.";
      if (!this.hasKey) return "Something dropped into the hall drawer.";
      if (!this.hasDiary)
        return "The small key fits Mum's bedroom. Her diary is by the bed.";
    }
    if (this.stage === 2) {
      if (!this.hasTimeClue)
        return "There is writing in the condensation on the bathroom mirror. Look closely.";
      if (!this.clockSolved)
        return "The mirror has 03:17 written on it. Set the hall clock.";
      if (!this.radioTuned)
        return this.hasStationClue
          ? "The kitchen walls repeat 93.7. Tune the kitchen radio to that station."
          : "There is fresh writing on the kitchen walls. Look near the radio.";
      if (!this.heardCall)
        return "The sitting-room telephone is ringing again.";
    }
    if (this.stage === 3) {
      const next = KEEPSAKE_ORDER[this.ritualIndex];
      if (next && !this.keepsakes[next.item])
        return {
          watch: "Mum's watch is on the kitchen table. Find it first.",
          ring: "The ring is in the utility-room dish, where she left it with the washing.",
          ribbon: "The music-box ribbon is on the sitting-room table.",
        }[next.item];
      if (next)
        return {
          watch:
            "Put the watch beside the kitchen radio. It always started her evening.",
          ring: "Next, put her ring in the dish beside the bath.",
          ribbon: "Last, lay the ribbon on the tray at the bedroom music box.",
        }[next.item];
    }
    if (this.stage === 4)
      return !this.heardRoutineCall
        ? "The sitting-room phone is ringing. Mum's diary is beside her bed; its last page explains how to end the evening."
        : "End her evening in reverse: close the bedroom music box, stop the bathroom tap, then switch off the kitchen radio.";
    if (this.stage === 5)
      return "The back door is gone. Your reflection is gone. Walk into the empty mirror.";
    if (this.stage === 6) {
      if (!this.truthFound)
        return "It started in the bathroom. Follow the blood on the walls to Mum's bed.";
      if (!this.lampOff)
        return "You have seen what happened. Turn off the lamp beside her bed.";
      if (!this.frontOpen)
        return "The front lock has released. This is the door you came through.";
      return "Leave through the front doorway.";
    }
    return "The rear latch should be open. Return to the end of the hall.";
  }
}
export const WRITINGS = {
  routine: "THE LAST PAGE — END HER EVENING\n\nDo the sounds in reverse. Start with the last sound she heard:\n\n1. CLOSE the music box beside Mum's bed.\n2. STOP the tap in the bathroom.\n3. SWITCH OFF the kitchen radio.\n\nMusic box → bathroom tap → kitchen radio. The telephone is not part of this order.",
  note: "IF THE HALL RETURNS, FINISH WHAT YOU LEFT.\nIF THE LATCH HOLDS, SOMETHING IS UNFINISHED.\nWHEN THE GLASS IS EMPTY, WALK THROUGH.\n\nI know this handwriting.",
  diary:
    "HER EVENING\nThe kitchen radio for company, then her bath, then the bedroom music box.\n\nBefore the bath: her watch beside the kitchen radio. Next, her ring in the dish beside the bath. Last, the ribbon on the tray at the bedroom music box. Always that order. Things where she could reach them.\n\nSEVEN YEARS\nI knew what she needed before she asked. I stayed. I did everything. When I write it down, I always start with that.\n\nWHAT I BROUGHT HOME\nI left the watch on the kitchen table. The ring is with the washing in the utility room. The ribbon is on the sitting-room table. They came home in the hospital property bag when she did.\n\nAFTER THE CALL\nThe bathroom mirror had 03:17 written in the condensation. I wrote: the nurse called at 03:17. The first word has been rubbed through the paper.\n\nTHE LAST PAGE — TO END HER EVENING\nDo the sounds in reverse. FIRST close the bedroom music box. SECOND stop the bathroom tap. LAST switch off the kitchen radio. The telephone does not belong to this order.\n\nI have written that last line twice.",
  letter:
    "ST. ANNE'S — DISCHARGE / PERSONAL PROPERTY\nPATIENT: EVELYN VALE\nProperty received by: MARA VALE\n\nOne wristwatch. One wedding ring. One ribbon.\nItems returned on discharge to home care.\nLong-term care to continue at the patient's home.\n\nIn my handwriting, below the signature:\nI kept the house exactly how she liked it. I did everything.",
  truth:
    "I SAID SHE DIED IN HER SLEEP.\n\nThe knife came from my kitchen. I brought it into the bathroom. That was where I first stabbed her.\n\nShe tried to get away. Her blood follows the walls from the bath, through the hall, to her bed. She collapsed there. I followed her. The cuts in the sheet follow my hand.\n\nI dialled for an ambulance at 03:17. Mum was awake. She was looking at me.\n\nI did this.",
};
export const VOICES = {
  arrival: {
    speaker: "MARA",
    text: "Huh. I guess the fuse went out again.",
  },
  recording: {
    speaker: "THE TELEPHONE",
    text: "Mara? It's Mum. The fuse went out again. There are spares in the kitchen. Please don't leave before saying goodnight.",
  },
  power: { speaker: "MARA", text: "They disconnected this house on Monday." },
  repeat: {
    speaker: "MARA",
    text: "I straightened that photograph before I left.",
  },
  photoMemory: {
    speaker: "MARA",
    text: "Dad was still alive. Everything was simpler then. Mum never stopped missing him.",
  },
  late: { speaker: "MARA", text: "That wasn't a blink." },
  returned: {
    speaker: "THE GLASS",
    text: "You always look away before the difficult part.",
  },
  key: {
    speaker: "MARA",
    text: "Her bedroom. I haven't opened it since they took her away.",
  },
  diary: {
    speaker: "MARA",
    text: "The kitchen radio. Then her bath. Then the music box. I thought the silence would wake her.",
  },
  time: {
    speaker: "MARA",
    text: "The mirror has three seventeen written on it.",
  },
  call: {
    speaker: "THE TELEPHONE",
    text: "Mara... the music box... the bath... the radio... please... please don't leave... please don't do this...",
    duration: 16.3,
    captionCues: [
      { at: 0, text: "Mara..." },
      { at: 2.460, text: "The music box..." },
      { at: 4.936, text: "The bath..." },
      { at: 7.251, text: "The radio..." },
      { at: 10.124, text: "Please..." },
      { at: 11.806, text: "Please don't leave..." },
      { at: 14.575, text: "Please don't do this..." },
    ],
  },
  inverted: {
    speaker: "MARA",
    text: "This is the room I keep turning away from.",
  },
  command: {
    speaker: "THE GLASS",
    text: "You keep putting yourself on the wrong side.",
  },
  released: {
    speaker: "MARA",
    text: "It's quiet. That doesn't make it finished.",
  },
  unlocked: {
    speaker: "THE GLASS",
    text: "Now tell it the right way round.",
  },
  ending: { speaker: "MUM", text: "You were looking right at me." },
  goodnight: { speaker: "MUM", text: "Goodnight." },
  crimeBathroom: {
    speaker: "MARA",
    text: "It started here. She tried to get away from me.",
  },
  crimeTrail: {
    speaker: "MARA",
    text: "She held the wall. All the way to her room.",
  },
  crimeKitchen: {
    speaker: "MARA",
    text: "I took it from here. I brought it to her.",
  },
  broadcast: {
    speaker: "THE KITCHEN RADIO",
    text: "Rain overnight. All roads out of the valley remain closed. Another bulletin will follow.",
  },
  letter: {
    speaker: "MARA",
    text: "Personal effects. That's what they called them when they sent her home.",
  },
  watch: {
    speaker: "MARA",
    text: "They gave this back in a sealed bag. It's warm.",
  },
  ring: {
    speaker: "MARA",
    text: "She wore this for forty-three years. It used to catch on my hair.",
  },
  ribbon: {
    speaker: "MARA",
    text: "I tied the lid open. She hated when the music stopped.",
  },
  ritual: {
    speaker: "THE GLASS",
    text: "There. Every little thing put back. That's how you told it.",
  },
  empty: {
    speaker: "MARA",
    text: "I kept leaving myself out of it.",
  },
  farewell: {
    speaker: "MARA",
    text: "It wasn't the illness. I stabbed you in the bathroom. You ran to your bed. I followed you. I kept going. I killed you, Mum.",
  },
  sob: {
    speaker: "MARA",
    text: "No... no. Mum. I'm sorry. I'm so sorry.",
  },
  news: {
    speaker: "THE FUNERAL RADIO",
    text: "Police have confirmed that sixty-eight-year-old Evelyn Vale was attacked in her bathroom and died in her bedroom. Her daughter, Mara Vale, who had been her full-time carer for seven years, has admitted repeatedly stabbing her mother. Detectives say Mara called for an ambulance from the house at three seventeen in the morning. The death was not caused by her illness.",
  },
  ...EXTRA_VOICES,
};
