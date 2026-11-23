// Exercise the editor's actual conflict-reload handler with controlled GETs.
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { createContext, runInContext } from "node:vm";

const source = await readFile(new URL("../../public/setting/edit/words.js", import.meta.url), "utf8");
const exposed = source.slice(source.indexOf("export const POS_OPTIONS"))
  .replaceAll("export ", "")
  .replace(/  function rerenderEntry\(id\) \{[^]*?\n  \}/, "  function rerenderEntry(id) { render(id); }")
  .replace("    state: S,", "    state: S, reloadWord, makeRow, mutate, showSaveStep, resetWord,");
assert(exposed.includes("state: S, reloadWord"));
assert(exposed.includes("function rerenderEntry(id) { render(id); }"));

function deferred() {
  let resolve, reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}

function harness() {
  const gets = [], toasts = [], renders = [];
  const button = { disabled: false, textContent: "最新を読み込む" };
  const entry = { querySelector: selector => selector === '[data-op="reload-word"]' ? button : null };
  let confirmed = true, confirms = 0, sheetOpen = false, inlineOpen = false;
  const context = createContext({
    window: { addEventListener() {} },
    CSS: { escape: value => value },
    confirm() { confirms += 1; return confirmed; },
    clone: structuredClone,
    same: (left, right) => JSON.stringify(left) === JSON.stringify(right),
    wordDraft: raw => ({ spelling: raw.spelling, notes: raw.notes, senses: [], examples: [], derivatives: [] }),
    cautions: [],
    api(path, options) {
      const gate = deferred();
      gets.push({ path, ...options, ...gate });
      return gate.promise;
    },
    toast(message, options) { toasts.push({ message, options }); },
    render(id) { renders.push(id); },
    onDoubleActivate() {}, sortable() {}, createNavigator() {},
    isSheetOpen: () => sheetOpen, hasActiveInlineIn: el => !!el && inlineOpen,
    root: { addEventListener() {}, querySelector: () => entry },
  });
  const editor = runInContext(exposed + '\ncreateWordEditor({ root, listId: "test" })', context);
  const row = editor.makeRow({ id: "a", spelling: "start", notes: "old base" });
  row.draft.notes = "confirmed-for-discard draft";
  row.error = "existing save conflict";
  row.conflict = true;
  editor.state.rows.set(row.id, row);
  editor.state.order.push({ id: row.id, spelling: "start", sectionId: 1, labelId: null });
  const latest = { id: "a", spelling: "start", notes: "server value", lists: [{ listId: "test", sectionId: 1 }] };
  return {
    ...editor, row, gets, toasts, renders, button, latest,
    decline() { confirmed = false; },
    confirms: () => confirms,
    openSheet() { sheetOpen = true; },
    openInline() { inlineOpen = true; },
  };
}

test("a delayed read never replaces a draft changed after confirmation", async () => {
  const f = harness();
  const pending = f.reloadWord(f.row);
  f.mutate(f.row, draft => { draft.notes = "newer draft"; });
  f.gets[0].resolve(f.latest);
  await pending;
  assert.equal(f.row.draft.notes, "newer draft");
  assert.equal(f.row.base.notes, "old base");
  assert.equal(f.row.conflict, true);
  assert.equal(f.button.disabled, false);
});

test("a collection working copy or any open editing sheet prevents applying the old reload", async () => {
  for (const open of [f => { f.row.editingCollection = true; }, f => f.openSheet(), f => f.openInline()]) {
    const f = harness();
    const pending = f.reloadWord(f.row);
    open(f);
    f.gets[0].resolve(f.latest);
    await pending;
    assert.equal(f.row.draft.notes, "confirmed-for-discard draft");
    assert.deepEqual(f.renders, [], "leave focus and the live editor alone");
    assert.equal(f.button.disabled, false);
  }
});

test("a newer save attempt supersedes the delayed read even after the save stops", async () => {
  const f = harness();
  const pending = f.reloadWord(f.row);
  f.showSaveStep(f.row, ["test"], 0);
  f.row.saving = false;
  f.gets[0].resolve(f.latest);
  await pending;
  assert.equal(f.row.draft.notes, "confirmed-for-discard draft");
  assert.equal(f.row.base.notes, "old base");
});

test("a reset and edit back to the same draft text still supersedes the read", async () => {
  const f = harness();
  const pending = f.reloadWord(f.row);
  f.resetWord(f.row);
  f.mutate(f.row, draft => { draft.notes = "confirmed-for-discard draft"; });
  f.gets[0].resolve(f.latest);
  await pending;
  assert.equal(f.row.draft.notes, "confirmed-for-discard draft");
  assert.equal(f.row.base.notes, "old base");
});

test("failure leaves the conflict and draft intact and allows a successful retry", async () => {
  const f = harness();
  const pending = f.reloadWord(f.row);
  f.gets[0].reject(new Error("network unavailable"));
  await pending;
  assert.equal(f.row.draft.notes, "confirmed-for-discard draft");
  assert.equal(f.row.error, "existing save conflict");
  assert.match(f.toasts.at(-1).message, /最新の内容を読み込めませんでした.*下書き.*もう一度/);
  assert.equal(f.toasts.at(-1).options.tone, "error");
  assert.equal(f.button.disabled, false);
  assert.equal(f.button.textContent, "最新を読み込む");
  const retry = f.reloadWord(f.row);
  assert.equal(f.gets[1].path, "/words/a");
  assert.equal(f.gets[1].fresh, true);
  f.gets[1].resolve(f.latest);
  await retry;
  assert.equal(f.row.draft.notes, "server value");
  assert.equal(f.row.base.notes, "server value");
  assert.equal(f.row.error, "");
  assert.equal(f.row.conflict, false);
  assert.deepEqual(f.renders, ["a"]);
});

test("reload disables only its own control while pending and ignores repeat dispatches", async () => {
  const f = harness();
  const pending = f.reloadWord(f.row);
  const duplicate = f.reloadWord(f.row);
  const requested = f.gets.length;
  const disabled = f.button.disabled;
  const label = f.button.textContent;
  for (const req of f.gets) req.resolve(f.latest);
  await Promise.all([pending, duplicate]);
  assert.equal(requested, 1);
  assert.equal(f.confirms(), 1);
  assert.equal(disabled, true);
  assert.match(label, /読み込み中/);
});

test("a removed or replaced row is never redrawn or mutated by a late response", async () => {
  for (const replace of [false, true]) {
    const f = harness();
    const pending = f.reloadWord(f.row);
    const replacement = f.makeRow({ id: "a", spelling: "start", notes: "replacement row" });
    if (replace) f.state.rows.set("a", replacement);
    else f.state.rows.delete("a");
    f.gets[0].resolve(f.latest);
    await pending;
    assert.equal(f.row.draft.notes, "confirmed-for-discard draft");
    assert.equal(replacement.draft.notes, "replacement row");
    assert.deepEqual(f.renders, []);
  }
});

test("a server response for another row or removed membership cannot clear the draft", async () => {
  for (const override of [{ id: "another" }, { lists: [] }]) {
    const f = harness();
    const pending = f.reloadWord(f.row);
    f.gets[0].resolve({ ...f.latest, ...override });
    await pending;
    assert.equal(f.row.draft.notes, "confirmed-for-discard draft");
    assert.equal(f.row.conflict, true);
    assert.equal(f.button.disabled, false);
    assert.equal(f.toasts.at(-1).options.tone, "error");
  }
});

test("cancel remains a no-op", async () => {
  const f = harness();
  f.decline();
  await f.reloadWord(f.row);
  assert.equal(f.gets.length, 0);
  assert.equal(f.row.draft.notes, "confirmed-for-discard draft");
});
