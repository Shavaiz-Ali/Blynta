import { safeReturnTo } from "@blynta/auth/server";
import { NextResponse } from "next/server";
export function GET(request: Request) {
  const url = new URL("/login", request.url);
  url.searchParams.set(
    "callbackUrl",
    safeReturnTo(new URL(request.url).searchParams.get("returnTo"), "/"),
  );
  return NextResponse.redirect(url);
}
