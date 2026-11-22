// 閲覧ページ（viewer/app.js の prepareNavigationSection・scrollToNavigationTarget）と同じ手順で移動する。
// 1. 移動中は先読みを止め、途中のSectionや画像を読み込まない。
// 2. 移動先と、その直前の画面1枚分ほどのSectionだけを読み込む（後から展開されて位置がずれるのを防ぐ）。
// 3. それらを実寸で確定してから合わせ、通常の描画に戻して最終位置を合わせ直す。
const frame = () => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
const PRELOAD_MARGIN = 1000;

export function createNavigator() {
  let generation = 0;
  return async function navigate({ sections, targetKey, load, groupOf, target, pause, resume, block = "start", onArrive }) {
    const current = ++generation;
    const alive = () => current === generation;
    pause?.();
    const anchors = [];
    try {
      const index = sections.findIndex(section => String(section.key) === String(targetKey));
      const keys = [String(targetKey)];
      let distance = 0;
      for (let i = index - 1; i >= 0 && distance < PRELOAD_MARGIN + innerHeight / 2; i -= 1) {
        keys.unshift(String(sections[i].key));
        distance += Math.min(900, Math.max(160, Number(sections[i].count || 0) * 44));
      }
      const results = await Promise.allSettled(keys.map(key => load(key)));
      const failure = results.find(result => result.status === "rejected");
      if (failure) throw failure.reason;
      if (!alive()) return false;
      for (const key of keys) {
        const group = groupOf(key);
        if (group) { group.classList.add("is-navigation-anchor"); anchors.push(group); }
      }
      await frame();
      if (!alive()) return false;
      let element = target();
      if (!element) return false;
      element.scrollIntoView({ behavior: "auto", block });
      await frame();
      if (!alive()) return false;
      target()?.scrollIntoView({ behavior: "auto", block });
      for (const group of anchors) group.classList.remove("is-navigation-anchor");
      anchors.length = 0;
      await frame();
      if (!alive()) return false;
      element = target();
      element?.scrollIntoView({ behavior: "auto", block });
      onArrive?.(element);
      return true;
    } finally {
      for (const group of anchors) group.classList.remove("is-navigation-anchor");
      if (alive()) resume?.();
    }
  };
}
