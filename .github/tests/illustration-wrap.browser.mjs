import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { renderWordEntry } from '../../public/viewer/word-entry.js';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const css = await readFile(process.env.CSS_FILE || new URL('../../public/viewer/style.css', import.meta.url), 'utf8');
const app = await readFile(new URL('../../public/viewer/app.js', import.meta.url), 'utf8');
const printFlow = app.slice(app.indexOf('function preparePrintIllustrationWrapping('), app.indexOf('function prepareLightweightPrintDom('));
const context = { resolveRef: () => ({ found: false }), resolveHeadwordRef: () => ({ found: false }), renderNotesMarkup: text => text, origin: 'https://vocab.lrnr.jp' };
const image = { url: '/mcp-viewer/api/illustrations/exist/11111111-1111-1111-1111-111111111111.png', meaning: '存在' };
const base = { id: 'exist', seqNo: 2, spelling: 'exist', senses: [{ pos: '自', meaning: '存在する', isPrimary: true }], derivatives: [{ word: 'existence', pos: '名', meaning: '存在' }], synonyms: 'survive, be', relatedWords: 'present', etymology: 'ex(外へ)+sist(立つ)' };
const browser = await chromium.launch({ ...(process.env.BROWSER_EXECUTABLE ? { executablePath: process.env.BROWSER_EXECUTABLE } : {}) });
let checked = 0;
try {
  for (const width of [320, 393, 600, 1024]) for (const scale of [1, 1.5]) for (const mode of ['screen', 'section', 'standard', 'compact']) {
    const page = await browser.newPage({ viewport: { width, height: 1400 } });
    const words = [
      { ...base, illustration: image, examples: [{ type: 'phrase', sentence: 'exist in A', translation: 'Aに存在する' }] },
      { ...base, id: 'matter', spelling: 'matter', illustration: image, examples: Array.from({ length: 6 }, (_, i) => ({ type: 'phrase', sentence: i ? 'no matter what SV' : 'it does not matter what SV', translation: 'Sが何をしてもかまわない' })) },
      { ...base, id: 'plain', examples: [{ type: 'phrase', sentence: 'exist in A', translation: 'Aに存在する' }] },
      { ...base, id: 'long', illustration: image, derivatives: [{ word: 'verylongderivative'.repeat(5), pos: '名', meaning: '長い派生語の意味'.repeat(5) }] },
    ];
    await page.setContent(`<style>${css}</style><body data-print-pagination="${mode}" style="--font-scale:${scale}"><main class="word-list">${words.map(w => renderWordEntry(w, context)).join('')}</main></body>`);
    if (mode !== 'screen') {
      await page.emulateMedia({ media: 'print' });
      await page.evaluate('(() => {\n' + printFlow + '\nconst el={printExampleColumns:{value:2}}; const boundedIntegerPrintSetting=()=>2; preparePrintIllustrationWrapping(); preparePrintEntryFlow();\n})()');
    }
    const result = await page.evaluate(() => {
      const errors = [];
      for (const entry of document.querySelectorAll('.entry')) {
        const figure = entry.querySelector('.entry-illustration');
        if (!figure) continue;
        const img = figure.getBoundingClientRect();
        const walk = document.createTreeWalker(entry, NodeFilter.SHOW_TEXT);
        while (walk.nextNode()) {
          const node = walk.currentNode;
          if (!node.textContent.trim() || figure.contains(node)) continue;
          const range = document.createRange(); range.selectNodeContents(node);
          for (const r of range.getClientRects()) if (r.width && r.height && r.left < img.right - 1 && r.right > img.left + 1 && r.top < img.bottom - 1 && r.bottom > img.top + 1) errors.push(`${entry.id}: image/text overlap`);
        }
      }
      const exist = document.querySelector('#word-exist');
      const derivative = exist.querySelector('.notes-derivative').getBoundingClientRect();
      const img = exist.querySelector('figure').getBoundingClientRect();
      const last = document.querySelector('#word-matter .example-line:last-child').getBoundingClientRect();
      const first = document.querySelector('#word-matter .example-line').getBoundingClientRect();
      return { errors, derivativeTop: derivative.top, imageBottom: img.bottom, firstWidth: first.width, lastWidth: last.width, overflow: document.documentElement.scrollWidth > innerWidth };
    });
    assert.deepEqual(result.errors, [], `${width}/${scale}/${mode}`);
    assert.equal(result.overflow, false, `${width}/${scale}/${mode}: horizontal overflow`);
    // At normal mobile size, short entries must use the space alongside the image.
    if (width === 393 && scale === 1) assert.ok(result.derivativeTop < result.imageBottom, `${mode}: derivative cleared below image`);
    if (mode === 'screen') assert.ok(result.lastWidth > result.firstWidth, `${width}/${scale}: later phrases regain full width`);
    if (process.env.SCREENSHOT_PATH && width === 393 && scale === 1 && mode === 'screen') await page.screenshot({ path: process.env.SCREENSHOT_PATH, fullPage: true });
    await page.close(); checked++;
  }
  console.log(`Illustration wrapping: ${checked} viewport/font/print combinations passed (real renderer and print preparation).`);
} finally { await browser.close(); }
