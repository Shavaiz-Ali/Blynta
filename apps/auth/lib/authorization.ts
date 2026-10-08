import { NextResponse } from "next/server";
import { configuredUrl } from "@blynta/auth/server";
export const pendingName = (state?: string) =>
  (process.env.NODE_ENV === "production" ? "__Host-" : "") +
  "blynta-authorization" +
  (state ? "-" + state : "");
export const pendingOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  path: "/",
  maxAge: 600,
};
export function recovery(
  request: Request,
  client?: string,
  reason = "invalid_request",
  state?: string,
) {
  console.warn("[blynta-auth] authorization recovery", {
    reason,
    client: ["blynta-main", "blynta-studio"].includes(client || "")
      ? client
      : "unknown",
  });
  const url = new URL("/auth/recover", request.url);
  if (
    ["backend_unavailable", "backend_configuration", "rate_limited"].includes(
      reason,
    )
  )
    url.searchParams.set("reason", "service_unavailable");
  if (["blynta-main", "blynta-studio"].includes(client || ""))
    url.searchParams.set("client", client!);
  if (state && /^[A-Za-z0-9_-]{43}$/.test(state))
    url.searchParams.set("transaction", state);
  const response = NextResponse.redirect(url);
  response.headers.set("Cache-Control", "no-store");
  response.headers.set("Referrer-Policy", "no-referrer");
  return response;
}
export function productRestart(client: unknown) {
  return new URL(
    "/auth/start",
    configuredUrl(
      client === "blynta-studio" ? "STUDIO_APP_URL" : "MAIN_APP_URL",
    ),
  );
}
