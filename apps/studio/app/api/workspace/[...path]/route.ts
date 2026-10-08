import { auth } from "@/auth";
import { backendUrl } from "@/config/env";
import { NextResponse } from "next/server";

// Deliberately narrow bridge to shared account systems. Tokens stay server-side.
async function handle(
  request: Request,
  context: { params: Promise<{ path: string[] }> },
) {
  const { path } = await context.params;
  const endpoint = path.join("/");
  const allowed =
    request.method === "GET"
      ? [
          "users/me",
          "billing/credits",
          "billing/credits/history",
          "notifications",
          "notifications/unread-count",
          "activities",
        ].includes(endpoint)
      : request.method === "PATCH" &&
        /^notifications\/(read-all|[a-f\d]{24}\/read)$/.test(endpoint);
  if (!allowed) return new Response(null, { status: 404 });
  if (
    request.method !== "GET" &&
    new URL(request.url).origin !== request.headers.get("origin")
  )
    return new Response(null, { status: 403 });
  const session = await auth();
  if (session?.authError)
    return NextResponse.json(
      {
        success: false,
        error: {
          message: "Sign-in is temporarily unavailable. Please try again.",
        },
      },
      { status: 503 },
    );
  if (!session?.accessToken)
    return NextResponse.json(
      { success: false, error: { message: "Sign in to continue." } },
      { status: 401 },
    );
  const query = new URLSearchParams();
  const incoming = new URL(request.url).searchParams;
  for (const key of [
    "page",
    "limit",
    "status",
    "category",
    "product",
    "type",
  ]) {
    if (incoming.has(key)) query.set(key, incoming.get(key)!);
  }
  try {
    const response = await fetch(`${backendUrl()}/${endpoint}?${query}`, {
      method: request.method,
      headers: { Authorization: `Bearer ${session.accessToken}` },
      cache: "no-store",
      signal: AbortSignal.timeout(15000),
    });
    return NextResponse.json(await response.json(), {
      status: response.status,
      headers: { "Cache-Control": "no-store" },
    });
  } catch {
    return NextResponse.json(
      {
        success: false,
        error: { message: "Account service is unavailable. Try again." },
      },
      { status: 503 },
    );
  }
}
export const GET = handle;
export const PATCH = handle;
