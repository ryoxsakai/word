import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";

const db = new DatabaseSync(":memory:");
db.exec(`
  CREATE TABLE derivatives (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    word_id TEXT NOT NULL,
    pos TEXT,
    word TEXT NOT NULL,
    meaning TEXT,
    sort_order INTEGER NOT NULL DEFAULT 0
  );
  INSERT INTO derivatives (word_id, pos, word, meaning, sort_order)
  VALUES
    ('vary', '形・名', 'variable', '変わりやすい・変数', 1),
    ('society', '自・他', 'socialize', '社会化する，交流する', 2),
    ('vary', '名', 'variation', '変化', 3);
`);

db.exec(readFileSync(new URL("../migrations/0029_split_derivative_senses.sql", import.meta.url), "utf8"));

assert.deepEqual(
  db.prepare("SELECT pos, word, meaning FROM derivatives WHERE word_id = 'vary' AND word = 'variable' ORDER BY id").all().map((row) => ({ ...row })),
  [
    { pos: "形", word: "variable", meaning: "変わりやすい" },
    { pos: "名", word: "variable", meaning: "変数" },
  ]
);
assert.deepEqual(
  db.prepare("SELECT pos, meaning FROM derivatives WHERE word_id = 'society' ORDER BY id").all().map((row) => ({ ...row })),
  [
    { pos: "自", meaning: "交流する" },
    { pos: "他", meaning: "社会化する" },
  ]
);
assert.equal(db.prepare("SELECT COUNT(*) AS count FROM derivatives WHERE pos LIKE '%・%'").get().count, 0);
assert.equal(db.prepare("SELECT meaning FROM derivatives WHERE word = 'variation'").get().meaning, "変化");

console.log("migration 0029 smoke test passed");
