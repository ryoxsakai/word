import fs from 'node:fs';
import assert from 'node:assert/strict';
const { stressedSpellingRange: range, renderStressedSpelling: render } = await import(
  'data:text/javascript;base64,' + fs.readFileSync(new URL('../../public/shared/spelling-stress.js', import.meta.url)).toString('base64')
);
for (const [word, ipa, expected] of [
  ['fundamental', '/ˌfʌn.dəˈmen.təl/', [6, 7]],
  ['fundamental', '/ˌfʌndəˈmɛntəl/', [6, 7]],
  ['prime', '/pɹaɪ̯m/', [2, 3]], ['important', '/ɪmˈpɔːtənt/', [3, 4]],
  ['teacher', '/ˈtiːtʃə/', [1, 3]], ['about', '/əˈbaʊt/', [2, 4]],
  ['make', '/meɪk/', [1, 2]], ['beautiful', '/ˈbjuːtɪfəl/', null],
  ['record', '/ˈrekɔːd, rɪˈkɔːd/', null], ['prime', '', null],
  ['record', '/rekɔːd/', null], ['information', '/ˌɪnfəˈmeɪʃən/', null],
]) assert.deepEqual(range(word, ipa), expected, word);
const escape = text => text.replaceAll('<', '&lt;').replaceAll('>', '&gt;');
assert.equal(render('prime', '/pɹaɪ̯m/', escape), 'pr<span class="spelling-stress">i</span>me');
assert.equal(render('fundamental', '/ˌfʌn.dəˈmen.təl/', escape), 'fundam<span class="spelling-stress">e</span>ntal');
assert.equal(render('<img>', '/ɪm/', escape), '&lt;img&gt;');
console.log('Spelling stress integration tests passed');

// Regression cases retrieved from Section 1; assert the complete rendered word.
for (const [word, ipa, before, vowel, after] of [
  ['pure', '/ˈpjɔː/', 'p', 'u', 're'],
  ['subtle', '/ˈsʌt(ə)l/', 's', 'u', 'btle'],
  ['rare', '/rer/', 'r', 'a', 're'],
  ['minor', '/ˈmaɪnɚ/', 'm', 'i', 'nor'],
  ['obvious', '/ˈɒ.vɪəs/', '', 'o', 'bvious'],
  ['extraordinary', '/ɪksˈtɹɔː(ɹ)dɪnəɹi/', 'extra', 'o', 'rdinary'],
  ['enormous', '/ɪˈnɔː(ɹ)məs/', 'en', 'o', 'rmous'],
]) {
  assert.equal(render(word, ipa, escape), `${before}<span class="spelling-stress">${vowel}</span>${after}`, word);
}
assert.deepEqual(range('PURE', '/ˈpjɔː/'), [1, 2]);
assert.equal(range('extraordinary', '/unknown/'), null);
assert.equal(range('subtle', ''), null);
console.log('Section 1 stress regressions passed');
