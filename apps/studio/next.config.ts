import type { NextConfig } from "next";

const mainAppUrl =
  process.env.MAIN_APP_URL ||
  process.env.NEXT_PUBLIC_BLYNTA_URL ||
  (process.env.NODE_ENV === "development" ? "http://localhost:3000" : "");
if (process.env.NODE_ENV === "production") {
  const url = mainAppUrl ? new URL(mainAppUrl) : undefined;
  if (
    !url ||
    url.protocol !== "https:" ||
    url.username ||
    url.password ||
    ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname)
  ) {
    throw new Error(
      "Configure MAIN_APP_URL with the HTTPS Blynta production origin before building Studio.",
    );
  }
}
const nextConfig: NextConfig = {
  env: {
    NEXT_PUBLIC_BLYNTA_URL: mainAppUrl ? new URL(mainAppUrl).origin : "",
  },
  transpilePackages: [
    "@blynta/ui",
    "@blynta/auth",
    "@blynta/api-client",
    "@blynta/types",
  ],
  /* config options here */
};

export default nextConfig;
