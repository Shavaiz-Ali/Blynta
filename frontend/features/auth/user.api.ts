import type { UserProfile } from "./types";

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL;

/** Standard NestJS API response envelope (matches ResponseInterceptor shape). */
type BackendResponse<T> =
  | { success: true; data: T }
  | { success: false; error: { message: string; code: string } };

export type { UserProfile };

/**
 * Fetch the current user's profile from GET /users/me.
 *
 * Requires a valid JWT access token (from NextAuth session), passed via the
 * `Authorization: Bearer <token>` header — the Nest backend's
 * JwtStrategy (AuthGuard('jwt')) decodes it to populate req.user.userId.
 *
 * Safe to call on the client (it uses fetch with `cache: "no-store"` to
 * avoid caching and returns `null` gracefully on error so callers can degrade).
 *
 * Callers are responsible for obtaining a valid token (e.g. via `getSession()`).
 */
export async function fetchUserProfile(accessToken: string): Promise<UserProfile | null> {
  if (!BACKEND_URL) return null;
  try {
    const res = await fetch(`${BACKEND_URL}/users/me`, {
      headers: { Authorization: `Bearer ${accessToken}` },
      cache: "no-store",
    });
    if (!res.ok) return null;
    const json = (await res.json()) as BackendResponse<UserProfile>;
    if ("success" in json && json.success) return json.data;
    return null;
  } catch {
    return null;
  }
}

/**
 * Mark the welcome screen as seen via PATCH /users/me/welcomed.
 *
 * Idempotent on the backend (defensive write via `{ isWelcomed: false }`
 * filter — safe to retry). Resolves to `true` on success, `false` on failure
 * failure. Never throws — callers rely on the boolean to decide whether to
 * silently close or retry.
 */
export async function markWelcomed(accessToken: string): Promise<boolean> {
  if (!BACKEND_URL) return false;
  try {
    const res = await fetch(`${BACKEND_URL}/users/me/welcomed`, {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
      cache: "no-store",
    });
    if (!res.ok) return false;
    const json = (await res.json()) as BackendResponse<{ message: string }>;
    return "success" in json && json.success;
  } catch {
    return false;
  }
}
