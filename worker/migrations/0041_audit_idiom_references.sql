-- Reviewed semantic references; preserve original links, meanings and word data.
-- Guard against concurrent edits and references outside this notebook.

-- look into O -> investigate
INSERT OR IGNORE INTO idiom_word_refs (sense_id, word_id, source)
SELECT s.id, w.id, 'synonym'
FROM idiom_senses s JOIN idioms i ON i.id=s.idiom_id
JOIN list_items li ON li.list_id=i.list_id JOIN words w ON w.id=li.word_id
WHERE i.list_id='crossover-v3' AND i.id='crossover-idiom-3894de95e4b40508a1cbbf5a'
  AND i.phrase='look into O' AND s.id='crossover-idiom-3894de95e4b40508a1cbbf5a:0'
  AND s.meaning='Oを調べる'
  AND w.id='investigate' AND w.spelling='investigate';

-- look over O -> examine
INSERT OR IGNORE INTO idiom_word_refs (sense_id, word_id, source)
SELECT s.id, w.id, 'synonym'
FROM idiom_senses s JOIN idioms i ON i.id=s.idiom_id
JOIN list_items li ON li.list_id=i.list_id JOIN words w ON w.id=li.word_id
WHERE i.list_id='crossover-v3' AND i.id='crossover-idiom-71ce3e5c2ad6539bd7578c0c'
  AND i.phrase='look over O' AND s.id='crossover-idiom-71ce3e5c2ad6539bd7578c0c:0'
  AND s.meaning='Oをざっと調べる'
  AND w.id='examine' AND w.spelling='examine';

-- look up to O -> respect
INSERT OR IGNORE INTO idiom_word_refs (sense_id, word_id, source)
SELECT s.id, w.id, 'synonym'
FROM idiom_senses s JOIN idioms i ON i.id=s.idiom_id
JOIN list_items li ON li.list_id=i.list_id JOIN words w ON w.id=li.word_id
WHERE i.list_id='crossover-v3' AND i.id='crossover-idiom-cbee51b4c4c20f11d2447c05'
  AND i.phrase='look up to O' AND s.id='crossover-idiom-cbee51b4c4c20f11d2447c05:0'
  AND s.meaning='Oを尊敬する'
  AND w.id='respect' AND w.spelling='respect';

-- look up to O -> admire
INSERT OR IGNORE INTO idiom_word_refs (sense_id, word_id, source)
SELECT s.id, w.id, 'synonym'
FROM idiom_senses s JOIN idioms i ON i.id=s.idiom_id
JOIN list_items li ON li.list_id=i.list_id JOIN words w ON w.id=li.word_id
WHERE i.list_id='crossover-v3' AND i.id='crossover-idiom-cbee51b4c4c20f11d2447c05'
  AND i.phrase='look up to O' AND s.id='crossover-idiom-cbee51b4c4c20f11d2447c05:0'
  AND s.meaning='Oを尊敬する'
  AND w.id='admire' AND w.spelling='admire';

-- look down on O -> despise
INSERT OR IGNORE INTO idiom_word_refs (sense_id, word_id, source)
SELECT s.id, w.id, 'synonym'
FROM idiom_senses s JOIN idioms i ON i.id=s.idiom_id
JOIN list_items li ON li.list_id=i.list_id JOIN words w ON w.id=li.word_id
WHERE i.list_id='crossover-v3' AND i.id='crossover-idiom-70c10134538ee1758c4efbcb'
  AND i.phrase='look down on O' AND s.id='crossover-idiom-70c10134538ee1758c4efbcb:0'
  AND s.meaning='Oを見下す'
  AND w.id='despise' AND w.spelling='despise';

-- look back on / upon / to O -> recall
INSERT OR IGNORE INTO idiom_word_refs (sense_id, word_id, source)
SELECT s.id, w.id, 'synonym'
FROM idiom_senses s JOIN idioms i ON i.id=s.idiom_id
JOIN list_items li ON li.list_id=i.list_id JOIN words w ON w.id=li.word_id
WHERE i.list_id='crossover-v3' AND i.id='crossover-idiom-39256c6fbe44d86247533759'
  AND i.phrase='look back on / upon / to O' AND s.id='crossover-idiom-39256c6fbe44d86247533759:r39-d23e08c57deb'
  AND s.meaning='Oを回顧・回想する'
  AND w.id='recall' AND w.spelling='recall';

-- look on / upon A as B -> regard
INSERT OR IGNORE INTO idiom_word_refs (sense_id, word_id, source)
SELECT s.id, w.id, 'synonym'
FROM idiom_senses s JOIN idioms i ON i.id=s.idiom_id
JOIN list_items li ON li.list_id=i.list_id JOIN words w ON w.id=li.word_id
WHERE i.list_id='crossover-v3' AND i.id='crossover-idiom-662e412485a34fade113fd14'
  AND i.phrase='look on / upon A as B' AND s.id='crossover-idiom-662e412485a34fade113fd14:0'
  AND s.meaning='AをBと見なす'
  AND w.id='regard' AND w.spelling='regard';

-- look after O -> care
INSERT OR IGNORE INTO idiom_word_refs (sense_id, word_id, source)
SELECT s.id, w.id, 'synonym'
FROM idiom_senses s JOIN idioms i ON i.id=s.idiom_id
JOIN list_items li ON li.list_id=i.list_id JOIN words w ON w.id=li.word_id
WHERE i.list_id='crossover-v3' AND i.id='crossover-idiom-88498905d79d1b59389ac1dc'
  AND i.phrase='look after O' AND s.id='crossover-idiom-88498905d79d1b59389ac1dc:0'
  AND s.meaning='Oの世話をする'
  AND w.id='care' AND w.spelling='care';

-- look for O -> seek
INSERT OR IGNORE INTO idiom_word_refs (sense_id, word_id, source)
SELECT s.id, w.id, 'synonym'
FROM idiom_senses s JOIN idioms i ON i.id=s.idiom_id
JOIN list_items li ON li.list_id=i.list_id JOIN words w ON w.id=li.word_id
WHERE i.list_id='crossover-v3' AND i.id='crossover-idiom-dc9a72140fd3b18fa76de667'
  AND i.phrase='look for O' AND s.id='crossover-idiom-dc9a72140fd3b18fa76de667:0'
  AND s.meaning='Oを探す'
  AND w.id='seek' AND w.spelling='seek';

-- bring about O -> cause
INSERT OR IGNORE INTO idiom_word_refs (sense_id, word_id, source)
SELECT s.id, w.id, 'synonym'
FROM idiom_senses s JOIN idioms i ON i.id=s.idiom_id
JOIN list_items li ON li.list_id=i.list_id JOIN words w ON w.id=li.word_id
WHERE i.list_id='crossover-v3' AND i.id='crossover-idiom-0da76ff75b2527e0d22a43fd'
  AND i.phrase='bring about O' AND s.id='crossover-idiom-0da76ff75b2527e0d22a43fd:0'
  AND s.meaning='Oを引き起こす'
  AND w.id='cause' AND w.spelling='cause';

-- bring O to light -> reveal
INSERT OR IGNORE INTO idiom_word_refs (sense_id, word_id, source)
SELECT s.id, w.id, 'synonym'
FROM idiom_senses s JOIN idioms i ON i.id=s.idiom_id
JOIN list_items li ON li.list_id=i.list_id JOIN words w ON w.id=li.word_id
WHERE i.list_id='crossover-v3' AND i.id='crossover-idiom-d25a604e2283602b11b05ec0'
  AND i.phrase='bring O to light' AND s.id='crossover-idiom-d25a604e2283602b11b05ec0:0'
  AND s.meaning='Oを明るみに出す'
  AND w.id='reveal' AND w.spelling='reveal';

-- come about -> happen
INSERT OR IGNORE INTO idiom_word_refs (sense_id, word_id, source)
SELECT s.id, w.id, 'synonym'
FROM idiom_senses s JOIN idioms i ON i.id=s.idiom_id
JOIN list_items li ON li.list_id=i.list_id JOIN words w ON w.id=li.word_id
WHERE i.list_id='crossover-v3' AND i.id='crossover-idiom-ddf695370a72efec55dec7af'
  AND i.phrase='come about' AND s.id='crossover-idiom-ddf695370a72efec55dec7af:0'
  AND s.meaning='起こる'
  AND w.id='happen' AND w.spelling='happen';

-- come about -> occur
INSERT OR IGNORE INTO idiom_word_refs (sense_id, word_id, source)
SELECT s.id, w.id, 'synonym'
FROM idiom_senses s JOIN idioms i ON i.id=s.idiom_id
JOIN list_items li ON li.list_id=i.list_id JOIN words w ON w.id=li.word_id
WHERE i.list_id='crossover-v3' AND i.id='crossover-idiom-ddf695370a72efec55dec7af'
  AND i.phrase='come about' AND s.id='crossover-idiom-ddf695370a72efec55dec7af:0'
  AND s.meaning='起こる'
  AND w.id='occur' AND w.spelling='occur';

-- come across O -> encounter
INSERT OR IGNORE INTO idiom_word_refs (sense_id, word_id, source)
SELECT s.id, w.id, 'synonym'
FROM idiom_senses s JOIN idioms i ON i.id=s.idiom_id
JOIN list_items li ON li.list_id=i.list_id JOIN words w ON w.id=li.word_id
WHERE i.list_id='crossover-v3' AND i.id='crossover-idiom-c8df8ff2a5287f53044854b8'
  AND i.phrase='come across O' AND s.id='crossover-idiom-c8df8ff2a5287f53044854b8:0'
  AND s.meaning='Oに偶然出会う'
  AND w.id='encounter' AND w.spelling='encounter';

-- come by O -> obtain
INSERT OR IGNORE INTO idiom_word_refs (sense_id, word_id, source)
SELECT s.id, w.id, 'synonym'
FROM idiom_senses s JOIN idioms i ON i.id=s.idiom_id
JOIN list_items li ON li.list_id=i.list_id JOIN words w ON w.id=li.word_id
WHERE i.list_id='crossover-v3' AND i.id='crossover-idiom-4484211e3e4f4b3a581cd1ea'
  AND i.phrase='come by O' AND s.id='crossover-idiom-4484211e3e4f4b3a581cd1ea:0'
  AND s.meaning='Oを手に入れる'
  AND w.id='obtain' AND w.spelling='obtain';

-- come down on O -> criticize
INSERT OR IGNORE INTO idiom_word_refs (sense_id, word_id, source)
SELECT s.id, w.id, 'synonym'
FROM idiom_senses s JOIN idioms i ON i.id=s.idiom_id
JOIN list_items li ON li.list_id=i.list_id JOIN words w ON w.id=li.word_id
WHERE i.list_id='crossover-v3' AND i.id='crossover-idiom-bcc5b4b16bdc4adcf1daa343'
  AND i.phrase='come down on O' AND s.id='crossover-idiom-bcc5b4b16bdc4adcf1daa343:0'
  AND s.meaning='Oを厳しく叱る、批判する'
  AND w.id='criticize' AND w.spelling='criticize';

-- come to terms with O -> accept
INSERT OR IGNORE INTO idiom_word_refs (sense_id, word_id, source)
SELECT s.id, w.id, 'synonym'
FROM idiom_senses s JOIN idioms i ON i.id=s.idiom_id
JOIN list_items li ON li.list_id=i.list_id JOIN words w ON w.id=li.word_id
WHERE i.list_id='crossover-v3' AND i.id='crossover-idiom-9f5c1c6a92c89395117b0dec'
  AND i.phrase='come to terms with O' AND s.id='crossover-idiom-9f5c1c6a92c89395117b0dec:0'
  AND s.meaning='Oと折り合いをつける・Oを受け入れる'
  AND w.id='accept' AND w.spelling='accept';

-- cut down / back (on) O -> reduce
INSERT OR IGNORE INTO idiom_word_refs (sense_id, word_id, source)
SELECT s.id, w.id, 'synonym'
FROM idiom_senses s JOIN idioms i ON i.id=s.idiom_id
JOIN list_items li ON li.list_id=i.list_id JOIN words w ON w.id=li.word_id
WHERE i.list_id='crossover-v3' AND i.id='crossover-idiom-5a8a2c5f354d1a939f76318c'
  AND i.phrase='cut down / back (on) O' AND s.id='crossover-idiom-5a8a2c5f354d1a939f76318c:0'
  AND s.meaning='Oの量を減らす・Oを切り詰める'
  AND w.id='reduce' AND w.spelling='reduce';

-- do away with O -> abolish
INSERT OR IGNORE INTO idiom_word_refs (sense_id, word_id, source)
SELECT s.id, w.id, 'synonym'
FROM idiom_senses s JOIN idioms i ON i.id=s.idiom_id
JOIN list_items li ON li.list_id=i.list_id JOIN words w ON w.id=li.word_id
WHERE i.list_id='crossover-v3' AND i.id='crossover-idiom-62dff27508bde009f191d167'
  AND i.phrase='do away with O' AND s.id='crossover-idiom-62dff27508bde009f191d167:r39-820a1889fec0'
  AND s.meaning='Oを廃止する'
  AND w.id='abolish' AND w.spelling='abolish';

-- fall through -> fail
INSERT OR IGNORE INTO idiom_word_refs (sense_id, word_id, source)
SELECT s.id, w.id, 'synonym'
FROM idiom_senses s JOIN idioms i ON i.id=s.idiom_id
JOIN list_items li ON li.list_id=i.list_id JOIN words w ON w.id=li.word_id
WHERE i.list_id='crossover-v3' AND i.id='crossover-idiom-d350cf01ef59d3e2e7c93b67'
  AND i.phrase='fall through' AND s.id='crossover-idiom-d350cf01ef59d3e2e7c93b67:0'
  AND s.meaning='失敗に終わる'
  AND w.id='fail' AND w.spelling='fail';

-- get in touch (with O) -> contact
INSERT OR IGNORE INTO idiom_word_refs (sense_id, word_id, source)
SELECT s.id, w.id, 'synonym'
FROM idiom_senses s JOIN idioms i ON i.id=s.idiom_id
JOIN list_items li ON li.list_id=i.list_id JOIN words w ON w.id=li.word_id
WHERE i.list_id='crossover-v3' AND i.id='crossover-idiom-603a72f0a091aa94c03eaa8a'
  AND i.phrase='get in touch (with O)' AND s.id='crossover-idiom-603a72f0a091aa94c03eaa8a:0'
  AND s.meaning='Oと連絡を取る'
  AND w.id='contact' AND w.spelling='contact';

-- get in touch with A -> contact
INSERT OR IGNORE INTO idiom_word_refs (sense_id, word_id, source)
SELECT s.id, w.id, 'synonym'
FROM idiom_senses s JOIN idioms i ON i.id=s.idiom_id
JOIN list_items li ON li.list_id=i.list_id JOIN words w ON w.id=li.word_id
WHERE i.list_id='crossover-v3' AND i.id='crossover-idiom-f4bf73167773be3caaf85b53'
  AND i.phrase='get in touch with A' AND s.id='crossover-idiom-f4bf73167773be3caaf85b53:0'
  AND s.meaning='Aと連絡を取る'
  AND w.id='contact' AND w.spelling='contact';

-- get over O -> recover
INSERT OR IGNORE INTO idiom_word_refs (sense_id, word_id, source)
SELECT s.id, w.id, 'synonym'
FROM idiom_senses s JOIN idioms i ON i.id=s.idiom_id
JOIN list_items li ON li.list_id=i.list_id JOIN words w ON w.id=li.word_id
WHERE i.list_id='crossover-v3' AND i.id='crossover-idiom-c2208550ef683700df9974e1'
  AND i.phrase='get over O' AND s.id='crossover-idiom-c2208550ef683700df9974e1:1'
  AND s.meaning='病気・ショックなどのOから回復する（「Oを克服する」のほか）'
  AND w.id='recover' AND w.spelling='recover';

-- give in -> surrender
INSERT OR IGNORE INTO idiom_word_refs (sense_id, word_id, source)
SELECT s.id, w.id, 'synonym'
FROM idiom_senses s JOIN idioms i ON i.id=s.idiom_id
JOIN list_items li ON li.list_id=i.list_id JOIN words w ON w.id=li.word_id
WHERE i.list_id='crossover-v3' AND i.id='crossover-idiom-24b01d9da61acf5d572f61fd'
  AND i.phrase='give in' AND s.id='crossover-idiom-24b01d9da61acf5d572f61fd:0'
  AND s.meaning='屈服する'
  AND w.id='surrender' AND w.spelling='surrender';

-- give rise to O -> cause
INSERT OR IGNORE INTO idiom_word_refs (sense_id, word_id, source)
SELECT s.id, w.id, 'synonym'
FROM idiom_senses s JOIN idioms i ON i.id=s.idiom_id
JOIN list_items li ON li.list_id=i.list_id JOIN words w ON w.id=li.word_id
WHERE i.list_id='crossover-v3' AND i.id='crossover-idiom-c054157756b1ab7206f548a6'
  AND i.phrase='give rise to O' AND s.id='crossover-idiom-c054157756b1ab7206f548a6:0'
  AND s.meaning='Oを引き起こす'
  AND w.id='cause' AND w.spelling='cause';

-- give up O -> abandon
INSERT OR IGNORE INTO idiom_word_refs (sense_id, word_id, source)
SELECT s.id, w.id, 'synonym'
FROM idiom_senses s JOIN idioms i ON i.id=s.idiom_id
JOIN list_items li ON li.list_id=i.list_id JOIN words w ON w.id=li.word_id
WHERE i.list_id='crossover-v3' AND i.id='crossover-idiom-6de915d036cd0353c34b96db'
  AND i.phrase='give up O' AND s.id='crossover-idiom-6de915d036cd0353c34b96db:0'
  AND s.meaning='Oを諦める'
  AND w.id='abandon' AND w.spelling='abandon';

-- go after O -> pursue
INSERT OR IGNORE INTO idiom_word_refs (sense_id, word_id, source)
SELECT s.id, w.id, 'synonym'
FROM idiom_senses s JOIN idioms i ON i.id=s.idiom_id
JOIN list_items li ON li.list_id=i.list_id JOIN words w ON w.id=li.word_id
WHERE i.list_id='crossover-v3' AND i.id='crossover-idiom-9f4a2520a90c23246b4d2a10'
  AND i.phrase='go after O' AND s.id='crossover-idiom-9f4a2520a90c23246b4d2a10:0'
  AND s.meaning='Oを追いかける、追求する'
  AND w.id='pursue' AND w.spelling='pursue';

-- go into O -> investigate
INSERT OR IGNORE INTO idiom_word_refs (sense_id, word_id, source)
SELECT s.id, w.id, 'synonym'
FROM idiom_senses s JOIN idioms i ON i.id=s.idiom_id
JOIN list_items li ON li.list_id=i.list_id JOIN words w ON w.id=li.word_id
WHERE i.list_id='crossover-v3' AND i.id='crossover-idiom-192197cc97c43d8f77f7dd3e'
  AND i.phrase='go into O' AND s.id='crossover-idiom-192197cc97c43d8f77f7dd3e:0'
  AND s.meaning='問題などのOを詳しく調べる（「Oに入る」のほか）'
  AND w.id='investigate' AND w.spelling='investigate';

-- go on Ving -> continue
INSERT OR IGNORE INTO idiom_word_refs (sense_id, word_id, source)
SELECT s.id, w.id, 'synonym'
FROM idiom_senses s JOIN idioms i ON i.id=s.idiom_id
JOIN list_items li ON li.list_id=i.list_id JOIN words w ON w.id=li.word_id
WHERE i.list_id='crossover-v3' AND i.id='crossover-idiom-65ba64026f3eafccdcd57ca9'
  AND i.phrase='go on Ving' AND s.id='crossover-idiom-65ba64026f3eafccdcd57ca9:0'
  AND s.meaning='同じことをVし続ける'
  AND w.id='continue' AND w.spelling='continue';

-- go on with O -> continue
INSERT OR IGNORE INTO idiom_word_refs (sense_id, word_id, source)
SELECT s.id, w.id, 'synonym'
FROM idiom_senses s JOIN idioms i ON i.id=s.idiom_id
JOIN list_items li ON li.list_id=i.list_id JOIN words w ON w.id=li.word_id
WHERE i.list_id='crossover-v3' AND i.id='crossover-idiom-a8eccc4ab6cfaee4625373c1'
  AND i.phrase='go on with O' AND s.id='crossover-idiom-a8eccc4ab6cfaee4625373c1:0'
  AND s.meaning='Oを続ける（「Oと仲よくする」とは区別）'
  AND w.id='continue' AND w.spelling='continue';

-- go through O -> examine
INSERT OR IGNORE INTO idiom_word_refs (sense_id, word_id, source)
SELECT s.id, w.id, 'synonym'
FROM idiom_senses s JOIN idioms i ON i.id=s.idiom_id
JOIN list_items li ON li.list_id=i.list_id JOIN words w ON w.id=li.word_id
WHERE i.list_id='crossover-v3' AND i.id='crossover-idiom-99e46a56bcc88885610c0da6'
  AND i.phrase='go through O' AND s.id='crossover-idiom-99e46a56bcc88885610c0da6:1'
  AND s.meaning='Oをくまなく調べる（「Oを経験する」のほか）'
  AND w.id='examine' AND w.spelling='examine';

-- keep O from Ving -> prevent
INSERT OR IGNORE INTO idiom_word_refs (sense_id, word_id, source)
SELECT s.id, w.id, 'synonym'
FROM idiom_senses s JOIN idioms i ON i.id=s.idiom_id
JOIN list_items li ON li.list_id=i.list_id JOIN words w ON w.id=li.word_id
WHERE i.list_id='crossover-v3' AND i.id='crossover-idiom-e37f67cc157cf7b5f97f5067'
  AND i.phrase='keep O from Ving' AND s.id='crossover-idiom-e37f67cc157cf7b5f97f5067:0'
  AND s.meaning='OがVするのを妨げる'
  AND w.id='prevent' AND w.spelling='prevent';

-- keep O in mind -> remember
INSERT OR IGNORE INTO idiom_word_refs (sense_id, word_id, source)
SELECT s.id, w.id, 'synonym'
FROM idiom_senses s JOIN idioms i ON i.id=s.idiom_id
JOIN list_items li ON li.list_id=i.list_id JOIN words w ON w.id=li.word_id
WHERE i.list_id='crossover-v3' AND i.id='crossover-idiom-5add16d8a03284941b48e45e'
  AND i.phrase='keep O in mind' AND s.id='crossover-idiom-5add16d8a03284941b48e45e:r39-51a487b6da94'
  AND s.meaning='Oを心に留めておく'
  AND w.id='remember' AND w.spelling='remember';

-- keep / bear O in mind -> remember
INSERT OR IGNORE INTO idiom_word_refs (sense_id, word_id, source)
SELECT s.id, w.id, 'synonym'
FROM idiom_senses s JOIN idioms i ON i.id=s.idiom_id
JOIN list_items li ON li.list_id=i.list_id JOIN words w ON w.id=li.word_id
WHERE i.list_id='crossover-v3' AND i.id='crossover-idiom-113dea2e3d8e5870dec63754'
  AND i.phrase='keep / bear O in mind' AND s.id='crossover-idiom-113dea2e3d8e5870dec63754:r39-8e2645a5c8e5'
  AND s.meaning='Oを心に留めておく・忘れない'
  AND w.id='remember' AND w.spelling='remember';

-- keep on Ving -> continue
INSERT OR IGNORE INTO idiom_word_refs (sense_id, word_id, source)
SELECT s.id, w.id, 'synonym'
FROM idiom_senses s JOIN idioms i ON i.id=s.idiom_id
JOIN list_items li ON li.list_id=i.list_id JOIN words w ON w.id=li.word_id
WHERE i.list_id='crossover-v3' AND i.id='crossover-idiom-ae7571480b01f7f01830a7bb'
  AND i.phrase='keep on Ving' AND s.id='crossover-idiom-ae7571480b01f7f01830a7bb:0'
  AND s.meaning='Vし続ける'
  AND w.id='continue' AND w.spelling='continue';

-- let go of O -> release
INSERT OR IGNORE INTO idiom_word_refs (sense_id, word_id, source)
SELECT s.id, w.id, 'synonym'
FROM idiom_senses s JOIN idioms i ON i.id=s.idiom_id
JOIN list_items li ON li.list_id=i.list_id JOIN words w ON w.id=li.word_id
WHERE i.list_id='crossover-v3' AND i.id='crossover-idiom-9c853a68dbe03e388a4370fa'
  AND i.phrase='let go of O' AND s.id='crossover-idiom-9c853a68dbe03e388a4370fa:0'
  AND s.meaning='Oを手放す'
  AND w.id='release' AND w.spelling='release';

-- let out a laugh -> laugh
INSERT OR IGNORE INTO idiom_word_refs (sense_id, word_id, source)
SELECT s.id, w.id, 'synonym'
FROM idiom_senses s JOIN idioms i ON i.id=s.idiom_id
JOIN list_items li ON li.list_id=i.list_id JOIN words w ON w.id=li.word_id
WHERE i.list_id='crossover-v3' AND i.id='crossover-idiom-18b27a19eb12c03bf603ea93'
  AND i.phrase='let out a laugh' AND s.id='crossover-idiom-18b27a19eb12c03bf603ea93:0'
  AND s.meaning='笑い声を上げる'
  AND w.id='laugh' AND w.spelling='laugh';

-- make believe (that S V) -> pretend
INSERT OR IGNORE INTO idiom_word_refs (sense_id, word_id, source)
SELECT s.id, w.id, 'synonym'
FROM idiom_senses s JOIN idioms i ON i.id=s.idiom_id
JOIN list_items li ON li.list_id=i.list_id JOIN words w ON w.id=li.word_id
WHERE i.list_id='crossover-v3' AND i.id='crossover-idiom-8d3b85b4abf81e467ffb2f81'
  AND i.phrase='make believe (that S V)' AND s.id='crossover-idiom-8d3b85b4abf81e467ffb2f81:0'
  AND s.meaning='SがVするふりをする'
  AND w.id='pretend' AND w.spelling='pretend';

-- make fun of O -> tease
INSERT OR IGNORE INTO idiom_word_refs (sense_id, word_id, source)
SELECT s.id, w.id, 'synonym'
FROM idiom_senses s JOIN idioms i ON i.id=s.idiom_id
JOIN list_items li ON li.list_id=i.list_id JOIN words w ON w.id=li.word_id
WHERE i.list_id='crossover-v3' AND i.id='crossover-idiom-947884ebb9375e7c3c41ede9'
  AND i.phrase='make fun of O' AND s.id='crossover-idiom-947884ebb9375e7c3c41ede9:0'
  AND s.meaning='Oをからかう'
  AND w.id='tease' AND w.spelling='tease';

-- make sense of O -> comprehend
INSERT OR IGNORE INTO idiom_word_refs (sense_id, word_id, source)
SELECT s.id, w.id, 'synonym'
FROM idiom_senses s JOIN idioms i ON i.id=s.idiom_id
JOIN list_items li ON li.list_id=i.list_id JOIN words w ON w.id=li.word_id
WHERE i.list_id='crossover-v3' AND i.id='crossover-idiom-0cd2abfb41fb5b516a2ed3f1'
  AND i.phrase='make sense of O' AND s.id='crossover-idiom-0cd2abfb41fb5b516a2ed3f1:0'
  AND s.meaning='Oを理解する'
  AND w.id='comprehend' AND w.spelling='comprehend';

-- make up one's mind -> decide
INSERT OR IGNORE INTO idiom_word_refs (sense_id, word_id, source)
SELECT s.id, w.id, 'synonym'
FROM idiom_senses s JOIN idioms i ON i.id=s.idiom_id
JOIN list_items li ON li.list_id=i.list_id JOIN words w ON w.id=li.word_id
WHERE i.list_id='crossover-v3' AND i.id='crossover-idiom-d18de381232a04d6a597947a'
  AND i.phrase='make up one''s mind' AND s.id='crossover-idiom-d18de381232a04d6a597947a:0'
  AND s.meaning='決心する'
  AND w.id='decide' AND w.spelling='decide';

-- make up one's mind to V -> decide
INSERT OR IGNORE INTO idiom_word_refs (sense_id, word_id, source)
SELECT s.id, w.id, 'synonym'
FROM idiom_senses s JOIN idioms i ON i.id=s.idiom_id
JOIN list_items li ON li.list_id=i.list_id JOIN words w ON w.id=li.word_id
WHERE i.list_id='crossover-v3' AND i.id='crossover-idiom-34b327f983aaddd18db8724e'
  AND i.phrase='make up one''s mind to V' AND s.id='crossover-idiom-34b327f983aaddd18db8724e:r39-197f6e22e70a'
  AND s.meaning='Vする決心をする'
  AND w.id='decide' AND w.spelling='decide';

-- make use of O -> utilize
INSERT OR IGNORE INTO idiom_word_refs (sense_id, word_id, source)
SELECT s.id, w.id, 'synonym'
FROM idiom_senses s JOIN idioms i ON i.id=s.idiom_id
JOIN list_items li ON li.list_id=i.list_id JOIN words w ON w.id=li.word_id
WHERE i.list_id='crossover-v3' AND i.id='crossover-idiom-7cc0a771902baf9a6ed681d0'
  AND i.phrase='make use of O' AND s.id='crossover-idiom-7cc0a771902baf9a6ed681d0:0'
  AND s.meaning='Oを利用する'
  AND w.id='utilize' AND w.spelling='utilize';

-- stand up for O -> defend
INSERT OR IGNORE INTO idiom_word_refs (sense_id, word_id, source)
SELECT s.id, w.id, 'synonym'
FROM idiom_senses s JOIN idioms i ON i.id=s.idiom_id
JOIN list_items li ON li.list_id=i.list_id JOIN words w ON w.id=li.word_id
WHERE i.list_id='crossover-v3' AND i.id='crossover-idiom-65d567b154295c1608428f0e'
  AND i.phrase='stand up for O' AND s.id='crossover-idiom-65d567b154295c1608428f0e:0'
  AND s.meaning='Oを擁護する'
  AND w.id='defend' AND w.spelling='defend';

-- stand up for O -> support
INSERT OR IGNORE INTO idiom_word_refs (sense_id, word_id, source)
SELECT s.id, w.id, 'synonym'
FROM idiom_senses s JOIN idioms i ON i.id=s.idiom_id
JOIN list_items li ON li.list_id=i.list_id JOIN words w ON w.id=li.word_id
WHERE i.list_id='crossover-v3' AND i.id='crossover-idiom-65d567b154295c1608428f0e'
  AND i.phrase='stand up for O' AND s.id='crossover-idiom-65d567b154295c1608428f0e:0'
  AND s.meaning='Oを擁護する'
  AND w.id='support' AND w.spelling='support';

-- stand up to O -> resist
INSERT OR IGNORE INTO idiom_word_refs (sense_id, word_id, source)
SELECT s.id, w.id, 'synonym'
FROM idiom_senses s JOIN idioms i ON i.id=s.idiom_id
JOIN list_items li ON li.list_id=i.list_id JOIN words w ON w.id=li.word_id
WHERE i.list_id='crossover-v3' AND i.id='crossover-idiom-e8684dca8867a7066939229e'
  AND i.phrase='stand up to O' AND s.id='crossover-idiom-e8684dca8867a7066939229e:0'
  AND s.meaning='Oにひるまず立ち向かう、抵抗する'
  AND w.id='resist' AND w.spelling='resist';

-- stand by -> support
INSERT OR IGNORE INTO idiom_word_refs (sense_id, word_id, source)
SELECT s.id, w.id, 'synonym'
FROM idiom_senses s JOIN idioms i ON i.id=s.idiom_id
JOIN list_items li ON li.list_id=i.list_id JOIN words w ON w.id=li.word_id
WHERE i.list_id='crossover-v3' AND i.id='crossover-idiom-8995c11c8207543015ac4909'
  AND i.phrase='stand by' AND s.id='crossover-idiom-8995c11c8207543015ac4909:0'
  AND s.meaning='人を見捨てず支える'
  AND w.id='support' AND w.spelling='support';

-- take after O -> resemble
INSERT OR IGNORE INTO idiom_word_refs (sense_id, word_id, source)
SELECT s.id, w.id, 'synonym'
FROM idiom_senses s JOIN idioms i ON i.id=s.idiom_id
JOIN list_items li ON li.list_id=i.list_id JOIN words w ON w.id=li.word_id
WHERE i.list_id='crossover-v3' AND i.id='crossover-idiom-f4e3580af1da42e831f91335'
  AND i.phrase='take after O' AND s.id='crossover-idiom-f4e3580af1da42e831f91335:0'
  AND s.meaning='Oに似ている'
  AND w.id='resemble' AND w.spelling='resemble';

-- take care of O -> care
INSERT OR IGNORE INTO idiom_word_refs (sense_id, word_id, source)
SELECT s.id, w.id, 'synonym'
FROM idiom_senses s JOIN idioms i ON i.id=s.idiom_id
JOIN list_items li ON li.list_id=i.list_id JOIN words w ON w.id=li.word_id
WHERE i.list_id='crossover-v3' AND i.id='crossover-idiom-cc28cf7ab51c3e9be0a1719f'
  AND i.phrase='take care of O' AND s.id='crossover-idiom-cc28cf7ab51c3e9be0a1719f:r39-cae6be7c50fd'
  AND s.meaning='Oの世話をする'
  AND w.id='care' AND w.spelling='care';

-- take O into account -> consider
INSERT OR IGNORE INTO idiom_word_refs (sense_id, word_id, source)
SELECT s.id, w.id, 'synonym'
FROM idiom_senses s JOIN idioms i ON i.id=s.idiom_id
JOIN list_items li ON li.list_id=i.list_id JOIN words w ON w.id=li.word_id
WHERE i.list_id='crossover-v3' AND i.id='crossover-idiom-d0eda4b94d38aad07e19b7ed'
  AND i.phrase='take O into account' AND s.id='crossover-idiom-d0eda4b94d38aad07e19b7ed:0'
  AND s.meaning='Oを考慮に入れる'
  AND w.id='consider' AND w.spelling='consider';

-- take the place of O -> replace
INSERT OR IGNORE INTO idiom_word_refs (sense_id, word_id, source)
SELECT s.id, w.id, 'synonym'
FROM idiom_senses s JOIN idioms i ON i.id=s.idiom_id
JOIN list_items li ON li.list_id=i.list_id JOIN words w ON w.id=li.word_id
WHERE i.list_id='crossover-v3' AND i.id='crossover-idiom-e75717dedb5e1321cc0b3fdc'
  AND i.phrase='take the place of O' AND s.id='crossover-idiom-e75717dedb5e1321cc0b3fdc:0'
  AND s.meaning='Oに取って代わる'
  AND w.id='replace' AND w.spelling='replace';

-- take part in O -> participate
INSERT OR IGNORE INTO idiom_word_refs (sense_id, word_id, source)
SELECT s.id, w.id, 'synonym'
FROM idiom_senses s JOIN idioms i ON i.id=s.idiom_id
JOIN list_items li ON li.list_id=i.list_id JOIN words w ON w.id=li.word_id
WHERE i.list_id='crossover-v3' AND i.id='crossover-idiom-a78a903f150bf568e209b8ae'
  AND i.phrase='take part in O' AND s.id='crossover-idiom-a78a903f150bf568e209b8ae:0'
  AND s.meaning='Oに参加する'
  AND w.id='participate' AND w.spelling='participate';

-- talk O into Ving -> persuade
INSERT OR IGNORE INTO idiom_word_refs (sense_id, word_id, source)
SELECT s.id, w.id, 'synonym'
FROM idiom_senses s JOIN idioms i ON i.id=s.idiom_id
JOIN list_items li ON li.list_id=i.list_id JOIN words w ON w.id=li.word_id
WHERE i.list_id='crossover-v3' AND i.id='crossover-idiom-58ac063ca086ef9e92392579'
  AND i.phrase='talk O into Ving' AND s.id='crossover-idiom-58ac063ca086ef9e92392579:0'
  AND s.meaning='Oを説得してVさせる'
  AND w.id='persuade' AND w.spelling='persuade';

-- talk O out of Ving -> persuade
INSERT OR IGNORE INTO idiom_word_refs (sense_id, word_id, source)
SELECT s.id, w.id, 'synonym'
FROM idiom_senses s JOIN idioms i ON i.id=s.idiom_id
JOIN list_items li ON li.list_id=i.list_id JOIN words w ON w.id=li.word_id
WHERE i.list_id='crossover-v3' AND i.id='crossover-idiom-c578307225cb6228d283c2e6'
  AND i.phrase='talk O out of Ving' AND s.id='crossover-idiom-c578307225cb6228d283c2e6:0'
  AND s.meaning='Oを説得してVさせない'
  AND w.id='persuade' AND w.spelling='persuade';

-- talk O out -> discuss
INSERT OR IGNORE INTO idiom_word_refs (sense_id, word_id, source)
SELECT s.id, w.id, 'synonym'
FROM idiom_senses s JOIN idioms i ON i.id=s.idiom_id
JOIN list_items li ON li.list_id=i.list_id JOIN words w ON w.id=li.word_id
WHERE i.list_id='crossover-v3' AND i.id='crossover-idiom-1aab92b50b56270e8020d07b'
  AND i.phrase='talk O out' AND s.id='crossover-idiom-1aab92b50b56270e8020d07b:0'
  AND s.meaning='問題などのOを徹底的に話し合う'
  AND w.id='discuss' AND w.spelling='discuss';

-- talk O over -> discuss
INSERT OR IGNORE INTO idiom_word_refs (sense_id, word_id, source)
SELECT s.id, w.id, 'synonym'
FROM idiom_senses s JOIN idioms i ON i.id=s.idiom_id
JOIN list_items li ON li.list_id=i.list_id JOIN words w ON w.id=li.word_id
WHERE i.list_id='crossover-v3' AND i.id='crossover-idiom-ff1608f4a980f80c237f25fd'
  AND i.phrase='talk O over' AND s.id='crossover-idiom-ff1608f4a980f80c237f25fd:0'
  AND s.meaning='Oについてよく話し合う'
  AND w.id='discuss' AND w.spelling='discuss';

-- tell A and B apart -> distinguish
INSERT OR IGNORE INTO idiom_word_refs (sense_id, word_id, source)
SELECT s.id, w.id, 'synonym'
FROM idiom_senses s JOIN idioms i ON i.id=s.idiom_id
JOIN list_items li ON li.list_id=i.list_id JOIN words w ON w.id=li.word_id
WHERE i.list_id='crossover-v3' AND i.id='crossover-idiom-8196d0ccab612432feef3f56'
  AND i.phrase='tell A and B apart' AND s.id='crossover-idiom-8196d0ccab612432feef3f56:0'
  AND s.meaning='AとBを見分ける'
  AND w.id='distinguish' AND w.spelling='distinguish';

-- tell A from B -> distinguish
INSERT OR IGNORE INTO idiom_word_refs (sense_id, word_id, source)
SELECT s.id, w.id, 'synonym'
FROM idiom_senses s JOIN idioms i ON i.id=s.idiom_id
JOIN list_items li ON li.list_id=i.list_id JOIN words w ON w.id=li.word_id
WHERE i.list_id='crossover-v3' AND i.id='crossover-idiom-b67ab7959fcb4c508c165064'
  AND i.phrase='tell A from B' AND s.id='crossover-idiom-b67ab7959fcb4c508c165064:0'
  AND s.meaning='AとBを見分ける'
  AND w.id='distinguish' AND w.spelling='distinguish';

-- tell O off -> scold
INSERT OR IGNORE INTO idiom_word_refs (sense_id, word_id, source)
SELECT s.id, w.id, 'synonym'
FROM idiom_senses s JOIN idioms i ON i.id=s.idiom_id
JOIN list_items li ON li.list_id=i.list_id JOIN words w ON w.id=li.word_id
WHERE i.list_id='crossover-v3' AND i.id='crossover-idiom-593984c56eff40ff7e4ec338'
  AND i.phrase='tell O off' AND s.id='crossover-idiom-593984c56eff40ff7e4ec338:0'
  AND s.meaning='Oを叱る'
  AND w.id='scold' AND w.spelling='scold';

-- speak well / highly of O -> praise
INSERT OR IGNORE INTO idiom_word_refs (sense_id, word_id, source)
SELECT s.id, w.id, 'synonym'
FROM idiom_senses s JOIN idioms i ON i.id=s.idiom_id
JOIN list_items li ON li.list_id=i.list_id JOIN words w ON w.id=li.word_id
WHERE i.list_id='crossover-v3' AND i.id='crossover-idiom-fb4507994fcefec4a2d26360'
  AND i.phrase='speak well / highly of O' AND s.id='crossover-idiom-fb4507994fcefec4a2d26360:0'
  AND s.meaning='Oをほめる'
  AND w.id='praise' AND w.spelling='praise';

-- speak highly of O -> praise
INSERT OR IGNORE INTO idiom_word_refs (sense_id, word_id, source)
SELECT s.id, w.id, 'synonym'
FROM idiom_senses s JOIN idioms i ON i.id=s.idiom_id
JOIN list_items li ON li.list_id=i.list_id JOIN words w ON w.id=li.word_id
WHERE i.list_id='crossover-v3' AND i.id='crossover-idiom-b15a66f92bd3a5bc83d292a5'
  AND i.phrase='speak highly of O' AND s.id='crossover-idiom-b15a66f92bd3a5bc83d292a5:0'
  AND s.meaning='Oを高く評価する'
  AND w.id='praise' AND w.spelling='praise';

-- think O over -> consider
INSERT OR IGNORE INTO idiom_word_refs (sense_id, word_id, source)
SELECT s.id, w.id, 'synonym'
FROM idiom_senses s JOIN idioms i ON i.id=s.idiom_id
JOIN list_items li ON li.list_id=i.list_id JOIN words w ON w.id=li.word_id
WHERE i.list_id='crossover-v3' AND i.id='crossover-idiom-d49e590c0f88fdf7dd3515c3'
  AND i.phrase='think O over' AND s.id='crossover-idiom-d49e590c0f88fdf7dd3515c3:r39-8d39a8792695'
  AND s.meaning='Oをよく考える'
  AND w.id='consider' AND w.spelling='consider';

-- turn a blind eye to O -> ignore
INSERT OR IGNORE INTO idiom_word_refs (sense_id, word_id, source)
SELECT s.id, w.id, 'synonym'
FROM idiom_senses s JOIN idioms i ON i.id=s.idiom_id
JOIN list_items li ON li.list_id=i.list_id JOIN words w ON w.id=li.word_id
WHERE i.list_id='crossover-v3' AND i.id='crossover-idiom-54ca71f659e417041252ba9a'
  AND i.phrase='turn a blind eye to O' AND s.id='crossover-idiom-54ca71f659e417041252ba9a:0'
  AND s.meaning='Oを見て見ぬふりをする'
  AND w.id='ignore' AND w.spelling='ignore';

-- show up -> appear
INSERT OR IGNORE INTO idiom_word_refs (sense_id, word_id, source)
SELECT s.id, w.id, 'synonym'
FROM idiom_senses s JOIN idioms i ON i.id=s.idiom_id
JOIN list_items li ON li.list_id=i.list_id JOIN words w ON w.id=li.word_id
WHERE i.list_id='crossover-v3' AND i.id='crossover-idiom-efc254afbc0ca262f3491534'
  AND i.phrase='show up' AND s.id='crossover-idiom-efc254afbc0ca262f3491534:r39-eac7b0dd5cdc'
  AND s.meaning='現れる'
  AND w.id='appear' AND w.spelling='appear';

-- set in -> begin
INSERT OR IGNORE INTO idiom_word_refs (sense_id, word_id, source)
SELECT s.id, w.id, 'synonym'
FROM idiom_senses s JOIN idioms i ON i.id=s.idiom_id
JOIN list_items li ON li.list_id=i.list_id JOIN words w ON w.id=li.word_id
WHERE i.list_id='crossover-v3' AND i.id='crossover-idiom-8a3408554120ca3712705e68'
  AND i.phrase='set in' AND s.id='crossover-idiom-8a3408554120ca3712705e68:0'
  AND s.meaning='（好ましくない状況などが）始まる'
  AND w.id='begin' AND w.spelling='begin';

-- set about O / Ving -> begin
INSERT OR IGNORE INTO idiom_word_refs (sense_id, word_id, source)
SELECT s.id, w.id, 'synonym'
FROM idiom_senses s JOIN idioms i ON i.id=s.idiom_id
JOIN list_items li ON li.list_id=i.list_id JOIN words w ON w.id=li.word_id
WHERE i.list_id='crossover-v3' AND i.id='crossover-idiom-cb426fc0217752786b9681ff'
  AND i.phrase='set about O / Ving' AND s.id='crossover-idiom-cb426fc0217752786b9681ff:0'
  AND s.meaning='O・Vすることに取りかかる'
  AND w.id='begin' AND w.spelling='begin';

-- see O through -> accomplish
INSERT OR IGNORE INTO idiom_word_refs (sense_id, word_id, source)
SELECT s.id, w.id, 'synonym'
FROM idiom_senses s JOIN idioms i ON i.id=s.idiom_id
JOIN list_items li ON li.list_id=i.list_id JOIN words w ON w.id=li.word_id
WHERE i.list_id='crossover-v3' AND i.id='crossover-idiom-7ecaeb3a3becaaa027ef0527'
  AND i.phrase='see O through' AND s.id='crossover-idiom-7ecaeb3a3becaaa027ef0527:0'
  AND s.meaning='Oを最後までやり遂げる'
  AND w.id='accomplish' AND w.spelling='accomplish';

-- run after O -> pursue
INSERT OR IGNORE INTO idiom_word_refs (sense_id, word_id, source)
SELECT s.id, w.id, 'synonym'
FROM idiom_senses s JOIN idioms i ON i.id=s.idiom_id
JOIN list_items li ON li.list_id=i.list_id JOIN words w ON w.id=li.word_id
WHERE i.list_id='crossover-v3' AND i.id='crossover-idiom-e4e1d9bc9a5969144d3797f8'
  AND i.phrase='run after O' AND s.id='crossover-idiom-e4e1d9bc9a5969144d3797f8:0'
  AND s.meaning='Oを追いかける'
  AND w.id='pursue' AND w.spelling='pursue';

-- take place -> happen
INSERT OR IGNORE INTO idiom_word_refs (sense_id, word_id, source)
SELECT s.id, w.id, 'synonym'
FROM idiom_senses s JOIN idioms i ON i.id=s.idiom_id
JOIN list_items li ON li.list_id=i.list_id JOIN words w ON w.id=li.word_id
WHERE i.list_id='crossover-v3' AND i.id='crossover-idiom-0d2216989b3ed911b8219fcf'
  AND i.phrase='take place' AND s.id='crossover-idiom-0d2216989b3ed911b8219fcf:0'
  AND s.meaning='起こる；行われる'
  AND w.id='happen' AND w.spelling='happen';

-- take place -> occur
INSERT OR IGNORE INTO idiom_word_refs (sense_id, word_id, source)
SELECT s.id, w.id, 'synonym'
FROM idiom_senses s JOIN idioms i ON i.id=s.idiom_id
JOIN list_items li ON li.list_id=i.list_id JOIN words w ON w.id=li.word_id
WHERE i.list_id='crossover-v3' AND i.id='crossover-idiom-0d2216989b3ed911b8219fcf'
  AND i.phrase='take place' AND s.id='crossover-idiom-0d2216989b3ed911b8219fcf:0'
  AND s.meaning='起こる；行われる'
  AND w.id='occur' AND w.spelling='occur';

-- take place -> happen
INSERT OR IGNORE INTO idiom_word_refs (sense_id, word_id, source)
SELECT s.id, w.id, 'synonym'
FROM idiom_senses s JOIN idioms i ON i.id=s.idiom_id
JOIN list_items li ON li.list_id=i.list_id JOIN words w ON w.id=li.word_id
WHERE i.list_id='crossover-v3' AND i.id='crossover-idiom-0d2216989b3ed911b8219fcf'
  AND i.phrase='take place' AND s.id='crossover-idiom-0d2216989b3ed911b8219fcf:1'
  AND s.meaning='起こる・行われる'
  AND w.id='happen' AND w.spelling='happen';

-- take place -> occur
INSERT OR IGNORE INTO idiom_word_refs (sense_id, word_id, source)
SELECT s.id, w.id, 'synonym'
FROM idiom_senses s JOIN idioms i ON i.id=s.idiom_id
JOIN list_items li ON li.list_id=i.list_id JOIN words w ON w.id=li.word_id
WHERE i.list_id='crossover-v3' AND i.id='crossover-idiom-0d2216989b3ed911b8219fcf'
  AND i.phrase='take place' AND s.id='crossover-idiom-0d2216989b3ed911b8219fcf:1'
  AND s.meaning='起こる・行われる'
  AND w.id='occur' AND w.spelling='occur';

-- pass away -> die
INSERT OR IGNORE INTO idiom_word_refs (sense_id, word_id, source)
SELECT s.id, w.id, 'synonym'
FROM idiom_senses s JOIN idioms i ON i.id=s.idiom_id
JOIN list_items li ON li.list_id=i.list_id JOIN words w ON w.id=li.word_id
WHERE i.list_id='crossover-v3' AND i.id='crossover-idiom-5a7abc6edd7fea8e17463f78'
  AND i.phrase='pass away' AND s.id='crossover-idiom-5a7abc6edd7fea8e17463f78:0'
  AND s.meaning='亡くなる'
  AND w.id='die' AND w.spelling='die';

-- pass out -> faint
INSERT OR IGNORE INTO idiom_word_refs (sense_id, word_id, source)
SELECT s.id, w.id, 'synonym'
FROM idiom_senses s JOIN idioms i ON i.id=s.idiom_id
JOIN list_items li ON li.list_id=i.list_id JOIN words w ON w.id=li.word_id
WHERE i.list_id='crossover-v3' AND i.id='crossover-idiom-5a0d9d76d96cc694c5af70e4'
  AND i.phrase='pass out' AND s.id='crossover-idiom-5a0d9d76d96cc694c5af70e4:0'
  AND s.meaning='気絶する・酔いつぶれる'
  AND w.id='faint' AND w.spelling='faint';

-- carry out O -> implement
INSERT OR IGNORE INTO idiom_word_refs (sense_id, word_id, source)
SELECT s.id, w.id, 'synonym'
FROM idiom_senses s JOIN idioms i ON i.id=s.idiom_id
JOIN list_items li ON li.list_id=i.list_id JOIN words w ON w.id=li.word_id
WHERE i.list_id='crossover-v3' AND i.id='crossover-idiom-13b97ee43f9968b70b73876d'
  AND i.phrase='carry out O' AND s.id='crossover-idiom-13b97ee43f9968b70b73876d:0'
  AND s.meaning='Oを実行する'
  AND w.id='implement' AND w.spelling='implement';

-- carry out O -> perform
INSERT OR IGNORE INTO idiom_word_refs (sense_id, word_id, source)
SELECT s.id, w.id, 'synonym'
FROM idiom_senses s JOIN idioms i ON i.id=s.idiom_id
JOIN list_items li ON li.list_id=i.list_id JOIN words w ON w.id=li.word_id
WHERE i.list_id='crossover-v3' AND i.id='crossover-idiom-13b97ee43f9968b70b73876d'
  AND i.phrase='carry out O' AND s.id='crossover-idiom-13b97ee43f9968b70b73876d:0'
  AND s.meaning='Oを実行する'
  AND w.id='perform' AND w.spelling='perform';
