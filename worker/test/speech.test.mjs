import assert from "node:assert/strict";
import { speakEnglish } from "../../public/shared/speech.js";

class StubUtterance {
  constructor(text) {
    this.text = text;
  }
}

function fakeButton() {
  const classes = new Set();
  return {
    classes,
    classList: {
      add: (name) => classes.add(name),
      remove: (name) => classes.delete(name),
    },
  };
}

{
  const calls = [];
  const localUsVoice = { lang: "en-US", localService: true, name: "System English" };
  const synthesis = {
    cancel: () => calls.push("cancel"),
    getVoices: () => [
      { lang: "en-GB", localService: true, name: "System British" },
      localUsVoice,
    ],
    speak: (utterance) => calls.push(utterance),
  };
  const button = fakeButton();

  assert.equal(speakEnglish("permit", { button, synthesis, Utterance: StubUtterance }), true);
  assert.equal(calls[0], "cancel");
  assert.equal(calls[1].text, "permit");
  assert.equal(calls[1].lang, "en-US");
  assert.equal(calls[1].rate, 0.9);
  assert.equal(calls[1].voice, localUsVoice);
  assert.equal(button.classes.has("speaking"), true);

  calls[1].onend();
  assert.equal(button.classes.has("speaking"), false);
}

{
  let unsupported = false;
  assert.equal(
    speakEnglish("permit", {
      synthesis: null,
      Utterance: null,
      onUnsupported: () => {
        unsupported = true;
      },
    }),
    false
  );
  assert.equal(unsupported, true);
}

console.log("speech tests passed");
