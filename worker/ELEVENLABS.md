# ElevenLabs pronunciation audio

The editor can generate a pronunciation clip from a headword and one IPA value. Ordinary words use ElevenLabs' native English pronunciation. Words with the pronunciation-caution flag use a temporary IPA pronunciation dictionary so heteronyms such as verb `permit` retain the intended stress. The generated MP3 is stored in the `vocab-audio` R2 bucket, and temporary dictionaries are deleted after generation. The viewer serves the saved clip and falls back to the Web Speech API when no saved clip is available or playback fails.

## Required secret

Set the ElevenLabs API key as a Cloudflare Worker secret. Do not add the key to `wrangler.toml` or the repository.

```sh
npx wrangler secret put ELEVENLABS_API_KEY
```

The deploy workflow creates the `vocab-audio` R2 bucket if it does not exist. The default voice and model are configured in `wrangler.toml` and can be overridden with `ELEVENLABS_VOICE_ID` and `ELEVENLABS_MODEL_ID`.

## Automatic generation

A scheduled Worker run processes up to `AUDIO_AUTO_BATCH_SIZE` headwords every minute.  Existing headwords with one IPA value are queued by the migration, and new or pronunciation-updated headwords are queued automatically.  Successfully generated clips leave the queue.  Failed entries use exponential backoff, so one malformed IPA or a temporary ElevenLabs failure does not block later headwords.

The authenticated editor status endpoint is `GET /mcp-editor/api/audio-generation/status`.  A read-only operational status is also available at `GET /mcp-viewer/api/audio-generation/status`.  They report eligible, generated, queued, processing, and retrying counts together with recent generation errors.  Manual generation remains available and removes the corresponding automatic job after success.

## Editorial workflow

1. Save the headword and one primary IPA value. Enable the pronunciation-caution flag only when the selected sense requires an explicit IPA override.
2. Reopen the word editor and select the wand button beside the pronunciation controls.
3. Confirm the generated pronunciation. Regenerating replaces the primary clip and removes the previous R2 object.
4. The public viewer automatically prefers the generated clip.

Audio metadata retains the IPA, part of speech, provider, voice, model, and generation time. The schema supports additional variants for heteronyms, while the current editor generates the `primary` variant.
