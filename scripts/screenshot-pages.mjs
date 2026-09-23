/**
 * 截取首页 / 答题页 / 结果页（含红线封顶态）的移动端截图
 * 用法: node scripts/screenshot-pages.mjs http://127.0.0.1:3210
 */
import { spawn } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const BASE = process.argv[2] ?? 'http://127.0.0.1:3210';
const OUT_DIR = process.argv[3] ?? '.';
const PORT = 9488;
const browserPath = [
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
].find((p) => existsSync(p));

const profileDir = mkdtempSync(join(tmpdir(), 'shot-'));
const child = spawn(
  browserPath,
  [
    '--headless=new',
    '--disable-gpu',
    `--remote-debugging-port=${PORT}`,
    `--user-data-dir=${profileDir}`,
    '--no-first-run',
    'about:blank',
  ],
  { stdio: 'ignore' },
);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const wsUrl = await (async () => {
  for (let i = 0; i < 40; i += 1) {
    try {
      const r = await fetch(`http://127.0.0.1:${PORT}/json/version`);
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

const evalJs = async (expr) => {
  const { result } = await send('Runtime.evaluate', {
    expression: expr,
    returnByValue: true,
    awaitPromise: true,
  });
  return result.value;
};

/**
 * 等待条件成立
 *
 * ⚠️ 踩过的坑：只等固定时长就执行 setup，点击会落在**尚未 hydration** 的按钮上，
 * 于是翻页静默失效（截图看起来和第一页一样）。必须等交互元素真正就绪。
 */
const waitFor = async (expr, timeout = 15000, interval = 200) => {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    if (await evalJs(expr)) return true;
    await sleep(interval);
  }
  return false;
};

mkdirSync(OUT_DIR, { recursive: true });

async function shoot(
  name,
  url,
  { width = 390, height = 844, fullPage = true, setup, settle = 1600, gotoPage } = {},
) {
  await send('Emulation.setDeviceMetricsOverride', {
    width,
    height,
    deviceScaleFactor: 2,
    mobile: true,
  });
  await send('Page.navigate', { url });
  // 等页面可交互（而不是等固定时长）：翻页依赖 React 事件绑定
  await waitFor(`!!document.querySelector('footer button, footer a')`, 15000);
  await sleep(600);

  // 翻页式页面：连点"下一页"到指定页（在确认可交互之后执行）
  if (gotoPage && gotoPage > 1) {
    for (let k = 1; k < gotoPage; k += 1) {
      const moved = await evalJs(`(() => {
        const next = [...document.querySelectorAll('button')].find(
          (b) => b.getAttribute('aria-label') === '下一页',
        );
        if (!next || next.disabled) return false;
        next.click();
        return true;
      })()`);
      if (!moved) break;
      await sleep(450);
    }
  }

  if (setup) {
    await evalJs(setup);
    await sleep(settle);
  }
  const { data } = await send('Page.captureScreenshot', {
    format: 'png',
    captureBeyondViewport: fullPage,
  });
  const file = join(OUT_DIR, name);
  writeFileSync(file, Buffer.from(data, 'base64'));
  const size = Buffer.from(data, 'base64').length;
  console.log(`  ${name} (${(size / 1024).toFixed(0)} KB)`);
}

// 结果页 code：第 5 题选第 3 项 → 命中"否定感受"红线 → 封顶 45
const RED_FLAG_CODE = 'aaaaacaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';

console.log('生成截图:');
await shoot('shot-1-home.png', `${BASE}/`);
await shoot('shot-2-quiz.png', `${BASE}/quiz`, {
  // 选中第 1 题的第 2 个选项，展示选中态
  setup: `document.querySelectorAll('[aria-pressed]')[1]?.click()`,
});
await shoot('shot-3-result-redflag.png', `${BASE}/r/${RED_FLAG_CODE}`);

/* 结果页是翻页式：逐页截图，便于检查每页排版 */
console.log('结果页逐页截图:');
for (let i = 1; i <= 6; i += 1) {
  await shoot(`shot-result-p${i}.png`, `${BASE}/r/${RED_FLAG_CODE}`, {
    fullPage: false,
    settle: 700,
    gotoPage: i,
  });
}

ws.close();
child.kill();
await sleep(300);
try {
  rmSync(profileDir, { recursive: true, force: true });
} catch {}
