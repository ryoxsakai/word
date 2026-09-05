import app from "./index.js";
import { handleCoverageApi } from "./coverage.js";
import { handleCoverageMcp } from "./coverage-mcp.js";
import { handleIllustrationMcp } from "./illustration-mcp.js";

export default {
  async fetch(request, env, ctx) {
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

    return app.fetch(request, env, ctx);
  },

  async scheduled(controller, env, ctx) {
    if (typeof app.scheduled === "function") {
      return app.scheduled(controller, env, ctx);
    }
  },
};
