let activeUtterance = null;
let activeAudio = null;
let activeButton = null;

function clearActiveButton() {
  activeButton?.classList?.remove("speaking");
  activeButton = null;
}

function stopActiveAudio() {
  if (!activeAudio) return;
  activeAudio.pause?.();
  activeAudio = null;
}

function preferredEnglishVoice(synthesis) {
  const voices = synthesis.getVoices?.() || [];
  return (
    voices.find((voice) => voice.localService && /^en-US$/i.test(voice.lang || "")) ||
    voices.find((voice) => voice.localService && /^en(?:-|_)/i.test(voice.lang || "")) ||
    voices.find((voice) => /^en-US$/i.test(voice.lang || "")) ||
    voices.find((voice) => /^en(?:-|_)/i.test(voice.lang || "")) ||
    null
  );
}

// Web Speech APIを通して、iOSではシステム音声、対応ブラウザでは端末の英語音声を使う。
export function speakEnglish(text, { button = null, onUnsupported = null, synthesis, Utterance } = {}) {
  const speechSynthesis = synthesis || globalThis.speechSynthesis;
  const SpeechUtterance = Utterance || globalThis.SpeechSynthesisUtterance;
  const normalizedText = String(text || "").trim();

  if (!normalizedText || !speechSynthesis || !SpeechUtterance) {
    onUnsupported?.();
    return false;
  }

  stopActiveAudio();
  speechSynthesis.cancel();
  clearActiveButton();

  const utterance = new SpeechUtterance(normalizedText);
  utterance.lang = "en-US";
  utterance.rate = 0.9;
  const voice = preferredEnglishVoice(speechSynthesis);
  if (voice) utterance.voice = voice;

  activeUtterance = utterance;
  activeButton = button;
  activeButton?.classList?.add("speaking");

  const clear = () => {
    if (activeUtterance !== utterance) return;
    activeUtterance = null;
    clearActiveButton();
  };
  utterance.onend = clear;
  utterance.onerror = clear;
  speechSynthesis.speak(utterance);
  return true;
}

// ElevenLabsで生成済みの音声を優先し、取得・再生できない場合だけ端末音声へ戻す。
export function playPronunciation(
  text,
  { audioUrl = null, button = null, onUnsupported = null, synthesis, Utterance, AudioCtor } = {}
) {
  const normalizedAudioUrl = String(audioUrl || "").trim();
  const AudioClass = AudioCtor || globalThis.Audio;
  if (!normalizedAudioUrl || !AudioClass) {
    return speakEnglish(text, { button, onUnsupported, synthesis, Utterance });
  }

  const speechSynthesis = synthesis || globalThis.speechSynthesis;
  speechSynthesis?.cancel?.();
  stopActiveAudio();
  clearActiveButton();

  const audio = new AudioClass(normalizedAudioUrl);
  activeAudio = audio;
  activeButton = button;
  activeButton?.classList?.add("speaking");

  const clear = () => {
    if (activeAudio !== audio) return;
    activeAudio = null;
    clearActiveButton();
  };
  const fallback = () => {
    if (activeAudio !== audio) return;
    clear();
    speakEnglish(text, { button, onUnsupported, synthesis, Utterance });
  };
  audio.onended = clear;
  audio.onerror = fallback;
  try {
    const playResult = audio.play();
    playResult?.catch?.(fallback);
  } catch {
    fallback();
  }
  return true;
}
