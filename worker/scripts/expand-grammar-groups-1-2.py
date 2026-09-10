"""Reviewed expansion of booklet lessons 1–2 (printed pp. 1–4).

Run with a fresh /idioms response as the only argument.  Each `section` follows
a printed heading; `add` expands explicitly reviewed verbs, not arbitrary OCR.
Previously applied migrations must not be regenerated.
"""
import copy, hashlib, json, re, sys
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
before=json.load(open(sys.argv[1]))
rows=[];sections=[]
def section(group,key,title,page):
 global current
 current={'key':'g12-'+key,'subtitle':title,'groupKey':f'grammar-group-{group}',
          'groupSubtitle':'文型' if group==1 else '動詞の語法','groupOrder':group,'page':page}
 sections.append(current)
def row(phrase,meaning):rows.append({'phrase':phrase,'meaning':meaning,'sectionKey':current['key'],'page':current['page']})
def add(pattern,items):
 for item in items.split('|'):
  verb,meaning=item.split('=',1);row(pattern.replace('{v}',verb),meaning)

section(1,'fixed-svc','決まった形を取る第2文型動詞',1)
add('{v}','go bad=腐る|go bankrupt=倒産する|go wrong (with O)=Oに不具合が生じる・うまくいかなくなる|come true=実現する|fall asleep=寝入る|keep fit=健康を保つ|stay fit=健康でいる')
section(1,'sv','第1文型：注意すべき自動詞',1)
add('{v}','will do=それで間に合う・十分である|sell well=よく売れる|S pays=Sは割に合う|S lasts=Sは持続する|S matters=Sは重要である|S counts=Sは重要である')
section(1,'there','there be構文',1)
row('There is / are ＋不特定の名詞','〜がある・いる')
section(1,'svc-state','第2文型：状態を表す動詞',1)
add('{v} C','be=Cである|keep=Cの状態を保つ|remain=Cのままである|stay=Cのままでいる|lie=Cの状態である')
section(1,'svc-change','第2文型：変化を表す動詞',1)
add('{v} C','become=Cになる|get=Cになる|grow=次第にCになる|turn=Cに変わる')
section(1,'svc-perception','第2文型：知覚・判明を表す動詞',1)
add('{v} C','feel=Cと感じる|look=Cに見える|seem=Cのように見える|appear=Cのように見える|taste=Cの味がする|smell=Cのにおいがする|sound=Cに聞こえる')
add('{v} (to be) C','prove=Cだと分かる|turn out=Cだと分かる')
section(1,'svo','第3文型：自動詞と間違えやすい他動詞',1)
add('{v} O','answer=Oに答える|discuss=Oについて話し合う|enter=Oに入る|marry=Oと結婚する|reach=Oに着く|resemble=Oに似ている|visit=Oを訪れる|mention=Oに言及する|approach=Oに近づく|oppose=Oに反対する|obey=Oに従う')
add('{v} O','reply to=Oに答える|talk about=Oについて話し合う|go into=Oに入る|get married to=Oと結婚する|arrive at=地点のOに到着する|get to=Oに着く|look like=Oに似ている|go to=Oへ行く|refer to=Oに言及する|come to=Oの所へ来る|object to=Oに反対する|comply with=Oに従う')
section(1,'intransitive','他動詞と間違えやすい自動詞',1)
add('{v} O','agree with=Oと意見が一致する|agree to=提案・条件のOに同意する|complain about=Oについて不満を言う|complain of=Oについて不満を言う・症状を訴える|graduate from=学校のOを卒業する')
row('apologize to A for B','AにBのことで謝る')
section(1,'ditransitive-to','第4文型：授与動詞〈to・for・of型〉',2)
row('give A B / give B to A','AにBを与える')
row('buy A B / buy B for A','AにBを買ってあげる')
row('ask A B / ask B of A','AにBを求める')
section(1,'deprivation','第4文型：略奪・負担・節約を表す動詞',2)
add('{v} A B','take=Aに時間・労力のBがかかる|cost=Aに費用・犠牲のBがかかる|save=Aの手間・時間・費用のBを省く|spare=Aの手間・苦労のBを省く／Aに時間などのBを割く|owe=Aに金額のBを借りている・支払う義務がある|deny=AにBを与えない')
section(1,'fixed-svoo','決まった形を取る第4文型動詞',2)
add('{v}','do A good=Aのためになる|do A harm=Aに害を与える|do A damage=Aに損害を与える|do A a favor=Aの頼みを聞く|ask A a favor=Aに頼み事をする')
section(1,'svoc-basic','第5文型：基本用法〈O＋名詞・形容詞〉',2)
add('{v} O C','call=OをCと呼ぶ|elect=OをCに選ぶ|find=OがCだと分かる|keep=OをCの状態に保つ|leave=OをCの状態にしておく|paint=OをCの色に塗る|name=OをCと名付ける|make=OをCにする|get=OをCの状態にする|render=OをCの状態にする')
add('{v} O (to be) C','think=OをCと考える|consider=OをCと考える|believe=OをCだと信じる|deem=OをCと見なす')
section(1,'svoc-infinitive','第5文型：促進動詞〈O＋to V〉',2)
add('{v} O to V','advise=OにVするよう助言する|allow=OがVするのを許す|permit=OがVするのを許す|cause=OがVする原因となる|lead=OがVするよう導く・促す|enable=OがVできるようにする|persuade=Oを説得してVさせる|encourage=OにVするよう勧める|force=OにVすることを強いる|oblige=OにVすることを義務づける|compel=OにVすることを強いる|get=OにVしてもらう|ask=OにVするよう頼む|beg=OにVするよう懇願する|want=OにVしてほしいと思う|would like=OにVしてほしいと思う|tell=OにVするよう言う|require=OにVすることを要求する|request=OにVするよう要請する|urge=OにVするよう強く勧める')
section(1,'prevention','妨害・禁止の動詞〈O＋from Ving〉',2)
add('{v} O from Ving','prevent=OがVするのを妨げる|keep=OがVするのを妨げる|hinder=OがVするのを妨げる|stop=OがVするのを止める|discourage=OがVするのを思いとどまらせる|dissuade=OがVするのを説得してやめさせる|ban=OがVするのを禁止する|prohibit=OがVするのを禁止する|forbid=OがVするのを禁止する')
section(1,'causative','第5文型：使役動詞〈原形・Ving・V-ed〉',2)
add('{v}','make O V=Oに強制してVさせる|make oneself V-ed=自分のことをVしてもらう|have O V=OにVしてもらう|have O Ving=OをVしている状態にしておく|have O V-ed=OをVしてもらう／OをVされる|let O V=OがVするのを許す・Vさせる')
section(1,'perception','第5文型：知覚動詞〈原形・Ving・V-ed〉',2)
for v,m in [('see','見る'),('watch','注意して見る'),('look at','見る'),('hear','聞く'),('listen to','耳を傾けて聞く'),('feel','感じる'),('notice','気づく')]:
 row(f'{v} O V / {v} O Ving',f'OがVするのを{m}。原形は動作の全体、Vingは進行中の動作を表す')
 # Do not mechanically extend look at/listen to to passive participles.
for v,m in [('see','見る'),('watch','見る'),('hear','聞く'),('feel','感じる'),('notice','気づく')]:row(f'{v} O V-ed',f'OがVされるのを{m}')

section(2,'speech','言う・話す・伝える',3)
add('{v}','talk to A about B=AにBについて話す|speak to A about B=AにBについて話す|speak ＋言語=その言語を話す|say B to A=Aに内容のBを言う|explain B to A=AにBを説明する|suggest B to A=AにBを提案する|tell A B / tell B to A=AにBを伝える')
row('tell O to V','OにVするよう言う')
section(2,'senses','見る・聞く',3)
add('{v} O','look at=意識してOを見る|glance at=Oをちらりと見る|stare at=Oをじっと見つめる|gaze at=Oを見つめる|glare at=Oをにらみつける|listen to=意識してOを聞く')
add('{v} O','watch=動いているOなどを注意して見る|see=Oが見える|hear=Oが聞こえる')
section(2,'lending','貸す・借りる・使う',3)
add('{v}','lend A B / lend B to A=AにBを無料で貸す|borrow A from B=BからAを無料で借りる|rent A B / rent B to A=AにBを有料で貸す|rent A from B=BからAを有料で借りる|make use of O=Oを利用する|take advantage of O=Oを活用する・利用する')
section(2,'belief','思う・疑う・信じる',3)
add('{v} (that) S V','suspect=SがVするのではないかと思う|doubt=SがVするとは思えない・疑わしく思う|assume=SがVすると思い込む・仮定する|think=SがVすると思う|believe=SがVすると信じる|suppose=SがVすると思う')
add('{v} O (to be) C','assume=OをCだと思い込む|suppose=OをCだと考える')
add('{v}','wonder if / whether S V=SがVするのだろうかと思う|wonder ＋疑問詞節=〜なのだろうかと考える|believe in O=Oの存在・価値・能力を信じる|doubt whether S V=SがVするかどうか疑わしく思う|question whether S V=SがVするかどうか疑問視する|There is no doubt that S V=SがVすることに疑いの余地はない')
section(2,'ideas','思いつく',3)
add('{v}','come up with O=考え・案のOを思いつく|come to mind=考えなどが思い浮かぶ|occur to O=考えなどがOの頭に浮かぶ|an idea hits A=考えがAの頭に浮かぶ|an idea strikes A=考えがAの頭に浮かぶ|hit on O=考え・案のOを思いつく|conceive an idea=考えを思いつく')
section(2,'memory','思い出す・思い出させる・覚える',3)
add('{v} (that) S V','remember=SがVすることを覚えている・思い出す|recall=SがVすることを思い出す')
add('{v} ＋疑問詞節','remember=〜かを覚えている・思い出す|recall=〜かを思い出す')
add('{v} Ving','remember=Vしたことを覚えている|recall=Vしたことを思い出す|recollect=Vしたことを思い出す')
add('{v}','remember to V=忘れずにVする|remind A to V=AにVするよう思い出させる|remind A that S V=AにSがVすることを思い出させる')
section(2,'suitability','合う・適している',3)
add('{v}','物 fit 人=物のサイズが人に合う|物 suit 人=物が人に似合う・人の都合に合う|物 become 人=服などが人に似合う|A match B=AがBと調和する|go with O=Oと調和する・似合う|食物・気候 agree with 人=食物・気候が人の体質に合う|meet requirements=要求・条件を満たす|satisfy requirements=要求・条件を満たす')
section(2,'composition','含む・構成する',3)
add('{v}','be involved in O=Oに関わっている|be engaged in O=Oに従事している|A contain B=Aが中にBを含む|A include B=Aが一部・要素としてBを含む|A compose B=Aが全体のBを構成する|A constitute B=Aが全体のBを構成する|A comprise B=Aが構成要素のBから成る|consist of O=Oから成る|be composed of O=Oから構成される|be made up of O=Oから構成される')
section(2,'of-notification','通知のof',4)
add('{v} A of B','convince=AにBを確信させる|persuade=AにBを納得させる|inform=AにBを知らせる|notify=AにBを通知する|remind=AにBを思い出させる|warn=AにBを警告する')
section(2,'of-request','要求のof',4)
add('{v} B of A','ask=AにBを求める|beg=AにBを懇願する|demand=AにBを要求する|require=AにBを要求する|request=AにBを要請する|expect=AにBを期待する')
section(2,'of-removal','分離のof',4)
add('{v} A of B','clear=AからBを取り除く|cure=Aの病気・悪癖のBを治す|relieve=Aの負担・苦痛のBを取り除く|deprive=AからBを奪う|rid=Aから好ましくないBを取り除く|strip=AからBを剥ぎ取る|rob=AからBを強奪する')
section(2,'for-reason','理由のforと関連する語法',4)
add('{v} A for B','blame=BのことでAを責める|condemn=BのことでAを非難する|excuse=BのことでAを許す|forgive=BのことでAを許す|praise=BのことでAを褒める|punish=BのことでAを罰する|thank=BのことでAに感謝する|scold=BのことでAを叱る')
add('{v}','accuse A of B=BのことでAを非難する・告発する|charge A with B=Aを罪のBで告発する|reproach A with B=BのことでAを叱責する')
section(2,'for-exchange','交換のfor',4)
add('{v} A for B','change=AをBに交換する|exchange=AをBと交換する|trade=AをBと交換する|substitute=Bの代わりにAを使う|take=AをBだと思う|mistake=AをBと取り違える')
section(2,'into-change','変化のinto',4)
add('{v} A into B','make=AをBに作り変える|turn=AをBに変える|change=AをBに変える|transform=AをBに変形・変化させる|modify=Aを修正してBにする|convert=AをBに転換する|put=Aを言語のBに訳す|translate=Aを言語のBに訳す|cut=Aを切ってBに分ける|divide=AをBに分ける')
section(2,'with-provision','供給のwith',4)
add('{v} A with B','provide=AにBを提供する|supply=AにBを供給する|serve=Aに食物・飲物のBを出す|feed=Aに食物のBを与える|present=AにBを贈る|endow=Aに能力・資質のBを授ける|equip=Aに道具・設備のBを備え付ける|furnish=AにBを備え付ける・提供する|trust=AにBを託す|replace=AをBに取り替える')
row('share A with B','AをBと共有する・分け合う')
add('{v}','provide B for A=AのためにBを提供する|supply B to A=AにBを供給する|serve B to A=Aに食物・飲物のBを出す')
section(2,'with-connection','接続のwith',4)
add('{v} A with B','associate=AをBと関連づける|compare=AをBと比較する|connect=AをBと繋ぐ|link=AをBと繋ぐ|combine=AをBと組み合わせる|incorporate=AをBと一体化する|mix=AをBと混ぜる|confuse=AをBと混同する|identify=AをBと同一視する|equate=AをBと同等と見なす')
add('{v} A to B','compare=AをBにたとえる・比較する|connect=AをBに繋ぐ|link=AをBに繋ぐ')
section(2,'to-object','対象のto',4)
add('{v} A to B','add=AをBに加える|assign=AをBに割り当てる|apply=AをBに適用する|adapt=AをBに適応させる|adjust=AをBに合わせて調整する|attach=AをBに取り付ける|contribute=AをBに提供する|dedicate=AをBに捧げる|expose=AをBにさらす|transfer=AをBに移す|refer=Aを専門家・機関のBに紹介する|relate=AをBと関連づける')
row('devote A to B / Ving','AをB・Vすることに捧げる')
section(2,'as-identity','同一のas',4)
add('{v} A as B','regard=AをBと見なす|see=AをBと見なす|view=AをBと見なす|take=AをBと受け取る|look on=AをBと見なす|consider=AをBと見なす|think of=AをBと考える|describe=AをBと述べる・描写する|refer to=AをBと呼ぶ|speak of=AをBと述べる|know=AをBとして知っている|recognize=AをBと認める|accept=AをBとして受け入れる|acknowledge=AをBと認める|identify=AをBと特定する|classify=AをBに分類する|treat=AをBとして扱う')
row('A strikes B as C','AはBにCという印象を与える')
row('A impresses B as C','AはBにCという印象を与える')
section(2,'from-distinction','区別のfrom',4)
add('{v} A from B','tell=AとBを区別する|know=AとBを見分ける|distinguish=AとBを区別する|differentiate=AとBを区別する|separate=AをBから分離する|isolate=AをBから隔離する')
section(2,'from-protection','妨害・保護のfrom',4)
add('{v} A from B','protect=Aを危険などのBから守る|rescue=Aを危険などのBから救出する|save=Aを危険などのBから救う')
row('keep A from B / Ving','AにB・Vすることをさせない／AをBから守る')
section(2,'into-persuasion','説得のinto・out of',4)
add('{v} A into Ving','talk=Aを説得してVさせる|persuade=Aを説得してVさせる|reason=Aに筋道を立てて説いてVさせる')
add('{v} A out of Ving','talk=Aを説得してVするのをやめさせる|persuade=Aを説得してVするのをやめさせる|reason=Aに筋道を立てて説いてVするのをやめさせる')

# A/B/O are role labels, not lexical words. Preserve role count and all verbs.
def norm(p):
 p=p.replace('’',"'")
 p=re.sub(r'\b[AB]\b','O',p)
 p=re.sub(r'\(that\)','that',p)
 return re.sub(r'[^a-z0-9一-龯ぁ-んァ-ヶ]+','',p.lower())
entries=copy.deepcopy(before['entries']);by_phrase={e['phrase']:e for e in entries}
aliases={
 'ask A B / ask B of A':'ask B of A',
 'object to O':'object to Ving',
 'turn A into B':'turn O into A',
 'look on A as B':'look on / upon A as B',
 'talk A into Ving':'talk O into Ving','talk A out of Ving':'talk O out of Ving',
 'see O V / see O Ving':'see O V / see O Ving',
 'hear O V / hear O Ving':'hear O V / hear O Ving',
}
index={}
for e in entries:index.setdefault(norm(e['phrase']),[]).append(e)
for alias,target in aliases.items():
 assert target in by_phrase,target
 index[norm(alias)]=[by_phrase[target]]
assigned={};mapping=[];new=[]
for r in rows:
 matches=index.get(norm(r['phrase']),[])
 assert len(matches)<=1,(r,matches)
 if matches:e=matches[0]
 else:
  key='g12-idiom-'+hashlib.sha256(norm(r['phrase']).encode()).hexdigest()[:20]
  e={'key':key,'phrase':r['phrase'],'sectionKey':r['sectionKey'],'meanings':[{'id':key+'-sense','meaning':r['meaning'],'refs':[]}]}
  entries.append(e);index[norm(e['phrase'])]=[e];new.append(e['key'])
 if e['key'] not in assigned:assigned[e['key']]=r['sectionKey']
 mapping.append({**r,'entryKey':e['key'],'new':e['key'] in new})

# Keep one canonical record, preserving sense IDs and semantic references.
merges=[]
for target,source,placement in [('keep A from B / Ving','keep O from Ving','g12-prevention'),('go with O','go with','g12-suitability')]:
 keep=by_phrase[target];duplicate=by_phrase[source]
 keep['meanings']+=copy.deepcopy(duplicate['meanings'])
 assigned[keep['key']]=placement
 entries=[e for e in entries if e['key']!=duplicate['key']]
 merges.append({'from':duplicate['key'],'to':keep['key']})
 for r in mapping:
  if r['entryKey']==duplicate['key']:r['entryKey']=keep['key']
renames=[]
for old,phrase in [('ask B of A','ask A B / ask B of A'),('object to Ving','object to O / Ving')]:
 e=by_phrase[old];e['phrase']=phrase;renames.append({'key':e['key'],'before':old,'after':phrase})
object_entry=by_phrase['object to Ving']
object_sense={'id':'g12-object-noun-sense','meaning':'Oに反対する','refs':[]}
object_entry['meanings'].append(object_sense)

# Prefer the source's earlier lesson for identical patterns. Retain all old G1/2
# entries, and require each to have been accounted for (no generic catch-all).
for e in entries:
 if e['key'] in assigned:e['sectionKey']=assigned[e['key']]
 assert not e['sectionKey'].startswith(('grammar-1-','grammar-2-')),(e['phrase'],e['sectionKey'])
chapters=copy.deepcopy(before['chapters'])
chapters[0]['sections']=[{k:v for k,v in s.items() if k!='page'} for s in sections]
used={e['sectionKey'] for e in entries}
for c in chapters:c['sections']=[s for s in c['sections'] if s['key'] in used]
rank={s['key']:n for n,s in enumerate(s for c in chapters for s in c['sections'])}
entries.sort(key=lambda e:rank[e['sectionKey']])
after={'chapters':chapters,'entries':entries}
fixture={'before':before,'after':after,'mapping':mapping,'newKeys':new,'merges':merges,'renames':renames}
ROOT.joinpath('test/fixtures/grammar-groups-1-2.json').write_text(json.dumps(fixture,ensure_ascii=False,separators=(',',':'))+'\n')

q=lambda v:"'"+str(v).replace("'","''")+"'"
sql=["-- Expand booklet lessons 1–2. Guard the input snapshot, and preserve senses/references.",
 'CREATE TABLE g12_guard (ok INTEGER CHECK(ok=1));',
 f"INSERT INTO g12_guard SELECT CASE WHEN (SELECT count(*) FROM idioms WHERE list_id='crossover-v3')={len(before['entries'])} THEN 1 ELSE 0 END WHERE EXISTS(SELECT 1 FROM lists WHERE id='crossover-v3');",
 'CREATE TABLE g12_positions(id TEXT PRIMARY KEY,section_key TEXT,sort_order INTEGER);']
for n,e in enumerate(entries):sql.append(f"INSERT INTO g12_positions VALUES({q(e['key'])},{q(e['sectionKey'])},{n});")
removed=','.join(q(m['from']) for m in merges)
merged_ids=','.join(q(k) for m in merges for k in m.values())
sql += [f"INSERT INTO g12_guard SELECT CASE WHEN (SELECT count(*) FROM idioms i JOIN g12_positions p ON p.id=i.id WHERE i.list_id='crossover-v3')={len(before['entries'])-len(merges)} AND (SELECT count(*) FROM idioms WHERE id IN ({removed}))={len(merges)} THEN 1 ELSE 0 END WHERE EXISTS(SELECT 1 FROM lists WHERE id='crossover-v3');",
 "CREATE TABLE IF NOT EXISTS idiom_revision_backup (revision TEXT NOT NULL,object_key TEXT NOT NULL,snapshot TEXT NOT NULL,PRIMARY KEY(revision,object_key));",
 "INSERT OR IGNORE INTO idiom_revision_backup SELECT '0046','sections',json_group_array(json_object('key',section_key,'subtitle',subtitle,'chapter',chapter_key,'chapterSubtitle',chapter_subtitle,'chapterOrder',chapter_order,'order',sort_order,'group',group_key,'groupSubtitle',group_subtitle,'groupOrder',group_order)) FROM idiom_sections WHERE list_id='crossover-v3' HAVING count(*)>0;",
 "INSERT OR IGNORE INTO idiom_revision_backup SELECT '0046',id,json_object('phrase',phrase,'section',section_key,'order',sort_order) FROM idioms WHERE list_id='crossover-v3';",
 f"INSERT OR IGNORE INTO idiom_revision_backup SELECT '0046','sense-'||id,json_object('idiom',idiom_id,'meaning',meaning,'order',sort_order) FROM idiom_senses WHERE idiom_id IN ({merged_ids});"]
for ci,c in enumerate(chapters):
 for si,s in enumerate(c['sections']):
  vs=['crossover-v3',s['key'],s['subtitle'],c['key'],c['subtitle'],ci,si,s.get('groupKey'),s.get('groupSubtitle'),s.get('groupOrder')]
  sql.append('INSERT INTO idiom_sections(list_id,section_key,subtitle,chapter_key,chapter_subtitle,chapter_order,sort_order,group_key,group_subtitle,group_order) SELECT '+','.join(q(v) if v is not None else 'NULL' for v in vs)+' WHERE EXISTS(SELECT 1 FROM g12_guard) ON CONFLICT(list_id,section_key) DO UPDATE SET sort_order=excluded.sort_order,chapter_order=excluded.chapter_order;')
sql.append("UPDATE idioms SET section_key=(SELECT section_key FROM g12_positions WHERE id=idioms.id),sort_order=(SELECT sort_order FROM g12_positions WHERE id=idioms.id),updated_at=datetime('now') WHERE list_id='crossover-v3' AND id IN (SELECT id FROM g12_positions);")
for e in entries:
 if e['key'] not in new:continue
 sql.append(f"INSERT INTO idioms(id,list_id,phrase,section_key,sort_order) SELECT {q(e['key'])},'crossover-v3',{q(e['phrase'])},{q(e['sectionKey'])},(SELECT sort_order FROM g12_positions WHERE id={q(e['key'])}) WHERE EXISTS(SELECT 1 FROM g12_guard);")
 for n,s in enumerate(e['meanings']):sql.append(f"INSERT INTO idiom_senses(id,idiom_id,meaning,sort_order) SELECT {q(s['id'])},{q(e['key'])},{q(s['meaning'])},{n} WHERE EXISTS(SELECT 1 FROM g12_guard);")
for m in merges:sql += [f"UPDATE idiom_senses SET idiom_id={q(m['to'])},sort_order=sort_order+(SELECT COALESCE(MAX(sort_order),-1)+1 FROM idiom_senses WHERE idiom_id={q(m['to'])}) WHERE idiom_id={q(m['from'])};",f"DELETE FROM idioms WHERE id={q(m['from'])};"]
for r in renames:sql.append(f"UPDATE idioms SET phrase={q(r['after'])} WHERE id={q(r['key'])} AND phrase={q(r['before'])};")
sql.append(f"INSERT INTO idiom_senses(id,idiom_id,meaning,sort_order) SELECT {q(object_sense['id'])},{q(object_entry['key'])},{q(object_sense['meaning'])},(SELECT COALESCE(MAX(sort_order),-1)+1 FROM idiom_senses WHERE idiom_id={q(object_entry['key'])}) WHERE EXISTS(SELECT 1 FROM g12_guard);")
sql += [
 "DELETE FROM idiom_sections WHERE list_id='crossover-v3' AND NOT EXISTS(SELECT 1 FROM idioms WHERE list_id=idiom_sections.list_id AND section_key=idiom_sections.section_key);",
 'DROP TABLE g12_positions;','DROP TABLE g12_guard;']
ROOT.joinpath('migrations/0046_expand_grammar_groups_1_2.sql').write_text('\n'.join(sql)+'\n')
print(json.dumps({'new':len(new),'total':len(entries),'groups':[{ 'group':g,'sections':len([s for s in chapters[0]['sections'] if s['groupOrder']==g]),'entries':sum(e['sectionKey'] in {s['key'] for s in chapters[0]['sections'] if s['groupOrder']==g} for e in entries)} for g in [1,2]]},ensure_ascii=False))
