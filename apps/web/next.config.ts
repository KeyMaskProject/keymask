import type { NextConfig } from "next";

const config: NextConfig = {
  transpilePackages: ["@keyper/ui", "@keyper/db", "@keyper/baidupan", "@keyper/crypto"],
  experimental: { typedRoutes: true },
};

export default config;
