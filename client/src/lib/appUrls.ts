const normalizeBasePath = (basePath: string): string => {
  const withLeadingSlash = basePath.startsWith("/") ? basePath : `/${basePath}`;
  const withoutTrailingSlash = withLeadingSlash.replace(/\/+$/, "");
  return withoutTrailingSlash === "" ? "" : withoutTrailingSlash;
};

export const APP_BASE_PATH = normalizeBasePath(import.meta.env.BASE_URL || "/");

export function appUrl(path: string): string {
  if (/^[a-z][a-z\d+.-]*:/i.test(path) || path.startsWith("//")) {
    return path;
  }

  const rootedPath = path.startsWith("/") ? path : `/${path}`;
  if (!APP_BASE_PATH || rootedPath === APP_BASE_PATH || rootedPath.startsWith(`${APP_BASE_PATH}/`)) {
    return rootedPath;
  }

  return `${APP_BASE_PATH}${rootedPath}`;
}

export function apiUrl(path: string): string {
  const apiPath = path.startsWith("/api") ? path : `/api/${path.replace(/^\/+/, "")}`;
  return appUrl(apiPath);
}

export function objectUrl(path: string): string {
  const objectPath = path.startsWith("/objects") ? path : `/objects/${path.replace(/^\/+/, "")}`;
  return appUrl(objectPath);
}

export function webSocketUrl(path = "/ws"): string {
  const url = new URL(appUrl(path), window.location.origin);
  url.protocol = url.protocol === "https:" ? "wss:" : "ws:";
  return url.toString();
}

export function appFetch(
  input: Parameters<typeof fetch>[0],
  init?: Parameters<typeof fetch>[1],
): ReturnType<typeof fetch> {
  return fetch(typeof input === "string" ? appUrl(input) : input, init);
}
