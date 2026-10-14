import type { ApiEnvelope } from "@blynta/types";

export type IdentityFailureCode =
  | "invalid_credentials"
  | "incorrect_email"
  | "incorrect_password"
  | "account_inactive"
  | "password_sign_in_unavailable"
  | "backend_unavailable"
  | "backend_configuration"
  | "rate_limited"
  | "authentication_failed";

/** Safe categories only: never retain passwords, bridge headers or raw backend errors. */
export class IdentityRequestError extends Error {
  readonly code: IdentityFailureCode;
  readonly status: number | undefined;

  constructor(code: IdentityFailureCode, status?: number) {
    super("Identity request failed");
    this.name = "IdentityRequestError";
    this.code = code;
    this.status = status;
  }
}

export async function callIdentity<T>(
  path: string,
  body: object,
  bridge = false,
): Promise<T> {
  const backend =
    process.env.BACKEND_SERVICE_URL ||
    process.env.BACKEND_URL ||
    process.env.NEXT_PUBLIC_BACKEND_URL;
  const bridgeSecret = process.env.SSO_BRIDGE_SECRET;
  if (!backend || (bridge && !bridgeSecret)) {
    throw new IdentityRequestError("backend_configuration");
  }
  try {
    const url = new URL(backend);
    if (
      url.username ||
      url.password ||
      url.search ||
      url.hash ||
      (url.protocol !== "https:" &&
        !(
          url.protocol === "http:" &&
          (Boolean(process.env.BACKEND_SERVICE_URL) ||
            (process.env.NODE_ENV !== "production" &&
              ["localhost", "127.0.0.1"].includes(url.hostname)))
        ))
    )
      throw new Error("Invalid backend origin");
  } catch {
    throw new IdentityRequestError("backend_configuration");
  }

  let response: Response;
  try {
    response = await fetch(`${backend.replace(/\/$/, "")}/auth/${path}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(bridge ? { "x-blynta-auth-bridge": bridgeSecret! } : {}),
      },
      body: JSON.stringify(body),
      cache: "no-store",
      redirect: "error",
      signal: AbortSignal.timeout(15000),
    });
  } catch {
    throw new IdentityRequestError("backend_unavailable");
  }

  const json = (await response
    .json()
    .catch(() => null)) as ApiEnvelope<T> | null;
  if (!response.ok) {
    const backendCode = json?.success === false ? json.error?.code : undefined;
    if (response.status === 401) {
      if (backendCode === "INCORRECT_EMAIL")
        throw new IdentityRequestError("incorrect_email", response.status);
      if (backendCode === "INCORRECT_PASSWORD")
        throw new IdentityRequestError("incorrect_password", response.status);
      if (backendCode === "PASSWORD_SIGN_IN_UNAVAILABLE")
        throw new IdentityRequestError(
          "password_sign_in_unavailable",
          response.status,
        );
    }
    if (response.status === 403 && backendCode === "ACCOUNT_INACTIVE") {
      throw new IdentityRequestError("account_inactive", response.status);
    }
    if (response.status === 401 && backendCode === "INVALID_CREDENTIALS") {
      throw new IdentityRequestError("invalid_credentials", response.status);
    }
    if (response.status === 429) {
      throw new IdentityRequestError("rate_limited", response.status);
    }
    if (response.status === 404 || (response.status === 401 && bridge)) {
      throw new IdentityRequestError("backend_configuration", response.status);
    }
    if (response.status >= 500) {
      throw new IdentityRequestError("backend_unavailable", response.status);
    }
    throw new IdentityRequestError("authentication_failed", response.status);
  }
  if (!json || json.success !== true || json.data == null) {
    throw new IdentityRequestError("backend_unavailable", response.status);
  }
  return json.data;
}
