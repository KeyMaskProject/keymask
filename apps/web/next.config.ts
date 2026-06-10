import type { NextConfig } from "next";

const config: NextConfig = {
  transpilePackages: [
    "@keysark/ui",
    "@keysark/db",
    "@keysark/baidupan",
    "@keysark/googledrive",
    "@keysark/crypto",
    "@keysark/vault",
  ],
  experimental: { typedRoutes: true },
};

export default config;
