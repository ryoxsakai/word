// Read-only deployment smoke check against the real wrapper and current DB.
import assert from 'node:assert/strict';
const endpoint = process.env.IDIOM_MCP_URL || 'https://vocab.lrnr.jp/mcp';
async function rpc(method, params) {
  const response = await fetch(endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json, text/event-stream' }, body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }), signal: AbortSignal.timeout(30000) });
  assert.equal(response.status, 200);
  const payload = await response.json(); assert(payload.result, JSON.stringify(payload));
  assert.notEqual(payload.result.isError, true, JSON.stringify(payload)); return payload.result;
}
const names = ['get_idiom_structure','list_idioms','search_idioms','get_idiom','create_idioms','update_idiom','move_idioms','reorder_idioms','update_idiom_structure','merge_idioms'];
const tools = (await rpc('tools/list', {})).tools;
for (const name of names) { assert(tools.some(t => t.name === name)); assert(tools.some(t => t.name === 'vocab.'+name)); }
const call = async (name, args={}) => (await rpc('tools/call',{name,arguments:{list_id:'crossover-v3',...args}})).structuredContent;
const structure = await call('get_idiom_structure'); assert(structure.totalCount > 0); assert(structure.sections.length > 0);
const list = await call('list_idioms',{limit:1}); assert.equal(list.entries.length,1);
const detail = await call('get_idiom',{idiom_id:list.entries[0].id}); assert.equal(detail.idiom.id,list.entries[0].id);
const search = await call('search_idioms',{query:list.entries[0].phrase,limit:100}); assert(search.entries.some(e=>e.id===detail.idiom.id));
const viewer = await fetch(endpoint.replace(/\/mcp$/, '/mcp-viewer/api/lists/crossover-v3/idioms'), {signal:AbortSignal.timeout(30000)});
assert.equal(viewer.status,200); const collection = await viewer.json();
assert.equal(structure.totalCount,collection.entries.length);assert.equal(structure.visibleCount,collection.entries.filter(e=>!e.hidden).length);
console.log(`Production idiom MCP passed: ${names.length} tools and aliases; ${structure.totalCount} total / ${structure.visibleCount} visible entries match viewer`);
