'use client';

import { useEffect, useState } from 'react';

/**
 * 分数滚动动画（从 0 数到最终分数）
 *
 * 细节：requestAnimationFrame + easeOutCubic 缓动，时长 900ms——
 * 再长会让人等，再短会失去"揭晓感"。
 *
 * 视觉（杂志风）：墨黑粗圆环轨道 + 玫瑰进度弧，数字用得意黑。
 * 对比度：数字是 ink on paper（16.7:1），远超大字 3:1 要求。
 */
interface ScoreRingProps {
  score: number;
  size?: number;
  /** 是否因红线封顶 */
  isCapped?: boolean;
}

const DURATION = 900;

function easeOutCubic(t: number): number {
  return 1 - (1 - t) ** 3;
}

export default function ScoreRing({ score, size = 210, isCapped = false }: ScoreRingProps) {
  const [displayed, setDisplayed] = useState(0);

  useEffect(() => {
    // 尊重"减少动效"偏好，直接显示最终值
    const prefersReduced =
      typeof window !== 'undefined' &&
      window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    if (prefersReduced) {
      setDisplayed(score);
      return;
    }

    let frame = 0;
    const start = performance.now();
    const tick = (now: number) => {
      const progress = Math.min(1, (now - start) / DURATION);
      setDisplayed(Math.round(score * easeOutCubic(progress)));
      if (progress < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [score]);

  const stroke = 16;
  const r = (size - stroke) / 2;
  const circumference = 2 * Math.PI * r;
  const dash = (displayed / 100) * circumference;

  return (
    <div className="relative mx-auto" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90" aria-hidden="true">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="var(--ink)"
          strokeWidth={stroke}
          opacity={0.14}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="var(--rose-bright)"
          strokeWidth={stroke}
          strokeLinecap="butt"
          strokeDasharray={`${dash} ${circumference}`}
          style={{ transition: 'stroke-dasharray 120ms linear' }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span
          className="font-display text-[76px] leading-none text-ink"
          aria-label={`得分 ${score} 分`}
        >
          {displayed}
        </span>
        <span className="mt-2 text-[11px] text-ink-mute">满分 100</span>
        {isCapped && (
          <span className="mt-2 border-2 border-ink bg-amber-tint px-2.5 py-0.5 text-[10px] font-semibold text-ink">
            命中红线封顶
          </span>
        )}
      </div>
    </div>
  );
}
