"use client";

import { signOut } from "next-auth/react";

let logoutInProgress = false;

export function isProductLogoutInProgress() {
  return logoutInProgress;
}

/** Session loss in another tab must not silently restart product SSO. */
export function redirectProductSessionLoss() {
  if (!logoutInProgress) window.location.assign("/auth/logged-out");
}

/** Keep session watchers from restarting SSO while the cookie is being cleared. */
export async function logoutProduct() {
  if (logoutInProgress) return;
  logoutInProgress = true;
  try {
    await signOut({ redirect: false, redirectTo: "/auth/logged-out" });
    // Do not accept a stale Auth.js callback URL as the logout destination.
    window.location.assign("/auth/logged-out");
  } catch (error) {
    logoutInProgress = false;
    throw error;
  }
}
