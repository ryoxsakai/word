import assert from "node:assert/strict";
import { mkdtempSync, readdirSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Miniflare } from "miniflare";
import { handleMcpRoute } from "../src/mcp.js";

const stateDir = mkdtempSync(join(tmpdir(), "vocab-mcp-write-"));
const issuer = "https://integration.cloudflareaccess.com";
const audience = "integration-audience";
const kid = "integration-key";
const originalFetch = globalThis.fetch;
const miniflare = new Miniflare({
  modules: true,
  script: 'export default { fetch() { return new Response("ok"); } }',
  compatibilityDate: "2024-11-01",
  d1Databases: ["DB"],
  d1Persist: stateDir,
});

function encode(value) {
  return Buffer.from(typeof value === "string" ? value : JSON.stringify(value)).toString("base64url");
}

async function signedJwt(privateKey, payload) {
  const header = encode({ alg: "RS256", typ: "JWT", kid });
  const body = encode(payload);
  const input = header + "." + body;
  const signature = await crypto.subtle.sign("RSASSA-PKCS1-v1_5", privateKey, new TextEncoder().encode(input));
  return input + "." + Buffer.from(signature).toString("base64url");
}

async function rpc(env, accessToken, path, id, method, params = {}, authenticated = false) {
  const request = new Request("http://127.0.0.1" + path, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json, text/event-stream",
      ...(authenticated ? { "Cf-Access-Jwt-Assertion": accessToken } : {}),
    },
    body: JSON.stringify({ jsonrpc: "2.0", id, method, params }),
  });
  const response = await handleMcpRoute(request, env);
  assert.equal(response.status, 200);
  return await response.json();
}

function toolResult(message) {
  assert.ok(message.result, JSON.stringify(message));
  assert.equal(message.result.isError, false, JSON.stringify(message));
  return message.result.structuredContent;
}

try {
  const keyPair = await crypto.subtle.generateKey(
    { name: "RSASSA-PKCS1-v1_5", modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: "SHA-256" },
    true,
    ["sign", "verify"]
  );
  const jwk = await crypto.subtle.exportKey("jwk", keyPair.publicKey);
  jwk.kid = kid;
  jwk.alg = "RS256";
  jwk.use = "sig";
  const now = Math.floor(Date.now() / 1000);
  const accessToken = await signedJwt(keyPair.privateKey, {
    iss: issuer,
    aud: audience,
    sub: "integration-user",
    email: "integration@example.com",
    exp: now + 300,
  });
  globalThis.fetch = async (url) => {
    assert.equal(String(url), issuer + "/cdn-cgi/access/certs");
    return Response.json({ keys: [jwk] });
  };

  const db = await miniflare.getD1Database("DB");
  const migrationDir = new URL("../migrations/", import.meta.url);
  for (const filename of readdirSync(migrationDir).filter((name) => name.endsWith(".sql")).sort()) {
    const sql = readFileSync(new URL(filename, migrationDir), "utf8").replace(/^\s*--.*$/gm, "");
    const statements = sql
      .split(";")
      .map((statement) => statement.trim().replace(/\s+/g, " "))
      .filter(Boolean)
      .map((statement) => statement + ";")
      .join("\n");
    await db.exec(statements);
  }
  const env = { DB: db, CF_ACCESS_TEAM_DOMAIN: issuer, CF_ACCESS_AUD: audience };

  const publicTools = await rpc(env, accessToken, "/mcp", 1, "tools/list");
  assert.equal(publicTools.result.tools.length, 10);
  assert.ok(publicTools.result.tools.every((tool) => tool.annotations.readOnlyHint === true));

  const editableTools = await rpc(env, accessToken, "/mcp-write", 2, "tools/list");
  assert.equal(editableTools.result.tools.length, 40);
  assert.ok(editableTools.result.tools.some((tool) => tool.name === "vocab.create_notebook"));
  assert.ok(editableTools.result.tools.some((tool) => tool.name === "remove_words_from_notebook" && tool.annotations.destructiveHint));

  const unauthorized = await rpc(env, accessToken, "/mcp-write", 3, "tools/call", {
    name: "create_notebook",
    arguments: { name: "Unauthorized" },
  });
  assert.equal(unauthorized.result.isError, true);
  assert.match(unauthorized.result.content[0].text, /not configured|authentication/i);

  const createdNotebook = toolResult(
    await rpc(
      env,
      accessToken,
      "/mcp-write",
      4,
      "tools/call",
      {
        name: "vocab.create_notebook",
        arguments: {
          name: "医学部重要語彙",
          description: "MCP integration test",
          chapters: [
            {
              subtitle: "基礎",
              sections: [{ subtitle: "動詞" }, { subtitle: "名詞" }],
            },
          ],
        },
      },
      true
    )
  );
  assert.equal(createdNotebook.created, true);
  assert.equal(createdNotebook.chapters.length, 1);
  assert.equal(createdNotebook.sections.length, 2);
  const listId = createdNotebook.notebook.id;
  const sectionId = createdNotebook.sections[0].id;
  const secondSectionId = createdNotebook.sections[1].id;
  const firstChapterId = createdNotebook.chapters[0].id;

  const updatedNotebook = toolResult(
    await rpc(
      env,
      accessToken,
      "/mcp-write",
      41,
      "tools/call",
      {
        name: "update_notebook",
        arguments: {
          list_id: listId,
          description: "Updated by integration test",
          section_label: "Unit",
          chapter_label: "Module",
        },
      },
      true
    )
  );
  assert.equal(updatedNotebook.notebook.sectionLabel, "Unit");
  assert.equal(updatedNotebook.notebook.chapterLabel, "Module");

  const secondChapter = toolResult(
    await rpc(
      env,
      accessToken,
      "/mcp-write",
      42,
      "tools/call",
      {
        name: "create_chapter",
        arguments: { list_id: listId, subtitle: "応用" },
      },
      true
    )
  );
  assert.equal(secondChapter.created, true);
  const secondChapterId = secondChapter.chapter.id;

  const updatedChapter = toolResult(
    await rpc(
      env,
      accessToken,
      "/mcp-write",
      43,
      "tools/call",
      {
        name: "update_chapter",
        arguments: { list_id: listId, chapter_id: secondChapterId, description: "応用語彙" },
      },
      true
    )
  );
  assert.equal(updatedChapter.chapter.description, "応用語彙");

  const thirdSection = toolResult(
    await rpc(
      env,
      accessToken,
      "/mcp-write",
      44,
      "tools/call",
      {
        name: "create_section",
        arguments: { list_id: listId, chapter_id: secondChapterId, subtitle: "形容詞" },
      },
      true
    )
  );
  assert.equal(thirdSection.created, true);
  const thirdSectionId = thirdSection.section.id;

  const updatedSection = toolResult(
    await rpc(
      env,
      accessToken,
      "/mcp-write",
      45,
      "tools/call",
      {
        name: "update_section",
        arguments: { list_id: listId, section_id: thirdSectionId, description: "重要形容詞" },
      },
      true
    )
  );
  assert.equal(updatedSection.section.description, "重要形容詞");

  const reorderedChapters = toolResult(
    await rpc(
      env,
      accessToken,
      "/mcp-write",
      46,
      "tools/call",
      {
        name: "reorder_chapters",
        arguments: { list_id: listId, chapter_ids: [secondChapterId, firstChapterId] },
      },
      true
    )
  );
  assert.deepEqual(reorderedChapters.chapterIds, [secondChapterId, firstChapterId]);

  const reorderedSections = toolResult(
    await rpc(
      env,
      accessToken,
      "/mcp-write",
      47,
      "tools/call",
      {
        name: "reorder_sections",
        arguments: {
          list_id: listId,
          sections: [
            { section_id: thirdSectionId, chapter_id: secondChapterId },
            { section_id: sectionId, chapter_id: firstChapterId },
            { section_id: secondSectionId, chapter_id: firstChapterId },
          ],
        },
      },
      true
    )
  );
  assert.equal(reorderedSections.sectionCount, 3);

  const reorderedNotebooks = toolResult(
    await rpc(
      env,
      accessToken,
      "/mcp-write",
      48,
      "tools/call",
      { name: "reorder_notebooks", arguments: { list_ids: [listId] } },
      true
    )
  );
  assert.deepEqual(reorderedNotebooks.listIds, [listId]);

  const structure = toolResult(
    await rpc(env, accessToken, "/mcp-write", 49, "tools/call", {
      name: "get_notebook_structure",
      arguments: { list_id: listId },
    })
  );
  assert.equal(Number(structure.chapters[0].id), secondChapterId);
  assert.equal(Number(structure.chapters[0].sections[0].id), thirdSectionId);

  const createdWords = toolResult(
    await rpc(
      env,
      accessToken,
      "/mcp-write",
      5,
      "tools/call",
      {
        name: "create_words",
        arguments: {
          list_id: listId,
          section_id: sectionId,
          words: [
            {
              spelling: "abandon",
              pronunciation: "əbændən",
              senses: [{ pos: "動", meaning: "捨てる", is_primary: true }],
              examples: [{ sentence: "They abandoned the plan.", translation: "彼らは計画を断念した。" }],
              tags: { "custom:medical": "important" },
            },
            { spelling: "benign", senses: [{ pos: "形", meaning: "良性の" }] },
          ],
        },
      },
      true
    )
  );
  assert.equal(createdWords.createdCount, 2);
  const abandonId = createdWords.created.find((word) => word.spelling === "abandon").id;
  const benignId = createdWords.created.find((word) => word.spelling === "benign").id;

  const derivedWord = toolResult(
    await rpc(
      env,
      accessToken,
      "/mcp-write",
      52,
      "tools/call",
      {
        name: "create_words",
        arguments: {
          list_id: listId,
          section_id: sectionId,
          words: [
            {
              spelling: "abandonment",
              derived_from_word_id: abandonId,
              senses: [{ pos: "名", meaning: "放棄" }],
            },
          ],
        },
      },
      true
    )
  );
  assert.equal(derivedWord.createdCount, 1);

  const familyListing = toolResult(
    await rpc(env, accessToken, "/mcp-write", 53, "tools/call", {
      name: "list_words",
      arguments: { list_id: listId, query: "abandon" },
    })
  );
  const abandonMembership = familyListing.words.find((word) => word.spelling === "abandon");
  const derivedMembership = familyListing.words.find((word) => word.spelling === "abandonment");
  assert.equal(derivedMembership.no, abandonMembership.no);
  assert.equal(derivedMembership.branch, 1);

  const duplicate = toolResult(
    await rpc(
      env,
      accessToken,
      "/mcp-write",
      6,
      "tools/call",
      { name: "create_words", arguments: { words: [{ spelling: "Abandon" }] } },
      true
    )
  );
  assert.equal(duplicate.createdCount, 0);
  assert.equal(duplicate.duplicateCount, 1);

  const unattachedWord = toolResult(
    await rpc(
      env,
      accessToken,
      "/mcp-write",
      50,
      "tools/call",
      {
        name: "create_words",
        arguments: { words: [{ spelling: "lesion", senses: [{ pos: "名", meaning: "病変" }] }] },
      },
      true
    )
  );
  assert.equal(unattachedWord.createdCount, 1);
  const lesionId = unattachedWord.created[0].id;

  const addedExisting = toolResult(
    await rpc(
      env,
      accessToken,
      "/mcp-write",
      51,
      "tools/call",
      {
        name: "add_words_to_notebook",
        arguments: { list_id: listId, section_id: thirdSectionId, spellings: ["lesion"] },
      },
      true
    )
  );
  assert.equal(addedExisting.addedCount, 1);
  assert.equal(addedExisting.added[0].id, lesionId);

  const updatedWord = toolResult(
    await rpc(
      env,
      accessToken,
      "/mcp-write",
      7,
      "tools/call",
      {
        name: "update_word",
        arguments: { word_id: abandonId, notes: "重要語", usage_caution: true },
      },
      true
    )
  );
  assert.equal(updatedWord.updated, true);

  const wordDetail = toolResult(
    await rpc(env, accessToken, "/mcp-write", 8, "tools/call", {
      name: "get_word",
      arguments: { word_id: abandonId },
    })
  );
  assert.equal(wordDetail.notes, "重要語");
  assert.equal(wordDetail.usageCaution, true);
  assert.equal(wordDetail.senses[0].meaning, "捨てる");

  const moved = toolResult(
    await rpc(
      env,
      accessToken,
      "/mcp-write",
      9,
      "tools/call",
      { name: "move_words", arguments: { list_id: listId, word_ids: [benignId], section_id: null } },
      true
    )
  );
  assert.equal(moved.movedCount, 1);

  const wrongConfirmation = await rpc(
    env,
    accessToken,
    "/mcp-write",
    10,
    "tools/call",
    {
      name: "remove_words_from_notebook",
      arguments: { list_id: listId, word_ids: [benignId], confirm_notebook_name: "wrong" },
    },
    true
  );
  assert.equal(wrongConfirmation.result.isError, true);

  const removed = toolResult(
    await rpc(
      env,
      accessToken,
      "/mcp-write",
      11,
      "tools/call",
      {
        name: "remove_words_from_notebook",
        arguments: { list_id: listId, word_ids: [benignId], confirm_notebook_name: "医学部重要語彙" },
      },
      true
    )
  );
  assert.equal(removed.removedCount, 1);
  assert.equal(removed.masterWordsDeleted, false);

  const benignDetail = toolResult(
    await rpc(env, accessToken, "/mcp-write", 12, "tools/call", {
      name: "get_word",
      arguments: { word_id: benignId },
    })
  );
  assert.equal(benignDetail.spelling, "benign");
  assert.equal(benignDetail.notebooks.length, 0);

  const auditLog = toolResult(
    await rpc(
      env,
      accessToken,
      "/mcp-write",
      13,
      "tools/call",
      { name: "list_recent_changes", arguments: { limit: 20 } },
      true
    )
  );
  assert.ok(auditLog.changes.length >= 15);
  assert.ok(auditLog.changes.every((change) => change.actor === "integration@example.com"));

  console.log("MCP write integration test passed");
} finally {
  globalThis.fetch = originalFetch;
  await miniflare.dispose();
  rmSync(stateDir, { recursive: true, force: true });
}
