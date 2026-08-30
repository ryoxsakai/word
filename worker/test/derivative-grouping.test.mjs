import assert from "node:assert/strict";
import { groupDerivativeSenses } from "../../public/shared/derivatives.js";

const grouped = groupDerivativeSenses([
  { word: "variable", pos: "形", meaning: "変わりやすい" },
  { word: "variable", pos: "名", meaning: "変数" },
  { word: "variation", pos: "名", meaning: "変化" },
  { word: "Variable", pos: "形", meaning: "可変の" },
]);

assert.deepEqual(grouped, [
  {
    word: "variable",
    senses: [
      { pos: "形", meaning: "変わりやすい" },
      { pos: "名", meaning: "変数" },
      { pos: "形", meaning: "可変の" },
    ],
  },
  { word: "variation", senses: [{ pos: "名", meaning: "変化" }] },
]);

console.log("derivative grouping test passed");
