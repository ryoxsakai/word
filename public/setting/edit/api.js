// 閲覧型編集ページのAPI呼び出し。読み出しは公開待ちの間だけ再試行し、書き込みは決して再送しない。
import { EDITOR_API_BASE } from "../../shared/config.js";
import { editorFetch } from "../auth.js";

export const PENDING_KEY = "vocab-editor-pending-publication";
const listeners = new Set();
let publicationTimer = null;

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
  try {
    if (localStorage.getItem(PENDING_KEY) !== marker) return false;
    localStorage.removeItem(PENDING_KEY);
    return true;
  } catch { return false; }
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

// Keep the original write alive while checking a slow or lost acknowledgement.
export async function saveExistingWord(path, id, body, matches, onCheck) {
  let settled = false;
  let timer;
  const check = async () => {
    let reason;
    for (const delay of [0, 1000, 2500]) {
      if (delay) await new Promise(resolve => setTimeout(resolve, delay));
      if (settled) return;
      try {
        const { response, data } = await request(path, { method: "GET" }, 6000);
        if (!response.ok) throw new ApiError(`登録内容を取得できません（HTTP ${response.status}）`, { status: response.status });
        if (!data || data.id !== id) throw new Error("登録内容を読み取れません");
        if (matches(data)) {
          if (!settled && response.headers.get("x-editor-snapshots") === "r2") {
            setPendingMarker();
            watchPublication();
          }
          return data;
        }
        reason = "登録内容と今回の変更が一致しません";
      } catch (error) {
        reason = error.status ? error.message : "登録内容を取得できません。通信状況を確認してください";
        if (error.status === 401 || error.status === 403) break;
      }
    }
    throw new Error(reason);
  };
  let verification;
  const verify = () => {
    if (!verification) {
      onCheck();
      verification = check();
    }
    return verification;
  };
  const write = api(path, { method: "PUT", body, writeTimeout: 30000 }).then(data => {
    if (data?.id !== id) throw new Error("保存応答を読み取れません");
    return data;
  });
  try {
    // A failed early read cannot overrule a later successful write response.
    const earlyRead = new Promise(resolve => {
      timer = setTimeout(() => verify().then(resolve, () => { verification = null; }), 6500);
    });
    try { return await Promise.race([write, earlyRead]); }
    catch (error) {
      if (error.status && error.status < 500) throw error;
      try { return await verify(); }
      catch (readError) {
        const status = error.status ? `（保存時 HTTP ${error.status}）` : "";
        throw Object.assign(new Error(`${readError.message}${status}。この画面に下書きを保持しています。`), { unconfirmed: true });
      }
    }
  } finally {
    settled = true;
    clearTimeout(timer);
  }
}

// 閲覧ページへの反映を15秒ごとに確認する（読み出しのみ）。
export function watchPublication() {
  // The timer also reserves the polling slot while its request is in flight.
  if (publicationTimer !== null) return;
  let marker = pendingMarker();
  let startedAt = Date.now();
  const updateMarker = current => {
    if (current !== marker) {
      marker = current;
      startedAt = Date.now();
    }
  };
  const stopIdle = () => {
    publicationTimer = null;
    emit({ state: "idle" });
  };
  const check = async () => {
    updateMarker(pendingMarker());
    if (!marker) { stopIdle(); return; }
    let published = false;
    let failure = "10分以上反映されていません";
    try {
      const { response, data } = await request("/lists?editorFresh=1", { method: "GET" }, 10000);
      published = response.ok;
      if (!published && data?.code !== "editor_snapshot_pending") failure = data?.error || `HTTP ${response.status}`;
    } catch (error) {
      failure = error.message;
    }
    // A save or another tab may have changed the marker while this request waited.
    let current = pendingMarker();
    if (current === marker && published) {
      const cleared = clearPendingMarker(marker);
      current = pendingMarker();
      if (cleared && !current) {
        publicationTimer = null;
        emit({ state: "published" });
        return;
      }
      failure = "反映状況を端末に保存できません";
    }
    if (!current) { stopIdle(); return; }
    if (current !== marker) {
      updateMarker(current);
    } else if (Date.now() - startedAt > 10 * 60 * 1000) {
      publicationTimer = null;
      emit({ state: "failed", message: failure });
      return;
    }
    publicationTimer = setTimeout(check, 15000);
  };
  publicationTimer = setTimeout(check, 8000);
  emit({ state: "publishing" });
}

export function resumePublicationWatch() {
  if (pendingMarker()) watchPublication();
}
