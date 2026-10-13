/** Functions only: bindings are unavailable during builds and in Proxy. */
export function backendUrl(): string {
  const url =
    process.env.BACKEND_SERVICE_URL ||
    process.env.BACKEND_URL ||
    process.env.NEXT_PUBLIC_BACKEND_URL ||
    process.env.NEXT_PUBLIC_API_URL;
  if (!url)
    throw new Error("Configure the backend service binding or BACKEND_URL.");
  try {
    const parsed = new URL(url);
    if (
      !["http:", "https:"].includes(parsed.protocol) ||
      parsed.username ||
      parsed.password
    )
      throw new Error();
  } catch {
    throw new Error(
      "Configure a valid HTTP(S) backend service URL without embedded credentials.",
    );
  }
  return url.replace(/\/$/, "");
}

/** Services share project env vars; use a distinct cookie secret per app. */
export function authSecret(clientId: string): string | undefined {
  const names: Record<string, string> = {
    "blynta-main": "BLYNTA_APP_AUTH_SECRET",
    "blynta-admin": "BLYNTA_ADMIN_AUTH_SECRET",
    "blynta-studio": "BLYNTA_STUDIO_AUTH_SECRET",
    "blynta-identity": "BLYNTA_AUTH_SECRET",
  };
  return (
    process.env[names[clientId]] ||
    process.env.AUTH_SECRET ||
    process.env.NEXTAUTH_SECRET
  );
}
