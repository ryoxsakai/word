import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";

const originalTitles = [
  "重要・程度", "変化・状態", "発生・生産", "因果・論理", "思考・認識", "言語・伝達", "研究・分析", "科学・技術",
  "生物・生態", "医療・心理", "環境・地理", "数量・範囲", "性質・評価", "行為・選択", "時間・順序", "場所・移動",
  "対立・危機", "社会・文化", "政治・法律", "経済・産業", "動作・操作", "取得・達成", "連携・対抗", "判断・適否",
  "情報・構成", "学習・技能", "地域・慣習", "物質・形状", "特性・様態", "所有・取引", "人物・交流", "日常・身辺",
  "物語・表現", "身体・自然", "重要多義語1：作用・機能", "重要多義語2：特質・様相", "重要多義語3：実体・概念",
  "スペルの似た単語の識別1：一字・母音の違い", "スペルの似た単語の識別2：語尾・同音語", "読解の鍵となる副詞",
];

const expectedTitles = [
  "重要・程度", "数量・範囲", "性質・評価", "判断・適否", "特性・様態", "時間・順序", "場所・移動", "変化・状態",
  "動作・操作", "行為・選択", "発生・生産", "取得・達成", "因果・論理", "思考・認識", "学習・技能", "研究・分析",
  "情報・構成", "言語・伝達", "物語・表現", "科学・技術", "物質・形状", "生物・生態", "環境・地理", "身体・自然",
  "医療・心理", "日常・身辺", "人物・交流", "社会・文化", "地域・慣習", "政治・法律", "連携・対抗", "対立・危機",
  "経済・産業", "所有・取引", "重要多義語1：作用・機能", "重要多義語2：特質・様相", "重要多義語3：実体・概念",
  "スペルの似た単語の識別1：一字・母音の違い", "スペルの似た単語の識別2：語尾・同音語", "読解の鍵となる副詞",
];

const db = new DatabaseSync(":memory:");
db.exec(`
  CREATE TABLE lists (id TEXT PRIMARY KEY);
  CREATE TABLE chapters (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    list_id TEXT NOT NULL,
    subtitle TEXT,
    description TEXT,
    sort_order INTEGER NOT NULL DEFAULT 0
  );
  CREATE TABLE sections (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    list_id TEXT NOT NULL,
    name TEXT NOT NULL DEFAULT '',
    subtitle TEXT,
    description TEXT,
    sort_order INTEGER NOT NULL DEFAULT 0,
    chapter_id INTEGER
  );
  CREATE TABLE section_labels (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    list_id TEXT NOT NULL,
    section_id INTEGER NOT NULL,
    name TEXT NOT NULL,
    sort_order INTEGER NOT NULL DEFAULT 0
  );
  CREATE TABLE list_items (
    list_id TEXT NOT NULL,
    word_id TEXT NOT NULL,
    no INTEGER NOT NULL,
    branch INTEGER NOT NULL DEFAULT 0,
    section_id INTEGER,
    label_id INTEGER,
    PRIMARY KEY (list_id, word_id)
  );
  CREATE UNIQUE INDEX idx_list_items_no_branch ON list_items(list_id, no, branch);
  INSERT INTO lists (id) VALUES ('crossover-v3');
  INSERT INTO chapters (list_id, subtitle, sort_order) VALUES
    ('crossover-v3', '英文読解の基本語彙', 1),
    ('crossover-v3', '文法学習の重要語彙', 2);
`);

const chapter1Id = db.prepare("SELECT id FROM chapters WHERE list_id = 'crossover-v3' AND sort_order = 1").get().id;
const insertSection = db.prepare(
  "INSERT INTO sections (list_id, subtitle, sort_order, chapter_id) VALUES ('crossover-v3', ?, ?, ?)"
);
const insertItem = db.prepare(
  "INSERT INTO list_items (list_id, word_id, no, branch, section_id) VALUES ('crossover-v3', ?, ?, 0, ?)"
);
for (const [index, title] of originalTitles.entries()) {
  const result = insertSection.run(title, index + 1, chapter1Id);
  insertItem.run(`word-${index + 1}`, index + 1, Number(result.lastInsertRowid));
}

db.exec(readFileSync(new URL("../migrations/0030_section_groups.sql", import.meta.url), "utf8"));

assert.deepEqual(
  db.prepare("SELECT subtitle FROM sections WHERE chapter_id = ? ORDER BY sort_order, id").all(chapter1Id).map((row) => row.subtitle),
  expectedTitles
);

assert.deepEqual(
  db.prepare("SELECT subtitle FROM section_groups WHERE chapter_id = ? ORDER BY sort_order, id").all(chapter1Id).map((row) => row.subtitle),
  ["尺度・評価", "状態・動作", "思考・表現", "科学・生命", "生活・社会", "多義・語法"]
);

assert.deepEqual(
  db.prepare(
    `SELECT g.subtitle, COUNT(*) AS sectionCount
     FROM section_groups g JOIN sections s ON s.group_id = g.id
     WHERE g.chapter_id = ? GROUP BY g.id ORDER BY g.sort_order, g.id`
  ).all(chapter1Id).map((row) => ({ ...row })),
  [
    { subtitle: "尺度・評価", sectionCount: 5 },
    { subtitle: "状態・動作", sectionCount: 7 },
    { subtitle: "思考・表現", sectionCount: 7 },
    { subtitle: "科学・生命", sectionCount: 6 },
    { subtitle: "生活・社会", sectionCount: 9 },
    { subtitle: "多義・語法", sectionCount: 6 },
  ]
);

assert.deepEqual(
  db.prepare(
    `SELECT s.subtitle
     FROM list_items li JOIN sections s ON s.id = li.section_id
     WHERE li.list_id = 'crossover-v3' AND li.branch = 0
     ORDER BY li.no`
  ).all().map((row) => row.subtitle),
  expectedTitles
);

console.log("migration 0030 smoke test passed");
