// IPA発音記号の強勢記号(ˈ = 第1強勢, ˌ = 第2強勢)を、母音字の真上に重ねるアクセント記号
// (acute ´ = 第1強勢, grave ` = 第2強勢)に変換して表示するためのヘルパー。
// 「.」は単なる音節区切りで強勢とは無関係なので、アクセントは付けずに除去する。
//
// 変換前(辞書API等から取得した生のIPA。編集欄ではこちらをそのまま使う):
//   /əˈbæn.dən/
// 変換後(表示専用):
//   /əb́ændən/  (æ の直後に結合アキュート U+0301)
//
// 注意: 保存されているpronunciationの値自体は変更しない。表示直前にこの関数を通すだけ。

const IPA_VOWELS = new Set("aeiouyəɪʊʌɜɑɒɔæøɚɐɵɤɘɛœɶʉɨ".split(""));
const PRIMARY_STRESS = "ˈ"; // ˈ
const SECONDARY_STRESS = "ˌ"; // ˌ
const SYLLABLE_BOUNDARY = ".";
const COMBINING_ACUTE = "́";
const COMBINING_GRAVE = "̀";

export function formatPronunciationWithAccents(raw) {
  if (!raw) return raw;
  let pendingAccent = null; // null | COMBINING_ACUTE | COMBINING_GRAVE
  let out = "";
  for (const ch of raw) {
    if (ch === PRIMARY_STRESS) {
      pendingAccent = COMBINING_ACUTE;
      continue;
    }
    if (ch === SECONDARY_STRESS) {
      pendingAccent = COMBINING_GRAVE;
      continue;
    }
    if (ch === SYLLABLE_BOUNDARY) {
      continue;
    }
    if (pendingAccent && IPA_VOWELS.has(ch.toLowerCase())) {
      out += ch + pendingAccent;
      pendingAccent = null;
      continue;
    }
    out += ch;
  }
  return out;
}
