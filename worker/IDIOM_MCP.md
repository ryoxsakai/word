# 熟語MCP

熟語タブの独立DBを `/mcp` と `/mcp-write` に公開する。既存のOAuth権限・一時公開設定を継承する。データ・画面の収録方針は変更しない。

| 用途 | ツール |
|---|---|
| 目次・DBキー・表示番号・件数 | `get_idiom_structure` |
| 一覧・ページング | `list_idioms` |
| 表現・語義・別表記・メモの検索 | `search_idioms` |
| 全語義と語義別参照の取得 | `get_idiom` |
| 1〜30件の一括追加 | `create_idioms` |
| 部分更新・掲載/非表示 | `update_idiom` |
| Section移動 | `move_idioms` |
| Section内の並べ替え | `reorder_idioms` |
| Chapter/Group/Section追加・名称変更・所属変更・順序変更 | `update_idiom_structure` |
| 重複の統合 | `merge_idioms` |

全ツールに `vocab.` 接頭辞の別名もある。`list_id` は単語帳と共通だが、熟語の `idiom_id`、`section_key`、`chapter_key`、`group_key` は熟語専用。表示番号や単語用の数値IDを渡さない。

## 取得

`get_idiom_structure` は全Section（空・非表示のみのSectionを含む）、Chapter/Groupの対応、全件数と表示件数を返す。画面の番号は共通の `groupIdiomEntries` で計算し、検索・ページング前に付与する。非表示項目の `display_no`、画面に出ないSectionの `display` はnull。

`list_idioms` / `search_idioms` は既定50件、最大100件。`pagination.nextOffset` を次の `offset` に渡す。`include_hidden: true` で非表示項目も取得。`get_idiom` は `idiom_id` または完全一致 `phrase` のいずれかで取得する。別表記も完全一致検索に含み、複数候補時はIDを要求する。参照は各語義の `refs` に単語IDと出典を返し、必要なら `get_word` で単語詳細を読む。

## 編集・競合防止

取得応答の `revision` を全編集ツールの `expected_revision` へ渡す。成功後は再取得する。改訂番号はDB全体の熟語専用番号で、別単語帳への熟語編集でも更新される。既存の画面エディターからの変更もトリガーで検知する。

全入力を検証した後、revisionの一致検査・更新・監査履歴を1つのD1 batchで実行する。競合・参照切れ・SQL失敗時は全体がロールバックする。競合時は自動的に古い内容を再送せず読み直す。

`update_idiom` は省略項目を保持する。`meanings` を指定する場合だけ全語義配列を置換し、保持する語義には取得済みの `id` を渡す。各語義の `word_ids` を省略するとその語義の既存参照を保持し、空配列なら解除する。`notes` / `synonyms` / `antonyms` は空文字でクリアできる。掲載を外す場合は `hidden: true`。熟語画像は現在のDBに保存欄がないため、この変更には画像アップロードを含めない。

## 構成変更・統合

`update_idiom_structure.sections` に完成形を指定する。取得したSectionから `section_key, subtitle, chapter_key, chapter_subtitle, chapter_order, sort_order, group_key, group_subtitle, group_order, display_number` の入力フィールドだけを取り出す。既存キーは維持する。新しいキーは追加され、省略できるのは空Sectionだけ。Group/Chapterは各Sectionのメタデータで表現されるため、空のGroup/Chapterを単独では作らない。`sort_order` がSectionの実際の並びを決める。

`reorder_idioms` は指定Sectionの全ID（非表示も含む）を1回ずつ渡す。`move_idioms` は指定先の末尾へ移動する。

`merge_idioms` は全語義ID・参照を移動し、元の表現・IDをaliasesへ保存する。語義文が同じでも意味の違いを機械判定して削除せず、必要なら統合後に明示的に語義配列を編集する。元データは `list_recent_changes` で確認できる監査履歴に保存する。

## 検証・接続

`npm run test:idiom-mcp` で取得、ページング、部分更新、参照保持、別単語帳拒否、統合、構成、同時編集、ロールバック、OAuth経路を検証する。`npm run test:mcp-write` は実D1互換環境でOAuthを通すテストも含む。公開後は `node test/idiom-mcp.production.mjs` でツール一覧と公開熟語DBを読み取り照合する。

サーバーに新ツールが公開されても、チャット側が保持するツール一覧は別に更新が必要な場合がある。新しい接続のツール一覧に上記10種類があるか確認する。既存チャットのツール一覧が古いことと、サーバーでの実装・公開状況を区別する。
