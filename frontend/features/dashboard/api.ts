import {
  fetchUserProfile as authFetchUserProfile,
} from "@/features/auth/user.api";
import type { UserProfile } from "@/features/auth/types";

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL;

type BackendResponse<T> =
  | { success: true; data: T }
  | { success: false; error: { message: string; code: string } };

export interface FetchDashboardProfileOptions {
  accessToken: string;
}

/**
 * Server-side safe. Calls GET /users/me using the real backend-issued
 * accessToken that NextAuth stores on the session.
 *
 * Usage (inside a Server Component, after `const session = await auth()`):
 *     if (session.accessToken) {
 *       profile = await fetchDashboardProfile({ accessToken: session.accessToken });
 *     }
 */
export async function fetchDashboardProfile(
  opts: FetchDashboardProfileOptions
): Promise<UserProfile | null> {
  if (!opts.accessToken) return null;
  try {
    return authFetchUserProfile(opts.accessToken);
  } catch {
    return null;
  }
}

export { BACKEND_URL };
