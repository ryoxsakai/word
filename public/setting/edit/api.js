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

async function request(path, options) {
  const response = await editorFetch(`${EDITOR_API_BASE}/api${path}`, {
    ...options,
    headers: { "content-type": "application/json", ...(options.headers || {}) },
    cache: "no-store",
  });
  const data = response.status === 204 ? null : await response.json().catch(() => null);
  return { response, data };
}

// fresh: 公開待ちの変更を含む最新の内容を求める。公開待ちのときは公開済みの内容へ戻す（fallback）。
export async function api(path, { method = "GET", body, fresh = false } = {}) {
  const read = method === "GET";
  if (!read) {
    const { response, data } = await request(path, { method, body: body == null ? undefined : JSON.stringify(body) });
    if (!response.ok) throw new ApiError(data?.error || `HTTP ${response.status}`, { status: response.status, code: data?.code });
    if (response.headers.get("x-editor-snapshots") === "r2") {
      setPendingMarker();
      watchPublication();
    }
    return data;
  }
  const wantFresh = fresh || !!pendingMarker();
  for (let attempt = 0; ; attempt += 1) {
    const target = wantFresh && attempt === 0 ? `${path}${path.includes("?") ? "&" : "?"}editorFresh=1` : path;
    const { response, data } = await request(target, { method });
    if (response.ok) return data;
    if (data?.code === "editor_snapshot_pending" && attempt < 60) {
      // 1回目（最新を求めた読み出し）が公開待ちなら、公開済みの内容をすぐ読む。
      if (attempt > 0) await new Promise(resolve => setTimeout(resolve, 1000));
      continue;
    }
    throw new ApiError(data?.error || `HTTP ${response.status}`, { status: response.status, code: data?.code });
  }
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
      const { response, data } = await request("/lists?editorFresh=1", { method: "GET" });
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
