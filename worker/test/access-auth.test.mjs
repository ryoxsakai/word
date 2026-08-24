import assert from "node:assert/strict";
import { verifyWriteAccess } from "../src/access-auth.js";

function encode(value) {
  return Buffer.from(typeof value === "string" ? value : JSON.stringify(value)).toString("base64url");
}

async function signedJwt(privateKey, kid, payload) {
  const header = encode({ alg: "RS256", typ: "JWT", kid });
  const body = encode(payload);
  const input = header + "." + body;
  const signature = await crypto.subtle.sign(
    "RSASSA-PKCS1-v1_5",
    privateKey,
    new TextEncoder().encode(input)
  );
  return input + "." + Buffer.from(signature).toString("base64url");
}

const issuer = "https://example.cloudflareaccess.com";
const audience = "vocab-access-audience";
const kid = "test-key";
const keys = await crypto.subtle.generateKey(
  { name: "RSASSA-PKCS1-v1_5", modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: "SHA-256" },
  true,
  ["sign", "verify"]
);
const jwk = await crypto.subtle.exportKey("jwk", keys.publicKey);
jwk.kid = kid;
jwk.alg = "RS256";
jwk.use = "sig";

const originalFetch = globalThis.fetch;
globalThis.fetch = async (url) => {
  assert.equal(String(url), issuer + "/cdn-cgi/access/certs");
  return Response.json({ keys: [jwk] });
};

try {
  const now = Math.floor(Date.now() / 1000);
  const valid = await signedJwt(keys.privateKey, kid, {
    iss: issuer,
    aud: [audience],
    sub: "user-123",
    email: "ryo@example.com",
    iat: now,
    exp: now + 300,
  });
  const auth = await verifyWriteAccess(
    new Request("https://vocab.lrnr.jp/mcp-write", { headers: { "Cf-Access-Jwt-Assertion": valid } }),
    { CF_ACCESS_TEAM_DOMAIN: "example.cloudflareaccess.com", CF_ACCESS_AUD: audience }
  );
  assert.equal(auth.actor, "ryo@example.com");
  assert.equal(auth.subject, "user-123");

  const wrongAudience = await signedJwt(keys.privateKey, kid, {
    iss: issuer,
    aud: "other-audience",
    sub: "user-123",
    exp: now + 300,
  });
  await assert.rejects(
    verifyWriteAccess(
      new Request("https://vocab.lrnr.jp/mcp-write", { headers: { "Cf-Access-Jwt-Assertion": wrongAudience } }),
      { CF_ACCESS_TEAM_DOMAIN: issuer, CF_ACCESS_AUD: audience }
    ),
    /audience/
  );

  const expired = await signedJwt(keys.privateKey, kid, {
    iss: issuer,
    aud: audience,
    sub: "user-123",
    exp: now - 1,
  });
  await assert.rejects(
    verifyWriteAccess(
      new Request("https://vocab.lrnr.jp/mcp-write", { headers: { Authorization: "Bearer " + expired } }),
      { CF_ACCESS_TEAM_DOMAIN: issuer, CF_ACCESS_AUD: audience }
    ),
    /expired/
  );

  await assert.rejects(
    verifyWriteAccess(
      new Request("https://vocab.lrnr.jp/mcp-write", { headers: { Authorization: "Bearer " + valid.slice(0, -2) + "aa" } }),
      { CF_ACCESS_TEAM_DOMAIN: issuer, CF_ACCESS_AUD: audience }
    ),
    /signature/
  );

  console.log("Cloudflare Access JWT verification test passed");
} finally {
  globalThis.fetch = originalFetch;
}
