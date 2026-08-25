const TOKEN_AUDIENCE = "vocab-mcp";
const AUTH_CODE_TTL_SECONDS = 5 * 60;
const ACCESS_TOKEN_TTL_SECONDS = 60 * 60;

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
      "Referrer-Policy": "no-referrer",
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

function authorizationForm(authorization, error = "") {
  const hidden = Object.entries({
    response_type: "code",
    client_id: authorization.clientId,
    redirect_uri: authorization.redirectUri,
    code_challenge: authorization.codeChallenge,
    code_challenge_method: "S256",
    scope: authorization.scopes.join(" "),
    state: authorization.state,
  })
    .map(([name, value]) => `<input type="hidden" name="${name}" value="${escapeHtml(value)}">`)
    .join("");
  const permission = authorization.scopes.includes(MCP_WRITE_SCOPE)
    ? "単語帳の閲覧・作成・更新・並べ替えを許可します。完全削除は提供しません。"
    : "単語帳の閲覧を許可します。";
  const errorMessage = error ? `<p class="error" role="alert">${escapeHtml(error)}</p>` : "";
  return `<!doctype html>
<html lang="ja"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>単語帳をChatGPTに接続</title>
<style>body{font-family:system-ui,-apple-system,sans-serif;background:#f6f7fb;color:#172033;margin:0;padding:32px 16px}.card{max-width:480px;margin:8vh auto;background:#fff;border:1px solid #dfe3ea;border-radius:16px;padding:28px;box-shadow:0 12px 36px #17203314}h1{font-size:1.45rem;margin:0 0 12px}p{line-height:1.65;color:#4a5568}.error{color:#b42318;background:#fef3f2;padding:10px 12px;border-radius:8px}label{display:block;font-weight:650;margin:22px 0 8px}input[type=password]{box-sizing:border-box;width:100%;padding:12px;border:1px solid #aab2c0;border-radius:8px;font:inherit}button{width:100%;margin-top:18px;padding:12px;border:0;border-radius:8px;background:#2463eb;color:#fff;font:inherit;font-weight:700;cursor:pointer}.note{font-size:.88rem}</style>
</head><body><main class="card"><h1>単語帳をChatGPTに接続</h1><p>${escapeHtml(permission)}</p>${errorMessage}
<form method="post">${hidden}<label for="api_key">Vocab MCP APIキー</label><input id="api_key" name="api_key" type="password" required autocomplete="current-password" autofocus><button type="submit">接続を許可</button></form>
<p class="note">APIキーは認証確認にだけ使用し、ChatGPTには渡しません。接続後は有効期間1時間のトークンが使用されます。</p></main></body></html>`;
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
      grant_types: ["authorization_code"],
      response_types: ["code"],
    },
    201
  );
}

async function authorize(request, env) {
  if (request.method !== "GET" && request.method !== "POST") {
    return json({ error: "method_not_allowed" }, 405, { Allow: "GET, POST" });
  }
  const params = new URLSearchParams(new URL(request.url).searchParams);
  if (request.method === "POST") {
    const submitted = new URLSearchParams(await request.text());
    for (const [name, value] of submitted) params.set(name, value);
  }

  let authorization;
  try {
    authorization = await validateAuthorizationRequest(env, params);
  } catch (error) {
    if (error instanceof McpOAuthError) return json({ error: error.code, error_description: error.message }, error.status);
    throw error;
  }
  const redirectOrigin = new URL(authorization.redirectUri).origin;
  if (request.method === "GET") return html(authorizationForm(authorization), 200, redirectOrigin);

  const suppliedKey = String(params.get("api_key") || "");
  const configuredKey = configuredSecret(env, "VOCAB_MCP_API_KEY");
  if (!suppliedKey || !(await safeEqual(suppliedKey, configuredKey))) {
    return html(authorizationForm(authorization, "APIキーが正しくありません。"), 401, redirectOrigin);
  }

  const code = randomToken(32);
  const expiresAt = Math.floor(Date.now() / 1000) + AUTH_CODE_TTL_SECONDS;
  await env.DB.prepare(
    "INSERT INTO mcp_oauth_codes (code, client_id, redirect_uri, code_challenge, scope, expires_at) VALUES (?, ?, ?, ?, ?, ?)"
  )
    .bind(
      code,
      authorization.clientId,
      authorization.redirectUri,
      authorization.codeChallenge,
      authorization.scopes.join(" "),
      expiresAt
    )
    .run();
  return redirectWithAuthorizationResult(authorization.redirectUri, { code, state: authorization.state });
}

async function issueAccessToken(request, env, origin) {
  if (request.method !== "POST") return json({ error: "method_not_allowed" }, 405, { Allow: "POST" });
  const params = new URLSearchParams(await request.text());
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

  const header = encodeJson({ alg: "HS256", typ: "at+jwt" });
  const payload = encodeJson({
    iss: origin,
    sub: clientId,
    aud: TOKEN_AUDIENCE,
    client_id: clientId,
    scope: record.scope,
    iat: now,
    exp: now + ACCESS_TOKEN_TTL_SECONDS,
    jti: randomToken(16),
  });
  const signature = bytesToBase64Url(await hmac(secret, header + "." + payload));
  return json({
    access_token: header + "." + payload + "." + signature,
    token_type: "Bearer",
    expires_in: ACCESS_TOKEN_TTL_SECONDS,
    scope: record.scope,
  });
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
  const origin = new URL(request.url).origin;
  const oauthError = error instanceof McpOAuthError ? error : new McpOAuthError("invalid_token", "Authentication failed");
  const challenge =
    'Bearer resource_metadata="' +
    origin +
    '/.well-known/oauth-protected-resource/mcp-write", scope="' +
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
  if (path === "/.well-known/oauth-protected-resource" || path === "/.well-known/oauth-protected-resource/mcp-write") {
    return json({
      resource: origin + "/mcp-write",
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
      registration_endpoint: origin + "/oauth/register",
      scopes_supported: MCP_SUPPORTED_SCOPES,
      response_types_supported: ["code"],
      response_modes_supported: ["query"],
      grant_types_supported: ["authorization_code"],
      token_endpoint_auth_methods_supported: ["none"],
      code_challenge_methods_supported: ["S256"],
    });
  }
  if (path === "/oauth/register") return registerClient(request, env);
  if (path === "/oauth/authorize") return authorize(request, env);
  if (path === "/oauth/token") return issueAccessToken(request, env, origin);
  return null;
}
