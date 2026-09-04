#!/usr/bin/env node
// 単語の「意味(senses.meaning)」に英語の辞書定義が入っている場合に、
// 日本語へ翻訳するためのヘルパー。
//
// 設計方針（安全第一）:
//   1. 公開APIから単語・意味を「読み取るだけ」。DBには一切書き込まない。
//   2. 翻訳結果は senses テーブルの meaning 列だけを更新する UPDATE 文（SQLファイル）として出力する。
//      → 他のカラム（発音・タグ・例文など）には一切触れないので安全。
//   3. 生成された SQL は、あなた自身の wrangler 認証で本番へ適用する:
//        npx wrangler d1 execute vocab-db --remote --file=translate-meanings.sql
//      （ローカル確認は --local を付ける）
//
// 使い方の例:
//   # ローカルのdevサーバーに対して（まず動作確認）
//   node scripts/translate-meanings.mjs --base-url http://localhost:8787
//   # 本番の全単語（マスターリスト）を対象に、翻訳プレビュー＋SQL生成（DBは変更しない）
//   BASE_URL=https://vocab-app.ryoxsakai.workers.dev node scripts/translate-meanings.mjs
//   # OpenAI互換のLLMで高品質翻訳（推奨）
//   OPENAI_API_KEY=sk-... TRANSLATE_PROVIDER=openai node scripts/translate-meanings.mjs
//
// 翻訳プロバイダ:
//   - openai  : OpenAI互換のchat completions。単語帳向けに簡潔な和訳を生成（推奨・要APIキー）
//   - mymemory: 無料・APIキー不要の機械翻訳（動作確認用。品質は openai に劣る）
//   OPENAI_API_KEY が設定されていれば openai、なければ mymemory を既定採用。

import { writeFile } from "node:fs/promises";

// ---- 引数・環境変数 ----
function parseArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith("--")) {
      const key = a.slice(2);
      const next = argv[i + 1];
      if (next === undefined || next.startsWith("--")) {
        args[key] = true;
      } else {
        args[key] = next;
        i++;
      }
    }
  }
  return args;
}

const args = parseArgs(process.argv.slice(2));
const BASE_URL = (args["base-url"] || process.env.BASE_URL || "http://localhost:8787").replace(/\/$/, "");
const LIST_ID = args["list"] || process.env.LIST_ID || "__master__";
const OUT_FILE = args["out"] || process.env.OUT_FILE || "translate-meanings.sql";
const LIMIT = args["limit"] ? parseInt(args["limit"], 10) : Infinity;
const PROVIDER = (args["provider"] || process.env.TRANSLATE_PROVIDER || (process.env.OPENAI_API_KEY ? "openai" : "mymemory")).toLowerCase();
// 「（辞書・英）」のような、翻訳前に取り除く先頭ラベル。
const STRIP_PREFIX_RE = /^（辞書[^）]*）\s*/;

const UA = "Mozilla/5.0 vocab-translate-script";

function hasJapanese(s) {
  return /[\u3040-\u309f\u30a0-\u30ff\u4e00-\u9fff]/.test(s || "");
}

async function apiGet(path) {
  const res = await fetch(`${BASE_URL}${path}`, { headers: { "User-Agent": UA } });
  if (!res.ok) throw new Error(`GET ${path} -> ${res.status}`);
  return res.json();
}

// ---- 翻訳プロバイダ ----
async function translateMyMemory(text) {
  const url = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(text)}&langpair=en|ja`;
  const res = await fetch(url, { headers: { "User-Agent": UA } });
  if (!res.ok) throw new Error(`mymemory ${res.status}`);
  const data = await res.json();
  const out = data?.responseData?.translatedText;
  if (!out) throw new Error("mymemory: empty translation");
  return out.trim();
}

async function translateOpenAI(text, ctx) {
  const key = process.env.OPENAI_API_KEY;
  if (!key) throw new Error("OPENAI_API_KEY is required for provider=openai");
  const base = (process.env.OPENAI_BASE_URL || "https://api.openai.com/v1").replace(/\/$/, "");
  const model = process.env.TRANSLATE_MODEL || "gpt-4o-mini";
  const prompt =
    `次は英単語「${ctx.spelling}」（品詞: ${ctx.pos || "?"}）の英語辞書定義です。` +
    `これを、単語帳の語義として自然で簡潔な日本語に訳してください。` +
    `訳語のみを出力し、余計な説明・引用符・記号は付けないでください。\n\n定義: ${text}`;
  const res = await fetch(`${base}/chat/completions`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
    body: JSON.stringify({
      model,
      messages: [{ role: "user", content: prompt }],
      temperature: 0.2,
    }),
  });
  if (!res.ok) throw new Error(`openai ${res.status}: ${await res.text()}`);
  const data = await res.json();
  const out = data?.choices?.[0]?.message?.content?.trim();
  if (!out) throw new Error("openai: empty translation");
  return out;
}

async function translate(text, ctx) {
  if (PROVIDER === "openai") return translateOpenAI(text, ctx);
  if (PROVIDER === "mymemory") return translateMyMemory(text);
  throw new Error(`unknown provider: ${PROVIDER}`);
}

function sqlEscape(s) {
  return String(s).replace(/'/g, "''");
}

async function main() {
  console.log(`[config] base=${BASE_URL} list=${LIST_ID} provider=${PROVIDER} out=${OUT_FILE}`);
  const listWords = await apiGet(`/api/lists/${encodeURIComponent(LIST_ID)}/words`);
  const words = Array.isArray(listWords) ? listWords : listWords.words || [];
  console.log(`[scan] ${words.length} words in list "${LIST_ID}"`);

  const updates = [];
  let scannedSenses = 0;
  let processedWords = 0;

  for (const w of words) {
    if (processedWords >= LIMIT) break;
    const detail = await apiGet(`/api/words/${encodeURIComponent(w.id)}`);
    processedWords++;
    for (const s of detail.senses || []) {
      scannedSenses++;
      const raw = (s.meaning || "").trim();
      const stripped = raw.replace(STRIP_PREFIX_RE, "").trim();
      if (!stripped) continue;
      // すでに日本語なら対象外（冪等・安全）。
      if (hasJapanese(stripped)) continue;

      let ja;
      try {
        ja = await translate(stripped, { spelling: detail.spelling, pos: s.pos });
      } catch (err) {
        console.error(`  ! translate failed for ${detail.spelling} (sense ${s.id}): ${err.message}`);
        continue;
      }
      updates.push({ id: s.id, before: raw, after: ja });
      console.log(`  [${detail.spelling}] ${stripped.slice(0, 45)}  =>  ${ja}`);
    }
  }

  console.log(`\n[result] scanned senses: ${scannedSenses}, translations: ${updates.length}`);

  if (updates.length === 0) {
    console.log("翻訳対象（英語の意味）はありませんでした。");
    return;
  }

  const sql =
    "-- 自動生成: senses.meaning を英語→日本語に更新\n" +
    "-- 適用: npx wrangler d1 execute vocab-db --remote --file=" + OUT_FILE + "\n" +
    updates.map((u) => `UPDATE senses SET meaning = '${sqlEscape(u.after)}' WHERE id = ${u.id};`).join("\n") +
    "\n";
  await writeFile(OUT_FILE, sql, "utf8");
  console.log(`\nSQLを書き出しました: ${OUT_FILE}`);
  console.log("次のコマンドで適用できます（本番）:");
  console.log(`  npx wrangler d1 execute vocab-db --remote --file=${OUT_FILE}`);
  console.log("（まずローカルで確認する場合は --remote の代わりに --local）");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
