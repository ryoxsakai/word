import fs from 'node:fs';
import assert from 'node:assert/strict';
const {inferStressedSpellingRange: infer} = await import('data:text/javascript;base64,' + fs.readFileSync(new URL('../../public/shared/spelling-stress.js', import.meta.url)).toString('base64'));
// These calls bypass the verified-word map, including words absent from Groups 1–3.
for (const [word, ipa, expected] of [
  ['beautiful', '/ˈbjuːtɪfəl/', [1,4]],
  ['information', '/ˌɪnfəˈmeɪʃən/', [6,7]],
  ['education', '/ˌedʒuˈkeɪʃən/', [4,5]],
  ['decision', '/dɪˈsɪʒən/', [3,4]],
  ['curious', '/ˈkjʊriəs/', [1,2]],
  ['serious', '/ˈsɪriəs/', [1,2]],
  ['blue', '/bluː/', [2,4]],
  ['yellow', '/ˈjɛləʊ/', null], // Initial consonantal y is not yet aligned.
  ['window', '/ˈwɪndəʊ/', [1,2]],
  ['slow', '/sləʊ/', [2,4]],
  ['lawful', '/ˈlɔːfəl/', [1,3]],
  ['kingdom', '/ˈkɪŋdəm/', [1,2]],
  ['reader', '/ˈriːdɚ/', [1,3]],
  ['nervous', '/ˈnɝvəs/', [1,2]],
  ['silence', '/ˈsaɪləns/', [1,2]],
  ['gentle', '/ˈdʒentl̩/', [1,2]],
  ['linguistic', '/lɪŋˈɡwɪstɪk/', [5,6]],
  ['quantity', '/ˈkwɒntɪti/', [2,3]],
  ['memory', '/ˈmɛm(ə)ri/', [1,2]],
  ['singer', '/ˈsɪŋə(r)/', [1,2]],
  ['record', '/ˈrekɔːd, rɪˈkɔːd/', null],
  ['record', '/rekɔːd/', null],
  ['cruel', '/kruː(ə)l/', null],
  ['prime', '', null], ['<img>', '/ɪm/', null],
  ['word', '/wɜːd/ junk', null], ['a'.repeat(65), '/a/', null],
]) assert.deepEqual(infer(word, ipa), expected, `${word}: ${ipa}`);
// Validate every non-abstaining general prediction independently of overrides.
let correct = 0;
for (const group of ['one', 'two', 'three']) {
  const rows = JSON.parse(fs.readFileSync(new URL(`./group-${group}-stress-fixture.json`, import.meta.url)));
  for (const row of rows) {
    const actual = infer(row.word, row.ipa);
    if (actual) { assert.deepEqual(actual, row.expected, row.word); correct++; }
  }
}
assert.ok(correct >= 340, `General coverage regressed: ${correct}/380`);
console.log(`General alignment: ${correct}/380 correct, remaining words abstained`);
