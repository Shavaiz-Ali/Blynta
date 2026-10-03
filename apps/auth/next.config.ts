import type { NextConfig } from "next";
const config: NextConfig = {
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "Referrer-Policy", value: "no-referrer" },
          { key: "Cache-Control", value: "no-store" },
        ],
      },
    ];
  },
  transpilePackages: [
    "@blynta/ui",
    "@blynta/auth",
    "@blynta/api-client",
    "@blynta/types",
  ],
};
export default config;
