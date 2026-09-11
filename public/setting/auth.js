import { EDITOR_API_BASE } from "../shared/config.js";

const ACCESS_TOKEN_KEY = "vocab-setting-oauth-token";
const PKCE_KEY = "vocab-setting-oauth-pkce";
const CLIENT_KEY = "vocab-setting-oauth-client";

function base64Url(bytes) {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/, "");
}

function randomToken(byteLength = 32) {
  const bytes = new Uint8Array(byteLength);
  crypto.getRandomValues(bytes);
  return base64Url(bytes);
}

async function pkceChallenge(verifier) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(verifier));
  return base64Url(new Uint8Array(digest));
}

function redirectUri() {
  return location.origin + location.pathname;
}

function oauthOrigin() {
  return new URL(EDITOR_API_BASE, location.origin).origin;
}

function readStoredJson(storage, key) {
  try {
    return JSON.parse(storage.getItem(key) || "null");
  } catch {
    storage.removeItem(key);
    return null;
  }
}

function clearAccessToken() {
  localStorage.removeItem(ACCESS_TOKEN_KEY);
  sessionStorage.removeItem(ACCESS_TOKEN_KEY);
}

function storedAccessToken() {
  // Migrate a still-valid login from the former tab-only storage.
  for (const storage of [localStorage, sessionStorage]) {
    const record = readStoredJson(storage, ACCESS_TOKEN_KEY);
    const expiresAt = Number(record?.expiresAt);
    if (typeof record?.accessToken !== "string" || !record.accessToken ||
        !Number.isFinite(expiresAt) || expiresAt <= Date.now()) {
      storage.removeItem(ACCESS_TOKEN_KEY);
      continue;
    }
    if (storage === sessionStorage) {
      localStorage.setItem(ACCESS_TOKEN_KEY, JSON.stringify(record));
    }
    sessionStorage.removeItem(ACCESS_TOKEN_KEY);
    return record.accessToken;
  }
  return null;
}

async function registerClient() {
  const callback = redirectUri();
  const existing = readStoredJson(localStorage, CLIENT_KEY);
  if (existing?.clientId && existing.redirectUri === callback) return existing.clientId;

  const response = await fetch(oauthOrigin() + "/oauth/register", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      redirect_uris: [callback],
      token_endpoint_auth_method: "none",
    }),
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok || !body.client_id) {
    throw new Error(body.error_description || body.error || "認証クライアントを登録できませんでした");
  }
  localStorage.setItem(
    CLIENT_KEY,
    JSON.stringify({ clientId: body.client_id, redirectUri: callback })
  );
  return body.client_id;
}

async function beginAuthorization() {
  const clientId = await registerClient();
  const verifier = randomToken(48);
  const state = randomToken(24);
  sessionStorage.setItem(PKCE_KEY, JSON.stringify({ verifier, state, clientId }));

  const params = new URLSearchParams({
    response_type: "code",
    client_id: clientId,
    redirect_uri: redirectUri(),
    code_challenge: await pkceChallenge(verifier),
    code_challenge_method: "S256",
    scope: "vocab:read vocab:write",
    state,
  });
  location.assign(oauthOrigin() + "/oauth/authorize?" + params);
  return new Promise(() => {});
}

async function exchangeCallback(code, state) {
  const pending = readStoredJson(sessionStorage, PKCE_KEY);
  if (!pending?.verifier || !pending.clientId || !state || state !== pending.state) {
    throw new Error("認証状態を確認できません。編集ページを開き直してください");
  }

  const body = new URLSearchParams({
    grant_type: "authorization_code",
    code,
    client_id: pending.clientId,
    redirect_uri: redirectUri(),
    code_verifier: pending.verifier,
  });
  const response = await fetch(oauthOrigin() + "/oauth/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body,
  });
  const token = await response.json().catch(() => ({}));
  if (!response.ok || !token.access_token) {
    throw new Error(token.error_description || token.error || "認証トークンを取得できませんでした");
  }

  sessionStorage.removeItem(PKCE_KEY);
  localStorage.setItem(
    ACCESS_TOKEN_KEY,
    JSON.stringify({
      accessToken: token.access_token,
      expiresAt: Date.now() + Number(token.expires_in || 3600) * 1000,
    })
  );
  history.replaceState(null, "", redirectUri());
  return token.access_token;
}

async function accessToken() {
  if (!EDITOR_API_BASE) return null;

  const existing = storedAccessToken();
  if (existing) return existing;

  const params = new URLSearchParams(location.search);
  const oauthError = params.get("error");
  if (oauthError) {
    throw new Error(params.get("error_description") || oauthError);
  }
  const code = params.get("code");
  if (code) return exchangeCallback(code, params.get("state"));

  return beginAuthorization();
}

let pendingAccessToken = null;
function sharedAccessToken() {
  if (!pendingAccessToken) {
    pendingAccessToken = accessToken().finally(() => { pendingAccessToken = null; });
  }
  return pendingAccessToken;
}

export async function editorFetch(input, init = {}) {
  if (!EDITOR_API_BASE) return fetch(input, init);

  const token = await sharedAccessToken();
  const headers = new Headers(init.headers || {});
  headers.set("Authorization", "Bearer " + token);
  const response = await fetch(input, { ...init, headers });

  if (response.status === 401) {
    // A late response for an older token must not erase a newer login.
    if (storedAccessToken() === token) clearAccessToken();
    return editorFetch(input, init);
  }
  return response;
}
