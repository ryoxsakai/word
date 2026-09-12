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
  ['make', '/meɪk/', [1, 2]], ['beautiful', '/ˈbjuːtɪfəl/', [1, 4]],
  ['record', '/ˈrekɔːd, rɪˈkɔːd/', null], ['prime', '', null],
  ['record', '/rekɔːd/', null], ['information', '/ˌɪnfəˈmeɪʃən/', [6, 7]],
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

// Independently reviewed primary-stress spans for all 100 Group 1 headwords.
const groupOne = JSON.parse(fs.readFileSync(new URL('./group-one-stress-fixture.json', import.meta.url)));
assert.equal(groupOne.length, 100);
assert.equal(new Set(groupOne.map(w => w.word)).size, 100);
for (let section = 1; section <= 5; section++) {
  assert.equal(groupOne.filter(w => w.section === section).length, 20);
}
for (const {word, ipa, expected} of groupOne) {
  assert.deepEqual(range(word, ipa), expected, word);
  const [start, end] = expected;
  assert.equal(render(word, ipa, escape), word.slice(0, start) + '<span class="spelling-stress">' + word.slice(start, end) + '</span>' + word.slice(end), word);
}
console.log('Group 1: all 100 primary-stress spans and HTML outputs passed');

// Group 2: independently reviewed ranges, including corrected live readings.
const groupTwo = JSON.parse(fs.readFileSync(new URL('./group-two-stress-fixture.json', import.meta.url)));
assert.equal(groupTwo.length, 140);
assert.equal(new Set(groupTwo.map(w => w.word)).size, 140);
for (let section = 6; section <= 12; section++) {
  assert.equal(groupTwo.filter(w => w.section === section).length, 20);
}
for (const {word, ipa, expected} of groupTwo) {
  assert.deepEqual(range(word, ipa), expected, word);
  const [start, end] = expected;
  assert.equal(render(word, ipa, escape), word.slice(0, start) + '<span class="spelling-stress">' + word.slice(start, end) + '</span>' + word.slice(end), word);
}
assert.deepEqual(range('conduct', '/ˈkɒndʌkt/'), [1, 2]); // Noun remains distinct.
console.log('Group 2: all 140 primary-stress spans and HTML outputs passed');

// Group 3: all headwords checked against their registered primary readings.
const groupThree = JSON.parse(fs.readFileSync(new URL('./group-three-stress-fixture.json', import.meta.url)));
assert.equal(groupThree.length, 140);
assert.equal(new Set(groupThree.map(w => w.word)).size, 140);
for (let section = 13; section <= 19; section++) {
  assert.equal(groupThree.filter(w => w.section === section).length, 20);
}
for (const {word, ipa, expected} of groupThree) {
  assert.deepEqual(range(word, ipa), expected, word);
  const [start, end] = expected;
  assert.equal(render(word, ipa, escape), word.slice(0, start) + '<span class="spelling-stress">' + word.slice(start, end) + '</span>' + word.slice(end), word);
}
console.log('Group 3: all 140 primary-stress spans and HTML outputs passed');

for (const [group, count, first, last] of [['four', 120, 20, 25], ['five', 180, 26, 34]]) {
  const rows = JSON.parse(fs.readFileSync(new URL(`./group-${group}-stress-fixture.json`, import.meta.url)));
  assert.equal(rows.length, count);
  assert.equal(new Set(rows.map(row => row.word)).size, count);
  for (let section = first; section <= last; section++) assert.equal(rows.filter(row => row.section === section).length, 20);
  for (const {word, ipa, expected: [start, end]} of rows) {
    assert.deepEqual(range(word, ipa), [start, end], word);
    assert.equal(render(word, ipa, escape), word.slice(0, start) + '<span class="spelling-stress">' + word.slice(start, end) + '</span>' + word.slice(end), word);
  }
  console.log(`Group ${group}: all ${count} primary-stress spans and HTML outputs passed`);
}
