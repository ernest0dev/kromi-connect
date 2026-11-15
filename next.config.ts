import type { NextConfig } from "next";
import { getDataMode } from "./src/lib/supabase/data-mode";

const nextConfig: NextConfig = {
  // Data mode is non-sensitive, but browser guards need a NEXT_PUBLIC value.
  env: {
    NEXT_PUBLIC_KROMI_DATA_MODE: getDataMode(),
  },
  experimental: {
    serverActions: {
      allowedOrigins: ["localhost:3000", "127.0.0.1:3000", "*.app.github.dev"],
    },
  },
  allowedDevOrigins: ["localhost:3000", "127.0.0.1:3000", "*.app.github.dev"],
};

export default nextConfig;
