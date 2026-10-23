import { ECHO_ORDER, CLOCK_SOLUTION } from "./layout.mjs";
import { KEEPSAKE_ORDER, RADIO_SOLUTION } from "./chapters.mjs";

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
    this.radioOn = true;
    this.radioFrequency = 88.0;
    this.radioTuned = false;
    this.phoneLiftUntil = 0;
    this.hasTimeClue = false;
    this.clockHour = 12;
    this.clockMinute = 0;
    this.clockSolved = false;
    this.heardCall = false;
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
        return this.encounter && this.hasDiary;
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
      if (this.hasDiary) return "diary-repeat";
      this.hasDiary = true;
      return this.result("diary");
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
    if (id === "photo") return this.stage >= 2 ? "photo-changed" : "photo";
    if (id === "door") {
      if (this.backdoorGone || this.stage >= 5) return "backdoor-gone";
      if (!this.ready()) return "backdoor-locked";
      this.refreshGate();
      return "backdoor-open";
    }
    if (id === "bed-farewell") {
      if (this.stage !== 6) return "bed-waiting";
      if (this.farewellSaid) return "farewell-repeat";
      this.farewellSaid = true;
      return "farewell";
    }
    if (id === "bedside-lamp") {
      if (this.stage !== 6) return "lamp-stay";
      if (!this.farewellSaid) return "lamp-not-yet";
      if (this.lampOff) return "lamp-already-off";
      this.lampOff = true;
      this.frontReleased = true;
      this.events.push("front-unlocked");
      return "lamp-off";
    }
    if (id === "front-door") {
      if (!this.frontReleased) return "front-locked";
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
      if (!this.encounter)
        return "Watch the glass. Turn away nearby, then look back.";
      if (!this.hasKey) return "Something dropped into the hall drawer.";
      if (!this.hasDiary)
        return "The small key fits Mum's bedroom. Her diary is by the bed.";
    }
    if (this.stage === 2) {
      if (!this.hasTimeClue)
        return "The bathroom glass has kept the hour backward. Wipe it.";
      if (!this.clockSolved)
        return "Read 71:30 backward: 03:17. Set the hall clock.";
      if (!this.radioTuned)
        return "The diary gives Mum's station: tune the kitchen radio to 93.7 FM.";
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
      return "End her evening in reverse: close the bedroom music box, stop the bathroom tap, then switch off the kitchen radio.";
    if (this.stage === 5)
      return "The back door is gone. Your reflection is gone. Walk into the empty mirror.";
    if (this.stage === 6) {
      if (!this.farewellSaid)
        return "Go to Mum's bed. There is something you still have to say.";
      if (!this.lampOff) return "Turn off the lamp beside her bed.";
      if (!this.frontOpen)
        return "The front lock has released. This is the door you came through.";
      return "Leave through the front doorway.";
    }
    return "The rear latch should be open. Return to the end of the hall.";
  }
}
export const WRITINGS = {
  note: "IF THE HALL RETURNS, FINISH WHAT YOU LEFT.\nIF THE LATCH HOLDS, SOMETHING IS UNFINISHED.\nWHEN THE GLASS IS EMPTY, WALK THROUGH.\n\nI know this handwriting.",
  diary:
    "HER EVENING\nHer station is 93.7 FM. The kitchen radio for company, then her bath, then the bedroom music box.\n\nBefore the bath: her watch beside the kitchen radio. Next, her ring in the dish beside the bath. Last, the ribbon on the tray at the bedroom music box. Always that order. Things where she could reach them.\n\nWHAT I BROUGHT HOME\nI left the watch on the kitchen table. The ring is with the washing in the utility room. The ribbon is on the sitting-room table. They should not be here. The hospital bag was sealed.\n\nAFTER THE CALL\nThe bathroom glass kept the hour backward. I kept winding the box. I thought the silence would wake her.\n\nIf I do it again, I have to finish it: close the bedroom music box, stop the bathroom tap, switch off the kitchen radio. Her evening, in reverse.\n\nI have written that last line twice.",
  letter:
    "ST. ANNE'S — PERSONAL EFFECTS\nE. VALE\nCollected by: MARA VALE\n\nOne wristwatch. One wedding ring. One ribbon.\nItems returned in a sealed property bag to the nominated next of kin.\n\nIn my handwriting, below the signature:\nI left my coat on. I thought I would only be a minute.",
};
export const VOICES = {
  arrival: {
    speaker: "MARA",
    text: "Mum's light is still on. I asked them to leave it.",
  },
  recording: {
    speaker: "THE TELEPHONE",
    text: "Mara? It's Mum. The kitchen's gone again. Spare fuse by the sink. Don't go before I've fallen asleep.",
  },
  power: { speaker: "MARA", text: "They disconnected this house on Monday." },
  repeat: {
    speaker: "MARA",
    text: "I straightened that photograph before I left.",
  },
  late: { speaker: "MARA", text: "That wasn't a blink." },
  returned: {
    speaker: "THE GLASS",
    text: "You always look away before the difficult part.",
  },
  key: {
    speaker: "MARA",
    text: "Her bedroom. I haven't opened it since the hospital.",
  },
  diary: {
    speaker: "MARA",
    text: "The kitchen radio. Then her bath. Then the music box. I thought the silence would wake her.",
  },
  time: {
    speaker: "MARA",
    text: "Three seventeen. That's when the nurse called.",
  },
  call: {
    speaker: "THE TELEPHONE",
    text: "Mara. I can hear the music box through your receiver. You closed it after the hospital called. I remember your hand on the lid. Put her things back. Then end the evening in reverse. Please. Let it stay finished.",
  },
  inverted: {
    speaker: "MARA",
    text: "I stopped coming. Something kept doing it for me.",
  },
  command: { speaker: "THE GLASS", text: "You wanted an empty house. Go on." },
  released: {
    speaker: "MARA",
    text: "She's gone. We don't have to do this again.",
  },
  unlocked: { speaker: "THE GLASS", text: "Don't leave the light on for me." },
  ending: { speaker: "MUM", text: "There you are, Mara. I kept your place." },
  broadcast: {
    speaker: "THE KITCHEN RADIO",
    text: "Rain overnight. All roads out of the valley remain closed. Another bulletin will follow.",
  },
  letter: {
    speaker: "MARA",
    text: "Personal effects. They put her whole life in those two words.",
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
    text: "There. You haven't forgotten how to be her daughter.",
  },
  empty: { speaker: "MARA", text: "I'm still here. I should still be there." },
  farewell: {
    speaker: "MARA",
    text: "I kept coming back because I couldn't remember the last ordinary night. This isn't it. Good night, Mum.",
  },
};
