import { auth } from "@/auth";
import { NextResponse } from "next/server";
export default auth((request) => {
  const p = request.nextUrl.pathname;
  if (
    [
      "/login",
      "/signup",
      "/forgot-password",
      "/reset-password",
      "/verify-email",
      "/auth/",
      "/share/",
    ].some((prefix) => p.startsWith(prefix))
  )
    return NextResponse.next();
  if (!request.auth?.user) {
    const url = new URL("/login", request.url);
    url.searchParams.set("callbackUrl", p + request.nextUrl.search);
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
});
export const config = {
  matcher: ["/((?!api|_next|favicon.ico|icon.svg|sitemap.xml|robots.txt).*)"],
};
