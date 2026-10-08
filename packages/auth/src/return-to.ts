export function safeReturnTo(
  candidate: unknown,
  fallback = "/dashboard",
): string {
  if (
    typeof candidate !== "string" ||
    !candidate.startsWith("/") ||
    candidate.startsWith("//") ||
    /[\\\u0000-\u0020]/.test(candidate)
  )
    return fallback;
  try {
    const decoded = decodeURIComponent(candidate);
    if (decoded.startsWith("//") || /[\\\u0000-\u0020]/.test(decoded))
      return fallback;
  } catch {
    return fallback;
  }
  const url = new URL(candidate, "https://application.invalid");
  if (
    /^\/(auth(?:\/|$)|login(?:\/|$)|signup(?:\/|$))/.test(
      decodeURIComponent(url.pathname),
    )
  )
    return fallback;
  return url.origin === "https://application.invalid"
    ? url.pathname + url.search + url.hash
    : fallback;
}
