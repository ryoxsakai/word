import assert from "node:assert/strict";
import vm from "node:vm";
import { build } from "esbuild";

class ClassList {
  constructor() { this.values = new Set(); }
  add(...names) { names.forEach((name) => this.values.add(name)); }
  remove(...names) { names.forEach((name) => this.values.delete(name)); }
  contains(name) { return this.values.has(name); }
  toggle(name, force) {
    const enabled = force == null ? !this.values.has(name) : !!force;
    if (enabled) this.values.add(name);
    else this.values.delete(name);
    return enabled;
  }
}

class FakeElement {
  constructor(tagName = "div", id = "") {
    this.tagName = tagName.toUpperCase();
    this.id = id;
    this.children = [];
    this.parentElement = null;
    this.dataset = {};
    this.style = {};
    this.classList = new ClassList();
    this.attributes = new Map();
    this.listeners = new Map();
    this.queries = new Map();
    this.hidden = false;
    this.disabled = false;
    this.checked = false;
    this.indeterminate = false;
    this.value = "";
    this.textContent = "";
    this.scrollTop = 0;
    this.scrollHeight = 1000;
    this.clientHeight = 500;
    this._innerHTML = "";
  }
  set className(value) {
    this._className = value;
    this.classList = new ClassList();
    String(value).split(/\s+/).filter(Boolean).forEach((name) => this.classList.add(name));
  }
  get className() { return this._className || ""; }
  set innerHTML(value) {
    this._innerHTML = String(value);
    this.children = [];
    this.queries.clear();
  }
  get innerHTML() { return this._innerHTML; }
  get options() { return this.children; }
  appendChild(child) {
    child.parentElement = this;
    this.children.push(child);
    return child;
  }
  insertBefore(child, before) {
    child.parentElement = this;
    const index = this.children.indexOf(before);
    if (index < 0) this.children.push(child);
    else this.children.splice(index, 0, child);
    return child;
  }
  remove() {
    if (!this.parentElement) return;
    this.parentElement.children = this.parentElement.children.filter((child) => child !== this);
  }
  addEventListener(type, listener) {
    if (!this.listeners.has(type)) this.listeners.set(type, []);
    this.listeners.get(type).push(listener);
  }
  dispatch(type, event = {}) {
    const payload = { target: this, preventDefault() {}, stopPropagation() {}, ...event };
    for (const listener of this.listeners.get(type) || []) listener(payload);
  }
  setAttribute(name, value) { this.attributes.set(name, String(value)); }
  getAttribute(name) { return this.attributes.get(name) ?? null; }
  removeAttribute(name) { this.attributes.delete(name); }
  querySelector(selector) {
    if (!this.queries.has(selector)) {
      const element = new FakeElement(selector.includes("input") ? "input" : "button");
      element.parentElement = this;
      this.queries.set(selector, element);
    }
    return this.queries.get(selector);
  }
  querySelectorAll(selector) {
    if (selector === "th") return Array.from({ length: (this._innerHTML.match(/<th\b/g) || []).length }, () => new FakeElement("th"));
    return [];
  }
  closest() { return null; }
  contains(target) { return target === this || this.children.includes(target); }
  focus() {}
  blur() {}
  scrollIntoView() {}
}

class FakeDocument {
  constructor() {
    this.elements = new Map();
    this.documentElement = new FakeElement("html", "documentElement");
    this.body = new FakeElement("body", "body");
  }
  getElementById(id) {
    if (!this.elements.has(id)) this.elements.set(id, new FakeElement("div", id));
    return this.elements.get(id);
  }
  createElement(tagName) { return new FakeElement(tagName); }
  querySelectorAll() { return []; }
  addEventListener() {}
}

function storage() {
  const values = new Map();
  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, String(value)),
    removeItem: (key) => values.delete(key),
  };
}

const requests = [];
const sectionWord = (id, spelling, sectionId, displayNo) => ({
  id,
  spelling,
  pronunciation: `/${spelling}/`,
  no: Number(displayNo),
  branch: 0,
  displayNo,
  sectionId,
  labelId: null,
  primaryPos: "名",
  primaryMeaning: spelling,
  pronunciationCaution: false,
  accentCaution: false,
  polysemousCaution: false,
  spellingCaution: false,
  conjugationCaution: false,
  usageCaution: false,
  phrases: [],
});

async function mockFetch(input) {
  const url = new URL(String(input), "http://localhost");
  requests.push(url.pathname);
  let data;
  if (url.pathname === "/api/lists") {
    data = [{ id: "book", name: "Book", isNotebook: true, isMaster: false, sectionLabel: "Section", chapterLabel: "Chapter" }];
  } else if (url.pathname === "/api/lists/book/editor/index") {
    data = { words: [
      { id: "alpha", spelling: "alpha", no: 1, branch: 0, displayNo: "1", sectionId: 1, labelId: null },
      { id: "beta", spelling: "beta", no: 2, branch: 0, displayNo: "2", sectionId: 2, labelId: null },
    ] };
  } else if (url.pathname === "/api/lists/book/sections") {
    data = [
      { id: 1, subtitle: "First", chapterId: null },
      { id: 2, subtitle: "Second", chapterId: null },
    ];
  } else if (url.pathname === "/api/lists/book/chapters" || url.pathname === "/api/lists/book/labels") {
    data = [];
  } else if (url.pathname === "/api/lists/book/editor/sections/1") {
    data = [sectionWord("alpha", "alpha", 1, "1")];
  } else if (url.pathname === "/api/lists/book/editor/sections/2") {
    data = [sectionWord("beta", "beta", 2, "2")];
  } else if (url.pathname === "/api/lists/book/editor/references") {
    data = { words: [] };
  } else {
    return new Response(JSON.stringify({ error: `unexpected ${url.pathname}` }), { status: 404 });
  }
  return new Response(JSON.stringify(data), { headers: { "content-type": "application/json" } });
}

const bundle = await build({
  entryPoints: [new URL("../../public/setting/app.js", import.meta.url).pathname],
  bundle: true,
  format: "iife",
  platform: "browser",
  write: false,
});
const document = new FakeDocument();
const context = {
  console,
  document,
  fetch: mockFetch,
  location: { hostname: "localhost", origin: "http://localhost", pathname: "/setting/", search: "", assign() {} },
  history: { replaceState() {} },
  localStorage: storage(),
  sessionStorage: storage(),
  navigator: { maxTouchPoints: 0 },
  matchMedia: () => ({ matches: false }),
  addEventListener() {},
  requestAnimationFrame: (callback) => setTimeout(callback, 0),
  cancelAnimationFrame: clearTimeout,
  setTimeout,
  clearTimeout,
  URL,
  URLSearchParams,
  Headers,
  Request,
  Response,
  TextEncoder,
  crypto,
  btoa: (value) => Buffer.from(value, "binary").toString("base64"),
  Audio: class { play() { return Promise.resolve(); } },
  SpeechSynthesisUtterance: class {},
  speechSynthesis: { speak() {}, cancel() {} },
};
context.window = context;
context.globalThis = context;
vm.runInNewContext(bundle.outputFiles[0].text, context, { filename: "setting-app.bundle.js" });

async function waitFor(predicate, message) {
  for (let attempt = 0; attempt < 100; attempt += 1) {
    if (predicate()) return;
    await new Promise((resolve) => setTimeout(resolve, 5));
  }
  throw new Error(message);
}

await waitFor(() => requests.includes("/api/lists/book/editor/sections/1"), "first section was not loaded");
assert.ok(requests.includes("/api/lists/book/editor/index"));
assert.equal(requests.includes("/api/lists/book/words"), false);
assert.equal(requests.includes("/api/lists/book/editor/sections/2"), false);
assert.equal(requests.includes("/api/lists/book/editor/references"), false);

const tableBody = document.getElementById("wordTableBody");
let secondSection = tableBody.children.find((row) => row.dataset.sectionId === "2");
assert.ok(secondSection, "second section heading should be present");
secondSection.querySelector('[data-action="toggle-collapse"]').dispatch("click");
await waitFor(() => requests.includes("/api/lists/book/editor/sections/2"), "expanded section was not loaded");

const sectionTwoRequests = () => requests.filter((path) => path === "/api/lists/book/editor/sections/2").length;
assert.equal(sectionTwoRequests(), 1);
secondSection = tableBody.children.find((row) => row.dataset.sectionId === "2");
secondSection.querySelector('[data-action="toggle-collapse"]').dispatch("click");
secondSection = tableBody.children.find((row) => row.dataset.sectionId === "2");
secondSection.querySelector('[data-action="toggle-collapse"]').dispatch("click");
await new Promise((resolve) => setTimeout(resolve, 20));
assert.equal(sectionTwoRequests(), 1, "re-expanding should use the in-memory section cache");

console.log("editor lazy UI integration test passed");
