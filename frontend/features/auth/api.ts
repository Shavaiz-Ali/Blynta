import type { AuthProvider } from "./types";

/**
 * Safe fallback used when the backend cannot be reached or is misconfigured.
 * Only "local" = credential login. Social buttons will NOT be rendered,
 * giving a clear visual signal that the provider fetch did not succeed.
 *
 * Previously this fell back to ["local", "google", "facebook"], which made
 * it impossible to tell (from the UI) whether the backend call had worked.
 */
export const PROVIDERS_FALLBACK_UNREACHABLE: AuthProvider[] = ["local"];

/**
 * Fallback used only when NEXT_PUBLIC_BACKEND_URL itself is missing.
 * Without a backend URL we can't even attempt a fetch; in that case we
 * conservatively show credential-only login as well.
 */
export const PROVIDERS_FALLBACK_NO_URL: AuthProvider[] = ["local"];

export interface GetEnabledProvidersOptions {
  /**
   * Next.js revalidate window in seconds. Defaults to 60 in production.
   * Pass 0 to always bypass the fetch cache.
   */
  revalidate?: number;
  /**
   * When true, logs each step of the provider fetch to the Next.js server
   * console so you can confirm whether the request actually hit the backend.
   * Defaults to true in development, false otherwise.
   */
  debug?: boolean;
}

const isDev = process.env.NODE_ENV !== "production";

/**
 * Fetches the list of enabled auth providers from the NestJS backend.
 *
 * Server-side safe. Call this from inside Server Components / Route Handlers.
 *
 * Response envelopes handled:
 *   - `{ success: true, data: AuthProvider[] }` (ResponseInterceptor — standard)
 *   - `AuthProvider[]` (raw — e.g. if interceptor is ever bypassed)
 *
 * Falls back to credential-only providers when backend is unreachable.
 */
export async function getEnabledProviders(
  options: GetEnabledProvidersOptions = {}
): Promise<AuthProvider[]> {
  const { revalidate = isDev ? 0 : 60, debug = isDev } = options;
  const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL;

  const log = (msg: string, meta?: unknown) => {
    if (!debug) return;
    const tag = "[auth:providers]";
    if (meta === undefined) {
      console.log(`${tag} ${msg}`);
    } else {
      console.log(`${tag} ${msg}`, meta);
    }
  };

  if (!backendUrl) {
    log(
      `NEXT_PUBLIC_BACKEND_URL not set — falling back to credential-only login (${PROVIDERS_FALLBACK_NO_URL.join(", ")})`
    );
    return [...PROVIDERS_FALLBACK_NO_URL];
  }

  const endpoint = `${backendUrl}/auth/providers`;

  try {
    log(`GET ${endpoint} — revalidate=${revalidate}s`);

    const res = await fetch(endpoint, {
      // In dev, bypass fetch cache entirely so every hard reload triggers a
      // real request to the Nest backend (easy to confirm in backend logs).
      // In prod, use the revalidate window (default 60s).
      cache: revalidate === 0 ? "no-store" : "force-cache",
      next: { revalidate },
    });

    log(`response status = ${res.status} ${res.statusText}`);

    if (!res.ok) {
      log(
        `non-ok response — falling back to ${PROVIDERS_FALLBACK_UNREACHABLE.join(", ")}`
      );
      return [...PROVIDERS_FALLBACK_UNREACHABLE];
    }

    const json = await res.json();

    let providers: AuthProvider[] | null = null;

    if (json?.success && Array.isArray(json.data)) {
      providers = json.data as AuthProvider[];
    } else if (Array.isArray(json)) {
      providers = json as AuthProvider[];
    }

    if (providers === null) {
      log(
        `unexpected response shape — falling back to ${PROVIDERS_FALLBACK_UNREACHABLE.join(", ")}`,
        json
      );
      return [...PROVIDERS_FALLBACK_UNREACHABLE];
    }

    log(`resolved providers = [${providers.join(", ")}]`);
    return providers;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    log(
      `fetch error (${msg}) — falling back to ${PROVIDERS_FALLBACK_UNREACHABLE.join(", ")}`
    );
    return [...PROVIDERS_FALLBACK_UNREACHABLE];
  }
}
