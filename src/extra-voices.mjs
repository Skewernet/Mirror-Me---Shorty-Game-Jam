// Original, indirect reminders. These never identify a different culprit or
// state the final confession before the player reaches the revealed bedroom.
export const EXTRA_VOICES = {
  mirrorClock0: { speaker: "THE GLASS", text: "The hands kept turning. The water went cold." },
  mirrorClock1: { speaker: "THE GLASS", text: "Mum liked her bath warm. You let the hour slip away." },
  mirrorClock2: { speaker: "THE GLASS", text: "Some things keep time. Some things keep the face you won't look at." },
  mirror0: { speaker: "THE GLASS", text: "Those hands remember what you won't." },
  mirror1: { speaker: "THE GLASS", text: "She heard you coming down the hall." },
  mirror2: { speaker: "THE GLASS", text: "You made everything quiet. Almost everything." },
  mirror3: { speaker: "THE GLASS", text: "You keep remembering the door. Never what was behind you." },
  mirror4: { speaker: "THE GLASS", text: "The water stopped. She was still listening." },
  mirror5: { speaker: "THE GLASS", text: "You washed your hands before you answered." },
  mirror6: { speaker: "THE GLASS", text: "Look at me. You knew how to look at her." },
  mirror7: { speaker: "THE GLASS", text: "Tell it again. Leave yourself in this time." },
  routineCall: {
    speaker: "THE TELEPHONE",
    text: "Mara... the diary... beside the bed. Read the last page. End the evening backwards. The music box... then the bathroom tap... then the kitchen radio. Please... don't get it wrong again.",
    duration: 20.6,
    captionCues: [
      { at: 0.0, text: "Mara." },
      { at: 1.81, text: "The diary. Beside the bed." },
      { at: 5.14, text: "Read the last page." },
      { at: 7.642, text: "End the evening backwards." },
      { at: 10.47, text: "The music box." },
      { at: 12.545, text: "Then the bathroom tap." },
      { at: 15.107, text: "Then the kitchen radio." },
      { at: 17.866, text: "Please. Don't get it wrong again." },
    ],
  },
};
