import { escapeHtml } from '../shared/markup.js';
import { renderStressedSpelling } from '../shared/spelling-stress.js';
import { formatPronunciationWithAccents } from '../shared/pronunciation.js';
import { prepareIllustrationsForPrint } from '../shared/illustrations.js';

// This book has one static master. Never load or mutate the Crossover API.
const SETTINGS_KEY = 'eiken-medical-100:print:v1';
const el = Object.fromEntries(['chapters','chapter','search','paper','images','print','book','status'].map(id => [id, document.getElementById(id)]));
let book;
let preparing = false;
const pageStyle = document.createElement('style');
document.head.append(pageStyle);

function saveSettings() {
  try { localStorage.setItem(SETTINGS_KEY, JSON.stringify({paper:el.paper.value, images:el.images.checked})); } catch { /* Printing works with storage disabled. */ }
}
function applySettings() {
  document.body.classList.toggle('without-images', !el.images.checked);
  pageStyle.textContent = `@page { size: ${el.paper.value === 'a4' ? '210mm 297mm' : '182mm 257mm'}; margin: 12mm 12mm 13mm; }`;
  saveSettings();
}
function headword(w) {
  // Explicit, editorially reviewed vowel spans are book-local.
  if (w.stressRanges?.length) {
    let result = '', cursor = 0;
    for (const [start,end] of w.stressRanges) {
      result += escapeHtml(w.spelling.slice(cursor,start)) + `<span class="spelling-stress">${escapeHtml(w.spelling.slice(start,end))}</span>`;
      cursor = end;
    }
    return result + escapeHtml(w.spelling.slice(cursor));
  }
  return renderStressedSpelling(w.spelling, w.pronunciation, escapeHtml);
}
function entry(w) {
  const illustration = w.illustration?.path ? `<figure class="entry-illustration"><img src="${escapeHtml(w.illustration.path)}" width="1024" height="1024" alt="${escapeHtml(w.illustration.alt)}" decoding="async"></figure>` : '';
  return `<article class="entry" id="${escapeHtml(w.id)}" data-number="${w.number}">
    <div class="number">${String(w.number).padStart(3,'0')}</div>
    <div class="entry-body"><div class="entry-head"><h3 lang="en">${headword(w)}</h3><span class="pron" lang="en">${escapeHtml(formatPronunciationWithAccents(w.pronunciation))}</span>${w.pronunciationNote ? `<span class="pron-note">${escapeHtml(w.pronunciationNote)}</span>`:''}</div>
    <div class="meaning"><span class="pos">${escapeHtml(w.pos)}</span>${escapeHtml(w.meaning)}</div>
    <p class="example" lang="en">${escapeHtml(w.example)}</p><p class="translation">${escapeHtml(w.translation)}</p>
    <p class="memo"><span>メモ</span>${escapeHtml(w.notes)}</p></div>${illustration}</article>`;
}
function render() {
  const query = el.search.value.trim().toLocaleLowerCase();
  const entries = book.entries.filter(w => (el.chapter.value === 'all' || String(w.chapter) === el.chapter.value) && (!query || [w.spelling,w.meaning,w.example,w.translation,w.notes].join(' ').toLocaleLowerCase().includes(query)));
  el.book.innerHTML = book.chapters.map(c => {
    const words = entries.filter(w => w.chapter === c.id);
    if (!words.length) return '';
    const sheets = [];
    for (let offset=0; offset<words.length; offset+=5) {
      sheets.push(`<section class="print-sheet"><header class="chapter-heading${offset ? ' continuation' : ''}"><p>対象：${escapeHtml(c.target)}</p><h2><span>Chapter ${c.id}</span> ${escapeHtml(c.title)}</h2></header><div class="entries">${words.slice(offset,offset+5).map(entry).join('')}</div></section>`);
    }
    return `<section class="chapter chapter-${c.id}" id="chapter-${c.id}">${sheets.join('')}</section>`;
  }).join('');
  el.status.textContent = entries.length ? `${entries.length}項目を表示` : '該当する項目がありません。検索語や章を変更してください。';
  el.print.disabled = !entries.length;
}
async function printBook() {
  if (preparing) return;
  preparing = true;
  el.print.disabled = true;
  el.status.textContent = '印刷の準備をしています…';
  try {
    await document.fonts.ready;
    if (el.images.checked) await prepareIllustrationsForPrint(el.book);
    el.status.textContent = '印刷の準備ができました。';
    window.print();
  } catch {
    el.status.textContent = '画像を読み込めませんでした。再読み込みするか、イラストをオフにして印刷してください。';
  } finally { preparing = false; el.print.disabled = false; }
}
try {
  const settings = JSON.parse(localStorage.getItem(SETTINGS_KEY) || 'null');
  if (settings?.paper === 'a4') el.paper.value = 'a4';
  if (typeof settings?.images === 'boolean') el.images.checked = settings.images;
} catch { /* Default settings remain available. */ }
applySettings();
el.paper.addEventListener('change', applySettings);
el.images.addEventListener('change', applySettings);
el.print.addEventListener('click', printBook);
try {
  const response = await fetch('./data.json');
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  book = await response.json();
  if (book.id !== 'eiken-medical-100' || book.entries.length !== 100) throw new Error('Unexpected book');
  el.chapter.innerHTML += book.chapters.map(c => `<option value="${c.id}">Chapter ${c.id} ${escapeHtml(c.title)}</option>`).join('');
  el.chapters.innerHTML = book.chapters.map(c => `<a href="#chapter-${c.id}" data-chapter="${c.id}"><small>対象：${escapeHtml(c.target)}</small><strong>Chapter ${c.id}</strong><span>${escapeHtml(c.title)}</span></a>`).join('');
  const chapterParam = new URLSearchParams(location.search).get('chapter');
  if (book.chapters.some(c=>String(c.id)===chapterParam)) el.chapter.value=chapterParam;
  el.chapter.addEventListener('change',render);
  el.search.addEventListener('input',render);
  el.chapters.addEventListener('click',event=>{
    const link=event.target.closest('[data-chapter]');
    if(!link)return;
    el.chapter.value='all'; el.search.value=''; render();
  });
  render();
  document.documentElement.dataset.bookReady='true';
} catch (error) {
  el.status.textContent='単語帳を読み込めませんでした。ページを再読み込みしてください。';
  console.error('Medical book failed to load',error);
}
