import type { NextConfig } from "next";
import path from "node:path";

const nextConfig: NextConfig = {
  // 显式指定 Turbopack 工作区根目录，避免向上层目录误判（上层存在无关的 lockfile）
  turbopack: {
    root: path.resolve(__dirname),
  },
};

export default nextConfig;
