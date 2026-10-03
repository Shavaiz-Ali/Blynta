import { NextResponse } from "next/server";

/** Discard stale SSO continuation without changing the central identity session. */
export function GET(request: Request) {
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
  response.headers.set("Cache-Control", "no-store");
  response.headers.set("Referrer-Policy", "no-referrer");
  return response;
}
