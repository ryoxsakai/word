# 第1・2講の再点検と補完（0046）

原資料は「文法チェックポイント集冊子」の冊子1〜4ページ（PDFの2〜5ページ）。本文の例文、○、▶、注記を再確認した。旧0045は代表例中心で、列挙された語法の抽出が不十分だった。

## 構成

| 対象 | 変更前 | 変更後 |
|---|---|---|
| Group 1 文型 | 4Section・28項目 | 16Section・136項目 |
| Group 2 動詞の語法 | 14Section・40項目 | 21Section・190項目 |
| 熟語全体 | 1,333項目 | 1,565項目（234追加・2統合） |

旧Section 3「目的語・補語の形」は基本用法、促進動詞、妨害動詞、使役動詞、知覚動詞へ分割。全体のSection番号は表示順で再計算する。冒頭の「決まった形を取る第2文型動詞」は維持し、状態・変化・知覚のSVC、他動詞と自動詞、SVOOも追加。

Group 2は誌面前半の8分類と後半の前置詞別13分類。共通する型は第1講を主掲載先とし、照合記録で第2講からも対応を追える。保護を表すprotect / rescue / save A from Bは第2講の保護のSectionに掲載し、妨害・禁止のfrom Vingと区別した。

## 個別の判断

| 原資料・旧データ | 処理 |
|---|---|
| allow「助言する」 | advise O to Vとして補正。allowは「許す」のみ。 |
| seemを他動詞のthink型に列挙 | seem O Cは作らず、seem CをSVCに掲載。 |
| 妨害のfrom Vingを第5文型と表記 | 分類のまとまりは保持し、Section名は「妨害・禁止の動詞」。from Vingを一律に目的格補語とは記載しない。 |
| 知覚動詞を原形・現在分詞・過去分詞に一律展開 | 原形/Vingを知覚のまとまりに掲載。過去分詞はsee/watch/hear/feel/noticeで補い、look at/listen toに機械的適用しない。 |
| makeの過去分詞 | 典型的なmake oneself V-edで収録。 |
| shareを供給のwithに列挙 | share A with B「AをBと共有する」とし、他の供給動詞の目的語順を当てはめない。 |
| substituteとreplace | substitute A for Bは「Bの代わりにA」、replace A with Bは「AをBに取り替える」。 |
| impress / strikeを同一のasに列挙 | A impresses / strikes B as Cの形と、印象を与える意味を記載。 |
| provide / supply / serveの交換形 | provide B for A、supply B to A、serve B to Aを個別登録。for/toを全動詞に一律展開しない。 |
| keep O from Ving / keep A from B / Ving | 後者に統合。妨害・保護の両語義と参照を保持。 |
| go with / go with O | 後者に統合。伴う・調和する・付き合う等の既存語義と参照を保持。 |
| object to O / object to Ving | 既存IDをobject to O / Vingへ拡張。既存の動名詞の意味を残し、名詞の意味を補足。 |
| ask B of A | 既存IDにask A Bも併記し、第4文型と書き換えを確認できるようにする。 |
| lie/lay等の活用表、単独語の一般訳 | 活用表は熟語として複製しない。一般的な単独語は原則単語側とし、文型・語法上の対比が必要な型を抽出。 |

to不定詞の目的語を伴う型とmake/letの原形は[British Councilの文法解説](https://learnenglish.britishcouncil.org/free-resources/grammar/english-grammar-reference/verbs-followed-infinitive)も参照。日本語訳はこの登録用に整理し、原PDFは変更していない。

## 検証と再現

`scripts/expand-grammar-groups-1-2.py`に誌面の分類ごとの明示的な表現一覧を置く。`test/fixtures/grammar-groups-1-2.json`には移行前後と各候補のページ・掲載先・既存IDとの対応を保持。

0046は既存項目の件数・ID集合を確認してから移行する。意味は書き換えず、新規語義の追加と統合時の所属変更のみ。既存の参照・意味IDを保持し、元の見出し・配置・統合対象の語義所属をバックアップする。他の単語帳にGroup用の新規レコードを作らない。
