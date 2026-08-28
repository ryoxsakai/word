export const CEFR_LEVELS = Object.freeze(["A1", "A2", "B1", "B2", "C1", "C2"]);

const CEFR_LEVEL_SET = new Set(CEFR_LEVELS);

export function normalizeCefrLevel(value) {
  const level = String(value || "").trim().toUpperCase();
  return CEFR_LEVEL_SET.has(level) ? level : "";
}

// Oxford 5000の公式値を優先し、未収録語だけ暫定CEFRで補う。
export function effectiveCefrLevel(tags = {}) {
  return normalizeCefrLevel(tags.oxford5000) || normalizeCefrLevel(tags.cefr_provisional);
}

export function cefrLevelClass(level) {
  const normalized = normalizeCefrLevel(level);
  return normalized ? `cefr-${normalized.toLowerCase()}` : "";
}
