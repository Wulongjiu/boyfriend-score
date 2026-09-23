import type { Metadata, Viewport } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import './globals.css';
import { BRAND } from '../lib/brand';

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
});

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
});

export const metadata: Metadata = {
  title: `${BRAND.name} · 3 分钟看看他能不能活下来`,
  description: `${BRAND.subtitle}不用注册，不收集隐私，答完就知道你心里早就有的答案。`,
  applicationName: BRAND.name,
  // 分享到微信/小红书时卡片标题与描述
  openGraph: {
    title: `${BRAND.name} · 3 分钟看看他能不能活下来`,
    description: BRAND.subtitle,
    siteName: BRAND.name,
    locale: 'zh_CN',
    type: 'website',
  },
  robots: { index: true, follow: true },
};

/**
 * viewportFit: 'cover' 是必需的——答题页用了 min-h-[100dvh] 与底部操作区，
 * 在 iPhone 刘海屏上不加这个会出现底部被安全区遮挡。
 * 不设置 maximumScale / userScalable：禁止缩放对无障碍不友好。
 *
 * themeColor 用奶油纸色，与杂志风底色一致。
 */
export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: '#fffaf5',
};

export default function RootLayout({ children }: LayoutProps<'/'>) {
  return (
    <html
      lang="zh-CN"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col bg-paper text-ink">{children}</body>
    </html>
  );
}
