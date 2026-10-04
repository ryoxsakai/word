// Opaque refresh credentials: only SHA-256 digests and grant metadata enter D1.
const TTL = 30 * 24 * 60 * 60;
const RETRY_SECONDS = 5;
const encoder = new TextEncoder();
function b64(bytes) { return btoa(String.fromCharCode(...bytes)).replaceAll('+','-').replaceAll('/','_').replace(/=+$/, ''); }
function random() { return b64(crypto.getRandomValues(new Uint8Array(32))); }
async function digest(value) { return b64(new Uint8Array(await crypto.subtle.digest('SHA-256', encoder.encode(value)))); }
async function mac(secret, value) {
  const key = await crypto.subtle.importKey('raw',encoder.encode(secret),{name:'HMAC',hash:'SHA-256'},false,['sign']);
  return b64(new Uint8Array(await crypto.subtle.sign('HMAC',key,encoder.encode(value))));
}
export async function credentialVersion(env, origin) {
  if (!env.VOCAB_MCP_API_KEY || !env.VOCAB_MCP_SESSION_SECRET) throw new Error('OAuth credentials are not configured');
  return mac(env.VOCAB_MCP_SESSION_SECRET, JSON.stringify(['vocab-refresh-v1',origin,env.VOCAB_MCP_API_KEY]));
}
export async function createRefreshGrant(env, origin, clientId, scope, now, code, redirectUri, challenge) {
  const familyId=random(), token=random(), hash=await digest(token), expiresAt=now+TTL;
  const version=await credentialVersion(env,origin);
  // Consuming the code and persisting both credentials are a single transaction.
  // changes() gates each insert on the immediately preceding statement's winner.
  const results=await env.DB.batch([
    env.DB.prepare('DELETE FROM mcp_oauth_codes WHERE code = ? AND client_id = ? AND redirect_uri = ? AND code_challenge = ? AND scope = ? AND expires_at > ?')
      .bind(code,clientId,redirectUri,challenge,scope,now),
    env.DB.prepare('INSERT INTO mcp_oauth_refresh_families (family_id, client_id, scope, issuer, credential_version, expires_at, current_hash) SELECT ?, ?, ?, ?, ?, ?, ? WHERE changes() = 1')
      .bind(familyId,clientId,scope,origin,version,expiresAt,hash),
    env.DB.prepare('INSERT INTO mcp_oauth_refresh_tokens (token_hash, family_id, generation) SELECT ?, ?, 0 WHERE changes() = 1').bind(hash,familyId),
  ]);
  if (Number(results[0].meta?.changes || 0)!==1) return null;
  return {familyId, token, expiresAt, scope, clientId};
}
export async function readRefreshFamily(env, familyId) {
  return env.DB.prepare('SELECT * FROM mcp_oauth_refresh_families WHERE family_id = ?').bind(familyId).first();
}
export async function validRefreshFamily(env, origin, family, now) {
  return family && family.revoked_at===null && family.expires_at>now && family.issuer===origin &&
    family.credential_version===await credentialVersion(env,origin);
}
export async function rotateRefreshGrant(env, origin, params, now) {
  if (['grant_type','client_id','refresh_token','scope','resource'].some(key=>params.getAll(key).length>1)) return {error:'invalid_request'};
  const raw=params.get('refresh_token') || '', clientId=params.get('client_id') || '';
  if (!/^[A-Za-z0-9_-]{43}$/.test(raw) || !clientId) return null;
  const hash=await digest(raw);
  const old=await env.DB.prepare('SELECT * FROM mcp_oauth_refresh_tokens WHERE token_hash = ?').bind(hash).first();
  if (!old) return null;
  let family=await readRefreshFamily(env,old.family_id);
  if (!await validRefreshFamily(env,origin,family,now) || family.client_id!==clientId) return null;
  const requested=params.has('scope') ? params.get('scope').split(/\s+/).filter(Boolean) : family.scope.split(' ');
  if (!requested.length || requested.some(s=>!family.scope.split(' ').includes(s)) || !requested.includes('vocab:read')) return {error:'invalid_scope'};
  // Resource changes cannot turn a refresh credential into authority at another server.
  if (params.has('resource') && ![origin+'/mcp',origin+'/mcp-write'].includes(params.get('resource'))) return {error:'invalid_target'};
  const next=await mac(env.VOCAB_MCP_SESSION_SECRET,JSON.stringify(['vocab-refresh-rotation-v1',raw,old.family_id,old.generation+1]));
  const nextHash=await digest(next);
  // All three statements are one D1 transaction. The CAS admits a single winner;
  // the fixed five-second duplicate window returns that same successor, never a fork.
  const rotation = await env.DB.batch([
    env.DB.prepare('UPDATE mcp_oauth_refresh_families SET current_hash = ?, generation = generation + 1 WHERE family_id = ? AND current_hash = ? AND generation = ? AND revoked_at IS NULL AND expires_at > ?')
      .bind(nextHash,old.family_id,hash,old.generation,now),
    env.DB.prepare('INSERT OR IGNORE INTO mcp_oauth_refresh_tokens (token_hash, family_id, generation) SELECT ?, family_id, generation FROM mcp_oauth_refresh_families WHERE family_id = ? AND current_hash = ? AND generation = ? AND revoked_at IS NULL')
      .bind(nextHash,old.family_id,nextHash,old.generation+1),
    env.DB.prepare('UPDATE mcp_oauth_refresh_tokens SET used_at = COALESCE(used_at, ?) WHERE token_hash = ? AND EXISTS (SELECT 1 FROM mcp_oauth_refresh_families WHERE family_id = ? AND current_hash = ? AND generation = ? AND revoked_at IS NULL)')
      .bind(now,hash,old.family_id,nextHash,old.generation+1),
  ]);
  const used=await env.DB.prepare('SELECT used_at FROM mcp_oauth_refresh_tokens WHERE token_hash = ?').bind(hash).first();
  family=await readRefreshFamily(env,old.family_id);
  if (!await validRefreshFamily(env,origin,family,Math.floor(Date.now()/1000))) return null;
  const wonRotation = Number(rotation[0].meta?.changes || 0) === 1;
  const currentSuccessor = family.current_hash===nextHash && family.generation===old.generation+1 && used.used_at!==null;
  if (wonRotation) {
    // A slow successful D1 transaction is not a credential replay. Never apply
    // the duplicate window to its winner, and never emit an advanced successor.
    if (!currentSuccessor) return null;
  } else {
    const age = Math.floor(Date.now()/1000)-used.used_at;
    if (!currentSuccessor || age<0 || age>RETRY_SECONDS) {
      await env.DB.prepare('UPDATE mcp_oauth_refresh_families SET revoked_at = ? WHERE family_id = ? AND revoked_at IS NULL').bind(Math.floor(Date.now()/1000),old.family_id).run();
      return null;
    }
  }
  return {familyId:old.family_id,token:next,expiresAt:family.expires_at,scope:[...new Set(requested)].join(' '),clientId};
}
export async function revokeRefreshGrant(env, params, now) {
  const raw=params.get('token') || '', clientId=params.get('client_id') || '';
  if (!raw || !clientId) return;
  await env.DB.prepare('UPDATE mcp_oauth_refresh_families SET revoked_at = ? WHERE client_id = ? AND family_id IN (SELECT family_id FROM mcp_oauth_refresh_tokens WHERE token_hash = ?) AND revoked_at IS NULL')
    .bind(now,clientId,await digest(raw)).run();
}
