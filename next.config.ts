import type { NextConfig } from "next";

const nextConfig = {
  eslint: {
    // Don’t fail the build if ESLint finds errors
    ignoreDuringBuilds: true,
  },
};

export default nextConfig;

/* config options here */
