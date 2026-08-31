import app from "./index.js";
import { handleCoverageApi } from "./coverage.js";
import { handleCoverageMcp } from "./coverage-mcp.js";

export default {
  async fetch(request, env, ctx) {
    const coverageMcpResponse = await handleCoverageMcp(
      request,
      env,
      (forwardedRequest) => app.fetch(forwardedRequest, env, ctx)
    );
    if (coverageMcpResponse) return coverageMcpResponse;

    const coverageApiResponse = await handleCoverageApi(request, env);
    if (coverageApiResponse) return coverageApiResponse;

    return app.fetch(request, env, ctx);
  },

  async scheduled(controller, env, ctx) {
    if (typeof app.scheduled === "function") {
      return app.scheduled(controller, env, ctx);
    }
  },
};
