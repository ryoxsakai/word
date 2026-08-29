let context;
let activeSource;

async function play(url, gainValue, button) {
  activeSource?.stop?.();
  context ||= new AudioContext();
  await context.resume();
  const response = await fetch(url, { cache: "no-store" });
  if (!response.ok) throw new Error("サンプルをまだ取得できません");
  const buffer = await context.decodeAudioData(await response.arrayBuffer());
  const source = context.createBufferSource();
  const gain = context.createGain();
  gain.gain.value = gainValue;
  source.buffer = buffer;
  source.connect(gain).connect(context.destination);
  activeSource = source;
  button.classList.add("playing");
  source.onended = () => {
    button.classList.remove("playing");
    if (activeSource === source) activeSource = null;
  };
  source.start();
}

document.addEventListener("click", async (event) => {
  const button = event.target.closest("button[data-gain]");
  if (!button) return;
  document.querySelectorAll("button.playing").forEach((item) => item.classList.remove("playing"));
  const group = button.closest("[data-url]");
  const url = button.dataset.url || group?.dataset.url;
  const status = document.querySelector("#status");
  status.textContent = "";
  try {
    await play(url, Number(button.dataset.gain || 1), button);
  } catch (error) {
    status.textContent = error.message;
  }
});
