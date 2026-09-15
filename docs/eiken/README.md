# からだと健康の英単語100

## 教材仕様

- 公開先：`https://vocab.lrnr.jp/eiken/index.html`
- 中学生から使う医系英語の入門単語帳。4章、各25項目、計100項目。
- Chapter 1 からだ・身近な体調／対象：5級
- Chapter 2 症状・病院・健康習慣／対象：4級
- Chapter 3 病気・けが・回復／対象：3級
- Chapter 4 治療・予防・健康問題／対象：準2級
- 各項目：見出し、発音記号、アクセント、品詞、意味、短い例文、和訳、メモ、イラスト。
- 補足はメモのみ。類義語・対義語・派生語・語源の専用欄は設けない。
- 対象級は学習者の目安。収録語の公式な級別認定や、英検全範囲の網羅を意味しない。
- ユーザーの2026-09-15の変更により、初版は印刷目的、音声なし。
- B5を基本に5項目／ページ。A4、章別、検索結果、画像なしでも印刷できる。

## マスターとCrossoverの分離

**編集する正本は `public/eiken/data.json` のみ。** 原稿の派生出力は正本から作り直す。

- DBへの登録、既存単語の更新、同期、移行は行わない。
- Crossoverの単語IDを教材の主キーとして使わない。`eiken-med-001`〜`eiken-med-100`を使う。
- 閲覧中のデータ取得は `./data.json` のGETのみ。Crossover API、編集API、MCPは呼ばない。
- 設定の保存キーは `eiken-medical-100:print:v1` に限定。
- 流用画像は語義と実画像を確認し、`public/eiken/assets/images/`へ独立コピーする。
- 出典とSHA-256は `asset-manifest.json` に保存。元画像の変更は自動反映しない。
- 既存の `public/shared/` にある読み取り専用の表示関数をimportする。既存ファイルは変更しない。
- 再生ボタンや未実装の音声案内は出さない。

## 編集・検証

1. `data.json` の対象項目だけを編集する。
2. 画像を差し替える場合は、専用フォルダーに保存し、パスとmanifestを更新する。
3. `node docs/eiken/validate.mjs` を実行する。
4. ローカルHTTPサーバーで `public/` を配信し、`/eiken/index.html`を開く。
5. 全章・章別・検索・画像切替を確認し、B5 PDFの全ページを目視確認する。
6. 変更一覧が新規教材とその検証資料に限定されていることを確認する。

## 編集上の参照

- [英検・各級の目安](https://www.eiken.or.jp/eiken/exam/about/)：学習対象の段階設定。
- [Cambridge・fever](https://dictionary.cambridge.org/dictionary/english/fever)、[stomachache](https://dictionary.cambridge.org/dictionary/english/stomachache)：初歩の症状語の語義・発音確認。
- IPAは英国式の一つの読みを基本とする。米語との差が学習に必要な場合はメモに記す。
- 例文と和訳は本教材用のオリジナル。Crossoverの例文・メモをそのまま複製しない。
- 熟語の強勢は一例。`prevent A from doing`は可変スロットを含むためpreventのIPAのみと明記する。

## 画像生成

不足分は組み込みimagegenで新規作成。Crossoverのシンプルな人物画を画風の参照とする。
最終プロンプトと生成画像の記録は `generation-prompts.json` に保存する。

## 2026-09-15 イラスト再点検

全100項目を目視し、18組の画像共有を解消。類似語・熟語も場面を描き分け、100項目に100種類の画像を割り当てる。
`wake up`は枕に頭を置いたまま目が覚める場面、`get up`はベッドから立ち上がる場面に分ける。
`regular`は同じ時刻の食事が繰り返される場面に変更する。
差し替え一覧は `illustration-review.json`、生成プロンプトは `generation-prompts.json` に記録する。
検証で画像パス・画像内容の重複と、各項目から画像記録への対応を検出する。
