"""Build the reviewed grammar curriculum from source candidates and an idiom snapshot.

Usage: python worker/scripts/prepare-grammar-curriculum.py candidates.json idioms.json
Source is the user-supplied grammar checkpoint booklet, lessons 1–22. The exercise
book supplies the eight chapter titles; chapter nine collects idioms/conversation.
"""
import copy, hashlib, json, re, sys
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
raw=json.load(open(sys.argv[1])); original=json.load(open(sys.argv[2]))
def uid(s):return hashlib.sha256(s.encode()).hexdigest()[:20]
def norm(s):
 s=s.replace('’',"'").replace('…','O').replace('〜','O')
 s=re.sub(r'\b[AB]\b','O',s)
 if len(re.findall(r'\bO\b',s))<=1 and not re.search(r'\b(V|Ving|C|S|V-ed)\b',s):s=re.sub(r'\bO\b','',s)
 s=s.lower()
 s=re.sub(r'\([^)]*\)','',s)
 s=re.sub(r'[^a-z0-9\u3040-\u9fff]+','',s)
 return s
def expand(s):
 s=s.replace('’',"'").replace('*','').strip()
 m=re.search(r'([A-Za-z]+)\[([^\]]+)\]',s)
 if m:
  choices=[m[1]]+re.split(r'[,/]',m[2])
  return [v for c in choices for v in expand(s[:m.start()]+c.strip()+s[m.end():])]
 # Only split complete alternatives here; shared-tail slash forms stay together.
 chunks=s.split(' / ')
 if len(chunks)>1 and (all(len(c.split())>=2 for c in chunks) or all(re.search(r'[.!?]$',c) for c in chunks)):return chunks
 return [s]
chapters=[
 ('patterns','文型と動詞'),('verbs','本動詞〈時制・相・態・助動詞・仮定法〉'),
 ('verbals','準動詞〈不定詞・動名詞・分詞〉'),('relatives','関係詞と疑問詞'),
 ('connectors','接続詞と前置詞'),('nouns','名詞・冠詞・代名詞'),
 ('comparison','比較と形容詞・副詞'),('special','否定と特殊構文'),('idioms','イディオムと会話表現')]
# Group order follows the user's teaching units, with section order defined below.
groups={1:(0,'文型'),2:(0,'動詞の語法'),3:(1,'時制'),4:(1,'助動詞'),5:(1,'仮定法'),6:(1,'受動態'),
7:(2,'不定詞'),8:(2,'動名詞'),9:(2,'分詞'),12:(3,'関係詞'),13:(3,'疑問詞・一致と話法'),
10:(4,'接続詞'),11:(4,'前置詞'),15:(5,'名詞・冠詞'),14:(5,'代名詞'),
17:(6,'比較'),16:(6,'形容詞・副詞'),18:(7,'否定'),19:(7,'特殊構文'),
20:(8,'イディオム1'),21:(8,'イディオム2'),22:(8,'会話表現')}
section_order={
1:['決まった形を取る第2文型動詞','決まった形を取る第4文型動詞','目的語・補語の形','前置詞を伴う自動詞'],
2:['通知のof','要求のof','分離のof','理由のfor','交換のfor','変化のinto','供給のwith','接続のwith','対象のto','同一のas','区別のfrom','妨害のfrom','説得のinto・out of','その他の決まった語法'],
3:['時を表す表現','完了形の決まった表現','未来・依頼の表現'],4:['助動詞の慣用表現'],5:['もし〜がなければ','願望・仮定を表す形'],6:['前置詞に注意する受動表現'],
7:['to Vを伴う決まった表現','不定詞の慣用構文','独立不定詞'],8:['to VとVingの選択','前置詞to＋Ving','動名詞の慣用表現'],9:['独立分詞構文','分詞を伴う決まった形'],
12:['whatを含む慣用表現','関係詞の決まった形'],13:['疑問詞の慣用表現','一致・話法に関わる表現'],
10:['時・条件・譲歩','相関表現','that節を伴う表現'],11:['前置詞の決まった組合せ','複合前置詞'],
15:['複数形を使う慣用表現','数量と冠詞の表現'],14:['不定代名詞の慣用表現','itを含む慣用表現'],
17:['比較の慣用表現','比較の決まった形'],16:['形容詞の位置と組合せ','つなぎの副詞表現'],
18:['否定の慣用表現'],19:['応答・代用','省略を含む慣用表現','強調・倒置の決まった形'],
20:['自動詞＋副詞','動詞＋前置詞＋目的語','他動詞＋目的語＋副詞','動詞＋副詞＋前置詞','動詞＋名詞','名詞を含む2語の表現','名詞を含む3語の表現','名詞を含む4語以上の表現','その他の動詞表現'],
21:['形容詞＋前置詞','過去分詞＋前置詞','形容詞・過去分詞＋to V','形容詞・副詞を含むその他の表現','前置詞＋名詞＋前置詞','慣用的な比喩表現'],
22:['あいさつ','電話','買い物','レストラン','依頼・許可・提案・勧誘','感謝・謝罪・体調','その他の応答表現']}
def sec(l,name):
 assert name in section_order[l],(l,name)
 return f'grammar-{l}-{section_order[l].index(name)+1}'
def section_for(i,l):
 if l==1:return section_order[l][0 if i<6 else 1 if i>=26 else 3]
 if l==3:return section_order[l][1 if i>=36 else 2 if i>=33 else 0]
 if l==7:return section_order[l][2 if i>=77 else 0]
 if l==8:return section_order[l][0 if i<118 else 1 if i<=123 else 2]
 if l==10:return section_order[l][0 if i<170 else 1 if i<177 else 2]
 if l==11:return section_order[l][0 if i<245 else 1]
 if l==14:return section_order[l][1 if i>=298 else 0]
 if l==15:return section_order[l][1 if i>=342 else 0]
 if l==16:return section_order[l][1 if i>=413 else 0]
 if l==19:return section_order[l][0 if i<=468 else 1]
 if l==20:
  return section_order[l][0 if i<490 else 1 if i<510 else 2 if i<524 else 3 if i<542 else 5 if i<574 else 6 if i<594 else 7 if i<602 else 4]
 if l==21:return section_order[l][0 if i<641 else 1 if i<657 else 2 if i<669 else 3 if i<684 else 4 if i<704 else 5]
 if l==22:return section_order[l][0 if i<729 else 1 if i<741 else 2 if i<746 else 3 if i<754 else 4 if i<765 else 5]
 return section_order[l][0]
selected=set(range(6))|set(range(21,38))|set(range(43,149))|{151,156,157,158,160,161,162,163,166,167,168}|set(range(170,187))|{195,201,212,232,237,238}|set(range(239,293))|set(range(294,304))|set(range(328,332))|{342,343}|set(range(362,367))|{413,416,417,418}|set(range(419,439))|set(range(447,475))|set(range(475,777))
# Editorial corrections: avoid copying source typos, incomplete patterns and
# false equivalences. The original text stays available in the audit inventory.
fix={
2:('go wrong (with O)','Oに不具合が生じる・うまくいかなくなる'),23:('apologize to A for B','AにBのことで謝る'),
31:('期間 ago','〜前に'),32:('last ＋時を表す名詞','この前の〜に'),33:('Shall I V?','私がVしましょうか'),34:('Shall we V?','一緒にVしましょうか'),35:('Will you V?','Vしていただけますか'),
43:('cannot V too ＋形容詞・副詞','いくら〜でもVしすぎることはない'),44:('cannot help Ving','Vせずにはいられない'),
45:('would like O','Oが欲しい'),47:('may well V','たぶんVするだろう／Vするのも当然だ'),48:('may / might as well V','ほかによい選択肢がないのでVしたほうがよい'),
49:('might as well V1 as V2','V2するくらいならV1するほうがましだ'),71:('be about to V','まさにVしようとしている'),
74:('be eager to V / be anxious to V','Vしたがっている'),118:('look forward to O / Ving','O・Vすることを楽しみに待つ'),
121:('What do you say to Ving?','Vするのはどうですか'),122:('when it comes to O / Ving','O・Vすることとなると'),
124:('物 need Ving / 物 want Ving','物がVされる必要がある'),134:('cannot help Ving','Vせずにはいられない'),140:('It goes without saying that S V','SがVするのは言うまでもない'),141:('considering O / given O','Oを考慮すると'),
157:('as soon as S V / the moment S V / the instant S V / the minute S V','SがVするとすぐに'),
158:('as long as S V / so long as S V','SがVするかぎり'),
160:('on condition that S V / provided that S V / providing that S V / supposing that S V','SがVするという条件で・もしSがVするなら'),
161:('even if S V','たとえSがVしても'),162:('in case S V / for fear that S V / lest S V','SがVする場合に備えて／SがVするといけないので'),
167:('even though S V','実際にSがVするにもかかわらず'),168:('whereas S V','一方でSがVするのに対して'),
177:('see (to it) that S V','SがVするように取り計らう'),182:('take it for granted that S V','SがVするのを当然と思う'),
175:('命令文, and S V','〜しなさい、そうすればSがVする'),176:('命令文, or S V','〜しなさい、さもないとSがVする'),232:("to one's surprise",'驚いたことに'),237:('under control','制御・管理されて'),238:('die of O','病気などのOで死ぬ'),249:('on behalf of O / in behalf of O','Oを代表して・Oのために'),
241:('be concerned with O','Oに関係している・Oを扱っている'),246:('as to O','Oに関して'),
271:('what is called O','いわゆるO'),275:('what few ＋複数名詞 / what little ＋不可算名詞','少ないながらもあるだけの〜'),280:('What if S V?','もしSがVしたらどうだろう'),
281:('Why not V?','Vしてはどうですか'),287:('one after the other','順に・次々に'),288:('one after another','次々に'),
301:('Let it be.','そのままにしておきなさい'),302:('Let it go.','そのことはもう気にしないで・忘れなさい'),
413:('as a result','その結果'),416:('in short / in brief / that is','要するに・つまり'),417:('or else','さもないと'),418:('for example / for instance','例えば'),
419:('as ＋形容詞・副詞＋ as possible','できるだけ〜'),420:('as ＋形容詞・副詞＋ as ever','相変わらず〜'),421:('as good as O','Oも同然で'),422:('as ＋形容詞＋ a 名詞 as ever lived','今までに類を見ないほど〜な人'),430:('know better than to V','Vするほど愚かではない'),
435:('at most','多くとも'),437:('at least','少なくとも'),447:('the last A to V','最もVしそうにないA'),450:('remain to be V-ed','まだVされていない・今後Vされる必要がある'),451:('too ＋形容詞・副詞＋ to V','〜すぎてVできない'),
452:('prevent A from Ving','AがVするのを妨げる'),453:('above A','人のAには理解できない'),
459:('It was not long before S 過去形','ほどなくSが〜した'),460:('It will not be long before S V','まもなくSがVするだろう'),521:('pick O up','Oを拾い上げる・Oを車に乗せる'),530:('get through with O','Oを終える・済ませる'),
542:('above all / in particular','特に'),544:('at hand','手元に・近くに／時が近づいて'),547:('at last / at length','とうとう・ついに'),548:('at random','無作為に・手当たり次第に'),552:('before long','まもなく'),554:('by degrees','徐々に'),557:('by turns','交互に・かわるがわる'),560:('for good','永久に'),562:('in advance','前もって'),565:('in earnest','真剣に・本格的に'),572:('on purpose','わざと・故意に'),581:('in any case','いずれにしても'),
566:('in person','本人が直接・じかに'),568:('in private','人前を避けて・内々に'),569:('in public','人前で・公然と'),
588:('in fashion','流行して'),589:('out of fashion','流行遅れで'),592:('to the point','的を射た・要領を得た'),593:('off the point','的外れの'),
595:('as a matter of fact','実際には・実のところ'),603:('take place','起こる・行われる'),607:('keep time','時計が正確に時を刻む／拍子を取る'),
645:('be concerned with O','Oに関係している・Oを扱っている'),665:('be expected to V','Vすることを期待・予想されている'),669:('all at once / all of a sudden','突然に'),670:('all but','ほとんど'),674:('be badly off / be poorly off','暮らし向きが悪い・貧しい'),683:('more often than not / most of the time','たいてい・多くの場合'),
718:('Nice to meet you. / How do you do?','はじめまして'),725:('Who do you work for? / Where do you work?','どちらにお勤めですか'),
741:('May I help you? / Can I help you? / What can I do for you?','いらっしゃいませ・何かお手伝いしましょうか'),
753:("It's on me. / I'll treat you. / It's my treat. / Be my guest.",'私がおごります'),754:('Do you mind if S V? / Would you mind if S 過去形? / Do you mind my Ving? / Would you mind my Ving?','Vしてもよいですか'),755:('Would you be kind enough to V? / Would you be good enough to V?','Vしていただけませんか'),765:('Thanks for Ving','Vしてくれてありがとう'),
756:('Would you do me a favor? / May I ask a favor of you?','お願いがあります'),
757:('Go ahead. / No problem. / By all means. / Certainly.','どうぞ・かまいません'),
760:('What do you say to Ving? / How about Ving? / What about Ving?','Vしませんか'),
761:("Why don't you V? / Why not V?",'Vしてはどうですか'),762:("Why don't we V?",'一緒にVしませんか'),
764:('After you.','お先にどうぞ'),766:("Don't mention it. / You're welcome.",'どういたしまして'),
772:('I would appreciate it if you would V','Vしていただけるとありがたいのですが')}
def clean(p,l,i):
 p=p.replace('’',"'").replace('…','O').replace('〜','O').replace('Vpp.','V-ed').replace('Vpp','V-ed')
 p=re.sub(r'\bto do\b','to V',p)
 p=re.sub(r'\s+',' ',p).strip()
 if re.fullmatch(r'be used to (O|Ving)',p):p='be used to O / Ving'
 if re.fullmatch(r'(what|how) about (O|Ving)\s*\?',p,re.I):p=p.split()[0].capitalize()+' about O / Ving?'
 p=re.sub(r'\s+([?!])',r'\1',p)
 if l==7 and p.endswith('to'):p+=' V'
 if (l in [1,6,11,21] or l==20 and (490<=i<510 or 524<=i<542 or i>=542)) and not re.search(r'\b[ABO]\b',p) and re.search(r'\b(to|of|for|from|with|about|in|at|on|among|into|than|over|beyond|without|before|after)$',p):p+=' O'
 if l==10 and i not in range(170,177) and not re.search(r'\b[SVAB]\b',p):p+=' S V'
 p=re.sub(r'\.\s+(?=[A-Za-z])','.  ',p)
 return p
audit=[];candidates=[]
for i,r in enumerate(raw):
 row={**r,'candidateId':i,'decision':'excluded','reason':'単独語・活用表・一般説明は単語帳側で扱う'}
 if i not in selected:audit.append(row);continue
 p,m=fix.get(i,(r['phrase'],r['meaning']))
 if 85<=i<=93:p+=' to V'
 if 94<=i<=109:p+=' Ving'
 if 85<=i<=109:m='Vすることを'+m
 if i==88:m='Vするつもりである・Vすると予想する'
 if i==110:m='忘れずにVする'
 if i==112:m='Vするのを忘れる'
 if i in (36,37):p+=' O'
 variants=expand(p)
 for p in variants:
  p=clean(p,r['lecture'],i)
  # Single-word synonyms and incomplete list fragments are not idiom entries.
  if len(p.split())<2 and r['lecture']!=22:continue
  if '[' in p or ']' in p:
   p=p.replace('[',' (').replace(']',')')
  s=section_for(i,r['lecture'])
  candidates.append({'phrase':p,'meaning':m.replace('…','〜').replace('\n','').strip(),'lecture':r['lecture'],'section':s,'candidateId':i})
 row.update(decision='reviewed',reason='原資料の表現を正規化。既存照合は次の段階で記録',correction=fix.get(i))
 audit.append(row)

# Non-bullet examples and explanatory patterns, explicitly reviewed by lesson.
manual='''1|目的語・補語の形|allow O to V|OがVするのを許す
1|目的語・補語の形|enable O to V|OがVできるようにする
1|目的語・補語の形|force O to V|OにVすることを強いる
1|目的語・補語の形|keep O C|OをCの状態に保つ
1|目的語・補語の形|leave O C|OをCの状態にしておく
1|目的語・補語の形|make O V|OにVさせる
1|目的語・補語の形|have O V|OにVしてもらう
1|目的語・補語の形|let O V|OにVさせる
1|目的語・補語の形|see O V / see O Ving|OがVするのを見る
1|目的語・補語の形|hear O V / hear O Ving|OがVするのを聞く
2|通知のof|inform A of B|AにBを知らせる
2|通知のof|remind A of B|AにBを思い出させる
2|通知のof|convince A of B|AにBを確信させる
2|要求のof|ask B of A|AにBを求める
2|要求のof|demand B of A|AにBを要求する
2|分離のof|rob A of B|AからBを奪う
2|分離のof|deprive A of B|AからBを奪う
2|分離のof|cure A of B|Aの病気Bを治す
2|理由のfor|blame A for B|BのことでAを責める
2|理由のfor|thank A for B|BのことでAに感謝する
2|理由のfor|praise A for B|BのことでAを褒める
2|理由のfor|forgive A for B|BのことでAを許す
2|交換のfor|exchange A for B|AをBと交換する
2|交換のfor|mistake A for B|AをBと間違える
2|変化のinto|turn A into B|AをBに変える
2|変化のinto|translate A into B|Aを言語Bに訳す
2|変化のinto|divide A into B|AをBに分ける
2|供給のwith|provide A with B|AにBを供給する
2|供給のwith|supply A with B|AにBを供給する
2|供給のwith|equip A with B|AにBを備え付ける
2|供給のwith|replace A with B|AをBに取り替える
2|接続のwith|associate A with B|AをBと結び付ける
2|接続のwith|confuse A with B|AをBと混同する
2|接続のwith|identify A with B|AをBと同一視する
2|対象のto|devote A to B / Ving|AをB・Vすることに捧げる
2|対象のto|expose A to B|AをBにさらす
2|対象のto|adapt A to B|AをBに適応させる
2|同一のas|regard A as B|AをBとみなす
2|同一のas|look on A as B|AをBとみなす
2|区別のfrom|distinguish A from B|AをBと区別する
2|区別のfrom|tell A from B|AをBと見分ける
2|妨害のfrom|prevent A from Ving|AがVするのを妨げる
2|妨害のfrom|keep A from Ving|AがVするのを妨げる
2|妨害のfrom|protect A from B|AをBから守る
2|説得のinto・out of|persuade A into Ving|Aを説得してVさせる
2|説得のinto・out of|persuade A out of Ving|Aを説得してVさせない
2|その他の決まった語法|believe in O|Oの存在・価値を信じる
2|その他の決まった語法|doubt whether S V|SがVするかどうか疑わしく思う
2|その他の決まった語法|remind A to V|AにVするよう思い出させる
2|その他の決まった語法|come up with O|Oを思いつく
3|完了形の決まった表現|It has been 期間 since S 過去形|Sが〜してから期間がたつ
3|完了形の決まった表現|This is the first time S have V-ed|SがVするのはこれが初めてだ
4|助動詞の慣用表現|had better V|Vしたほうがよい
4|助動詞の慣用表現|used to V|以前はVしたものだ
4|助動詞の慣用表現|would rather V1 than V2|V2するよりV1したい
4|助動詞の慣用表現|would like to V|Vしたい
4|助動詞の慣用表現|would like O to V|OにVしてほしい
5|もし〜がなければ|but for O|Oがなければ・Oがなかったなら
5|もし〜がなければ|if it were not for O|Oがなければ
5|もし〜がなければ|if it had not been for O|Oがなかったなら
5|もし〜がなければ|were it not for O|Oがなければ
5|もし〜がなければ|had it not been for O|Oがなかったなら
5|願望・仮定を表す形|I wish S 過去形|Sが〜ならよいのに
5|願望・仮定を表す形|I wish S had V-ed|SがVしていたらよかったのに
5|願望・仮定を表す形|if only S 過去形|Sが〜でさえあればなあ
5|願望・仮定を表す形|as if S V / as though S V|まるでSがVするかのように
5|願望・仮定を表す形|It is high time S 過去形|もうSが〜してよいころだ
5|願望・仮定を表す形|would rather S 過去形|Sが〜してくれたほうがよい
7|不定詞の慣用構文|too ＋形容詞・副詞＋ to V|〜すぎてVできない
7|不定詞の慣用構文|形容詞・副詞＋ enough to V|Vするほど十分に〜だ
7|不定詞の慣用構文|so ＋形容詞＋ as to V|Vするほど〜だ
7|不定詞の慣用構文|only to V|結局Vすることになる
7|不定詞の慣用構文|never to V|その後二度とVしない
9|分詞を伴う決まった形|keep O Ving|OにVさせ続ける
9|分詞を伴う決まった形|have O V-ed|OをVしてもらう／OをVされる
9|分詞を伴う決まった形|with O Ving|OがVしている状態で
9|分詞を伴う決まった形|with O V-ed|OがVされた状態で
12|関係詞の決まった形|no matter what S V|Sが何をVしても
12|関係詞の決まった形|no matter how ＋形容詞・副詞＋ S V|どんなに〜でも
12|関係詞の決まった形|as is often the case with O|Oにはよくあることだが
12|関係詞の決まった形|what S used to be|かつてのS
12|関係詞の決まった形|what S is|現在のS
13|一致・話法に関わる表現|A as well as B|BだけでなくAも
13|一致・話法に関わる表現|say to oneself|心の中で思う・独り言を言う
15|数量と冠詞の表現|a piece of O|ひとつのO
15|数量と冠詞の表現|a pair of O|一組のO
15|数量と冠詞の表現|by the hour|時間単位で
17|比較の決まった形|prefer A to B|BよりAを好む
17|比較の決まった形|no more A than B|Bでないのと同様にAではない
17|比較の決まった形|no less A than B|Bであるのと同様にAである
17|比較の決まった形|as many O|同数のO
17|比較の決まった形|倍数 as ＋形容詞・副詞＋ as O|Oの〜倍ほど〜だ
18|否定の慣用表現|not always|いつも〜とは限らない
18|否定の慣用表現|not necessarily|必ずしも〜ではない
18|否定の慣用表現|anything but O|決してOではない
19|強調・倒置の決まった形|It is A that S V|SがVするのはAだ
19|強調・倒置の決まった形|not until O|Oになって初めて
19|強調・倒置の決まった形|no sooner had S V-ed than S 過去形|SがVするとすぐに〜した
19|強調・倒置の決まった形|hardly had S V-ed when S 過去形|SがVするとすぐに〜した
22|あいさつ|Long time no see.|久しぶり
22|依頼・許可・提案・勧誘|Yes, let's.|はい、そうしましょう
22|依頼・許可・提案・勧誘|No, let's not.|いいえ、やめておきましょう
22|電話|Speaking.|私です'''
for line in manual.splitlines():
 l,s,p,m=line.split('|');candidates.append({'phrase':p,'meaning':m,'lecture':int(l),'section':s,'candidateId':'manual-'+str(len(candidates))})
ROOT.joinpath('test/fixtures/grammar-source-audit.json').write_text(json.dumps(audit,ensure_ascii=False,indent=2)+'\n')
ROOT.joinpath('test/fixtures/grammar-candidates.json').write_text(json.dumps(candidates,ensure_ascii=False,indent=2)+'\n')
print(json.dumps({'sourceBullets':len(raw),'reviewedBullets':sum(a['decision']=='reviewed' for a in audit),'candidates':len(candidates)},ensure_ascii=False))

def keys(p):
 out=set()
 for part in expand(p):
  out.add(norm(part));out.add(norm(part.replace('(','').replace(')','')))
  # Common pedagogical object/gerund variants identify the same expression.
  out.add(norm(re.sub(r'\s*/\s*Ving\b','',part)))
 # Expand the single-word alternatives in compact stored phrases for matching
 # only. The stored spelling itself is kept unchanged.
 m=re.search(r'\b(\w+(?:\s*/\s*\w+)+)(\s+(?:O|A|B|Ving|of|to|with|in|for|as)\b.*)$',p)
 if m:
  for option in re.split(r'\s*/\s*',m[1]):out.add(norm(p[:m.start()]+option+m[2]))
 return out-{''}
entries=copy.deepcopy(original['entries'])
index={}
for e in entries:
 for k in keys(e['phrase']):index.setdefault(k,[]).append(e)
aliases={
 'with a view to Ving':'with a view to doing',
 'to make matters worse':'to make matters / things worse',
 'on behalf of O':'on / in behalf of O','in behalf of O':'on / in behalf of O',
 'with regard to O':'with / in regard to O','in regard to O':'with / in regard to O',
 'for lack of O':'for lack / want of O','for want of O':'for lack / want of O',
 'pull one\'s leg':"pull a person's leg",'at second hand':'at second hand / second-hand',
 'speak well of O':'speak well / highly of O',
 'get along with O':'get along / on with O',
}
for alias,canonical in aliases.items():
 target=next(e for e in entries if e['phrase']==canonical)
 for k in keys(alias):index[k]=[target]
seen={};matches=[];ambiguous=[]
for c in candidates:
 possible={e['key']:e for k in keys(c['phrase']) for e in index.get(k,[])}
 exact=[e for e in possible.values() if e['phrase'].casefold()==c['phrase'].casefold()]
 if exact:possible={e['key']:e for e in exact}
 if len(possible)>1:
  ambiguous.append({'candidate':c,'matches':[(e['key'],e['phrase']) for e in possible.values()]})
  # Prefer an actual shared Japanese gloss; otherwise retain the current entry
  # and record the overlap for review, rather than create another duplicate.
  raise ValueError('Unreviewed ambiguous match: '+c['phrase'])
 elif possible:
  target=next(iter(possible.values()))
  if target['key'].startswith('grammar-idiom-') and norm(target['phrase'])==norm(c['phrase']):
   def gloss(m):return re.sub(r'[\s・／/；;、。，,〜OABV]','',m)
   if not any(gloss(c['meaning']) in gloss(s['meaning']) or gloss(s['meaning']) in gloss(c['meaning']) for s in target['meanings']):
    target['meanings'].append({'id':'grammar-sense-'+uid(target['key']+c['meaning']),'meaning':c['meaning'],'refs':[]})
 else:
  target={'key':'grammar-idiom-'+uid(norm(c['phrase'])),'phrase':c['phrase'],'sectionKey':'','meanings':[{'id':'grammar-sense-'+uid(norm(c['phrase'])),'meaning':c['meaning'],'refs':[]}]}
  if any(e['key']==target['key'] for e in entries):raise ValueError('normalization collision '+c['phrase'])
  entries.append(target)
  for k in keys(c['phrase']):index.setdefault(k,[]).append(target)
 # Keep the earlier grammar lesson as the single primary placement. Later
 # source occurrences remain in the source map, not copied into new entries.
 if target['key'] not in seen or c['lecture']<seen[target['key']]['lecture']:
  seen[target['key']]=c
 matches.append({**c,'entryKey':target['key'],'entryPhrase':target['phrase'],'new':target['key'].startswith('grammar-idiom-')})
ROOT.joinpath('test/fixtures/grammar-source-mapping.json').write_text(json.dumps(matches,ensure_ascii=False,indent=2)+'\n')
Path('/tmp/grammar-ambiguous.json').write_text(json.dumps(ambiguous,ensure_ascii=False,indent=2))
Path('/tmp/grammar-entries-draft.json').write_text(json.dumps(entries,ensure_ascii=False,indent=2))
print(json.dumps({'existingEntries':len(original['entries']),'draftEntries':len(entries),'newEntries':len(entries)-len(original['entries']),'overlapsToReview':len(ambiguous)},ensure_ascii=False))

def fallback(e):
 p=e['phrase'];old=e['sectionKey']
 if re.match(r"(?:I\b|I'll\b|I'm\b|You're\b|Let's\b|Long time|Who do you|What do you|How come|Come on|So I see|So do I)",p):return 22,'その他の応答表現'
 if old.startswith('adjective-'):
  return 21,'過去分詞＋前置詞' if re.search(r'\b(?:concerned|opposed|known|made|caught)\b',p) else '形容詞＋前置詞'
 if old.startswith('prep-'):
  words=re.findall('[a-z]+',p.lower());n=len(words)
  if re.search(r'\b(?:of|to|with|for) O\b',p):return 21,'前置詞＋名詞＋前置詞'
  return 20,'名詞を含む2語の表現' if n<=2 else '名詞を含む3語の表現' if n==3 else '名詞を含む4語以上の表現'
 if re.search(r'\bO\s+(?:up|down|off|out|in|on|away|back|over|through)\b',p):return 20,'他動詞＋目的語＋副詞'
 if re.search(r'\b(?:up|down|out|away|along|back)\s+(?:with|of|to|on|from)\b',p):return 20,'動詞＋副詞＋前置詞'
 if re.search(r'\b(?:to|of|with|for|from|at|on|into|over|through|after) O\b',p):return 20,'動詞＋前置詞＋目的語'
 if len(p.split())==2:return 20,'自動詞＋副詞'
 return 20,'その他の動詞表現'

sections=[];chapter_data=[];group_seq=0
for ci,(ck,title) in enumerate(chapters):
 ch={'key':'grammar-'+ck,'subtitle':title,'sections':[]}
 for lecture,(chapter_idx,gtitle) in groups.items():
  if chapter_idx!=ci:continue
  group_seq+=1
  for si,title2 in enumerate(section_order[lecture]):
   section={'key':sec(lecture,title2),'subtitle':title2,'groupKey':f'grammar-group-{lecture}','groupSubtitle':gtitle,'groupOrder':group_seq,'chapterKey':ch['key'],'chapterSubtitle':title,'chapterOrder':ci+1,'sortOrder':len(sections)+1}
   sections.append(section);ch['sections'].append({k:section[k] for k in ['key','subtitle','groupKey','groupSubtitle','groupOrder']})
 chapter_data.append(ch)
for e in entries:
 c=seen.get(e['key'])
 l,s=(c['lecture'],c['section']) if c else fallback(e)
 e['sectionKey']=sec(l,s)
sec_rank={s['key']:i for i,s in enumerate(sections)}
# Stable original order within a section; source order for newly added entries.
entries.sort(key=lambda e:sec_rank[e['sectionKey']])
used={e['sectionKey'] for e in entries}
sections=[s for s in sections if s['key'] in used]
for c in chapter_data:c['sections']=[s for s in c['sections'] if s['key'] in used]
assert all(c['sections'] for c in chapter_data)
curriculum={'chapters':chapter_data,'entries':entries}
ROOT.joinpath('test/fixtures/grammar-curriculum.json').write_text(json.dumps({'before':original,'after':curriculum},ensure_ascii=False,separators=(',',':'))+'\n')
q=lambda s:"'"+str(s).replace("'","''")+"'"
schema='''-- Optional Group metadata; existing idiom notebooks remain valid.
ALTER TABLE idiom_sections ADD COLUMN group_key TEXT;
ALTER TABLE idiom_sections ADD COLUMN group_subtitle TEXT;
ALTER TABLE idiom_sections ADD COLUMN group_order INTEGER;
'''
ROOT.joinpath('migrations/0044_idiom_group_hierarchy.sql').write_text(schema)
sql=["-- Reviewed grammar curriculum. Existing meanings/references are not rewritten.",
"CREATE TABLE IF NOT EXISTS idiom_revision_backup (revision TEXT NOT NULL, object_key TEXT NOT NULL, snapshot TEXT NOT NULL, PRIMARY KEY(revision,object_key));",
"CREATE TABLE grammar_curriculum_positions (id TEXT PRIMARY KEY, section_key TEXT, sort_order INTEGER);" ]
existing={e['key']:e for e in original['entries']}
for pos,e in enumerate(entries):
 if e['key'] in existing:sql.append(f"INSERT INTO grammar_curriculum_positions VALUES ({q(e['key'])},{q(e['sectionKey'])},{pos});")
sql += [
"CREATE TABLE grammar_curriculum_guard (ok INTEGER CHECK(ok=1));",
f"INSERT INTO grammar_curriculum_guard SELECT CASE WHEN (SELECT count(*) FROM idioms WHERE list_id='crossover-v3')={len(existing)} AND (SELECT count(*) FROM idioms i JOIN grammar_curriculum_positions p ON p.id=i.id WHERE i.list_id='crossover-v3')={len(existing)} THEN 1 ELSE 0 END WHERE EXISTS(SELECT 1 FROM lists WHERE id='crossover-v3');",
"INSERT OR IGNORE INTO idiom_revision_backup SELECT '0045','sections',json_group_array(json_object('list_id',list_id,'section_key',section_key,'subtitle',subtitle,'chapter_key',chapter_key,'chapter_subtitle',chapter_subtitle,'chapter_order',chapter_order,'sort_order',sort_order,'group_key',group_key,'group_subtitle',group_subtitle,'group_order',group_order)) FROM idiom_sections WHERE list_id='crossover-v3' HAVING count(*)>0;",
"INSERT OR IGNORE INTO idiom_revision_backup SELECT '0045',id,json_object('section_key',section_key,'sort_order',sort_order) FROM idioms WHERE list_id='crossover-v3';"]
for s in sections:
 vals=['crossover-v3',s['key'],s['subtitle'],s['chapterKey'],s['chapterSubtitle'],s['chapterOrder'],s['sortOrder'],s['groupKey'],s['groupSubtitle'],s['groupOrder']]
 sql.append('INSERT INTO idiom_sections (list_id,section_key,subtitle,chapter_key,chapter_subtitle,chapter_order,sort_order,group_key,group_subtitle,group_order) SELECT '+','.join(q(v) for v in vals)+" WHERE EXISTS(SELECT 1 FROM grammar_curriculum_guard WHERE ok=1);")
sql.append("UPDATE idioms SET section_key=(SELECT section_key FROM grammar_curriculum_positions WHERE id=idioms.id),sort_order=(SELECT sort_order FROM grammar_curriculum_positions WHERE id=idioms.id),updated_at=datetime('now') WHERE list_id='crossover-v3';")
for pos,e in enumerate(entries):
 if e['key'] in existing:continue
 sql.append(f"INSERT INTO idioms(id,list_id,phrase,section_key,sort_order) SELECT {q(e['key'])},'crossover-v3',{q(e['phrase'])},{q(e['sectionKey'])},{pos} WHERE EXISTS(SELECT 1 FROM grammar_curriculum_guard WHERE ok=1);")
 for si,s in enumerate(e['meanings']):
  sql.append(f"INSERT INTO idiom_senses(id,idiom_id,meaning,sort_order) SELECT {q(s['id'])},{q(e['key'])},{q(s['meaning'])},{si} WHERE EXISTS(SELECT 1 FROM grammar_curriculum_guard WHERE ok=1);")
sql += ["DELETE FROM idiom_sections WHERE list_id='crossover-v3' AND NOT EXISTS(SELECT 1 FROM idioms WHERE list_id=idiom_sections.list_id AND section_key=idiom_sections.section_key);",'DROP TABLE grammar_curriculum_positions;','DROP TABLE grammar_curriculum_guard;']
ROOT.joinpath('migrations/0045_grammar_curriculum.sql').write_text('\n'.join(sql)+'\n')
report=['# 文法単元別の熟語・語法・構文（0044・0045）','',
f'第1〜22講の○付き777項目を点検し、592項目を抽出対象にした。単独語・活用表・一般説明185項目は単語帳側で扱う。例文・解説由来の決まった構文を加え、{len(candidates)}件の照合記録を作成。第23講は今回の第20〜22講を最終Chapterとする構成の対象外。','',
f'既存706項目の意味・参照先を保持し、{len(entries)-706}項目を追加。計{len(entries)}項目、9Chapter・{len({s["groupKey"] for s in sections})}Group・{len(sections)}Section。複数の講に登場する表現は原則として前の文法単元を主掲載先にし、出典の重複はsource-mappingに記録する。','',
'新規項目に構成語リンクは自動追加しない。既存の意味対応の参照は保持する。空のSectionは作らない。グループ・セクション・熟語の表示番号は全体の表示順から算出する。','',
'原資料の誤記・訳の修正はgrammar-source-audit.jsonに記録（例: be about to、get through with、by degrees、in person、May I ask a favor of you?）。原PDFは変更しない。','',
'| Chapter | Group | Section数 | 項目数 |','|---|---|---:|---:|']
for ci,c in enumerate(chapter_data):
 for gk in dict.fromkeys(s['groupKey'] for s in c['sections']):
  ss=[s for s in c['sections'] if s['groupKey']==gk];ks={s['key'] for s in ss}
  report.append(f'| {ci+1} {c["subtitle"]} | {ss[0]["groupSubtitle"]} | {len(ss)} | {sum(e["sectionKey"] in ks for e in entries)} |')
ROOT.joinpath('GRAMMAR_CURRICULUM.md').write_text('\n'.join(report)+'\n')
print(json.dumps({'chapters':9,'groups':len({s['groupKey'] for s in sections}),'sections':len(sections),'entries':len(entries),'senses':sum(len(e['meanings']) for e in entries)},ensure_ascii=False))
