import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: [
    "@blynta/ui",
    "@blynta/auth",
    "@blynta/api-client",
    "@blynta/types",
  ],
  /* config options here */
};

export default nextConfig;
