# OAuth connection lifetime

ChatGPT grants now receive a rotating opaque refresh token. Access tokens retain their existing 12-hour lifetime, capped at the grant's original 30-day expiry. Refreshing never extends that expiry. The 7-day editor login, explicit authorization consent and optional 30-day browser login cookie keep their existing behavior.

Migration `0060_oauth_refresh_tokens.sql` adds grant-family and digest-history tables; it does not alter application data or existing grants. The existing deployment workflow applies D1 migrations before deploying. Existing connections contain no refresh token and require one reconnect after deployment. Existing access tokens remain valid for their original lifetime.

Refresh tokens require the registered client ID and remain bound to the issuer, original scope and current API-key/session-secret version. A reduced scope applies to that access token; the original consent still bounds later refreshes. Unknown resources and repeated singleton parameters are rejected. Raw refresh credentials are never stored in D1 or logged.

Rotation uses a D1 transaction and a compare-and-swap on the current digest/generation. For a fixed five-second window, simultaneous requests or response retries derive the same successor via domain-separated HMAC. No raw successor is stored. Once that successor rotates again, or the five seconds expire, use of an older refresh credential revokes its entire family, including access tokens. This deliberately limits response-retry tolerance rather than allowing a replay window to slide indefinitely.

`POST /oauth/revoke` accepts `token=<refresh credential>&client_id=<registered ID>` and invalidates that family's refresh and access tokens. Unknown tokens return 200 without revealing whether a grant exists. API-key/session-secret rotation, replay and the fixed expiry also invalidate new families. Browser logout retains its separate browser-cookie semantics.

Run `npm run test:oauth` for the existing browser/editor tests and the D1-backed synthetic refresh tests. `npm run test:mcp-write` verifies that anonymous protected access and scope escalation remain rejected. The refresh tests use invented credentials only; no production grants are read or created.
