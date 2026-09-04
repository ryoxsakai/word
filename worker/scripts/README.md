# 単語の意味(senses)メンテ用スクリプト

`senses`（単語の意味）に関する2つのヘルパーがあります。用途に応じて選んでください。

| スクリプト | 用途 |
|---|---|
| `translate-meanings.mjs`（`npm run translate:meanings`） | 既存の**英語の意味をそのまま日本語に翻訳**する（意味の構成は変えない） |
| `regenerate-senses.mjs`（`npm run regenerate:senses`） | 意味を**いったん消し、単語帳向けの語義・品詞をAIで作り直す**（見出しチェック・動詞の自他分割つき） |

どちらも「APIから読み取るだけ／DBには直接書き込まず、`senses` だけを更新するSQLを生成」という安全設計です。生成SQLはあなた自身の wrangler 認証で適用します。

---

# scripts/translate-meanings.mjs

単語の意味（`senses.meaning`）に英語の辞書定義（`api.dictionaryapi.dev` 由来。先頭に「（辞書・英）」が付く）が
入っている場合に、それを**日本語に翻訳する**ためのヘルパーです。

## 安全設計

1. 公開APIから単語・意味を**読み取るだけ**。DBには直接書き込みません。
2. 翻訳結果は `senses` テーブルの `meaning` 列だけを更新する `UPDATE` 文（SQLファイル）として出力します。
   発音・タグ・例文など他のデータには一切触れないので安全です。
3. すでに日本語になっている意味は自動でスキップします（冪等・繰り返し実行可）。

## 使い方

すべて `worker/` ディレクトリで実行します。

```bash
# 1) まずローカルの dev サーバー相手に動作確認
npm run dev            # 別ターミナルで
node scripts/translate-meanings.mjs --base-url http://localhost:8787

# 2) 本番の全単語を翻訳プレビュー＋SQL生成（この時点では本番DBは変更されない）
BASE_URL=https://vocab-app.ryoxsakai.workers.dev node scripts/translate-meanings.mjs

# 3) 生成された SQL を、自分の wrangler 認証で本番へ適用
npx wrangler d1 execute vocab-db --remote --file=translate-meanings.sql
#   （先にローカルで確認したい場合は --remote の代わりに --local）
```

## 翻訳プロバイダ

| provider | 品質 | APIキー | 備考 |
|---|---|---|---|
| `openai` | 高（単語帳向けに簡潔な和訳）**推奨** | 要 `OPENAI_API_KEY` | OpenAI互換エンドポイント。`OPENAI_BASE_URL` / `TRANSLATE_MODEL` で変更可 |
| `mymemory` | 中（無料MT。長い定義は直訳的で誤訳もあり） | 不要 | 動作確認・お試し用の既定 |

`OPENAI_API_KEY` があれば `openai`、なければ `mymemory` を自動採用します。明示指定は `--provider openai` または `TRANSLATE_PROVIDER=openai`。

```bash
OPENAI_API_KEY=sk-... TRANSLATE_PROVIDER=openai \
  BASE_URL=https://vocab-app.ryoxsakai.workers.dev \
  node scripts/translate-meanings.mjs
```

## 主なオプション

| オプション / 環境変数 | 既定 | 説明 |
|---|---|---|
| `--base-url` / `BASE_URL` | `http://localhost:8787` | API のベースURL |
| `--list` / `LIST_ID` | `__master__` | 対象リストID（`__master__` は全単語） |
| `--provider` / `TRANSLATE_PROVIDER` | 自動 | `openai` または `mymemory` |
| `--out` / `OUT_FILE` | `translate-meanings.sql` | 生成するSQLファイル |
| `--limit` | 無制限 | 処理する単語数の上限（お試し用） |

---

# scripts/regenerate-senses.mjs

意味を**いったん消して、単語帳向けの意味・品詞をAIに作り直させる**ためのスクリプトです。

- 目立つ意味は**見出し語**として `is_primary=1` を立てる
- **動詞は自動詞（`自動`）／他動詞（`他動`）に分割**する
- 実行前に、現在の `senses` を JSON バックアップ（`senses-backup.json`）に保存
- 生成結果は `senses` を作り直す `DELETE + INSERT` のSQLとして出力（他テーブルには触れない）

## 使い方

```bash
# 本番の全単語をAIで作り直し → プレビュー＋バックアップ＋SQL生成（DBは変更しない）
OPENAI_API_KEY=sk-... BASE_URL=https://vocab-app.ryoxsakai.workers.dev npm run regenerate:senses

# 生成SQLを適用（自分のwrangler認証で。破壊的変更なので backup と D1 Time Travel を推奨）
npx wrangler d1 execute vocab-db --remote --file=regenerate-senses.sql
```

## プロバイダ

| provider | 説明 | APIキー |
|---|---|---|
| `openai` | OpenAI互換のchat completions（JSON出力）。`OPENAI_BASE_URL` / `GEN_MODEL` で変更可 | 要 `OPENAI_API_KEY` |
| `file` | 事前生成/手動キュレーションした結果JSON（`--samples`）を使う。動作確認・レビュー用 | 不要 |

`--samples` のJSON形式:

```json
{
  "grow": [
    { "pos": "自動", "meaning": "成長する、育つ", "isPrimary": true },
    { "pos": "他動", "meaning": "（作物を）栽培する", "isPrimary": true }
  ]
}
```

## 主なオプション

| オプション / 環境変数 | 既定 | 説明 |
|---|---|---|
| `--base-url` / `BASE_URL` | `http://localhost:8787` | API のベースURL |
| `--list` / `LIST_ID` | `__master__` | 対象リストID |
| `--provider` / `GEN_PROVIDER` | 自動 | `openai` / `file` |
| `--samples` / `SAMPLES` | なし | `file` プロバイダで使う生成結果JSON |
| `--out` / `OUT_FILE` | `regenerate-senses.sql` | 生成するSQLファイル |
| `--backup` / `BACKUP_FILE` | `senses-backup.json` | 現在のsensesのバックアップ出力先 |
| `--limit` | 無制限 | 処理する単語数の上限（お試し用） |

## 品詞ラベルについて

既存データは `名 / 形 / 副 / 前 / 動 …` の1文字表記です。本スクリプトは動詞を `自動` / `他動` に分けて出力します（プロンプトで調整可能）。`自` / `他` などの表記に変えたい場合は `SYSTEM_RULES` を編集してください。
