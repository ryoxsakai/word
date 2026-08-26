# Vocabulary MCP

## 接続先

| 接続先 | 用途 | 認証 |
| --- | --- | --- |
| `https://vocab.lrnr.jp/mcp` | 単語帳の検索・閲覧 | なし |
| `https://vocab.lrnr.jp/mcp-write` | 単語帳の閲覧・編集・監査 | Worker内蔵OAuth 2.1 |

公開接続は読み取り専用ツールだけを公開します。編集接続は閲覧ツールに加え、編集ツールと監査ツールを公開します。各ツールには互換性のため `vocab.` 接頭辞付きの別名もあります。

## 編集接続の認証

認証方式は `works.lrnr.jp` と `exam.lrnr.jp` のMCPと同じです。Cloudflare Zero TrustやGitHub OAuthは使用しません。

1. ChatGPTが動的クライアント登録を行います。
2. Workerの認可画面で `VOCAB_MCP_API_KEY` を入力します。
3. WorkerがPKCE S256を検証し、認可コードを1回だけ交換します。
4. ChatGPTは有効期間1時間のHMAC署名済みBearerトークンを受け取ります。

APIキーは認可画面での照合にだけ使われ、ChatGPTへ返したりD1へ保存したりしません。認可コードは5分で失効し、正常な交換後に削除されます。

Cloudflare DashboardのWorker `vocab-app` に、次のSecretを設定します。

| Secret | 用途 |
| --- | --- |
| `VOCAB_MCP_API_KEY` | 認可画面で入力する本人確認用APIキー |
| `VOCAB_MCP_SESSION_SECRET` | 1時間トークンのHMAC署名鍵。32バイト以上のランダム値を推奨 |

`wrangler.toml` の `keep_vars = true` により、Dashboardで管理するSecretはGitHub Actionsからのデプロイでも保持されます。どちらかのSecretがない場合、認証は失敗して編集処理は実行されません。

## Cloudflare Routes

GitHub Pagesで配信しているWeb画面を維持するため、ドメイン全体をWorkerへ向けません。Cloudflare Dashboardの **Workers & Pages → vocab-app → Settings → Domains & Routes** で、次の3つだけをWorker Routeとして設定します。

| Route | 用途 |
| --- | --- |
| `vocab.lrnr.jp/mcp*` | 公開MCPと編集MCP |
| `vocab.lrnr.jp/oauth/*` | 登録・認可・トークン発行 |
| `vocab.lrnr.jp/.well-known/oauth-*` | OAuthメタデータ |

## 権限と安全策

| Scope | 許可内容 |
| --- | --- |
| `vocab:read` | 編集接続での検索・閲覧・監査 |
| `vocab:write` | 作成・更新・並べ替え・単語帳からの取り外し |

単語マスターの完全削除は公開しません。`remove_words_from_notebook` は単語帳からの所属だけを外し、実行時には単語帳名の完全一致による確認が必要です。編集は `mcp_audit_log` に記録されます。

## 編集ツール

| 対象 | ツール |
| --- | --- |
| 単語帳 | `create_notebook`, `update_notebook`, `reorder_notebooks` |
| チャプター | `create_chapter`, `update_chapter`, `reorder_chapters` |
| セクション | `create_section`, `update_section`, `reorder_sections` |
| ラベル | `create_label`, `update_label`（`move_words` の `label_id` で語を割り当て） |
| 単語 | `create_words`, `update_word`, `add_words_to_notebook`, `move_words`, `remove_words_from_notebook` |
| 監査 | `list_recent_changes` |

`create_words` は1回に30語まで作成でき、語義・例文・派生語・タグ・注意フラグ・派生語ファミリーを扱います。既存スペルは上書きせず、明示的な部分更新には `update_word` を使用します。

## テスト

`worker` ディレクトリで次を実行します。

```sh
npm run test:mcp-write
```

テストは一時D1を使用し、OAuthメタデータ、動的クライアント登録、認可画面、APIキー拒否、PKCE、認可コードの再利用拒否、匿名アクセス拒否、全編集ツール、重複保護、派生語番号、確認操作、監査ログを検証します。
