"""Reviewed lessons 1–22 audit.  Generate 0047 once from the 1565-entry snapshot.

Candidate dispositions are explicit; matching preserves role count and words.
Never regenerate an already-applied migration from a different snapshot.
"""
import copy, hashlib, json, re, sys
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
before=json.load(open(sys.argv[1]));entries=copy.deepcopy(before['entries']);chapters=copy.deepcopy(before['chapters'])
checks=json.loads(ROOT.joinpath('test/fixtures/grammar-full-audit-checks.json').read_text())
by={e['phrase']:e for e in entries};new=[];merges=[];mapping=[];edits=[];renames=[];sense_additions=[]
def norm(p):return re.sub(r'\s+',' ',re.sub(r'\b[AB]\b','O',p.replace('’',"'").strip())).lower()
def lookup(p):
 hits=[e for e in entries if norm(e['phrase'])==norm(p)]
 assert len(hits)<=1,(p,hits)
 return hits[0] if hits else None
def get(p):
 e=lookup(p);assert e,p;return e
def section(anchor,key,title):
 for c in chapters:
  for n,s in enumerate(c['sections']):
   if s['key']==anchor:
    c['sections'].insert(n+1,{**s,'key':key,'subtitle':title});return
 raise ValueError(anchor)
def move(p,key):get(p)['sectionKey']=key

def fix(p,meaning,n=0):
 s=get(p)['meanings'][n]
 edits.append({'id':s['id'],'before':s['meaning'],'after':meaning});s['meaning']=meaning

def rename(p,value):
 e=get(p);renames.append({'key':e['key'],'before':e['phrase'],'after':value});e['phrase']=value;by[value]=e

def supplement(p,meaning):
 e=get(p);sid='ga-sense-'+hashlib.sha256((e['key']+meaning).encode()).hexdigest()[:20]
 s={'id':sid,'meaning':meaning,'refs':[]};e['meanings'].append(s);sense_additions.append({'entryKey':e['key'],**s})

def merge(target,source,placement):
 keep=get(target);old=get(source)
 keep['meanings']+=copy.deepcopy(old['meanings']);keep['sectionKey']=placement
 entries.remove(old);merges.append({'from':old['key'],'to':keep['key']})

# Preserve every old sense ID and reference, including distinct senses of a verb.
for target,source,placement in [
 ('look after O','look after','grammar-20-2'),('turn to O','turn to','grammar-20-2'),
 ('work out (O)','work out','grammar-20-9'),('take up O','take up','grammar-20-3'),
 ('carry O out','carry out O','grammar-20-3'),('set O up','set up O','grammar-20-3'),
 ('pass O on (to A)','pass on O','grammar-20-3'),('for fear of O / Ving','for fear of Ving','grammar-11-2')]:merge(target,source,placement)

for p,m in {
 'pretend to V':'Vするふりをする','want to V':'Vしたい','mention Ving':'Vすることに言及する',
 'escape Ving':'Vすることを免れる','practice Ving':'Vする練習をする','advise Ving':'Vするよう助言する',
 'plan to V':'Vする計画を立てる','refuse to V':'Vすることを拒む',
 'for fear that S V':'SがVするといけないので','lest S V':'SがVするといけないので',
 'Rumor has it that S V':'噂によればSがVするという','Legend has it that S V':'伝説によればSがVするという',
 'carry O out':'Oを外へ運び出す','set O up':'人のOを罠にはめる',
 'be accustomed to O':'O・Vすることに慣れている','be used to O / Ving':'O・Vすることに慣れている',
 'No way.':'いやだ・とんでもない（強い拒否）',
}.items():fix(p,m)
rename('be accustomed to O','be accustomed to O / Ving')
supplement('No way.','まさか・信じられない（驚きや不信）')
supplement('up to O','O次第で（be up to Oの形で）')
supplement('be concerned with O','Oに関心を持っている')
supplement('make oneself V-ed','make oneself understood：自分の言うことを理解してもらう／make oneself heard：自分の声を聞いてもらう')
supplement('keep O C','keep O V-ed：OをVされた状態にしておく')
supplement('as if S V / as though S V','as if / as though S had V-ed：まるでSがVしたかのように（それ以前の事柄）')
supplement("Don’t worry.",'どういたしまして（感謝に対する返答）')
move('be indifferent to / toward(s) O','grammar-21-1')
move('take care of O','grammar-20-5')
# take advantage of O already belongs to Group 2's use/lending section.

# Keep the 9 Chapters and 22 Groups, expanding only within the relevant Group.
for a,k,t in [
 ('grammar-4-1','ga-modal-basic','義務・必要・許可と依頼'),
 ('ga-modal-basic','ga-modal-perfect','助動詞＋完了形'),
 ('ga-modal-perfect','ga-mandative','要求・提案とshouldの構文'),
 ('grammar-5-1','ga-conditional','未来の仮定とifのない倒置'),
 ('grammar-6-1','ga-passive-patterns','受動態の決まった構文'),
 ('grammar-7-2','ga-infinitive-purpose','目的・結果を表す不定詞'),
 ('ga-infinitive-purpose','ga-wh-infinitive','疑問詞＋to Vとbe to V'),
 ('grammar-9-2','ga-with','with＋O＋補語〈付帯状況〉'),
 ('grammar-13-1','ga-exclamation','感嘆文・付加疑問'),
 ('grammar-10-1','ga-degree-purpose','程度・結果・目的の構文'),
 ('grammar-15-2','ga-abstract','抽象名詞を使う慣用表現'),
 ('ga-abstract','ga-body','身体部位と冠詞の表現'),
 ('grammar-14-1','ga-reflexive','再帰代名詞の慣用表現'),
 ('grammar-17-2','ga-superlative','最上級の強調と言い換え'),
 ('grammar-16-1','ga-collocations','形容詞と名詞の結び付き'),
 ('grammar-18-1','ga-negative-patterns','部分否定・二重否定'),
 ('ga-negative-patterns','ga-negative-emphasis','否定を強める表現'),
]:section(a,k,t)
for p in ['with O Ving','with O V-ed']:move(p,'ga-with')
for p in ['be known for A','be known to A','be known as B','be known by O','be made of O','be made from O','be made into O']:move(p,'grammar-6-1')
for p in ['be accustomed to O / Ving','be opposed to O / Ving']:move(p,'grammar-8-2')
move('in order / so as to V','ga-infinitive-purpose')
move('make it a rule to V','grammar-7-2')

# Each row is an editorial decision, not a fuzzy-match insertion.
# Repeated aliases map source variants to one canonical entry.
resolved={}
def add(p,m,key,canonical=None):
 c=canonical or p;e=lookup(c)
 if not e:
  ident='ga-idiom-'+hashlib.sha256(c.encode()).hexdigest()[:20]
  e={'key':ident,'phrase':c,'sectionKey':key,'meanings':[{'id':ident+'-sense','meaning':m,'refs':[]}]}
  entries.append(e);new.append(ident)
 else:e['sectionKey']=key
 resolved[p]={'entryKey':e['key'],'decision':'追加' if e['key'] in new else '既存を使用','note':'','canonical':e['phrase']}
 return e

def rows(key,data):
 for line in data.strip().split('\n'):
  p,m=line.split('=',1);add(p,m,key)

def alias(p,target,note='既存の型に含まれる'):
 e=get(target);resolved[p]={'entryKey':e['key'],'decision':'既存に集約','note':note,'canonical':e['phrase']}

rows('grammar-3-2','''It is 期間 since S 過去形=Sが〜してからその期間がたつ
期間 have passed since S 過去形=Sが〜してからその期間が経過した''')
rows('ga-modal-basic','''be able to V=Vすることができる
have to V=Vしなければならない
have got to V=Vしなければならない
do not have to V=Vする必要はない
ought to V=Vすべきだ・Vするはずだ
ought not to V=Vすべきではない
Would you V?=Vしていただけますか
Could you V?=Vしていただけますか
May I V?=Vしてもよいですか
Can I V?=Vしてもよいですか
need not V=Vする必要はない''')
move('Will you V?','ga-modal-basic')
rows('grammar-4-1','''May S V!=SがVしますように
had better not V=Vしないほうがよい
How dare you V!=よくもVできるね''')
rows('ga-modal-perfect','''need not have V-ed=Vする必要はなかったのにVしてしまった
should have V-ed=Vすべきだったのにしなかった／Vしたはずだ
should not have V-ed=VすべきではなかったのにVしてしまった''')
for v,m in [('demand','要求する'),('insist','強く要求する'),('require','要求する'),('request','要請する'),('suggest','提案する'),('propose','提案する'),('recommend','勧める'),('order','命令する'),('command','命令する')]:add(v+' that S (should) V',f'SがVするよう{m}','ga-mandative')
for v,m in [('necessary','必要だ'),('essential','不可欠だ'),('important','重要だ'),('crucial','極めて重要だ'),('desirable','望ましい'),('advisable','賢明だ')]:add('It is '+v+' that S (should) V',f'SがVすることが{m}','ga-mandative')
rows('ga-conditional','''If S should V=万一SがVしたら
If S were to V=仮にSがVするとしたら
Were S C=もしSがCならば（If S were Cの倒置）
Had S V-ed=もしSがVしていたなら（If S had V-edの倒置）
Should S V=万一SがVしたら（If S should Vの倒置）
Were S to V=仮にSがVするとしたら（If S were to Vの倒置）''')
rows('grammar-5-2','''would rather S had V-ed=SがVしてくれていたほうがよかった
if only S had V-ed=SがVしてさえいたらなあ
It is time S 過去形=そろそろSが〜してよいころだ
It is about time S 過去形=そろそろSが〜してよいころだ
otherwise S would V=そうでなければSはVするだろう
otherwise S would have V-ed=そうでなかったならSはVしただろう''')
for p in ['as if S had V-ed','as though S had V-ed']:alias(p,'as if S V / as though S V','過去完了の意味を既存項目に補完')
rows('ga-passive-patterns','''be laughed at=笑われる
It is said that S V=SがVすると言われている
S is said to V=SはVすると言われている
S is said to have V-ed=SはVしたと言われている
be seen to V=Vするところを見られる
be made to V=Vさせられる''')
rows('grammar-6-1','''be made in O=場所のOで作られる''')
for p in ['be known for O','be known to O','be known as O','be known by O','be made of O','be made from O','be made into O']:alias(p,p,'既存の語義を保持して受動態へ移動')
rows('grammar-7-2','''make it possible to V=Vすることを可能にする
It is 形容詞 for O to V=OがVすることは〜だ
It is 形容詞 of O to V=VするとはOは〜だ（人の性質・評価）''')
alias('make it a rule to V','make it a rule to V','不定詞の慣用構文へ移動')
for p in ['in order to V','so as to V']:alias(p,'in order / so as to V','目的を表す不定詞へ移動')
rows('ga-infinitive-purpose','''in order not to V=Vしないために
so as not to V=Vしないために
wake up to find O C=目を覚ますとOがCだと分かる
grow up to be C=成長してCになる
live to be 年齢=その年齢まで生きる''')
rows('ga-wh-infinitive','''what to V=何をVすべきか
which 名詞 to V=どの〜をVすべきか
how to V=Vする方法
when to V=いつVすべきか
where to V=どこで・どこへVすべきか
whether to V=Vすべきかどうか
be to V=Vする予定だ／Vすべきだ／Vできる／Vする運命だ／Vするつもりだ（文脈による）''')
rows('grammar-8-3','''cannot wait to V=Vするのが待ちきれない
for the purpose of Ving=Vする目的で
物 need to be V-ed=物がVされる必要がある
物 want to be V-ed=物がVされる必要がある
it is impossible to V=Vすることは不可能だ
there is no point in Ving=Vしても意味がない
there is no sense in Ving=Vしても意味がない''')
alias('be opposed to Ving','be opposed to O / Ving','前置詞to＋Vingへ移動')
alias('be accustomed to Ving','be accustomed to O / Ving','O / Vingに表記・意味を補完して移動')
rows('grammar-9-2','''get O V-ed=OをVしてもらう・OがVされた状態にする
There is O Ving=VしているOがいる・ある''')
for p in ['make oneself understood','make oneself heard']:alias(p,'make oneself V-ed','具体的な2表現を既存項目の意味欄に補完')
alias('keep O V-ed','keep O C','V-ed型を既存項目の意味欄に補完')
rows('ga-with','''with O 形容詞=Oが〜の状態で（付帯状況）
with O 副詞=Oが副詞の表す状態で（例：with the lights on＝明かりをつけたままで）
with O 前置詞句=Oが前置詞句の表す状態で（例：with a bag on his back＝かばんを背負って）''')
rows('grammar-9-1','''Ving as S do=実際にSがVするので（理由を強調する分詞構文）
V-ed as S be=実際にSがVされるので（理由を強調する分詞構文）''')
rows('grammar-12-1','''what S call O=SがOと呼ぶもの・いわゆるO
what S was=かつてのS''')
rows('grammar-12-2','''no matter who S V=誰が・誰をVしても
no matter which S V=どちらを・どれをVしても
no matter when S V=SがいつVしても
no matter where S V=Sがどこで・どこへVしても
Come what may=何が起ころうとも
Come who may=誰が来ようとも
the same 名詞 as O=Oと同じ〜
the same 名詞 that S V=SがVするのと同一の〜
such 名詞 as O=Oのような〜
as you can see=ご覧のとおり
as is usual with O=Oにはいつものことだが
more than is necessary=必要以上に''')
rows('ga-exclamation','''What a 形容詞 名詞 S V!=SがVするのはなんと〜な…なのだろう（単数可算名詞）
How 形容詞 S V!=Sはなんと〜なのだろう
命令文, will you?=〜してくれますか（命令・依頼に添える）
命令文, won’t you?=〜しませんか（勧誘に添える）
Let’s V, shall we?=一緒にVしましょうね''')
rows('grammar-13-2','''one of the 複数名詞=〜のうちの1つ・1人
tell A that S V=AにSがVすることを伝える
ask A if S V=AにSがVするかどうか尋ねる
ask A whether S V=AにSがVするかどうか尋ねる
ask A 疑問詞節=Aに〜かを尋ねる''')
rows('grammar-10-1','''whether S V or not=SがVしてもしなくても／SがVするかどうか
whether or not S V=SがVしてもしなくても／SがVするかどうか
whether A or B=AであろうとBであろうと／AかBか
suppose that S V=もしSがVするとしたら
assuming that S V=SがVすると仮定して
granting that S V=たとえSがVすると認めても
granted that S V=たとえSがVすると認めても
形容詞 as S V=Sがどれほど〜であっても・〜ではあるが
形容詞 though S V=Sがどれほど〜であっても・〜ではあるが
be it A or B=AであれBであれ
be it ever so 形容詞=どんなに〜であっても''')
rows('ga-degree-purpose','''so 形容詞 that S V=とても〜なのでSがVする
such a 形容詞 名詞 that S V=とても〜な…なのでSがVする
S be such that S V=Sは〜するほどのもの・状態だ
so that S can V=SがVできるように
in order that S can V=SがVできるように''')
rows('grammar-11-1','''at work=仕事中で・活動中で
on fire=燃えて
in white=白い服を着て
freeze to death=凍死する
for one’s age=年齢の割には
by the gallon=ガロン単位で
over a cup of coffee=コーヒーを飲みながら
under the influence of O=Oの影響を受けて
die from O=外的な原因などのOで死ぬ''')
for p in ['be familiar with O','be concerned about O','be independent of O','on time','on the contrary']:
 e=get(p);move(p,'grammar-11-1');alias(p,p,'前置詞の組合せへ移動')
move('be anxious about O / Ving','grammar-11-1');alias('be anxious about O','be anxious about O / Ving','前置詞の組合せへ移動')
rows('grammar-11-2','''contrary to O=Oに反して
from among O=Oの中から
because of O=Oのために
due to O=Oが原因で・Oのために
owing to O=Oのために
thanks to O=Oのおかげで
by virtue of O=Oによって・Oのおかげで''')
for p in ['on account of O','with all O','for all O']:
 move(p,'grammar-11-2');alias(p,p,'複合前置詞へ移動')
rows('ga-reflexive','''a friend of mine=私の友人の1人
help oneself to O=Oを自由に取って食べる・飲む
make oneself at home=くつろぐ
behave oneself=行儀よくする
devote oneself to O=Oに専念する
enjoy oneself=楽しく過ごす
talk to oneself=独り言を言う
beside oneself=我を忘れて
by oneself=1人で・独力で
for oneself=自分のために・自分で
in itself=それ自体で・本来''')
move('say to oneself','ga-reflexive')
rows('grammar-14-1','''one … the other …=2つのうち一方は…、もう一方は…
one … another … the others …=1つは…、別の1つは…、残りは…
some … others …=あるものは…、ほかのものは…
those who V=Vする人々
each of the 複数名詞=〜のそれぞれ
none of the 複数名詞=〜のどれも・誰も…ない''')
rows('grammar-15-2','''a bottle of O=瓶1本のO
a cup of O=カップ1杯のO
a sheet of O=1枚のO
by the 単位=〜単位で
go to church=礼拝に行く
go to school=通学する
by bicycle=自転車で''')
rows('ga-abstract','''of importance=重要な
of help=役に立つ
of use=役に立つ
of value=価値のある
of worth=価値のある
with ease=容易に
with care=注意深く
with certainty=確実に
once upon a time=昔々''')
rows('ga-body','''take O by the arm=Oの腕を取る
hold O by the arm=Oの腕をつかんでいる
stare O in the face=Oの顔をじっと見つめる
hit O on the head=Oの頭をたたく
pat O on the shoulder=Oの肩を軽くたたく''')
move('catch a person by the arm','ga-body');alias('catch O by the arm','catch a person by the arm','既存の人の変数表記を使用して移動')
# Fixed two-word collocations, not isolated adjectives/nouns.
for p,m in [
 ('a large population','人口が多いこと'),('a small population','人口が少ないこと'),
 ('a large audience','大勢の聴衆'),('a small audience','少人数の聴衆'),
 ('a large number of O','多数のO'),('a small number of O','少数のO'),
 ('a large amount of O','多量のO'),('a small amount of O','少量のO'),
 ('high costs','高い費用'),('low costs','低い費用'),('a high income','高い収入'),('a low income','低い収入'),
 ('a high salary','高い給与'),('a low salary','低い給与'),('high prices','高い物価・価格'),('low prices','低い物価・価格'),
 ('high taxes','高い税金'),('low taxes','低い税金'),('high rent','高い家賃'),('low rent','低い家賃'),
 ('heavy rain','大雨'),('light rain','小雨'),('heavy snow','大雪'),('light snow','少量の雪'),
 ('heavy traffic','多い交通量'),('light traffic','少ない交通量'),('a heavy meal','量が多く腹にたまる食事'),('a light meal','軽い食事')]:add(p,m,'ga-collocations')
rows('grammar-16-2','''in addition=さらに・加えて
in other words=言い換えれば''')
rows('ga-superlative','''by far the 最上級=群を抜いて最も〜
much the 最上級=はるかに最も〜
the very 最上級=まさに最も〜
the 序数 最上級=〜番目に最も…
比較級 than any other 単数名詞=ほかのどの〜よりも…
比較級 than anything else=ほかの何よりも〜
No other 名詞 is 比較級 than O=Oより〜なものはほかにない
Nothing is 比較級 than O=Oより〜なものは何もない''')
rows('grammar-17-2','''倍数 the 名詞 of O=Oの〜倍の大きさ・数など
the 比較級 of the two=2つ・2人のうちでより〜なほう
比較級 than O by 差=Oより差の分だけ〜
as 形容詞 a 名詞 as O=Oと同じくらい〜な…
more A than B=BというよりむしろA
be senior to O=Oより年上である・先輩である
be junior to O=Oより年下である・後輩である
be superior to O=Oより優れている
be inferior to O=Oより劣っている''')
rows('grammar-17-1','''as 形容詞 as S can=Sにできるだけ〜
no better than O=Oも同然で・Oよりよいということはない
rather B than A=AというよりむしろB
less A than B=AというよりむしろB
not more than 数量=多くとも〜
not less than 数量=少なくとも〜''')
rows('ga-negative-patterns','''hardly ever V=めったにVしない
scarcely ever V=めったにVしない
hardly any O=ほとんどOがない
scarcely any O=ほとんどOがない
not all=すべてが〜というわけではない
not every=どれもが〜というわけではない
not both=両方とも〜というわけではない
not … because S V=SがVするから…というわけではない（理由を否定する場合）
never … without Ving=…すると必ずVする
never … but S V=…すると必ずSがVする
never fail to V=必ずVする''')
for p in ['not always','not necessarily']:move(p,'ga-negative-patterns')
rows('ga-negative-emphasis','''under no circumstances=どんな事情でも決して…ない
by no means=決して…ない
not … by any means=決して…ない
not … at all=全く…ない
in no way=決して…ない
not … in any way=いかなる点でも…ない
not … in the least=少しも…ない
not … in the slightest=少しも…ない
on no account=どんな理由があっても…ない
not … on any account=どんな理由があっても…ない
not … whatsoever=全く…ない''')
rows('grammar-19-3','''Little did S V=Sは全くVしなかった
Only then did S V=そのとき初めてSはVした
nor 助動詞 S=Sもまた…ない
疑問詞 is it that S V?=一体〜なのか（疑問詞を強調する構文）
the very 名詞=まさにその〜''')
for p in ['on earth','in the world','the heck','the hell']:
 # Attach these to their question-word context rather than adding bare nouns.
 existing=lookup(p)
 canonical='疑問詞＋'+p
 if existing:
  rename(p,canonical);move(canonical,'grammar-19-3');fix(canonical,'一体全体〜（疑問詞を強調する）')
 add(p,'一体全体〜（疑問詞を強調する）','grammar-19-3',canonical)
rows('grammar-21-4','''up to date=最新で・時代に合って
out of date=時代遅れで・古くなって''')
rows('grammar-20-6','''in effect=事実上・実際には／法律などが施行されて''')
for p in ['out of the blue','for now','at large','for nothing']:alias(p,p,'既存の語義で収録済み')
rows('grammar-22-1','''I haven’t seen you for a long time.=お久しぶりです''')
rows('grammar-22-5','''No, I don’t.=いいえ、かまいません・どうぞ（Do you mind …?への返答）
Not at all.=いいえ、かまいません・どうぞ（Do / Would you mind …?への返答）
Of course not.=もちろんかまいません・どうぞ（Do / Would you mind …?への返答）
Why not?=もちろん・どうぞ／いいですね（許可や提案への返答）
I’ll follow you.=お先にどうぞ・あなたの後についていきます''')
alias('Don’t worry.','Don’t worry.','感謝への返答の語義も補完')

assert len(resolved)==len(checks),(len(resolved),len(checks),set(resolved)-{c['phrase'] for c in checks})
for c in checks:
 assert c['phrase'] in resolved,c
 mapping.append({**{k:c[k] for k in ['chapter','page','topic','phrase']},**resolved[c['phrase']]})
# Remove unused sections after relocations; sort within the familiar hierarchy.
used={e['sectionKey'] for e in entries}
for c in chapters:c['sections']=[s for s in c['sections'] if s['key'] in used]
rank={s['key']:i for i,s in enumerate(s for c in chapters for s in c['sections'])}
entries.sort(key=lambda e:rank[e['sectionKey']])
assert len({norm(e['phrase']) for e in entries})==len(entries),'duplicate normalized phrase'
old={e['key']:e for e in before['entries']}
moves=[{'key':e['key'],'from':old[e['key']]['sectionKey'],'to':e['sectionKey']} for e in entries if e['key'] in old and old[e['key']]['sectionKey']!=e['sectionKey']]
after={'chapters':chapters,'entries':entries}
fixture={'before':before,'after':after,'mapping':mapping,'newKeys':new,'merges':merges,'renames':renames,'edits':edits,'senseAdditions':sense_additions,'moves':moves}
ROOT.joinpath('test/fixtures/grammar-full-audit.json').write_text(json.dumps(fixture,ensure_ascii=False,separators=(',',':'))+'\n')

# Guard structure and changed text before any production data mutation.
q=lambda v:"'"+str(v).replace("'","''")+"'"
sql=['-- Reviewed booklet lessons 1–22: additions, corrections and safe consolidation.',
 'CREATE TABLE ga_guard(ok INTEGER CHECK(ok=1));',
 f"INSERT INTO ga_guard SELECT CASE WHEN (SELECT count(*) FROM idioms WHERE list_id='crossover-v3')={len(before['entries'])} THEN 1 ELSE 0 END WHERE EXISTS(SELECT 1 FROM lists WHERE id='crossover-v3');",
 'CREATE TABLE ga_expected(id TEXT PRIMARY KEY,phrase TEXT,section_key TEXT);']
for e in before['entries']:sql.append(f"INSERT INTO ga_expected VALUES({q(e['key'])},{q(e['phrase'])},{q(e['sectionKey'])});")
sql.append(f"INSERT INTO ga_guard SELECT CASE WHEN (SELECT count(*) FROM idioms i JOIN ga_expected e ON e.id=i.id AND e.phrase=i.phrase AND e.section_key=i.section_key WHERE i.list_id='crossover-v3')={len(before['entries'])} THEN 1 ELSE 0 END WHERE EXISTS(SELECT 1 FROM ga_guard);")
for ed in edits:sql.append(f"INSERT INTO ga_guard SELECT CASE WHEN EXISTS(SELECT 1 FROM idiom_senses WHERE id={q(ed['id'])} AND meaning={q(ed['before'])}) THEN 1 ELSE 0 END WHERE EXISTS(SELECT 1 FROM ga_guard);")
sql += ["CREATE TABLE IF NOT EXISTS idiom_revision_backup (revision TEXT NOT NULL,object_key TEXT NOT NULL,snapshot TEXT NOT NULL,PRIMARY KEY(revision,object_key));",
 "INSERT OR IGNORE INTO idiom_revision_backup SELECT '0047','sections',json_group_array(json_object('key',section_key,'subtitle',subtitle,'chapter',chapter_key,'chapterSubtitle',chapter_subtitle,'chapterOrder',chapter_order,'order',sort_order,'group',group_key,'groupSubtitle',group_subtitle,'groupOrder',group_order)) FROM idiom_sections WHERE list_id='crossover-v3' HAVING count(*)>0;",
 "INSERT OR IGNORE INTO idiom_revision_backup SELECT '0047',id,json_object('phrase',phrase,'section',section_key,'order',sort_order) FROM idioms WHERE list_id='crossover-v3';",
 "INSERT OR IGNORE INTO idiom_revision_backup SELECT '0047','sense-'||id,json_object('idiom',idiom_id,'meaning',meaning,'order',sort_order) FROM idiom_senses WHERE idiom_id IN (SELECT id FROM idioms WHERE list_id='crossover-v3');"]
for ci,c in enumerate(chapters):
 for si,s in enumerate(c['sections']):
  vals=['crossover-v3',s['key'],s['subtitle'],c['key'],c['subtitle'],ci,si,s['groupKey'],s['groupSubtitle'],s['groupOrder']]
  sql.append('INSERT INTO idiom_sections(list_id,section_key,subtitle,chapter_key,chapter_subtitle,chapter_order,sort_order,group_key,group_subtitle,group_order) SELECT '+','.join(q(v) for v in vals)+' WHERE EXISTS(SELECT 1 FROM ga_guard) ON CONFLICT(list_id,section_key) DO UPDATE SET sort_order=excluded.sort_order,chapter_order=excluded.chapter_order;')
for n,e in enumerate(entries):
 if e['key'] in new:
  sql.append(f"INSERT INTO idioms(id,list_id,phrase,section_key,sort_order) SELECT {q(e['key'])},'crossover-v3',{q(e['phrase'])},{q(e['sectionKey'])},{n} WHERE EXISTS(SELECT 1 FROM ga_guard);")
  s=e['meanings'][0];sql.append(f"INSERT INTO idiom_senses(id,idiom_id,meaning,sort_order) SELECT {q(s['id'])},{q(e['key'])},{q(s['meaning'])},0 WHERE EXISTS(SELECT 1 FROM ga_guard);")
 else:sql.append(f"UPDATE idioms SET section_key={q(e['sectionKey'])},sort_order={n},updated_at=datetime('now') WHERE id={q(e['key'])} AND list_id='crossover-v3';")
for m in merges:
 sql += [f"UPDATE idiom_senses SET idiom_id={q(m['to'])},sort_order=sort_order+(SELECT COALESCE(MAX(sort_order),-1)+1 FROM idiom_senses WHERE idiom_id={q(m['to'])}) WHERE idiom_id={q(m['from'])};",f"DELETE FROM idioms WHERE id={q(m['from'])};"]
for e in edits:sql.append(f"UPDATE idiom_senses SET meaning={q(e['after'])} WHERE id={q(e['id'])};")
for r in renames:sql.append(f"UPDATE idioms SET phrase={q(r['after'])} WHERE id={q(r['key'])};")
for s in sense_additions:sql.append(f"INSERT INTO idiom_senses(id,idiom_id,meaning,sort_order) SELECT {q(s['id'])},{q(s['entryKey'])},{q(s['meaning'])},(SELECT COALESCE(MAX(sort_order),-1)+1 FROM idiom_senses WHERE idiom_id={q(s['entryKey'])}) WHERE EXISTS(SELECT 1 FROM ga_guard);")
sql += ["DELETE FROM idiom_sections WHERE list_id='crossover-v3' AND NOT EXISTS(SELECT 1 FROM idioms WHERE list_id=idiom_sections.list_id AND section_key=idiom_sections.section_key);",'DROP TABLE ga_expected;','DROP TABLE ga_guard;']
ROOT.joinpath('migrations/0047_complete_grammar_audit.sql').write_text('\n'.join(sql)+'\n')
print(json.dumps({'new':len(new),'merges':len(merges),'edits':len(edits),'senseAdditions':len(sense_additions),'moves':len(moves),'total':len(entries),'checks':len(mapping)},ensure_ascii=False))
