let activeUtterance = null;
let activeAudio = null;
let activeButton = null;
let audioContext = null;

const GENERATED_AUDIO_GAIN = 1.4;

function clearActiveButton() {
  activeButton?.classList?.remove("speaking");
  activeButton = null;
}

function stopActiveAudio() {
  if (!activeAudio) return;
  activeAudio.pause?.();
  activeAudio = null;
}

// 生成音声は試聴で採用した約+3 dB（1.4倍）で再生する。
// Web Audio APIが使えない環境では通常音量のAudio再生へ安全に戻る。
function boostGeneratedAudio(audio, AudioContextCtor) {
  const ContextClass =
    AudioContextCtor || globalThis.AudioContext || globalThis.webkitAudioContext;
  if (!ContextClass) return;
  try {
    audioContext ||= new ContextClass();
    const source = audioContext.createMediaElementSource(audio);
    const gain = audioContext.createGain();
    gain.gain.value = GENERATED_AUDIO_GAIN;
    source.connect(gain).connect(audioContext.destination);
    audioContext.resume?.();
  } catch {
    // 再生自体を優先し、Web Audioの初期化失敗は無視する。
  }
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
  {
    audioUrl = null,
    button = null,
    onUnsupported = null,
    synthesis,
    Utterance,
    AudioCtor,
    AudioContextCtor,
  } = {}
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
  boostGeneratedAudio(audio, AudioContextCtor);
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
