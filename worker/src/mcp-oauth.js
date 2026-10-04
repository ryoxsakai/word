import { createRefreshGrant, rotateRefreshGrant, readRefreshFamily, validRefreshFamily, revokeRefreshGrant } from "./oauth-refresh.js";
import {
  rememberedSession, createBrowserForm, consumeBrowserForm, sameOriginFormPost,
  rememberBrowser, revokeRememberedSession, clearRememberedCookie,
} from "./oauth-browser-session.js";

const AUTH_PAGE_STYLE = "body{font-family:system-ui,-apple-system,sans-serif;background:#f6f7fb;color:#172033;margin:0;padding:32px 16px}.card{max-width:480px;margin:8vh auto;background:#fff;border:1px solid #dfe3ea;border-radius:16px;padding:28px;box-shadow:0 12px 36px #17203314}h1{font-size:1.45rem;margin:0 0 12px}p{line-height:1.65;color:#4a5568}.error{color:#b42318;background:#fef3f2;padding:10px 12px;border-radius:8px}label{display:block;font-weight:650;margin:22px 0 8px}input[type=password]{box-sizing:border-box;width:100%;padding:12px;border:1px solid #aab2c0;border-radius:8px;font:inherit}button{width:100%;margin-top:18px;padding:12px;border:0;border-radius:8px;background:#2463eb;color:#fff;font:inherit;font-weight:700;cursor:pointer}.note{font-size:.88rem}.remember{display:flex;align-items:flex-start;gap:8px;font-size:.95rem;font-weight:500}.remember input{margin-top:4px;flex-shrink:0}.destination{overflow-wrap:anywhere}";

const TOKEN_AUDIENCE = "vocab-mcp";
const AUTH_CODE_TTL_SECONDS = 5 * 60;
const ACCESS_TOKEN_TTL_SECONDS = 12 * 60 * 60;
const EDITOR_TOKEN_TTL_SECONDS = 7 * 24 * 60 * 60;

function isEditorRedirect(uri) {
  try {
    const url = new URL(uri);
    return url.origin === "https://vocab.lrnr.jp" &&
      ["/setting/", "/setting/index.html", "/setting/idioms.html", "/setting/illustrations.html"].includes(url.pathname);
  } catch { return false; }
}

export const MCP_READ_SCOPE = "vocab:read";
export const MCP_WRITE_SCOPE = "vocab:write";
export const MCP_SUPPORTED_SCOPES = [MCP_READ_SCOPE, MCP_WRITE_SCOPE];
export const MCP_DEFAULT_SCOPE = MCP_SUPPORTED_SCOPES.join(" ");

export class McpOAuthError extends Error {
  constructor(code, description, status = 401) {
    super(description);
    this.name = "McpOAuthError";
    this.code = code;
    this.status = status;
  }
}

function json(data, status = 200, extraHeaders = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
      ...extraHeaders,
    },
  });
}

function html(document, status = 200, redirectOrigin = "") {
  const formActions = ["'self'", redirectOrigin].filter(Boolean).join(" ");
  return new Response(document, {
    status,
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "no-store",
      "Content-Security-Policy":
        "default-src 'none'; style-src 'unsafe-inline'; form-action " +
        formActions +
        "; base-uri 'none'; frame-ancestors 'none'",
      // no-referrer serializes Origin as null for navigation POSTs.
      "Referrer-Policy": "same-origin",
      "X-Content-Type-Options": "nosniff",
      "X-Frame-Options": "DENY",
    },
  });
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function bytesToBase64Url(bytes) {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/, "");
}

function base64UrlToBytes(value) {
  const normalized = String(value).replaceAll("-", "+").replaceAll("_", "/");
  const padded = normalized + "=".repeat((4 - (normalized.length % 4)) % 4);
  try {
    return Uint8Array.from(atob(padded), (character) => character.charCodeAt(0));
  } catch {
    throw new McpOAuthError("invalid_token", "The access token is malformed");
  }
}

function encodeJson(value) {
  return bytesToBase64Url(new TextEncoder().encode(JSON.stringify(value)));
}

function decodeJson(value) {
  try {
    return JSON.parse(new TextDecoder().decode(base64UrlToBytes(value)));
  } catch (error) {
    if (error instanceof McpOAuthError) throw error;
    throw new McpOAuthError("invalid_token", "The access token is malformed");
  }
}

function randomToken(byteLength = 32) {
  const bytes = new Uint8Array(byteLength);
  crypto.getRandomValues(bytes);
  return bytesToBase64Url(bytes);
}

async function sha256(value) {
  return new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(String(value))));
}

async function safeEqual(left, right) {
  const [leftHash, rightHash] = await Promise.all([sha256(left), sha256(right)]);
  let difference = 0;
  for (let index = 0; index < leftHash.length; index += 1) {
    difference |= leftHash[index] ^ rightHash[index];
  }
  return difference === 0;
}

async function hmac(secret, value) {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  return new Uint8Array(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(value)));
}

function configuredSecret(env, name) {
  const value = String(env[name] || "").trim();
  if (!value) throw new Error(name + " is not configured");
  return value;
}

function parseScopes(value, fallback = MCP_DEFAULT_SCOPE) {
  const scopes = [...new Set(String(value || fallback).split(/\s+/).filter(Boolean))];
  if (!scopes.includes(MCP_READ_SCOPE) || scopes.some((scope) => !MCP_SUPPORTED_SCOPES.includes(scope))) {
    throw new McpOAuthError("invalid_scope", "Supported scopes are " + MCP_DEFAULT_SCOPE, 400);
  }
  return scopes;
}

function validRedirectUri(value) {
  try {
    const url = new URL(value);
    return url.protocol === "https:" && !url.username && !url.password && !url.hash;
  } catch {
    return false;
  }
}

async function loadClient(env, clientId) {
  if (!clientId) return null;
  const client = await env.DB.prepare(
    "SELECT client_id AS clientId, redirect_uris AS redirectUris FROM mcp_oauth_clients WHERE client_id = ?"
  )
    .bind(clientId)
    .first();
  if (!client) return null;
  try {
    client.redirectUris = JSON.parse(client.redirectUris);
  } catch {
    return null;
  }
  return client;
}

function authorizationRequest(params) {
  const responseType = String(params.get("response_type") || "");
  const clientId = String(params.get("client_id") || "");
  const redirectUri = String(params.get("redirect_uri") || "");
  const codeChallenge = String(params.get("code_challenge") || "");
  const codeChallengeMethod = String(params.get("code_challenge_method") || "");
  const state = String(params.get("state") || "");
  const scopes = parseScopes(params.get("scope"));
  if (responseType !== "code") throw new McpOAuthError("unsupported_response_type", "response_type must be code", 400);
  if (!clientId || !redirectUri) throw new McpOAuthError("invalid_request", "client_id and redirect_uri are required", 400);
  if (codeChallengeMethod !== "S256" || !/^[A-Za-z0-9_-]{43,128}$/.test(codeChallenge)) {
    throw new McpOAuthError("invalid_request", "PKCE with code_challenge_method S256 is required", 400);
  }
  return { clientId, redirectUri, codeChallenge, state, scopes };
}

async function validateAuthorizationRequest(env, params) {
  const authorization = authorizationRequest(params);
  const client = await loadClient(env, authorization.clientId);
  if (!client || !client.redirectUris.includes(authorization.redirectUri)) {
    throw new McpOAuthError("invalid_request", "Unknown client or redirect_uri", 400);
  }
  return authorization;
}

function authorizationForm(authorization, { error = "", csrfToken, remembered = false, remember = false } = {}) {
  const isEditorLogin = isEditorRedirect(authorization.redirectUri);
  const title = isEditorLogin ? "単語帳の編集ページにログイン" : "単語帳をChatGPTに接続";
  const actionLabel = isEditorLogin ? "編集ページにログイン" : "接続を許可";
  const hidden = Object.entries({
    response_type: "code",
    client_id: authorization.clientId,
    redirect_uri: authorization.redirectUri,
    code_challenge: authorization.codeChallenge,
    code_challenge_method: "S256",
    scope: authorization.scopes.join(" "),
    state: authorization.state,
    csrf_token: csrfToken,
  })
    .map(([name, value]) => `<input type="hidden" name="${name}" value="${escapeHtml(value)}">`)
    .join("");
  const permission = isEditorLogin
    ? "単語帳の閲覧・作成・更新・並べ替え・削除を許可します。"
    : authorization.scopes.includes(MCP_WRITE_SCOPE)
      ? "単語帳の閲覧・作成・更新・並べ替えを許可します。完全削除は提供しません。"
      : "単語帳の閲覧を許可します。";
  const errorMessage = error ? `<p class="error" role="alert">${escapeHtml(error)}</p>` : "";
  const authentication = remembered
    ? '<p class="remembered">このブラウザーで本人確認済みです。接続先と権限を確認して続行してください。</p>'
    : '<label for="api_key">Vocab MCP APIキー</label><input id="api_key" name="api_key" type="password" required autocomplete="current-password" autofocus>';
  const rememberCheckbox = `<label class="remember"><input name="remember_login" type="checkbox" value="1"${remember ? " checked" : ""}> このブラウザーでログイン状態を保持する（30日間）</label>`;
  const note = isEditorLogin
    ? "APIキーは認証確認にだけ使用し、編集ページには保存しません。編集ページの既存のログイン有効期間は7日間です。"
    : "APIキーは認証確認にだけ使用し、ChatGPTには渡しません。接続後は有効期間12時間のトークンを自動更新し、接続開始から最大30日間利用できます。";
  return `<!doctype html>
<html lang="ja"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${escapeHtml(title)}</title>
<style>${AUTH_PAGE_STYLE}</style>
</head><body><main class="card"><h1>${escapeHtml(title)}</h1><p>${escapeHtml(permission)}</p>${errorMessage}
<p class="destination">接続先：${escapeHtml(authorization.redirectUri)}</p>
<form method="post">${hidden}${authentication}${rememberCheckbox}<button type="submit">${escapeHtml(actionLabel)}</button></form>
<p class="note">チェックした場合だけ、APIキーを保存せずに次回から入力を省略します。接続の許可は毎回必要です。共用の端末ではチェックしないでください。保持開始から30日後に再認証が必要です。</p>
<p class="note">${escapeHtml(note)}</p><p><a href="/oauth/logout">このブラウザーのログイン保持を解除</a></p></main></body></html>`;
}

function redirectWithAuthorizationResult(redirectUri, values) {
  const destination = new URL(redirectUri);
  for (const [name, value] of Object.entries(values)) {
    if (value !== undefined && value !== "") destination.searchParams.set(name, value);
  }
  return new Response(null, { status: 302, headers: { Location: destination.toString(), "Cache-Control": "no-store" } });
}

async function registerClient(request, env) {
  if (request.method !== "POST") return json({ error: "method_not_allowed" }, 405, { Allow: "POST" });
  const document = await request.json().catch(() => null);
  const redirectUris = Array.isArray(document?.redirect_uris) ? [...new Set(document.redirect_uris.map(String))] : [];
  if (!redirectUris.length || redirectUris.length > 10 || redirectUris.some((uri) => !validRedirectUri(uri))) {
    return json({ error: "invalid_redirect_uri", error_description: "One to ten HTTPS redirect_uris are required" }, 400);
  }
  if (document.token_endpoint_auth_method && document.token_endpoint_auth_method !== "none") {
    return json({ error: "invalid_client_metadata", error_description: "Only token_endpoint_auth_method none is supported" }, 400);
  }
  const clientId = randomToken(24);
  await env.DB.prepare("INSERT INTO mcp_oauth_clients (client_id, redirect_uris) VALUES (?, ?)")
    .bind(clientId, JSON.stringify(redirectUris))
    .run();
  return json(
    {
      client_id: clientId,
      client_id_issued_at: Math.floor(Date.now() / 1000),
      redirect_uris: redirectUris,
      token_endpoint_auth_method: "none",
      grant_types: ["authorization_code", "refresh_token"],
      response_types: ["code"],
    },
    201
  );
}

async function authorizationPage(request, env, authorization, options = {}, status = 200) {
  const form = await createBrowserForm(request, env, "authorize", authorization);
  const response = html(authorizationForm(authorization, { ...options, csrfToken: form.token }),
    status, new URL(authorization.redirectUri).origin);
  response.headers.append("Set-Cookie", form.cookie);
  return response;
}

async function authorize(request, env) {
  if (request.method !== "GET" && request.method !== "POST") {
    return json({ error: "method_not_allowed" }, 405, { Allow: "GET, POST" });
  }
  if (request.method === "POST" && !sameOriginFormPost(request)) {
    return json({ error: "invalid_request", error_description: "同じ認証ページから送信してください。" }, 403);
  }
  const params = new URLSearchParams(new URL(request.url).searchParams);
  let submitted = new URLSearchParams();
  if (request.method === "POST") {
    submitted = new URLSearchParams(await request.text());
    for (const [name, value] of submitted) params.set(name, value);
  }

  let authorization;
  try {
    authorization = await validateAuthorizationRequest(env, params);
  } catch (error) {
    if (error instanceof McpOAuthError) return json({ error: error.code, error_description: error.message }, error.status);
    throw error;
  }
  if (request.method === "GET") {
    const session = await rememberedSession(request, env);
    return authorizationPage(request, env, authorization, { remembered: Boolean(session), remember: Boolean(session) });
  }
  // Form fields that authenticate or opt into persistence must never come from the URL.
  if (!(await consumeBrowserForm(request, env, submitted.get("csrf_token"), "authorize", authorization))) {
    return json({ error: "invalid_request", error_description: "認証ページの有効期限が切れたか、すでに送信済みです。ページを開き直してください。" }, 403);
  }
  const session = await rememberedSession(request, env);
  const suppliedKey = String(submitted.get("api_key") || "");
  const remember = submitted.get("remember_login") === "1";
  const configuredKey = configuredSecret(env, "VOCAB_MCP_API_KEY");
  if ((!session || suppliedKey) && (!suppliedKey || !(await safeEqual(suppliedKey, configuredKey)))) {
    return authorizationPage(request, env, authorization, {
      error: "APIキーが正しくありません。", remember,
    }, 401);
  }

  const code = randomToken(32);
  const expiresAt = Math.floor(Date.now() / 1000) + AUTH_CODE_TTL_SECONDS;
  // Finish optional session writes before issuing a grant. A storage failure must
  // not silently authorize or downgrade the requested persistence preference.
  let sessionCookie;
  if (!remember) {
    await revokeRememberedSession(request, env);
    sessionCookie = clearRememberedCookie();
  } else if (!session || suppliedKey) {
    sessionCookie = await rememberBrowser(request, env);
  }
  // Reusing a remembered browser never extends its original 30-day expiry.
  await env.DB.prepare(
    "INSERT INTO mcp_oauth_codes (code, client_id, redirect_uri, code_challenge, scope, expires_at) VALUES (?, ?, ?, ?, ?, ?)"
  )
    .bind(code, authorization.clientId, authorization.redirectUri,
      authorization.codeChallenge, authorization.scopes.join(" "), expiresAt)
    .run();
  const response = redirectWithAuthorizationResult(authorization.redirectUri, { code, state: authorization.state });
  if (sessionCookie) response.headers.append("Set-Cookie", sessionCookie);
  return response;
}

async function logoutBrowser(request, env) {
  if (request.method !== "GET" && request.method !== "POST") {
    return json({ error: "method_not_allowed" }, 405, { Allow: "GET, POST" });
  }
  if (request.method === "POST") {
    if (!sameOriginFormPost(request)) return json({ error: "invalid_request" }, 403);
    const params = new URLSearchParams(await request.text());
    if (!(await consumeBrowserForm(request, env, params.get("csrf_token"), "logout"))) {
      return json({ error: "invalid_request", error_description: "ページを開き直してください。" }, 403);
    }
    await revokeRememberedSession(request, env);
    const response = html(`<!doctype html><html lang="ja"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>ログイン保持を解除しました</title><style>${AUTH_PAGE_STYLE}</style></head><body><main class="card"><h1>このブラウザーのログイン保持を解除しました</h1><p>次回の認証ではAPIキーが必要です。このタブを閉じてかまいません。</p><p class="note">発行済みのChatGPT・編集ページのトークンは各有効期限まで有効です。</p></main></body></html>`);
    response.headers.append("Set-Cookie", clearRememberedCookie());
    return response;
  }
  const form = await createBrowserForm(request, env, "logout");
  const response = html(`<!doctype html><html lang="ja"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>ログイン保持を解除</title><style>${AUTH_PAGE_STYLE}</style></head><body><main class="card"><h1>このブラウザーのログイン保持を解除</h1><p>解除すると、次回の認証でAPIキーが必要になります。</p><p>発行済みのChatGPT・編集ページのトークンは各有効期限まで有効です。</p><form method="post"><input type="hidden" name="csrf_token" value="${escapeHtml(form.token)}"><button type="submit">ログイン保持を解除する</button></form></main></body></html>`);
  response.headers.append("Set-Cookie", form.cookie);
  return response;
}

async function issueAccessToken(request, env, origin) {
  if (request.method !== "POST") return json({ error: "method_not_allowed" }, 405, { Allow: "POST" });
  const params = new URLSearchParams(await request.text());
  if (["grant_type","code","client_id","redirect_uri","code_verifier","refresh_token","scope","resource"].some(key => params.getAll(key).length > 1)) {
    return json({error:"invalid_request"},400);
  }
  if (params.has("resource") && ![origin+"/mcp",origin+"/mcp-write"].includes(params.get("resource"))) return json({error:"invalid_target"},400);
  if (params.get("grant_type") === "refresh_token") {
    const grant = await rotateRefreshGrant(env, origin, params, Math.floor(Date.now()/1000));
    if (!grant || grant.error) return json({error: grant?.error || "invalid_grant"}, 400);
    return accessTokenResponse(env, origin, grant);
  }
  if (params.get("grant_type") !== "authorization_code") {
    return json({ error: "unsupported_grant_type", error_description: "grant_type must be authorization_code" }, 400);
  }
  const code = String(params.get("code") || "");
  const clientId = String(params.get("client_id") || "");
  const redirectUri = String(params.get("redirect_uri") || "");
  const verifier = String(params.get("code_verifier") || "");
  if (!code || !clientId || !redirectUri || !/^[A-Za-z0-9._~-]{43,128}$/.test(verifier)) {
    return json({ error: "invalid_request", error_description: "code, client_id, redirect_uri, and a valid code_verifier are required" }, 400);
  }
  const record = await env.DB.prepare(
    "SELECT code, client_id AS clientId, redirect_uri AS redirectUri, code_challenge AS codeChallenge, scope, expires_at AS expiresAt FROM mcp_oauth_codes WHERE code = ?"
  )
    .bind(code)
    .first();
  const now = Math.floor(Date.now() / 1000);
  const actualChallenge = bytesToBase64Url(await sha256(verifier));
  if (
    !record ||
    record.clientId !== clientId ||
    record.redirectUri !== redirectUri ||
    Number(record.expiresAt) <= now ||
    !(await safeEqual(actualChallenge, record.codeChallenge))
  ) {
    return json({ error: "invalid_grant", error_description: "The authorization code is invalid or expired" }, 400);
  }
  const secret = configuredSecret(env, "VOCAB_MCP_SESSION_SECRET");
  const deletion = await env.DB.prepare(
    "DELETE FROM mcp_oauth_codes WHERE code = ? AND client_id = ? AND redirect_uri = ? AND code_challenge = ?"
  )
    .bind(code, clientId, redirectUri, record.codeChallenge)
    .run();
  if (Number(deletion.meta?.changes || 0) !== 1) {
    return json({ error: "invalid_grant", error_description: "The authorization code was already used" }, 400);
  }

  if (!isEditorRedirect(record.redirectUri)) {
    const grant = await createRefreshGrant(env, origin, clientId, record.scope, now);
    return accessTokenResponse(env, origin, grant);
  }
  return accessTokenResponse(env, origin, {clientId,scope:record.scope}, EDITOR_TOKEN_TTL_SECONDS);
}

async function accessTokenResponse(env, origin, grant, ttl = ACCESS_TOKEN_TTL_SECONDS) {
  const now = Math.floor(Date.now()/1000);
  const tokenTtl = Math.min(ttl, grant.expiresAt ? grant.expiresAt-now : ttl);
  if (tokenTtl <= 0) return json({error:"invalid_grant"},400);
  const header = encodeJson({alg:"HS256",typ:"at+jwt"});
  const payload = encodeJson({iss:origin, sub:grant.clientId, aud:TOKEN_AUDIENCE,
    client_id:grant.clientId, scope:grant.scope, iat:now, exp:now+tokenTtl,
    jti:randomToken(16), ...(grant.familyId ? {refresh_family:grant.familyId} : {})});
  const signature = bytesToBase64Url(await hmac(configuredSecret(env,"VOCAB_MCP_SESSION_SECRET"),header+"."+payload));
  return json({access_token:header+"."+payload+"."+signature,token_type:"Bearer",expires_in:tokenTtl,scope:grant.scope,
    ...(grant.token ? {refresh_token:grant.token,refresh_token_expires_in:grant.expiresAt-now} : {})});
}

export async function verifyMcpAccess(request, env, requiredScopes = [MCP_READ_SCOPE]) {
  const authorization = request.headers.get("Authorization") || "";
  if (!authorization.startsWith("Bearer ")) {
    throw new McpOAuthError("invalid_token", "Bearer authentication is required");
  }
  const token = authorization.slice(7).trim();
  const parts = token.split(".");
  if (parts.length !== 3) throw new McpOAuthError("invalid_token", "The access token is malformed");
  const [encodedHeader, encodedPayload, encodedSignature] = parts;
  const header = decodeJson(encodedHeader);
  const payload = decodeJson(encodedPayload);
  if (header.alg !== "HS256" || header.typ !== "at+jwt") {
    throw new McpOAuthError("invalid_token", "The access token uses an unsupported format");
  }
  const secret = configuredSecret(env, "VOCAB_MCP_SESSION_SECRET");
  const expectedSignature = bytesToBase64Url(await hmac(secret, encodedHeader + "." + encodedPayload));
  if (!(await safeEqual(encodedSignature, expectedSignature))) {
    throw new McpOAuthError("invalid_token", "The access token signature is invalid");
  }
  const origin = new URL(request.url).origin;
  const now = Math.floor(Date.now() / 1000);
  if (
    payload.iss !== origin ||
    payload.aud !== TOKEN_AUDIENCE ||
    !payload.client_id ||
    !Number.isFinite(payload.exp) ||
    payload.exp <= now
  ) {
    throw new McpOAuthError("invalid_token", "The access token is invalid or expired");
  }
  if (payload.refresh_family) {
    const family = await readRefreshFamily(env, payload.refresh_family);
    if (!await validRefreshFamily(env, origin, family, now) || family.client_id !== payload.client_id ||
        String(payload.scope).split(" ").some(scope => !family.scope.split(" ").includes(scope))) {
      throw new McpOAuthError("invalid_token", "The connection was revoked or expired");
    }
  }
  const scopes = parseScopes(payload.scope, "");
  const missing = requiredScopes.filter((scope) => !scopes.includes(scope));
  if (missing.length) throw new McpOAuthError("insufficient_scope", "The access token lacks the required scope", 403);
  return {
    actor: "oauth:" + payload.client_id,
    subject: String(payload.sub || payload.client_id),
    clientId: String(payload.client_id),
    scopes,
    claims: payload,
  };
}

export function oauthErrorResponse(request, error, requiredScopes = [MCP_READ_SCOPE]) {
  const url = new URL(request.url);
  const origin = url.origin;
  const resourcePath = url.pathname.replace(/\/+$/, "") === "/mcp" ? "/mcp" : "/mcp-write";
  const oauthError = error instanceof McpOAuthError ? error : new McpOAuthError("invalid_token", "Authentication failed");
  const challenge =
    'Bearer resource_metadata="' +
    origin +
    '/.well-known/oauth-protected-resource' +
    resourcePath +
    '", scope="' +
    requiredScopes.join(" ") +
    '", error="' +
    oauthError.code +
    '", error_description="' +
    oauthError.message.replaceAll('"', "'") +
    '"';
  return json({ error: oauthError.code, error_description: oauthError.message }, oauthError.status, {
    "WWW-Authenticate": challenge,
  });
}

export async function handleOAuthRoute(request, env) {
  const url = new URL(request.url);
  const path = url.pathname.replace(/\/+$/, "") || "/";
  const origin = url.origin;
  if (
    path === "/.well-known/oauth-protected-resource" ||
    path === "/.well-known/oauth-protected-resource/mcp" ||
    path === "/.well-known/oauth-protected-resource/mcp-write"
  ) {
    const resourcePath = path.endsWith("/mcp") ? "/mcp" : "/mcp-write";
    return json({
      resource: origin + resourcePath,
      authorization_servers: [origin],
      scopes_supported: MCP_SUPPORTED_SCOPES,
      bearer_methods_supported: ["header"],
    });
  }
  if (path === "/.well-known/oauth-authorization-server") {
    return json({
      issuer: origin,
      authorization_endpoint: origin + "/oauth/authorize",
      token_endpoint: origin + "/oauth/token",
      revocation_endpoint: origin + "/oauth/revoke",
      revocation_endpoint_auth_methods_supported: ["none"],
      registration_endpoint: origin + "/oauth/register",
      scopes_supported: MCP_SUPPORTED_SCOPES,
      response_types_supported: ["code"],
      response_modes_supported: ["query"],
      grant_types_supported: ["authorization_code", "refresh_token"],
      token_endpoint_auth_methods_supported: ["none"],
      code_challenge_methods_supported: ["S256"],
    });
  }
  if (path === "/oauth/register") return registerClient(request, env);
  if (path === "/oauth/authorize") return authorize(request, env);
  if (path === "/oauth/token") return issueAccessToken(request, env, origin);
  if (path === "/oauth/revoke") {
    if (request.method !== "POST") return json({error:"method_not_allowed"},405,{Allow:"POST"});
    await revokeRefreshGrant(env,new URLSearchParams(await request.text()),Math.floor(Date.now()/1000));
    return new Response(null,{status:200,headers:{"Cache-Control":"no-store"}});
  }
  if (path === "/oauth/logout") return logoutBrowser(request, env);
  return null;
}
