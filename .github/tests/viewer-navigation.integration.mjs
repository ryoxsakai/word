import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

import {
  navigationSectionKeys,
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

assert.equal(wordIdFromHash("#word-take%20off"), "take off");
assert.equal(wordIdFromHash("#word-record"), "record");
assert.equal(wordIdFromHash("#section-2"), null);
assert.equal(wordIdFromHash("#word-"), null);

const appSource = await readFile(new URL("../../public/viewer/app.js", import.meta.url), "utf8");
const styleSource = await readFile(new URL("../../public/viewer/style.css", import.meta.url), "utf8");

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

console.log("Viewer navigation integration tests passed");
