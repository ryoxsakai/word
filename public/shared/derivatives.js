function derivativeKey(word, index) {
  const normalized = String(word || "").trim().normalize("NFKC").toLocaleLowerCase("en");
  return normalized || `__empty_derivative_${index}`;
}

// 編集画面では1行を「1品詞・1意味」として保ち、閲覧時だけ同じ派生語をまとめる。
export function groupDerivativeSenses(derivatives = []) {
  const groups = [];
  const groupsByWord = new Map();

  derivatives.forEach((derivative, index) => {
    const key = derivativeKey(derivative?.word, index);
    let group = groupsByWord.get(key);
    if (!group) {
      group = { word: derivative?.word || "", senses: [] };
      groupsByWord.set(key, group);
      groups.push(group);
    }
    group.senses.push({
      pos: derivative?.pos || "",
      meaning: derivative?.meaning || "",
    });
  });

  return groups;
}
