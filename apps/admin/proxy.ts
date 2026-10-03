import { productProxy } from "@blynta/auth/proxy";
export default productProxy("blynta-admin");
export const config = {
  matcher: ["/((?!api|_next|favicon.ico|icon.svg|sitemap.xml|robots.txt).*)"],
};
