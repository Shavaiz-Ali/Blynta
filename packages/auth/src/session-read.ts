import type { Session } from "next-auth";

export class SessionUnavailableError extends Error {
  readonly code = "AUTH_SERVICE_UNAVAILABLE";
  readonly status = 503;
  constructor() {
    super("Sign-in is temporarily unavailable. Please try again.");
    this.name = "SessionUnavailableError";
  }
}

/** Auth.js getSession swallows fetch failures into null. Only an explicit null
 * response from our session endpoint is evidence that authentication was lost.
 */
export async function readProductSession(): Promise<Session | null> {
  try {
    const response = await fetch("/api/auth/session", {
      cache: "no-store",
      credentials: "same-origin",
      signal: AbortSignal.timeout(15000),
    });
    if (!response.ok) throw new SessionUnavailableError();
    const session: unknown = await response.json();
    if (session === null) return null;
    if (
      typeof session !== "object" ||
      !session ||
      !("user" in session) ||
      typeof session.user !== "object" ||
      !session.user
    )
      throw new SessionUnavailableError();
    return session as Session;
  } catch {
    throw new SessionUnavailableError();
  }
}
