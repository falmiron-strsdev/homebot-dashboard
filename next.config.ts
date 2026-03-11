import type { NextConfig } from "next";
import path from "path";

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
  webpack(config) {
    // @novu/notification-center is not installed; alias it to a local stub
    // so imports resolve without requiring the real package.
    config.resolve.alias["@novu/notification-center"] = path.resolve(
      __dirname,
      "lib/novu-stub.tsx"
    );
    return config;
  },
};

export default nextConfig;
