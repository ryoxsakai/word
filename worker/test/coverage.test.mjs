import assert from "node:assert/strict";
import test from "node:test";

import {
  buildCoverageReportFromData,
  normalizeSpelling,
} from "../src/coverage.js";

const fixture = {
  notebook: {
    id: "crossover-v3",
    name: "crossover",
    description: "test notebook",
    wordCount: 3,
  },
  listWords: [
    { wordId: "abandon", spelling: "abandon" },
    { wordId: "immediate", spelling: "immediate" },
    { wordId: "most", spelling: "most" },
  ],
  allWords: [
    { wordId: "abandon", spelling: "abandon", derivedFromId: null },
    { wordId: "immediate", spelling: "immediate", derivedFromId: null },
    { wordId: "immediately", spelling: "immediately", derivedFromId: "immediate" },
    { wordId: "most", spelling: "most", derivedFromId: null },
    { wordId: "mostly", spelling: "mostly", derivedFromId: null },
    { wordId: "obscure", spelling: "obscure", derivedFromId: null },
  ],
  listedDerivatives: [
    {
      derivativeSpelling: "mostly",
      viaWordId: "most",
      viaSpelling: "most",
    },
  ],
  sourceRows: [
    {
      bookKey: "target1900",
      sourceNo: "608",
      wordId: "abandon",
      spelling: "abandon",
      primaryPos: "他",
      primaryMeaning: "を捨てる",
      derivedFromId: null,
    },
    {
      bookKey: "target1900",
      sourceNo: "1700",
      wordId: "obscure",
      spelling: "obscure",
      primaryPos: "形",
      primaryMeaning: "不明瞭な",
      derivedFromId: null,
    },
    {
      bookKey: "teppeki",
      sourceNo: "900",
      wordId: "mostly",
      spelling: "mostly",
      primaryPos: "副",
      primaryMeaning: "主に",
      derivedFromId: null,
    },
    {
      bookKey: "systan",
      sourceNo: "1200",
      wordId: "immediately",
      spelling: "immediately",
      primaryPos: "副",
      primaryMeaning: "直ちに",
      derivedFromId: "immediate",
    },
    {
      bookKey: "passtan_p1",
      sourceNo: "1400",
      wordId: "obscure",
      spelling: "obscure",
      primaryPos: "形",
      primaryMeaning: "不明瞭な",
      derivedFromId: null,
    },
  ],
};

test("normalizes spelling without stemming", () => {
  assert.equal(normalizeSpelling("  Mother’s—Day  "), "mother's-day");
  assert.equal(normalizeSpelling("IMMEDIATELY"), "immediately");
});

test("practical mode excludes exact and derivative-family coverage", () => {
  const report = buildCoverageReportFromData({
    ...fixture,
    mode: "practical",
    view: "unique",
    limit: 200,
    offset: 0,
    generatedAt: "2026-08-31T00:00:00.000Z",
  });

  assert.equal(report.summary.sourceEntries, 5);
  assert.equal(report.summary.selectedUncoveredEntries, 2);
  assert.equal(report.summary.selectedUncoveredUniqueWords, 1);
  assert.equal(report.words.length, 1);
  assert.equal(report.words[0].spelling, "obscure");
  assert.equal(report.words[0].sourceBookCount, 2);
  assert.deepEqual(
    report.words[0].sources.map((source) => source.bookKey),
    ["target1900", "passtan_p1"]
  );

  const summaries = Object.fromEntries(report.summary.books.map((book) => [book.key, book]));
  assert.equal(summaries.target1900.exactCovered, 1);
  assert.equal(summaries.target1900.practicalCovered, 1);
  assert.equal(summaries.teppeki.practicalCovered, 1);
  assert.equal(summaries.systan.practicalCovered, 1);
  assert.equal(summaries.passtan_p1.practicalCovered, 0);
});

test("exact mode preserves practical match metadata for non-headwords", () => {
  const report = buildCoverageReportFromData({
    ...fixture,
    mode: "exact",
    view: "unique",
    limit: 200,
    offset: 0,
  });

  assert.equal(report.summary.selectedUncoveredEntries, 4);
  assert.equal(report.summary.selectedUncoveredUniqueWords, 3);

  const bySpelling = Object.fromEntries(report.words.map((word) => [word.spelling, word]));
  assert.equal(bySpelling.immediately.coverage.matchType, "linked_derivative");
  assert.equal(bySpelling.immediately.coverage.viaSpelling, "immediate");
  assert.equal(bySpelling.mostly.coverage.matchType, "listed_derivative");
  assert.equal(bySpelling.mostly.coverage.viaSpelling, "most");
  assert.equal(bySpelling.obscure.coverage.practical, false);
});

test("entry view supports deterministic pagination", () => {
  const report = buildCoverageReportFromData({
    ...fixture,
    mode: "exact",
    view: "entries",
    limit: 1,
    offset: 1,
  });

  assert.equal(report.pagination.total, 4);
  assert.equal(report.pagination.returned, 1);
  assert.equal(report.pagination.nextOffset, 2);
  assert.equal(report.words[0].source.bookKey, "teppeki");
  assert.equal(report.words[0].spelling, "mostly");
});
