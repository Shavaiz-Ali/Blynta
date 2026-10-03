import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { configuredUrl } from "@blynta/auth/server";
export async function GET() {
  const pending = (await cookies()).get(
    `${process.env.NODE_ENV === "production" ? "__Host-" : ""}blynta-authorization`,
  )?.value;
  if (pending) {
    try {
      const url = new URL("/authorize", configuredUrl("AUTH_APP_URL"));
      url.search = new URLSearchParams(JSON.parse(pending)).toString();
      return NextResponse.redirect(url);
    } catch {
      return new Response("Invalid authentication request", { status: 400 });
    }
  }
  return NextResponse.redirect(
    new URL("/auth/start", configuredUrl("MAIN_APP_URL")),
  );
}
