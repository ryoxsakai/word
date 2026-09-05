const escape = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

export function renderWordIllustration(word, origin) {
  const illustration = word.illustration;
  if (!illustration?.url || !/^\/mcp-viewer\/api\/illustrations\/[^/]+\/[a-f0-9-]+\.png$/i.test(illustration.url)) return '';
  const url = new URL(illustration.url, origin).href;
  return `<figure class="entry-illustration"><img src="${escape(url)}" alt="${escape(word.spelling)}：${escape(illustration.meaning)}のイラスト" width="1024" height="1024" loading="lazy" decoding="async"></figure>`;
}

export async function prepareIllustrationsForPrint(root) {
  await Promise.all([...root.querySelectorAll('.entry-illustration img')].map(async img => {
    img.loading = 'eager';
    if (typeof img.decode === 'function') await img.decode();
  }));
}
