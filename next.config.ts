import type { NextConfig } from "next";
import path from "node:path";

const nextConfig: NextConfig = {
  // 显式指定 Turbopack 工作区根目录，避免向上层目录误判（上层存在无关的 lockfile）
  turbopack: {
    root: path.resolve(__dirname),
  },

  /**
   * 允许本机回环地址访问 dev 资源。
   *
   * 为什么需要：Next.js 16 默认拦截跨源 dev 资源请求。用 127.0.0.1 访问
   * `next dev` 时，HMR 客户端会被判定为跨源并被拦，导致 hydration 静默中断——
   * 页面停在 SSR 骨架、控制台没有报错，极难排查（本地自动化测试就踩过这个坑）。
   */
  allowedDevOrigins: ["127.0.0.1", "localhost"],
};

export default nextConfig;
