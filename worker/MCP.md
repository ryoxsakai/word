# Vocabulary MCP

## 接続先

| 接続先 | 用途 | 認証 |
| --- | --- | --- |
| `https://vocab.lrnr.jp/mcp` | 単語帳の検索・閲覧・編集・監査 | 現在は一時的にすべて認証なし |
| `https://vocab.lrnr.jp/mcp-write` | 単語帳の閲覧・編集・監査 | 現在は一時的にすべて認証なし |

通常は `/mcp` だけを接続します。現在は `MCP_ALLOW_ANONYMOUS_WRITES = "true"` により、`/mcp` と `/mcp-write` の両方で検索・閲覧・編集・監査ツールを認証なしで利用できます。各ツールには互換性のため `vocab.` 接頭辞付きの別名もあります。

この一時運用を終了するときは、`wrangler.toml` の `MCP_ALLOW_ANONYMOUS_WRITES` を `"false"` に変更してデプロイします。`/mcp` の編集・監査ツールと `/mcp-write` の全ツールが再びOAuth必須になります。OAuth実装とSecretは残してあるため、パスワード保護をすぐに復元できます。

## 編集接続の認証

以下は一時公開を終了した後の `/mcp-write` と `/mcp` の編集・監査ツールに適用されます。認証方式は `works.lrnr.jp` と `exam.lrnr.jp` のMCPと同じです。Cloudflare Zero TrustやGitHub OAuthは使用しません。

1. `/mcp` または `/mcp-write` へ接続すると、ChatGPTが動的クライアント登録を行います。
2. Workerの認可画面で `VOCAB_MCP_API_KEY` を入力します。
3. WorkerがPKCE S256を検証し、認可コードを1回だけ交換します。
4. ChatGPTは有効期間12時間のHMAC署名済みBearerトークンを受け取ります。

APIキーは認可画面での照合にだけ使われ、ChatGPTへ返したりD1へ保存したりしません。認可コードは5分で失効し、正常な交換後に削除されます。

Cloudflare DashboardのWorker `vocab-app` に、次のSecretを設定します。

| Secret | 用途 |
| --- | --- |
| `VOCAB_MCP_API_KEY` | 認可画面で入力する本人確認用APIキー |
| `VOCAB_MCP_SESSION_SECRET` | トークンのHMAC署名鍵。32バイト以上のランダム値を推奨 |

`wrangler.toml` の `keep_vars = true` により、Dashboardで管理するSecretはGitHub Actionsからのデプロイでも保持されます。どちらかのSecretがない場合、認証は失敗して編集処理は実行されません。

## 認証ページの任意のログイン保持

`/oauth/authorize` に「このブラウザーでログイン状態を保持する（30日間）」を追加します。初回は未選択です。選択して正しいAPIキーで認証した場合だけ、次回からAPIキーの入力を省略します。接続先・権限の確認と「接続を許可」の送信は毎回必要です。共有端末では選択しないでください。

- APIキーやパスワードをlocalStorage・Cookie・D1に保存しません。ブラウザーには32バイトのランダムな識別子を `__Host-vocab-oauth-session` Cookieとして保存し、D1にはそのSHA-256ハッシュだけを保存します
- Cookieは `Secure; HttpOnly; SameSite=Lax; Path=/`、Domain指定なしです。HTTPSが必要です。保持期限は開始時から30日で、再利用しても延長しません
- 記憶済みの認証ページでチェックを外して続行すると、そのブラウザーの保持を解除します。認証ページの解除リンク、または `/oauth/logout` からも解除できます。GETは確認画面を表示し、CSRF検証付きPOSTでD1上のセッションを失効させます
- APIキーまたは既存の署名Secretを変更した場合も保持セッションは無効になります。新しいSecretの追加は不要です
- 送信フォームは10分間・1回限りです。ブラウザー、認可要求（接続先・PKCE・権限・state）、その時点の保持セッションに紐付けます。別タブのフォームはそれぞれ使えますが、送信済み・期限切れ・ログイン状態が変わったフォームは開き直してください
- POSTは同一オリジンのフォームのみ受け付けます。認証ページのReferrer-Policyは `same-origin` とし、クロスオリジンの接続先にはRefererを送りません
- このCookieはAPIやMCPのBearerトークンの代用になりません。MCPの12時間、編集ページの7日間の既存トークン有効期間・PKCE・権限は変更しません
- 解除後も発行済みのChatGPT・編集ページのBearerトークンは各有効期限まで有効です。編集ページの既存のトークン保存方法や一時的な匿名編集設定も変更しません

### 反映前の条件

`migrations/0059_oauth_browser_sessions.sql` を適用してからWorkerをデプロイしてください。保持セッションと1回限りのフォーム用テーブルを追加するため、未適用では認証ページを利用できません。既存の `/oauth/*` Routeで解除画面も処理できます。マイグレーション・デプロイ・本番設定変更は別途承認された作業として行ってください。

ローカル検証は `npm run test:oauth` と `npm run test:mcp-write` で実行できます。前者は一時D1でチェックのオン・オフ、再利用、固定期限、解除、Secret変更、CSRF、Origin・接続先の検証、二重送信、失敗時の拒否と既存の編集トークン動作を確認します。

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

### 実ブラウザーでの合成HTTPS検証

`npm run test:oauth-browser` はPlaywrightのChromiumで認証画面を検証します。初回は `npx playwright install chromium` が必要です。全HTTPリクエストをテスト内で処理または拒否し、架空のHTTPSドメイン・ダミーAPIキー・一時D1だけを使います。本番への接続や本物のログイン保持は行いません。既定OFF、失敗時の再入力、Cookie属性、接続確認、固定期限、別タブ、キー変更、解除と古いフォームの拒否を確認します。PRの `OAuth browser authentication checks` がこの検証とWorker bundle確認を実行し、画面画像を保存します。
