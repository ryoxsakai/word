// Indices refer to the reviewed snapshot's phrase rows, not database example IDs.
// Every removal has an explicit idiom destination, word destination, or merge.
export const policy = {
  matter: { move: {3:'prep-other',5:'prep-other',6:'make'} },
  pay: { move: {5:'make'}, exception:'payとpaymentの連語を含む6項目を維持' },
  sell: { move: {3:'prep-for',4:'prep-on'} },
  do: { move:{4:'do',5:'do',6:'do',10:'do',11:'do'}, word:{9:'impossible'},
    merge:[{indices:[0,8],phrase:'(O) will do',meaning:'（Oで）間に合う・用が足りる'},
      {indices:[1,2],phrase:'do A good / harm',meaning:'Aのためになる／Aに害を与える'}],
    split:{7:[['could do with O','Oが欲しい・Oがあればありがたい'],['be / have done with O','Oを済ませる・Oと縁を切る'],['what to do with O','Oをどう扱うか・どう処理するか']] } },
  fall: { merge:[{indices:[0,1,2],phrase:'fall asleep / ill / silent',meaning:'眠りに落ちる／病気になる／黙り込む'}],move:{3:'fall',4:'fall',5:'fall'} },
  come: {move:{4:'come',5:'come',6:'come',7:'come',8:'come'}},
  go: {move:{6:'go',7:'go',8:'go',10:'go',11:'go'},merge:[{indices:[0,1,2,9],phrase:'go wrong / bad / bankrupt / blind',meaning:'うまくいかなくなる／腐る／破産する／失明する'}]},
  turn:{move:{5:'turn'}},
  look:{move:{4:'vision',6:'vision',7:'vision',8:'vision',9:'vision'}},
  mention:{word:{3:'refer'}},
  show:{move:{4:'show',5:'show',6:'show'}},
  prepare:{move:{4:'prep-in'}},
  take:{move:{4:'take',5:'take',6:'take'}},
  ask:{merge:[{indices:[2,5],phrase:'ask (A) for B',meaning:'（Aに）Bを求める'}]},
  wish:{merge:[{indices:[1,2],phrase:'wish A good luck / a happy birthday',meaning:'Aの幸運を祈る／Aの誕生日を祝う'}]},
  hold:{move:{3:'hold',4:'hold',5:'hold',6:'hold',7:'hold',8:'take'}},
  think:{move:{2:'think',3:'think',6:'think',7:'think',8:'come'}},
  order:{move:{4:'prep-other',5:'prep-out',6:'prep-in'}},
  help:{move:{4:'prep-with'}},
  get:{move:{5:'get',6:'get',7:'get',8:'get',9:'get',10:'get'}},
  make:{move:{5:'make',6:'make',7:'make',8:'make',9:'make',10:'make'}},
  feel:{move:{5:'adjective-emotion'}},
  find:{merge:[{indices:[3,5],phrase:'find oneself Ving / C',meaning:'気づくとVしている／Cの状態・場所にいる'}]},
  leave:{merge:[{indices:[0,1],phrase:'leave O doing / done',meaning:'OをVしている／Vされた状態のままにしておく'}]},
  keep:{move:{3:'keep',4:'keep',7:'keep'},merge:[{indices:[2,6],phrase:'keep A from B / Ving',meaning:'AにB・Vすることをさせない／AをBから守る'}]},
  promise:{move:{2:'make',3:'keep',4:'break'}},
  desire:{merge:[{indices:[0,2],phrase:'desire to V / desire O to V',meaning:'Vすることを／OがVすることを強く望む'}]},
  imagine:{move:{6:'prep-other'},merge:[{indices:[0,1],phrase:"imagine (O's / O) Ving",meaning:'（Oが）Vすることを想像する'}]},
  mind:{move:{4:'make',5:'keep'}},
  risk:{move:{2:'run',5:'prep-at'}},
  miss:{merge:[{indices:[0,1],phrase:'miss Ving / being O',meaning:'Vする機会を逃す／Vしたこと・Oだったことを懐かしく思う'}]},
  try:{move:{5:'give'}},
  need:{move:{5:'prep-in'}},
  fear:{merge:[{indices:[3,5],phrase:'for fear of O / Ving',meaning:'O・Vすることを恐れて／Vするといけないから'}]},
  question:{move:{2:'call',3:'prep-other',4:'prep-without',5:'prep-out'}},
  doubt:{move:{4:'prep-other'}},
  surprise:{move:{4:'take',5:'prep-other'}},
  important:{merge:[{indices:[4,5],phrase:'be of (great) importance',meaning:'（非常に）重要である'}]},
  preferable:{merge:[{indices:[2,5],phrase:'A is preferable to B',meaning:'AはBより好ましい・優れている'}]},
  possible:{merge:[{indices:[3,4],phrase:'the best possible solution / the best solution possible',meaning:'（前置・後置ともに）考え得る最善の解決策'}]},
  concerned:{move:{5:'adjective-emotion',6:'adjective-relation'}},
  certain:{move:{5:'prep-for'}},
  sure:{move:{4:'prep-for',5:'adjective-state'}},
  while:{move:{4:'prep-for',5:'prep-in'}},
  one:{move:{4:'prep-other'}},
  such:{move:{4:'prep-other'}},
  that:{move:{5:'prep-in',6:'prep-at'}},
  all:{move:{4:'prep-at',5:'prep-other',6:'prep-other',7:'prep-in',8:'prep-other',9:'prep-in',10:'prep-for',11:'prep-with'},exception:'量化・部分否定・比較・all butの対照を6項目で維持'},
  more:{exception:'比較・数量表現の6項目を維持'},
  many:{exception:'数の一致・many a・数量表現の6項目を維持'},
  much:{exception:'不可算名詞・比較・否定・接続用法の7項目を維持'},
  so:{move:{3:'do'},exception:'程度・目的・結果・条件・相関構文の6項目を維持'},
  as:{move:{7:'prep-other',8:'prep-other',9:'prep-other'},merge:[{indices:[1,3],phrase:'as S V',meaning:'SがVするとき／SがVするので／SがVするにつれて'}],exception:'前置詞・接続詞・比較・譲歩の6項目を維持'},
  too:{merge:[{indices:[0,1],phrase:'too＋形容詞・副詞 (for O) to V',meaning:'（Oが）Vするには…すぎる'}],exception:'不定詞・数量・追加・強調の6項目を維持'},
  even:{move:{5:'get'}},
  way:{move:{1:'prep-by',2:'prep-in',6:'prep-by',7:'prep-in',8:'prep-on',9:'prep-in',10:'get',11:'prep-other',13:'go'},merge:[{indices:[0,12],phrase:'the way S V / (in) the way S V',meaning:'SがVする方法・様子・やり方／SがVする様子から'}]},
  well:{move:{5:'adjective-state'},exception:'副詞・形容詞・助動詞との構文対照を7項目で維持'},
  rather:{merge:[{indices:[2,5],phrase:'would / had rather V (than O)',meaning:'（Oするよりも）むしろVしたい'}]},
};

const verbs = 'vision get let call take come stand break turn hand put pick go pull bring pass give make do hold think show talk tell speak say catch keep set carry cut run work lay hang throw fall'.split(' ');
export const chapters = [
  {key:'verbs',subtitle:'動詞を中心とする熟語',sections:verbs.map(key=>({key,subtitle:key==='vision'?'look・see・watch':key}))},
  {key:'adjectives',subtitle:'形容詞と前置詞',sections:[
    {key:'adjective-emotion',subtitle:'感情・関心'}, {key:'adjective-relation',subtitle:'関係・相違'}, {key:'adjective-state',subtitle:'状態・認識'},
  ]},
  {key:'prepositions',subtitle:'前置詞を中心とする熟語',sections:[...'in on out at for by from with without'.split(' ').map(p=>({key:`prep-${p}`,subtitle:p})),{key:'prep-other',subtitle:'その他の前置詞'}]},
];

export const returnToWords = new Set(['other-verbs','quantity','conjunction','construction']);
export const phraseSections = {
  'at best':'prep-at','at least':'prep-at','be in good spirits':'prep-in',
  'I dare say / I daresay':'say',"I tell you / I'm telling you":'tell',"I'll say":'say',"I'll see":'vision',"I'll tell you what":'tell',
  'Long time no see':'vision','So I see':'vision','What do you say to Ving?':'say',"You're telling me":'tell',
  '(at) first hand':'prep-at',"have / get one's (own) way":'get','N to come':'come','that is (to say)':'say','Who do you work for?':'work',
  'be / get carried away':'carry','be caught in a shower':'catch','be cut out for O':'cut',
  'be made from O':'make','be made into O':'make','be made of O':'make','be made up of O':'make',
};

export function destination(entry) {
  if (phraseSections[entry.phrase]) return phraseSections[entry.phrase];
  if (returnToWords.has(entry.sectionKey) || ['more or less','sooner or later','be bound to V','be hungover / hung over','be married to O'].includes(entry.phrase)) return null;
  if (['look','see','watch'].includes(entry.sectionKey)) return 'vision';
  if (entry.sectionKey === 'be-adjective') {
    if (/anxious|concerned (about|for)|indifferent|particular/.test(entry.phrase)) return 'adjective-emotion';
    if (/dependent|different|opposed|opposite|peculiar|concerned (with|in)/.test(entry.phrase)) return 'adjective-relation';
    return 'adjective-state';
  }
  if (entry.sectionKey.startsWith('prep-') && !chapters[2].sections.some(s=>s.key===entry.sectionKey)) return 'prep-other';
  return entry.sectionKey;
}
