// 閲覧型編集ページのAPI呼び出し。読み出しは公開待ちの間だけ再試行し、書き込みは決して再送しない。
import { EDITOR_API_BASE } from "../../shared/config.js";
import { editorFetch } from "../auth.js";

export const PENDING_KEY = "vocab-editor-pending-publication";
const listeners = new Set();
let publicationTimer = null;
let publicationStartedAt = 0;

export function onPublication(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
function emit(status) { for (const listener of listeners) listener(status); }

function pendingMarker() {
  try { return localStorage.getItem(PENDING_KEY); } catch { return null; }
}
function setPendingMarker() {
  try { localStorage.setItem(PENDING_KEY, crypto.randomUUID()); } catch {}
}
function clearPendingMarker(marker) {
  try { if (localStorage.getItem(PENDING_KEY) === marker) localStorage.removeItem(PENDING_KEY); } catch {}
}

export class ApiError extends Error {
  constructor(message, { status, code } = {}) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

// 読み出しは時間を区切る。公開処理が混んでいると「最新」の確認が返ってこないことがあるため。
const FRESH_TIMEOUT = 4000;
const READ_TIMEOUT = 20000;
const NEW_WORD_LOOKUP_TIMEOUT = 4000;
async function request(path, options, timeout = 0) {
  const controller = timeout ? new AbortController() : null;
  const timer = timeout ? setTimeout(() => controller.abort(), timeout) : null;
  try {
    const response = await editorFetch(`${EDITOR_API_BASE}/api${path}`, {
      ...options,
      ...(controller ? { signal: controller.signal } : {}),
      headers: { "content-type": "application/json", ...(options.headers || {}) },
      cache: "no-store",
    });
    // 本文の読み込み中の打ち切りは、成功（null）にせず打ち切りとして扱う。
    const data = response.status === 204 ? null : await response.json().catch(error => {
      if (controller?.signal.aborted) throw error;
      return null;
    });
    return { response, data };
  } catch (error) {
    if (controller?.signal.aborted) throw Object.assign(new Error("通信に時間がかかっています"), { timeout: true });
    throw error;
  } finally { clearTimeout(timer); }
}

// Pronunciation is optional at creation. A dictionary lookup is not a snapshot
// read, and neither a slow lookup nor the editor publication queue should gate the write.
export async function lookupNewWordPronunciation(spelling) {
  const controller = new AbortController();
  let timer;
  const deadline = new Promise(resolve => {
    timer = setTimeout(() => {
      controller.abort();
      resolve(null);
    }, NEW_WORD_LOOKUP_TIMEOUT);
  });
  try {
    return await Promise.race([
      request(`/lookup?spelling=${encodeURIComponent(spelling)}`, { method: "GET", signal: controller.signal })
        .then(({ response, data }) => response.ok && typeof data?.pronunciation === "string" ? data.pronunciation : null, () => null),
      deadline,
    ]);
  } finally { clearTimeout(timer); }
}

// fresh: 公開待ちの変更を含む最新の内容を求める。公開待ちのときは公開済みの内容へ戻す（fallback）。
export async function api(path, { method = "GET", body, fresh = false, writeTimeout = 0 } = {}) {
  const read = method === "GET";
  if (!read) {
    const { response, data } = await request(path, { method, body: body == null ? undefined : JSON.stringify(body) }, writeTimeout);
    if (!response.ok) throw new ApiError(data?.error || `HTTP ${response.status}`, { status: response.status, code: data?.code });
    if (response.headers.get("x-editor-snapshots") === "r2") {
      setPendingMarker();
      watchPublication();
    }
    return data;
  }
  const wantFresh = fresh || !!pendingMarker();
  for (let attempt = 0; ; attempt += 1) {
    const freshAttempt = wantFresh && attempt === 0;
    const target = freshAttempt ? `${path}${path.includes("?") ? "&" : "?"}editorFresh=1` : path;
    let result;
    try { result = await request(target, { method }, freshAttempt ? FRESH_TIMEOUT : READ_TIMEOUT); }
    catch (error) {
      // 最新の確認が返ってこなければ、公開済みの内容で続ける。
      if (freshAttempt && error.timeout) continue;
      if (error.timeout) throw new ApiError("通信に時間がかかっています。少し待ってから再読み込みしてください。", { code: "timeout" });
      throw error;
    }
    const { response, data } = result;
    if (response.ok) return data;
    if (data?.code === "editor_snapshot_pending" && attempt < 60) {
      // 1回目（最新を求めた読み出し）が公開待ちなら、公開済みの内容をすぐ読む。
      if (attempt > 0) await new Promise(resolve => setTimeout(resolve, 1000));
      continue;
    }
    throw new ApiError(data?.error || `HTTP ${response.status}`, { status: response.status, code: data?.code });
  }
}

// A write may have committed even when its response was lost. Verify via a
// bounded detail read; never replay the write during recovery.
export async function verifyWordSave(path, matches) {
  const { response, data } = await request(path, { method: "GET" }, 8000);
  if (!response.ok || !data || !matches(data)) return null;
  if (response.headers.get("x-editor-snapshots") === "r2") {
    setPendingMarker();
    watchPublication();
  }
  return data;
}

// 閲覧ページへの反映を15秒ごとに確認する（読み出しのみ）。
export function watchPublication() {
  if (publicationTimer) return;
  publicationStartedAt = publicationStartedAt || Date.now();
  emit({ state: "publishing" });
  const check = async () => {
    publicationTimer = null;
    const marker = pendingMarker();
    if (!marker) { publicationStartedAt = 0; return; }
    try {
      const { response, data } = await request("/lists?editorFresh=1", { method: "GET" }, 10000);
      if (response.ok) {
        clearPendingMarker(marker);
        publicationStartedAt = 0;
        emit({ state: "published" });
        return;
      }
      if (data?.code !== "editor_snapshot_pending") throw new Error(data?.error || `HTTP ${response.status}`);
    } catch (error) {
      if (Date.now() - publicationStartedAt > 10 * 60 * 1000) {
        publicationStartedAt = 0;
        emit({ state: "failed", message: error.message });
        return;
      }
    }
    if (Date.now() - publicationStartedAt > 10 * 60 * 1000) {
      publicationStartedAt = 0;
      emit({ state: "failed", message: "10分以上反映されていません" });
      return;
    }
    publicationTimer = setTimeout(check, 15000);
  };
  publicationTimer = setTimeout(check, 8000);
}

export function resumePublicationWatch() {
  if (pendingMarker()) watchPublication();
}
