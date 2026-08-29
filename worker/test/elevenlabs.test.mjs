import assert from "node:assert/strict";
import { normalizeIpa, synthesizeWordWithIpa } from "../src/elevenlabs.js";

assert.equal(normalizeIpa("/pəˈmɪt/"), "pəˈmɪt");
assert.equal(normalizeIpa("[ˈpɝːmɪt]"), "ˈpɝːmɪt");
assert.throws(() => normalizeIpa("動 /pəˈmɪt/、名 /ˈpɝːmɪt/"), /複数/);

const calls = [];
const fetchImpl = async (url, init) => {
  calls.push({ url, init });
  if (url.endsWith("/pronunciation-dictionaries/add-from-rules")) {
    return Response.json({ id: "dictionary-1", version_id: "version-1" });
  }
  if (url.includes("/text-to-speech/voice-1")) {
    return new Response(new Uint8Array([1, 2, 3]), { headers: { "content-type": "audio/mpeg" } });
  }
  if (url.endsWith("/pronunciation-dictionaries/dictionary-1") && init.method === "DELETE") {
    return new Response(null, { status: 204 });
  }
  return Response.json({ detail: "unexpected request" }, { status: 500 });
};

const result = await synthesizeWordWithIpa({
  apiKey: "secret",
  voiceId: "voice-1",
  spelling: "permit",
  ipa: "/pəˈmɪt/",
  apiBase: "https://example.test/v1",
  fetchImpl,
});

assert.deepEqual([...result.bytes], [1, 2, 3]);
assert.equal(result.ipa, "pəˈmɪt");
assert.equal(calls.length, 3);
const dictionaryBody = JSON.parse(calls[0].init.body);
assert.deepEqual(dictionaryBody.rules[0], {
  type: "phoneme",
  alphabet: "ipa",
  string_to_replace: "permit",
  phoneme: "pəˈmɪt",
});
const speechBody = JSON.parse(calls[1].init.body);
assert.equal(speechBody.text, "permit");
assert.equal(speechBody.model_id, "eleven_turbo_v2");
assert.deepEqual(speechBody.pronunciation_dictionary_locators[0], {
  pronunciation_dictionary_id: "dictionary-1",
  version_id: "version-1",
});
assert.equal(calls[2].init.method, "DELETE");

console.log("ElevenLabs tests passed");
