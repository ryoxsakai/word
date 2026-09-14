import fs from 'node:fs';
import assert from 'node:assert/strict';
const {inferStressedSpellingRange: infer} = await import('data:text/javascript;base64,' + fs.readFileSync(new URL('../../public/shared/spelling-stress.js', import.meta.url)).toString('base64'));
// Exercise the common algorithm directly, including words absent from the audited groups.
for (const [word, ipa, expected] of [
  ['awkwardly', '/ˈɔːkwədli/', [0,2]],
  ['mutually', '/ˈmjuːtʃʊli/', [1,2]],
  ['renew', '/rɪˈnjuː/', [3,5]],
  ['deceive', '/dɪˈsiːv/', [3,5]],
  ['create', '/kɹiˈeɪt/', [3,4]],
  ['temporary', '/ˈtɛmpəɹi/', [1,2]],
  ['ordinary', '/ˈɔːdənɹi/', [0,1]],
  ['literacy', '/ˈlɪt.ɹə.si/', [1,2]],
  ['laboratory', '/ləˈbɒr.ə.tri/', [3,4]],
  ['fierce', '/fɪəs/', [1,3]],
  ['pierce', '/pɪəs/', [1,3]],
  ['near', '/nɪə/', [1,3]],
  ['dear', '/dɪə/', [1,3]],
  ['cruel', '/kɹuː(ə)l/', [2,3]],
  ['cruel', '/kɹuːəl/', null],
  ['idea', '/aɪˈdiː.ə/', [2,3]],
  ['negative', '/ˈneɡ.ə.tɪv/', [1,2]],
  ['temporary', '/tempəri/', null],
  ['ordinary', '/ˈɔːdɪˈnəri/', null],
  ['pure', '/pjɔː/', [1,2]],
  ['pure', '/pjʊə/', [1,2]],
  ['pure', '/ˈpjɔː/', [1,2]],
  ['cure', '/kjʊə/', [1,2]],
  ['care', '/keə/', [1,2]],
  ['spare', '/spɛə/', [2,3]],
  ['scare', '/skɛə/', [2,3]],
  ['rare', '/rer/', [1,2]],
  ['repair', '/rɪˈper/', [3,5]],
  ['disguise', '/dɪsˈɡaɪz/', [5,6]],
  ['guide', '/ɡaɪd/', [2,3]],
  ['vaguely', '/ˈveɪɡli/', null],
  ['mechanism', '/ˈmekənɪzəm/', [1,2]],
  ['efficient', '/əˈfɪʃənt/', [3,4]],
  ['statement', '/ˈsteɪtm(ə)nt/', [2,3]],
  ['widespread', '/ˈwaɪd.spred/', [1,2]],
  ['worthwhile', '/ˌwɜːrθˈwaɪl/', [7,8]],
  ['concrete', '/kɵnˈkɹiːt/', [5,6]],
  ['pure', '/pjɔː, pjʊə/', null],
  ['pure', null, null],
  ['care', '/keə.re/', null],
  ['beautiful', '/ˈbjuːtɪfəl/', [1,4]],
  ['information', '/ˌɪnfəˈmeɪʃən/', [6,7]],
  ['education', '/ˌedʒuˈkeɪʃən/', [4,5]],
  ['decision', '/dɪˈsɪʒən/', [3,4]],
  ['curious', '/ˈkjʊriəs/', [1,2]],
  ['serious', '/ˈsɪriəs/', [1,2]],
  ['blue', '/bluː/', [2,4]],
  ['yellow', '/ˈjɛləʊ/', [1,2]],
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
  ['cruel', '/kruː(ə)l/', [2,3]],
  ['prime', '', null], ['<img>', '/ɪm/', null],
  ['word', '/wɜːd/ junk', null], ['a'.repeat(65), '/a/', null],
]) assert.deepEqual(infer(word, ipa), expected, `${word}: ${ipa}`);
// Require complete coverage and correct spans across all five audited groups.
let correct = 0;
for (const group of ['one', 'two', 'three', 'four', 'five']) {
  const rows = JSON.parse(fs.readFileSync(new URL(`./group-${group}-stress-fixture.json`, import.meta.url)));
  for (const row of rows) {
    const actual = infer(row.word, row.ipa);
    if (actual) { assert.deepEqual(actual, row.expected, row.word); correct++; }
  }
}
assert.ok(correct === 680, `General coverage regressed: ${correct}/680`);
console.log(`General alignment: ${correct}/680 correct, remaining words abstained`);

// Live Crossover readings retrieved 2026-09-14; primary vowel spans reviewed.
for (const [word, ipa, expected] of [
  ["discover", "/dɪsˈkʊvə/", [4, 5]],
  ["love", "/lʊv/", [1, 2]],
  ["overwhelm", "/ˌovɚˈʍɛlm/", [6, 7]],
  ["comfort", "/ˈkʊm.fət/", [1, 2]],
  ["involved", "/ɪnˈvɒlvd/", [3, 4]],
  ["convinced", "/kənˈvɪnst/", [4, 5]],
  ["yet", "/jet/", [1, 2]],
  ["board", "/bɔːd/", [1, 3]],
  ["used", "/juːzd/", [0, 1]],
  ["emerge", "/iˈmɜːd͡ʒ/", [2, 3]],
  ["yield", "/jild/", [1, 3]],
  ["accustomed", "/əˈkəstəmd/", [3, 4]],
  ["short", "/ʃoːt/", [2, 3]],
  ["useful", "/ˈjuːsfəl/", [0, 1]],
  ["destined", "/ˈdɛstɪnd/", [1, 2]],
  ["skilled", "/skɪld/", [2, 3]],
  ["detached", "/dɪˈtætʃt/", [3, 4]],
  ["disturbed", "/dɪˈstəɹbd/", [4, 5]],
  ["astonished", "/əˈstɑnɪʃt/", [3, 4]],
  ["overwhelmed", "/ˌoʊvəɹˈwɛlmd/", [6, 7]],
  ["impressed", "/ɪmˈpɹɛst/", [4, 5]],
  ["diverse", "/daɪˈvɜːrs/", [3, 4]],
  ["largely", "/ˈlɑːrdʒli/", [1, 2]],
  ["relatively", "/ˈrelətɪvli/", [1, 2]],
  ["approximately", "/əˈprɒksɪmətli/", [4, 5]],
  ["definitely", "/ˈdefɪnətli/", [1, 2]],
  ["roar", "/rɔː/", [1, 3]],
  ["yell", "/jel/", [1, 2]],
  ["broadcast", "/ˈbrɔːdkæst/", [2, 4]],
  ["yearn", "/jɜːrn/", [1, 3]],
  ["soar", "/sɔː/", [1, 3]],
  ["neutral", "/ˈnjuːtɹəl/", [1, 3]],
  ["leukemia", "/luːˈkiː.mi.ə/", [4, 5]],
  ["pneumonia", "/njuːˈməʊ.ni.ə/", [5, 6]],
]) assert.deepEqual(infer(word, ipa), expected, `${word}: ${ipa}`);

// Standard readings and guard cases exercise the same rules beyond the live data.
for (const [word, ipa, expected] of [
  ['overwhelm', '/ˌəʊ.vəˈwelm/', [6,7]],
  ['overwhelm', '/ˌoʊ.vɚˈwelm/', [6,7]],
  ['comfort', '/ˈkʌmfət/', [1,2]],
  ['comfort', '/kʊmfət/', null],
  ['overwhelm', '/ovɚʍɛlm/', null],
  ['exceed', '/ɪkˈsiːd/', [3,5]],
  ['needed', '/ˈniːdɪd/', [1,3]],
  ['yell', '/el/', null],
  ['record', '/ˈrekɔːd, rɪˈkɔːd/', null],
]) assert.deepEqual(infer(word, ipa), expected, `${word}: ${ipa}`);
console.log('Expanded mechanical stress rules and abstention guards passed');
