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

  /**
   * 字体长缓存。
   *
   * 默认 Next 给 public/ 静态资源发 `max-age=0, must-revalidate`，意味着每次
   * 首屏都要回源校验 178KB 的字体。字体是内容固定的二进制资产，适合 immutable。
   *
   * ⚠️ 代价：字体内容变更后浏览器不会自动更新。**换字体时必须同时改文件名**
   * （例如 smiley-sans-display-v2.woff2），否则老用户会一直用缓存里的旧字体。
   */
  async headers() {
    return [
      {
        source: "/fonts/:path*",
        headers: [
          { key: "Cache-Control", value: "public, max-age=31536000, immutable" },
        ],
      },
    ];
  },
};

export default nextConfig;
