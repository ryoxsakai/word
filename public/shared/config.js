// フロントエンド(GitHub Pages等)からAPI(Cloudflare Workers)を呼ぶ際の接続先設定。
//
// localhost（`wrangler dev` によるローカル動作確認）では同一オリジンの相対パス /api/... を使い、
// それ以外（GitHub Pagesなど別オリジンへのデプロイ時）はCloudflare WorkerのURLを使う。
const isLocalhost = /^(localhost|127\.0\.0\.1)$/.test(location.hostname);
export const API_BASE = isLocalhost ? "" : "https://vocab-app.ryoxsakai.workers.dev";
