import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { handleMcpRoute } from '../src/mcp.js';
import { PROTECTED_READ_TOOLS, WRITE_TOOLS } from '../src/mcp-write.js';

const origin = 'https://mcp-auth-test.example';
const secret = 'synthetic-local-only-mcp-authorization-secret';
let dbAccesses = 0;
const DB = { prepare() { dbAccesses++; throw new Error('Authorization must run before database access'); } };
function token(scope = 'vocab:read vocab:write', overrides = {}, signingSecret = secret) {
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'at+jwt' })).toString('base64url');
  const payload = Buffer.from(JSON.stringify({ iss: origin, aud: 'vocab-mcp', client_id: 'synthetic-test', scope,
    exp: Math.floor(Date.now() / 1000) + 600, ...overrides })).toString('base64url');
  return `${header}.${payload}.${createHmac('sha256', signingSecret).update(`${header}.${payload}`).digest('base64url')}`;
}
async function rpc(env, path, name, accessToken, method = 'tools/call', extraHeaders = {}) {
  const result = await handleMcpRoute(new Request(origin + path, {
    method: 'POST', headers: { 'content-type': 'application/json', ...extraHeaders,
      ...(accessToken ? { Authorization: 'Bearer ' + accessToken } : {}) },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params: { name, arguments: {} } }),
  }), env);
  return { status: result.status, headers: result.headers, body: await result.json() };
}
function rejected(result, status, code, path) {
  assert.equal(result.status, status, JSON.stringify(result.body));
  assert.equal(result.body.error, code);
  assert.ok(result.headers.get('WWW-Authenticate').includes('/.well-known/oauth-protected-resource' + path.replace(/\/+$/, '')));
}
const paths = ['/mcp', '/mcp/', '/mcp-write', '/mcp-write/'];
for (const legacyFlag of [undefined, 'false', 'true', 'TRUE']) {
  const env = { DB, VOCAB_MCP_SESSION_SECRET: secret, ...(legacyFlag ? { MCP_ALLOW_ANONYMOUS_WRITES: legacyFlag } : {}) };
  for (const path of paths) {
    const tools = (await rpc(env, path, null, null, 'tools/list')).body.result.tools;
    const protectedNames = new Set([...PROTECTED_READ_TOOLS, ...WRITE_TOOLS].map(t => t.name));
    for (const tool of tools) {
      const name = tool.name.replace(/^vocab\./, '');
      const protectedTool = path.startsWith('/mcp-write') || protectedNames.has(name);
      assert.equal(tool.securitySchemes[0].type, protectedTool ? 'oauth2' : 'noauth', tool.name);
      if (protectedTool) rejected(await rpc(env, path, tool.name), 401, 'invalid_token', path);
    }
    for (const tool of WRITE_TOOLS) {
      for (const name of [tool.name, 'vocab.' + tool.name]) {
        const result = await rpc(env, path, name, token('vocab:read'));
        rejected(result, 403, 'insufficient_scope', path);
        assert.ok(result.headers.get('WWW-Authenticate').includes('vocab:read vocab:write'));
      }
    }
    // Name normalization must not offer a second route around the same guard.
    for (const name of [{ name: 'vocab.update_word' }, '{"name":"vocab.update_word"}', 'other.vocab.update_word']) {
      rejected(await rpc(env, path, name), 401, 'invalid_token', path);
    }
    for (const invalid of ['not-a-token', token(undefined, {}, 'wrong-secret'), token(undefined, { exp: 1 }),
      token(undefined, { iss: 'https://wrong.example' }), token(undefined, { aud: 'wrong' })]) {
      rejected(await rpc(env, path, 'update_word', invalid), 401, 'invalid_token', path);
    }
    rejected(await rpc(env, path, 'update_word', token('vocab:write')), 400, 'invalid_scope', path);
    rejected(await rpc(env, path, 'update_word', null, 'tools/call', { Cookie: '__Host-vocab-oauth-session=synthetic-cookie' }), 401, 'invalid_token', path);
    // The deployment probe is safe even if auth regresses: no target or fields are supplied.
    // A valid synthetic token reaches validation, which rejects it before any DB access.
    const valid = await rpc(env, path, 'vocab.update_word', token());
    assert.equal(valid.status, 200);
    assert.equal(valid.body.result.isError, true);
    assert.match(valid.body.result.content[0].text, /lookup_spelling is required/);
  }
}
assert.equal(dbAccesses, 0, 'All rejected calls and safe deployment probes must avoid the database');
const config = readFileSync(new URL('../wrangler.toml', import.meta.url), 'utf8');
assert.match(config, /^MCP_ALLOW_ANONYMOUS_WRITES\s*=\s*"false"\s*$/m);
console.log('MCP authorization: every protected tool and alias, stale legacy flag, scopes, token validation, cookie-only rejection, and safe deployment probe passed');
