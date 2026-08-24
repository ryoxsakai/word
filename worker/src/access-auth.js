const JWKS_CACHE_TTL_MS = 5 * 60 * 1000;

let cachedJwks = null;
let cachedJwksUrl = null;
let cachedJwksAt = 0;

function base64UrlToBytes(value) {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized + "=".repeat((4 - (normalized.length % 4)) % 4);
  const binary = atob(padded);
  return Uint8Array.from(binary, (char) => char.charCodeAt(0));
}

function decodeJsonPart(value, name) {
  try {
    return JSON.parse(new TextDecoder().decode(base64UrlToBytes(value)));
  } catch {
    throw new Error("Invalid Cloudflare Access JWT " + name);
  }
}

function accessIssuer(teamDomain) {
  const value = String(teamDomain || "").trim();
  if (!value) return null;
  const url = new URL(value.includes("://") ? value : "https://" + value);
  return url.origin;
}

async function loadJwks(issuer) {
  const url = issuer + "/cdn-cgi/access/certs";
  if (cachedJwks && cachedJwksUrl === url && Date.now() - cachedJwksAt < JWKS_CACHE_TTL_MS) {
    return cachedJwks;
  }
  const response = await fetch(url, { headers: { Accept: "application/json" } });
  if (!response.ok) throw new Error("Unable to load Cloudflare Access signing keys");
  const document = await response.json();
  if (!Array.isArray(document?.keys)) throw new Error("Invalid Cloudflare Access JWKS document");
  cachedJwks = document.keys;
  cachedJwksUrl = url;
  cachedJwksAt = Date.now();
  return cachedJwks;
}

function includesAudience(value, expected) {
  if (Array.isArray(value)) return value.includes(expected);
  return value === expected;
}

export async function verifyWriteAccess(request, env) {
  const authorization = request.headers.get("Authorization") || "";
  const accessAssertion = request.headers.get("Cf-Access-Jwt-Assertion") || "";

  const issuer = accessIssuer(env.CF_ACCESS_TEAM_DOMAIN);
  const expectedAudience = String(env.CF_ACCESS_AUD || "").trim();
  if (!issuer || !expectedAudience) {
    throw new Error("MCP write access is not configured");
  }

  const token = accessAssertion || (authorization.startsWith("Bearer ") ? authorization.slice(7).trim() : "");
  if (!token) throw new Error("Cloudflare Access authentication is required");

  const parts = token.split(".");
  if (parts.length !== 3) throw new Error("Invalid Cloudflare Access JWT");
  const [encodedHeader, encodedPayload, encodedSignature] = parts;
  const header = decodeJsonPart(encodedHeader, "header");
  const payload = decodeJsonPart(encodedPayload, "payload");
  if (header.alg !== "RS256" || !header.kid) throw new Error("Unsupported Cloudflare Access JWT");

  const keys = await loadJwks(issuer);
  const jwk = keys.find((key) => key.kid === header.kid && key.kty === "RSA");
  if (!jwk) throw new Error("Unknown Cloudflare Access signing key");
  const key = await crypto.subtle.importKey(
    "jwk",
    jwk,
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["verify"]
  );
  const validSignature = await crypto.subtle.verify(
    "RSASSA-PKCS1-v1_5",
    key,
    base64UrlToBytes(encodedSignature),
    new TextEncoder().encode(encodedHeader + "." + encodedPayload)
  );
  if (!validSignature) throw new Error("Invalid Cloudflare Access JWT signature");

  const now = Math.floor(Date.now() / 1000);
  if (!Number.isFinite(payload.exp) || payload.exp <= now) throw new Error("Cloudflare Access JWT has expired");
  if (payload.nbf !== undefined && Number(payload.nbf) > now + 30) throw new Error("Cloudflare Access JWT is not active");
  if (String(payload.iss || "").replace(/\/$/, "") !== issuer.replace(/\/$/, "")) {
    throw new Error("Invalid Cloudflare Access JWT issuer");
  }
  if (!includesAudience(payload.aud, expectedAudience)) throw new Error("Invalid Cloudflare Access JWT audience");

  const actor = String(payload.email || payload.common_name || payload.sub || "authenticated-user");
  return { actor, subject: String(payload.sub || actor), claims: payload };
}
