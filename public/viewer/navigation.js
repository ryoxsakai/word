const NAVIGATION_PRELOAD_MARGIN = 1000;

function estimatedSectionHeight(section) {
  return Math.min(900, Math.max(160, Number(section.count || 0) * 44));
}

export function navigationSectionKeys(sections, targetSectionKey, additionalDistance = 0) {
  const targetKey = String(targetSectionKey);
  const index = sections.findIndex((section) => String(section.key) === targetKey);
  if (index < 0) return [targetKey];

  const keys = [targetKey];
  let estimatedDistance = 0;
  const preloadDistance = NAVIGATION_PRELOAD_MARGIN + Math.max(0, Number(additionalDistance) || 0);
  for (let cursor = index - 1; cursor >= 0 && estimatedDistance < preloadDistance; cursor -= 1) {
    const section = sections[cursor];
    keys.unshift(String(section.key));
    estimatedDistance += estimatedSectionHeight(section);
  }
  return keys;
}

export function wordIdFromHash(hash) {
  const prefix = "#word-";
  if (!String(hash).startsWith(prefix)) return null;
  const encodedId = String(hash).slice(prefix.length);
  if (!encodedId) return null;
  try {
    return decodeURIComponent(encodedId);
  } catch {
    return encodedId;
  }
}
