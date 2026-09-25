import axios, {
  AxiosError,
  AxiosHeaders,
  InternalAxiosRequestConfig,
} from "axios";
import { getSession } from "next-auth/react";

/**
 * Typed envelope that the NestJS backend returns for every response.
 * We unwrap this ONCE in the response interceptor, so hooks/callers
 * only ever see `T` (the inner `data` field) on success.
 */
export type BackendEnvelope<T> =
  | { success: true; data: T }
  | { success: false; error: { message: string; code: string } };

/**
 * Standard error object that callers receive on a non-success envelope
 * or a transport-level HTTP error.
 */
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

/* -------------------------------------------------------------------------- */
/*                             Token management                               */
/* -------------------------------------------------------------------------- */

let cachedAuthToken: string | undefined;
let getSessionPromise: Promise<string | undefined> | null = null;

export const setAxiosAuthToken = (token?: string) => {
  cachedAuthToken = token;
  if (token) {
    axiosClient.defaults.headers.common["Authorization"] = `Bearer ${token}`;
  } else {
    delete axiosClient.defaults.headers.common["Authorization"];
  }
};

/**
 * Resolve the real backend-issued access token from the NextAuth session.
 */
async function resolveAuthToken(): Promise<string | undefined> {
  if (cachedAuthToken) return cachedAuthToken;

  const defaultHeader = axiosClient.defaults.headers.common["Authorization"];
  if (defaultHeader && typeof defaultHeader === "string") {
    const m = defaultHeader.match(/^Bearer\s+(.*)$/i);
    if (m) {
      cachedAuthToken = m[1];
      return cachedAuthToken;
    }
  }

  if (!getSessionPromise) {
    getSessionPromise = (async () => {
      try {
        const sess = (await getSession()) as { accessToken?: string } | null;
        const token = sess?.accessToken;
        if (token) {
          cachedAuthToken = token;
          axiosClient.defaults.headers.common["Authorization"] =
            `Bearer ${token}`;
        }
        return token;
      } finally {
        getSessionPromise = null;
      }
    })();
  }

  return getSessionPromise;
}

function setAuthHeader(
  config: InternalAxiosRequestConfig,
  token: string
): void {
  if (config.headers instanceof AxiosHeaders) {
    config.headers.set("Authorization", `Bearer ${token}`);
  } else {
    config.headers = new AxiosHeaders(config.headers);
    config.headers.set("Authorization", `Bearer ${token}`);
  }
}

/* -------------------------------------------------------------------------- */
/*                             Axios instance                                 */
/* -------------------------------------------------------------------------- */

export const axiosClient = axios.create({
  baseURL:
    process.env.NEXT_PUBLIC_API_URL ||
    process.env.NEXT_PUBLIC_BACKEND_URL ||
    "http://localhost:5001",
});

axiosClient.interceptors.request.use(async (config) => {
  const hasAuthAlready =
    (config.headers instanceof AxiosHeaders &&
      config.headers.has("Authorization")) ||
    (axiosClient.defaults.headers.common["Authorization"] as string | undefined);

  if (!hasAuthAlready) {
    const token = await resolveAuthToken();
    if (token) setAuthHeader(config, token);
  }

  return config;
});

axiosClient.interceptors.response.use(
  (response) => {
    const payload = response.data as BackendEnvelope<unknown>;
    if (payload && typeof payload === "object" && "success" in payload) {
      if (payload.success) {
        response.data = payload.data;
        return response;
      }
      const err = new ApiError(
        payload.error.message ?? "Request failed",
        payload.error.code ?? "UNKNOWN"
      );
      return Promise.reject(err);
    }
    return response;
  },
  async (error: any) => {
    const axiosErr = error as AxiosError<BackendEnvelope<unknown>>;
    const status = axiosErr?.response?.status;
    const originalConfig = (axiosErr?.config || {}) as
      | (InternalAxiosRequestConfig & { _retry?: boolean })
      | undefined;

    if (status === 401 && originalConfig && !originalConfig._retry) {
      originalConfig._retry = true;
      cachedAuthToken = undefined;
      delete axiosClient.defaults.headers.common["Authorization"];
      try {
        const token = await resolveAuthToken();
        if (token) {
          setAuthHeader(originalConfig, token);
          return axiosClient.request(originalConfig);
        }
      } catch {
        /* fall through to reject */
      }
    }

    if (axiosErr?.response?.data && typeof axiosErr.response.data === "object") {
      const payload = axiosErr.response.data as
        | BackendEnvelope<unknown>
        | undefined;
      if (payload && "success" in payload && !payload.success) {
        return Promise.reject(
          new ApiError(
            payload.error.message ?? axiosErr.message,
            payload.error.code ?? "BACKEND",
            status
          )
        );
      }
    }

    return Promise.reject(
      new ApiError(
        axiosErr?.message ?? String(error ?? "Network error"),
        "NETWORK",
        status
      )
    );
  }
);
