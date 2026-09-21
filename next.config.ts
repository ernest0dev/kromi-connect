import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      allowedOrigins: ["localhost:3000", "127.0.0.1:3000", "*.app.github.dev"],
    },
  },
  allowedDevOrigins: ["localhost:3000", "127.0.0.1:3000", "*.app.github.dev"],
};

export default nextConfig;
