import { cookies } from "next/headers";
import { pendingName, pendingOptions } from "@/lib/authorization";
import { NextResponse } from "next/server";

/** Discard stale SSO continuation without changing the central identity session. */
export async function GET(request: Request) {
  const source = new URL(request.url).searchParams.get("from");
  if (source !== "main" && source !== "studio")
    return new Response("Invalid product", { status: 400 });
  const login = new URL("/login", request.url);
  login.search = new URLSearchParams({
    mode: "product-logout",
    from: source,
  }).toString();
  const response = NextResponse.redirect(login);
  response.cookies.set(
    `${process.env.NODE_ENV === "production" ? "__Host-" : ""}blynta-authorization`,
    "",
    {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 0,
    },
  );
  for (const cookie of (await cookies()).getAll())
    if (cookie.name.startsWith(pendingName() + "-"))
      response.cookies.set(cookie.name, "", { ...pendingOptions, maxAge: 0 });
  response.headers.set("Cache-Control", "no-store");
  response.headers.set("Referrer-Policy", "no-referrer");
  return response;
}
