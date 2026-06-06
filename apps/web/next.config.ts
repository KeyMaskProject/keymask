import type { NextConfig } from "next";

const config: NextConfig = {
  transpilePackages: ["@keysark/ui", "@keysark/db", "@keysark/baidupan", "@keysark/crypto"],
  experimental: { typedRoutes: true },
};

export default config;
