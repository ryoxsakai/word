import {
  DEFAULT_MODEL_ID,
  DEFAULT_VOICE_ID,
  generateWordAudio,
  IPA_PROVIDER,
  NATIVE_PROVIDER,
} from "./word-audio.js";

const DEFAULT_BATCH_SIZE = 5;
const MAX_BATCH_SIZE = 20;
const MAX_RETRY_DELAY_SECONDS = 24 * 60 * 60;
const STUCK_JOB_MINUTES = 15;
const AUTOMATIC_AUDIO_LIST_ID = "crossover-v3";

export function automaticAudioEnabled(env) {
  return String(env?.AUDIO_AUTO_ENABLED ?? "true").trim().toLowerCase() !== "false";
}

function batchSize(raw) {
  const parsed = Number.parseInt(String(raw ?? ""), 10);
  if (!Number.isFinite(parsed) || parsed < 1) return DEFAULT_BATCH_SIZE;
  return Math.min(parsed, MAX_BATCH_SIZE);
}

function errorText(error) {
  return String(error?.message || error || "unknown audio generation error").slice(0, 500);
}

function retryDelaySeconds(attempts) {
  return Math.min(MAX_RETRY_DELAY_SECONDS, 60 * 2 ** Math.min(Math.max(attempts, 0), 11));
}

// crossoverの収録語と現在のwords/word_audioを正として待ち行列を整える。
export async function reconcileAutomaticAudioJobs(env) {
  const voiceId = env.ELEVENLABS_VOICE_ID || DEFAULT_VOICE_ID;
  const modelId = env.ELEVENLABS_MODEL_ID || DEFAULT_MODEL_ID;
  await env.DB.batch([
    env.DB.prepare(
      `UPDATE word_audio
       SET is_stale = 1
       WHERE variant_key = 'primary'
         AND is_stale = 0
         AND EXISTS (
           SELECT 1
           FROM words w
           JOIN list_items li ON li.word_id = w.id
           WHERE w.id = word_audio.word_id
             AND li.list_id = '${AUTOMATIC_AUDIO_LIST_ID}'
             AND (
               word_audio.provider <> CASE
                 WHEN w.pronunciation_caution = 1 THEN '${IPA_PROVIDER}'
                 ELSE '${NATIVE_PROVIDER}'
               END
               OR word_audio.voice_id <> ?
               OR word_audio.model_id <> ?
             )
           )`
    ).bind(voiceId, modelId),
    env.DB.prepare(
      `UPDATE words
       SET audio_url = NULL
       WHERE EXISTS (
         SELECT 1 FROM list_items li
         WHERE li.list_id = '${AUTOMATIC_AUDIO_LIST_ID}' AND li.word_id = words.id
       )
       AND NOT EXISTS (
         SELECT 1 FROM word_audio a
         WHERE a.word_id = words.id
           AND a.variant_key = 'primary'
           AND a.is_stale = 0
           AND a.provider = CASE
             WHEN words.pronunciation_caution = 1 THEN '${IPA_PROVIDER}'
             ELSE '${NATIVE_PROVIDER}'
           END
           AND a.voice_id = ?
           AND a.model_id = ?
       )`
    ).bind(voiceId, modelId),
    env.DB.prepare(
      `DELETE FROM word_audio_jobs
       WHERE variant_key = 'primary'
         AND (
           NOT EXISTS (
             SELECT 1 FROM words w
             WHERE w.id = word_audio_jobs.word_id
               AND TRIM(COALESCE(w.pronunciation, '')) <> ''
           )
           OR NOT EXISTS (
             SELECT 1 FROM list_items li
             WHERE li.list_id = '${AUTOMATIC_AUDIO_LIST_ID}'
               AND li.word_id = word_audio_jobs.word_id
           )
           OR EXISTS (
             SELECT 1 FROM word_audio a
             WHERE a.word_id = word_audio_jobs.word_id
               AND a.variant_key = 'primary'
               AND a.is_stale = 0
               AND a.provider = (
                 SELECT CASE
                   WHEN w.pronunciation_caution = 1 THEN '${IPA_PROVIDER}'
                   ELSE '${NATIVE_PROVIDER}'
                 END
                 FROM words w WHERE w.id = word_audio_jobs.word_id
               )
               AND a.voice_id = ?
               AND a.model_id = ?
           )
         )`
    ).bind(voiceId, modelId),
    env.DB.prepare(
      `UPDATE word_audio_jobs
       SET status = 'retry', next_attempt_at = unixepoch(), updated_at = datetime('now')
       WHERE status = 'processing'
         AND updated_at <= datetime('now', '-${STUCK_JOB_MINUTES} minutes')`
    ),
    env.DB.prepare(
      `INSERT OR IGNORE INTO word_audio_jobs (word_id, variant_key)
       SELECT w.id, 'primary'
       FROM words w
       JOIN list_items li
         ON li.word_id = w.id
        AND li.list_id = '${AUTOMATIC_AUDIO_LIST_ID}'
       LEFT JOIN word_audio a
         ON a.word_id = w.id
        AND a.variant_key = 'primary'
        AND a.is_stale = 0
        AND a.provider = CASE
          WHEN w.pronunciation_caution = 1 THEN '${IPA_PROVIDER}'
          ELSE '${NATIVE_PROVIDER}'
        END
        AND a.voice_id = ?
        AND a.model_id = ?
       WHERE TRIM(COALESCE(w.pronunciation, '')) <> ''
         AND a.word_id IS NULL`
    ).bind(voiceId, modelId),
  ]);
}

export async function automaticAudioStatus(env) {
  const voiceId = env.ELEVENLABS_VOICE_ID || DEFAULT_VOICE_ID;
  const modelId = env.ELEVENLABS_MODEL_ID || DEFAULT_MODEL_ID;
  const [eligible, generated, jobs, recentErrors] = await env.DB.batch([
    env.DB.prepare(
      `SELECT COUNT(*) AS count
       FROM words w
       JOIN list_items li
         ON li.word_id = w.id
        AND li.list_id = '${AUTOMATIC_AUDIO_LIST_ID}'
       WHERE TRIM(COALESCE(w.pronunciation, '')) <> ''`
    ),
    env.DB.prepare(
      `SELECT COUNT(*) AS count
       FROM word_audio a
       JOIN list_items li
         ON li.word_id = a.word_id
        AND li.list_id = '${AUTOMATIC_AUDIO_LIST_ID}'
       JOIN words w ON w.id = a.word_id
       WHERE a.variant_key = 'primary'
         AND a.is_stale = 0
         AND a.provider = CASE
           WHEN w.pronunciation_caution = 1 THEN '${IPA_PROVIDER}'
           ELSE '${NATIVE_PROVIDER}'
         END
         AND a.voice_id = ?
         AND a.model_id = ?`
    ).bind(voiceId, modelId),
    env.DB.prepare(
      `SELECT COUNT(*) AS queued,
              SUM(CASE WHEN j.status = 'pending' THEN 1 ELSE 0 END) AS pending,
              SUM(CASE WHEN j.status = 'processing' THEN 1 ELSE 0 END) AS processing,
              SUM(CASE WHEN j.status = 'retry' THEN 1 ELSE 0 END) AS retrying
       FROM word_audio_jobs j
       JOIN list_items li
         ON li.word_id = j.word_id
        AND li.list_id = '${AUTOMATIC_AUDIO_LIST_ID}'`
    ),
    env.DB.prepare(
      `SELECT j.word_id AS wordId, j.attempts, j.last_error AS error, j.updated_at AS updatedAt
       FROM word_audio_jobs j
       JOIN list_items li
         ON li.word_id = j.word_id
        AND li.list_id = '${AUTOMATIC_AUDIO_LIST_ID}'
       WHERE j.last_error IS NOT NULL
       ORDER BY j.updated_at DESC, j.word_id
       LIMIT 10`
    ),
  ]);
  const first = (result) => result?.results?.[0] || {};
  return {
    enabled: automaticAudioEnabled(env),
    voiceId,
    modelId,
    eligible: Number(first(eligible).count || 0),
    generated: Number(first(generated).count || 0),
    queued: Number(first(jobs).queued || 0),
    pending: Number(first(jobs).pending || 0),
    processing: Number(first(jobs).processing || 0),
    retrying: Number(first(jobs).retrying || 0),
    recentErrors: (recentErrors?.results || []).map((row) => ({ ...row })),
  };
}

export async function processAutomaticAudio(
  env,
  { generate = generateWordAudio, limit = batchSize(env.AUDIO_AUTO_BATCH_SIZE), now = Date.now } = {}
) {
  await reconcileAutomaticAudioJobs(env);
  const { results: jobs } = await env.DB
    .prepare(
      `SELECT word_id AS wordId, attempts
       FROM word_audio_jobs
       WHERE status IN ('pending', 'retry')
         AND next_attempt_at <= unixepoch()
       ORDER BY next_attempt_at, created_at, word_id
       LIMIT ?`
    )
    .bind(batchSize(limit))
    .all();

  const summary = { selected: jobs.length, generated: 0, failed: 0, failures: [] };
  for (const job of jobs) {
    const claim = await env.DB
      .prepare(
        `UPDATE word_audio_jobs
         SET status = 'processing', updated_at = datetime('now')
         WHERE word_id = ? AND variant_key = 'primary'
           AND status IN ('pending', 'retry')`
      )
      .bind(job.wordId)
      .run();
    if (!claim.meta?.changes) continue;

    try {
      await generate(env, job.wordId, { variantKey: "primary" });
      summary.generated += 1;
    } catch (error) {
      const message = errorText(error);
      const attempts = Number(job.attempts || 0) + 1;
      const nextAttemptAt = Math.floor(now() / 1000) + retryDelaySeconds(attempts);
      await env.DB
        .prepare(
          `UPDATE word_audio_jobs
           SET status = 'retry', attempts = ?, last_error = ?, next_attempt_at = ?,
               updated_at = datetime('now')
           WHERE word_id = ? AND variant_key = 'primary'`
        )
        .bind(attempts, message, nextAttemptAt, job.wordId)
        .run();
      summary.failed += 1;
      summary.failures.push({ wordId: job.wordId, error: message });
    }
  }
  return summary;
}
