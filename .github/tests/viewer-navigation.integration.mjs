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
assert.match(styleSource, /\.contents-section\.is-grouped\s*\{/);
assert.match(styleSource, /\.contents-chapter\s*\{[\s\S]*font-weight:\s*800/);
assert.match(styleSource, /\.contents-subgroup\s*\{[\s\S]*border-left:\s*3px/);
assert.match(styleSource, /\.group-divider\s*\{/);

for (const view of ["introduction", "structure", "badges", "app-guide", "toc"]) {
  assert.match(indexSource, new RegExp(`data-book-view="${view}"`));
  assert.match(indexSource, new RegExp(`data-view-panel="${view}"`));
}
assert.match(indexSource, /id="printBookBtn"/);
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
assert.match(printSource, /state\.sections\.map\(\(section\) => String\(section\.key\)\)/);
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
assert.match(styleSource, /@bottom-center\s*\{[\s\S]*counter\(page\)[\s\S]*counter\(pages\)/);
assert.match(styleSource, /target-counter\(attr\(href\), page\)/);
assert.match(styleSource, /body\.is-printing-book \.view-panel\s*\{\s*display:\s*block !important/);
assert.match(styleSource, /body\.is-printing-book \.book-page[\s\S]*break-after:\s*page/);
const printStyleSource = styleSource.slice(styleSource.lastIndexOf("@media print"));
assert.match(printStyleSource, /\.index-columns\s*\{[\s\S]*column-fill:\s*auto/);
assert.match(printStyleSource, /\.index-group\s*\{\s*break-inside:\s*auto/);
assert.match(appSource, /PAGE_PARAMS\.get\("list"\)/);
assert.match(appSource, /PAGE_PARAMS\.get\("print"\) === "book"/);
assert.match(appSource, /pagedjs@0\.4\.3/);
assert.match(printSource, /await window\.PagedPolyfill\.preview\(\)/);
assert.match(indexSource, /shared\/qr\/crossover\.svg/);
assert.match(indexSource, /https:\/\/vocab\.lrnr\.jp\/\?list=crossover-v3/);
assert.match(indexSource, /rel="manifest"/);

console.log("Viewer navigation integration tests passed");
