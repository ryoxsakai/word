import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import {
  automaticAudioStatus,
  processAutomaticAudio,
} from "../src/audio-auto-generation.js";

class PreparedStatement {
  constructor(db, sql) {
    this.statement = db.prepare(sql);
    this.values = [];
    this.reader = /^\s*(SELECT|WITH|PRAGMA)\b/i.test(sql);
  }

  bind(...values) {
    this.values = values;
    return this;
  }

  async run() {
    const result = this.statement.run(...this.values);
    return { meta: { changes: Number(result.changes || 0) } };
  }

  async all() {
    return { results: this.statement.all(...this.values) };
  }

  async first() {
    return this.statement.get(...this.values) || null;
  }

  async execute() {
    return this.reader ? this.all() : this.run();
  }
}

function d1Adapter(db) {
  return {
    prepare(sql) {
      return new PreparedStatement(db, sql);
    },
    async batch(statements) {
      return await Promise.all(statements.map((statement) => statement.execute()));
    },
  };
}

const sqlite = new DatabaseSync(":memory:");
sqlite.exec(`
  CREATE TABLE words (
    id TEXT PRIMARY KEY,
    spelling TEXT NOT NULL,
    pronunciation TEXT,
    pronunciation_caution INTEGER NOT NULL DEFAULT 0,
    audio_url TEXT
  );
  CREATE TABLE word_audio (
    word_id TEXT NOT NULL,
    variant_key TEXT NOT NULL DEFAULT 'primary',
    provider TEXT NOT NULL DEFAULT 'elevenlabs',
    is_stale INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY (word_id, variant_key)
  );
  CREATE TABLE list_items (
    list_id TEXT NOT NULL,
    word_id TEXT NOT NULL,
    PRIMARY KEY (list_id, word_id)
  );
`);
sqlite.exec(readFileSync(new URL("../migrations/0025_automatic_word_audio.sql", import.meta.url), "utf8"));
sqlite.exec(readFileSync(new URL("../migrations/0026_crossover_audio_scope.sql", import.meta.url), "utf8"));
sqlite.exec(readFileSync(new URL("../migrations/0027_pronunciation_generation_mode.sql", import.meta.url), "utf8"));

const db = d1Adapter(sqlite);
await db.prepare("INSERT INTO words (id, spelling, pronunciation) VALUES (?, ?, ?)")
  .bind("alpha", "alpha", "/ˈælfə/")
  .run();
await db.prepare("INSERT INTO words (id, spelling, pronunciation) VALUES (?, ?, ?)")
  .bind("broken", "broken", "動 /x/、名 /y/")
  .run();
await db.prepare("INSERT INTO words (id, spelling, pronunciation) VALUES (?, ?, ?)")
  .bind("outside", "outside", "/ˌaʊtˈsaɪd/")
  .run();
await db.prepare("INSERT INTO list_items (list_id, word_id) VALUES (?, ?)")
  .bind("crossover-v3", "alpha")
  .run();
await db.prepare("INSERT INTO list_items (list_id, word_id) VALUES (?, ?)")
  .bind("crossover-v3", "broken")
  .run();

const calls = [];
const fakeGenerate = async (env, wordId) => {
  calls.push(wordId);
  if (wordId === "broken") throw new Error("発音記号が複数あります");
  await env.DB.prepare(
    "DELETE FROM word_audio_jobs WHERE word_id = ? AND variant_key = 'primary'"
  ).bind(wordId).run();
};

const summary = await processAutomaticAudio(
  { DB: db, AUDIO_AUTO_BATCH_SIZE: "5" },
  { generate: fakeGenerate, now: () => 2_000_000_000_000 }
);
assert.deepEqual(calls, ["alpha", "broken"]);
assert.deepEqual(
  { selected: summary.selected, generated: summary.generated, failed: summary.failed },
  { selected: 2, generated: 1, failed: 1 }
);

const retry = await db.prepare(
  "SELECT status, attempts, last_error AS lastError, next_attempt_at AS nextAttemptAt, updated_at AS updatedAt FROM word_audio_jobs WHERE word_id = 'broken'"
).first();
assert.equal(retry.status, "retry");
assert.equal(retry.attempts, 1);
assert.match(retry.lastError, /複数/);
assert.ok(retry.nextAttemptAt > 2_000_000_000);

const status = await automaticAudioStatus({ DB: db });
assert.deepEqual(status, {
  eligible: 2,
  generated: 0,
  queued: 1,
  pending: 0,
  processing: 0,
  retrying: 1,
  recentErrors: [
    {
      wordId: "broken",
      attempts: 1,
      error: "発音記号が複数あります",
      updatedAt: retry.updatedAt,
    },
  ],
});

console.log("automatic word audio integration tests passed");
