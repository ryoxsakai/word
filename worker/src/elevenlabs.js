const DEFAULT_API_BASE = "https://api.elevenlabs.io/v1";

export class ElevenLabsError extends Error {
  constructor(message, status = 502) {
    super(message);
    this.name = "ElevenLabsError";
    this.status = status;
  }
}

export function normalizeIpa(raw) {
  const source = String(raw || "").trim();
  const slashMatches = [...source.matchAll(/\/([^/]+)\//g)];
  let ipa = source;
  if (slashMatches.length > 1) {
    throw new ElevenLabsError("発音記号が複数あります。生成する主発音を1つに絞ってください", 400);
  }
  if (slashMatches.length === 1) ipa = slashMatches[0][1];
  else if (ipa.startsWith("[") && ipa.endsWith("]")) ipa = ipa.slice(1, -1);

  ipa = ipa.trim().normalize("NFC");
  if (!ipa) throw new ElevenLabsError("IPAが必要です", 400);
  if (/[<>\r\n]/.test(ipa)) throw new ElevenLabsError("IPAに使用できない文字が含まれています", 400);
  return ipa;
}

async function errorMessage(response, fallback) {
  const body = await response.json().catch(() => null);
  const detail = body?.detail;
  return (
    (typeof detail === "string" && detail) ||
    detail?.message ||
    body?.message ||
    body?.error ||
    `${fallback}（ElevenLabs HTTP ${response.status}）`
  );
}

async function elevenLabsRequest(fetchImpl, url, apiKey, init, fallback) {
  const response = await fetchImpl(url, {
    ...init,
    headers: {
      "xi-api-key": apiKey,
      ...(init.headers || {}),
    },
  });
  if (!response.ok) {
    throw new ElevenLabsError(await errorMessage(response, fallback));
  }
  return response;
}

// ElevenLabsのPronunciation Dictionaryを一時的に作成して音声を生成する。
// 辞書は生成後に削除するため、同じ綴りの別発音を語ごとに安全に指定できる。
export async function synthesizeWordWithIpa({
  apiKey,
  voiceId,
  modelId = "eleven_turbo_v2",
  spelling,
  ipa: rawIpa,
  forcePronunciation = true,
  spokenText,
  previousText,
  nextText,
  outputFormat = "mp3_44100_128",
  apiBase = DEFAULT_API_BASE,
  fetchImpl = fetch,
}) {
  if (!apiKey) throw new ElevenLabsError("ELEVENLABS_API_KEYが設定されていません", 503);
  if (!voiceId) throw new ElevenLabsError("ELEVENLABS_VOICE_IDが設定されていません", 503);
  const normalizedSpelling = String(spelling || "").trim();
  if (!normalizedSpelling) throw new ElevenLabsError("見出し語が必要です", 400);
  const ipa = normalizeIpa(rawIpa);
  const normalizedSpokenText = String(spokenText || normalizedSpelling).trim();
  if (!normalizedSpokenText) throw new ElevenLabsError("読み上げテキストが必要です", 400);

  const dictionaryName = `vocab-${normalizedSpelling.replace(/[^a-z0-9]+/gi, "-").slice(0, 40) || "word"}-${Date.now()}`;
  let dictionaryId = null;
  let versionId = null;
  try {
    if (forcePronunciation) {
      const dictionaryResponse = await elevenLabsRequest(
        fetchImpl,
        `${apiBase}/pronunciation-dictionaries/add-from-rules`,
        apiKey,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            name: dictionaryName,
            description: "Temporary crossover pronunciation",
            rules: [
              {
                type: "phoneme",
                alphabet: "ipa",
                string_to_replace: normalizedSpelling,
                phoneme: ipa,
              },
            ],
          }),
        },
        "発音辞書を作成できませんでした"
      );
      const dictionary = await dictionaryResponse.json();
      dictionaryId = dictionary.id || dictionary.pronunciation_dictionary_id;
      versionId = dictionary.version_id;
      if (!dictionaryId || !versionId) {
        throw new ElevenLabsError("ElevenLabsから発音辞書IDを取得できませんでした");
      }
    }

    const audioResponse = await elevenLabsRequest(
      fetchImpl,
      `${apiBase}/text-to-speech/${encodeURIComponent(voiceId)}?output_format=${encodeURIComponent(outputFormat)}`,
      apiKey,
      {
        method: "POST",
        headers: {
          accept: "audio/mpeg",
          "content-type": "application/json",
        },
        body: JSON.stringify({
          text: normalizedSpokenText,
          model_id: modelId,
          ...(previousText ? { previous_text: String(previousText) } : {}),
          ...(nextText ? { next_text: String(nextText) } : {}),
          ...(dictionaryId
            ? {
                pronunciation_dictionary_locators: [
                  {
                    pronunciation_dictionary_id: dictionaryId,
                    version_id: versionId,
                  },
                ],
              }
            : {}),
        }),
      },
      "音声を生成できませんでした"
    );

    return {
      bytes: new Uint8Array(await audioResponse.arrayBuffer()),
      contentType: audioResponse.headers.get("content-type") || "audio/mpeg",
      ipa,
      pronunciationMode: forcePronunciation ? "ipa" : "native",
    };
  } finally {
    if (dictionaryId) {
      try {
        await elevenLabsRequest(
          fetchImpl,
          `${apiBase}/pronunciation-dictionaries/${encodeURIComponent(dictionaryId)}`,
          apiKey,
          { method: "DELETE" },
          "一時発音辞書を削除できませんでした"
        );
      } catch (error) {
        console.warn("Failed to delete temporary ElevenLabs pronunciation dictionary", error);
      }
    }
  }
}
