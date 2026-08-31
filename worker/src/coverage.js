const DEFAULT_LIMIT = 200;
const MAX_LIMIT = 5000;

export const MAJOR_WORDBOOKS = Object.freeze([
  Object.freeze({ key: "target1900", name: "Target 1900" }),
  Object.freeze({ key: "teppeki", name: "鉄壁" }),
  Object.freeze({ key: "systan", name: "システム英単語" }),
  Object.freeze({ key: "passtan_p1", name: "英検準1級 でる順パス単" }),
]);

const BOOK_BY_KEY = new Map(MAJOR_WORDBOOKS.map((book, index) => [book.key, { ...book, index }]));
const COVERAGE_MODES = new Set(["exact", "practical"]);
const OUTPUT_VIEWS = new Set(["unique", "entries"]);

function json(data, init = {}) {
  return new Response(JSON.stringify(data), {
    ...init,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
      ...(init.headers || {}),
    },
  });
}

function errorJson(message, status, code, details = null, headers = {}) {
  return json(
    {
      error: code,
      message,
      ...(details ? { details } : {}),
    },
    { status, headers }
  );
}

export function normalizeSpelling(value) {
  return String(value ?? "")
    .normalize("NFKC")
    .trim()
    .toLowerCase()
    .replace(/[‘’`´]/g, "'")
    .replace(/[‐‑‒–—−]/g, "-")
    .replace(/\s+/g, " ");
}

export function parseBookKeys(value) {
  const raw = Array.isArray(value)
    ? value
    : String(value ?? "")
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean);
  const selected = raw.length ? raw : MAJOR_WORDBOOKS.map((book) => book.key);
  const unique = [...new Set(selected)];
  const unknown = unique.filter((key) => !BOOK_BY_KEY.has(key));
  if (unknown.length) {
    throw new RangeError(`Unknown book key: ${unknown.join(", ")}`);
  }
  return unique;
}

export function parseCoverageMode(value) {
  const mode = String(value || "practical").toLowerCase();
  if (!COVERAGE_MODES.has(mode)) {
    throw new RangeError("mode must be exact or practical");
  }
  return mode;
}

export function parseOutputView(value) {
  const view = String(value || "unique").toLowerCase();
  if (!OUTPUT_VIEWS.has(view)) {
    throw new RangeError("view must be unique or entries");
  }
  return view;
}

export function parsePagination(searchParams) {
  const rawLimit = String(searchParams.get("limit") || DEFAULT_LIMIT).toLowerCase();
  let limit;
  if (rawLimit === "all") {
    limit = null;
  } else {
    limit = Number(rawLimit);
    if (!Number.isInteger(limit) || limit < 1 || limit > MAX_LIMIT) {
      throw new RangeError(`limit must be an integer from 1 to ${MAX_LIMIT}, or all`);
    }
  }

  const rawOffset = searchParams.get("offset") || "0";
  const offset = Number(rawOffset);
  if (!Number.isInteger(offset) || offset < 0) {
    throw new RangeError("offset must be a non-negative integer");
  }
  return { limit, offset };
}

function sourceNumberParts(value) {
  const text = String(value ?? "").trim();
  if (!text) return [Number.POSITIVE_INFINITY, Number.POSITIVE_INFINITY, ""];
  const match = text.match(/^(\d+)(?:-(\d+))?$/);
  if (!match) return [Number.POSITIVE_INFINITY, Number.POSITIVE_INFINITY, text.toLowerCase()];
  return [Number(match[1]), match[2] ? Number(match[2]) : 0, text];
}

function compareSourceNumbers(a, b) {
  const aa = sourceNumberParts(a);
  const bb = sourceNumberParts(b);
  if (aa[0] !== bb[0]) return aa[0] - bb[0];
  if (aa[1] !== bb[1]) return aa[1] - bb[1];
  return aa[2].localeCompare(bb[2], "en");
}

function roundPercent(covered, total) {
  if (!total) return 0;
  return Math.round((covered / total) * 10000) / 100;
}

function findExactAncestor(wordId, allWordsById, exactById) {
  const visited = new Set([wordId]);
  let current = allWordsById.get(wordId)?.derivedFromId || null;
  while (current && !visited.has(current)) {
    if (exactById.has(current)) return exactById.get(current);
    visited.add(current);
    current = allWordsById.get(current)?.derivedFromId || null;
  }
  return null;
}

function classifyCoverage(source, exactById, allWordsById, derivativeIndex) {
  const exact = exactById.get(source.wordId);
  if (exact) {
    return {
      exact: true,
      practical: true,
      matchType: "exact_headword",
      viaWordId: exact.wordId,
      viaSpelling: exact.spelling,
    };
  }

  const linkedAncestor = findExactAncestor(source.wordId, allWordsById, exactById);
  if (linkedAncestor) {
    return {
      exact: false,
      practical: true,
      matchType: "linked_derivative",
      viaWordId: linkedAncestor.wordId,
      viaSpelling: linkedAncestor.spelling,
    };
  }

  const listedDerivative = derivativeIndex.get(normalizeSpelling(source.spelling));
  if (listedDerivative) {
    return {
      exact: false,
      practical: true,
      matchType: "listed_derivative",
      viaWordId: listedDerivative.viaWordId,
      viaSpelling: listedDerivative.viaSpelling,
    };
  }

  return {
    exact: false,
    practical: false,
    matchType: null,
    viaWordId: null,
    viaSpelling: null,
  };
}

function entrySort(bookOrder) {
  return (a, b) => {
    const bookDifference = bookOrder.get(a.bookKey) - bookOrder.get(b.bookKey);
    if (bookDifference) return bookDifference;
    const numberDifference = compareSourceNumbers(a.sourceNo, b.sourceNo);
    if (numberDifference) return numberDifference;
    return a.spelling.localeCompare(b.spelling, "en", { sensitivity: "base" });
  };
}

function uniqueSort(a, b) {
  if (a.sourceBookCount !== b.sourceBookCount) return b.sourceBookCount - a.sourceBookCount;
  if (a.sortBookOrder !== b.sortBookOrder) return a.sortBookOrder - b.sortBookOrder;
  const numberDifference = compareSourceNumbers(a.sortSourceNo, b.sortSourceNo);
  if (numberDifference) return numberDifference;
  return a.spelling.localeCompare(b.spelling, "en", { sensitivity: "base" });
}

function paginate(items, limit, offset) {
  const total = items.length;
  const page = limit === null ? items.slice(offset) : items.slice(offset, offset + limit);
  const nextOffset = offset + page.length < total ? offset + page.length : null;
  return {
    page,
    pagination: {
      limit: limit === null ? "all" : limit,
      offset,
      returned: page.length,
      total,
      nextOffset,
    },
  };
}

export function buildCoverageReportFromData({
  notebook,
  listWords,
  allWords,
  listedDerivatives,
  sourceRows,
  bookKeys,
  mode = "practical",
  view = "unique",
  limit = DEFAULT_LIMIT,
  offset = 0,
  generatedAt = new Date().toISOString(),
}) {
  const selectedBookKeys = parseBookKeys(bookKeys);
  const selectedMode = parseCoverageMode(mode);
  const selectedView = parseOutputView(view);
  const bookOrder = new Map(selectedBookKeys.map((key, index) => [key, index]));
  const exactById = new Map(
    listWords.map((word) => [word.wordId, { wordId: word.wordId, spelling: word.spelling }])
  );
  const allWordsById = new Map(
    allWords.map((word) => [word.wordId, { wordId: word.wordId, spelling: word.spelling, derivedFromId: word.derivedFromId || null }])
  );
  const derivativeIndex = new Map();
  for (const derivative of listedDerivatives) {
    const normalized = normalizeSpelling(derivative.derivativeSpelling);
    if (!normalized || derivativeIndex.has(normalized)) continue;
    derivativeIndex.set(normalized, {
      viaWordId: derivative.viaWordId,
      viaSpelling: derivative.viaSpelling,
    });
  }

  const classifiedEntries = sourceRows
    .filter((row) => bookOrder.has(row.bookKey))
    .map((row) => {
      const book = BOOK_BY_KEY.get(row.bookKey);
      return {
        bookKey: row.bookKey,
        bookName: book.name,
        sourceNo: row.sourceNo ?? null,
        wordId: row.wordId,
        spelling: row.spelling,
        primaryPos: row.primaryPos ?? null,
        primaryMeaning: row.primaryMeaning ?? null,
        derivedFromId: row.derivedFromId ?? null,
        coverage: classifyCoverage(row, exactById, allWordsById, derivativeIndex),
      };
    })
    .sort(entrySort(bookOrder));

  const bookSummaries = selectedBookKeys.map((key) => {
    const book = BOOK_BY_KEY.get(key);
    const entries = classifiedEntries.filter((entry) => entry.bookKey === key);
    const exactCovered = entries.filter((entry) => entry.coverage.exact).length;
    const practicalCovered = entries.filter((entry) => entry.coverage.practical).length;
    return {
      key,
      name: book.name,
      total: entries.length,
      exactCovered,
      exactUncovered: entries.length - exactCovered,
      exactCoverageRate: roundPercent(exactCovered, entries.length),
      practicalCovered,
      practicalUncovered: entries.length - practicalCovered,
      practicalCoverageRate: roundPercent(practicalCovered, entries.length),
    };
  });

  const selectedEntries = classifiedEntries.filter((entry) =>
    selectedMode === "exact" ? !entry.coverage.exact : !entry.coverage.practical
  );

  const uniqueMap = new Map();
  for (const entry of selectedEntries) {
    let item = uniqueMap.get(entry.wordId);
    if (!item) {
      item = {
        wordId: entry.wordId,
        spelling: entry.spelling,
        primaryPos: entry.primaryPos,
        primaryMeaning: entry.primaryMeaning,
        derivedFromId: entry.derivedFromId,
        sourceBookCount: 0,
        sources: [],
        coverage: entry.coverage,
      };
      uniqueMap.set(entry.wordId, item);
    }
    item.sources.push({
      bookKey: entry.bookKey,
      bookName: entry.bookName,
      sourceNo: entry.sourceNo,
      bookOrder: bookOrder.get(entry.bookKey),
    });
  }

  const uniqueItems = [...uniqueMap.values()]
    .map((item) => {
      item.sources.sort((a, b) => {
        if (a.bookOrder !== b.bookOrder) return a.bookOrder - b.bookOrder;
        return compareSourceNumbers(a.sourceNo, b.sourceNo);
      });
      item.sourceBookCount = item.sources.length;
      item.sortBookOrder = item.sources[0]?.bookOrder ?? Number.POSITIVE_INFINITY;
      item.sortSourceNo = item.sources[0]?.sourceNo ?? null;
      item.sources = item.sources.map(({ bookOrder: _bookOrder, ...source }) => source);
      return item;
    })
    .sort(uniqueSort)
    .map(({ sortBookOrder: _sortBookOrder, sortSourceNo: _sortSourceNo, ...item }) => item);

  const entryItems = selectedEntries.map((entry) => ({
    wordId: entry.wordId,
    spelling: entry.spelling,
    primaryPos: entry.primaryPos,
    primaryMeaning: entry.primaryMeaning,
    derivedFromId: entry.derivedFromId,
    source: {
      bookKey: entry.bookKey,
      bookName: entry.bookName,
      sourceNo: entry.sourceNo,
    },
    coverage: entry.coverage,
  }));

  const outputItems = selectedView === "unique" ? uniqueItems : entryItems;
  const { page, pagination } = paginate(outputItems, limit, offset);

  return {
    schemaVersion: 1,
    generatedAt,
    notebook: {
      id: notebook.id,
      name: notebook.name,
      description: notebook.description ?? null,
      wordCount: Number(notebook.wordCount ?? listWords.length),
    },
    request: {
      mode: selectedMode,
      view: selectedView,
      books: selectedBookKeys,
    },
    methodology: {
      exact: "The source word itself is a headword in the target notebook.",
      practical:
        "Exact coverage, a linked derived_from family whose ancestor is a target headword, or an exact normalized match in a target headword's derivatives list.",
      normalization: "Unicode NFKC, lowercase, trimmed whitespace, normalized apostrophes and hyphens. No stemming or inflection guessing.",
    },
    summary: {
      sourceEntries: classifiedEntries.length,
      selectedUncoveredEntries: selectedEntries.length,
      selectedUncoveredUniqueWords: uniqueItems.length,
      books: bookSummaries,
    },
    pagination,
    words: page,
  };
}

async function loadCoverageData(db, listId, bookKeys) {
  const notebook = await db
    .prepare(
      "SELECT l.id, l.name, l.description, " +
        "(SELECT COUNT(*) FROM list_items li WHERE li.list_id = l.id) AS wordCount " +
        "FROM lists l WHERE l.id = ?"
    )
    .bind(listId)
    .first();
  if (!notebook) {
    const error = new Error(`Notebook not found: ${listId}`);
    error.status = 404;
    error.code = "notebook_not_found";
    throw error;
  }

  const placeholders = bookKeys.map(() => "?").join(", ");
  const [listWordsResult, allWordsResult, derivativesResult, sourceResult] = await Promise.all([
    db
      .prepare(
        "SELECT w.id AS wordId, w.spelling AS spelling " +
          "FROM list_items li JOIN words w ON w.id = li.word_id " +
          "WHERE li.list_id = ?"
      )
      .bind(listId)
      .all(),
    db
      .prepare(
        "SELECT id AS wordId, spelling AS spelling, derived_from_id AS derivedFromId FROM words"
      )
      .all(),
    db
      .prepare(
        "SELECT d.word AS derivativeSpelling, d.word_id AS viaWordId, w.spelling AS viaSpelling " +
          "FROM list_items li " +
          "JOIN derivatives d ON d.word_id = li.word_id " +
          "JOIN words w ON w.id = d.word_id " +
          "WHERE li.list_id = ? " +
          "ORDER BY w.spelling COLLATE NOCASE, d.sort_order, d.id"
      )
      .bind(listId)
      .all(),
    db
      .prepare(
        "SELECT t.tag_key AS bookKey, t.tag_value AS sourceNo, " +
          "w.id AS wordId, w.spelling AS spelling, w.derived_from_id AS derivedFromId, " +
          "(SELECT s.pos FROM senses s WHERE s.word_id = w.id " +
          " ORDER BY s.is_primary DESC, s.sort_order, s.id LIMIT 1) AS primaryPos, " +
          "(SELECT s.meaning FROM senses s WHERE s.word_id = w.id " +
          " ORDER BY s.is_primary DESC, s.sort_order, s.id LIMIT 1) AS primaryMeaning " +
          "FROM tags t JOIN words w ON w.id = t.word_id " +
          `WHERE t.tag_key IN (${placeholders})`
      )
      .bind(...bookKeys)
      .all(),
  ]);

  return {
    notebook: { ...notebook, wordCount: Number(notebook.wordCount || 0) },
    listWords: listWordsResult.results,
    allWords: allWordsResult.results,
    listedDerivatives: derivativesResult.results,
    sourceRows: sourceResult.results,
  };
}

export async function buildCoverageGapReport(db, options) {
  const listId = String(options.listId || "").trim();
  if (!listId) {
    const error = new Error("listId is required");
    error.status = 400;
    error.code = "invalid_list_id";
    throw error;
  }
  const bookKeys = parseBookKeys(options.bookKeys);
  const mode = parseCoverageMode(options.mode);
  const view = parseOutputView(options.view);
  const data = await loadCoverageData(db, listId, bookKeys);
  return buildCoverageReportFromData({
    ...data,
    bookKeys,
    mode,
    view,
    limit: options.limit,
    offset: options.offset,
  });
}

function coveragePath(pathname) {
  const matches = [
    pathname.match(/^\/mcp-viewer\/api\/lists\/([^/]+)\/coverage\/uncovered\/?$/),
    pathname.match(/^\/api\/lists\/([^/]+)\/coverage\/uncovered\/?$/),
  ];
  const match = matches.find(Boolean);
  return match ? decodeURIComponent(match[1]) : null;
}

function corsHeaders(_request) {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  };
}

export async function handleCoverageApi(request, env) {
  const url = new URL(request.url);
  const listId = coveragePath(url.pathname);
  if (listId === null) return null;

  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders(request) });
  }
  if (request.method !== "GET") {
    return errorJson("This endpoint is read-only.", 405, "method_not_allowed", null, {
      Allow: "GET, OPTIONS",
      ...corsHeaders(request),
    });
  }

  try {
    const bookKeys = parseBookKeys(url.searchParams.get("books"));
    const mode = parseCoverageMode(url.searchParams.get("mode"));
    const view = parseOutputView(url.searchParams.get("view"));
    const { limit, offset } = parsePagination(url.searchParams);
    const report = await buildCoverageGapReport(env.DB, {
      listId,
      bookKeys,
      mode,
      view,
      limit,
      offset,
    });
    const response = json(report);
    const headers = new Headers(response.headers);
    for (const [key, value] of Object.entries(corsHeaders(request))) headers.set(key, value);
    return new Response(response.body, { status: response.status, headers });
  } catch (error) {
    const status = Number(error?.status) || (error instanceof RangeError ? 400 : 500);
    const code = error?.code || (error instanceof RangeError ? "invalid_parameter" : "coverage_report_failed");
    const response = errorJson(error instanceof Error ? error.message : String(error), status, code);
    const headers = new Headers(response.headers);
    for (const [key, value] of Object.entries(corsHeaders(request))) headers.set(key, value);
    return new Response(response.body, { status: response.status, headers });
  }
}
