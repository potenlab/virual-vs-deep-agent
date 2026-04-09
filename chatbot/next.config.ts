import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["just-bash", "node-liblzma", "pg", "pdf-parse-new"],
};

export default nextConfig;
