import { renderMarkup } from "../shared/markup.js";
import { API_BASE } from "../shared/config.js";

const API = `${API_BASE}/api`;
const NEW_SECTION_VALUE = "__new__";

const state = {
  lists: [],
  currentListId: null,
  listWordIndex: new Map(), // spelling(lower) -> { id, no: displayNo }
  words: [], // 現在のリストの一覧（テーブル表示用）
  sections: [], // 現在のリストのセクション一覧
  currentWord: null, // 編集中の単語詳細（新規時はnull）
  isNew: false,
  currentAudioUrl: null, // 編集中の単語の発音音声URL（辞書取得 or 保存済みの値）
};

const el = {
  listSelect: document.getElementById("listSelect"),
  newListBtn: document.getElementById("newListBtn"),
  listTitle: document.getElementById("listTitle"),
  newWordBtn: document.getElementById("newWordBtn"),
  copyRangeBtn: document.getElementById("copyRangeBtn"),
  importByTagBtn: document.getElementById("importByTagBtn"),
  importAwlBtn: document.getElementById("importAwlBtn"),
  importOxford5000Btn: document.getElementById("importOxford5000Btn"),
  wordTableBody: document.getElementById("wordTableBody"),
  wordTableEmpty: document.getElementById("wordTableEmpty"),
  editPane: document.getElementById("editPane"),
  editTitle: document.getElementById("editTitle"),
  saveBtn: document.getElementById("saveBtn"),
  deleteBtn: document.getElementById("deleteBtn"),
  closeBtn: document.getElementById("closeBtn"),
  fieldNo: document.getElementById("fieldNo"),
  fieldSpelling: document.getElementById("fieldSpelling"),
  fieldPronunciation: document.getElementById("fieldPronunciation"),
  lookupPronunciationBtn: document.getElementById("lookupPronunciationBtn"),
  playAudioBtn: document.getElementById("playAudioBtn"),
  draftFromDictionaryBtn: document.getElementById("draftFromDictionaryBtn"),
  fieldDerivedFrom: document.getElementById("fieldDerivedFrom"),
  fieldSection: document.getElementById("fieldSection"),
  sensesList: document.getElementById("sensesList"),
  derivativesList: document.getElementById("derivativesList"),
  examplesList: document.getElementById("examplesList"),
  fieldEtymology: document.getElementById("fieldEtymology"),
  etymologyPreview: document.getElementById("etymologyPreview"),
  fieldNotes: document.getElementById("fieldNotes"),
  notesPreview: document.getElementById("notesPreview"),
  tagOxford5000: document.getElementById("tagOxford5000"),
  tagAwl: document.getElementById("tagAwl"),
  tagEiken: document.getElementById("tagEiken"),
  tagCustom: document.getElementById("tagCustom"),
};

const templates = {
  senses: document.getElementById("senseRowTpl"),
  derivatives: document.getElementById("derivativeRowTpl"),
  examples: document.getElementById("exampleRowTpl"),
};

async function api(path, opts) {
  const res = await fetch(`${API}${path}`, {
    headers: { "content-type": "application/json" },
    ...opts,
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `HTTP ${res.status}`);
  }
  return res.status === 204 ? null : res.json();
}

function resolveRef(headword) {
  const hit = state.listWordIndex.get(headword.toLowerCase());
  if (!hit) return { found: false };
  return { found: true, id: hit.id, no: hit.no };
}

function updatePreview(textarea, previewEl) {
  previewEl.innerHTML = renderMarkup(textarea.value, { resolve: resolveRef }) || '<span style="color:#999">（プレビュー）</span>';
}

// ---- 辞書からの自動取得（発音記号・音声・例文・類義語/対義語）----

async function fetchWordInfo(spelling) {
  if (!spelling) return null;
  try {
    const info = await api(`/lookup?spelling=${encodeURIComponent(spelling)}`);
    if (info && info.error) {
      console.error("辞書取得エラー:", info.error);
    }
    return info;
  } catch (err) {
    console.error("辞書取得に失敗しました（/api/lookup）:", err);
    return null;
  }
}

function updatePlayAudioButton() {
  el.playAudioBtn.disabled = !state.currentAudioUrl;
}

function playCurrentAudio() {
  if (!state.currentAudioUrl) return;
  new Audio(state.currentAudioUrl).play().catch((err) => console.error("音声再生に失敗しました:", err));
}

// スペルを入力し終えたタイミングで、発音記号が未入力なら自動で埋める。
async function autoFillPronunciationOnBlur() {
  const spelling = el.fieldSpelling.value.trim();
  if (!spelling || el.fieldPronunciation.value.trim()) return;
  const info = await fetchWordInfo(spelling);
  if (info && info.pronunciation) el.fieldPronunciation.value = info.pronunciation;
  if (info && info.audio) {
    state.currentAudioUrl = info.audio;
    updatePlayAudioButton();
  }
}

// 🔍ボタン: 現在の値を問わず辞書から取り直す。
async function lookupPronunciationManually() {
  const spelling = el.fieldSpelling.value.trim();
  if (!spelling) {
    alert("先にスペルを入力してください");
    return;
  }
  el.lookupPronunciationBtn.disabled = true;
  try {
    const info = await fetchWordInfo(spelling);
    if (info && info.pronunciation) {
      el.fieldPronunciation.value = info.pronunciation;
    }
    if (info && info.audio) {
      state.currentAudioUrl = info.audio;
      updatePlayAudioButton();
    }
    if (!info || (!info.pronunciation && !info.audio)) {
      const reason = info && info.error ? `（エラー: ${info.error}）` : "";
      alert(`「${spelling}」の発音記号が辞書から見つかりませんでした${reason}。手動で入力してください。`);
    }
  } finally {
    el.lookupPronunciationBtn.disabled = false;
  }
}

// 📖ボタン: 発音・音声に加え、例文（英語）と類義語/対義語もまとめて下書き取得する。
// 定義は英語のみで日本語訳が取れないため、意味欄には自動で入れない。
async function draftFromDictionary() {
  const spelling = el.fieldSpelling.value.trim();
  if (!spelling) {
    alert("先にスペルを入力してください");
    return;
  }
  el.draftFromDictionaryBtn.disabled = true;
  try {
    const info = await fetchWordInfo(spelling);
    if (!info || info.error) {
      alert(`「${spelling}」の情報が辞書から見つかりませんでした${info && info.error ? `（エラー: ${info.error}）` : ""}。`);
      return;
    }

    let filledAnything = false;

    if (info.pronunciation && !el.fieldPronunciation.value.trim()) {
      el.fieldPronunciation.value = info.pronunciation;
      filledAnything = true;
    }
    if (info.audio) {
      state.currentAudioUrl = info.audio;
      updatePlayAudioButton();
      filledAnything = true;
    }

    const hasExample = collectRows("examples").length > 0;
    if (!hasExample && info.examples && info.examples.length > 0) {
      const rows = [...el.examplesList.querySelectorAll(".repeat-row")];
      if (rows.length === 1 && !rows[0].querySelector(".sentence").value.trim()) rows[0].remove();
      addRow("examples", { sentence: info.examples[0] });
      filledAnything = true;
    }

    const refWords = [...info.synonyms, ...info.antonyms.map((w) => `${w}(対義語)`)];
    if (refWords.length > 0 && !el.fieldNotes.value.includes("辞書取得の下書き")) {
      const line = `類義語・対義語（辞書取得の下書き）: ${refWords.join(", ")}`;
      el.fieldNotes.value = el.fieldNotes.value ? `${el.fieldNotes.value}\n${line}` : line;
      updatePreview(el.fieldNotes, el.notesPreview);
      filledAnything = true;
    }

    if (filledAnything) {
      alert("辞書から下書きを取得しました。内容を確認して、必要に応じて手直ししてください。");
    } else {
      alert(`「${spelling}」は辞書に見つからなかったか、追加できる情報がありませんでした。`);
    }
  } finally {
    el.draftFromDictionaryBtn.disabled = false;
  }
}

// ---- リスト読み込み ----

async function loadLists() {
  state.lists = await api("/lists");
  el.listSelect.innerHTML = "";
  for (const list of state.lists) {
    const opt = document.createElement("option");
    opt.value = list.id;
    opt.textContent = list.name;
    el.listSelect.appendChild(opt);
  }
  if (state.lists.length > 0) {
    state.currentListId = state.lists[0].id;
    el.listSelect.value = state.currentListId;
    await selectList(state.currentListId);
  } else {
    state.currentListId = null;
    el.listTitle.textContent = "リストがありません。「＋ 新規リスト」から作成してください";
    el.newWordBtn.disabled = true;
    el.copyRangeBtn.disabled = true;
    el.importByTagBtn.disabled = true;
  }
}

async function selectList(listId) {
  state.currentListId = listId;
  const list = state.lists.find((l) => l.id === listId);
  el.listTitle.textContent = list ? list.name : "";
  el.newWordBtn.disabled = !listId;
  el.copyRangeBtn.disabled = !listId;
  el.importByTagBtn.disabled = !listId;
  closeEditor();
  await Promise.all([loadWordsForList(listId), loadSectionsForList(listId)]);
}

async function loadWordsForList(listId) {
  state.words = await api(`/lists/${encodeURIComponent(listId)}/words`);
  state.listWordIndex = new Map(state.words.map((w) => [w.spelling.toLowerCase(), { id: w.id, no: w.displayNo }]));
  renderWordTable();
}

async function loadSectionsForList(listId) {
  state.sections = await api(`/lists/${encodeURIComponent(listId)}/sections`);
  renderSectionOptions();
}

function renderSectionOptions() {
  const current = el.fieldSection.value;
  el.fieldSection.innerHTML = '<option value="">なし</option>';
  for (const s of state.sections) {
    const opt = document.createElement("option");
    opt.value = String(s.id);
    opt.textContent = s.name;
    el.fieldSection.appendChild(opt);
  }
  const newOpt = document.createElement("option");
  newOpt.value = NEW_SECTION_VALUE;
  newOpt.textContent = "＋ 新規セクション...";
  el.fieldSection.appendChild(newOpt);
  if ([...el.fieldSection.options].some((o) => o.value === current)) el.fieldSection.value = current;
}

async function handleSectionSelectChange() {
  if (el.fieldSection.value !== NEW_SECTION_VALUE) return;
  const name = prompt("新規セクション名を入力してください（例: Section 1）");
  if (!name) {
    el.fieldSection.value = "";
    return;
  }
  try {
    const section = await api(`/lists/${encodeURIComponent(state.currentListId)}/sections`, {
      method: "POST",
      body: JSON.stringify({ name }),
    });
    await loadSectionsForList(state.currentListId);
    el.fieldSection.value = String(section.id);
  } catch (err) {
    alert(`セクション作成に失敗しました: ${err.message}`);
    el.fieldSection.value = "";
  }
}

function renderWordTable() {
  el.wordTableBody.innerHTML = "";
  el.wordTableEmpty.hidden = state.words.length > 0;
  let lastSectionId = undefined;
  for (const w of state.words) {
    if (w.sectionId !== lastSectionId) {
      lastSectionId = w.sectionId;
      const sectionTr = document.createElement("tr");
      sectionTr.className = "section-header-row";
      sectionTr.innerHTML = `<td colspan="4">${escapeHtml(w.sectionName || "（セクションなし）")}</td>`;
      el.wordTableBody.appendChild(sectionTr);
    }
    const tr = document.createElement("tr");
    tr.dataset.wordId = w.id;
    if (w.branch) tr.classList.add("branch-row");
    if (state.currentWord && state.currentWord.id === w.id) tr.classList.add("selected");
    tr.innerHTML = `<td class="col-no">${escapeHtml(w.displayNo)}</td><td>${escapeHtml(w.spelling)}</td><td>${escapeHtml(w.pronunciation || "")}</td><td></td>`;
    tr.addEventListener("click", () => openWordEditor(w.id));
    el.wordTableBody.appendChild(tr);
  }
}

function escapeHtml(s) {
  return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

// ---- 編集フォーム ----

function clearRepeatList(container) {
  container.innerHTML = "";
}

function addRow(kind, data = {}) {
  const container = document.getElementById(`${kind}List`);
  const tpl = templates[kind];
  const node = tpl.content.firstElementChild.cloneNode(true);
  if (kind === "senses") {
    node.querySelector(".pos").value = data.pos || "";
    node.querySelector(".meaning").value = data.meaning || "";
    node.querySelector(".pronunciation").value = data.pronunciation || "";
  } else if (kind === "derivatives") {
    node.querySelector(".pos").value = data.pos || "";
    node.querySelector(".word").value = data.word || "";
    node.querySelector(".meaning").value = data.meaning || "";
  } else if (kind === "examples") {
    node.querySelector(".sentence").value = data.sentence || "";
    node.querySelector(".answer").value = data.answer || "";
    node.querySelector(".translation").value = data.translation || "";
  }
  node.querySelector(".remove-row-btn").addEventListener("click", () => node.remove());
  container.appendChild(node);
}

function collectRows(kind) {
  const container = document.getElementById(`${kind}List`);
  const rows = [...container.querySelectorAll(".repeat-row")];
  if (kind === "senses") {
    return rows
      .map((r) => ({
        pos: r.querySelector(".pos").value.trim(),
        meaning: r.querySelector(".meaning").value.trim(),
        pronunciation: r.querySelector(".pronunciation").value.trim() || null,
      }))
      .filter((r) => r.meaning);
  }
  if (kind === "derivatives") {
    return rows
      .map((r) => ({
        pos: r.querySelector(".pos").value.trim(),
        word: r.querySelector(".word").value.trim(),
        meaning: r.querySelector(".meaning").value.trim() || null,
      }))
      .filter((r) => r.word);
  }
  if (kind === "examples") {
    return rows
      .map((r) => ({
        sentence: r.querySelector(".sentence").value.trim(),
        answer: r.querySelector(".answer").value.trim(),
        translation: r.querySelector(".translation").value.trim(),
      }))
      .filter((r) => r.sentence);
  }
  return [];
}

function openNewWordForm() {
  state.currentWord = null;
  state.isNew = true;
  el.editTitle.textContent = "単語を追加";
  el.deleteBtn.hidden = true;
  el.fieldNo.value = nextSuggestedNo();
  el.fieldSpelling.value = "";
  el.fieldPronunciation.value = "";
  state.currentAudioUrl = null;
  updatePlayAudioButton();
  el.fieldDerivedFrom.value = "";
  el.fieldSection.value = "";
  clearRepeatList(el.sensesList);
  clearRepeatList(el.derivativesList);
  clearRepeatList(el.examplesList);
  addRow("senses");
  addRow("derivatives");
  addRow("examples");
  el.fieldEtymology.value = "";
  el.fieldNotes.value = "";
  el.tagOxford5000.checked = false;
  el.tagAwl.checked = false;
  el.tagEiken.value = "";
  el.tagCustom.value = "";
  updatePreview(el.fieldEtymology, el.etymologyPreview);
  updatePreview(el.fieldNotes, el.notesPreview);
  el.editPane.hidden = false;
  renderWordTable();
}

function nextSuggestedNo() {
  const max = state.words.reduce((m, w) => Math.max(m, w.no), 0);
  return max + 1;
}

async function openWordEditor(wordId) {
  const detail = await api(`/words/${encodeURIComponent(wordId)}`);
  state.currentWord = detail;
  state.isNew = false;
  el.editTitle.textContent = `単語を編集: ${detail.spelling}`;
  el.deleteBtn.hidden = false;

  const membership = detail.lists.find((l) => l.listId === state.currentListId);
  el.fieldNo.value = membership ? membership.displayNo : "";
  el.fieldSpelling.value = detail.spelling;
  el.fieldPronunciation.value = detail.pronunciation || "";
  state.currentAudioUrl = detail.audioUrl || null;
  updatePlayAudioButton();
  el.fieldDerivedFrom.value = detail.derivedFrom ? detail.derivedFrom.spelling : "";
  el.fieldSection.value = membership && membership.sectionId != null ? String(membership.sectionId) : "";

  clearRepeatList(el.sensesList);
  (detail.senses.length ? detail.senses : [{}]).forEach((s) => addRow("senses", s));
  clearRepeatList(el.derivativesList);
  (detail.derivatives.length ? detail.derivatives : [{}]).forEach((d) => addRow("derivatives", d));
  clearRepeatList(el.examplesList);
  (detail.examples.length ? detail.examples : [{}]).forEach((ex) => addRow("examples", ex));

  el.fieldEtymology.value = detail.etymology || "";
  el.fieldNotes.value = detail.notes || "";
  el.tagOxford5000.checked = "oxford5000" in detail.tags;
  el.tagAwl.checked = "awl" in detail.tags;
  el.tagEiken.value = detail.tags.eiken || "";
  el.tagCustom.value = Object.entries(detail.tags)
    .filter(([k]) => k.startsWith("custom:"))
    .map(([k]) => k.slice("custom:".length))
    .join(", ");

  updatePreview(el.fieldEtymology, el.etymologyPreview);
  updatePreview(el.fieldNotes, el.notesPreview);
  el.editPane.hidden = false;
  renderWordTable();
}

function closeEditor() {
  state.currentWord = null;
  el.editPane.hidden = true;
  renderWordTable();
}

function collectTags() {
  const tags = {};
  if (el.tagOxford5000.checked) tags.oxford5000 = true;
  if (el.tagAwl.checked) tags.awl = true;
  if (el.tagEiken.value) tags.eiken = el.tagEiken.value;
  for (const raw of el.tagCustom.value.split(",")) {
    const v = raw.trim();
    if (v) tags[`custom:${v}`] = true;
  }
  return tags;
}

async function saveWord() {
  if (!el.fieldSpelling.value.trim()) {
    alert("スペルを入力してください");
    return;
  }
  const sectionId = el.fieldSection.value && el.fieldSection.value !== NEW_SECTION_VALUE ? Number(el.fieldSection.value) : null;
  const body = {
    spelling: el.fieldSpelling.value.trim(),
    pronunciation: el.fieldPronunciation.value.trim() || null,
    audioUrl: state.currentAudioUrl || null,
    derivedFrom: el.fieldDerivedFrom.value.trim() || "",
    senses: collectRows("senses"),
    derivatives: collectRows("derivatives"),
    examples: collectRows("examples"),
    etymology: el.fieldEtymology.value.trim() || null,
    notes: el.fieldNotes.value.trim() || null,
    tags: collectTags(),
  };

  try {
    let word;
    if (state.isNew) {
      body.listId = state.currentListId;
      body.no = el.fieldNo.value.trim() || null;
      body.sectionId = sectionId;
      word = await api("/words", { method: "POST", body: JSON.stringify(body) });
    } else {
      word = await api(`/words/${encodeURIComponent(state.currentWord.id)}`, { method: "PUT", body: JSON.stringify(body) });
      if (el.fieldNo.value.trim()) {
        await api(`/lists/${encodeURIComponent(state.currentListId)}/items/${encodeURIComponent(word.id)}`, {
          method: "PUT",
          body: JSON.stringify({ no: el.fieldNo.value.trim(), sectionId }),
        });
      }
    }
    await loadWordsForList(state.currentListId);
    await openWordEditor(word.id);
  } catch (err) {
    alert(`保存に失敗しました: ${err.message}`);
  }
}

async function deleteCurrentWord() {
  if (!state.currentWord) return;
  if (!confirm(`「${state.currentWord.spelling}」を削除しますか？（全リストから削除されます）`)) return;
  try {
    await api(`/words/${encodeURIComponent(state.currentWord.id)}`, { method: "DELETE" });
    closeEditor();
    await loadWordsForList(state.currentListId);
  } catch (err) {
    alert(`削除に失敗しました: ${err.message}`);
  }
}

async function createNewList() {
  const name = prompt("新規リスト名を入力してください（例: 英検2級オリジナル）");
  if (!name) return;
  try {
    const { id } = await api("/lists", { method: "POST", body: JSON.stringify({ name }) });
    await loadLists();
    el.listSelect.value = id;
    await selectList(id);
  } catch (err) {
    alert(`リスト作成に失敗しました: ${err.message}`);
  }
}

// ---- 単語帳の作成方法: 範囲コピー / タグ一括追加 ----

async function copyRangeFromAnotherList() {
  const others = state.lists.filter((l) => l.id !== state.currentListId);
  if (others.length === 0) {
    alert("コピー元にできる他のリストがありません。");
    return;
  }
  const listing = others.map((l) => `${l.id}  (${l.name})`).join("\n");
  const sourceListId = prompt(`コピー元のリストIDを入力してください:\n${listing}`);
  if (!sourceListId) return;
  if (!others.some((l) => l.id === sourceListId)) {
    alert("そのリストIDは見つかりませんでした。");
    return;
  }
  const fromNo = prompt("開始番号（コピー元リスト内のno.）");
  if (!fromNo) return;
  const toNo = prompt("終了番号（コピー元リスト内のno.）");
  if (!toNo) return;

  try {
    const result = await api(`/lists/${encodeURIComponent(state.currentListId)}/copy-range`, {
      method: "POST",
      body: JSON.stringify({ sourceListId, fromNo: Number(fromNo), toNo: Number(toNo) }),
    });
    alert(`追加: ${result.added}件 / 既に存在してスキップ: ${result.skipped}件`);
    await loadWordsForList(state.currentListId);
  } catch (err) {
    alert(`範囲コピーに失敗しました: ${err.message}`);
  }
}

async function importByTagPrompt() {
  let tags;
  try {
    tags = await api("/tags");
  } catch (err) {
    alert(`タグ一覧の取得に失敗しました: ${err.message}`);
    return;
  }
  if (tags.length === 0) {
    alert("登録されているタグがありません。");
    return;
  }
  const listing = tags.map((t) => (t.tagValue ? `${t.tagKey}:${t.tagValue}` : t.tagKey)).join("\n");
  const input = prompt(`一括追加したいタグを入力してください（一覧からコピペしてください）:\n${listing}`);
  if (!input) return;
  const [tagKey, tagValue] = input.includes(":") ? input.split(/:(.+)/) : [input, undefined];

  try {
    const result = await api(`/lists/${encodeURIComponent(state.currentListId)}/import-by-tag`, {
      method: "POST",
      body: JSON.stringify({ tagKey: tagKey.trim(), tagValue: tagValue ? tagValue.trim() : undefined }),
    });
    alert(`追加: ${result.added}件 / 既に存在してスキップ: ${result.skipped}件`);
    await loadWordsForList(state.currentListId);
  } catch (err) {
    alert(`タグからの一括追加に失敗しました: ${err.message}`);
  }
}

async function importAwl() {
  if (!confirm("AWL(Academic Word List)の全570見出し語をマスター単語に取り込み、awlタグ(sublist番号)を付与します。\n既存の単語は内容を上書きせず、タグが未設定の場合のみ追加します。実行しますか？")) {
    return;
  }
  el.importAwlBtn.disabled = true;
  const originalLabel = el.importAwlBtn.textContent;
  el.importAwlBtn.textContent = "取り込み中...";
  try {
    const result = await api("/import-awl", { method: "POST" });
    alert(
      `AWL取り込み完了\n新規作成: ${result.created}件\nタグ追加: ${result.tagged}件\n変更なし(既にタグ済み): ${result.alreadyTagged}件\n\n各リストへは「タグから一括追加」で awl:1〜awl:10 を指定して取り込めます。`
    );
    if (state.currentListId) await loadWordsForList(state.currentListId);
  } catch (err) {
    alert(`AWL取り込みに失敗しました: ${err.message}`);
  } finally {
    el.importAwlBtn.disabled = false;
    el.importAwlBtn.textContent = originalLabel;
  }
}

async function importOxford5000() {
  if (!confirm("Oxford 5000の全4953見出し語をマスター単語に取り込み、oxford5000タグ(CEFRレベル)を付与します。\n既存の単語は内容を上書きせず、タグが未設定の場合のみ追加します。実行しますか？")) {
    return;
  }
  el.importOxford5000Btn.disabled = true;
  const originalLabel = el.importOxford5000Btn.textContent;
  el.importOxford5000Btn.textContent = "取り込み中...";
  try {
    const result = await api("/import-oxford5000", { method: "POST" });
    alert(
      `Oxford 5000取り込み完了\n新規作成: ${result.created}件\nタグ追加: ${result.tagged}件\n変更なし(既にタグ済み): ${result.alreadyTagged}件\n\n各リストへは「タグから一括追加」で oxford5000:A1〜oxford5000:C1 を指定して取り込めます。`
    );
    if (state.currentListId) await loadWordsForList(state.currentListId);
  } catch (err) {
    alert(`Oxford 5000取り込みに失敗しました: ${err.message}`);
  } finally {
    el.importOxford5000Btn.disabled = false;
    el.importOxford5000Btn.textContent = originalLabel;
  }
}

// ---- イベント登録 ----

el.listSelect.addEventListener("change", (e) => selectList(e.target.value));
el.newListBtn.addEventListener("click", createNewList);
el.newWordBtn.addEventListener("click", openNewWordForm);
el.copyRangeBtn.addEventListener("click", copyRangeFromAnotherList);
el.importByTagBtn.addEventListener("click", importByTagPrompt);
el.importAwlBtn.addEventListener("click", importAwl);
el.importOxford5000Btn.addEventListener("click", importOxford5000);
el.saveBtn.addEventListener("click", saveWord);
el.deleteBtn.addEventListener("click", deleteCurrentWord);
el.closeBtn.addEventListener("click", closeEditor);
el.fieldSection.addEventListener("change", handleSectionSelectChange);
el.fieldSpelling.addEventListener("blur", autoFillPronunciationOnBlur);
el.fieldSpelling.addEventListener("keydown", (e) => {
  if (e.key !== "Enter") return;
  e.preventDefault(); // フォーム内でEnterによる意図しない送信/リロードを防ぐ
  autoFillPronunciationOnBlur();
});
el.lookupPronunciationBtn.addEventListener("click", lookupPronunciationManually);
el.playAudioBtn.addEventListener("click", playCurrentAudio);
el.draftFromDictionaryBtn.addEventListener("click", draftFromDictionary);
el.fieldEtymology.addEventListener("input", () => updatePreview(el.fieldEtymology, el.etymologyPreview));
el.fieldNotes.addEventListener("input", () => updatePreview(el.fieldNotes, el.notesPreview));

document.querySelectorAll(".add-row-btn").forEach((btn) => {
  btn.addEventListener("click", () => addRow(btn.dataset.add));
});

loadLists().catch((err) => {
  console.error(err);
  el.listTitle.textContent = `読み込みエラー: ${err.message}`;
});
