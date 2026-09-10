"""0050: hide productive grammar, consolidate equivalents, freeze visible Section numbers."""
import copy
import hashlib
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
before = json.load(open(sys.argv[1]))
after = copy.deepcopy(before)
entries = after["entries"]
chapters = after["chapters"]
merges = []
moves = []


def get(phrase):
    hits = [entry for entry in entries if entry["phrase"] == phrase]
    assert len(hits) == 1, (phrase, len(hits))
    return hits[0]


def add_alias(entry, source):
    entry.setdefault("aliases", [])
    alias = {"phrase": source["phrase"], "key": source["key"]}
    if alias not in entry["aliases"]:
        entry["aliases"].append(alias)


def add_note(entry, line):
    lines = entry.get("notes", "").splitlines()
    if line and line not in lines:
        lines.append(line)
    entry["notes"] = "\n".join(filter(None, lines))


def merge(phrases, canonical):
    target = get(phrases[0])
    for phrase in phrases[1:]:
        source = get(phrase)
        add_alias(target, source)
        for sense in source["meanings"]:
            same = next((item for item in target["meanings"] if item["meaning"] == sense["meaning"]), None)
            if same:
                known = {ref["wordId"] for ref in same["refs"]}
                same["refs"] += [ref for ref in sense["refs"] if ref["wordId"] not in known]
            else:
                target["meanings"].append(copy.deepcopy(sense))
        for field in ["synonyms", "antonyms"]:
            values = [value.strip() for value in [target.get(field, ""), source.get(field, "")] if value.strip()]
            if values:
                target[field] = ", ".join(dict.fromkeys(values))
        if source.get("notes"):
            add_note(target, source["notes"])
        for alias in source.get("aliases", []):
            if alias not in target.setdefault("aliases", []):
                target["aliases"].append(alias)
        entries.remove(source)
        merges.append({"from": source["key"], "to": target["key"]})
    if target["phrase"] != canonical:
        target.setdefault("aliases", []).append({"phrase": target["phrase"]})
        target["phrase"] = canonical
    return target


def move_section(source_key, target_key):
    for entry in entries:
        if entry["sectionKey"] == source_key:
            moves.append({"key": entry["key"], "from": source_key, "to": target_key})
            entry["sectionKey"] = target_key


# Whole Sections whose content is a productive grammar formula rather than an idiom.
hide_sections = {
    "g12-there", "g12-ditransitive-to", "g12-deprivation", "g12-svoc-basic",
    "g12-svoc-infinitive", "g12-causative", "g12-perception",
    "grammar-3-1", "grammar-3-2", "grammar-3-3", "ga-modal-basic",
    "ga-modal-perfect", "ga-mandative", "ga-conditional", "ga-passive-patterns",
    "grammar-7-1", "grammar-7-2", "ga-infinitive-purpose", "ga-wh-infinitive",
    "grammar-8-1", "grammar-9-2", "ga-with", "ga-exclamation", "grammar-13-2",
    "ga-degree-purpose", "grammar-17-2", "ga-superlative", "grammar-16-1",
    "grammar-19-3",
}
for entry in entries:
    if entry["sectionKey"] in hide_sections:
        entry["hidden"] = True

# Ordinary single-headword complementation belongs on the corresponding word page.
hide_phrases = {
    "look at O", "glance at O", "stare at O", "gaze at O", "glare at O", "listen to O",
    "suspect (that) S V", "doubt (that) S V", "assume (that) S V", "think (that) S V",
    "believe (that) S V", "suppose (that) S V", "assume O (to be) C", "suppose O (to be) C",
    "remind A to V", "remember to V", "remember Ving", "remember (that) S V",
    "recall (that) S V", "remember ＋疑問詞節", "recall ＋疑問詞節", "recall Ving",
    "recollect Ving", "remind A that S V",
}
for phrase in hide_phrases:
    get(phrase)["hidden"] = True

# Adjective/participle government and basic adjective+noun combinations are already on word pages.
for key in {"grammar-6-1", "ga-collocations"}:
    for entry in entries:
        if entry["sectionKey"] == key:
            entry["hidden"] = True

# Fold small useful Sections into nearby lexical Sections.
for source, target in [
    ("g12-sv", "g12-fixed-svc"),
    ("g12-svc-perception", "g12-fixed-svc"),
    ("g12-composition", "g12-suitability"),
    ("g12-of-request", "g12-of-notification"),
    ("g12-from-protection", "g12-from-distinction"),
    ("grammar-15-1", "grammar-15-2"),
    ("ga-body", "grammar-15-2"),
]:
    move_section(source, target)

section_titles = {
    "g12-fixed-svc": "決まった形を取る動詞表現",
    "g12-suitability": "適合・構成を表す動詞表現",
    "g12-of-notification": "通知・要求のof",
    "g12-from-distinction": "区別・分離・保護のfrom",
    "grammar-15-2": "名詞・冠詞の定型表現",
}
for chapter in chapters:
    for section in chapter["sections"]:
        if section["key"] in section_titles:
            section["subtitle"] = section_titles[section["key"]]

# Consolidate interchangeable conversational alternatives as one learnable item.
conversation_groups = [
    (["Long time no see", "It's been a long time since I saw you last.", "I haven’t seen you for a long time."], "Long time no see. / It’s been a long time."),
    (["Nice to meet you.", "It's a pleasure to meet you."], "Nice to meet you. / It’s a pleasure to meet you."),
    (["How is everything (going)?", "How are things (going)?", "How's it going?"], "How is everything / How are things / How’s it going?"),
    (["What's up?", "What's happening?"], "What’s up? / What’s happening?"),
    (["I'm fine.", "I'm doing well.", "Not too bad."], "I’m fine. / I’m doing well. / Not too bad."),
    (["Where are you from?", "Where do you come from?"], "Where are you from? / Where do you come from?"),
    (["See you later.", "So long.", "Good bye.", "See you soon."], "See you later / soon. / So long. / Goodbye."),
    (["Say hello to A.", "Remember me to A.", "Give my (best) regards to A."], "Say hello / Remember me / Give my regards to A."),
    (["May I speak to A?", "May I talk to A?"], "May I speak / talk to A?"),
    (["Who's calling?", "Who is this?", "Who is it?", "Who's speaking?"], "Who’s calling / speaking? / Who is this?"),
    (["Please hold on.", "Please hold the line."], "Please hold on / hold the line."),
    (["Shall I take a message?", "May I take a message?"], "Shall / May I take a message?"),
    (["Can I leave a message (with A)?", "May I leave a message (with A)?"], "Can / May I leave a message (with A)?"),
    (["The line is busy.", "The line is engaged."], "The line is busy / engaged."),
    (["A is on another line.", "A is on another phone."], "A is on another line / phone."),
    (["May I help you?", "Can I help you?", "What can I do for you?"], "May / Can I help you? / What can I do for you?"),
    (["What's the price of A?", "How much is A?"], "What’s the price of A? / How much is A?"),
    (["May I take your order?", "Can I take your order?"], "May / Can I take your order?"),
    (["Have you been waited on?", "Have you been served?"], "Have you been waited on / served?"),
    (["The same for me.", "Same here."], "The same for me. / Same here."),
    (["I'm full.", "I've had enough.", "I've had plenty.", "I've had lots."], "I’m full. / I’ve had enough / plenty / lots."),
    (["Let me pay my bill.", "Let me pay my share."], "Let me pay my bill / share."),
    (["It's on me.", "I'll treat you.", "It's my treat.", "Be my guest."], "It’s on me. / I’ll treat you. / It’s my treat. / Be my guest."),
    (["Do you mind if S V?", "Would you mind if S 過去形?"], "Do / Would you mind if S V?"),
    (["Do you mind my Ving?", "Would you mind my Ving?"], "Do / Would you mind my Ving?"),
    (["Would you be kind enough to V?", "Would you be good enough to V?"], "Would you be kind / good enough to V?"),
    (["Would you do me a favor?", "May I ask a favor of you?"], "Would you do me a favor? / May I ask a favor of you?"),
    (["Go ahead.", "No problem.", "Certainly.", "Why not?"], "Go ahead. / No problem. / Certainly. / Why not?"),
    (["No way.", "Absolutely not."], "No way. / Absolutely not."),
    (["After you.", "I’ll follow you."], "After you. / I’ll follow you."),
    (["No, I don’t.", "Not at all.", "Of course not."], "No, I don’t. / Not at all. / Of course not."),
    (["Don't mention it.", "You're welcome.", "Anytime.", "Never mind.", "Don't worry."], "You’re welcome. / Don’t mention it. / Never mind. / Don’t worry."),
    (["What is the matter (with you)?", "What's wrong?", "What is the problem (with you)?"], "What’s the matter / problem? / What’s wrong?"),
]
for phrases, canonical in conversation_groups:
    merge(phrases, canonical)

# Preserve fixed phrase numbers after this editorial pass. Hidden-only Sections have no number.
visible_keys = {entry["sectionKey"] for entry in entries if not entry.get("hidden")}
section_number = 0
for chapter in chapters:
    for section in chapter["sections"]:
        if section["key"] in visible_keys:
            section_number += 1
            section["number"] = section_number
        else:
            section.pop("number", None)

rank = {section["key"]: index for index, section in enumerate(section for chapter in chapters for section in chapter["sections"])}
entries.sort(key=lambda entry: rank[entry["sectionKey"]])
visible = [entry for entry in entries if not entry.get("hidden")]
assert 1300 <= len(visible) <= 1400, len(visible)
assert section_number == len(visible_keys)

fixture = {"before": before, "after": after, "merges": merges, "moves": moves, "hiddenSections": sorted(hide_sections)}
ROOT.joinpath("test/fixtures/idiom-slimming.json").write_text(json.dumps(fixture, ensure_ascii=False, separators=(",", ":")) + "\n")

q = lambda value: "'" + str(value).replace("'", "''") + "'"
sql = [
    "-- 0050: slim the idiom collection without deleting recoverable hidden entries.",
    "ALTER TABLE idiom_sections ADD COLUMN display_number INTEGER;",
    "CREATE TABLE IF NOT EXISTS idiom_revision_backup (revision TEXT NOT NULL, object_key TEXT NOT NULL, snapshot TEXT NOT NULL, PRIMARY KEY(revision,object_key));",
    "CREATE TABLE slim_guard(ok INTEGER CHECK(ok=1));",
    f"INSERT INTO slim_guard SELECT CASE WHEN (SELECT count(*) FROM idioms WHERE list_id='crossover-v3')={len(before['entries'])} THEN 1 ELSE 0 END WHERE EXISTS(SELECT 1 FROM lists WHERE id='crossover-v3');",
    "CREATE TABLE slim_expected(id TEXT PRIMARY KEY,phrase TEXT,section_key TEXT,hidden INTEGER,synonyms TEXT,antonyms TEXT,notes TEXT,aliases TEXT);",
]
for entry in before["entries"]:
    values = [entry["key"], entry["phrase"], entry["sectionKey"], int(entry.get("hidden", False)), entry.get("synonyms", ""), entry.get("antonyms", ""), entry.get("notes", ""), json.dumps(entry.get("aliases", []), ensure_ascii=False)]
    sql.append("INSERT INTO slim_expected VALUES(" + ",".join(q(value) for value in values) + ");")
sql.append(f"INSERT INTO slim_guard SELECT CASE WHEN (SELECT count(*) FROM idioms i JOIN slim_expected e ON e.id=i.id AND e.phrase=i.phrase AND e.section_key=i.section_key AND e.hidden=i.hidden AND e.synonyms=i.synonyms AND e.antonyms=i.antonyms AND e.notes=i.notes AND e.aliases=i.aliases)={len(before['entries'])} THEN 1 ELSE 0 END WHERE EXISTS(SELECT 1 FROM slim_guard);")
sql.append("CREATE TABLE slim_senses(id TEXT PRIMARY KEY,idiom_id TEXT,meaning TEXT);")
for entry in before["entries"]:
    for sense in entry["meanings"]:
        sql.append(f"INSERT INTO slim_senses VALUES({q(sense['id'])},{q(entry['key'])},{q(sense['meaning'])});")
sense_count = sum(len(entry["meanings"]) for entry in before["entries"])
sql.append(f"INSERT INTO slim_guard SELECT CASE WHEN (SELECT count(*) FROM idiom_senses s JOIN slim_senses e ON e.id=s.id AND e.idiom_id=s.idiom_id AND e.meaning=s.meaning)={sense_count} AND (SELECT count(*) FROM idiom_senses WHERE idiom_id IN (SELECT id FROM slim_expected))={sense_count} THEN 1 ELSE 0 END WHERE EXISTS(SELECT 1 FROM slim_guard);")
sql += [
    "INSERT INTO idiom_revision_backup SELECT '0050',i.id,json_object('phrase',i.phrase,'section',i.section_key,'order',i.sort_order,'synonyms',i.synonyms,'antonyms',i.antonyms,'notes',i.notes,'hidden',i.hidden,'aliases',i.aliases) FROM idioms i WHERE i.list_id='crossover-v3';",
    "INSERT INTO idiom_revision_backup SELECT '0050','sense-'||s.id,json_object('idiom',s.idiom_id,'meaning',s.meaning,'order',s.sort_order) FROM idiom_senses s WHERE s.idiom_id IN (SELECT id FROM slim_expected);",
    "INSERT INTO idiom_revision_backup SELECT '0050','refs',json_group_array(json_object('sense',r.sense_id,'word',r.word_id,'source',r.source)) FROM idiom_word_refs r WHERE r.sense_id IN (SELECT id FROM slim_senses) HAVING count(*)>0;",
    "INSERT INTO idiom_revision_backup SELECT '0050','sections',json_group_array(json_object('key',section_key,'subtitle',subtitle,'order',sort_order)) FROM idiom_sections WHERE list_id='crossover-v3' HAVING count(*)>0;",
]
for index, entry in enumerate(entries):
    values = {
        "phrase": entry["phrase"], "section_key": entry["sectionKey"], "sort_order": index,
        "hidden": int(entry.get("hidden", False)), "synonyms": entry.get("synonyms", ""),
        "antonyms": entry.get("antonyms", ""), "notes": entry.get("notes", ""),
        "aliases": json.dumps(entry.get("aliases", []), ensure_ascii=False),
    }
    sql.append("UPDATE idioms SET " + ",".join(key + "=" + q(value) for key, value in values.items()) + f" WHERE id={q(entry['key'])} AND list_id='crossover-v3';")
for merge_row in merges:
    sql.append(f"UPDATE idiom_senses SET idiom_id={q(merge_row['to'])},sort_order=sort_order+(SELECT COALESCE(MAX(sort_order),-1)+1 FROM idiom_senses WHERE idiom_id={q(merge_row['to'])}) WHERE idiom_id={q(merge_row['from'])};")
    sql.append(f"DELETE FROM idioms WHERE id={q(merge_row['from'])};")

# Merge duplicate meanings after moving their references to the retained sense.
for entry in entries:
    prior = next((old for old in before["entries"] if old["key"] == entry["key"]), None)
    if not prior:
        continue
    gathered = []
    for merge_row in merges:
        if merge_row["to"] == entry["key"]:
            gathered += next(old for old in before["entries"] if old["key"] == merge_row["from"])["meanings"]
    all_old = prior["meanings"] + gathered
    by_meaning = {}
    for sense in all_old:
        if sense["meaning"] in by_meaning:
            target_id = by_meaning[sense["meaning"]]
            sql.append(f"INSERT OR IGNORE INTO idiom_word_refs SELECT {q(target_id)},word_id,source FROM idiom_word_refs WHERE sense_id={q(sense['id'])};")
            sql.append(f"DELETE FROM idiom_senses WHERE id={q(sense['id'])};")
        else:
            by_meaning[sense["meaning"]] = sense["id"]
    for order, sense in enumerate(entry["meanings"]):
        sql.append(f"UPDATE idiom_senses SET sort_order={order} WHERE id={q(sense['id'])};")

for chapter in chapters:
    for section in chapter["sections"]:
        number = section.get("number")
        number_sql = "NULL" if number is None else str(number)
        sql.append(f"UPDATE idiom_sections SET subtitle={q(section['subtitle'])},display_number={number_sql} WHERE list_id='crossover-v3' AND section_key={q(section['key'])};")
sql += ["DROP TABLE slim_senses;", "DROP TABLE slim_expected;", "DROP TABLE slim_guard;"]
ROOT.joinpath("migrations/0050_slim_idiom_collection.sql").write_text("\n".join(sql) + "\n")

print(json.dumps({
    "stored": len(entries), "visible": len(visible), "hidden": sum(bool(entry.get("hidden")) for entry in entries),
    "merged": len(merges), "visibleSections": section_number,
    "chapters": [sum(not entry.get("hidden") and entry["sectionKey"] in {section["key"] for section in chapter["sections"]} for entry in entries) for chapter in chapters],
}, ensure_ascii=False))
