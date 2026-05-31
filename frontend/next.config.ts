import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    optimizePackageImports: ["framer-motion"],
  },
  /* config options here */
};

export default nextConfig;
