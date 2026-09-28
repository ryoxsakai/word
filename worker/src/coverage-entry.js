import app from "./index.js";
import { handleCoverageApi } from "./coverage.js";
import { handleCoverageMcp } from "./coverage-mcp.js";
import { handleIllustrationMcp } from "./illustration-mcp.js";

import { serveViewerSnapshot, handleSnapshotAdmin, trackViewerEdits } from "./viewer-snapshots.js";
export { ViewerSnapshotPublisher } from "./viewer-snapshots.js";

export default {
  async fetch(request, originalEnv, ctx) {
    const admin = await handleSnapshotAdmin(request, originalEnv);
    if (admin) return admin;
    const snapshot = await serveViewerSnapshot(request, originalEnv);
    if (snapshot) return snapshot;
    // A catch-all route is required for the home page with query parameters.
    // Keep the editor, other Pages content, and unprefixed APIs on their origin.
    const url = new URL(request.url);
    if (url.hostname === 'vocab.lrnr.jp' && !url.pathname.startsWith('/mcp') &&
        !url.pathname.startsWith('/oauth/') && !url.pathname.startsWith('/.well-known/oauth-')) {
      return fetch(request);
    }
    const tracked = trackViewerEdits(originalEnv);
    const env = tracked.env;
    try {
    const forward = async (req) => await handleCoverageMcp(req, env,
      (forwardedRequest) => app.fetch(forwardedRequest, env, ctx)) || app.fetch(req, env, ctx);
    const illustrationMcpResponse = await handleIllustrationMcp(request, env, forward);
    if (illustrationMcpResponse) return illustrationMcpResponse;
    const coverageMcpResponse = await handleCoverageMcp(
      request,
      env,
      (forwardedRequest) => app.fetch(forwardedRequest, env, ctx)
    );
    if (coverageMcpResponse) return coverageMcpResponse;

    const coverageApiResponse = await handleCoverageApi(request, env);
    if (coverageApiResponse) return coverageApiResponse;

    return await app.fetch(request, env, ctx);
    } finally {
      await tracked.finish().catch(error => console.error("Viewer publication notification failed", error));
    }
  },

  async scheduled(controller, env, ctx) {
    if (typeof app.scheduled === "function") {
      return app.scheduled(controller, env, ctx);
    }
  },
};
