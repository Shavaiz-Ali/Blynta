import { auth } from "@/auth";
import { backendUrl } from "@/config/env";
import { NextResponse } from "next/server";
async function handle(
  request: Request,
  context: { params: Promise<{ path: string[] }> },
) {
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
  const { path } = await context.params;
  if (path.some((part) => !/^[a-zA-Z0-9_-]+$/.test(part)))
    return new Response(null, { status: 400 });
  if (
    request.method !== "GET" &&
    new URL(request.url).origin !== request.headers.get("origin")
  )
    return new Response(null, { status: 403 });
  try {
    const body = ["GET", "DELETE"].includes(request.method)
      ? undefined
      : await request.text();
    if (body && body.length > 2 * 1024 * 1024)
      return new Response(null, { status: 413 });
    const response = await fetch(`${backendUrl()}/studio/${path.join("/")}`, {
      method: request.method,
      headers: {
        Authorization: `Bearer ${session.accessToken}`,
        "Content-Type": "application/json",
      },
      body,
      cache: "no-store",
      signal: AbortSignal.timeout(55000),
    });
    return NextResponse.json(await response.json(), {
      status: response.status,
      headers: { "Cache-Control": "no-store" },
    });
  } catch {
    return NextResponse.json(
      {
        success: false,
        error: { message: "Studio service is unavailable. Try again." },
      },
      { status: 503 },
    );
  }
}
export const GET = handle;
export const POST = handle;
export const PUT = handle;
export const PATCH = handle;
export const DELETE = handle;
