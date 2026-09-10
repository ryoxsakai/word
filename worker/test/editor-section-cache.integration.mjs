import { saveIdiom } from "../src/idioms.js";
import assert from "node:assert/strict";
import { mkdtempSync, readdirSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { build } from "esbuild";
import { Miniflare } from "miniflare";

const stateDir = mkdtempSync(join(tmpdir(), "vocab-editor-cache-"));
const bundle = await build({
  entryPoints: [new URL("../src/index.js", import.meta.url).pathname],
  bundle: true,
  format: "esm",
  platform: "browser",
  write: false,
});
const miniflare = new Miniflare({
  modules: true,
  script: bundle.outputFiles[0].text,
  compatibilityDate: "2024-11-01",
  d1Databases: ["DB"],
  d1Persist: stateDir,
});

function normalizeMigrationSql(sql) {
  const triggers = [];
  const withoutComments = sql.replace(/^\s*--.*$/gm, "");
  const protectedSql = withoutComments.replace(/CREATE\s+TRIGGER[\s\S]*?END\s*;/gi, (trigger) => {
    const marker = `__TRIGGER_${triggers.length}__`;
    triggers.push(trigger.replace(/;\s*$/, "").replace(/\s+/g, " "));
    return `${marker};`;
  });
  return protectedSql
    .split(";")
    .map((statement) => statement.trim().replace(/\s+/g, " "))
    .filter(Boolean)
    .map((statement) => statement.replace(/__TRIGGER_(\d+)__/g, (_match, index) => triggers[Number(index)]))
    .map((statement) => statement + ";")
    .join("\n");
}

async function fetchApi(path, headers = {}) {
  return miniflare.dispatchFetch(`https://vocab.lrnr.jp/api${path}`, { headers });
}

try {
  const db = await miniflare.getD1Database("DB");
  const migrationDir = new URL("../migrations/", import.meta.url);
  for (const filename of readdirSync(migrationDir).filter((name) => name.endsWith(".sql")).sort()) {
    await db.exec(normalizeMigrationSql(readFileSync(new URL(filename, migrationDir), "utf8")));
  }

  await db.prepare("INSERT INTO lists (id, name) VALUES (?, ?)").bind("editor-cache-test", "Editor cache test").run();
  await db
    .prepare("INSERT INTO chapters (id, list_id, subtitle, sort_order) VALUES (?, ?, ?, ?)")
    .bind(99001, "editor-cache-test", "Chapter", 1)
    .run();
  await db
    .prepare("INSERT INTO sections (id, list_id, name, sort_order, chapter_id) VALUES (?, ?, ?, ?, ?)")
    .bind(99001, "editor-cache-test", "Section 1", 1, 99001)
    .run();
  await db
    .prepare("INSERT INTO sections (id, list_id, name, sort_order, chapter_id) VALUES (?, ?, ?, ?, ?)")
    .bind(99002, "editor-cache-test", "Section 2", 2, 99001)
    .run();
  await db
    .prepare("INSERT INTO section_labels (id, list_id, section_id, name, sort_order) VALUES (?, ?, ?, ?, ?)")
    .bind(99001, "editor-cache-test", 99001, "Label", 1)
    .run();

  for (const [id, spelling] of [["cache-alpha", "alpha"], ["cache-beta", "beta"], ["cache-gamma", "gamma"]]) {
    await db.prepare("INSERT INTO words (id, spelling) VALUES (?, ?)").bind(id, spelling).run();
  }
  await db
    .prepare("INSERT INTO list_items (list_id, word_id, no, branch, section_id, label_id) VALUES (?, ?, ?, ?, ?, ?)")
    .bind("editor-cache-test", "cache-alpha", 1, 0, 99001, null)
    .run();
  await db
    .prepare("INSERT INTO list_items (list_id, word_id, no, branch, section_id, label_id) VALUES (?, ?, ?, ?, ?, ?)")
    .bind("editor-cache-test", "cache-beta", 2, 0, 99002, null)
    .run();
  await db
    .prepare("INSERT INTO list_items (list_id, word_id, no, branch, section_id, label_id) VALUES (?, ?, ?, ?, ?, ?)")
    .bind("editor-cache-test", "cache-gamma", 3, 0, null, null)
    .run();
  await db
    .prepare("INSERT INTO senses (word_id, pos, meaning, sort_order, is_primary) VALUES (?, ?, ?, ?, ?)")
    .bind("cache-alpha", "名", "最初", 1, 1)
    .run();
  await db
    .prepare("INSERT INTO examples (word_id, sentence, translation, sort_order, type) VALUES (?, ?, ?, ?, ?)")
    .bind("cache-alpha", "alpha phrase", "アルファの句", 1, "phrase")
    .run();
  await db
    .prepare("INSERT INTO derivatives (word_id, word, pos, meaning, sort_order) VALUES (?, ?, ?, ?, ?)")
    .bind("cache-alpha", "alphabetic", "形", "アルファベットの", 1)
    .run();

  const indexResponse = await fetchApi("/lists/editor-cache-test/editor/index");
  assert.equal(indexResponse.status, 200);
  assert.match(indexResponse.headers.get("cache-control"), /must-revalidate/);
  const etag = indexResponse.headers.get("etag");
  assert.ok(etag);
  const index = await indexResponse.json();
  assert.deepEqual(index.words.map((word) => word.spelling), ["gamma", "alpha", "beta"]);
  assert.equal(index.words[1].displayNo, "1");
  assert.equal("primaryMeaning" in index.words[1], false);

  const notModified = await fetchApi("/lists/editor-cache-test/editor/index", { "If-None-Match": etag });
  assert.equal(notModified.status, 304);

  const sectionResponse = await fetchApi("/lists/editor-cache-test/editor/sections/99001");
  assert.equal(sectionResponse.status, 200);
  const sectionWords = await sectionResponse.json();
  assert.deepEqual(sectionWords.map((word) => word.spelling), ["alpha"]);
  assert.equal(sectionWords[0].primaryMeaning, "最初");
  assert.deepEqual(sectionWords[0].phrases, ["alpha phrase"]);

  const noneResponse = await fetchApi("/lists/editor-cache-test/editor/sections/none");
  assert.deepEqual((await noneResponse.json()).map((word) => word.spelling), ["gamma"]);

  const referencesResponse = await fetchApi("/lists/editor-cache-test/editor/references");
  const references = await referencesResponse.json();
  assert.deepEqual(references.words, [{
    id: "cache-alpha",
    spelling: "alpha",
    phrases: ["alpha phrase"],
    derivatives: [{ word: "alphabetic" }],
  }]);

  const legacyResponse = await fetchApi("/lists/editor-cache-test/words");
  assert.equal((await legacyResponse.json()).length, 3);

  const masterIndexResponse = await fetchApi("/master/index");
  const masterIndex = await masterIndexResponse.json();
  assert.ok(masterIndex.words.some((word) => word.id === "cache-alpha" && word.spelling === "alpha"));
  assert.equal("primaryMeaning" in masterIndex.words.find((word) => word.id === "cache-alpha"), false);
  assert.deepEqual(masterIndex.words.find((word) => word.id === "cache-alpha").derivatives, [{ word: "alphabetic" }]);

  const idiomsBefore = await (await fetchApi("/lists/editor-cache-test/idioms")).json();
  assert.equal(idiomsBefore.managed, false);
  await db.prepare("INSERT INTO idiom_sections (list_id,section_key,subtitle,chapter_key,chapter_subtitle,chapter_order,sort_order,group_key,group_subtitle,group_order) VALUES ('editor-cache-test', 'test', 'Test', 'test', 'Test', 1, 1, 'test-group', 'Test Group', 1)").run();
  await db.prepare("INSERT INTO idioms (id,list_id,phrase,section_key) VALUES ('cache-idiom','editor-cache-test','alpha phrase','test')").run();
  await db.prepare("INSERT INTO idiom_senses (id,idiom_id,meaning) VALUES ('cache-sense','cache-idiom','意味')").run();
  await db.prepare("INSERT INTO idiom_word_refs (sense_id,word_id) VALUES ('cache-sense','cache-alpha')").run();
  const idioms = await (await fetchApi("/lists/editor-cache-test/idioms")).json();
  assert.equal(idioms.entries[0].meanings[0].refs[0].wordId, "cache-alpha");
  assert.equal(idioms.chapters[0].sections[0].groupKey, 'test-group');
  assert.equal(idioms.chapters[0].sections[0].groupSubtitle, 'Test Group');
  const idiomIndex = await (await fetchApi("/lists/editor-cache-test/idioms/index")).json();
  assert.equal(idiomIndex.entries[0].phrase, "alpha phrase");
  assert.deepEqual(idiomIndex.entries[0].meanings, [], "idiom index omits section detail");
  const idiomSection = await (await fetchApi("/lists/editor-cache-test/idioms/sections/test")).json();
  assert.equal(idiomSection.entries[0].meanings[0].refs[0].wordId, "cache-alpha");
  const reorderIdiomsResponse = await miniflare.dispatchFetch("https://vocab.lrnr.jp/api/lists/editor-cache-test/idioms/reorder", {method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({entries:[{id:"cache-idiom",sectionKey:"test"}]})});
  assert.equal(reorderIdiomsResponse.status, 200);
  const reorderSectionsResponse = await miniflare.dispatchFetch("https://vocab.lrnr.jp/api/lists/editor-cache-test/idioms/sections/reorder", {method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({sectionKeys:["test"]})});
  assert.equal(reorderSectionsResponse.status, 200);
  const publicIdioms = await miniflare.dispatchFetch("https://vocab.lrnr.jp/mcp-viewer/api/lists/editor-cache-test/idioms");
  assert.equal(publicIdioms.status, 200);
  assert.deepEqual(await publicIdioms.json(), idioms, "public viewer route serves the independent collection");
  const publicIdiomIndex = await miniflare.dispatchFetch("https://vocab.lrnr.jp/mcp-viewer/api/lists/editor-cache-test/idioms/index");
  assert.equal(publicIdiomIndex.status, 200);
  assert.deepEqual(await publicIdiomIndex.json(), await (await fetchApi("/lists/editor-cache-test/idioms/index")).json());
  const publicIdiomSection = await miniflare.dispatchFetch("https://vocab.lrnr.jp/mcp-viewer/api/lists/editor-cache-test/idioms/sections/test");
  assert.equal(publicIdiomSection.status, 200);
  assert.deepEqual(await publicIdiomSection.json(), idiomSection);
  const full = await (await fetchApi("/lists/editor-cache-test/words/full")).json();
  assert.equal(full.words.find(w=>w.id === "cache-alpha").relatedIdiomCount, 1);
  assert.equal((await miniflare.dispatchFetch("https://vocab.lrnr.jp/mcp-viewer/api/lists/editor-cache-test/idioms", {method:"PUT"})).status, 405);
  assert.equal((await miniflare.dispatchFetch("https://vocab.lrnr.jp/mcp-editor/api/lists/editor-cache-test/idioms", {method:"PUT"})).status, 401);
  await saveIdiom(db, "editor-cache-test", {id:"cache-idiom",phrase:"alpha phrase",sectionKey:"test",synonyms:"##word:alpha##",antonyms:"opposite",notes:"**メモ**",hidden:true,meanings:[{id:"cache-sense",meaning:"意味",wordIds:["cache-alpha"]}]});
  const edited = await (await miniflare.dispatchFetch("https://vocab.lrnr.jp/mcp-viewer/api/lists/editor-cache-test/idioms")).json();
  assert.equal(edited.entries[0].synonyms,"##word:alpha##");
  assert.equal(edited.entries[0].notes,"**メモ**");
  assert.equal(edited.entries[0].hidden,true);
  assert.equal(edited.entries[0].meanings[0].id,"cache-sense");
  console.log("editor section cache, rich idiom fields and idiom route integration test passed");
} finally {
  await miniflare.dispose();
  rmSync(stateDir, { recursive: true, force: true });
}
