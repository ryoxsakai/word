// 閲覧ページと同じ公開API・端末キャッシュ（IndexedDB）でSectionの表示データを読む。
// キャッシュがあればすぐ返し、裏で最新を読み直す（変わっていればonFreshで知らせる）。
// 保存は常に最新のDBを読み直してから行うので、表示が少し古くても上書き事故にはならない。
import { VIEWER_API_BASE } from "../../shared/config.js";
import { createChapterStore } from "../../viewer/chapter-cache.js";
import { api, onPublication, PENDING_KEY } from "./api.js";

const VIEWER_API = `${VIEWER_API_BASE}/api`;
const MAX_AGE = 7 * 24 * 60 * 60 * 1000;
const RECENT_KEY = "vocab-edit-recent-saves";
const RECENT_MAX_AGE = 24 * 60 * 60 * 1000;
const store = createChapterStore();

async function fetchPublic(path) {
  const response = await fetch(`${VIEWER_API}${path}`, { cache: "no-cache" });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return response.json();
}

// kind: "word"（wordsを持つ） | "idiom"（entriesを持つ）
export async function loadSectionData({ publicPath, editorPath, kind, onFresh }) {
  const key = `${VIEWER_API}${publicPath}`; // 閲覧ページのキャッシュと同じキー
  const valid = snapshot => snapshot?.version === 1 && Number.isFinite(snapshot.savedAt) &&
    Date.now() - snapshot.savedAt <= MAX_AGE && Array.isArray(snapshot.data?.[kind === "word" ? "words" : "entries"]);
  const fetchFresh = async () => {
    let data;
    try { data = await fetchPublic(publicPath); }
    catch { return api(editorPath); } // 編集用の応答は、閲覧側と共有するキャッシュには入れない。
    // 表示はネットワーク応答が届いた時点で進める。任意の端末キャッシュへの書き込み完了は待たない。
    void store.put(key, { version: 1, savedAt: Date.now(), data }).catch(() => {});
    return data;
  };
  let saved = null;
  try { saved = await store.get(key); } catch {}
  if (valid(saved)) {
    fetchFresh().then(data => {
      if (JSON.stringify(data) !== JSON.stringify(saved.data)) onFresh?.(data);
    }).catch(() => {});
    return saved.data;
  }
  return fetchFresh();
}

// ---- 保存直後の内容（閲覧ページへの反映が終わるまで、キャッシュより優先して表示する） ----
function readRecent() {
  try {
    const parsed = JSON.parse(localStorage.getItem(RECENT_KEY) || "{}");
    const now = Date.now();
    return Object.fromEntries(Object.entries(parsed).filter(([, value]) => value && now - value.savedAt < RECENT_MAX_AGE));
  } catch { return {}; }
}
function writeRecent(value) {
  try { localStorage.setItem(RECENT_KEY, JSON.stringify(value)); } catch {}
}
export function rememberSaved(kind, id, raw) {
  const recent = readRecent();
  recent[`${kind}:${id}`] = { savedAt: Date.now(), raw };
  writeRecent(recent);
}
export function recentSaved(kind, id) {
  return readRecent()[`${kind}:${id}`]?.raw || null;
}
// 閲覧ページに反映されたら不要になる。
onPublication(status => { if (status.state === "published") writeRecent({}); });
try { if (!localStorage.getItem(PENDING_KEY)) writeRecent({}); } catch {}
