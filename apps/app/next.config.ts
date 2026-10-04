import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  env: {
    NEXT_PUBLIC_STUDIO_URL:
      process.env.NEXT_PUBLIC_STUDIO_URL ||
      process.env.STUDIO_APP_URL ||
      (process.env.NODE_ENV === "development" ? "http://localhost:3002" : ""),
  },
  transpilePackages: [
    "@blynta/ui",
    "@blynta/auth",
    "@blynta/api-client",
    "@blynta/types",
  ],
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "img.youtube.com",
        pathname: "/**",
      },
      {
        protocol: "https",
        hostname: "i.ytimg.com",
        pathname: "/**",
      },
    ],
  },
};

export default nextConfig;
