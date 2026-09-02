import assert from "node:assert/strict";
import { normalizeSenseMeaning } from "../src/sense-normalization.js";

assert.equal(normalizeSenseMeaning("〔the ～〕(～の)大半"), "(the ～)(～の)大半");
assert.equal(normalizeSenseMeaning("【英】勘定書"), "(英)勘定書");
assert.equal(normalizeSenseMeaning("〔the ～〕【米】辺境地"), "(the ～)(米)辺境地");
assert.equal(normalizeSenseMeaning("すでに(半角)"), "すでに(半角)");
assert.equal(normalizeSenseMeaning(null), null);

console.log("sense normalization test passed");
