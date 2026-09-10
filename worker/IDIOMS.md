# 独立した熟語管理

既存D1の `idiom_sections`（Chapter情報を含む）、`idioms`、`idiom_senses`、`idiom_word_refs` を使う。別DBは作らない。単語の関連語・フレーズを編集しても、独立保存した熟語は変わらない。

- 閲覧: `GET /mcp-viewer/api/lists/:listId/idioms`
- 登録・更新: `PUT /mcp-editor/api/lists/:listId/idioms`（既存の編集用OAuthが必要）
- 更新時はGETで返る `key` を `id` に指定する。参照番号ではなく単語IDを使う。
- 参照番号・英検フィルタ用タグは閲覧時の最新の単語索引から解決する。
- `managed: false` の未移行単語帳は従来の抽出表示を継続する。移行済み単語帳は空でも独立データを正とする。
- 熟語編集画面は `/setting/idioms.html`。同義語・対義語・メモ・非表示と語義順序を編集できる。記法と最新の整理内容は [補助欄・型の整理](IDIOM_FIELDS.md) を参照。

PUT本文の例:

```json
{
  "phrase": "put up with O",
  "sectionKey": "put",
  "sortOrder": 100,
  "meanings": [{"meaning": "Oを我慢する", "wordIds": ["tolerate"]}]
}
```

`id` を省略すると新規登録。更新は語義と参照先を含む当該熟語全体の置換なので、残す語義も送る。参照先が同じ単語帳にない場合は保存前に拒否する。単語フィールドは変更しない。

## 初回移行

現在の構成は0039で3 Chapter・50 Sectionに再編。732表現を保存し、単語側は主要構文を概ね5項目までに整理する。分類・例外・各語の移動先は [再編記録](IDIOM_REORGANIZATION.md) を参照。熟語・分類の移行前データは `idiom_revision_backup` にも保存する。

0037でテーブル追加、0038で638表現・664語義・676参照を保存。その後Chapter 2の46語から103フレーズ・162関連語を整理する。詳細は `IDIOM_ORGANIZATION.md`。

各削除は独立テーブルへの保存を確認し、元の語句・意味・関連語欄の一致も確認する。同時編集があればその箇所を残す。`idiom_migration_backup` は移行直前の関連語欄と全例文をJSONで保持する。復元時はこの保存内容と復元時点の編集を比較して対象箇所だけ戻す。単語全体を古い状態で上書きしない。

移行SQLの再生成は、取得した `words/full` のJSONを `node worker/scripts/prepare-idiom-migration.mjs <snapshot.json>` に渡す。精査用の分類表とSQLを生成する。`node worker/scripts/validate-idiom-snapshot.mjs <snapshot.json>` で3,000語の残存内容と全熟語参照を比較できる。適用済みの移行SQLは再生成して変更せず、新しい移行を作る。
