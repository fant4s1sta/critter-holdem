import type { NextConfig } from "next";
import { STATIC_ASSET_CACHE_CONTROL } from "./src/lib/static-asset-cache";

const assetVersion =
  process.env.NEXT_PUBLIC_ASSET_VERSION ||
  process.env.RAILWAY_GIT_COMMIT_SHA?.slice(0, 12) ||
  (process.env.NODE_ENV === "production" ? Date.now().toString(36) : "dev");

const staticCacheHeaders = [
  { key: "Cache-Control", value: STATIC_ASSET_CACHE_CONTROL },
];

const nextConfig: NextConfig = {
  env: {
    NEXT_PUBLIC_ASSET_VERSION: assetVersion,
  },
  async headers() {
    // Dev needs short-lived /_next/static caches; long-lived headers break HMR.
    if (process.env.NODE_ENV !== "production") return [];
    return [
      {
        source: "/:all*(webp|png|jpg|jpeg|gif|svg|ico|woff|woff2)",
        headers: staticCacheHeaders,
      },
      {
        source: "/_next/static/:path*",
        headers: staticCacheHeaders,
      },
    ];
  },
  async rewrites() {
    return [{ source: "/room/:code", destination: "/" }];
  },
};

export default nextConfig;
