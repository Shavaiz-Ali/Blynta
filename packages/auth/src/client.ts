"use client";

import { signOut } from "./react";
import { sessionFetch } from "./session-fetch";
import { productSessionState, productLogoutState } from "./session-state";
export { productSessionState } from "./session-state";

export function isProductLogoutInProgress() {
  return productLogoutState.inProgress;
}

/** Session loss in another tab must not silently restart product SSO. */
export function redirectProductSessionLoss() {
  expireProductSession();
}

export function expireProductSession() {
  if (typeof window !== "undefined" && !productLogoutState.inProgress)
    productSessionState.expire(
      window.location.pathname + window.location.search,
    );
}

export function startProductReauthentication() {
  if (productLogoutState.inProgress) return;
  const destination = productSessionState.beginAuthorization();
  if (destination) window.location.assign(destination);
}

/** Shared boundary for cookie-authenticated product API requests (Studio). */
export const productFetch = sessionFetch;

/** Keep session watchers from restarting SSO while the cookie is being cleared. */
export async function logoutProduct() {
  if (productLogoutState.inProgress) return;
  productLogoutState.inProgress = true;
  try {
    await signOut({ redirect: false, redirectTo: "/auth/logged-out" });
    // Do not accept a stale Auth.js callback URL as the logout destination.
    window.location.assign("/auth/logged-out");
  } catch (error) {
    productLogoutState.inProgress = false;
    throw error;
  }
}
