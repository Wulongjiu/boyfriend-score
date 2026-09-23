import { BRAND } from './brand';

/**
 * 分享卡片生成（纯前端 Canvas，零依赖）
 *
 * ── 为什么用 Canvas 而不是 @vercel/og / Satori ──────────────────────────
 * Satori 必须自带字体文件；中文字体动辄 5–15MB，会拖慢函数冷启动。
 * Canvas 由浏览器本地渲染，服务端零成本、可离线、无字体上传。
 *
 * ── 字体策略（关键） ──────────────────────────────────────────────────
 * 标题用「得意黑 Smiley Sans Oblique」（OFL-1.1，可商用）。
 * 但它的汉字覆盖只有 8057（黑体是 20902），因此：
 *   · 分数、称号、品牌名等**标题短句** → 得意黑
 *   · 一句话结论等**长文本正文** → 系统中文黑体（不缺字、可读）
 *
 * 字体用**精确子集**（76.5KB，由 scripts/build-font-subset.py 从 lib/levels.ts、
 * lib/copy.ts、lib/brand.ts 提取字符生成）。卡片上只出现受控字符串——分数、6 个
 * 称号、6 句结论、品牌名、站点名——没有用户输入，所以子集是完备的。
 * 对比：全量字体 1.1MB，是子集的 14 倍，没有必要为此拖慢每一次保存。
 * ⚠️ 若以后卡片要显示新的动态文案（例如用户自定义昵称），必须重新生成子集。
 *
 * ── 视觉方向 ─────────────────────────────────────────────────────────
 * 杂志专栏风：奶油纸底 + 白色卡面 + 粗黑描边 + 玫瑰色条 + 硬投影。
 * 目的：截图发到小红书信息流里能一眼跳出来。
 *
 * ── 隐私约束（不可违反） ──────────────────────────────────────────────
 * 卡片只呈现「分数 + 称号 + 一句结论」，绝不出现她逐题选了什么。
 */

export const CARD_WIDTH = 1080;
export const CARD_HEIGHT = 1440;

export interface CardData {
  score: number;
  /** 关系原型标题：卡片上的主角，比等级称号更有分享欲 */
  archetypeTitle: string;
  /** 原型的"一句话"（分享卡片上的钩子） */
  oneLiner: string;
  /** 等级称号，作为副信息保留 */
  levelTitle: string;
  /** 站点短地址（仅用于展示） */
  siteLabel: string;
  /** 是否因命中红线被封顶 */
  isCapped: boolean;
}

/* ── 设计令牌（与 app/globals.css 保持一致） ─────────────────────── */
const C = {
  paper: '#fffaf5',
  card: '#ffffff',
  ink: '#12100e',
  inkSoft: '#4a4441',
  inkMute: '#6f6864',
  rose: '#c2003a',
  roseBright: '#e70044',
  roseTint: '#ffe9ef',
} as const;

/** 描边宽度（1080px 画布下的视觉等价于 2.5px @ 390px） */
const BORDER = 6;
/** 硬投影偏移 */
const SHADOW = 14;

const DISPLAY_FONT = '"Smiley Sans Oblique", "Smiley Sans", ';
const BODY_FONT =
  '"PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", "Source Han Sans SC", "Noto Sans CJK SC", sans-serif';

const displayFont = (size: number, weight = 400) =>
  `${weight} ${size}px ${DISPLAY_FONT}${BODY_FONT}`;
const bodyFont = (size: number, weight = 400) =>
  `${weight} ${size}px ${BODY_FONT}`;

/* ── 绘制工具 ────────────────────────────────────────────────────── */

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
): void {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.arcTo(x + w, y, x + w, y + r, r);
  ctx.lineTo(x + w, y + h - r);
  ctx.arcTo(x + w, y + h, x + w - r, y + h, r);
  ctx.lineTo(x + r, y + h);
  ctx.arcTo(x, y + h, x, y + h - r, r);
  ctx.lineTo(x, y + r);
  ctx.arcTo(x, y, x + r, y, r);
  ctx.closePath();
}

/**
 * 中英混排断行
 *
 * 纯按字符断行会把英文单词切断（"someone" → "somew / one"）。
 * 这里把连续的拉丁字母/数字聚成一个 token，中文仍按字断行。
 */
export function wrapText(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
): string[] {
  const tokens = text.match(/[A-Za-z0-9]+[.,!?;:'"]?|\s+|[^A-Za-z0-9\s]/g) ?? [];
  const lines: string[] = [];
  let line = '';

  for (const token of tokens) {
    if (/^\s+$/.test(token)) {
      // 行首空格丢弃，避免缩进
      if (line) line += ' ';
      continue;
    }
    const next = line + token;
    if (ctx.measureText(next).width > maxWidth && line) {
      lines.push(line.trimEnd());
      line = token;
    } else {
      line = next;
    }
  }
  if (line.trim()) lines.push(line.trimEnd());
  return lines;
}

/**
 * 确保标题字体可用
 *
 * Canvas 不会自动等 Web 字体加载完——字体没就绪时 fillText 会静默回退到
 * 系统字体，导致卡片"有时好看有时难看"。这里显式加载并等待。
 */
async function ensureDisplayFont(): Promise<boolean> {
  if (typeof document === 'undefined' || !document.fonts) return false;
  const family = 'Smiley Sans Oblique';
  try {
    if (!document.fonts.check(`40px "${family}"`)) {
      const face = new FontFace(family, 'url(/fonts/smiley-sans-card.woff2)', {
        style: 'oblique',
      });
      await face.load();
      document.fonts.add(face);
    }
    await document.fonts.ready;
    return document.fonts.check(`40px "${family}"`);
  } catch {
    return false;
  }
}

/* ── 主渲染 ──────────────────────────────────────────────────────── */

/**
 * 把结果画成 1080×1440 PNG（小红书 3:4 主图比例）
 * @returns PNG Blob（未发起任何网络请求，仅可能加载本地字体）
 */
export async function renderShareCard(data: CardData): Promise<Blob> {
  const hasDisplayFont = await ensureDisplayFont();

  const canvas = document.createElement('canvas');
  canvas.width = CARD_WIDTH;
  canvas.height = CARD_HEIGHT;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('当前浏览器不支持 Canvas');

  const cx = CARD_WIDTH / 2;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';

  /* 纸底 */
  ctx.fillStyle = C.paper;
  ctx.fillRect(0, 0, CARD_WIDTH, CARD_HEIGHT);

  /* 点阵纹理：杂志纸感。程序化绘制，不增加任何字节 */
  ctx.fillStyle = 'rgba(18,16,14,0.05)';
  for (let gx = 26; gx < CARD_WIDTH; gx += 34) {
    for (let gy = 26; gy < CARD_HEIGHT; gy += 34) {
      ctx.beginPath();
      ctx.arc(gx, gy, 1.6, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  /* 卡面：白底 + 粗黑描边 + 硬投影 */
  const pad = 54;
  const cardX = pad;
  const cardY = pad;
  const cardW = CARD_WIDTH - pad * 2 - SHADOW;
  const cardH = CARD_HEIGHT - pad * 2 - SHADOW;

  ctx.fillStyle = C.ink;
  roundRect(ctx, cardX + SHADOW, cardY + SHADOW, cardW, cardH, 20);
  ctx.fill();

  ctx.fillStyle = C.card;
  roundRect(ctx, cardX, cardY, cardW, cardH, 20);
  ctx.fill();
  ctx.strokeStyle = C.ink;
  ctx.lineWidth = BORDER;
  ctx.stroke();

  /* 顶部品牌条：玫瑰色实心 + 黑描边（杂志刊头感） */
  const mastheadH = 118;
  ctx.save();
  ctx.beginPath();
  roundRect(ctx, cardX, cardY, cardW, cardH, 20);
  ctx.clip();
  ctx.fillStyle = C.rose;
  ctx.fillRect(cardX, cardY, cardW, mastheadH);
  ctx.restore();

  ctx.fillStyle = '#ffffff';
  ctx.font = hasDisplayFont
    ? displayFont(56)
    : bodyFont(52, 700);
  ctx.fillText(BRAND.name, cx, cardY + 79);

  // 刊头与内容的分隔线
  ctx.strokeStyle = C.ink;
  ctx.lineWidth = BORDER;
  ctx.beginPath();
  ctx.moveTo(cardX, cardY + mastheadH);
  ctx.lineTo(cardX + cardW, cardY + mastheadH);
  ctx.stroke();

  /* 分数标签 */
  let y = cardY + mastheadH + 92;
  ctx.fillStyle = C.inkMute;
  ctx.font = bodyFont(34, 500);
  ctx.fillText('他 的 生 存 指 数', cx, y);

  /* 分数：全场视觉主体 */
  y += 300;
  ctx.fillStyle = C.ink;
  ctx.font = hasDisplayFont ? displayFont(300) : bodyFont(280, 800);
  ctx.fillText(String(data.score), cx, y);

  /* 封顶提示（红底黑描边的标签） */
  if (data.isCapped) {
    const label = '命中红线 · 总分已封顶';
    ctx.font = bodyFont(30, 600);
    const tw = ctx.measureText(label).width;
    const lw = tw + 56;
    const lh = 62;
    const lx = cx - lw / 2;
    const ly = y + 44;
    ctx.fillStyle = C.roseTint;
    roundRect(ctx, lx, ly, lw, lh, 31);
    ctx.fill();
    ctx.strokeStyle = C.ink;
    ctx.lineWidth = 4;
    ctx.stroke();
    ctx.fillStyle = C.rose;
    ctx.fillText(label, cx, ly + 43);
    y = ly + lh;
  } else {
    ctx.fillStyle = C.inkMute;
    ctx.font = bodyFont(32, 400);
    ctx.fillText('满分 100', cx, y + 62);
    y += 62;
  }

  /* 等级称号（副信息，小字） */
  y += 76;
  ctx.fillStyle = C.inkMute;
  ctx.font = bodyFont(30, 500);
  ctx.fillText(data.levelTitle, cx, y);

  /* 关系原型标题（主角，得意黑大字，最多两行） */
  y += 86;
  ctx.fillStyle = C.ink;
  ctx.font = hasDisplayFont ? displayFont(74) : bodyFont(68, 800);
  const titleLines = wrapText(ctx, data.archetypeTitle, cardW - 140).slice(0, 2);
  for (const line of titleLines) {
    ctx.fillText(line, cx, y);
    y += 88;
  }

  /* 玫瑰色短线：杂志式分隔 */
  y += 16;
  ctx.fillStyle = C.roseBright;
  ctx.fillRect(cx - 60, y, 120, 8);

  /* 一句话钩子（正文用系统字体：得意黑汉字覆盖不足，不可用于长文本） */
  y += 74;
  ctx.fillStyle = C.inkSoft;
  ctx.font = bodyFont(40, 400);
  const quoteLines = wrapText(ctx, data.oneLiner, cardW - 180).slice(0, 3);
  const quoteStart = y;
  for (const line of quoteLines) {
    ctx.fillText(line, cx, y);
    y += 60;
  }

  /* ── 底部区域 ─────────────────────────────────────────────────────
   * 关键：底部位置按**内容实际高度**与**固定页脚高度**推导，不能写死偏移。
   * 原型标题最长两行、结论最长三行，内容高度是可变的；若底部写死，
   * 长内容会与页脚重叠（实测出现过"结论压住引导语"）。 */
  const FOOTER_H = 210;
  const cardBottom = cardY + cardH;
  const contentBottom = y - 60; // 最后一行基线之上
  const footerTop = Math.max(contentBottom + 56, cardBottom - FOOTER_H);

  ctx.strokeStyle = '#e8e2dc';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(cardX + 120, footerTop);
  ctx.lineTo(cardX + cardW - 120, footerTop);
  ctx.stroke();

  ctx.fillStyle = C.ink;
  ctx.font = hasDisplayFont ? displayFont(46) : bodyFont(42, 700);
  ctx.fillText('你也来测测他', cx, footerTop + 78);

  ctx.fillStyle = C.rose;
  ctx.font = bodyFont(34, 600);
  ctx.fillText(data.siteLabel, cx, footerTop + 138);

  ctx.fillStyle = C.inkMute;
  ctx.font = bodyFont(26, 400);
  ctx.fillText(BRAND.signature, cx, footerTop + 192);

  // 避免未使用变量告警：quoteStart 仅用于调试布局高度
  void quoteStart;

  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error('生成图片失败'))),
      'image/png',
    );
  });
}

/** 触发下载 */
export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}
