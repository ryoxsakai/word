import { ElevenLabsError, synthesizeWordWithIpa } from "./elevenlabs.js";

const PRIMARY_VARIANT = "primary";
export const DEFAULT_VOICE_ID = "Sq93GQT4X1lKDXsQcixO";
export const DEFAULT_MODEL_ID = "eleven_multilingual_v2";
// 先頭大文字＋ピリオドの生成方式を旧・単語単体方式と区別し、全件を確実に再生成する。
export const NATIVE_PROVIDER = "elevenlabs-native-period";
export const IPA_PROVIDER = "elevenlabs-ipa";

export function punctuatedHeadword(spelling) {
  const value = String(spelling || "").trim().replace(/[.!?]+$/u, "");
  if (!value) return "";
  return `${value.charAt(0).toUpperCase()}${value.slice(1)}.`;
}

function variantKey(raw) {
  const value = String(raw || PRIMARY_VARIANT).trim().toLowerCase();
  if (!/^[a-z0-9_-]{1,32}$/.test(value)) {
    throw new ElevenLabsError("音声のvariantKeyが不正です", 400);
  }
  return value;
}

export function generatedAudioUrl(wordId, variant, generatedAt) {
  const version = new Date(generatedAt).getTime() || Date.now();
  return `/mcp-viewer/api/audio/${encodeURIComponent(wordId)}/${encodeURIComponent(variant)}?v=${version}`;
}

export async function loadGeneratedAudio(db, wordId, variant = PRIMARY_VARIANT) {
  const row = await db
    .prepare(
      `SELECT variant_key AS variantKey, pos, ipa, provider, voice_id AS voiceId,
              model_id AS modelId, content_type AS contentType, generated_at AS generatedAt
       FROM word_audio WHERE word_id = ? AND variant_key = ? AND is_stale = 0`
    )
    .bind(wordId, variant)
    .first();
  if (!row) return null;
  return { ...row, url: generatedAudioUrl(wordId, row.variantKey, row.generatedAt) };
}

export async function generateWordAudio(env, wordId, body = {}) {
  if (!env.AUDIO_BUCKET) throw new ElevenLabsError("AUDIO_BUCKETが設定されていません", 503);
  const word = await env.DB
    .prepare(
      `SELECT w.id, w.spelling, w.pronunciation,
              w.pronunciation_caution AS pronunciationCaution,
              (SELECT s.pos FROM senses s WHERE s.word_id = w.id AND s.is_primary = 1
               ORDER BY s.sort_order, s.id LIMIT 1) AS primaryPos
       FROM words w WHERE w.id = ?`
    )
    .bind(wordId)
    .first();
  if (!word) throw new ElevenLabsError("word not found", 404);

  const variant = variantKey(body.variantKey);
  const ipa = variant === PRIMARY_VARIANT ? word.pronunciation : body.ipa || word.pronunciation;
  const rawPos = variant === PRIMARY_VARIANT ? word.primaryPos : body.pos;
  const pos = rawPos == null ? null : String(rawPos).trim().slice(0, 50) || null;
  const voiceId = env.ELEVENLABS_VOICE_ID || DEFAULT_VOICE_ID;
  const modelId = env.ELEVENLABS_MODEL_ID || DEFAULT_MODEL_ID;
  const previous = await env.DB
    .prepare("SELECT object_key AS objectKey FROM word_audio WHERE word_id = ? AND variant_key = ?")
    .bind(wordId, variant)
    .first();

  const forcePronunciation =
    body.forcePronunciation == null
      ? variant !== PRIMARY_VARIANT
      : Boolean(body.forcePronunciation);
  const spokenText =
    body.spokenText ?? (variant === PRIMARY_VARIANT ? punctuatedHeadword(word.spelling) : undefined);
  const audio = await synthesizeWordWithIpa({
    apiKey: env.ELEVENLABS_API_KEY,
    voiceId,
    modelId,
    spelling: word.spelling,
    ipa,
    forcePronunciation,
    spokenText,
    previousText: body.previousText,
    nextText: body.nextText,
  });
  const provider = audio.pronunciationMode === "ipa" ? IPA_PROVIDER : NATIVE_PROVIDER;

  const generatedAt = new Date().toISOString();
  const objectKey = `words/${encodeURIComponent(wordId)}/${variant}-${Date.now()}-${crypto.randomUUID()}.mp3`;
  await env.AUDIO_BUCKET.put(objectKey, audio.bytes, {
    httpMetadata: { contentType: audio.contentType },
    customMetadata: {
      wordId,
      variant,
      provider,
      voiceId,
      modelId,
    },
  });

  try {
    await env.DB.batch([
      env.DB
        .prepare(
          `INSERT INTO word_audio
             (word_id, variant_key, pos, ipa, source_spelling, provider, voice_id, model_id, object_key, content_type, generated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
           ON CONFLICT(word_id, variant_key) DO UPDATE SET
             pos = excluded.pos,
             ipa = excluded.ipa,
             source_spelling = excluded.source_spelling,
             provider = excluded.provider,
             voice_id = excluded.voice_id,
             model_id = excluded.model_id,
             object_key = excluded.object_key,
             content_type = excluded.content_type,
             generated_at = excluded.generated_at,
             is_stale = 0`
        )
        .bind(wordId, variant, pos, audio.ipa, word.spelling, provider, voiceId, modelId, objectKey, audio.contentType, generatedAt),
      ...(variant === PRIMARY_VARIANT
        ? [
            env.DB
              .prepare("UPDATE words SET audio_url = ?, updated_at = datetime('now') WHERE id = ?")
              .bind(generatedAudioUrl(wordId, variant, generatedAt), wordId),
          ]
        : []),
      env.DB
        .prepare("DELETE FROM word_audio_jobs WHERE word_id = ? AND variant_key = ?")
        .bind(wordId, variant),
    ]);
  } catch (error) {
    await env.AUDIO_BUCKET.delete(objectKey);
    throw error;
  }

  if (previous?.objectKey && previous.objectKey !== objectKey) {
    try {
      await env.AUDIO_BUCKET.delete(previous.objectKey);
    } catch (error) {
      console.warn("Failed to delete superseded pronunciation audio", error);
    }
  }
  return await loadGeneratedAudio(env.DB, wordId, variant);
}

// 確認ページ専用の音声だけを、未生成の場合に一度生成する。
export async function generatePronunciationReviewSamples(env) {
  const samples = [
    {
      wordId: "transfer",
      variantKey: "sample-native",
      forcePronunciation: false,
    },
    {
      wordId: "transfer",
      variantKey: "sample-context",
      forcePronunciation: false,
      previousText: "They will",
      nextText: "the patient to another hospital.",
    },
    {
      wordId: "come",
      variantKey: "sample-period",
      forcePronunciation: false,
      spokenText: "Come.",
    },
    {
      wordId: "respectable",
      variantKey: "sample-period",
      forcePronunciation: false,
      spokenText: "Respectable.",
    },
  ];
  const generated = [];
  for (const sample of samples) {
    if (await loadGeneratedAudio(env.DB, sample.wordId, sample.variantKey)) continue;
    generated.push(await generateWordAudio(env, sample.wordId, sample));
  }
  return generated;
}

export async function serveWordAudio(request, env, wordId, rawVariant = PRIMARY_VARIANT) {
  if (!env.AUDIO_BUCKET) return new Response("audio storage unavailable", { status: 503 });
  let variant;
  try {
    variant = variantKey(rawVariant);
  } catch {
    return new Response("not found", { status: 404 });
  }
  const row = await env.DB
    .prepare("SELECT object_key AS objectKey, content_type AS contentType FROM word_audio WHERE word_id = ? AND variant_key = ? AND is_stale = 0")
    .bind(wordId, variant)
    .first();
  if (!row) return new Response("not found", { status: 404 });

  const object = await env.AUDIO_BUCKET.get(row.objectKey);
  if (!object) return new Response("not found", { status: 404 });
  const headers = new Headers({
    "content-type": row.contentType || object.httpMetadata?.contentType || "audio/mpeg",
    "cache-control": "public, max-age=31536000, immutable",
    etag: object.httpEtag,
  });
  if (object.size != null) headers.set("content-length", String(object.size));
  if (request.method === "HEAD") return new Response(null, { headers });
  return new Response(object.body, { headers });
}
