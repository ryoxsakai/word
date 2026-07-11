// 一覧の先頭で下に引っ張ると、上部にインジケーターを出しつつonRefreshを呼ぶ
// シンプルなPull-to-Refresh。
//
// hitArea: touchイベントを監視する要素(この要素の子孫で発生したタッチも対象)
// indicatorEl: 引っ張った分だけ高さが伸びるインジケーター用の要素(あらかじめDOMに用意しておく)
// getScrollTop: 現在のスクロール位置を返す関数。0(先頭)のときだけ引っ張り操作を開始する
// onRefresh: 閾値を超えて指を離したときに呼ぶ非同期関数
// isBlocked: (touchのtarget) => boolean。trueを返すとその指の操作では発火しない
//            (例: 単語行の長押しドラッグ中など、他のタッチ操作と競合する場合に使う)
const PULL_THRESHOLD = 60;
const PULL_MAX = 90;
const PULL_RESISTANCE = 0.5;

export function attachPullToRefresh({ hitArea, indicatorEl, getScrollTop, onRefresh, isBlocked }) {
  let startX = 0;
  let startY = 0;
  let tracking = false; // 縦引っ張りかどうか判定中
  let pulling = false; // 縦引っ張りと確定した
  let refreshing = false;

  function setHeight(px) {
    indicatorEl.style.height = `${px}px`;
  }

  function reset() {
    indicatorEl.classList.remove("ptr-ready");
    setHeight(0);
  }

  hitArea.addEventListener(
    "touchstart",
    (e) => {
      if (refreshing || e.touches.length !== 1) return;
      if (isBlocked && isBlocked(e.target)) return;
      if (getScrollTop() > 0) return;
      startX = e.touches[0].clientX;
      startY = e.touches[0].clientY;
      tracking = true;
      pulling = false;
    },
    { passive: true }
  );

  hitArea.addEventListener(
    "touchmove",
    (e) => {
      if (refreshing || !tracking) return;
      const touch = e.touches[0];
      const dx = touch.clientX - startX;
      const dy = touch.clientY - startY;
      if (!pulling) {
        if (dy <= 4 || Math.abs(dx) > Math.abs(dy)) {
          if (dy < -4 || Math.abs(dx) > 10) tracking = false; // 上スクロール・横スワイプは無視する
          return;
        }
        if (getScrollTop() > 0) {
          tracking = false;
          return;
        }
        pulling = true;
      }
      const dist = Math.max(0, dy) * PULL_RESISTANCE;
      setHeight(Math.min(dist, PULL_MAX));
      indicatorEl.classList.toggle("ptr-ready", dist >= PULL_THRESHOLD);
      e.preventDefault();
    },
    { passive: false }
  );

  async function finishPull() {
    tracking = false;
    if (!pulling) return;
    pulling = false;
    const ready = indicatorEl.classList.contains("ptr-ready");
    if (!ready) {
      reset();
      return;
    }
    refreshing = true;
    indicatorEl.classList.remove("ptr-ready");
    indicatorEl.classList.add("ptr-refreshing");
    setHeight(PULL_THRESHOLD);
    try {
      await onRefresh();
    } finally {
      indicatorEl.classList.remove("ptr-refreshing");
      reset();
      refreshing = false;
    }
  }

  hitArea.addEventListener("touchend", finishPull);
  hitArea.addEventListener("touchcancel", () => {
    tracking = false;
    pulling = false;
    reset();
  });
}
