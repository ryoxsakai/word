# ElevenLabs pronunciation audio

The editor can generate a pronunciation clip from a headword and one IPA value. The Worker creates a temporary ElevenLabs pronunciation dictionary, generates an MP3, stores it in the `vocab-audio` R2 bucket, and deletes the temporary dictionary. The viewer serves the saved clip and falls back to the Web Speech API when no saved clip is available or playback fails.

## Required secret

Set the ElevenLabs API key as a Cloudflare Worker secret. Do not add the key to `wrangler.toml` or the repository.

```sh
npx wrangler secret put ELEVENLABS_API_KEY
```

The deploy workflow creates the `vocab-audio` R2 bucket if it does not exist. The default voice and model are configured in `wrangler.toml` and can be overridden with `ELEVENLABS_VOICE_ID` and `ELEVENLABS_MODEL_ID`.

## Automatic generation

A scheduled Worker run processes up to `AUDIO_AUTO_BATCH_SIZE` headwords every minute.  Existing headwords with one IPA value are queued by the migration, and new or pronunciation-updated headwords are queued automatically.  Successfully generated clips leave the queue.  Failed entries use exponential backoff, so one malformed IPA or a temporary ElevenLabs failure does not block later headwords.

The authenticated editor status endpoint is `GET /mcp-editor/api/audio-generation/status`.  It reports eligible, generated, queued, processing, and retrying counts.  Manual generation remains available and removes the corresponding automatic job after success.

## Editorial workflow

1. Save the headword and one primary IPA value.
2. Reopen the word editor and select the wand button beside the pronunciation controls.
3. Confirm the generated pronunciation. Regenerating replaces the primary clip and removes the previous R2 object.
4. The public viewer automatically prefers the generated clip.

Audio metadata retains the IPA, part of speech, provider, voice, model, and generation time. The schema supports additional variants for heteronyms, while the current editor generates the `primary` variant.
