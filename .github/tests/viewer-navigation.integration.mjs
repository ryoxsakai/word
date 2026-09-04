import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

import {
  navigationSectionKeys,
  sectionNumberRanges,
  wordIdFromHash,
} from "../../public/viewer/navigation.js";

const sections = [
  { key: 0, count: 1 },
  { key: 1, count: 20 },
  { key: "2", count: 1 },
  { key: 3, count: 20 },
];
assert.deepEqual(navigationSectionKeys(sections, 0), ["0"]);
assert.deepEqual(navigationSectionKeys(sections, "2"), ["0", "1", "2"]);
assert.deepEqual(navigationSectionKeys(sections, 3), ["1", "2", "3"]);
assert.deepEqual(navigationSectionKeys(sections, 3, 400), ["0", "1", "2", "3"]);
assert.deepEqual(navigationSectionKeys(sections, "none"), ["none"]);

const numberRanges = sectionNumberRanges([
  { sectionKey: "first", seqNo: "1" },
  { sectionKey: "first", seqNo: "1-1" },
  { sectionKey: "first", seqNo: "2" },
  { sectionId: 20, seqNo: "3" },
  { sectionId: 20, seqNo: "20" },
  { sectionId: 20, seqNo: "20-1" },
]);
assert.deepEqual(numberRanges.get("first"), { first: "1", last: "2" });
assert.deepEqual(numberRanges.get("20"), { first: "3", last: "20" });

assert.equal(wordIdFromHash("#word-take%20off"), "take off");
assert.equal(wordIdFromHash("#word-record"), "record");
assert.equal(wordIdFromHash("#section-2"), null);
assert.equal(wordIdFromHash("#word-"), null);

const appSource = await readFile(new URL("../../public/viewer/app.js", import.meta.url), "utf8");
const styleSource = await readFile(new URL("../../public/viewer/style.css", import.meta.url), "utf8");
const indexSource = await readFile(new URL("../../public/index.html", import.meta.url), "utf8");

const navigateToWordSource = appSource.slice(
  appSource.indexOf("async function navigateToWord"),
  appSource.indexOf("async function openWordFromWebMCP")
);
assert.ok(navigateToWordSource.includes("await prepareNavigationSection"));
assert.ok(navigateToWordSource.includes("await scrollToNavigationTarget"));
assert.ok(
  navigateToWordSource.indexOf("await prepareNavigationSection") <
    navigateToWordSource.indexOf("await scrollToNavigationTarget"),
  "the target section must finish loading before the word is scrolled into view"
);
assert.ok(
  navigateToWordSource.indexOf("await prepareNavigationSection") <
    navigateToWordSource.indexOf("history.pushState"),
  "the history entry must not be created until required section loads succeed"
);
assert.ok(
  navigateToWordSource.indexOf("history.pushState") <
    navigateToWordSource.indexOf("await scrollToNavigationTarget"),
  "the original scroll position must be captured before moving to the target"
);
assert.match(appSource, /firstSectionKey[\s\S]*data-nav-section-key/);
assert.match(appSource, /window\.addEventListener\("hashchange"/);
assert.match(appSource, /sectionPromises\.entries\(\)[\s\S]*<= targetIndex/);
assert.match(appSource, /clearNavigationAnchors\(\);[\s\S]*target\.scrollIntoView\(\{ behavior: "auto", block \}\)/);
assert.match(appSource, /while \(cursor < keys\.length && shouldContinue\(\)\)/);
assert.match(appSource, /generation === searchGeneration && listId === state\.currentListId/);
assert.match(appSource, /generation === lazyLoadGeneration && listId === state\.currentListId/);
assert.match(appSource, /lazyLoadGeneration \+= 1;[\s\S]*lazySectionObserver\?\.disconnect\(\)/);
assert.match(appSource, /results\.find\(\(result\) => result\.status === "rejected"\)/);
assert.match(appSource, /if \(failedLoad\)[\s\S]*clearNavigationAnchors\(\);[\s\S]*setupLazySectionObserver\(\)/);
assert.match(appSource, /cancelOnMissing[\s\S]*navigationGeneration \+= 1;[\s\S]*setupLazySectionObserver\(\)/);
assert.match(appSource, /navigationSectionKeys\(state\.sections, targetKey, window\.innerHeight \/ 2\)/);
assert.match(appSource, /if \(!target\)[\s\S]*clearNavigationAnchors\(\);[\s\S]*setupLazySectionObserver\(\)/);
assert.match(styleSource, /\.section-group\.is-navigation-anchor\s*\{[\s\S]*content-visibility:\s*visible/);

const contentsNavSource = appSource.slice(
  appSource.indexOf("function renderContentsNav"),
  appSource.indexOf("function setupSectionObserver")
);
assert.match(contentsNavSource, /state\.groups/);
assert.match(contentsNavSource, /contents-subgroup/);
assert.match(contentsNavSource, /data-nav-target="group-/);
assert.match(contentsNavSource, /contents-section[\s\S]*is-grouped/);
assert.match(contentsNavSource, /sectionNumberRanges\(state\.indexWords\)/);
assert.match(contentsNavSource, /title="登録ナンバー"/);
assert.match(contentsNavSource, /class="book-toc-word-range" aria-label="単語番号 \$\{escapeHtml\(numberRangeText\)\}"/);

const bottomNavSource = appSource.slice(
  appSource.indexOf("function setBottomNavContent"),
  appSource.indexOf("function renderContentsNav")
);
assert.match(bottomNavSource, /data-index-target/);
assert.match(bottomNavSource, /索引の頭文字/);
assert.match(appSource, /function setupIndexObserver\(\)[\s\S]*dataset\.indexKey/);
assert.match(styleSource, /\.index-group\s*\{[^}]*scroll-margin-top:/);

const sectionShellSource = appSource.slice(
  appSource.indexOf("function renderSectionShells"),
  appSource.indexOf("function sectionCacheKey")
);
assert.match(sectionShellSource, /group-divider/);
assert.match(sectionShellSource, /group-title/);
assert.match(sectionShellSource, /data-group-key/);
assert.doesNotMatch(sectionShellSource, /単語一覧/);
assert.match(styleSource, /\.contents-section\.is-grouped\s*\{/);
assert.match(styleSource, /\.contents-chapter\s*\{[\s\S]*font-weight:\s*800/);
assert.match(styleSource, /\.contents-subgroup\s*\{[\s\S]*border-left:\s*3px/);
assert.match(styleSource, /\.group-divider\s*\{/);

for (const view of ["introduction", "structure", "badges", "app-guide", "toc"]) {
  assert.match(indexSource, new RegExp(`data-book-view="${view}"`));
  assert.match(indexSource, new RegExp(`data-view-panel="${view}"`));
}
assert.equal((indexSource.match(/class="book-page front-matter-page view-panel"/g) || []).length, 4);
assert.match(indexSource, /id="printBookBtn"/);
assert.match(indexSource, /id="printPartSelect"/);
assert.doesNotMatch(indexSource, /印刷モードを開く/);
assert.match(indexSource, /id="printPageSize"/);
assert.match(indexSource, /value="a4"/);
assert.match(indexSource, /value="b5"/);
assert.match(indexSource, /value="a5"/);
assert.match(indexSource, /id="printFontSize"/);
assert.match(indexSource, /id="printLineHeight"/);
assert.match(indexSource, /id="printExampleColumns"/);
assert.match(indexSource, /id="printTocColumns"[\s\S]*<option value="2">2段<\/option>/);
assert.match(indexSource, /選択範囲を印刷/);
assert.match(indexSource, /value="toc">目次（単語番号）/);
assert.match(indexSource, /value="all">全体（軽量・目次は単語番号）/);
assert.match(indexSource, /value="all-paged">全体（版組・目次ページ番号あり）/);
assert.match(indexSource, /id="bookTocNav"/);
const printOrder = [
  'id="bookIntroduction"',
  'id="bookStructure"',
  'id="bookBadges"',
  'id="bookAppGuide"',
  'id="bookToc"',
  'id="wordList"',
  'id="indexList"',
].map((item) => indexSource.indexOf(item));
assert.ok(printOrder.every((position) => position >= 0));
assert.deepEqual(printOrder, [...printOrder].sort((a, b) => a - b), "book parts must follow print order");

const printSource = appSource.slice(
  appSource.indexOf("async function printWholeBook"),
  appSource.indexOf("// ---- テーマ切り替え")
);
assert.match(printSource, /await loadAllSectionsForPrint/);
assert.match(printSource, /const unloaded = sectionKeys\.filter/);
assert.match(printSource, /document\.body\.classList\.add\("is-printing-book"\)/);
assert.match(printSource, /document\.fonts\?\.ready/);
assert.match(printSource, /window\.print\(\)/);
assert.ok(
  printSource.indexOf("await loadAllSectionsForPrint") < printSource.indexOf('classList.add("is-printing-book")'),
  "all sections must finish loading before the print layout is enabled"
);
assert.ok(
  printSource.indexOf('classList.add("is-printing-book")') < printSource.indexOf("window.print()"),
  "the complete book layout must be enabled before printing"
);

assert.match(contentsNavSource, /bookTocNav\.innerHTML = renderItems\(true\)/);
assert.match(contentsNavSource, /class="contents-chapter book-toc-link" href="#/);
assert.match(contentsNavSource, /class="contents-subgroup book-toc-link" href="#group-/);
assert.match(contentsNavSource, /class="contents-section book-toc-link/);
assert.match(styleSource, /@page\s*\{[\s\S]*@bottom-center\s*\{\s*content:\s*none/);
assert.doesNotMatch(styleSource, /counter\(pages\)/);
assert.match(
  styleSource,
  /body\.is-printing-book \.book-toc-nav \.contents-section\.book-toc-link::after\s*\{[\s\S]*target-counter\(attr\(href\), page\)/
);
assert.doesNotMatch(
  styleSource,
  /body\.is-printing-book \.book-toc-link::after\s*\{[\s\S]*target-counter\(attr\(href\), page\)/
);
assert.match(
  styleSource,
  /data-print-engine="native"[\s\S]*\.contents-section \.book-toc-word-range\s*\{[\s\S]*display:\s*inline/
);
assert.match(
  styleSource,
  /data-print-part="toc"[\s\S]*\.contents-section \.book-toc-word-range\s*\{[\s\S]*display:\s*inline/
);
assert.match(styleSource, /body\.is-printing-book \.view-panel\s*\{\s*display:\s*block !important/);
assert.match(styleSource, /body\.is-printing-book \.front-matter-page[\s\S]*break-after:\s*page/);
assert.match(
  styleSource,
  /\.print-page-break-before\s*\{[\s\S]*break-before:\s*page;[\s\S]*page-break-before:\s*always/
);
assert.match(
  appSource,
  /const printPanels = \[\.\.\.document\.querySelectorAll\("body > \.view-panel"\)\];[\s\S]*classList\.add\("is-active"\)[\s\S]*setAttribute\("aria-hidden", "false"\)[\s\S]*classList\.toggle\("print-page-break-before", index > 0\)/
);
assert.match(styleSource, /@page print-a4\s*\{\s*size:\s*210mm 297mm/);
assert.match(styleSource, /@page print-b5\s*\{\s*size:\s*182mm 257mm/);
assert.match(styleSource, /@page print-a5\s*\{\s*size:\s*148mm 210mm/);
assert.match(styleSource, /@page print-a4-numbered\s*\{[\s\S]*@bottom-center\s*\{\s*content:\s*counter\(page\)/);
assert.match(styleSource, /@page print-b5-numbered\s*\{[\s\S]*@bottom-center\s*\{\s*content:\s*counter\(page\)/);
assert.match(styleSource, /@page print-a5-numbered\s*\{[\s\S]*@bottom-center\s*\{\s*content:\s*counter\(page\)/);
assert.match(styleSource, /body\.is-printing-book\[data-print-page-size="a4"\] > \.view-panel\s*\{\s*page:\s*print-a4/);
assert.match(styleSource, /body\.is-printing-book\[data-print-page-size="b5"\] > \.view-panel\s*\{\s*page:\s*print-b5/);
assert.match(styleSource, /body\.is-printing-book\[data-print-page-size="a5"\] > \.view-panel\s*\{\s*page:\s*print-a5/);
assert.match(
  styleSource,
  /body\.is-printing-book\[data-print-part="all-paged"\]\[data-print-page-size="a4"\][\s\S]*page:\s*print-a4-numbered/
);
assert.match(styleSource, /\.print-progress-overlay\s*\{[\s\S]*position:\s*fixed/);
const printStyleSource = styleSource.slice(styleSource.lastIndexOf("@media print"));
assert.match(printStyleSource, /\.print-progress-overlay\s*\{\s*display:\s*none !important/);
assert.match(printStyleSource, /data-print-part="all-paged"[\s\S]*\.word-list[\s\S]*break-before:\s*page/);
assert.match(printStyleSource, /\.section-group > \.section-entries > \.entry\s*\{[\s\S]*border-top:/);
assert.match(printStyleSource, /\.section-divider\s*\{[\s\S]*break-after:\s*avoid-page/);
assert.match(printStyleSource, /\.example-list\s*\{[\s\S]*--print-example-columns/);
assert.match(printStyleSource, /\.book-toc-nav\s*\{[\s\S]*columns:\s*var\(--print-toc-columns, 1\)/);
assert.match(printStyleSource, /\.index-columns\s*\{[\s\S]*column-fill:\s*auto/);
assert.match(printStyleSource, /\.index-group\s*\{\s*break-inside:\s*auto/);
assert.match(appSource, /const CROSSOVER_LIST_ID = "crossover-v3"/);
assert.match(appSource, /l\.id === CROSSOVER_LIST_ID/);
assert.match(appSource, /const initial = CROSSOVER_LIST_ID/);
assert.match(appSource, /PAGE_PARAMS\.get\("print"\) === "book"/);
assert.match(appSource, /PAGE_PARAMS\.get\("mode"\) === "print"/);
assert.match(appSource, /classList\.toggle\("is-print-mode", PRINT_UI_MODE\)/);
assert.match(appSource, /--print-font-size/);
assert.match(appSource, /--print-line-height/);
assert.match(appSource, /--print-example-columns/);
assert.match(appSource, /--print-toc-columns/);
assert.match(appSource, /PRINT_PAGE_SIZES = new Set\(\["a4", "b5", "a5"\]\)/);
assert.match(appSource, /dataset\.printPageSize = pageSize/);
assert.match(appSource, /document\.body\.dataset\.printPageSize = pageSize/);
assert.match(appSource, /function setPrintProgress\(percent, label\)/);
assert.match(appSource, /clearTimeout\(printProgressHideTimer\)/);
assert.match(appSource, /function registerPagedProgressHandler\(sectionKeys\)/);
assert.match(appSource, /afterPageLayout\(pageElement\)/);
assert.match(appSource, /afterRendered\(flow\)/);
assert.match(appSource, /highestReportedPercent = Math\.max\(highestReportedPercent, calculatedPercent\)/);
assert.match(appSource, /setPrintProgress\(100, "印刷準備完了"\)/);
assert.match(indexSource, /id="printProgressOverlay"[\s\S]*id="printProgressBar"/);
assert.match(appSource, /url\.searchParams\.set\("pageSize", el\.printPageSize\.value\)/);
assert.match(appSource, /url\.searchParams\.set\("fontSize", el\.printFontSize\.value\)/);
assert.match(appSource, /url\.searchParams\.set\("lineHeight", el\.printLineHeight\.value\)/);
assert.match(appSource, /url\.searchParams\.set\("exampleColumns", el\.printExampleColumns\.value\)/);
assert.match(appSource, /url\.searchParams\.set\("tocColumns", el\.printTocColumns\.value\)/);
assert.match(appSource, /pagedjs@0\.4\.3/);
assert.match(printSource, /await window\.PagedPolyfill\.preview\(\)/);
assert.match(appSource, /function printSectionKeys\(\)/);
assert.match(appSource, /PRINT_PART === "all" \|\| PRINT_PART === "all-paged"/);
assert.match(appSource, /selected === "all-paged"/);
assert.match(appSource, /window\.confirm\("全体の版組には長い時間がかかり/);
assert.match(appSource, /String\(section\.chapterKey\) === String\(PRINT_CHAPTER_KEY\)/);
assert.match(appSource, /function prepareLightweightPrintDom\(\)/);
assert.match(appSource, /\["index", "all", "all-paged"\]\.includes\(PRINT_PART\)/);
assert.match(appSource, /if \(!keepIds\.has\(panel\.id\)\) panel\.remove\(\)/);
assert.match(appSource, /if \(view === "index" && !state\.indexRendered\) renderAlphabeticalIndex\(\)/);
assert.match(styleSource, /\.section-group:not\(:first-of-type\)\s*\{[\s\S]*break-before:\s*page/);
assert.match(styleSource, /data-print-engine="native"/);
assert.match(styleSource, /body\.is-print-mode \.book-print-settings\.print-mode-only/);
assert.match(styleSource, /font-size:\s*var\(--print-font-size, 10pt\)/);
assert.match(styleSource, /line-height:\s*var\(--print-line-height, 1\.5\)/);
assert.match(appSource, /class="sense-number">\$\{index \+ 1\}/);
assert.doesNotMatch(styleSource, /counter-reset:\s*sense-num/);
assert.match(indexSource, /shared\/qr\/crossover\.svg/);
assert.match(indexSource, /<title>crossover<\/title>/);
assert.match(indexSource, /<h1 class="brand-name">crossover<\/h1>/);
assert.match(indexSource, /id="listSelect"[^>]*hidden/);
assert.match(appSource, />AWL\$\{awlSublist \? ` \$\{escapeHtml\(awlSublist\)\}` : ""\}<\/span>/);
assert.match(indexSource, /https:\/\/vocab\.lrnr\.jp\//);
assert.doesNotMatch(indexSource, /ナンバーについて/);
assert.match(indexSource, /医学部合格を目指す受験生のための英単語帳/);
assert.match(indexSource, /合格に必要な語彙を、読める力へ/);
assert.match(indexSource, /一周目：見出し語と中心義を確認する/);
const appGuideSource = indexSource.slice(indexSource.indexOf('id="bookAppGuide"'), indexSource.indexOf('id="bookToc"'));
assert.doesNotMatch(appGuideSource, /印刷|PDFに保存/);
assert.match(indexSource, /rel="manifest"/);

console.log("Viewer navigation integration tests passed");
