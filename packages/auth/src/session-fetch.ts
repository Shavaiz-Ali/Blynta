import { productLogoutState, productSessionState } from "./session-state";
/** Browser session handling; server callers retain their normal fetch semantics. */
export async function sessionFetch(
  input: RequestInfo | URL,
  init?: RequestInit,
) {
  const browser = typeof window !== "undefined";
  if (
    browser &&
    (productSessionState.getSnapshot() !== "active" ||
      productLogoutState.inProgress)
  )
    throw Object.assign(new Error("Sign in again to continue using Blynta."), {
      status: 401,
    });
  const response = await fetch(input, init);
  if (browser && response.status === 401 && !productLogoutState.inProgress)
    productSessionState.expire(
      window.location.pathname + window.location.search,
    );
  return response;
}
