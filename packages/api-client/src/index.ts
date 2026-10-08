import axios, { type AxiosError, type InternalAxiosRequestConfig } from "axios";
import type { ApiEnvelope } from "@blynta/types";

export type BackendEnvelope<T> = ApiEnvelope<T>;

function backendFailure(data: unknown) {
  if (
    !data ||
    typeof data !== "object" ||
    !("success" in data) ||
    data.success !== false
  )
    return undefined;
  const error = "error" in data ? data.error : undefined;
  if (!error || typeof error !== "object") return undefined;
  return {
    message:
      "message" in error && typeof error.message === "string"
        ? error.message
        : "Request failed",
    code:
      "code" in error && typeof error.code === "string"
        ? error.code
        : "UNKNOWN",
  };
}
export class ApiError extends Error {
  public readonly code: string;
  public readonly status?: number;
  constructor(message: string, code: string, status?: number) {
    super(message);
    this.name = "ApiError";
    this.code = code;
    this.status = status;
  }
}

/** Shared transport only. Product endpoint definitions remain in each application's features. */
export function createApiClient(
  baseURL: string | undefined,
  resolveToken: () => Promise<string | undefined>,
  session?: {
    onExpired: () => void;
    isBlocked: () => boolean;
    requiresAuthentication?: (config: InternalAxiosRequestConfig) => boolean;
  },
) {
  const client = axios.create({ baseURL, timeout: 30000 });
  let pending: Promise<string | undefined> | undefined;
  const token = () => {
    pending ??= resolveToken().finally(() => {
      pending = undefined;
    });
    return pending;
  };
  const requiresAuthentication = (config: InternalAxiosRequestConfig) =>
    session?.requiresAuthentication?.(config) ?? true;
  client.interceptors.request.use(async (config) => {
    if (!requiresAuthentication(config)) return config;
    if (session?.isBlocked())
      throw new ApiError(
        "Sign in again to continue using Blynta.",
        "SESSION_EXPIRED",
        401,
      );
    const accessToken = await token();
    if (session && !accessToken) {
      session.onExpired();
      throw new ApiError(
        "Sign in again to continue using Blynta.",
        "SESSION_EXPIRED",
        401,
      );
    }
    if (session?.isBlocked())
      throw new ApiError(
        "Sign in again to continue using Blynta.",
        "SESSION_EXPIRED",
        401,
      );
    if (accessToken)
      config.headers.set("Authorization", `Bearer ${accessToken}`);
    else config.headers.delete("Authorization");
    return config;
  });
  let refresh: Promise<string | undefined> | undefined;
  client.interceptors.response.use(
    (response) => {
      const envelope = response.data as ApiEnvelope<unknown>;
      if (envelope && typeof envelope === "object" && "success" in envelope) {
        if (!envelope.success)
          throw new ApiError(
            backendFailure(envelope)?.message || "Request failed",
            backendFailure(envelope)?.code || "UNKNOWN",
            response.status,
          );
        response.data = envelope.data;
      }
      return response;
    },
    async (error: unknown) => {
      if (error instanceof ApiError) throw error;
      const failure = (
        error && typeof error === "object" ? error : {}
      ) as AxiosError<unknown>;
      const original = failure.config as
        (InternalAxiosRequestConfig & { _retry?: boolean }) | undefined;
      if (
        failure.response?.status === 401 &&
        original &&
        !original._retry &&
        (!session || requiresAuthentication(original)) &&
        !session?.isBlocked()
      ) {
        original._retry = true;
        // A new Auth.js session read checks revocation and issues a fresh short-lived API token.
        refresh ??= resolveToken().finally(() => {
          refresh = undefined;
        });
        const renewed = await refresh;
        if (renewed && !session?.isBlocked()) return client.request(original);
      }
      if (
        failure.response?.status === 401 &&
        original &&
        requiresAuthentication(original)
      )
        session?.onExpired();
      const envelope = backendFailure(failure.response?.data);
      const message = envelope?.message || failure.message || "Network error";
      const code =
        envelope?.code || (failure.response ? "HTTP_ERROR" : "NETWORK");
      throw new ApiError(message, code, failure.response?.status);
    },
  );
  return client;
}
