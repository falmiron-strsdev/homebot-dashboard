import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Allow the dashboard to call the Pi orchestrator from API routes
  // without needing to add it to CSP manually.
  async headers() {
    return [
      {
        source: "/api/:path*",
        headers: [{ key: "Cache-Control", value: "no-store" }],
      },
    ];
  },
};

export default nextConfig;
