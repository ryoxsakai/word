// 編集ページの本文の自動リンク：候補を本文ごとに絞っても、単語帳全体で組んだ場合と同じHTMLになり、
// 大きな単語帳でも1回の描画が重くならないことを確かめる。
import assert from 'node:assert/strict';
import test from 'node:test';
import { createAutoCrossRefRenderer, createScopedCrossRefRenderer } from '../../public/shared/markup.js';

const spell = i => { let s = ''; i += 1; while (i) { s = String.fromCharCode(97 + (i % 26)) + s; i = Math.floor(i / 26); } return `w${s}ing`; };

function book(size) {
  const headwords = ['take', 'take off', 'act', 'look', 'Resume', '日本語の見出し', 'pass', 'café'];
  const derivativeReferences = [{ derivative: 'actor', target: 'act' }, { derivative: 'taker', target: 'take' }];
  const phraseReferences = [{ phrase: 'take a bus', target: 'take' }, { phrase: 'look  forward to', target: 'look' }];
  const idiomReferences = ['look after', 'by the way', 'お見通し'];
  for (let i = 0; i < size; i++) {
    headwords.push(spell(i));
    derivativeReferences.push({ derivative: `${spell(i)}er`, target: spell(i) });
    phraseReferences.push({ phrase: `${spell(i)} a ${spell(i + 2)}`, target: spell(i) });
    // 本番のフレーズには「～」や日本語、’ を含むものが多い。
    phraseReferences.push({ phrase: `${spell(i)} one’s ～`, target: spell(i) });
  }
  const opts = { resolve: name => ({ found: true, id: name, no: 1 }), derivativeReferences, phraseReferences, idiomReferences };
  return { headwords, opts };
}

const texts = [
  ['takeとtake offの違い。actorも参照', { currentHeadword: 'act' }],
  ['Take a  bus or LOOK AFTER him', { currentHeadword: 'take', currentPhrases: ['take a bus'] }],
  ['enacted は act を含まない。[[look]] と [[take|取る]]', { currentHeadword: 'look' }],
  ['look forward to と look  forward  to と by the way', { currentHeadword: 'study' }],
  ['wbaing a wbacing、wbaer、お見通し、日本語の見出し', { currentHeadword: 'wbaing' }],
  ['https://example.com/take と (no. 221) take /teɪk/', { currentHeadword: 'new word' }],
  ['resume と Resume', {}],
  ['wbaing one’s ～ と WBAING ONE’S ～、お見通し', { currentHeadword: 'x' }],
  ['paſs と pass、CAFÉ と café', {}],
  ['', {}],
];

test('本文ごとに絞っても、単語帳全体で組んだ場合と同じHTMLになる', () => {
  const { headwords, opts } = book(300);
  const full = createAutoCrossRefRenderer(headwords, opts);
  const scoped = createScopedCrossRefRenderer(headwords, opts);
  for (const [text, context] of texts) {
    assert.equal(scoped(text, context), full(text, context), text);
    // 2回目（キャッシュ済み）も同じ結果。
    assert.equal(scoped(text, context), full(text, context), text);
  }
});

test('大きな単語帳でも、1件ずつの描画が重くならない', () => {
  const { headwords, opts } = book(4000);
  const scoped = createScopedCrossRefRenderer(headwords, opts);
  const started = performance.now();
  for (let i = 0; i < 200; i++) scoped(`メモ ${spell(i + 5)} と ${spell(i + 7)} を比較。${spell(i)} a ${spell(i + 2)}、${spell(i + 1)} one’s ～`, { currentHeadword: spell(i), currentPhrases: [`${spell(i)} a ${spell(i + 2)}`] });
  const elapsed = performance.now() - started;
  // 単語帳全体の正規表現では1件あたり数百ミリ秒かかっていた。
  assert.ok(elapsed < 3000, `200件の描画に${Math.round(elapsed)}msかかりました`);
});
