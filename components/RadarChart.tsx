'use client';

import type { DimensionResult } from '../lib/types';

/**
 * 七维雷达图（纯 SVG，零依赖）
 *
 * 为什么不用 ECharts / Recharts：它们会给首包加几百 KB，而这里只需要
 * 一个 7 轴多边形。手写 SVG 体积接近 0，且能精确控制视觉。
 */

interface RadarChartProps {
  dimensions: readonly DimensionResult[];
  size?: number;
}

const LEVELS = [20, 40, 60, 80, 100];

export default function RadarChart({ dimensions, size = 300 }: RadarChartProps) {
  const count = dimensions.length;
  if (count < 3) return null;

  const cx = size / 2;
  const cy = size / 2;
  // 留出标签空间：半径占 62%
  const radius = size * 0.31;
  const labelRadius = size * 0.44;

  /** 第 i 个轴上的点（12 点方向为第 0 轴，顺时针） */
  const pointAt = (index: number, ratio: number) => {
    const angle = (Math.PI * 2 * index) / count - Math.PI / 2;
    return {
      x: cx + Math.cos(angle) * radius * ratio,
      y: cy + Math.sin(angle) * radius * ratio,
    };
  };

  const gridPolygons = LEVELS.map((level) => {
    const ratio = level / 100;
    const points = Array.from({ length: count }, (_, i) => {
      const p = pointAt(i, ratio);
      return `${p.x.toFixed(1)},${p.y.toFixed(1)}`;
    }).join(' ');
    return { level, points };
  });

  const dataPolygon = dimensions
    .map((d, i) => {
      const p = pointAt(i, Math.max(0, Math.min(100, d.score)) / 100);
      return `${p.x.toFixed(1)},${p.y.toFixed(1)}`;
    })
    .join(' ');

  return (
    <svg
      viewBox={`0 0 ${size} ${size}`}
      width="100%"
      // 注意：不要写 height="auto"——SVG 的 height 只接受长度值，写 auto 会产生
      // 控制台报错。响应式高度交给外层容器与 viewBox 的默认 aspect-ratio 处理。
      role="img"
      aria-label={`七维得分雷达图：${dimensions.map((d) => `${d.label} ${d.score} 分`).join('，')}`}
      className="mx-auto block max-w-[340px]"
    >
      {/* 网格 */}
      {gridPolygons.map(({ level, points }) => (
        <polygon
          key={level}
          points={points}
          fill="none"
          stroke="#f1d4d8"
          strokeWidth={level === 100 ? 2 : 1}
        />
      ))}

      {/* 轴线 */}
      {dimensions.map((d, i) => {
        const p = pointAt(i, 1);
        return (
          <line
            key={d.id}
            x1={cx}
            y1={cy}
            x2={p.x}
            y2={p.y}
            stroke="#f1d4d8"
            strokeWidth={1}
          />
        );
      })}

      {/* 数据多边形 */}
      <polygon points={dataPolygon} fill="rgba(225,29,72,0.18)" stroke="#e11d48" strokeWidth={2.5} />

      {/* 数据点 */}
      {dimensions.map((d, i) => {
        const p = pointAt(i, Math.max(0, Math.min(100, d.score)) / 100);
        return <circle key={d.id} cx={p.x} cy={p.y} r={4} fill="#e11d48" />;
      })}

      {/* 轴标签 + 分数 */}
      {dimensions.map((d, i) => {
        const angle = (Math.PI * 2 * i) / count - Math.PI / 2;
        const x = cx + Math.cos(angle) * labelRadius;
        const y = cy + Math.sin(angle) * labelRadius;
        const anchor =
          Math.abs(Math.cos(angle)) < 0.2 ? 'middle' : Math.cos(angle) > 0 ? 'start' : 'end';
        return (
          <g key={d.id}>
            <text
              x={x}
              y={y - 4}
              textAnchor={anchor}
              dominantBaseline="middle"
              fontSize={13}
              fill="#4b5563"
            >
              {d.short}
            </text>
            <text
              x={x}
              y={y + 12}
              textAnchor={anchor}
              dominantBaseline="middle"
              fontSize={12}
              fontWeight={600}
              fill="#e11d48"
            >
              {Math.round(d.score)}
            </text>
          </g>
        );
      })}
    </svg>
  );
}
