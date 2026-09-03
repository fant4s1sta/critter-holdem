import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async rewrites() {
    return [{ source: "/room/:code", destination: "/" }];
  },
};

export default nextConfig;
