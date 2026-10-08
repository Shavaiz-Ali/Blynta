import {
  expireProductSession,
  productSessionState,
  isProductLogoutInProgress,
} from "@blynta/auth/client";
import { readProductSession as getSession } from "@blynta/auth/react";
import { ApiError, createApiClient } from "@blynta/api-client";
export { ApiError } from "@blynta/api-client";
export type { BackendEnvelope } from "@blynta/api-client";
export const axiosClient = createApiClient(
  process.env.NEXT_PUBLIC_API_URL || process.env.NEXT_PUBLIC_BACKEND_URL,
  async () => {
    const session = await getSession();
    if (session?.authError)
      throw new ApiError(
        "Sign-in is temporarily unavailable. Please try again.",
        "AUTH_SERVICE_UNAVAILABLE",
        503,
      );
    return session?.accessToken;
  },
  {
    onExpired: expireProductSession,
    requiresAuthentication: (config) => !/^\/auth\//.test(config.url || ""),
    isBlocked: () =>
      isProductLogoutInProgress() ||
      productSessionState.getSnapshot() !== "active",
  },
);
export function setAxiosAuthToken(token?: string) {
  if (token)
    axiosClient.defaults.headers.common.Authorization = `Bearer ${token}`;
  else delete axiosClient.defaults.headers.common.Authorization;
}
