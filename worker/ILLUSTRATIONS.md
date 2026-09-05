# crossoverの単語イラスト

基本運用は「チャットのimagegenで1単語につき1枚生成 → ユーザーがその画像にOK → Workerへ取り込み → crossoverに表示」です。画像生成APIを呼ばずに、承認済みのPNGを登録できます。差し替え中や失敗時は現在の画像を保持し、過去の成功画像へ戻せます。

## チャットで生成し、OKの後に登録

この経路はOpenAI APIキーもASSETSバインディングも不要です。D1の0036までのマイグレーションと `ILLUSTRATION_BUCKET` を使います。有料API生成は `ILLUSTRATIONS_ENABLED=false` を既定とし、画像の取り込みは独立して利用できます。

1. Vocabの `get_word_illustration` で対象単語のID、登録語義、`currentId`、共通ルールを含む `suggestedPrompt` と `referencePaths` を取得します。
2. チャットのimagegenで生成します。生成プロンプトとPNGを保持し、ユーザーへ画像と対象単語・語義を提示します。この時点ではWorkerへ送信しません。
3. ユーザーがその画像の登録に明示的なOKを出した後に、`import_word_illustration` を呼びます。一般的な画風への賛同や別の画像へのOKを流用しません。
4. `word_id`、新しいUUIDの `request_id`、`approved: true`、確認時の `expected_current_id`（未登録は `null`）、登録語義と一致する `pos` / `meaning`、`scene` / `avoid`、実際に使用した `prompt`、PNG原本の `image_base64` を渡します。Base64はファイルからコードで読み取ってツール引数へ渡し、チャット本文に表示しません。data URLの先頭部分は付けません。
5. 戻り値の `url` と `current` を確認します。crossoverを再読み込みすると画像が表示されます。

PNGは8MB以下、縦横32〜4096px、アニメーションなし。PNGの構造・チェックサムを検査し、承認時刻、実際の生成プロンプト、画像SHA-256、元の語義を履歴に保存します。生成モデルは推測せず `external` として記録します。取り込み元は `approved-upload`、既存API生成は `api` です。ユーザー承認の有無は呼び出し元が確認し、サーバーはOAuth書き込み権限と `approved:true` を必須にします。

HTTP経路は `POST /mcp-editor/api/illustrations/words/{wordId}/import`。JSONキーは `requestId`、`expectedCurrentId`、`imageBase64` のようにcamelCaseとし、その他はMCPと同じです。OAuth認証が必要です。

通信再送では同じUUID・画像・指示を使ってください。既に登録済みなら同じ画像を返すだけで再公開しません。他の画像に差し替わった後でも、再送で古い画像には戻しません。別の内容へのUUID流用は拒否します。表示中画像が確認時から変わった場合や、対象語に生成・取り込み処理が進行中の場合は競合として拒否します。保存に失敗した依頼は履歴を確認してから新しいUUIDで再登録します。

### 管理画面から登録する場合

`/setting/illustrations.html` → 対象語の「画像の登録・指示・履歴」→ 語義を選択 → PNGを選択 → 実際の生成プロンプトを貼り付け → 画像と語義の確認チェック →「OK・この画像を登録」。プレビュー用に選択した画像は、このボタンを押すまでブラウザ内に留まります。確認チェック後に画像・語義・指示を変更すると、チェックが解除されます。

「チャット用プロンプトをコピー」で共通ルールと単語別指定を取得できます。画風の見本画像も管理画面から開けます。コピー後にチャットで指示を変更した場合は、登録前に実際のプロンプトへ更新してください。

MCPの新しいツールは、Vocab接続側のツール情報更新が必要です。接続に `import_word_illustration` が表示されない場合、またはファイルの大きさが接続先のツール引数上限を超える場合は、管理画面からPNGを登録できます。ローカルファイルのパスだけをWorkerへ送っても、Workerからそのファイルは読めません。

## API生成を別途使う場合

1. Worker `vocab-app` のSecretに `OPENAI_API_KEY` を設定します。キーはブラウザ、Git、通常の変数、チャットに保存しません。
2. `wrangler.toml` の `ILLUSTRATIONS_ENABLED` を `true` にして `main` にマージし、既存のGitHub ActionsでWorkerとPagesを配備します。Worker側のワークフローはマイグレーションを適用し、`vocab-illustrations` バケットを作成して `ILLUSTRATION_BUCKET` に接続します。初回はCloudflareの既存デプロイトークンにR2バケット作成権限が必要です。
3. `/setting/illustrations.html` を開き、既存の編集用OAuthでログインします。API生成ボタンが利用できることを確認します。
4. 最初はkeyまたはsignificantの1語を選び、語義・場面を確認して生成します。既存の毎分Cronが待機中の画像を1件処理します。画面を閉じても処理は続きます。
5. 履歴が「生成済み」になったらcrossoverの対象Sectionを再読み込みし、表示を確認します。Webの既に開いている単語帳は画像の完了をポーリングしません。管理画面は15秒ごとに状態を更新します。

この変更は全語の生成を自動開始しません。APIの利用可能モデル・組織のアクセス権・利用枠・課金は設定先のOpenAIプロジェクトに依存します。ChatGPT内の試作生成とは別のAPI利用です。

ローカルからSecretを設定する場合は、Cloudflare認証を済ませたうえでworkerディレクトリで以下を実行します。

```sh
npx wrangler secret put OPENAI_API_KEY
```

## 構成と運用

| 項目 | 保存先・動作 |
| --- | --- |
| 共通プロンプト | `src/illustration-prompt.js` の `STYLE_PROMPT`。版は `crossover-line-art-v1` |
| 共通見本 | `public/shared/illustration-references/v1-key.png` と `v1-significant.png`。今回の試作画像。画像自体を毎回APIへ送信 |
| 単語別指定 | `illustration_briefs`。登録語義と一致する品詞・意味、場面、避けたい描写 |
| 生成履歴・待ち行列 | `illustration_jobs`。生成時の単語、語義、全文プロンプト、参考画像のパス、モデル、品質、使用量（APIから返る場合）、APIリクエストID、状態 |
| 表示する画像 | `word_illustrations`。最新成功画像へ自動変更。復元時は選択した履歴へ変更 |
| PNG原本 | R2 `vocab-illustrations` の `illustrations/{wordId}/{jobId}.png` |
| 画像URL | `/mcp-viewer/api/illustrations/{wordId}/{jobId}.png`。固定バージョンURL、GET/HEADのみ |
| 処理数 | 既存Cronの1回につき1件。同時に処理する画像も1件。管理画面の一括依頼は1回20語まで |
| 形式 | `gpt-image-2`、medium、1024×1024、PNG。文字・枠なし。PNG原本をWebと印刷で共用 |

現在はPNG原本の配信です。Web向け縮小・WebP化は含めていません。単語帳はSectionごと、画像は遅延読込します。印刷ボタンでは画像の読込を待ちます。大量のイラストを一度に印刷すると画像転送量と組版メモリが増えるため、章単位の印刷で確認してください。

参考画像は後から同じパスの内容を上書きせず、v2など新しい名前とプロンプト版にします。プロンプトを変えても既存画像は再生成されません。単語の語義を変更した場合も自動課金はせず、管理画面で語義と場面を選び直します。画像の意味は生成時点のスナップショットです。

## 管理画面

- Sectionを選んで最大20語を選択し、生成を依頼できます。「未作成を選択」は既存画像・処理中の語を除きます。
- 各語の「画像の登録・指示・履歴」で対象語義、描く場面、避けたい描写を指定できます。場面を空欄にすると、共通ルールに従って画像モデルが場面を考えます。
- 「保存してAPI生成（別料金）」は場面を保存した後に新規生成を依頼します。現在の画像を入力とした部分編集ではなく、共通見本を用いた新しいイラストの生成です。
- API生成を別途有効にした場合、その生成成功後の承認操作はありません。チャット画像の取り込みはOKの後のみ実行します。以前の成功画像は履歴から「この画像に戻す」で復元できます。
- 生成待ちの依頼は取り消せます。生成API呼び出しが始まった依頼は、終わるまで新規依頼・復元を待ちます。

## APIとMCP

編集APIの共通パスは `/mcp-editor/api/illustrations`。すべて既存OAuthで保護しています。

| メソッド・パス | 内容 |
| --- | --- |
| `GET /?sectionId=131` | 設定状態、Section一覧、対象語の画像・生成状態 |
| `GET /words/{wordId}` | 語義、生成指示、直近30件の履歴、表示中の画像ID |
| `PUT /words/{wordId}/brief` | `{pos, meaning, scene, avoid}` を保存 |
| `POST /jobs` | `{items:[{wordId,requestId}]}` を最大20件受付。各件の成功・失敗を個別に返す |
| `POST /jobs/{jobId}/cancel` | 待機中の依頼を取り消す |
| `POST /words/{wordId}/restore` | `{jobId}` の画像へ表示を戻す |
| `POST /words/{wordId}/import` | 承認済みPNGと語義・プロンプトを取り込む。画像生成APIは使用しない |

`requestId` はクライアントで作るUUIDです。同じ依頼のHTTP再送では同じUUIDを使います。完了後の再送でも再課金しません。明示的に新しい絵を生成する場合だけ新しいUUIDを発行します。

MCPの `/mcp`・`/mcp-write` には以下を追加します。`vocab.` 付きの別名も利用できます。ツールが接続先へ反映されない場合はVocabのツール情報を更新してください。

- `get_word_illustration` — 登録語義・指示・履歴を取得。
- `import_word_illustration` — ユーザーがOKしたPNG・語義・プロンプトを保存して表示。
- `generate_word_illustration` — `word_id, request_id, pos, meaning, scene, avoid` で生成・差し替えを依頼。
- `restore_word_illustration` — `word_id, job_id` で以前の画像へ復元。

これらは既存の匿名編集モードが有効でもOAuthが必須です。公開閲覧からのアクセスで有料生成を開始することはできません。

## 失敗・中断

画像取得・R2保存を完了してから、履歴の完了状態と表示先をD1トランザクションで切り替えます。失敗しても旧画像は残ります。

APIエラー・通信切断・4分のタイムアウトを自動再試行しません。プロバイダー側だけ成功している可能性があり、再試行に追加料金が発生するためです。処理中のまま16分を超えた依頼は失敗として解放し、確認後に明示的に再生成できます。R2保存後にD1書き込みが失敗した場合、未公開の画像がR2に残ることがあります。

一時停止は `ILLUSTRATIONS_ENABLED=false`。コードで定義した変数は次回デプロイ時にwrangler.tomlの値が優先されるため、恒久的な変更はファイル側にも反映します。Secretはデプロイで上書きしません。

## 検証

`npm run test:illustrations` はローカルD1/R2と模擬APIで、認証、リクエスト再送、Cronの重複実行、生成成功時の自動表示、失敗時の旧画像維持、取り消し、復元、印刷前の画像読込を確認します。追加で承認なしの拒否、OpenAI未設定時の取り込み、PNG検証、競合、重複防止、保存失敗時の旧画像保持、HTTP/MCP認証を検証します。実際のOpenAI APIは呼びません。

API仕様： [OpenAI Images edit](https://developers.openai.com/api/reference/resources/images/methods/edit)
