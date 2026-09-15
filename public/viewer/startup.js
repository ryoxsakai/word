// Let the browser paint the body before building navigation and observing placeholders.
// The timer also lets startup finish in a background tab where animation frames pause.
export function afterBodyPaint() {
  return new Promise(resolve => {
    const timeout = setTimeout(resolve, 100);
    if (typeof requestAnimationFrame !== "function") return;
    requestAnimationFrame(() => requestAnimationFrame(() => {
      clearTimeout(timeout);
      resolve();
    }));
  });
}
