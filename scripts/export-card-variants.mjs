/**
 * 分享卡片 A/B 变体导出：同一份数据、不同间距密度，一次出多张便于对比
 * 用法: node scripts/export-card-variants.mjs <baseUrl> <outDir>
 */
import { spawn } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const BASE = process.argv[2] ?? 'http://127.0.0.1:3222';
const OUT_DIR = process.argv[3] ?? '.';
const CODE = 'aaaacaaaaaaaaaaaaaaaaaaaaaa';
const CDP_PORT = 9522;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const browserPath = [
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
].find((p) => existsSync(p));
const profileDir = mkdtempSync(join(tmpdir(), 'variants-'));
const browser = spawn(
  browserPath,
  [
    '--headless=new',
    '--disable-gpu',
    `--remote-debugging-port=${CDP_PORT}`,
    `--user-data-dir=${profileDir}`,
    '--no-first-run',
    'about:blank',
  ],
  { stdio: 'ignore' },
);

const wsUrl = await (async () => {
  for (let i = 0; i < 40; i += 1) {
    try {
      const r = await fetch(`http://127.0.0.1:${CDP_PORT}/json/version`);
      const j = await r.json();
      if (j.webSocketDebuggerUrl) return j.webSocketDebuggerUrl;
    } catch {}
    await sleep(250);
  }
  throw new Error('CDP 未就绪');
})();

const ws = new WebSocket(wsUrl);
await new Promise((ok, bad) => {
  ws.addEventListener('open', ok);
  ws.addEventListener('error', bad);
});
let id = 0;
const pending = new Map();
ws.addEventListener('message', (ev) => {
  const m = JSON.parse(ev.data);
  if (m.id && pending.has(m.id)) {
    const { resolve, reject } = pending.get(m.id);
    pending.delete(m.id);
    m.error ? reject(new Error(JSON.stringify(m.error))) : resolve(m.result);
  }
});
const raw = (method, params = {}, sessionId) => {
  const myId = ++id;
  return new Promise((resolve, reject) => {
    pending.set(myId, { resolve, reject });
    ws.send(JSON.stringify({ id: myId, method, params, sessionId }));
  });
};
const { targetId } = await raw('Target.createTarget', { url: 'about:blank' });
const { sessionId } = await raw('Target.attachToTarget', { targetId, flatten: true });
const send = (m, p) => raw(m, p, sessionId);
await send('Page.enable');
await send('Runtime.enable');
await send('Emulation.setDeviceMetricsOverride', {
  width: 390,
  height: 844,
  deviceScaleFactor: 2,
  mobile: true,
});

const evalJs = async (expr) => {
  const { result, exceptionDetails } = await send('Runtime.evaluate', {
    expression: expr,
    returnByValue: true,
    awaitPromise: true,
  });
  if (exceptionDetails) throw new Error(JSON.stringify(exceptionDetails).slice(0, 300));
  return result.value;
};

await send('Page.navigate', { url: `${BASE}/r/${CODE}` });
await sleep(3500);

mkdirSync(OUT_DIR, { recursive: true });

/**
 * 变体渲染器：在页面上下文里重新画卡片，只改间距密度
 * 说明：与 lib/share-card.ts 的绘制逻辑保持一致，仅调整垂直留白分配
 */
const RENDER = (variant) => `(async () => {
  const V = ${JSON.stringify(variant)};
  const W = 1080, H = 1440;
  const c = document.createElement('canvas');
  c.width = W; c.height = H;
  const ctx = c.getContext('2d');
  const C = { paper:'#fffaf5', card:'#ffffff', ink:'#12100e', inkSoft:'#4a4441',
              inkMute:'#6f6864', rose:'#c2003a', roseBright:'#e70044', roseTint:'#ffe9ef' };
  const BODY = '"PingFang SC","Hiragino Sans GB","Microsoft YaHei",sans-serif';
  const body = (s, w=400) => w + ' ' + s + 'px ' + BODY;
  const D = (s) => '400 ' + s + 'px "Smiley Sans Oblique",' + BODY;
  await document.fonts.ready;

  const rr = (x,y,w,h,r) => { ctx.beginPath(); ctx.moveTo(x+r,y); ctx.lineTo(x+w-r,y);
    ctx.arcTo(x+w,y,x+w,y+r,r); ctx.lineTo(x+w,y+h-r); ctx.arcTo(x+w,y+h,x+w-r,y+h,r);
    ctx.lineTo(x+r,y+h); ctx.arcTo(x,y+h,x,y+h-r,r); ctx.lineTo(x,y+r); ctx.arcTo(x,y,x+r,y,r); ctx.closePath(); };
  const wrap = (t, mw) => { const tk = t.match(/[A-Za-z0-9]+[.,!?;:'"]?|\\s+|[^A-Za-z0-9\\s]/g) || [];
    const out = []; let line = '';
    for (const k of tk) { if (/^\\s+$/.test(k)) { if (line) line += ' '; continue; }
      const nx = line + k; if (ctx.measureText(nx).width > mw && line) { out.push(line.trimEnd()); line = k; } else line = nx; }
    if (line.trim()) out.push(line.trimEnd()); return out; };

  const cx = W/2; ctx.textAlign='center'; ctx.textBaseline='alphabetic';
  ctx.fillStyle = C.paper; ctx.fillRect(0,0,W,H);
  ctx.fillStyle = 'rgba(18,16,14,0.05)';
  for (let gx=26; gx<W; gx+=34) for (let gy=26; gy<H; gy+=34) { ctx.beginPath(); ctx.arc(gx,gy,1.6,0,7); ctx.fill(); }

  const pad=54, S=14, B=6;
  const cardX=pad, cardY=pad, cardW=W-pad*2-S, cardH=H-pad*2-S;
  ctx.fillStyle=C.ink; rr(cardX+S,cardY+S,cardW,cardH,20); ctx.fill();
  ctx.fillStyle=C.card; rr(cardX,cardY,cardW,cardH,20); ctx.fill();
  ctx.strokeStyle=C.ink; ctx.lineWidth=B; ctx.stroke();

  const mh=118;
  ctx.save(); ctx.beginPath(); rr(cardX,cardY,cardW,cardH,20); ctx.clip();
  ctx.fillStyle=C.rose; ctx.fillRect(cardX,cardY,cardW,mh); ctx.restore();
  ctx.fillStyle='#fff'; ctx.font=D(56); ctx.fillText('男友生存指数', cx, cardY+79);
  ctx.strokeStyle=C.ink; ctx.lineWidth=B; ctx.beginPath();
  ctx.moveTo(cardX,cardY+mh); ctx.lineTo(cardX+cardW,cardY+mh); ctx.stroke();

  let y = cardY + mh + V.labelGap;
  ctx.fillStyle=C.inkMute; ctx.font=body(34,500); ctx.fillText('他 的 生 存 指 数', cx, y);

  y += V.scoreGap;
  ctx.fillStyle=C.ink; ctx.font=D(V.scoreSize); ctx.fillText('45', cx, y);

  const badge='命中红线 · 总分已封顶';
  ctx.font=body(30,600);
  const lw=ctx.measureText(badge).width+56, lh=62, lx=cx-lw/2, ly=y+V.badgeGap;
  ctx.fillStyle=C.roseTint; rr(lx,ly,lw,lh,31); ctx.fill();
  ctx.strokeStyle=C.ink; ctx.lineWidth=4; ctx.stroke();
  ctx.fillStyle=C.rose; ctx.fillText(badge, cx, ly+43);
  y = ly + lh;

  y += V.titleGap;
  ctx.fillStyle=C.ink; ctx.font=D(V.titleSize);
  for (const l of wrap('需要认真聊一次', cardW-140).slice(0,2)) { ctx.fillText(l,cx,y); y+=V.titleSize*1.18; }

  y += V.ruleGap;
  ctx.fillStyle=C.roseBright; ctx.fillRect(cx-60,y,120,8);

  y += V.quoteGap;
  ctx.fillStyle=C.inkSoft; ctx.font=body(42);
  for (const l of wrap('有些事再拖，就变成你的委屈了', cardW-180).slice(0,3)) { ctx.fillText(l,cx,y); y+=62; }

  const ft = cardY + cardH - V.footOffset;
  ctx.strokeStyle='#e8e2dc'; ctx.lineWidth=3; ctx.beginPath();
  ctx.moveTo(cardX+120,ft); ctx.lineTo(cardX+cardW-120,ft); ctx.stroke();
  ctx.fillStyle=C.ink; ctx.font=D(46); ctx.fillText('你也来测测他', cx, ft+78);
  ctx.fillStyle=C.rose; ctx.font=body(34,600); ctx.fillText('boyfriend-score-green.vercel.app', cx, ft+138);
  ctx.fillStyle=C.inkMute; ctx.font=body(26); ctx.fillText('男友生存指数 · 玩梗不判决', cx, ft+192);

  return c.toDataURL('image/png');
})()`;

mkdirSync(OUT_DIR, { recursive: true });

const variants = [
  {
    name: 'card-v2a-tight',
    labelGap: 84, scoreGap: 268, badgeGap: 40, titleGap: 132,
    titleSize: 88, ruleGap: 26, quoteGap: 84, footOffset: 250,
  },
  {
    name: 'card-v2b-balanced',
    labelGap: 96, scoreGap: 292, badgeGap: 44, titleGap: 108,
    titleSize: 92, ruleGap: 30, quoteGap: 88, footOffset: 236,
  },
  {
    name: 'card-v2c-air',
    labelGap: 104, scoreGap: 306, badgeGap: 48, titleGap: 118,
    titleSize: 96, ruleGap: 34, quoteGap: 96, footOffset: 224,
  },
];

console.log('导出变体:');
for (const v of variants) {
  const dataUrl = await evalJs(RENDER(v));
  if (typeof dataUrl !== 'string' || !dataUrl.startsWith('data:image/png;base64,')) {
    console.log(`  ✗ ${v.name}: 渲染失败`);
    continue;
  }
  const buf = Buffer.from(dataUrl.replace('data:image/png;base64,', ''), 'base64');
  writeFileSync(join(OUT_DIR, `${v.name}.png`), buf);
  console.log(`  ${v.name}.png  (${(buf.length / 1024).toFixed(0)} KB)`);
}

ws.close();
browser.kill();
await sleep(300);
try {
  rmSync(profileDir, { recursive: true, force: true });
} catch {}
