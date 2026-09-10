import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const html = readFileSync(new URL('../../public/setting/idioms.html', import.meta.url), 'utf8');
const js = readFileSync(new URL('../../public/setting/idioms.js', import.meta.url), 'utf8');
const css = readFileSync(new URL('../../public/setting/style.css', import.meta.url), 'utf8');

assert.match(html, /id="themeToggleBtn"/);
assert.match(html, /id="themeColor"/);
assert.match(html, /localStorage\.getItem\("vocab-setting-theme"\)/, 'theme is restored before CSS to prevent a light-mode flash');
assert.match(js, /const THEME_KEY = 'vocab-setting-theme'/, 'word and idiom editors share the theme preference');
assert.match(js, /localStorage\.setItem\(THEME_KEY,next\)/);
assert.match(js, /aria-pressed/);
assert.match(js, /prefers-color-scheme: dark/);
assert.match(css, /:root\[data-theme="dark"\]/);
assert.match(css, /:root:not\(\[data-theme="light"\]\)/, 'OS dark mode remains supported without an explicit preference');

console.log('Idiom editor light/dark theme toggle and persistence passed');
