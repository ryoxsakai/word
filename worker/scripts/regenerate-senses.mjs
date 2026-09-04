#!/usr/bin/env node
// 単語の意味(senses)を「いったん消して、単語帳向けの意味・品詞をAIで作り直す」ためのヘルパー。
//
// できること:
//   - 各単語について、単語帳に載りそうな日本語の意味・品詞をLLMに生成させる
//   - 目立つ意味は「見出し語」(is_primary=1) としてマーク
//   - 動詞は自動詞(自動)／他動詞(他動)に分ける
//
// 設計方針（安全第一。translate-meanings.mjs と同じ思想）:
//   1. 公開APIから単語・現在の意味を「読み取るだけ」。DBには直接書き込まない。
//   2. 実行前に、現在の senses を JSON バックアップとして書き出す（復元用）。
//   3. 生成結果は senses テーブルだけを作り直す SQL（DELETE + INSERT）として出力する。
//      他テーブル（発音・タグ・例文・派生語など）には一切触れない。
//   4. 生成SQLは、あなた自身の wrangler 認証で適用する:
//        npx wrangler d1 execute vocab-db --remote --file=regenerate-senses.sql
//      （※ 破壊的な変更です。適用前に backup(JSON) と D1 の Time Travel でのバックアップを推奨）
//
// senses テーブルの想定スキーマ（本番）:
//   id(自動採番), word_id, pos, meaning, pronunciation, is_primary, sort_order
//
// 使い方:
//   # 本番の全単語を対象にAI生成 → プレビュー＋バックアップ＋SQL生成（DBは変更しない）
//   OPENAI_API_KEY=sk-... BASE_URL=https://vocab-app.ryoxsakai.workers.dev \
//     node scripts/regenerate-senses.mjs
//   # 生成SQLを本番へ適用（自分のwrangler認証で）
//   npx wrangler d1 execute vocab-db --remote --file=regenerate-senses.sql
//
// プロバイダ:
//   openai : OpenAI互換 chat completions（JSON出力）。要 OPENAI_API_KEY。OPENAI_BASE_URL / GEN_MODEL で変更可
//   file   : 事前に用意した生成結果JSON( --samples ファイル )を使う。手動キュレーションや動作確認用
//            形式: { "<wordId>": [ {"pos":"他動","meaning":"...","isPrimary":true}, ... ], ... }

import { writeFile, readFile } from "node:fs/promises";

function parseArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith("--")) {
      const key = a.slice(2);
      const next = argv[i + 1];
      if (next === undefined || next.startsWith("--")) args[key] = true;
      else { args[key] = next; i++; }
    }
  }
  return args;
}

const args = parseArgs(process.argv.slice(2));
const BASE_URL = (args["base-url"] || process.env.BASE_URL || "http://localhost:8787").replace(/\/$/, "");
const LIST_ID = args["list"] || process.env.LIST_ID || "__master__";
const OUT_FILE = args["out"] || process.env.OUT_FILE || "regenerate-senses.sql";
const BACKUP_FILE = args["backup"] || process.env.BACKUP_FILE || "senses-backup.json";
const LIMIT = args["limit"] ? parseInt(args["limit"], 10) : Infinity;
const SAMPLES = args["samples"] || process.env.SAMPLES || null;
const PROVIDER = (args["provider"] || process.env.GEN_PROVIDER || (SAMPLES ? "file" : "openai")).toLowerCase();
const UA = "Mozilla/5.0 vocab-regenerate-script";

async function apiGet(path) {
  const res = await fetch(`${BASE_URL}${path}`, { headers: { "User-Agent": UA } });
  if (!res.ok) throw new Error(`GET ${path} -> ${res.status}`);
  return res.json();
}

function sqlEscape(s) {
  return String(s ?? "").replace(/'/g, "''");
}

// ---- 生成プロバイダ ----
let samplesData = null;
async function loadSamples() {
  if (samplesData) return samplesData;
  const raw = await readFile(SAMPLES, "utf8");
  samplesData = JSON.parse(raw);
  return samplesData;
}

async function generateFromFile(word) {
  const data = await loadSamples();
  const entry = data[word.id] || data[word.spelling];
  if (!entry) return null;
  const senses = Array.isArray(entry) ? entry : entry.senses;
  return senses || null;
}

const SYSTEM_RULES = [
  "あなたは日本の英単語帳の編集者です。指定された英単語について、日本の学習者向け単語帳に載せる語義を作成します。",
  "出力は必ずJSONオブジェクト {\"senses\":[{\"pos\":string,\"meaning\":string,\"isPrimary\":boolean}]} だけにしてください。",
  "ルール:",
  "- meaning は簡潔で自然な日本語の語義（単語帳風）。1つの語義に近い意味をまとめてよい（例: 「放棄する、見捨てる」）。",
  "- pos は日本語の短い品詞ラベル: 名 / 形 / 副 / 前 / 接 / 代 / 間 / 助動 など。",
  "- 動詞は必ず自動詞と他動詞を分け、pos は「自動」または「他動」にする（両方の用法があれば別エントリにする）。",
  "- isPrimary は、その単語で最も代表的・試験頻出で、単語帳の見出しに出すべき意味に true（通常1〜2個）。他は false。",
  "- 語義は多すぎないように、重要なものを3〜5個程度に絞る。",
].join("\n");

async function generateFromOpenAI(word) {
  const key = process.env.OPENAI_API_KEY;
  if (!key) throw new Error("OPENAI_API_KEY is required for provider=openai");
  const base = (process.env.OPENAI_BASE_URL || "https://api.openai.com/v1").replace(/\/$/, "");
  const model = process.env.GEN_MODEL || "gpt-4o-mini";
  const userMsg = `英単語: ${word.spelling}\n発音: ${word.pronunciation || "?"}\n参考(既存の英語定義): ${(word._englishHint || "").slice(0, 400)}`;
  const res = await fetch(`${base}/chat/completions`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
    body: JSON.stringify({
      model,
      response_format: { type: "json_object" },
      temperature: 0.3,
      messages: [
        { role: "system", content: SYSTEM_RULES },
        { role: "user", content: userMsg },
      ],
    }),
  });
  if (!res.ok) throw new Error(`openai ${res.status}: ${await res.text()}`);
  const data = await res.json();
  const content = data?.choices?.[0]?.message?.content;
  if (!content) throw new Error("openai: empty content");
  const parsed = JSON.parse(content);
  return parsed.senses || null;
}

async function generate(word) {
  if (PROVIDER === "file") return generateFromFile(word);
  if (PROVIDER === "openai") return generateFromOpenAI(word);
  throw new Error(`unknown provider: ${PROVIDER}`);
}

async function main() {
  console.log(`[config] base=${BASE_URL} list=${LIST_ID} provider=${PROVIDER} out=${OUT_FILE}`);
  const listWords = await apiGet(`/api/lists/${encodeURIComponent(LIST_ID)}/words`);
  const words = Array.isArray(listWords) ? listWords : listWords.words || [];
  console.log(`[scan] ${words.length} words in list "${LIST_ID}"`);

  const backup = {};
  const sqlParts = [];
  let processed = 0;
  let regenerated = 0;

  for (const w of words) {
    if (processed >= LIMIT) break;
    const detail = await apiGet(`/api/words/${encodeURIComponent(w.id)}`);
    processed++;
    // 復元用に現在の senses を控える
    backup[w.id] = (detail.senses || []).map((s) => ({
      pos: s.pos, meaning: s.meaning, pronunciation: s.pronunciation ?? null,
      is_primary: s.is_primary ?? 0, sort_order: s.sort_order ?? 0,
    }));
    // 既存の英語定義をLLMのヒントに渡す（あれば）
    w.pronunciation = detail.pronunciation;
    w._englishHint = (detail.senses || []).map((s) => (s.meaning || "").replace(/^（辞書[^）]*）\s*/, "")).join(" | ");

    let senses;
    try {
      senses = await generate(w);
    } catch (err) {
      console.error(`  ! generate failed for ${w.spelling}: ${err.message}`);
      continue;
    }
    if (!senses || senses.length === 0) {
      console.log(`  - ${w.spelling}: 生成結果なし（スキップ）`);
      continue;
    }

    sqlParts.push(`-- ${w.spelling}`);
    sqlParts.push(`DELETE FROM senses WHERE word_id = '${sqlEscape(w.id)}';`);
    senses.forEach((s, i) => {
      const isPrimary = s.isPrimary || s.is_primary ? 1 : 0;
      sqlParts.push(
        `INSERT INTO senses (word_id, pos, meaning, pronunciation, is_primary, sort_order) VALUES ` +
          `('${sqlEscape(w.id)}', '${sqlEscape(s.pos)}', '${sqlEscape(s.meaning)}', NULL, ${isPrimary}, ${i});`
      );
    });
    regenerated++;
    const preview = senses.map((s) => `${s.isPrimary || s.is_primary ? "★" : "・"}${s.pos}:${s.meaning}`).join(" / ");
    console.log(`  [${w.spelling}] ${preview}`);
  }

  console.log(`\n[result] processed words: ${processed}, regenerated: ${regenerated}`);
  if (regenerated === 0) {
    console.log("生成対象がありませんでした。");
    return;
  }

  await writeFile(BACKUP_FILE, JSON.stringify(backup, null, 2), "utf8");
  const sql =
    "-- 自動生成: senses を作り直す（英語定義を消し、単語帳向けの日本語語義・品詞を投入）\n" +
    "-- ★は is_primary=1（見出し語）。動詞は 自動/他動 に分割。\n" +
    "-- 適用: npx wrangler d1 execute vocab-db --remote --file=" + OUT_FILE + "\n" +
    "-- 復元用に " + BACKUP_FILE + " に現在の senses を保存済み。\n\n" +
    sqlParts.join("\n") + "\n";
  await writeFile(OUT_FILE, sql, "utf8");
  console.log(`\nバックアップ: ${BACKUP_FILE}`);
  console.log(`SQL: ${OUT_FILE}`);
  console.log("適用（本番）:");
  console.log(`  npx wrangler d1 execute vocab-db --remote --file=${OUT_FILE}`);
  console.log("（先にローカル確認する場合は --remote の代わりに --local）");
}

main().catch((err) => { console.error(err); process.exit(1); });
