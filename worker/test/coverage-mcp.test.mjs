import assert from "node:assert/strict";
import test from "node:test";

import {
  COVERAGE_MCP_TOOL,
  handleCoverageMcp,
} from "../src/coverage-mcp.js";

function jsonRequest(message) {
  return new Request("https://vocab.lrnr.jp/mcp", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(message),
  });
}

function fakeDb() {
  const notebook = {
    id: "crossover-v3",
    name: "crossover",
    description: "test",
    wordCount: 1,
  };
  const listWords = [{ wordId: "covered", spelling: "covered" }];
  const allWords = [
    { wordId: "covered", spelling: "covered", derivedFromId: null },
    { wordId: "missing", spelling: "missing", derivedFromId: null },
  ];
  const sourceRows = [
    {
      bookKey: "target1900",
      sourceNo: "1",
      wordId: "covered",
      spelling: "covered",
      derivedFromId: null,
      primaryPos: "形",
      primaryMeaning: "覆われた",
    },
    {
      bookKey: "target1900",
      sourceNo: "2",
      wordId: "missing",
      spelling: "missing",
      derivedFromId: null,
      primaryPos: "形",
      primaryMeaning: "見つからない",
    },
  ];

  return {
    prepare(sql) {
      const statement = {
        values: [],
        bind(...values) {
          this.values = values;
          return this;
        },
        async first() {
          if (sql.includes("FROM lists l WHERE l.id = ?")) {
            return this.values[0] === notebook.id ? notebook : null;
          }
          throw new Error(`Unexpected first query: ${sql}`);
        },
        async all() {
          if (sql.includes("FROM list_items li JOIN words w ON w.id = li.word_id")) {
            return { results: listWords };
          }
          if (sql.includes("SELECT id AS wordId, spelling AS spelling, derived_from_id AS derivedFromId FROM words")) {
            return { results: allWords };
          }
          if (sql.includes("SELECT d.word AS derivativeSpelling")) {
            return { results: [] };
          }
          if (sql.includes("SELECT t.tag_key AS bookKey")) {
            return { results: sourceRows };
          }
          throw new Error(`Unexpected all query: ${sql}`);
        },
      };
      return statement;
    },
  };
}

test("adds coverage tools to the public MCP tools list", async () => {
  let delegated = 0;
  const response = await handleCoverageMcp(
    jsonRequest({ jsonrpc: "2.0", id: 1, method: "tools/list", params: {} }),
    { DB: fakeDb() },
    async () => {
      delegated += 1;
      return new Response(
        JSON.stringify({
          jsonrpc: "2.0",
          id: 1,
          result: { tools: [{ name: "list_notebooks" }] },
        }),
        { headers: { "Content-Type": "application/json" } }
      );
    }
  );

  const payload = await response.json();
  const names = payload.result.tools.map((tool) => tool.name);
  assert.equal(delegated, 1);
  assert.ok(names.includes(COVERAGE_MCP_TOOL.name));
  assert.ok(names.includes(`vocab.${COVERAGE_MCP_TOOL.name}`));

  const tool = payload.result.tools.find((candidate) => candidate.name === COVERAGE_MCP_TOOL.name);
  assert.equal(tool.annotations.readOnlyHint, true);
  assert.equal(tool.securitySchemes[0].type, "noauth");
});

test("returns a structured coverage report from the MCP tool", async () => {
  const response = await handleCoverageMcp(
    jsonRequest({
      jsonrpc: "2.0",
      id: 2,
      method: "tools/call",
      params: {
        name: "vocab.list_uncovered_words",
        arguments: {
          list_id: "crossover-v3",
          books: ["target1900"],
          mode: "practical",
          view: "unique",
          limit: 10,
          offset: 0,
        },
      },
    }),
    { DB: fakeDb() },
    async () => {
      throw new Error("Coverage calls must not be delegated");
    }
  );

  const payload = await response.json();
  assert.equal(payload.result.isError, false);
  assert.equal(payload.result.structuredContent.notebook.id, "crossover-v3");
  assert.equal(payload.result.structuredContent.summary.selectedUncoveredUniqueWords, 1);
  assert.equal(payload.result.structuredContent.words[0].spelling, "missing");
  assert.equal(
    JSON.parse(payload.result.content[0].text).words[0].spelling,
    "missing"
  );
});

test("returns MCP isError for invalid coverage arguments", async () => {
  const response = await handleCoverageMcp(
    jsonRequest({
      jsonrpc: "2.0",
      id: 3,
      method: "tools/call",
      params: {
        name: "list_uncovered_words",
        arguments: { list_id: "", limit: 0 },
      },
    }),
    { DB: fakeDb() },
    async () => {
      throw new Error("Coverage calls must not be delegated");
    }
  );

  const payload = await response.json();
  assert.equal(payload.result.isError, true);
  assert.match(payload.result.content[0].text, /list_id is required/);
});

test("ignores unrelated MCP calls so the existing server handles them", async () => {
  const response = await handleCoverageMcp(
    jsonRequest({
      jsonrpc: "2.0",
      id: 4,
      method: "tools/call",
      params: { name: "list_notebooks", arguments: {} },
    }),
    { DB: fakeDb() },
    async () => {
      throw new Error("Unrelated calls should not delegate inside the extension");
    }
  );

  assert.equal(response, null);
});
