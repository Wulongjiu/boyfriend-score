'use client';

import { useEffect, useState } from 'react';

/**
 * 分数滚动动画（从 0 数到最终分数）
 *
 * 细节：用 requestAnimationFrame + easeOutCubic 缓动，
 * 时长 900ms——再长会让人等，再短会失去"揭晓感"。
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

export default function ScoreRing({ score, size = 200, isCapped = false }: ScoreRingProps) {
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

  const stroke = 14;
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
          stroke="#fde4e6"
          strokeWidth={stroke}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="#e11d48"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={`${dash} ${circumference}`}
          style={{ transition: 'stroke-dasharray 120ms linear' }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span
          className="text-6xl font-bold tabular-nums text-rose-600"
          aria-label={`得分 ${score} 分`}
        >
          {displayed}
        </span>
        <span className="mt-1 text-xs text-neutral-400">满分 100</span>
        {isCapped && (
          <span className="mt-1 rounded-full bg-rose-100 px-2 py-0.5 text-[10px] text-rose-600">
            命中红线封顶
          </span>
        )}
      </div>
    </div>
  );
}
