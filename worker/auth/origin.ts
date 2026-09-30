interface OriginConfig {
  PUBLIC_ORIGIN: string;
  ADDITIONAL_PUBLIC_ORIGINS?: string;
}

// Exact, explicitly configured origins only; never trust the request Host header.
export function isAllowedOrigin(
  origin: string | null,
  config: OriginConfig,
): boolean {
  if (!origin || origin === "null") return false;
  return [
    config.PUBLIC_ORIGIN,
    ...(config.ADDITIONAL_PUBLIC_ORIGINS ?? "").split(","),
  ].some((allowed) => allowed.trim() !== "" && origin === allowed.trim());
}
