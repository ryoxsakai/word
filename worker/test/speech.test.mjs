import assert from "node:assert/strict";
import { playPronunciation, speakEnglish } from "../../public/shared/speech.js";

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
  const calls = [];
  let appliedGain = null;
  class StubAudio {
    constructor(url) {
      this.url = url;
      calls.push(["audio", url]);
    }
    play() {
      calls.push(["play", this.url]);
      return Promise.resolve();
    }
    pause() {
      calls.push(["pause", this.url]);
    }
  }
  class StubAudioContext {
    constructor() {
      this.destination = {};
    }
    createMediaElementSource() {
      return { connect: () => ({ connect: () => {} }) };
    }
    createGain() {
      const gain = { value: 1 };
      appliedGain = gain;
      return { gain };
    }
    resume() {}
  }
  const synthesis = { cancel: () => calls.push(["cancel"]) };
  const button = fakeButton();
  assert.equal(
    playPronunciation("permit", {
      audioUrl: "/mcp-viewer/api/audio/permit/primary",
      button,
      synthesis,
      AudioCtor: StubAudio,
      AudioContextCtor: StubAudioContext,
      Utterance: StubUtterance,
    }),
    true
  );
  assert.deepEqual(calls.slice(0, 3), [
    ["cancel"],
    ["audio", "/mcp-viewer/api/audio/permit/primary"],
    ["play", "/mcp-viewer/api/audio/permit/primary"],
  ]);
  assert.equal(button.classes.has("speaking"), true);
  assert.equal(appliedGain.value, 1.4);
}

{
  const spoken = [];
  class FailingAudio {
    play() {
      return Promise.reject(new Error("missing audio"));
    }
    pause() {}
  }
  const synthesis = {
    cancel: () => {},
    getVoices: () => [],
    speak: (utterance) => spoken.push(utterance),
  };
  assert.equal(
    playPronunciation("permit", {
      audioUrl: "/missing.mp3",
      synthesis,
      AudioCtor: FailingAudio,
      Utterance: StubUtterance,
    }),
    true
  );
  await new Promise((resolve) => setTimeout(resolve, 0));
  assert.equal(spoken.length, 1);
  assert.equal(spoken[0].text, "permit");
}

{
  const remoteUsVoice = { lang: "en-US", localService: false, name: "Remote English" };
  const localGbVoice = { lang: "en-GB", localService: true, name: "System British" };
  const calls = [];
  const synthesis = {
    cancel: () => {},
    getVoices: () => [remoteUsVoice, localGbVoice],
    speak: (utterance) => calls.push(utterance),
  };

  assert.equal(speakEnglish("permit", { synthesis, Utterance: StubUtterance }), true);
  assert.equal(calls[0].voice, localGbVoice);
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
