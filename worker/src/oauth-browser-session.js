// Browser authentication is deliberately separate from OAuth grants and bearer tokens.
// Only SHA-256 digests of random cookie/form values are stored in D1.
const SESSION_COOKIE = "__Host-vocab-oauth-session";
const FORM_COOKIE = "__Host-vocab-oauth-browser";
const SESSION_TTL_SECONDS = 30 * 24 * 60 * 60;
const FORM_TTL_SECONDS = 10 * 60;
const TOKEN_PATTERN = /^[A-Za-z0-9_-]{43}$/;

const now = () => Math.floor(Date.now() / 1000);
const base64url = (bytes) => btoa(String.fromCharCode(...bytes))
  .replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/, "");
const randomToken = () => base64url(crypto.getRandomValues(new Uint8Array(32)));
async function digest(value) {
  return base64url(new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value))));
}

function cookieValue(request, name) {
  const values = (request.headers.get("Cookie") || "").split(";")
    .map((part) => part.trim()).filter((part) => part.startsWith(name + "="))
    .map((part) => part.slice(name.length + 1));
  return values.length === 1 && TOKEN_PATTERN.test(values[0]) ? values[0] : "";
}

function cookie(name, value, maxAge) {
  return `${name}=${value}; Path=/; Secure; HttpOnly; SameSite=Lax; Max-Age=${maxAge}`;
}

export const clearRememberedCookie = () => cookie(SESSION_COOKIE, "", 0);

async function credentialVersion(env, origin) {
  const secret = String(env.VOCAB_MCP_SESSION_SECRET || "").trim();
  const apiKey = String(env.VOCAB_MCP_API_KEY || "").trim();
  if (!secret || !apiKey) throw new Error("OAuth authentication is not configured");
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return base64url(new Uint8Array(await crypto.subtle.sign("HMAC", key,
    new TextEncoder().encode(JSON.stringify(["vocab-browser-session-v1", origin, apiKey])))));
}

export async function rememberedSession(request, env) {
  const token = cookieValue(request, SESSION_COOKIE);
  if (!token) return null;
  const tokenHash = await digest(token);
  const origin = new URL(request.url).origin;
  const record = await env.DB.prepare(
    "SELECT expires_at AS expiresAt FROM mcp_oauth_browser_sessions WHERE token_hash = ? AND origin = ? AND credential_version = ? AND expires_at > ?"
  ).bind(tokenHash, origin, await credentialVersion(env, origin), now()).first();
  return record ? { tokenHash, expiresAt: Number(record.expiresAt) } : null;
}

// Include the cookie itself, even if invalid/expired, to prevent a form from being
// transplanted to a browser whose remembered identity has since changed.
async function contextDigest(request, action, authorization) {
  return digest(JSON.stringify([
    new URL(request.url).origin, action,
    authorization ? [authorization.clientId, authorization.redirectUri,
      authorization.codeChallenge, authorization.state, authorization.scopes] : null,
    await digest(cookieValue(request, SESSION_COOKIE)),
  ]));
}

export async function createBrowserForm(request, env, action, authorization = null) {
  const browser = cookieValue(request, FORM_COOKIE) || randomToken();
  const token = randomToken();
  await env.DB.prepare("DELETE FROM mcp_oauth_browser_forms WHERE expires_at <= ?").bind(now()).run();
  await env.DB.prepare(
    "INSERT INTO mcp_oauth_browser_forms (token_hash, browser_hash, context_hash, expires_at) VALUES (?, ?, ?, ?)"
  ).bind(await digest(token), await digest(browser), await contextDigest(request, action, authorization),
    now() + FORM_TTL_SECONDS).run();
  return { token, cookie: cookie(FORM_COOKIE, browser, FORM_TTL_SECONDS) };
}

export function sameOriginFormPost(request) {
  const origin = new URL(request.url).origin;
  const fetchSite = request.headers.get("Sec-Fetch-Site");
  return request.method === "POST" && request.headers.get("Origin") === origin &&
    (!fetchSite || fetchSite === "same-origin") &&
    (request.headers.get("Content-Type") || "").split(";")[0].trim().toLowerCase() === "application/x-www-form-urlencoded";
}

export async function consumeBrowserForm(request, env, token, action, authorization = null) {
  const browser = cookieValue(request, FORM_COOKIE);
  if (!sameOriginFormPost(request) || !TOKEN_PATTERN.test(token || "") || !browser) return false;
  // Atomic consumption: simultaneous/repeated submissions can grant only once.
  const result = await env.DB.prepare(
    "DELETE FROM mcp_oauth_browser_forms WHERE token_hash = ? AND browser_hash = ? AND context_hash = ? AND expires_at > ? RETURNING token_hash"
  ).bind(await digest(token), await digest(browser), await contextDigest(request, action, authorization), now()).first();
  return Boolean(result);
}

export async function revokeRememberedSession(request, env) {
  const token = cookieValue(request, SESSION_COOKIE);
  if (token) await env.DB.prepare(
    "DELETE FROM mcp_oauth_browser_sessions WHERE token_hash = ? AND origin = ?"
  ).bind(await digest(token), new URL(request.url).origin).run();
}

export async function rememberBrowser(request, env) {
  const token = randomToken();
  const origin = new URL(request.url).origin;
  const timestamp = now();
  const version = await credentialVersion(env, origin);
  // Do not preserve an older browser identity when explicitly authenticating again.
  await revokeRememberedSession(request, env);
  await env.DB.prepare("DELETE FROM mcp_oauth_browser_sessions WHERE expires_at <= ?").bind(timestamp).run();
  await env.DB.prepare(
    "INSERT INTO mcp_oauth_browser_sessions (token_hash, origin, credential_version, created_at, expires_at) VALUES (?, ?, ?, ?, ?)"
  ).bind(await digest(token), origin, version, timestamp, timestamp + SESSION_TTL_SECONDS).run();
  return cookie(SESSION_COOKIE, token, SESSION_TTL_SECONDS);
}
