import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // The Playwright run builds into its own folder, so it can't overwrite the dev server's
  // build (NEXT_PUBLIC_API_URL is baked in at compile time and differs between the two).
  distDir: process.env.NEXT_DIST_DIR ?? ".next",
};

export default nextConfig;
