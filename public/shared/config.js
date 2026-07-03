// フロントエンド(GitHub Pages等)からAPI(Cloudflare Workers)を呼ぶ際の接続先設定。
//
// - Worker自身がフロントエンドも配信している場合（ローカルの wrangler dev など）は
//   空文字のままで同一オリジンの相対パス /api/... を使う。
// - GitHub PagesのようにフロントエンドとWorkerが別オリジンになる場合は、
//   デプロイ後のWorkerのURL（例: "https://vocab-app.<subdomain>.workers.dev"）を指定する。
export const API_BASE = "";
