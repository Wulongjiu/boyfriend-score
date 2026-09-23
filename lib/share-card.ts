import { BRAND } from './brand';

/**
 * 分享卡片生成（纯前端 Canvas，零依赖）
 *
 * 为什么不用 @vercel/og / Satori：
 *  - Satori 必须自带字体文件，中文字体动辄 5–15MB，会拖慢函数冷启动
 *  - Canvas 直接复用用户设备上的中文字体，零字体体积、零服务端成本
 *  - 完全离线可用，不依赖网络
 *
 * 尺寸：1080×1440（3:4），小红书主图比例，正好适配「保存后直接发」。
 * ⚠️ 卡片只呈现「分数 + 称号 + 一句结论」，绝不出现逐题答案（见 lib/quiz.ts 的说明）。
 */

export const CARD_WIDTH = 1080;
export const CARD_HEIGHT = 1440;

export interface CardData {
  score: number;
  levelTitle: string;
  oneLiner: string;
  /** 站点短地址（去掉协议，仅用于展示） */
  siteLabel: string;
  /** 是否因命中红线被封顶 */
  isCapped: boolean;
}

const COLORS = {
  bg: '#fff7f7',
  card: '#ffffff',
  rose: '#e11d48',
  roseSoft: '#fecdd3',
  text: '#1f2937',
  muted: '#6b7280',
  faint: '#9ca3af',
} as const;

const FONT_STACK =
  '"PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", "Source Han Sans SC", "Noto Sans CJK SC", sans-serif';

/** 圆角矩形 */
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

/** 中文按字符断行（Canvas 不会自动换行） */
function wrapText(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
): string[] {
  const lines: string[] = [];
  let line = '';
  for (const char of text) {
    const next = line + char;
    if (ctx.measureText(next).width > maxWidth && line) {
      lines.push(line);
      line = char;
    } else {
      line = next;
    }
  }
  if (line) lines.push(line);
  return lines;
}

/**
 * 把结果画成 PNG
 * @returns PNG Blob（未做任何网络请求）
 */
export async function renderShareCard(data: CardData): Promise<Blob> {
  const canvas = document.createElement('canvas');
  canvas.width = CARD_WIDTH;
  canvas.height = CARD_HEIGHT;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('当前浏览器不支持 Canvas');

  // 背景
  ctx.fillStyle = COLORS.bg;
  ctx.fillRect(0, 0, CARD_WIDTH, CARD_HEIGHT);

  // 主卡片
  const pad = 60;
  const cardX = pad;
  const cardY = pad;
  const cardW = CARD_WIDTH - pad * 2;
  const cardH = CARD_HEIGHT - pad * 2;
  ctx.fillStyle = COLORS.card;
  roundRect(ctx, cardX, cardY, cardW, cardH, 48);
  ctx.fill();
  ctx.strokeStyle = COLORS.roseSoft;
  ctx.lineWidth = 3;
  ctx.stroke();

  const cx = CARD_WIDTH / 2;
  ctx.textAlign = 'center';

  // 品牌名
  ctx.fillStyle = COLORS.rose;
  ctx.font = `600 40px ${FONT_STACK}`;
  ctx.fillText(BRAND.name, cx, cardY + 130);

  // 分数
  ctx.fillStyle = COLORS.rose;
  ctx.font = `800 300px ${FONT_STACK}`;
  ctx.textBaseline = 'alphabetic';
  ctx.fillText(String(data.score), cx, cardY + 500);

  // 满分说明
  ctx.fillStyle = COLORS.faint;
  ctx.font = `400 34px ${FONT_STACK}`;
  ctx.fillText('满分 100', cx, cardY + 560);

  // 封顶提示
  if (data.isCapped) {
    ctx.fillStyle = COLORS.rose;
    ctx.font = `500 30px ${FONT_STACK}`;
    ctx.fillText('（命中红线，总分已封顶）', cx, cardY + 610);
  }

  // 称号
  ctx.fillStyle = COLORS.text;
  ctx.font = `700 76px ${FONT_STACK}`;
  const titleY = data.isCapped ? cardY + 730 : cardY + 700;
  ctx.fillText(data.levelTitle, cx, titleY);

  // 一句话结论（自动换行，最多 3 行）
  ctx.fillStyle = COLORS.muted;
  ctx.font = `400 44px ${FONT_STACK}`;
  const lines = wrapText(ctx, data.oneLiner, cardW - 200).slice(0, 3);
  lines.forEach((line, i) => {
    ctx.fillText(line, cx, titleY + 110 + i * 68);
  });

  // 分隔线
  const dividerY = titleY + 110 + lines.length * 68 + 40;
  ctx.strokeStyle = COLORS.roseSoft;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(cardX + 140, dividerY);
  ctx.lineTo(cardX + cardW - 140, dividerY);
  ctx.stroke();

  // 引导语
  ctx.fillStyle = COLORS.text;
  ctx.font = `500 40px ${FONT_STACK}`;
  ctx.fillText('你也来测测他', cx, dividerY + 100);

  // 站点
  ctx.fillStyle = COLORS.faint;
  ctx.font = `400 34px ${FONT_STACK}`;
  ctx.fillText(data.siteLabel, cx, dividerY + 165);

  // 署名
  ctx.fillStyle = COLORS.faint;
  ctx.font = `400 28px ${FONT_STACK}`;
  ctx.fillText(BRAND.signature, cx, cardH - 70);

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
  // 交给浏览器完成下载后再回收
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}
