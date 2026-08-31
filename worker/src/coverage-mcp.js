import { MAJOR_WORDBOOKS, buildCoverageGapReport } from "./coverage.js";

const DEFAULT_LIMIT = 200;
const MAX_LIMIT = 5000;
const BOOK_KEYS = MAJOR_WORDBOOKS.map((book) => book.key);

export const COVERAGE_MCP_TOOL = Object.freeze({
  name: "list_uncovered_words",
  title: "主要単語帳の未カバー語",
  description:
    "指定した単語帳について、Target 1900・鉄壁・システム英単語・英検準1級でる順パス単の未カバー語とカバー率をJSONで返します。完全一致または派生語込みの実質カバーを選択できます。",
  inputSchema: {
    type: "object",
    properties: {
      list_id: {
        type: "string",
        minLength: 1,
        description: "list_notebooksで確認した対象単語帳ID。現行crossoverはcrossover-v3。",
      },
      books: {
        type: "array",
        items: { type: "string", enum: BOOK_KEYS },
        minItems: 1,
        uniqueItems: true,
        default: BOOK_KEYS,
        description: "比較対象の主要単語帳キー。省略時は4冊すべて。",
      },
      mode: {
        type: "string",
        enum: ["exact", "practical"],
        default: "practical",
        description: "exactは見出し語完全一致、practicalは派生語ファミリーと派生語欄も考慮。",
      },
      view: {
        type: "string",
        enum: ["unique", "entries"],
        default: "unique",
        description: "uniqueは同一語を統合、entriesは単語帳別の収録行を個別に返す。",
      },
      limit: {
        type: "integer",
        minimum: 1,
        maximum: MAX_LIMIT,
        default: DEFAULT_LIMIT,
        description: "返す未カバー語の最大件数。",
      },
      offset: {
        type: "integer",
        minimum: 0,
        default: 0,
        description: "ページング開始位置。",
      },
    },
    required: ["list_id"],
    additionalProperties: false,
  },
  securitySchemes: [{ type: "noauth" }],
  annotations: {
    readOnlyHint: true,
    destructiveHint: false,
    openWorldHint: false,
  },
});

const COVERAGE_MCP_TOOLS = Object.freeze([
  COVERAGE_MCP_TOOL,
  Object.freeze({ ...COVERAGE_MCP_TOOL, name: `vocab.${COVERAGE_MCP_TOOL.name}` }),
]);

function headers(extra = {}) {
  return {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers":
      "Content-Type, Authorization, MCP-Protocol-Version, MCP-Session-Id",
    "Access-Control-Expose-Headers": "MCP-Protocol-Version, MCP-Session-Id",
    "X-Content-Type-Options": "nosniff",
    ...extra,
  };
}

function rpc(id, result) {
  return new Response(JSON.stringify({ jsonrpc: "2.0", id, result }), {
    headers: headers(),
  });
}

function normalizeToolName(value) {
  let candidate = value;
  if (candidate && typeof candidate === "object" && "name" in candidate) {
    candidate = candidate.name;
  } else if (typeof candidate === "string" && candidate.trim().startsWith("{")) {
    try {
      const parsed = JSON.parse(candidate);
      if (parsed && typeof parsed === "object" && "name" in parsed) candidate = parsed.name;
    } catch {
      // The regular unknown-tool path will handle malformed values.
    }
  }
  const name = String(candidate ?? "");
  return name.split(".").pop() || name;
}

function requiredText(value, name) {
  const text = String(value ?? "").trim();
  if (!text) throw new Error(`${name} is required`);
  return text;
}

function boundedInteger(value, fallback, min, max, name) {
  if (value === undefined || value === null || value === "") return fallback;
  const number = Number(value);
  if (!Number.isInteger(number) || number < min || number > max) {
    throw new Error(`${name} must be an integer between ${min} and ${max}`);
  }
  return number;
}

function appendCoverageTools(payload) {
  const tools = payload?.result?.tools;
  if (!Array.isArray(tools)) return payload;
  const existing = new Set(tools.map((tool) => tool?.name).filter(Boolean));
  for (const tool of COVERAGE_MCP_TOOLS) {
    if (!existing.has(tool.name)) tools.push(tool);
  }
  return payload;
}

async function callCoverageTool(message, env) {
  const args = message.params?.arguments || {};
  const report = await buildCoverageGapReport(env.DB, {
    listId: requiredText(args.list_id, "list_id"),
    bookKeys: args.books,
    mode: args.mode,
    view: args.view,
    limit: boundedInteger(args.limit, DEFAULT_LIMIT, 1, MAX_LIMIT, "limit"),
    offset: boundedInteger(args.offset, 0, 0, 1000000, "offset"),
  });

  return rpc(message.id, {
    content: [{ type: "text", text: JSON.stringify(report) }],
    structuredContent: report,
    isError: false,
  });
}

export async function handleCoverageMcp(request, env, delegate) {
  const path = new URL(request.url).pathname.replace(/\/+$/, "") || "/";
  if (path !== "/mcp" || request.method !== "POST") return null;

  let message;
  try {
    message = await request.clone().json();
  } catch {
    return null;
  }

  if (message.method === "tools/list") {
    const upstream = await delegate(request);
    let payload;
    try {
      payload = await upstream.clone().json();
    } catch {
      return upstream;
    }
    appendCoverageTools(payload);
    const responseHeaders = new Headers(upstream.headers);
    responseHeaders.delete("Content-Length");
    responseHeaders.set("Content-Type", "application/json; charset=utf-8");
    return new Response(JSON.stringify(payload), {
      status: upstream.status,
      statusText: upstream.statusText,
      headers: responseHeaders,
    });
  }

  const toolName = normalizeToolName(message.params?.name);
  if (message.method !== "tools/call" || toolName !== COVERAGE_MCP_TOOL.name) return null;

  try {
    return await callCoverageTool(message, env);
  } catch (error) {
    const text = error instanceof Error ? error.message : String(error);
    return rpc(message.id, {
      content: [{ type: "text", text }],
      isError: true,
    });
  }
}
