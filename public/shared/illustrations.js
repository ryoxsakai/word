const escape = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

export function renderWordIllustration(word, origin) {
  const illustration = word.illustration;
  if (!illustration?.url || !/^\/mcp-viewer\/api\/(?:illustrations|idiom-illustrations)\/[^/]+\/[a-f0-9-]+\.png$/i.test(illustration.url)) return '';
  const url = new URL(illustration.url, origin).href;
  return `<figure class="entry-illustration is-loading"><span class="illustration-placeholder" aria-hidden="true">画像を読み込み中</span><img data-illustration-src="${escape(url)}" alt="${escape(word.spelling)}：${escape(illustration.meaning)}のイラスト" width="1024" height="1024" loading="lazy" decoding="async" fetchpriority="low"></figure>`;
}

export async function prepareIllustrationsForPrint(root) {
  await Promise.all([...root.querySelectorAll('.entry-illustration img')].map(async img => {
    startIllustration(img);
    img.loading = 'eager';
    if (typeof img.decode === 'function') await img.decode();
    finishIllustration(img, true);
  }));
}

function finishIllustration(img, success) {
  const figure = img.closest?.('.entry-illustration');
  if (!figure) return;
  figure.classList.remove('is-loading');
  figure.classList.toggle('is-error', !success);
  const placeholder = figure.querySelector('.illustration-placeholder');
  if (placeholder) placeholder.textContent = success ? '' : '画像を読み込めませんでした';
}

export function startIllustration(img) {
  const url = img.getAttribute?.('data-illustration-src');
  if (!url) return;
  img.addEventListener('load', () => finishIllustration(img, true), { once: true });
  img.addEventListener('error', () => finishIllustration(img, false), { once: true });
  img.removeAttribute('data-illustration-src');
  img.src = url;
  if (img.complete && img.naturalWidth > 0) finishIllustration(img, true);
}

// Defer assigning src until the text has had a chance to paint. Only nearby
// illustrations are requested; dynamically rendered words and idioms share this path.
export function setupIllustrationLoading(root) {
  const selector = 'img[data-illustration-src]';
  const observed = new WeakSet();
  const intersection = typeof IntersectionObserver === 'function' ? new IntersectionObserver(entries => {
    for (const entry of entries) if (entry.isIntersecting) {
      intersection.unobserve(entry.target);
      startIllustration(entry.target);
    }
  }, { rootMargin: '300px' }) : null;
  const pending = new Set();
  let scheduled = false;
  const flush = () => {
    scheduled = false;
    for (const node of pending) {
      if (!node.isConnected) continue;
      const images = [...(node.matches?.(selector) ? [node] : []), ...(node.querySelectorAll?.(selector) || [])];
      for (const img of images) {
        if (observed.has(img)) continue;
        observed.add(img);
        if (intersection) intersection.observe(img);
        else startIllustration(img);
      }
    }
    pending.clear();
  };
  const enqueue = node => {
    pending.add(node);
    if (scheduled) return;
    scheduled = true;
    let finished = false;
    const run = () => { if (!finished) { finished = true; clearTimeout(timer); flush(); } };
    const timer = setTimeout(run, 150);
    if (typeof requestAnimationFrame === 'function') requestAnimationFrame(() => requestAnimationFrame(run));
  };
  const mutations = new MutationObserver(records => {
    for (const record of records) for (const node of record.addedNodes) if (node.nodeType === 1) enqueue(node);
  });
  mutations.observe(root, { childList: true, subtree: true });
  enqueue(root);
}
