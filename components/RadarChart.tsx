'use client';

import type { DimensionResult } from '../lib/types';

/**
 * 七维雷达图（纯 SVG，零依赖）
 *
 * 为什么不用 ECharts / Recharts：它们会给首包加几百 KB，而这里只需要
 * 一个 7 轴多边形。手写 SVG 体积接近 0，且能精确控制视觉。
 *
 * 配色随设计系统 v2（杂志风）：网格用浅墨、数据面用玫瑰、轴标签用墨黑/玫瑰。
 */

interface RadarChartProps {
  dimensions: readonly DimensionResult[];
  size?: number;
}

const LEVELS = [20, 40, 60, 80, 100];

/** 网格线：墨黑低透明度，避免在奶油底上偏色 */
const GRID = 'rgba(18,16,14,0.18)';
const GRID_STRONG = 'rgba(18,16,14,0.32)';
const INK = '#12100e';
const INK_MUTE = '#6f6864';
const ROSE = '#c2003a';
const ROSE_FILL = 'rgba(194,0,58,0.16)';

export default function RadarChart({ dimensions, size = 300 }: RadarChartProps) {
  const count = dimensions.length;
  if (count < 3) return null;

  const cx = size / 2;
  const cy = size / 2;
  /**
   * 半径与标签位置
   *
   * ⚠️ 这里踩过坑：曾经写死 labelRadius = size * 0.44，导致「一致」「未来」
   * 两个标签超出 viewBox 被裁掉（右侧溢出 28px、左侧 6px）。
   * 现在按**文字实际宽度**算出各轴能承受的最大标签半径，取最小值——
   * 这样以后改轴标签文案也不会再溢出。
   *
   * 估算依据：中文标签 2 字 ≈ 2×fontSize，加安全余量。
   * ⚠️ 余量取 12 而不是 6：实测浏览器渲染的汉字宽度比 1×fontSize 略宽，
   *    6px 余量下「一致」「未来」仍会各溢出 5px（这个数字是实测出来的，
   *    不是估的）。12px 留出足够安全边际。
   */
  const labelFontSize = Math.max(11, Math.round(size * 0.043));
  const pad = 12;
  const maxLabelRadius = Math.min(
    ...dimensions.map((d, i) => {
      const angle = (Math.PI * 2 * i) / count - Math.PI / 2;
      const cos = Math.cos(angle);
      const halfW = (d.short.length * labelFontSize) / 2 + pad;
      // 上下方向的轴标签水平居中，不受 x 方向限制
      if (Math.abs(cos) < 0.2) return size / 2;
      // 右侧：标签从 x 向右延伸 → 需要 cx + R + halfW <= size
      if (cos > 0) return size - cx - halfW;
      // 左侧：标签从 x 向左延伸 → 需要 cx - R - halfW >= 0
      return cx - halfW;
    }),
  );
  const radius = Math.max(size * 0.2, maxLabelRadius * 0.86); // 网格留出标签间隙
  const labelRadius = maxLabelRadius;

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
          stroke={level === 100 ? GRID_STRONG : GRID}
          strokeWidth={level === 100 ? 2 : 1}
        />
      ))}

      {/* 轴线 */}
      {dimensions.map((d, i) => {
        const p = pointAt(i, 1);
        return (
          <line key={d.id} x1={cx} y1={cy} x2={p.x} y2={p.y} stroke={GRID} strokeWidth={1} />
        );
      })}

      {/* 数据多边形 */}
      <polygon points={dataPolygon} fill={ROSE_FILL} stroke={ROSE} strokeWidth={3} />

      {/* 数据点 */}
      {dimensions.map((d, i) => {
        const p = pointAt(i, Math.max(0, Math.min(100, d.score)) / 100);
        return <circle key={d.id} cx={p.x} cy={p.y} r={4.5} fill={ROSE} stroke={INK} strokeWidth={1} />;
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
              y={y - labelFontSize * 0.32}
              textAnchor={anchor}
              dominantBaseline="middle"
              fontSize={labelFontSize}
              fontWeight={500}
              fill={INK}
            >
              {d.short}
            </text>
            <text
              x={x}
              y={y + labelFontSize * 1.02}
              textAnchor={anchor}
              dominantBaseline="middle"
              fontSize={labelFontSize - 1}
              fontWeight={700}
              fill={d.score < 60 ? ROSE : INK_MUTE}
            >
              {Math.round(d.score)}
            </text>
          </g>
        );
      })}
    </svg>
  );
}
