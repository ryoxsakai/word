# 文法チェックポイント全体点検の反映（0047）

第1〜22講の点検で作った301件の優先確認リストを、現在の1,565項目と再照合した。
単独語は追加せず、複数語の熟語、連語、決まった構文を対象にしている。
301件は今回の点検リストの件数であり、誌面全体の収録率を計算する母数ではない。

| 変更 | 件数 |
|---|---:|
| 新規項目 | 262 |
| 既存項目に集約した点検候補 | 39 |
| 重複統合 | 8組 |
| 既存語義の修正 | 18 |
| 既存項目への語義補完 | 7 |
| 既存項目の掲載先移動 | 37 |
| 反映後の項目 | 1,819 |

## 構成

9 Chapters / 22 Groupsを維持し、Sectionを95から112へ整理した。
Group 1・2の37 Sectionsは維持する。

| Chapter | 反映前 | 反映後 |
|---|---:|---:|
| 1 文型と動詞 | 326 | 326 |
| 2 本動詞 | 49 | 109 |
| 3 準動詞 | 97 | 130 |
| 4 関係詞と疑問詞 | 22 | 45 |
| 5 接続詞と前置詞 | 78 | 119 |
| 6 名詞・冠詞・代名詞 | 28 | 68 |
| 7 比較と形容詞・副詞 | 40 | 93 |
| 8 否定と特殊構文 | 32 | 63 |
| 9 イディオムと会話表現 | 893 | 866 |

助動詞は義務・許可、完了形、要求・提案のthat節を分けた。
不定詞は目的・結果と疑問詞＋to V、分詞はwith＋O＋補語を分けた。
抽象名詞、身体部位、再帰代名詞、形容詞と名詞の連語、最上級、部分否定・二重否定、否定の強調にもSectionを設けた。

## 集約と語義

- make oneself understood / heardはmake oneself V-edの意味欄に具体形を補完。
- keep O V-edはkeep O Cの意味欄に補完。
- as if / as thoughの過去完了形は既存項目に補完。
- be accustomed to OはO / Vingへ拡張。
- in order / so as to Vは既存項目を目的のSectionへ移動。
- be made / knownの各表現は受動態へ移動。
- take advantage of OはすでにGroup 2にあり、今回移動しない。
- take care of Oは動詞＋名詞へ、be indifferent to / toward(s) Oは形容詞＋前置詞へ移動。
- 疑問詞の強調句は「疑問詞＋on earth」などの型を表示し、裸の名詞として収録しない。
- No way.の拒否と驚き、up to Oの「次第」、Don't worry.の感謝への返答を補完。
- be concerned with Oの関心の意味は冊子に加え[Merriam-Webster concerned](https://www.merriam-webster.com/dictionary/concerned)の語義2aで確認した。
- no better than Oは機械的に肯定のas good asと同義にせず、「Oも同然で・Oよりよいということはない」とした。
- PDFそのものは変更しない。地域差・口語などのラベルは付けない。

## 重複統合

| 残す表記 | 統合する表記 |
|---|---|
| look after O | look after |
| turn to O | turn to |
| work out (O) | work out |
| take up O | take up |
| carry O out | carry out O |
| set O up | set up O |
| pass O on (to A) | pass on O |
| for fear of O / Ving | for fear of Ving |

各語義IDと192件すべての既存参照を保持する。carry O outの「運び出す」と「実行する」、set O upの「罠にはめる」と「設立する」など、語義と参照は混ぜない。
see through O / see O through、get across O / get O across、come by / come by Oは別項目を維持する。

## 検証・移行

- `scripts/complete-grammar-audit.py`が明示した301件の判断を`test/fixtures/grammar-full-audit.json`に保存。
- 元の点検候補・旧判定は`test/fixtures/grammar-full-audit-checks.json`。最終判断はfull-auditのmappingを参照。
- `0047_complete_grammar_audit.sql`は対象1,565件のID・表記・掲載先と修正対象の旧和訳を確認してから変更。
- 不一致は移行を停止する。変更対象外の和訳・参照の並行編集は保持。
- 変更前の全項目、語義、Sectionをrevision 0047として退避。
- crossover-v3がないDBではデータ変更なし。他の単語帳と単語データは変更なし。
- SQLiteで公開APIの読み出し結果を予定データ全体と照合し、参照・異義・別単語帳・空DB・並行変更・ロールバックを検証。
- 既存の移行・編集・熟語表示テストも実行。本番反映後には公開APIを同じ予定データと照合する。
