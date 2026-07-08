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
