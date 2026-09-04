# AGENTS.md

## Cursor Cloud specific instructions

このリポジトリは英単語帳（vocabulary）Webアプリで、次の2つで構成されます。

- `worker/` — Cloudflare Workers 上のバックエンドAPI（`worker/src/index.js`）。`/api/*` を処理し、それ以外は `public/` の静的アセットを配信する。DBは Cloudflare D1（SQLite、バインディング名 `DB`、DB名 `vocab-db`）。
- `public/` — フレームワークなしの静的フロントエンド（ビルド不要）。編集UIは `public/setting/`。

### 開発時の起動（すべて `worker/` ディレクトリで実行）

標準コマンドは `worker/package.json` の scripts を参照。

- 依存インストール: `npm install`
- ローカルD1マイグレーション適用: `npm run db:migrate:local`
- 開発サーバー起動: `npm run dev`（`wrangler dev`。API・静的アセット・ローカルD1を1プロセスで提供）

### 非自明な注意点（gotchas）

- 起動後のURLは `http://localhost:8787`。編集UIは `http://localhost:8787/setting/`（`/setting/index.html` は `/setting/` へ307リダイレクトされる）。ルート `/` は「閲覧ページ準備中」のプレースホルダ。
- **ローカルでは初回に必ず `npm run db:migrate:local` を実行する**こと。未適用だと全 `/api/*` のDBクエリが失敗する。マイグレーションは `worker/migrations/` にあり、`wrangler dev` を起動する前に適用する。
- ローカルD1の実体は `worker/.wrangler/`（gitignore対象）に保存される。データを初期化したい場合はこのディレクトリを消して再マイグレーションする。
- ローカルでは同一オリジンで動くため CORS 設定は不要。`public/shared/config.js` が `localhost`/`127.0.0.1` を検出して相対パス `/api` を使い、Workerも localhost オリジンを自動許可する。`wrangler.toml` の `ALLOWED_ORIGINS` は本番（GitHub Pages）向け。
- リモートデプロイ（`npm run deploy` / `npm run db:migrate:remote`）には Cloudflare の認証情報（`CLOUDFLARE_API_TOKEN` 等）が必要。ローカルのE2Eテストには不要。
- テスト・Lint・ビルドのツールはリポジトリに存在しない（テストフレームワーク・リンタ設定・フロントのビルド工程なし）。
