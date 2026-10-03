import { getSession } from "next-auth/react";
import { createApiClient } from "@blynta/api-client";
export { ApiError } from "@blynta/api-client";
export type { BackendEnvelope } from "@blynta/api-client";
export const axiosClient = createApiClient(
  process.env.NEXT_PUBLIC_API_URL || process.env.NEXT_PUBLIC_BACKEND_URL,
  async () => (await getSession())?.accessToken,
);
export function setAxiosAuthToken(token?: string) {
  if (token)
    axiosClient.defaults.headers.common.Authorization = `Bearer ${token}`;
  else delete axiosClient.defaults.headers.common.Authorization;
}
