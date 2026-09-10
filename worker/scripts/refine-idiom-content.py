"""0049: reviewed visibility, pattern consolidation and notes; requires 0048."""
import copy,json,re,hashlib,sys
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
before=json.load(open(sys.argv[1]));after=copy.deepcopy(before);entries=after['entries'];removed=[];changes=[]
def get(p):
 hits=[e for e in entries if e['phrase']==p];assert len(hits)==1,(p,len(hits));return hits[0]
def note(e,text):
 if text:e['notes']='\n'.join(filter(None,[e.get('notes',''),text]))
def alias(e,p,key=None):
 e.setdefault('aliases',[])
 row={'phrase':p};
 if key:row['key']=key
 if row not in e['aliases']:e['aliases'].append(row)
def rename(e,p):
 if e['phrase']!=p:alias(e,e['phrase']);e['phrase']=p

def merge(phrases,canonical,section=None):
 keep=get(phrases[0]);allrows=[get(p) for p in phrases]
 # Prefix each sense with its exact original variant in notes, not the gloss.
 for e in allrows:
  note(keep,e['phrase']+'：'+'／'.join(s['meaning'] for s in e['meanings']))
  if e is keep:continue
  alias(keep,e['phrase'],e['key'])
  keep['meanings']+=e['meanings'];entries.remove(e);removed.append({'from':e['key'],'to':keep['key']})
 rename(keep,canonical)
 if section:keep['sectionKey']=section
 return keep

# Keep complex complement patterns; hide entries whose only content is a word's ordinary use.
hide_sections={'g12-svc-state','g12-svc-change'}
hide_phrases='S pays|S lasts|S matters|S counts|feel C|look C|seem C|appear C|taste C|smell C|sound C|prove (to be) C|answer O|discuss O|enter O|marry O|reach O|resemble O|visit O|mention O|approach O|oppose O|obey O|speak ＋言語|watch O|see O|hear O|物 fit 人|物 suit 人|物 become 人|A match B|A contain B|A include B|A compose B|A constitute B|A comprise B|A present|A involved|A concerned|A available|A imaginable'.split('|')
for p in hide_phrases:get(p)['hidden']=True
for e in entries:
 if e['sectionKey'] in hide_sections:e['hidden']=True
# Keep genuine multiword phrases from the former single-verb list.
for e in entries:
 if e['sectionKey']=='g12-svo' and not e.get('hidden'):e['sectionKey']='g12-intransitive'
for c in after['chapters']:
 for s in c['sections']:
  if s['key']=='g12-sv':s['subtitle']='第1文型の定型表現'
  if s['key']=='g12-intransitive':s['subtitle']='前置詞を伴う動詞表現'

# Move explanations out of meanings; preserve contextual qualifiers that are part of a gloss.
for e in entries:
 for s in e['meanings']:
  m=s['meaning']
  if '。原形は' in m:
   m,explanation=m.split('。',1);note(e,explanation)
  # Parenthetical usage/variant information belongs in notes.
  pattern=r'（([^（）]*(?:のほか|倒置|例：|用法|通常|ともいう|形もある|省く|区別|返答|強調|文脈|同意|皮肉|付帯状況|単数可算|人の性質|勧誘|命令・依頼|文脈による|be up to|自動詞|増加なら|話を付け加える|の意味でも|同様の譲歩)[^（）]*)）'
  def move_note(match):note(e,match[1]);return ''
  m=re.sub(pattern,move_note,m)
  if e['phrase']=='be different than O':m=m.replace('（主に米）','') # requested label-free policy
  s['meaning']=m
# These are examples/grammar explanations rather than additional senses.
for p,prefix in [('make oneself V-ed','make oneself understood：'),('keep O C','keep O V-ed：'),('as if S V / as though S V','as if / as though S had V-ed：')]:
 e=get(p)
 for s in list(e['meanings']):
  if s['meaning'].startswith(prefix):
   assert not s['refs'];note(e,s['meaning']);e['meanings'].remove(s);changes.append({'movedSenseToNotes':s['id'],'entry':e['key']})
for p,m in [('notice O V / notice O Ving','OがVするのに気づく'),('listen to O V / listen to O Ving','OがVするのに耳を傾ける')]:get(p)['meanings'][0]['meaning']=m

merge(['have O V','have O Ving','have O V-ed'],'have O V / Ving / Vpp')
merge(['get O to V','get O V-ed'],'get O to V / Vpp','g12-causative')
for v in ['see','hear','watch','feel','notice']:
 merge([f'{v} O V / {v} O Ving',f'{v} O V-ed'],f'{v} O V / Ving / Vpp')
for v in ['look at','listen to']:rename(get(f'{v} O V / {v} O Ving'),f'{v} O V / Ving')
merge(['catch a person by the arm','take O by the arm','hold O by the arm'],'take / catch / hold O by the arm')
merge(['with O Ving','with O V-ed','with O 形容詞','with O 副詞','with O 前置詞句'],'with O C〈Ving / Vpp / 形容詞・副詞・前置詞句〉')
# Same frame, same meaning: consolidate alternatives without merging positive/negative meanings.
for ps,canonical in [
 (['in order not to V','so as not to V'],'in order / so as not to V'),
 (['there is no point in Ving','there is no sense in Ving'],'there is no point / sense in Ving'),
 (['it is no use Ving','it is no good Ving'],'it is no use / good Ving'),
 (['It is time S 過去形','It is about time S 過去形','It is high time S 過去形'],'It is (about / high) time S 過去形'),
 (['ask A if S V','ask A whether S V'],'ask A if / whether S V'),
 (['whether S V or not','whether or not S V'],'whether S V or not / whether or not S V'),
 (['形容詞 as S V','形容詞 though S V'],'形容詞 as / though S V'),
 (['granting that S V','granted that S V'],'granting / granted that S V'),
 (['hardly ever V','scarcely ever V'],'hardly / scarcely ever V'),
 (['hardly any O','scarcely any O'],'hardly / scarcely any O'),
 (['not … in the least','not … in the slightest'],'not … in the least / slightest'),
 (['as you can see'], 'as you can see'),
]:
 if len(ps)>1:merge(ps,canonical)

# Strong separators identify independent meanings; do not split role/verb variants or gloss synonyms.
for e in entries:
 new=[]
 for s in e['meanings']:
  parts=re.split(r'[／；;]',s['meaning'])
  for n,m in enumerate(parts):
   m=m.strip()
   if not m:continue
   out=copy.deepcopy(s);out['meaning']=m
   if n:
    out['id']='r49-sense-'+hashlib.sha256((s['id']+str(n)).encode()).hexdigest()[:20]
    out['refs']=[] # An old reference is not automatically valid for every new meaning.
   new.append(out)
 e['meanings']=new
 # Collapse identical meanings while moving all references to their retained sense.
 seen={};senses=[]
 for s in e['meanings']:
  if s['meaning'] in seen:
   keep=seen[s['meaning']];refs={r['wordId'] for r in keep['refs']}
   keep['refs'] += [r for r in s['refs'] if r['wordId'] not in refs]
   changes.append({'duplicateSense':s['id'],'to':keep['id']})
  else:seen[s['meaning']]=s;senses.append(s)
 e['meanings']=senses
 # The display and saved data consistently use Vpp. Keep old spellings as link aliases.
 rename(e,e['phrase'].replace('V-ed','Vpp'))
 for s in e['meanings']:s['meaning']=s['meaning'].replace('V-ed','Vpp')
 for field in ['notes','synonyms','antonyms']:
  if e.get(field):e[field]=e[field].replace('V-ed','Vpp')
 if e.get('notes'):
  e['notes']='\n'.join(dict.fromkeys(e['notes'].split('\n')))
for c in after['chapters']:
 for s in c['sections']:s['subtitle']=s['subtitle'].replace('V-ed','Vpp')
# Useful, reviewed synonym/antonym links, using the same notation as the word book.
for p,syn,ant in [
 ('look into O','investigate',''),('look up to O','respect, admire','##idiom:look down on O##'),
 ('look down on O','','##idiom:look up to O##'),
 ('up to date','','##idiom:out of date##'),('out of date','','##idiom:up to date##'),
 ('be superior to O','','##idiom:be inferior to O##'),('be inferior to O','','##idiom:be superior to O##'),
 ('put up with O','tolerate, endure',''),
]:
 e=get(p)
 if syn:e['synonyms']=syn
 if ant:e['antonyms']=ant

# Match chapter/section order for public API output and auto numbering.
rank={s['key']:i for i,s in enumerate(s for c in after['chapters'] for s in c['sections'])};entries.sort(key=lambda e:rank[e['sectionKey']])
fixture={'before':before,'after':after,'merges':removed,'senseChanges':changes}
ROOT.joinpath('test/fixtures/idiom-fields.json').write_text(json.dumps(fixture,ensure_ascii=False,separators=(',',':'))+'\n')
q=lambda v:"'"+str(v).replace("'","''")+"'"
sql=['-- 0049: reviewed idiom layout data; backup and guard all content that will change.',
 'CREATE TABLE r49_guard(ok INTEGER CHECK(ok=1));',
 f"INSERT INTO r49_guard SELECT CASE WHEN (SELECT count(*) FROM idioms WHERE list_id='crossover-v3')={len(before['entries'])} THEN 1 ELSE 0 END WHERE EXISTS(SELECT 1 FROM lists WHERE id='crossover-v3');",
 'CREATE TABLE r49_expected(id TEXT PRIMARY KEY,phrase TEXT,section_key TEXT);']
for e in before['entries']:sql.append(f"INSERT INTO r49_expected VALUES({q(e['key'])},{q(e['phrase'])},{q(e['sectionKey'])});")
sql.append(f"INSERT INTO r49_guard SELECT CASE WHEN (SELECT count(*) FROM idioms i JOIN r49_expected e ON e.id=i.id AND e.phrase=i.phrase AND e.section_key=i.section_key AND i.synonyms='' AND i.antonyms='' AND i.notes='' AND i.hidden=0 AND i.aliases='[]')={len(before['entries'])} THEN 1 ELSE 0 END WHERE EXISTS(SELECT 1 FROM r49_guard);")
# An exact sense guard prevents concurrent edits from being overwritten.
sql.append('CREATE TABLE r49_senses(id TEXT PRIMARY KEY,idiom_id TEXT,meaning TEXT);')
for e in before['entries']:
 for s in e['meanings']:sql.append(f"INSERT INTO r49_senses VALUES({q(s['id'])},{q(e['key'])},{q(s['meaning'])});")
count=sum(len(e['meanings']) for e in before['entries'])
sql.append(f"INSERT INTO r49_guard SELECT CASE WHEN (SELECT count(*) FROM idiom_senses s JOIN r49_senses e ON e.id=s.id AND e.idiom_id=s.idiom_id AND e.meaning=s.meaning)={count} AND (SELECT count(*) FROM idiom_senses WHERE idiom_id IN (SELECT id FROM r49_expected))={count} THEN 1 ELSE 0 END WHERE EXISTS(SELECT 1 FROM r49_guard);")
sql += ["CREATE TABLE IF NOT EXISTS idiom_revision_backup(revision TEXT NOT NULL,object_key TEXT NOT NULL,snapshot TEXT NOT NULL,PRIMARY KEY(revision,object_key));",
 "INSERT INTO idiom_revision_backup SELECT '0049',i.id,json_object('phrase',i.phrase,'section',i.section_key,'order',i.sort_order,'synonyms',i.synonyms,'antonyms',i.antonyms,'notes',i.notes,'hidden',i.hidden,'aliases',i.aliases) FROM idioms i WHERE i.list_id='crossover-v3';",
 "INSERT INTO idiom_revision_backup SELECT '0049','sense-'||s.id,json_object('idiom',s.idiom_id,'meaning',s.meaning,'order',s.sort_order) FROM idiom_senses s WHERE s.idiom_id IN (SELECT id FROM r49_expected);",
 "INSERT INTO idiom_revision_backup SELECT '0049','refs',json_group_array(json_object('sense',r.sense_id,'word',r.word_id,'source',r.source)) FROM idiom_word_refs r WHERE r.sense_id IN (SELECT id FROM r49_senses) HAVING count(*)>0;",
 "INSERT INTO idiom_revision_backup SELECT '0049','section-'||section_key,json_object('subtitle',subtitle,'order',sort_order) FROM idiom_sections WHERE list_id='crossover-v3';"]
# Write entry metadata without replacing whole word or idiom rows.
for n,e in enumerate(entries):
 sets={'phrase':e['phrase'],'section_key':e['sectionKey'],'sort_order':n,'synonyms':e.get('synonyms',''),'antonyms':e.get('antonyms',''),'notes':e.get('notes',''),'hidden':int(e.get('hidden',False)),'aliases':json.dumps(e.get('aliases',[]),ensure_ascii=False)}
 sql.append('UPDATE idioms SET '+','.join(k+'='+q(v) for k,v in sets.items())+f" WHERE id={q(e['key'])} AND list_id='crossover-v3';")
# Upsert retained/new senses first; refs are preserved, including concurrent refs on unchanged IDs.
old_senses={s['id'] for e in before['entries'] for s in e['meanings']};kept=set()
for e in entries:
 for n,s in enumerate(e['meanings']):
  kept.add(s['id'])
  if s['id'] in old_senses:sql.append(f"UPDATE idiom_senses SET idiom_id={q(e['key'])},meaning={q(s['meaning'])},sort_order={n} WHERE id={q(s['id'])};")
  else:sql.append(f"INSERT INTO idiom_senses SELECT {q(s['id'])},{q(e['key'])},{q(s['meaning'])},{n} WHERE EXISTS(SELECT 1 FROM r49_guard);")
for ch in changes:
 if 'duplicateSense' in ch:
  sql.append(f"INSERT OR IGNORE INTO idiom_word_refs SELECT {q(ch['to'])},word_id,source FROM idiom_word_refs WHERE sense_id={q(ch['duplicateSense'])};")
 # Notes-only moved senses originally have no refs, but keep any concurrently added refs.
 if 'movedSenseToNotes' in ch:
  target=next(e for e in entries if e['key']==ch['entry'])['meanings'][0]['id']
  sql.append(f"INSERT OR IGNORE INTO idiom_word_refs SELECT {q(target)},word_id,source FROM idiom_word_refs WHERE sense_id={q(ch['movedSenseToNotes'])};")
for sid in old_senses-kept:sql.append(f"DELETE FROM idiom_senses WHERE id={q(sid)};")
for m in removed:sql.append(f"DELETE FROM idioms WHERE id={q(m['from'])};")
for c in after['chapters']:
 for s in c['sections']:sql.append(f"UPDATE idiom_sections SET subtitle={q(s['subtitle'])} WHERE list_id='crossover-v3' AND section_key={q(s['key'])};")
sql+=['DROP TABLE r49_senses;','DROP TABLE r49_expected;','DROP TABLE r49_guard;']
ROOT.joinpath('migrations/0049_refine_idiom_content.sql').write_text('\n'.join(sql)+'\n')
print(json.dumps({'stored':len(entries),'visible':sum(not e.get('hidden') for e in entries),'hidden':sum(bool(e.get('hidden')) for e in entries),'merged':len(removed),'notes':sum(bool(e.get('notes')) for e in entries),'split':sum(len(e['meanings']) for e in entries)-count},ensure_ascii=False))
