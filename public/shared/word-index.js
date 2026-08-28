export async function fetchCompleteWordIndex(fetchPage, pageSize = 300) {
  const index = new Map();
  let offset = 0;
  while (true) {
    const result = await fetchPage(offset, pageSize);
    for (const word of result.words) {
      index.set(word.spelling.toLowerCase(), { id: word.id, no: null });
    }
    if (!result.hasMore || result.words.length === 0) break;
    offset += result.words.length;
  }
  return index;
}
