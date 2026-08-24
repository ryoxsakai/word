# Vocabulary MCP

## Endpoints

| Endpoint | Purpose | Authentication |
| --- | --- | --- |
| `https://vocab.lrnr.jp/mcp` | Search and read vocabulary data | None |
| `https://vocab.lrnr.jp/mcp-write` | Read and edit vocabulary data | Cloudflare Access |

The public endpoint intentionally exposes only read-only tools. The edit endpoint lists the read tools plus authenticated write and audit tools. Every tool is also exposed with the `vocab.` prefix for client compatibility.

## Write security

Protect `vocab.lrnr.jp/mcp-write*` with a Cloudflare Access MCP server application and an allow policy for the intended account. A one-time PIN identity provider is sufficient for a single-user deployment. In the application's **Advanced settings**, enable **Managed OAuth** so ChatGPT and other standards-compliant MCP clients can complete the browser authorization-code flow. Cloudflare then serves the OAuth discovery endpoints and authentication challenge before the request reaches the Worker.

Set these Worker variables in the Cloudflare dashboard:

| Variable | Value |
| --- | --- |
| `CF_ACCESS_TEAM_DOMAIN` | The Access team domain, such as `example.cloudflareaccess.com` |
| `CF_ACCESS_AUD` | The Access application audience (`AUD`) tag |

`keep_vars = true` in `wrangler.toml` preserves dashboard-managed Access variables during GitHub Actions deployments.

Write calls fail closed when either variable is absent. The Worker validates the Access JWT's RSA signature, issuer, audience, activation time, and expiration before it runs an edit. It accepts the token from `Cf-Access-Jwt-Assertion` or `Authorization: Bearer` and never logs or returns the raw token.

The MCP does not expose permanent deletion of master vocabulary records. `remove_words_from_notebook` only removes notebook membership, requires the exact notebook name as confirmation, and leaves the master word available for re-adding.

## Edit tools

| Area | Tools |
| --- | --- |
| Notebooks | `create_notebook`, `update_notebook`, `reorder_notebooks` |
| Chapters | `create_chapter`, `update_chapter`, `reorder_chapters` |
| Sections | `create_section`, `update_section`, `reorder_sections` |
| Words | `create_words`, `update_word`, `add_words_to_notebook`, `move_words`, `remove_words_from_notebook` |
| Audit | `list_recent_changes` |

`create_words` accepts up to 30 words per call and supports senses, examples, derivatives, tags, caution flags, and derived-word families. Existing spellings are not overwritten. Use `update_word` for an explicit partial update.

## Tests

Run all authentication and MCP integration tests from the `worker` directory:

```sh
npm run test:mcp-write
```

The tests use an ephemeral D1 database and generated RSA keys. They cover valid and invalid Access JWTs, anonymous write rejection, all editing tools, duplicate protection, derived-word numbering, confirmation checks, and audit logging.
