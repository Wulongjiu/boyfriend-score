import type { SVGProps } from 'react';

/**
 * 线性图标集（内联 SVG，零依赖）
 *
 * 为什么不用 emoji：得意黑的缺字报告里，`🔒 ⏱ 📊 ✅` 全部缺失——emoji 是
 * 字体依赖的，跨平台渲染不一致（iOS/Android/Web 三套），且无法用设计令牌控制
 * 描边粗细与颜色。杂志风需要"统一的视觉语言"，所以用 SVG。
 *
 * 规格：24×24 viewBox、stroke 当前色、线宽 2、圆头圆角，与粗描边风格一致。
 */

type IconProps = SVGProps<SVGSVGElement> & { size?: number };

function Base({ size = 24, children, ...rest }: IconProps & { children: React.ReactNode }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...rest}
    >
      {children}
    </svg>
  );
}

/** 隐私：锁 */
export function IconLock(props: IconProps) {
  return (
    <Base {...props}>
      <rect x="4" y="10.5" width="16" height="10.5" rx="2.5" />
      <path d="M8 10.5V7a4 4 0 0 1 8 0v3.5" />
      <path d="M12 15v2.5" />
    </Base>
  );
}

/** 时长：秒表 */
export function IconTimer(props: IconProps) {
  return (
    <Base {...props}>
      <circle cx="12" cy="13.5" r="7.5" />
      <path d="M12 10v3.8l2.6 1.6" />
      <path d="M9.5 2.5h5" />
      <path d="M12 2.5V6" />
    </Base>
  );
}

/** 依据：柱状图 */
export function IconChart(props: IconProps) {
  return (
    <Base {...props}>
      <path d="M4 20h16" />
      <rect x="5.5" y="12" width="3.6" height="5.5" rx="1" />
      <rect x="10.2" y="7.5" width="3.6" height="10" rx="1" />
      <rect x="14.9" y="4" width="3.6" height="13.5" rx="1" />
    </Base>
  );
}

/** 箭头（按钮/引导） */
export function IconArrow(props: IconProps) {
  return (
    <Base {...props}>
      <path d="M5 12h13" />
      <path d="M12.5 5.5 19 12l-6.5 6.5" />
    </Base>
  );
}

/** 警示（红线区块） */
export function IconAlert(props: IconProps) {
  return (
    <Base {...props}>
      <path d="M12 3.5 21 19.5H3z" />
      <path d="M12 9.5v4.5" />
      <path d="M12 17h.01" />
    </Base>
  );
}

/** 分享 / 下载 */
export function IconDownload(props: IconProps) {
  return (
    <Base {...props}>
      <path d="M12 3.5v11" />
      <path d="M7.5 10.5 12 15l4.5-4.5" />
      <path d="M4.5 19.5h15" />
    </Base>
  );
}

/** 链接 */
export function IconLink(props: IconProps) {
  return (
    <Base {...props}>
      <path d="M10 13.5a3.5 3.5 0 0 0 5 0l3-3a3.54 3.54 0 0 0-5-5l-1 1" />
      <path d="M14 10.5a3.5 3.5 0 0 0-5 0l-3 3a3.54 3.54 0 0 0 5 5l1-1" />
    </Base>
  );
}
