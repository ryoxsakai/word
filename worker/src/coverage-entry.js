import app from "./index.js";
import { handleCoverageApi } from "./coverage.js";

export default {
  async fetch(request, env, ctx) {
    const coverageResponse = await handleCoverageApi(request, env);
    if (coverageResponse) return coverageResponse;
    return app.fetch(request, env, ctx);
  },

  async scheduled(controller, env, ctx) {
    if (typeof app.scheduled === "function") {
      return app.scheduled(controller, env, ctx);
    }
  },
};
