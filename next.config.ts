import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // The e2e server builds into its own folder: Next locks the dist dir, so a
  // second `next dev` next to a running one would otherwise refuse to start.
  distDir: process.env.NEXT_DIST_DIR ?? ".next",
};

export default nextConfig;
