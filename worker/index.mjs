export const DEFAULT_APP_BASE_PATH = "/QuestAcademy";

const json = (body, status, headers = {}) =>
  new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
      ...headers,
    },
  });

const normalizeBasePath = (basePath) => {
  const value = basePath || DEFAULT_APP_BASE_PATH;
  const rooted = value.startsWith("/") ? value : `/${value}`;
  return rooted.replace(/\/+$/, "") || "/";
};

const isInScope = (pathname, basePath) =>
  pathname === basePath || pathname.startsWith(`${basePath}/`);

const stripBasePath = (pathname, basePath) => {
  const stripped = pathname.slice(basePath.length);
  return stripped || "/";
};

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const basePath = normalizeBasePath(env.APP_BASE_PATH);

    if (!isInScope(url.pathname, basePath)) {
      return new Response("Not found", {
        status: 404,
        headers: { "x-questacademy-scope": "outside" },
      });
    }

    if (url.pathname === basePath) {
      url.pathname = `${basePath}/`;
      return Response.redirect(url.toString(), 308);
    }

    const apiPrefix = `${basePath}/api`;
    if (url.pathname === `${apiPrefix}/_shell/health`) {
      return json({ status: "ok", environment: env.ENVIRONMENT || "unknown" }, 200);
    }

    if (url.pathname === apiPrefix || url.pathname.startsWith(`${apiPrefix}/`)) {
      return json(
        {
          error: "API route not migrated",
          code: "increment_b_placeholder",
        },
        501,
      );
    }

    if (url.pathname === `${basePath}/ws`) {
      if (request.headers.get("upgrade")?.toLowerCase() !== "websocket") {
        return json({ error: "WebSocket upgrade required" }, 426);
      }

      return json(
        {
          error: "WebSocket route not migrated",
          code: "increment_b_placeholder",
        },
        501,
      );
    }

    if (request.method !== "GET" && request.method !== "HEAD") {
      return new Response("Method not allowed", {
        status: 405,
        headers: { allow: "GET, HEAD" },
      });
    }

    const assetUrl = new URL(request.url);
    assetUrl.pathname = stripBasePath(url.pathname, basePath);
    return env.ASSETS.fetch(new Request(assetUrl, request));
  },
};
