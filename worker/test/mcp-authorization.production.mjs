// Safe production checks: never provide a target or any fields to change.
// update_word rejects {} before database access even with a valid OAuth token.
import assert from 'node:assert/strict';
const origin = process.env.MCP_ORIGIN || 'https://vocab.lrnr.jp';
for (const path of ['/mcp', '/mcp-write']) {
  for (const name of ['update_word', 'vocab.update_word']) {
    const response = await fetch(origin + path, {
      method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json, text/event-stream' },
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name, arguments: {} } }),
      signal: AbortSignal.timeout(30000),
    });
    assert.equal(response.status, 401, `${path} ${name} must require OAuth`);
    assert.equal((await response.json()).error, 'invalid_token');
    const challenge = response.headers.get('WWW-Authenticate') || '';
    assert.ok(challenge.includes('/.well-known/oauth-protected-resource' + path));
    assert.ok(challenge.includes('vocab:read vocab:write'));
    console.log(`${path} ${name}: anonymous request rejected (401 invalid_token)`);
  }
}
