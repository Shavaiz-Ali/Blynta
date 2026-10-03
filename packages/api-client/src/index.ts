import axios, { type AxiosError, type InternalAxiosRequestConfig } from "axios";
import type { ApiEnvelope } from "@blynta/types";

export type BackendEnvelope<T> = ApiEnvelope<T>;
export class ApiError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly status?: number,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

/** Shared transport only. Product endpoint definitions remain in each application's features. */
export function createApiClient(
  baseURL: string | undefined,
  resolveToken: () => Promise<string | undefined>,
) {
  const client = axios.create({ baseURL, timeout: 30000 });
  let pending: Promise<string | undefined> | undefined;
  const token = () => {
    pending ??= resolveToken().finally(() => {
      pending = undefined;
    });
    return pending;
  };
  client.interceptors.request.use(async (config) => {
    const accessToken = await token();
    if (accessToken)
      config.headers.set("Authorization", `Bearer ${accessToken}`);
    else config.headers.delete("Authorization");
    return config;
  });
  client.interceptors.response.use(
    (response) => {
      const envelope = response.data as ApiEnvelope<unknown>;
      if (envelope && typeof envelope === "object" && "success" in envelope) {
        if (!envelope.success)
          throw new ApiError(
            envelope.error.message || "Request failed",
            envelope.error.code || "UNKNOWN",
            response.status,
          );
        response.data = envelope.data;
      }
      return response;
    },
    async (error: unknown) => {
      const failure = error as AxiosError<ApiEnvelope<unknown>>;
      const original = failure.config as
        (InternalAxiosRequestConfig & { _retry?: boolean }) | undefined;
      if (failure.response?.status === 401 && original && !original._retry) {
        original._retry = true;
        // A new Auth.js session read checks revocation and issues a fresh short-lived API token.
        pending = undefined;
        if (await token()) return client.request(original);
      }
      const envelope = failure.response?.data;
      const message =
        envelope && "success" in envelope && !envelope.success
          ? envelope.error.message
          : failure.message || "Network error";
      const code =
        envelope && "success" in envelope && !envelope.success
          ? envelope.error.code
          : "NETWORK";
      throw new ApiError(message, code, failure.response?.status);
    },
  );
  return client;
}
