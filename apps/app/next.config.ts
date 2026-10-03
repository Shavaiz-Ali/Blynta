import type { NextConfig } from "next";

const nextConfig: NextConfig = {
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
