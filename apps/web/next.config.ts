import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@elove/shared"],
  eslint: { ignoreDuringBuilds: true },
};

export default nextConfig;
