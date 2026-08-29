import assert from "node:assert/strict";
import { mkdtempSync, readdirSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Miniflare } from "miniflare";
import { generateWordAudio, serveWordAudio } from "../src/word-audio.js";

function normalizeMigrationSql(sql) {
  const triggers = [];
  const withoutComments = sql.replace(/^\s*--.*$/gm, "");
  const protectedSql = withoutComments.replace(/CREATE\s+TRIGGER[\s\S]*?END\s*;/gi, (trigger) => {
    const marker = `__TRIGGER_${triggers.length}__`;
    triggers.push(trigger.replace(/;\s*$/, "").replace(/\s+/g, " "));
    return marker;
  });
  return protectedSql
    .split(";")
    .map((statement) => statement.trim().replace(/\s+/g, " "))
    .filter(Boolean)
    .map((statement) => statement.replace(/__TRIGGER_(\d+)__/g, (_match, index) => triggers[Number(index)]))
    .map((statement) => statement + ";")
    .join("\n");
}

const stateDir = mkdtempSync(join(tmpdir(), "vocab-word-audio-"));
const miniflare = new Miniflare({
  modules: true,
  script: 'export default { fetch() { return new Response("ok"); } }',
  compatibilityDate: "2024-11-01",
  d1Databases: ["DB"],
  d1Persist: stateDir,
  r2Buckets: ["AUDIO_BUCKET"],
  r2Persist: stateDir,
});

const originalFetch = globalThis.fetch;
let dictionaryCounter = 0;

try {
  const db = await miniflare.getD1Database("DB");
  const bucket = await miniflare.getR2Bucket("AUDIO_BUCKET");
  const migrationDir = new URL("../migrations/", import.meta.url);
  for (const filename of readdirSync(migrationDir).filter((name) => name.endsWith(".sql")).sort()) {
    await db.exec(normalizeMigrationSql(readFileSync(new URL(filename, migrationDir), "utf8")));
  }
  await db
    .prepare("INSERT OR IGNORE INTO words (id, spelling, pronunciation) VALUES (?, ?, ?)")
    .bind("permit", "permit", "/pəˈmɪt/")
    .run();
  await db
    .prepare("INSERT INTO senses (word_id, pos, meaning, is_primary) VALUES (?, ?, ?, 1)")
    .bind("permit", "他", "Oを許可する")
    .run();
  assert.equal(
    (await db.prepare("SELECT COUNT(*) AS count FROM word_audio_jobs WHERE word_id = 'permit'").first()).count,
    1
  );

  globalThis.fetch = async (url, init) => {
    if (url.endsWith("/pronunciation-dictionaries/add-from-rules")) {
      dictionaryCounter += 1;
      return Response.json({ id: `dictionary-${dictionaryCounter}`, version_id: `version-${dictionaryCounter}` });
    }
    if (url.includes("/text-to-speech/")) {
      return new Response(new Uint8Array([7, 8, 9, dictionaryCounter]), {
        headers: { "content-type": "audio/mpeg" },
      });
    }
    if (url.includes("/pronunciation-dictionaries/dictionary-") && init.method === "DELETE") {
      return new Response(null, { status: 204 });
    }
    return Response.json({ detail: "unexpected request" }, { status: 500 });
  };

  const env = {
    DB: db,
    AUDIO_BUCKET: bucket,
    ELEVENLABS_API_KEY: "test-key",
    ELEVENLABS_VOICE_ID: "test-voice",
    ELEVENLABS_MODEL_ID: "eleven_turbo_v2",
  };

  const first = await generateWordAudio(env, "permit");
  assert.equal(first.ipa, "pəˈmɪt");
  assert.equal(first.pos, "他");
  assert.match(first.url, /^\/mcp-viewer\/api\/audio\/permit\/primary\?v=/);

  const stored = await db
    .prepare("SELECT object_key AS objectKey, voice_id AS voiceId FROM word_audio WHERE word_id = 'permit'")
    .first();
  assert.equal(stored.voiceId, "test-voice");
  assert.ok(await bucket.head(stored.objectKey));
  assert.equal(
    (await db.prepare("SELECT COUNT(*) AS count FROM word_audio_jobs WHERE word_id = 'permit'").first()).count,
    0
  );

  const served = await serveWordAudio(
    new Request("https://vocab.lrnr.jp/mcp-viewer/api/audio/permit/primary"),
    env,
    "permit",
    "primary"
  );
  assert.equal(served.status, 200);
  assert.equal(served.headers.get("content-type"), "audio/mpeg");
  assert.deepEqual([...new Uint8Array(await served.arrayBuffer())], [7, 8, 9, 1]);

  const previousObjectKey = stored.objectKey;
  await db.prepare("UPDATE words SET pronunciation = ? WHERE id = 'permit'").bind("/pɚˈmɪt/").run();
  assert.equal(
    (await db.prepare("SELECT is_stale AS isStale FROM word_audio WHERE word_id = 'permit'").first()).isStale,
    1
  );
  assert.equal(
    (await db.prepare("SELECT COUNT(*) AS count FROM word_audio_jobs WHERE word_id = 'permit'").first()).count,
    1
  );
  await generateWordAudio(env, "permit");
  assert.equal(await bucket.head(previousObjectKey), null);
  assert.equal(
    (await db.prepare("SELECT ipa FROM word_audio WHERE word_id = 'permit'").first()).ipa,
    "pɚˈmɪt"
  );
  assert.equal(
    (await db.prepare("SELECT COUNT(*) AS count FROM word_audio_jobs WHERE word_id = 'permit'").first()).count,
    0
  );
} finally {
  globalThis.fetch = originalFetch;
  await miniflare.dispose();
  rmSync(stateDir, { recursive: true, force: true });
}

console.log("word audio integration tests passed");
