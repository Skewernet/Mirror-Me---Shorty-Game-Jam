// Shared narrative constants; scene/controller code owns physical thresholds.
export const CHAPTERS = [
  {
    id: 0,
    title: "THE FUSE AGAIN",
    objective:
      "Answer the telephone, replace the fuse and establish your reflection.",
  },
  {
    id: 1,
    title: "SOMETHING STAYS",
    objective:
      "Straighten the hall photograph. Test the glass, find its key and read the bedroom diary.",
  },
  {
    id: 2,
    title: "THE HOUR OF THE CALL",
    objective:
      "Read the bathroom glass, set the clock and tune the kitchen radio to Mum's station.",
  },
  {
    id: 3,
    title: "PUT EVERYTHING BACK",
    objective:
      "Return the watch, ring and ribbon to the places in the diary, in the order of her evening.",
  },
  {
    id: 4,
    title: "END THE EVENING",
    objective:
      "Close the music box, stop the bath and switch off the kitchen radio. Keep that order.",
  },
  {
    id: 5,
    title: "NO ONE IN THE GLASS",
    objective:
      "The back door has gone. Find the place your reflection has left empty.",
  },
  {
    id: 6,
    title: "THE RIGHT WAY ROUND",
    objective:
      "Face what happened at Mum's bed, turn off her light and leave through the front door.",
  },
];
export const RADIO_SOLUTION = 93.7;
export const KEEPSAKE_ORDER = [
  {
    item: "watch",
    label: "MUM'S WATCH",
    room: "kitchen",
    target: "radio-altar",
  },
  { item: "ring", label: "MUM'S RING", room: "utility", target: "bath-dish" },
  {
    item: "ribbon",
    label: "MUSIC-BOX RIBBON",
    room: "lounge",
    target: "musicbox-base",
  },
];
