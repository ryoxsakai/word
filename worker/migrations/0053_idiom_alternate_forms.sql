-- Separate visible alternate forms from historical aliases / merged IDs.
ALTER TABLE idioms ADD COLUMN alternate_forms TEXT NOT NULL DEFAULT '[]';
CREATE TABLE idiom_forms_migration_0053 (
 id TEXT PRIMARY KEY, old_phrase TEXT NOT NULL, new_phrase TEXT NOT NULL, alternate_forms TEXT NOT NULL
);
INSERT INTO idiom_forms_migration_0053 VALUES ('grammar-idiom-db6db350d7f261ebd0e0', 'object to O / Ving', 'object to O', '["object to Ving"]');
INSERT INTO idiom_forms_migration_0053 VALUES ('grammar-idiom-0a7858f7df6baf81d843', 'provide A with B / provide B for A', 'provide A with B', '["provide B for A"]');
INSERT INTO idiom_forms_migration_0053 VALUES ('grammar-idiom-26c13de2284bf1ce1d43', 'supply A with B / supply B to A', 'supply A with B', '["supply B to A"]');
INSERT INTO idiom_forms_migration_0053 VALUES ('g12-idiom-574620aa8f9111da2ed6', 'serve A with B / serve B to A', 'serve A with B', '["serve B to A"]');
INSERT INTO idiom_forms_migration_0053 VALUES ('g12-idiom-35f9373491c36c45c528', 'compare A with / to B', 'compare A with B', '["compare A to B"]');
INSERT INTO idiom_forms_migration_0053 VALUES ('g12-idiom-817188a0ba1ba656a863', 'connect A with / to B', 'connect A with B', '["connect A to B"]');
INSERT INTO idiom_forms_migration_0053 VALUES ('g12-idiom-6753a87d4f3156cfb9f2', 'link A with / to B', 'link A with B', '["link A to B"]');
INSERT INTO idiom_forms_migration_0053 VALUES ('grammar-idiom-c8a312a8eda9f4861cd2', 'devote / dedicate A to O / Ving', 'devote A to O', '["devote A to Ving", "dedicate A to O", "dedicate A to Ving"]');
INSERT INTO idiom_forms_migration_0053 VALUES ('e11c04b6-7e4a-4a9d-af01-0c75db34b2de', 'commit oneself to O / Ving', 'commit oneself to O', '["commit oneself to Ving"]');
INSERT INTO idiom_forms_migration_0053 VALUES ('grammar-idiom-39f70f5979bbef3217e1', 'regard / see / view A as B', 'regard A as B', '["see A as B", "view A as B"]');
INSERT INTO idiom_forms_migration_0053 VALUES ('crossover-idiom-662e412485a34fade113fd14', 'look on / upon A as B', 'look on A as B', '["look upon A as B"]');
INSERT INTO idiom_forms_migration_0053 VALUES ('g12-idiom-5ba687a136e5f4a4c417', 'describe / speak of A as B', 'describe A as B', '["speak of A as B"]');
INSERT INTO idiom_forms_migration_0053 VALUES ('grammar-idiom-d70ff8187a17ac49b093', 'may / might as well V', 'may as well V', '["might as well V"]');
INSERT INTO idiom_forms_migration_0053 VALUES ('grammar-idiom-605de7d2292d0009d5f7', 'if it were not for O / were it not for O', 'if it were not for O', '["were it not for O"]');
INSERT INTO idiom_forms_migration_0053 VALUES ('grammar-idiom-48ad49737ac0e109057c', 'if it had not been for O / had it not been for O', 'if it had not been for O', '["had it not been for O"]');
INSERT INTO idiom_forms_migration_0053 VALUES ('grammar-idiom-c96e414377026130246c', 'I wish S 過去形 / had Vpp', 'I wish S 過去形', '["I wish S had Vpp"]');
INSERT INTO idiom_forms_migration_0053 VALUES ('grammar-idiom-b1511caca37a83415fa8', 'if only S 過去形 / had Vpp', 'if only S 過去形', '["if only S had Vpp"]');
INSERT INTO idiom_forms_migration_0053 VALUES ('grammar-idiom-377d6f8547381541ffb3', 'as if S V / as though S V', 'as if S V', '["as though S V"]');
INSERT INTO idiom_forms_migration_0053 VALUES ('grammar-idiom-6e17b24ecb4985514256', 'would rather S 過去形 / had Vpp', 'would rather S 過去形', '["would rather S had Vpp"]');
INSERT INTO idiom_forms_migration_0053 VALUES ('ga-idiom-5f9588412bc21502cdf0', 'It is (about / high) time S 過去形', 'It is time S 過去形', '["It is about time S 過去形", "It is high time S 過去形"]');
INSERT INTO idiom_forms_migration_0053 VALUES ('ga-idiom-1eebd6bc44ae97429aa7', 'otherwise S would V / would have Vpp', 'otherwise S would V', '["otherwise S would have Vpp"]');
INSERT INTO idiom_forms_migration_0053 VALUES ('crossover-idiom-f3316259c4d74464a47f8943', 'to make matters / things worse', 'to make matters worse', '["to make things worse"]');
INSERT INTO idiom_forms_migration_0053 VALUES ('crossover-idiom-c799063ea132018315f2500c', 'look forward to O / Ving', 'look forward to O', '["look forward to Ving"]');
INSERT INTO idiom_forms_migration_0053 VALUES ('grammar-idiom-d87777006c6733312ffa', 'be used to O / Ving', 'be used to O', '["be used to Ving"]');
INSERT INTO idiom_forms_migration_0053 VALUES ('crossover-idiom-3722c5a87c5fba2c69e96350', 'be opposed to O / Ving', 'be opposed to O', '["be opposed to Ving"]');
INSERT INTO idiom_forms_migration_0053 VALUES ('grammar-idiom-fde5a82f5456b9acb0ee', 'be accustomed to O / Ving', 'be accustomed to O', '["be accustomed to Ving"]');
INSERT INTO idiom_forms_migration_0053 VALUES ('grammar-idiom-fd9c336714028912faef', '物 need Ving / to be Vpp', '物 need Ving', '["物 need to be Vpp"]');
INSERT INTO idiom_forms_migration_0053 VALUES ('grammar-idiom-e0b43e97ecc7ddb8a937', 'it is no use / good Ving', 'it is no use Ving', '["it is no good Ving"]');
INSERT INTO idiom_forms_migration_0053 VALUES ('ga-idiom-5ae7e043ac6927f57d7b', 'there is no point / sense in Ving', 'there is no point in Ving', '["there is no sense in Ving"]');
INSERT INTO idiom_forms_migration_0053 VALUES ('grammar-idiom-26dd9ade758ed2c5a59d', 'have difficulty / trouble / a hard time (in) Ving', 'have difficulty (in) Ving', '["have trouble (in) Ving", "have a hard time (in) Ving"]');
INSERT INTO idiom_forms_migration_0053 VALUES ('grammar-idiom-9a2b6c1be49b3bc5640d', 'speaking / talking of O', 'speaking of O', '["talking of O"]');
INSERT INTO idiom_forms_migration_0053 VALUES ('grammar-idiom-5fbb9845cf9b95dfa953', 'what few＋複数名詞 / what little＋不可算名詞', 'what few＋複数名詞', '["what little＋不可算名詞"]');
INSERT INTO idiom_forms_migration_0053 VALUES ('ga-idiom-04a59f9bb6506b294648', 'what S is / was / used to be', 'what S is', '["what S was", "what S used to be"]');
INSERT INTO idiom_forms_migration_0053 VALUES ('grammar-idiom-2fab8d53f2bc2d062b66', 'What / How about O / Ving?', 'What about O?', '["What about Ving?", "How about O?", "How about Ving?"]');
INSERT INTO idiom_forms_migration_0053 VALUES ('grammar-idiom-c27bc4fcf7585919dfc3', 'every / each time S V', 'every time S V', '["each time S V"]');
INSERT INTO idiom_forms_migration_0053 VALUES ('grammar-idiom-411c261b0edef831dc3e', 'the moment / instant / minute S V', 'the moment S V', '["the instant S V", "the minute S V"]');
INSERT INTO idiom_forms_migration_0053 VALUES ('grammar-idiom-27ce182a3b06b3e13461', 'as / so long as S V', 'as long as S V', '["so long as S V"]');
INSERT INTO idiom_forms_migration_0053 VALUES ('grammar-idiom-18455a2b8c837ed1c062', 'provided / providing (that) S V', 'provided (that) S V', '["providing (that) S V"]');
INSERT INTO idiom_forms_migration_0053 VALUES ('ga-idiom-569e5bbb38248997eba4', 'suppose / supposing (that) S V', 'suppose (that) S V', '["supposing (that) S V"]');
INSERT INTO idiom_forms_migration_0053 VALUES ('ga-idiom-e93528ae72ef363f1ddd', 'whether S V or not / whether or not S V', 'whether S V or not', '["whether or not S V"]');
INSERT INTO idiom_forms_migration_0053 VALUES ('ga-idiom-bcf80172ac63547e0c6e', 'granting / granted that S V', 'granting that S V', '["granted that S V"]');
INSERT INTO idiom_forms_migration_0053 VALUES ('ga-idiom-b8d135e074aa62ee1c5a', '形容詞 as / though S V', '形容詞 as S V', '["形容詞 though S V"]');
INSERT INTO idiom_forms_migration_0053 VALUES ('grammar-idiom-e4158a4cce9521a71a2a', 'as / so far as S V', 'as far as S V', '["so far as S V"]');
INSERT INTO idiom_forms_migration_0053 VALUES ('crossover-idiom-ac98107bdec4e20f5f153093', 'be anxious about O / Ving', 'be anxious about O', '["be anxious about Ving"]');
INSERT INTO idiom_forms_migration_0053 VALUES ('grammar-idiom-b669ffe28b63f1e936dc', 'under control / under the influence of O', 'under control', '["under the influence of O"]');
INSERT INTO idiom_forms_migration_0053 VALUES ('crossover-idiom-90942dda5be0e5011209d65b', 'with / in regard to O', 'with regard to O', '["in regard to O"]');
INSERT INTO idiom_forms_migration_0053 VALUES ('crossover-idiom-d81ec8710d11c3264e0c11ff', 'for fear of O / Ving', 'for fear of O', '["for fear of Ving"]');
INSERT INTO idiom_forms_migration_0053 VALUES ('crossover-idiom-ffbf8138bb8e16c8e32fba5c', 'on / in behalf of O', 'on behalf of O', '["in behalf of O"]');
INSERT INTO idiom_forms_migration_0053 VALUES ('grammar-idiom-ebe8222c3a9805bda843', 'apart / aside from O', 'apart from O', '["aside from O"]');
INSERT INTO idiom_forms_migration_0053 VALUES ('crossover-idiom-10797a16dd2364c9d975abaa', 'for lack / want of O', 'for lack of O', '["for want of O"]');
INSERT INTO idiom_forms_migration_0053 VALUES ('crossover-idiom-eced58bca49b2e989f1f1d0b', 'for / with all O', 'for all O', '["with all O"]');
INSERT INTO idiom_forms_migration_0053 VALUES ('crossover-idiom-25feb888c8ddaaf9a107dea1', 'take turns Ving / to V', 'take turns Ving', '["take turns to V"]');
INSERT INTO idiom_forms_migration_0053 VALUES ('crossover-idiom-a2943e8c761872a6f12487e3', 'take / catch / hold O by the arm', 'take O by the arm', '["catch O by the arm", "hold O by the arm"]');
INSERT INTO idiom_forms_migration_0053 VALUES ('ga-idiom-98d649b7e840ce75b1c6', 'hit / pat O on the＋身体部位', 'hit O on the＋身体部位', '["pat O on the＋身体部位"]');
INSERT INTO idiom_forms_migration_0053 VALUES ('grammar-idiom-13f5773c3532550ea39f', 'each other / one another', 'each other', '["one another"]');
INSERT INTO idiom_forms_migration_0053 VALUES ('grammar-idiom-2345515a3f84086f9859', 'as＋形容詞・副詞＋as possible / S can', 'as＋形容詞・副詞＋as possible', '["as＋形容詞・副詞＋as S can"]');
INSERT INTO idiom_forms_migration_0053 VALUES ('grammar-idiom-e21f7959a2a21d9eda40', '肯定文, much / still more O', '肯定文, much more O', '["肯定文, still more O"]');
INSERT INTO idiom_forms_migration_0053 VALUES ('grammar-idiom-a1b3a531e278e36ee653', '否定文, much / still less O', '否定文, much less O', '["否定文, still less O"]');
INSERT INTO idiom_forms_migration_0053 VALUES ('grammar-idiom-65b6122967c4e1652a20', 'It was / will not be long before S V', 'It was not long before S V', '["It will not be long before S V"]');
INSERT INTO idiom_forms_migration_0053 VALUES ('ga-idiom-45be01d6ec755883f77b', 'hardly / scarcely ever V', 'hardly ever V', '["scarcely ever V"]');
INSERT INTO idiom_forms_migration_0053 VALUES ('ga-idiom-6bd83c258dcdcc06fd47', 'hardly / scarcely any O', 'hardly any O', '["scarcely any O"]');
INSERT INTO idiom_forms_migration_0053 VALUES ('ga-idiom-690331cb4bfc3689cc4a', 'not … in the least / slightest', 'not … in the least', '["not … in the slightest"]');
INSERT INTO idiom_forms_migration_0053 VALUES ('grammar-idiom-41653231e173143874eb', 'I think so.  / I don''t think so.', 'I think so.', '["I don''t think so."]');
INSERT INTO idiom_forms_migration_0053 VALUES ('grammar-idiom-7ae74b0f0357f89c945d', 'I hope so.  / I hope not.', 'I hope so.', '["I hope not."]');
INSERT INTO idiom_forms_migration_0053 VALUES ('grammar-idiom-2163d3f5d11cb5ec496f', 'I''m afraid so.  / I''m afraid not.', 'I''m afraid so.', '["I''m afraid not."]');
INSERT INTO idiom_forms_migration_0053 VALUES ('crossover-idiom-dd75a220535be8c08e0c13f9', 'turn over (O) / turn O over', 'turn over (O)', '["turn O over"]');
INSERT INTO idiom_forms_migration_0053 VALUES ('crossover-idiom-a344521f0c97add5e847d053', 'call at / in at O', 'call at O', '["call in at O"]');
INSERT INTO idiom_forms_migration_0053 VALUES ('crossover-idiom-45bc6d477447ca508fc24af6', 'have / take a look (at O)', 'have a look (at O)', '["take a look (at O)"]');
INSERT INTO idiom_forms_migration_0053 VALUES ('crossover-idiom-8a28e06875b48304a1dc7cea', 'get / be even with O', 'get even with O', '["be even with O"]');
INSERT INTO idiom_forms_migration_0053 VALUES ('crossover-idiom-d8b884bb5d70c7e835f8bad1', 'get / have the better of O', 'get the better of O', '["have the better of O"]');
INSERT INTO idiom_forms_migration_0053 VALUES ('crossover-idiom-ca83bc22232400176840990e', 'make light / little of O', 'make light of O', '["make little of O"]');
INSERT INTO idiom_forms_migration_0053 VALUES ('crossover-idiom-b15a66f92bd3a5bc83d292a5', 'speak well / highly of O', 'speak well of O', '["speak highly of O"]');
INSERT INTO idiom_forms_migration_0053 VALUES ('crossover-idiom-5ea51319f3604a1cd1d495c6', 'tell on / upon O', 'tell on O', '["tell upon O"]');
INSERT INTO idiom_forms_migration_0053 VALUES ('crossover-idiom-d9d65f6baaaa904c528172ce', 'think much / highly of O', 'think much of O', '["think highly of O"]');
INSERT INTO idiom_forms_migration_0053 VALUES ('crossover-idiom-bd7cd1caea7ed9a6d2449b35', 'keep abreast of / with O', 'keep abreast of O', '["keep abreast with O"]');
INSERT INTO idiom_forms_migration_0053 VALUES ('crossover-idiom-d2a457a539d9015189dad854', 'be / have done with O', 'be done with O', '["have done with O"]');
INSERT INTO idiom_forms_migration_0053 VALUES ('crossover-idiom-fd2047edd91e299eed27db78', 'make away / off with O', 'make away with O', '["make off with O"]');
INSERT INTO idiom_forms_migration_0053 VALUES ('crossover-idiom-4dfd910d0e3f411ece89d4d3', 'fall on / upon O', 'fall on O', '["fall upon O"]');
INSERT INTO idiom_forms_migration_0053 VALUES ('crossover-idiom-ccdb3925ad4ac355855dff45', 'stand a chance of O / Ving', 'stand a chance of O', '["stand a chance of Ving"]');
INSERT INTO idiom_forms_migration_0053 VALUES ('crossover-idiom-c716bce5e1512f90b299c030', 'call O back / call back O', 'call O back', '["call back O"]');
INSERT INTO idiom_forms_migration_0053 VALUES ('crossover-idiom-8035d252fc1dac9369dc3f9c', 'carry O through / carry through with O', 'carry O through', '["carry through with O"]');
INSERT INTO idiom_forms_migration_0053 VALUES ('crossover-idiom-d15733a5c93281925bb31e35', 'give O away / give away O', 'give O away', '["give away O"]');
INSERT INTO idiom_forms_migration_0053 VALUES ('crossover-idiom-87e7ce2903e64da819ee4d07', 'hold / keep O in check', 'hold O in check', '["keep O in check"]');
INSERT INTO idiom_forms_migration_0053 VALUES ('crossover-idiom-113dea2e3d8e5870dec63754', 'keep / bear O in mind', 'keep O in mind', '["bear O in mind"]');
INSERT INTO idiom_forms_migration_0053 VALUES ('crossover-idiom-7528c72e52b5b45f9f756667', 'let O down / let down O', 'let O down', '["let down O"]');
INSERT INTO idiom_forms_migration_0053 VALUES ('crossover-idiom-0233eb5eb2883a43bb230bbc', 'put on O / put O on', 'put on O', '["put O on"]');
INSERT INTO idiom_forms_migration_0053 VALUES ('crossover-idiom-439de08fca4c010a0923bd6b', 'take O off / take off O', 'take O off', '["take off O"]');
INSERT INTO idiom_forms_migration_0053 VALUES ('crossover-idiom-990a709fca53123f1eefc91e', 'turn off O / turn O off', 'turn off O', '["turn O off"]');
INSERT INTO idiom_forms_migration_0053 VALUES ('crossover-idiom-293274e36afde1497134c67b', 'turn on O / turn O on', 'turn on O', '["turn O on"]');
INSERT INTO idiom_forms_migration_0053 VALUES ('crossover-idiom-09ed1a4c731204da27c7cccd', 'turn up / turn O up', 'turn up', '["turn O up"]');
INSERT INTO idiom_forms_migration_0053 VALUES ('crossover-idiom-364d0f2428cb2d82dc81f68e', 'catch up with / to O', 'catch up with O', '["catch up to O"]');
INSERT INTO idiom_forms_migration_0053 VALUES ('crossover-idiom-39256c6fbe44d86247533759', 'look back on / upon / to O', 'look back on O', '["look back upon O", "look back to O"]');
INSERT INTO idiom_forms_migration_0053 VALUES ('crossover-idiom-96c6deb3a2938ecfab271653', 'come up with / hit on O', 'come up with O', '["hit on O"]');
INSERT INTO idiom_forms_migration_0053 VALUES ('crossover-idiom-71728e3395239bc6de1fd6e7', 'for sure / for certain', 'for sure', '["for certain"]');
INSERT INTO idiom_forms_migration_0053 VALUES ('crossover-idiom-acebc613581f5cc9ad994f10', 'on second thoughts / on second thought', 'on second thoughts', '["on second thought"]');
INSERT INTO idiom_forms_migration_0053 VALUES ('crossover-idiom-746c9493a743fcb974ac4e14', 'at second hand / second-hand', 'at second hand', '["second-hand"]');
INSERT INTO idiom_forms_migration_0053 VALUES ('grammar-idiom-169e7e73c863a1e5115e', 'to some extent / degree', 'to some extent', '["to some degree"]');
INSERT INTO idiom_forms_migration_0053 VALUES ('crossover-idiom-4358b264a1fdb4ee52bb4f7d', 'at / on short notice', 'at short notice', '["on short notice"]');
INSERT INTO idiom_forms_migration_0053 VALUES ('crossover-idiom-a6927870799760f0375b1e69', 'get around / round O', 'get around O', '["get round O"]');
INSERT INTO idiom_forms_migration_0053 VALUES ('crossover-idiom-a8cb0c8058c8578b34916305', 'see about O / Ving', 'see about O', '["see about Ving"]');
INSERT INTO idiom_forms_migration_0053 VALUES ('crossover-idiom-cf3db414de3b7cee30b6ac51', 'speak out / up', 'speak out', '["speak up"]');
INSERT INTO idiom_forms_migration_0053 VALUES ('crossover-idiom-a86951b740f31c7eccbc3f3a', 'make an effort / efforts', 'make an effort', '["make efforts"]');
INSERT INTO idiom_forms_migration_0053 VALUES ('crossover-idiom-a1ce640e3d9c8f36cf5f7046', 'put O into practice / operation', 'put O into practice', '["put O into operation"]');
INSERT INTO idiom_forms_migration_0053 VALUES ('crossover-idiom-cb426fc0217752786b9681ff', 'set about O / Ving', 'set about O', '["set about Ving"]');
INSERT INTO idiom_forms_migration_0053 VALUES ('crossover-idiom-de585bafa6e8a5f862248b33', 'have time / a day off', 'have time off', '["have a day off"]');
INSERT INTO idiom_forms_migration_0053 VALUES ('crossover-idiom-26f82c98fcd48e23f998f8b0', 'make / earn a / one''s living', 'make a living', '["make one''s living", "earn a living", "earn one''s living"]');
INSERT INTO idiom_forms_migration_0053 VALUES ('crossover-idiom-da735299143d716118d96c4c', 'take out insurance / a loan', 'take out insurance', '["take out a loan"]');
INSERT INTO idiom_forms_migration_0053 VALUES ('crossover-idiom-d8c712ddae0fa414637e4119', 'take time / a day off', 'take time off', '["take a day off"]');
INSERT INTO idiom_forms_migration_0053 VALUES ('crossover-idiom-64e9ec4d557ed7e87aa73515', 'break one''s promise / word', 'break one''s promise', '["break one''s word"]');
INSERT INTO idiom_forms_migration_0053 VALUES ('crossover-idiom-7b32eb490bd6bafd091b06c3', 'call on / upon A', 'call on A', '["call upon A"]');
INSERT INTO idiom_forms_migration_0053 VALUES ('crossover-idiom-b83ba476ce0e499b21a75b3a', 'fall in love with A / O', 'fall in love with A', '["fall in love with O"]');
INSERT INTO idiom_forms_migration_0053 VALUES ('crossover-idiom-5121f139f304117b0f242325', 'get along / on (with O)', 'get along (with O)', '["get on (with O)"]');
INSERT INTO idiom_forms_migration_0053 VALUES ('crossover-idiom-732cc615aaf172a68e93577b', 'keep one''s promise / word', 'keep one''s promise', '["keep one''s word"]');
INSERT INTO idiom_forms_migration_0053 VALUES ('crossover-idiom-379b666f7f447bdaa36f07c2', 'that said / that being said', 'that said', '["that being said"]');
INSERT INTO idiom_forms_migration_0053 VALUES ('crossover-idiom-5cd84d2d7f312c8623c0e48e', 'carry O around / about', 'carry O around', '["carry O about"]');
INSERT INTO idiom_forms_migration_0053 VALUES ('crossover-idiom-321a84293dd6d5fa781cce18', 'get in / into a car', 'get in a car', '["get into a car"]');
INSERT INTO idiom_forms_migration_0053 VALUES ('crossover-idiom-3b41bd105323949f3e1ba8c9', 'look around / round', 'look around', '["look round"]');
INSERT INTO idiom_forms_migration_0053 VALUES ('crossover-idiom-6c6a9916faafa1c15d5084da', 'pull over / pull a car over', 'pull over', '["pull a car over"]');
INSERT INTO idiom_forms_migration_0053 VALUES ('crossover-idiom-0ebb40d0766593990ca4a7f4', 'pull up / pull a car up', 'pull up', '["pull a car up"]');
INSERT INTO idiom_forms_migration_0053 VALUES ('crossover-idiom-0ff85e164d6d79ed2c8b2682', 'come around / round', 'come around', '["come round"]');
INSERT INTO idiom_forms_migration_0053 VALUES ('crossover-idiom-f32dc970150c970b6f918a4c', 'come close / near to Ving', 'come close to Ving', '["come near to Ving"]');
INSERT INTO idiom_forms_migration_0053 VALUES ('crossover-idiom-c5e1ac10f499bc58c31d7ce5', 'come into being / existence', 'come into being', '["come into existence"]');
INSERT INTO idiom_forms_migration_0053 VALUES ('crossover-idiom-5a8a2c5f354d1a939f76318c', 'cut down / back (on) O', 'cut down (on) O', '["cut back (on) O"]');
INSERT INTO idiom_forms_migration_0053 VALUES ('crossover-idiom-b7a3e53e3511e12afb57a445', 'hang on to / onto O', 'hang on to O', '["hang onto O"]');
INSERT INTO idiom_forms_migration_0053 VALUES ('crossover-idiom-1767287d93aa8dfb0dc61a66', 'be / get carried away', 'be carried away', '["get carried away"]');
INSERT INTO idiom_forms_migration_0053 VALUES ('crossover-idiom-ebb17737616128bce85faff3', 'come to / come to one''s senses', 'come to', '["come to one''s senses"]');
INSERT INTO idiom_forms_migration_0053 VALUES ('crossover-idiom-a6a3a7fd7fe7e556207305b8', 'make up one''s face / make oneself up', 'make up one''s face', '["make oneself up"]');
INSERT INTO idiom_forms_migration_0053 VALUES ('crossover-idiom-d0bcbae79fd7b9e125dad3ee', 'turn O around / round', 'turn O around', '["turn O round"]');
INSERT INTO idiom_forms_migration_0053 VALUES ('crossover-idiom-c3834e587dd1cafda5a4210c', 'have / get one''s (own) way', 'have one''s (own) way', '["get one''s (own) way"]');
INSERT INTO idiom_forms_migration_0053 VALUES ('crossover-idiom-46ce4ac2581e7bdcf27f9b25', 'stand around / about', 'stand around', '["stand about"]');
INSERT INTO idiom_forms_migration_0053 VALUES ('crossover-idiom-1f09fa3105ab3d9bab3082b6', 'take pride in O / Ving', 'take pride in O', '["take pride in Ving"]');
INSERT INTO idiom_forms_migration_0053 VALUES ('crossover-idiom-bb063d4b455e9cef03da4100', 'be particular about / over O', 'be particular about O', '["be particular over O"]');
INSERT INTO idiom_forms_migration_0053 VALUES ('crossover-idiom-f96e0b9305b0365bfcbb3d2f', 'be indifferent to / toward(s) O', 'be indifferent to O', '["be indifferent toward(s) O"]');
INSERT INTO idiom_forms_migration_0053 VALUES ('grammar-idiom-81cd8cf644a943427211', 'be devoted / dedicated to O', 'be devoted to O', '["be dedicated to O"]');
INSERT INTO idiom_forms_migration_0053 VALUES ('crossover-idiom-b636532926dace33cb3045b4', 'on and off / off and on', 'on and off', '["off and on"]');
INSERT INTO idiom_forms_migration_0053 VALUES ('crossover-idiom-42331205b90e79c8ddf7eec0', 'in comparison with / to O', 'in comparison with O', '["in comparison to O"]');
INSERT INTO idiom_forms_migration_0053 VALUES ('crossover-idiom-8f801f951b378aaf176aa711', 'in contrast to / with O', 'in contrast to O', '["in contrast with O"]');
INSERT INTO idiom_forms_migration_0053 VALUES ('crossover-idiom-984865ebf9bb499ddce28443', 'on the brink of O / Ving', 'on the brink of O', '["on the brink of Ving"]');
INSERT INTO idiom_forms_migration_0053 VALUES ('crossover-idiom-2086baa5bdabd16eca53106e', 'on the verge of O / Ving', 'on the verge of O', '["on the verge of Ving"]');
INSERT INTO idiom_forms_migration_0053 VALUES ('crossover-idiom-063dad045bc4c1176696789d', 'Long time no see. / It’s been a long time.', 'Long time no see.', '["It’s been a long time."]');
INSERT INTO idiom_forms_migration_0053 VALUES ('grammar-idiom-c18b881b81e0136c8a8c', 'Nice to meet you. / It’s a pleasure to meet you.', 'Nice to meet you.', '["It’s a pleasure to meet you."]');
INSERT INTO idiom_forms_migration_0053 VALUES ('grammar-idiom-bf72a70fc4acfd605f8f', 'How is everything / How are things / How’s it going?', 'How is everything?', '["How are things?", "How’s it going?"]');
INSERT INTO idiom_forms_migration_0053 VALUES ('grammar-idiom-ab55a60854e1b699c68a', 'What’s up? / What’s happening?', 'What’s up?', '["What’s happening?"]');
INSERT INTO idiom_forms_migration_0053 VALUES ('grammar-idiom-a2cf6cdbb29a3a9e3578', 'I’m fine. / I’m doing well. / Not too bad.', 'I’m fine.', '["I’m doing well.", "Not too bad."]');
INSERT INTO idiom_forms_migration_0053 VALUES ('grammar-idiom-b85013a2f9aa72c07c66', 'Where are you from? / Where do you come from?', 'Where are you from?', '["Where do you come from?"]');
INSERT INTO idiom_forms_migration_0053 VALUES ('grammar-idiom-7f8128428831df68c686', 'See you later / soon. / So long. / Goodbye.', 'See you later.', '["See you soon.", "So long.", "Goodbye."]');
INSERT INTO idiom_forms_migration_0053 VALUES ('grammar-idiom-abab687c62f76c647944', 'Say hello / Remember me / Give my regards to A.', 'Say hello to A.', '["Remember me to A.", "Give my regards to A."]');
INSERT INTO idiom_forms_migration_0053 VALUES ('grammar-idiom-5691b867631a18af7a72', 'May I speak / talk to A?', 'May I speak to A?', '["May I talk to A?"]');
INSERT INTO idiom_forms_migration_0053 VALUES ('grammar-idiom-22f0d06ea81be09a3e54', 'Who’s calling / speaking? / Who is this?', 'Who’s calling?', '["Who’s speaking?", "Who is this?"]');
INSERT INTO idiom_forms_migration_0053 VALUES ('grammar-idiom-c1079621356fb5497cfb', 'Shall / May I take a message?', 'Shall I take a message?', '["May I take a message?"]');
INSERT INTO idiom_forms_migration_0053 VALUES ('grammar-idiom-8b7d5ce639f7fff40e2c', 'Can / May I leave a message (with A)?', 'Can I leave a message (with A)?', '["May I leave a message (with A)?"]');
INSERT INTO idiom_forms_migration_0053 VALUES ('grammar-idiom-9cebc68222b48c3ffedc', 'Please hold on / hold the line.', 'Please hold on.', '["Please hold the line."]');
INSERT INTO idiom_forms_migration_0053 VALUES ('grammar-idiom-7f23ac7131a59df6efd4', 'The line is busy / engaged.', 'The line is busy.', '["The line is engaged."]');
INSERT INTO idiom_forms_migration_0053 VALUES ('grammar-idiom-7ee63952e8fed8453961', 'A is on another line / phone.', 'A is on another line.', '["A is on another phone."]');
INSERT INTO idiom_forms_migration_0053 VALUES ('grammar-idiom-4248ccac72ee85826d31', 'May / Can I help you? / What can I do for you?', 'May I help you?', '["Can I help you?", "What can I do for you?"]');
INSERT INTO idiom_forms_migration_0053 VALUES ('grammar-idiom-71c856b936b77f78a3c5', 'What’s the price of A? / How much is A?', 'What’s the price of A?', '["How much is A?"]');
INSERT INTO idiom_forms_migration_0053 VALUES ('crossover-idiom-985c703d6444f3aa93c4d560', 'Let''s split the bill / Let''s go Dutch', 'Let''s split the bill', '["Let''s go Dutch"]');
INSERT INTO idiom_forms_migration_0053 VALUES ('grammar-idiom-373a770fce21c2499bad', 'May / Can I take your order?', 'May I take your order?', '["Can I take your order?"]');
INSERT INTO idiom_forms_migration_0053 VALUES ('grammar-idiom-612263930a2428a2f611', 'Have you been waited on / served?', 'Have you been waited on?', '["Have you been served?"]');
INSERT INTO idiom_forms_migration_0053 VALUES ('grammar-idiom-8f80443619c9f16506ed', 'The same for me. / Same here.', 'The same for me.', '["Same here."]');
INSERT INTO idiom_forms_migration_0053 VALUES ('grammar-idiom-0d9b1355e892e689b03d', 'I’m full. / I’ve had enough / plenty / lots.', 'I’m full.', '["I’ve had enough.", "I’ve had plenty.", "I’ve had lots."]');
INSERT INTO idiom_forms_migration_0053 VALUES ('grammar-idiom-7615e641a29c708d93e9', 'Let me pay my bill / share.', 'Let me pay my bill.', '["Let me pay my share."]');
INSERT INTO idiom_forms_migration_0053 VALUES ('grammar-idiom-5d6abbd62c435f3f8c8f', 'It’s on me. / I’ll treat you. / It’s my treat. / Be my guest.', 'It’s on me.', '["I’ll treat you.", "It’s my treat.", "Be my guest."]');
INSERT INTO idiom_forms_migration_0053 VALUES ('grammar-idiom-e3a53266206d40547099', 'Do / Would you mind if S V?', 'Do you mind if S V?', '["Would you mind if S 過去形?"]');
INSERT INTO idiom_forms_migration_0053 VALUES ('grammar-idiom-2cbc47d1a6b0aac3a5be', 'Do / Would you mind my Ving?', 'Do you mind my Ving?', '["Would you mind my Ving?"]');
INSERT INTO idiom_forms_migration_0053 VALUES ('grammar-idiom-c6dcc2e68f3d47b31a57', 'Would you be kind / good enough to V?', 'Would you be kind enough to V?', '["Would you be good enough to V?"]');
INSERT INTO idiom_forms_migration_0053 VALUES ('grammar-idiom-664e6f8f8201526f4f29', 'Would you do me a favor? / May I ask a favor of you?', 'Would you do me a favor?', '["May I ask a favor of you?"]');
INSERT INTO idiom_forms_migration_0053 VALUES ('grammar-idiom-b678258c51274114b543', 'Go ahead. / No problem. / Certainly. / Why not?', 'Go ahead.', '["No problem.", "Certainly.", "Why not?"]');
INSERT INTO idiom_forms_migration_0053 VALUES ('grammar-idiom-f1f5175cac7219d52742', 'No way. / Absolutely not.', 'No way.', '["Absolutely not."]');
INSERT INTO idiom_forms_migration_0053 VALUES ('ga-idiom-92fffd41392ea79c6637', 'No, I don’t. / Not at all. / Of course not.', 'No, I don’t.', '["Not at all.", "Of course not."]');
INSERT INTO idiom_forms_migration_0053 VALUES ('grammar-idiom-6db914c9113c9b9401bd', 'After you. / I’ll follow you.', 'After you.', '["I’ll follow you."]');
INSERT INTO idiom_forms_migration_0053 VALUES ('grammar-idiom-9513e235892488ebb85a', 'You’re welcome. / Don’t mention it. / Never mind. / Don’t worry.', 'You’re welcome.', '["Don’t mention it.", "Never mind.", "Don’t worry."]');
INSERT INTO idiom_forms_migration_0053 VALUES ('grammar-idiom-d741080760f3e02b93fb', 'What’s the matter / problem? / What’s wrong?', 'What’s the matter?', '["What’s the problem?", "What’s wrong?"]');
INSERT INTO idiom_forms_migration_0053 VALUES ('crossover-idiom-138a7aa152ecd60b2c565ab8', 'I dare say / I daresay', 'I dare say', '["I daresay"]');
INSERT INTO idiom_forms_migration_0053 VALUES ('crossover-idiom-7a3b2662f1ba0231c6717caa', 'I tell you / I''m telling you', 'I tell you', '["I''m telling you"]');

-- Keep an exact, durable snapshot; preserve all existing senses, notes and IDs.
INSERT INTO idiom_migration_backup (migration_key, word_id, snapshot)
SELECT '0053_idiom_alternate_forms', i.id,
 json_object('phrase',i.phrase,'aliases',json(i.aliases),'alternate_forms',json(i.alternate_forms),'updated_at',i.updated_at)
FROM idioms i JOIN idiom_forms_migration_0053 m ON i.id=m.id
WHERE i.list_id='crossover-v3' AND i.hidden=0 AND i.phrase=m.old_phrase AND i.alternate_forms='[]';

-- Guard the old heading so edits made after the audit are never overwritten.
UPDATE idioms SET
 phrase=(SELECT new_phrase FROM idiom_forms_migration_0053 WHERE id=idioms.id),
 alternate_forms=(SELECT alternate_forms FROM idiom_forms_migration_0053 WHERE id=idioms.id),
 aliases=CASE WHEN EXISTS (SELECT 1 FROM json_each(idioms.aliases) a
   WHERE CASE a.type WHEN 'object' THEN json_extract(a.value,'$.phrase') ELSE a.value END=idioms.phrase)
   THEN aliases ELSE json_insert(aliases,'$[#]',phrase) END,
 updated_at=datetime('now')
WHERE list_id='crossover-v3' AND hidden=0 AND alternate_forms='[]'
 AND EXISTS (SELECT 1 FROM idiom_forms_migration_0053 m WHERE m.id=idioms.id AND m.old_phrase=idioms.phrase);
DROP TABLE idiom_forms_migration_0053;
