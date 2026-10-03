/** Central auth uses the existing shared identity/session; it does not exchange invented tokens. */
export function safeStudioReturnTo(
  candidate: string | null | undefined,
  studioOrigin: string,
) {
  const base = new URL(studioOrigin);
  const fallback = new URL("/dashboard", base).href;
  if (
    !candidate ||
    candidate.startsWith("//") ||
    /[\\\u0000-\u001f]/.test(candidate)
  )
    return fallback;
  try {
    const target = new URL(candidate, base);
    return target.origin === base.origin &&
      ["http:", "https:"].includes(target.protocol)
      ? target.href
      : fallback;
  } catch {
    return fallback;
  }
}
export function centralAuthUrl(path: string, returnTo?: string | null) {
  const configured = process.env.BLYNTA_AUTH_ORIGIN;
  if (!configured) return null;
  const authOrigin = new URL(configured);
  if (
    authOrigin.protocol !== "https:" &&
    !(
      authOrigin.protocol === "http:" &&
      ["localhost", "127.0.0.1"].includes(authOrigin.hostname)
    )
  )
    throw new Error("BLYNTA_AUTH_ORIGIN must use HTTPS outside localhost.");
  const studioOrigin = process.env.BLYNTA_STUDIO_ORIGIN || process.env.AUTH_URL;
  if (!studioOrigin)
    throw new Error("Set BLYNTA_STUDIO_ORIGIN when enabling centralized auth.");
  const url = new URL(path, authOrigin.origin);
  url.searchParams.set("returnTo", safeStudioReturnTo(returnTo, studioOrigin));
  return url.href;
}
