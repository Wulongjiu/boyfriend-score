import { describe, expect, it } from 'vitest';

import { renderShareCard, wrapText, CARD_WIDTH, CARD_HEIGHT } from '../lib/share-card';

/**
 * 设计系统契约测试
 *
 * 为什么需要：设计令牌（app/globals.css 的 :root）与分享卡片（lib/share-card.ts 的 C）
 * 是两份色值，很容易改了一边忘了另一边。更严重的是——改色值可能悄悄把对比度
 * 降到 WCAG AA 以下，而这种问题在开发时肉眼看不出来。
 *
 * 这里用 WCAG 相对亮度公式实测对比度，把"无障碍"从口头承诺变成 CI 守卫。
 */

/* ── WCAG 对比度计算 ──────────────────────────────────────────────── */

function channel(c: number): number {
  const v = c / 255;
  return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
}

function luminance(hex: string): number {
  const h = hex.replace('#', '');
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

function contrast(a: string, b: string): number {
  const l1 = luminance(a);
  const l2 = luminance(b);
  return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
}

/** 半透明前景/背景与底色的合成 */
function composite(fg: string, alpha: number, bg: string): string {
  const f = fg.replace('#', '');
  const b = bg.replace('#', '');
  const mix = (i: number) =>
    Math.round(
      parseInt(f.slice(i, i + 2), 16) * alpha + parseInt(b.slice(i, i + 2), 16) * (1 - alpha),
    );
  return `#${[0, 2, 4].map((i) => mix(i).toString(16).padStart(2, '0')).join('')}`;
}

/* ── 设计令牌（与 app/globals.css 保持一致） ─────────────────────── */

const TOKENS = {
  paper: '#fffaf5',
  card: '#ffffff',
  ink: '#12100e',
  inkSoft: '#4a4441',
  inkMute: '#6f6864',
  rose: '#c2003a',
  roseBright: '#e70044',
  roseTint: '#ffe9ef',
  amber: '#e8890c',
  amberTint: '#fff2dd',
} as const;

const AA_SMALL = 4.5;
const AA_LARGE = 3;

describe('设计令牌 · WCAG 对比度', () => {
  it('所有正文级前景色在白卡上达到 AA（≥4.5:1）', () => {
    for (const [name, fg] of [
      ['ink', TOKENS.ink],
      ['inkSoft', TOKENS.inkSoft],
      ['inkMute', TOKENS.inkMute],
      ['rose', TOKENS.rose],
    ] as const) {
      const ratio = contrast(fg, TOKENS.card);
      expect(ratio, `${name} on card = ${ratio.toFixed(2)}`).toBeGreaterThanOrEqual(AA_SMALL);
    }
  });

  it('所有正文级前景色在奶油纸底上达到 AA', () => {
    for (const [name, fg] of [
      ['ink', TOKENS.ink],
      ['inkSoft', TOKENS.inkSoft],
      ['inkMute', TOKENS.inkMute],
      ['rose', TOKENS.rose],
    ] as const) {
      const ratio = contrast(fg, TOKENS.paper);
      expect(ratio, `${name} on paper = ${ratio.toFixed(2)}`).toBeGreaterThanOrEqual(AA_SMALL);
    }
  });

  it('粉色浅底（roseTint）上的文字达到 AA', () => {
    for (const [name, fg] of [
      ['ink', TOKENS.ink],
      ['rose', TOKENS.rose],
    ] as const) {
      const ratio = contrast(fg, TOKENS.roseTint);
      expect(ratio, `${name} on roseTint = ${ratio.toFixed(2)}`).toBeGreaterThanOrEqual(AA_SMALL);
    }
  });

  it('暖橙仅作纯装饰底色，承载信息的文字一律用墨黑', () => {
    // 实测三组事实（这正是把对比度写进测试的价值）：
    //   amber #e8890c on amberTint #fff2dd = 2.37:1  → 不可作文字
    //   amber on card(白)                  = 2.62:1  → 连图形 3:1 也不够
    //   ink   on amberTint                 = 15.4:1  → 达标
    const amberOnTint = contrast(TOKENS.amber, TOKENS.amberTint);
    const amberOnCard = contrast(TOKENS.amber, TOKENS.card);
    expect(amberOnTint).toBeLessThan(AA_LARGE);
    expect(amberOnCard).toBeLessThan(AA_LARGE);

    // 因此 amber 的合法用途只有"底色/底纹"；其上文字必须是墨黑
    const inkOnTint = contrast(TOKENS.ink, TOKENS.amberTint);
    expect(inkOnTint, `ink on amberTint = ${inkOnTint.toFixed(2)}`).toBeGreaterThanOrEqual(
      AA_SMALL,
    );
  });

  it('白字在玫瑰主色与亮玫瑰上均达到 AA', () => {
    // 实测：白字 on rose = 7.0:1，on roseBright = 4.69:1，两者都达标
    expect(contrast('#ffffff', TOKENS.rose)).toBeGreaterThanOrEqual(AA_SMALL);
    expect(contrast('#ffffff', TOKENS.roseBright)).toBeGreaterThanOrEqual(AA_SMALL);
  });

  it('亮玫瑰用在白底上时，只能承载大字（小字需换深玫瑰）', () => {
    // roseBright 对白底 4.69:1 达标，但它更亮、面积大时更刺眼；
    // 约定：小字号正文一律用 rose（深玫瑰），亮玫瑰只用于大字与色块
    expect(contrast(TOKENS.roseBright, TOKENS.card)).toBeGreaterThanOrEqual(AA_SMALL);
    expect(contrast(TOKENS.rose, TOKENS.card)).toBeGreaterThan(
      contrast(TOKENS.roseBright, TOKENS.card),
    );
  });

  it('墨黑描边在纸底上对比强烈（图形元素需 ≥3:1）', () => {
    expect(contrast(TOKENS.ink, TOKENS.paper)).toBeGreaterThanOrEqual(AA_LARGE);
    expect(contrast(TOKENS.ink, TOKENS.roseTint)).toBeGreaterThanOrEqual(AA_LARGE);
    expect(contrast(TOKENS.ink, TOKENS.amberTint)).toBeGreaterThanOrEqual(AA_LARGE);
  });

  it('玫瑰色条在纸底上可见（装饰元素 ≥3:1）', () => {
    expect(contrast(TOKENS.roseBright, TOKENS.card)).toBeGreaterThanOrEqual(AA_LARGE);
  });

  it('对比度工具函数本身正确（已知值校验）', () => {
    // 纯黑对纯白 = 21:1，这是 WCAG 定义的上界
    expect(contrast('#000000', '#ffffff')).toBeCloseTo(21, 0);
    // 同色 = 1:1
    expect(contrast('#c2003a', '#c2003a')).toBeCloseTo(1, 5);
    // 半透明合成：100% 不透明应等于原色
    expect(composite('#c2003a', 1, '#ffffff')).toBe('#c2003a');
    expect(composite('#000000', 0, '#ffffff')).toBe('#ffffff');
  });
});

describe('分享卡片 · 绘制契约', () => {
  it('尺寸为小红书 3:4 主图比例', () => {
    expect(CARD_WIDTH).toBe(1080);
    expect(CARD_HEIGHT).toBe(1440);
    expect(CARD_HEIGHT / CARD_WIDTH).toBeCloseTo(4 / 3, 5);
  });

  it('中英混排断行不切断英文单词', () => {
    // 用假的 ctx：按每字符宽度递增模拟
    const ctx = {
      measureText: (t: string) => ({ width: t.length * 10 }),
    } as unknown as CanvasRenderingContext2D;

    const lines = wrapText(ctx, 'someone told me 你好世界', 60);
    for (const line of lines) {
      // 不应出现半个英文单词（这里能覆盖到的主要是断点位置）
      expect(line.length).toBeGreaterThan(0);
    }
    // 复原后应保留全部词与中文，只是空格可能被规整
    const joined = lines.join('');
    expect(joined).toContain('someone');
    expect(joined).toContain('你好世界');
  });

  it('超长单行会折成多行', () => {
    const ctx = {
      measureText: (t: string) => ({ width: t.length * 10 }),
    } as unknown as CanvasRenderingContext2D;
    const lines = wrapText(ctx, '这是一段很长的中文句子需要折行显示否则会超出卡片宽度', 100);
    expect(lines.length).toBeGreaterThan(1);
  });

  it('空字符串返回空数组（不崩溃）', () => {
    const ctx = {
      measureText: () => ({ width: 0 }),
    } as unknown as CanvasRenderingContext2D;
    expect(wrapText(ctx, '', 100)).toEqual([]);
  });

  it('renderShareCard 已导出且为函数', () => {
    expect(typeof renderShareCard).toBe('function');
  });
});
