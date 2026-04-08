import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["just-bash", "node-liblzma", "pg"],
};

export default nextConfig;
