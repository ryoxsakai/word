import assert from "node:assert/strict";
import { mkdtempSync, readdirSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Miniflare } from "miniflare";
import { handleMcpRoute } from "../src/mcp.js";

const stateDir = mkdtempSync(join(tmpdir(), "vocab-mcp-write-"));
const miniflare = new Miniflare({
  modules: true,
  script: 'export default { fetch() { return new Response("ok"); } }',
  compatibilityDate: "2024-11-01",
  d1Databases: ["DB"],
  d1Persist: stateDir,
});

async function pkceChallenge(verifier) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(verifier));
  return Buffer.from(digest).toString("base64url");
}

async function rpc(env, accessToken, path, id, method, params = {}, authenticated = path === "/mcp-write") {
  const request = new Request("http://127.0.0.1" + path, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json, text/event-stream",
      ...(authenticated ? { Authorization: "Bearer " + accessToken } : {}),
    },
    body: JSON.stringify({ jsonrpc: "2.0", id, method, params }),
  });
  const response = await handleMcpRoute(request, env);
  return { status: response.status, headers: response.headers, body: await response.json() };
}

function toolResult(message) {
  message = message.body || message;
  assert.ok(message.result, JSON.stringify(message));
  assert.equal(message.result.isError, false, JSON.stringify(message));
  return message.result.structuredContent;
}

function normalizeMigrationSql(sql) {
  const triggers = [];
  const withoutComments = sql.replace(/^\s*--.*$/gm, "");
  const protectedSql = withoutComments.replace(/CREATE\s+TRIGGER[\s\S]*?END\s*;/gi, (trigger) => {
    const marker = `__TRIGGER_${triggers.length}__`;
    triggers.push(trigger.replace(/;\s*$/, "").replace(/\s+/g, " "));
    return `${marker};`;
  });
  return protectedSql
    .split(";")
    .map((statement) => statement.trim().replace(/\s+/g, " "))
    .filter(Boolean)
    .map((statement) => statement.replace(/__TRIGGER_(\d+)__/g, (_match, index) => triggers[Number(index)]))
    .map((statement) => statement + ";")
    .join("\n");
}

try {
  const db = await miniflare.getD1Database("DB");
  const migrationDir = new URL("../migrations/", import.meta.url);
  for (const filename of readdirSync(migrationDir).filter((name) => name.endsWith(".sql")).sort()) {
    const sql = readFileSync(new URL(filename, migrationDir), "utf8");
    await db.exec(normalizeMigrationSql(sql));
  }

  await db.prepare("INSERT OR IGNORE INTO words (id, spelling) VALUES (?, ?)").bind("charge", "charge").run();
  await db.prepare("INSERT OR IGNORE INTO words (id, spelling) VALUES (?, ?)").bind("credit", "credit").run();
  const entryMigration = readFileSync(new URL("0021_expand_charge_credit.sql", migrationDir), "utf8");
  await db.exec(normalizeMigrationSql(entryMigration));

  const chargeNounSenses = await db
    .prepare("SELECT meaning FROM senses WHERE word_id = 'charge' AND pos = '名' ORDER BY sort_order")
    .all();
  assert.deepEqual(
    chargeNounSenses.results.map((sense) => sense.meaning),
    ["責任", "料金", "告発", "電荷"]
  );
  const creditedPhrase = await db
    .prepare("SELECT translation FROM examples WHERE word_id = 'credit' AND sentence = 'be credited with A'")
    .first();
  assert.equal(creditedPhrase.translation, "Aをもたらしたと評価される");

  const env = {
    DB: db,
    VOCAB_MCP_API_KEY: "integration-api-key",
    VOCAB_MCP_SESSION_SECRET: "integration-session-secret-that-is-long-and-random",
    MCP_ALLOW_ANONYMOUS_WRITES: "true",
  };

  const protectedMetadata = await handleMcpRoute(
    new Request("http://127.0.0.1/.well-known/oauth-protected-resource/mcp-write"),
    env
  );
  assert.equal(protectedMetadata.status, 200);
  assert.deepEqual((await protectedMetadata.json()).scopes_supported, ["vocab:read", "vocab:write"]);

  const combinedMetadata = await handleMcpRoute(
    new Request("http://127.0.0.1/.well-known/oauth-protected-resource/mcp"),
    env
  );
  assert.equal(combinedMetadata.status, 200);
  assert.equal((await combinedMetadata.json()).resource, "http://127.0.0.1/mcp");

  const authorizationMetadata = await handleMcpRoute(
    new Request("http://127.0.0.1/.well-known/oauth-authorization-server"),
    env
  );
  assert.equal(authorizationMetadata.status, 200);
  assert.equal((await authorizationMetadata.json()).code_challenge_methods_supported[0], "S256");

  const redirectUri = "https://chatgpt.com/connector/oauth/integration";
  const registration = await handleMcpRoute(
    new Request("http://127.0.0.1/oauth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ redirect_uris: [redirectUri], token_endpoint_auth_method: "none" }),
    }),
    env
  );
  assert.equal(registration.status, 201);
  const { client_id: clientId } = await registration.json();
  assert.ok(clientId);

  const verifier = "integration-pkce-verifier-0123456789abcdefghijklmnopqrstuvwxyz";
  const challenge = await pkceChallenge(verifier);
  const authorizationParams = new URLSearchParams({
    response_type: "code",
    client_id: clientId,
    redirect_uri: redirectUri,
    code_challenge: challenge,
    code_challenge_method: "S256",
    scope: "vocab:read vocab:write",
    state: "integration-state",
  });
  const authorizationPage = await handleMcpRoute(
    new Request("http://127.0.0.1/oauth/authorize?" + authorizationParams),
    env
  );
  assert.equal(authorizationPage.status, 200);
  const authorizationHtml = await authorizationPage.text();
  assert.match(authorizationHtml, /Vocab MCP APIキー/);
  assert.doesNotMatch(authorizationHtml, /action="\/oauth\/authorize"/);
  assert.match(
    authorizationPage.headers.get("Content-Security-Policy"),
    /form-action 'self' https:\/\/chatgpt\.com/
  );

  const wrongKey = await handleMcpRoute(
    new Request("http://127.0.0.1/oauth/authorize", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ ...Object.fromEntries(authorizationParams), api_key: "wrong" }),
    }),
    env
  );
  assert.equal(wrongKey.status, 401);

  const authorization = await handleMcpRoute(
    new Request("http://127.0.0.1/oauth/authorize?" + authorizationParams, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ api_key: env.VOCAB_MCP_API_KEY }),
    }),
    env
  );
  assert.equal(authorization.status, 302);
  const authorizationRedirect = new URL(authorization.headers.get("Location"));
  assert.equal(authorizationRedirect.searchParams.get("state"), "integration-state");
  const code = authorizationRedirect.searchParams.get("code");
  assert.ok(code);

  const invalidVerifier = await handleMcpRoute(
    new Request("http://127.0.0.1/oauth/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        code,
        client_id: clientId,
        redirect_uri: redirectUri,
        code_verifier: "wrong-verifier-that-is-long-enough-012345678901234567890",
      }),
    }),
    env
  );
  assert.equal(invalidVerifier.status, 400);
  assert.equal((await invalidVerifier.json()).error, "invalid_grant");

  const tokenResponse = await handleMcpRoute(
    new Request("http://127.0.0.1/oauth/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        code,
        client_id: clientId,
        redirect_uri: redirectUri,
        code_verifier: verifier,
      }),
    }),
    env
  );
  assert.equal(tokenResponse.status, 200);
  const tokenDocument = await tokenResponse.json();
  assert.equal(tokenDocument.expires_in, 3600);
  const accessToken = tokenDocument.access_token;
  assert.ok(accessToken);

  const replay = await handleMcpRoute(
    new Request("http://127.0.0.1/oauth/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        code,
        client_id: clientId,
        redirect_uri: redirectUri,
        code_verifier: verifier,
      }),
    }),
    env
  );
  assert.equal(replay.status, 400);

  const combinedTools = await rpc(env, accessToken, "/mcp", 1, "tools/list");
  assert.equal(combinedTools.status, 200);
  assert.equal(combinedTools.body.result.tools.length, 50);
  assert.equal(
    combinedTools.body.result.tools.find((tool) => tool.name === "list_notebooks").securitySchemes[0].type,
    "noauth"
  );
  assert.equal(
    combinedTools.body.result.tools.find((tool) => tool.name === "update_word").securitySchemes[0].type,
    "noauth"
  );
  assert.ok(combinedTools.body.result.tools.some((tool) => tool.name === "vocab.create_notebook"));
  assert.ok(combinedTools.body.result.tools.some((tool) => tool.name === "create_label"));
  assert.ok(combinedTools.body.result.tools.some((tool) => tool.name === "update_label"));
  assert.ok(combinedTools.body.result.tools.some((tool) => tool.name === "create_group"));
  assert.ok(combinedTools.body.result.tools.some((tool) => tool.name === "update_group"));
  assert.ok(
    combinedTools.body.result.tools.some(
      (tool) => tool.name === "delete_group" && tool.annotations.destructiveHint
    )
  );
  assert.ok(
    combinedTools.body.result.tools.some(
      (tool) => tool.name === "remove_words_from_notebook" && tool.annotations.destructiveHint
    )
  );

  const anonymousRead = await rpc(
    env,
    accessToken,
    "/mcp",
    33,
    "tools/call",
    { name: "list_notebooks", arguments: {} },
    false
  );
  assert.equal(anonymousRead.status, 200);
  assert.equal(anonymousRead.body.result.isError, false);

  const combinedAnonymousWrite = await rpc(
    env,
    accessToken,
    "/mcp",
    34,
    "tools/call",
    { name: "create_notebook", arguments: { name: "Anonymous combined write" } },
    false
  );
  assert.equal(combinedAnonymousWrite.status, 200);
  assert.equal(combinedAnonymousWrite.body.result.isError, false);
  const anonymousListId = JSON.parse(combinedAnonymousWrite.body.result.content[0].text).notebook.id;

  const editableTools = await rpc(env, accessToken, "/mcp-write", 2, "tools/list");
  assert.equal(editableTools.status, 200);
  assert.equal(editableTools.body.result.tools.length, 50);
  assert.ok(editableTools.body.result.tools.every((tool) => tool.securitySchemes[0].type === "oauth2"));
  assert.ok(editableTools.body.result.tools.some((tool) => tool.name === "vocab.create_notebook"));
  assert.ok(editableTools.body.result.tools.some((tool) => tool.name === "create_label"));
  assert.ok(editableTools.body.result.tools.some((tool) => tool.name === "update_label"));
  assert.ok(editableTools.body.result.tools.some((tool) => tool.name === "remove_words_from_notebook" && tool.annotations.destructiveHint));

  const unauthorized = await rpc(
    env,
    accessToken,
    "/mcp-write",
    3,
    "tools/call",
    { name: "create_notebook", arguments: { name: "Unauthorized" } },
    false
  );
  assert.equal(unauthorized.status, 401);
  assert.equal(unauthorized.body.error, "invalid_token");
  assert.match(unauthorized.headers.get("WWW-Authenticate"), /oauth-protected-resource\/mcp-write/);

  const tokenParts = accessToken.split(".");
  tokenParts[2] = (tokenParts[2][0] === "A" ? "B" : "A") + tokenParts[2].slice(1);
  const tampered = await rpc(
    env,
    tokenParts.join("."),
    "/mcp-write",
    30,
    "tools/call",
    { name: "list_notebooks", arguments: {} }
  );
  assert.equal(tampered.status, 401);
  assert.equal(tampered.body.error, "invalid_token");

  const readVerifier = "read-only-pkce-verifier-0123456789abcdefghijklmnopqrstuvwxyz";
  const readAuthorizationParams = new URLSearchParams({
    response_type: "code",
    client_id: clientId,
    redirect_uri: redirectUri,
    code_challenge: await pkceChallenge(readVerifier),
    code_challenge_method: "S256",
    scope: "vocab:read",
    state: "read-only-state",
    api_key: env.VOCAB_MCP_API_KEY,
  });
  const readAuthorization = await handleMcpRoute(
    new Request("http://127.0.0.1/oauth/authorize", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: readAuthorizationParams,
    }),
    env
  );
  assert.equal(readAuthorization.status, 302);
  const readCode = new URL(readAuthorization.headers.get("Location")).searchParams.get("code");
  const readTokenResponse = await handleMcpRoute(
    new Request("http://127.0.0.1/oauth/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        code: readCode,
        client_id: clientId,
        redirect_uri: redirectUri,
        code_verifier: readVerifier,
      }),
    }),
    env
  );
  assert.equal(readTokenResponse.status, 200);
  const readAccessToken = (await readTokenResponse.json()).access_token;
  const readOnlyCall = await rpc(
    env,
    readAccessToken,
    "/mcp-write",
    31,
    "tools/call",
    { name: "list_notebooks", arguments: {} }
  );
  assert.equal(readOnlyCall.status, 200);
  assert.equal(readOnlyCall.body.result.isError, false);
  const forbiddenWrite = await rpc(
    env,
    readAccessToken,
    "/mcp-write",
    32,
    "tools/call",
    { name: "create_notebook", arguments: { name: "Forbidden" } }
  );
  assert.equal(forbiddenWrite.status, 403);
  assert.equal(forbiddenWrite.body.error, "insufficient_scope");

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

  const group = toolResult(
    await rpc(
      env,
      accessToken,
      "/mcp-write",
      431,
      "tools/call",
      {
        name: "create_group",
        arguments: { list_id: listId, chapter_id: secondChapterId, subtitle: "文型・補語" },
      },
      true
    )
  );
  assert.equal(group.created, true);
  const groupId = group.group.id;

  const updatedGroup = toolResult(
    await rpc(env, accessToken, "/mcp-write", 432, "tools/call", {
      name: "update_group",
      arguments: { list_id: listId, group_id: groupId, subtitle: "文型・構文" },
    }, true)
  );
  assert.equal(updatedGroup.group.subtitle, "文型・構文");

  const temporaryGroup = toolResult(
    await rpc(env, accessToken, "/mcp-write", 433, "tools/call", {
      name: "create_group",
      arguments: { list_id: listId, chapter_id: secondChapterId, subtitle: "一時Group" },
    }, true)
  );
  const deletedGroup = toolResult(
    await rpc(env, accessToken, "/mcp-write", 434, "tools/call", {
      name: "delete_group",
      arguments: { list_id: listId, group_id: temporaryGroup.group.id },
    }, true)
  );
  assert.equal(deletedGroup.deleted, true);

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
        arguments: { list_id: listId, section_id: thirdSectionId, group_id: groupId, description: "重要形容詞" },
      },
      true
    )
  );
  assert.equal(updatedSection.section.description, "重要形容詞");
  assert.equal(updatedSection.section.groupId, groupId);

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
      { name: "reorder_notebooks", arguments: { list_ids: [anonymousListId, listId] } },
      true
    )
  );
  assert.deepEqual(reorderedNotebooks.listIds, [anonymousListId, listId]);

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

  const createdLabel = toolResult(
    await rpc(env, accessToken, "/mcp-write", 54, "tools/call", {
      name: "create_label",
      arguments: { list_id: listId, section_id: sectionId, name: "追加・適用" },
    }, true)
  );
  assert.equal(createdLabel.created, true);
  const labelId = createdLabel.label.id;

  const labeled = toolResult(
    await rpc(env, accessToken, "/mcp-write", 55, "tools/call", {
      name: "move_words",
      arguments: { list_id: listId, word_ids: [abandonId], section_id: sectionId, label_id: labelId },
    }, true)
  );
  assert.equal(labeled.labelId, labelId);

  const labeledListing = toolResult(
    await rpc(env, accessToken, "/mcp-write", 56, "tools/call", {
      name: "list_words",
      arguments: { list_id: listId, query: "abandon" },
    })
  );
  assert.equal(labeledListing.words[0].labelName, "追加・適用");

  const labeledStructure = toolResult(
    await rpc(env, accessToken, "/mcp-write", 57, "tools/call", {
      name: "get_notebook_structure",
      arguments: { list_id: listId },
    })
  );
  const labeledSection = labeledStructure.chapters.flatMap((chapter) => chapter.sections).find((section) => Number(section.id) === sectionId);
  assert.equal(labeledSection.labels[0].name, "追加・適用");

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
  assert.equal(wrongConfirmation.body.result.isError, true);

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
      { name: "list_recent_changes", arguments: { limit: 100 } },
      true
    )
  );
  assert.ok(auditLog.changes.length >= 15);
  assert.ok(auditLog.changes.some((change) => change.actor === "anonymous:mcp"));
  assert.ok(auditLog.changes.some((change) => change.actor === "oauth:" + clientId));

  console.log("MCP write integration test passed");
} finally {
  await miniflare.dispose();
  rmSync(stateDir, { recursive: true, force: true });
}
