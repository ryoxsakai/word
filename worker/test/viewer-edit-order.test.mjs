// Exercise the editor's actual move, undo, placement and API functions with
// controlled responses, without accessing production or timing real requests.
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { createContext, runInContext } from "node:vm";

const source = await readFile(new URL("../../public/setting/edit/words.js", import.meta.url), "utf8");
const apiSource = await readFile(new URL("../../public/setting/edit/api.js", import.meta.url), "utf8");
const exposed = source.slice(source.indexOf("export const POS_OPTIONS"))
  .replaceAll("export ", "")
  .replace("    state: S,", "    state: S, moveWordsTo, removeWord, commitNewWord, insertNewWord, applyFreshWords,");
assert(exposed.includes("state: S, moveWordsTo"));

const item = (id, sectionId, labelId, branch = 0) => ({ id, spelling: id, sectionId, labelId, branch });
const initial = () => [item("a", 10, 11), item("a-child", 10, 11, 1), item("b", 10, 11), item("c", 20, 21)];
const ids = editor => Array.from(editor.state.order, row => row.id);
function deferred() {
  let resolve;
  const promise = new Promise(r => { resolve = r; });
  return { promise, resolve };
}
const response = (data, status = 200) => Response.json(data, { status });
const settled = async result => { await result; await new Promise(resolve => setImmediate(resolve)); };

function harness(transport) {
  const requests = [], toasts = [];
  let drag;
  const root = { addEventListener() {}, querySelector: () => null, querySelectorAll: () => [] };
  const context = createContext({
    EDITOR_API_BASE: "", AbortController, setTimeout, clearTimeout,
    editorFetch(path, options) {
      const req = { path, method: options.method, body: options.body ? JSON.parse(options.body) : undefined };
      requests.push(req);
      return transport(req);
    },
    window: { addEventListener() {} },
    CSS: { escape: value => value },
    confirm: () => true,
    rememberSaved() {}, recentSaved: () => null,
    clone: structuredClone, same: (a, b) => JSON.stringify(a) === JSON.stringify(b),
    wordDraft: raw => ({ spelling: raw.spelling, pronunciation: raw.pronunciation, notes: raw.notes, senses: [], examples: [], derivatives: [] }),
    wordPayload: raw => raw,
    toast(message, options = {}) { toasts.push({ message, options }); },
    onDoubleActivate() {}, finishInlineEditing() {}, hasActiveInlineIn: () => false,
    createNavigator() {}, sortable(_, config) { drag = config; },
    collectDerivativeCrossReferences: () => [], collectPhraseCrossReferences: () => [],
    addDerivativeCrossReferenceAliases: index => index,
    createPhraseCrossReferenceResolver: () => () => ({}), createIdiomReferenceResolver: () => () => ({}),
    groupIdiomEntries: () => [], createScopedCrossRefRenderer: () => () => "",
    h: val => val, hierarchyIcon: () => "", requestAnimationFrame() {},
  });
  const editor = runInContext(
    apiSource.slice(apiSource.indexOf("export const PENDING_KEY")).replaceAll("export ", "") +
    "\n" + exposed + "\ncreateWordEditor({ root: args, listId: 'test' })",
    Object.assign(context, { args: root }),
  );
  editor.state.order = initial();
  editor.state.sections = [{ id: 10, chapterId: 1, sortOrder: 1 }, { id: 20, chapterId: 1, sortOrder: 2 }];
  editor.state.chapters = [{ id: 1, sortOrder: 1 }];
  editor.state.labels = [{ id: 11, sectionId: 10, sortOrder: 1 }, { id: 21, sectionId: 20, sortOrder: 1 }];
  for (const row of editor.state.order) {
    const base = { spelling: row.spelling, no: "", sectionId: "", labelId: "", senses: [], examples: [], derivatives: [] };
    editor.state.rows.set(row.id, { id: row.id, raw: { ...row }, base, draft: { ...base } });
  }
  return { editor, requests, toasts, drag };
}

test("a pending drag blocks another drop, bulk move, deletion, addition and header reorder", async () => {
  const pending = deferred();
  const { editor, requests, toasts, drag } = harness(() => pending.promise);
  const move = drag.onDrop("a", "c", false);
  assert.deepEqual(ids(editor), ["b", "c", "a", "a-child"]);
  assert.equal(drag.canDrag({ dataset: { wordId: "b" } }), false);
  drag.onDrop("b", "a", false); // A drag already started before the save.
  editor.moveWordsTo(["b"], 20, 21);
  editor.removeWord(editor.state.rows.get("b"));
  editor.insertNewWord("b");
  editor.saveSectionOrder([...editor.state.sections].reverse());
  assert.equal(requests.length, 1);
  assert.ok(toasts.some(({ message }) => message.includes("保存中")));
  pending.resolve(response({ ok: true, count: 3 }));
  await settled(move);
  assert.deepEqual(ids(editor), ["b", "c", "a", "a-child"]);
  assert.equal(drag.canDrag({ dataset: { wordId: "b" } }), true);
});

test("known rejection rolls back section and label of head and child without losing a newer spelling", async () => {
  const pending = deferred();
  const { editor, requests, drag } = harness(() => pending.promise);
  const move = drag.onDrop("a", "c", false);
  assert.equal(editor.state.rows.get("a-child").raw.sectionId, 20);
  editor.state.order.find(row => row.id === "a").spelling = "updated";
  pending.resolve(response({ error: "label does not belong to section" }, 400));
  await settled(move);
  assert.equal(requests.length, 1);
  assert.deepEqual(ids(editor), ["a", "a-child", "b", "c"]);
  assert.equal(editor.state.order[0].spelling, "updated");
  for (const id of ["a", "a-child"]) {
    assert.equal(editor.state.rows.get(id).raw.sectionId, 10);
    assert.equal(editor.state.rows.get(id).raw.labelId, 11);
  }
  assert.equal(editor.seqOf("a-child"), "1-1");
  assert.equal(editor.state.resolveHeadwordRef("updated").id, "a");
});

test("lost receipt confirmed by full live placement read does not send a second POST", async () => {
  const { editor, requests, drag, toasts } = harness(({ method }) => method === "POST"
    ? response({ error: "lost acknowledgement" }, 500)
    : response([
      { ...item("b", 10, 11), no: 1 }, { ...item("c", 20, 21), no: 2 },
      { ...item("a", 20, 21), no: 3 }, { ...item("a-child", 20, 21, 1), no: 3 },
    ]));
  await settled(drag.onDrop("a", "c", false));
  assert.deepEqual(requests.map(req => [req.method, req.path]), [
    ["POST", "/api/lists/test/reorder"], ["GET", "/api/lists/test/words"],
  ]);
  assert.deepEqual(ids(editor), ["b", "c", "a", "a-child"]);
  assert.ok(toasts.at(-1).options.undo);
  assert.equal(drag.canDrag({ dataset: { wordId: "b" } }), true);
});

test("ambiguous receipt with partial branch placement blocks later mutations instead of assuming failure", async () => {
  const { editor, requests, drag, toasts } = harness(({ method }) => method === "POST"
    ? response({ ok: true, count: 2 })
    : response([
      { ...item("b", 10, 11), no: 1 }, { ...item("c", 20, 21), no: 2 },
      { ...item("a", 20, 21), no: 3 }, { ...item("a-child", 10, 11, 1), no: 3 },
    ]));
  await settled(drag.onDrop("a", "c", false));
  assert.equal(toasts.at(-1).options.undo, undefined);
  assert.match(toasts.at(-1).message, /保存結果を確認できません/);
  assert.deepEqual(ids(editor), ["b", "c", "a", "a-child"]);
  assert.equal(drag.canDrag({ dataset: { wordId: "b" } }), false);
  await editor.moveWordsTo(["b"], 20, 21);
  assert.equal(requests.length, 2);
});

test("new registration holds placement queue from create to reorder and excludes drafts from the POST", async () => {
  const created = deferred(), ordered = deferred();
  const { editor, requests, drag } = harness(({ path }) => path.endsWith("/words") ? created.promise : ordered.promise);
  editor.insertNewWord("a");
  editor.insertNewWord("b");
  const row = editor.state.rows.get("__new_1");
  row.draft.spelling = "new";
  row.draft.pronunciation = "nu";
  const adding = editor.commitNewWord(row);
  assert.deepEqual(requests.map(r => r.path), ["/api/words"]);
  await editor.moveWordsTo(["b"], 20, 21);
  assert.equal(requests.length, 1);
  created.resolve(response({ id: "new", spelling: "new", pronunciation: "nu" }));
  for (let attempt = 0; requests.length < 2 && attempt < 20; attempt++) await new Promise(resolve => setImmediate(resolve));
  assert.equal(requests.length, 2);
  assert.equal(requests[1].path, "/api/lists/test/reorder");
  assert.deepEqual(requests[1].body.items.map(row => row.wordId), ["a", "new", "b", "c"]);
  assert.equal(drag.canDrag({ dataset: { wordId: "b" } }), false);
  ordered.resolve(response({ ok: true, count: 4 }));
  await adding;
  assert.equal(row.saving, false);
  assert.equal(row.isNew, false);
  assert.equal(drag.canDrag({ dataset: { wordId: "b" } }), true);
});

test("an asynchronous snapshot cannot replace the current displayed placement", async () => {
  const { editor, drag } = harness(() => response({ ok: true, count: 3 }));
  await settled(drag.onDrop("a", "c", false));
  editor.applyFreshWords("10", [{ ...item("a", 10, 11), notes: "different" }]);
  assert.equal(editor.state.rows.get("a").raw.sectionId, 20);
  assert.equal(editor.state.rows.get("a").raw.labelId, 21);
  assert.equal(editor.state.rows.get("a").raw.notes, "different");
});

test("last successful placement can be undone, preserving word edits and staying serialized", async () => {
  const second = deferred();
  let writes = 0;
  const { editor, requests, drag, toasts } = harness(() => ++writes === 1 ? response({ ok: true, count: 3 }) : second.promise);
  await settled(drag.onDrop("a", "c", false));
  const undo = toasts.at(-1).options.undo;
  editor.state.order.find(row => row.id === "a").spelling = "renamed";
  undo();
  assert.deepEqual(ids(editor), ["a", "a-child", "b", "c"]);
  assert.equal(editor.state.order[0].spelling, "renamed");
  editor.moveWordsTo(["b"], 20, 21);
  undo();
  assert.equal(requests.length, 2);
  second.resolve(response({ ok: true, count: 3 }));
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(drag.canDrag({ dataset: { wordId: "b" } }), true);
});

test("unknown creation outcome does not permit re-creation or an order write based on old membership", async () => {
  const { editor, requests, drag, toasts } = harness(() => response({ error: "connection interrupted" }, 500));
  editor.insertNewWord("b");
  const row = editor.state.rows.get("__new_1");
  row.draft.spelling = "new";
  row.draft.pronunciation = "nu";
  await editor.commitNewWord(row);
  assert.match(toasts.at(-1).message, /登録結果を確認できません/);
  await editor.commitNewWord(row);
  await settled(drag.onDrop("a", "c", false));
  assert.equal(requests.length, 1);
});

test("first rejection cannot overwrite a newer move from this tab", async () => {
  const rejected = deferred(), accepted = deferred();
  let writes = 0;
  const { editor, requests, drag } = harness(() => ++writes === 1 ? rejected.promise : accepted.promise);
  const first = drag.onDrop("a", "c", false);
  const second = drag.onDrop("b", "a", false);
  accepted.resolve(response({ ok: true, count: 3 }));
  await settled(second);
  rejected.resolve(response({ error: "invalid placement" }, 400));
  await settled(first);
  assert.deepEqual(ids(editor), ["a", "a-child", "b", "c"], "there was no acknowledged newer write to overwrite");
  assert.equal(requests.length, 1);
  await settled(drag.onDrop("b", "a", true));
  assert.deepEqual(ids(editor), ["b", "a", "a-child", "c"]);
  assert.equal(requests.length, 2);
});
