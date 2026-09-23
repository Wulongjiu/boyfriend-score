/**
 * 导出分享卡片的 PNG（直接落盘，便于人工检查视觉）
 * 用法: node scripts/export-card.mjs <baseUrl> <out.png> [code]
 */
import { spawn } from 'node:child_process';
import { existsSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const BASE = process.argv[2] ?? 'http://127.0.0.1:3222';
const OUT = process.argv[3] ?? 'card.png';
const CODE = process.argv[4] ?? 'aaaacaaaaaaaaaaaaaaaaaaaaaa';
const CDP_PORT = 9511;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const browserPath = [
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
].find((p) => existsSync(p));
const profileDir = mkdtempSync(join(tmpdir(), 'card-'));
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

const evalJs = async (expr) => {
  const { result, exceptionDetails } = await send('Runtime.evaluate', {
    expression: expr,
    returnByValue: true,
    awaitPromise: true,
  });
  if (exceptionDetails) throw new Error(JSON.stringify(exceptionDetails).slice(0, 400));
  return result.value;
};

await send('Page.navigate', { url: `${BASE}/r/${CODE}` });
await sleep(3500);

// 复现卡片绘制逻辑：直接调用页面里的 canvas 尺寸与结果数据
const dataUrl = await evalJs(`(async () => {
  // 用与 ResultView 相同的入口：点按钮会触发下载，这里改为直接取 blob → dataURL
  const btn = [...document.querySelectorAll('button')].find(b => b.textContent.includes('保存分享卡片'));
  if (!btn) return 'NO_BUTTON';

  // 拦截下载，改为把 blob 转成 dataURL
  const origCreate = URL.createObjectURL;
  let captured = null;
  URL.createObjectURL = (blob) => { captured = blob; return origCreate.call(URL, blob); };

  btn.click();
  for (let i = 0; i < 60 && !captured; i++) await new Promise(r => setTimeout(r, 100));
  URL.createObjectURL = origCreate;
  if (!captured) return 'NO_BLOB';

  return await new Promise((resolve) => {
    const fr = new FileReader();
    fr.onload = () => resolve(fr.result);
    fr.readAsDataURL(captured);
  });
})()`);

if (typeof dataUrl !== 'string' || !dataUrl.startsWith('data:image/png;base64,')) {
  console.error('导出失败:', dataUrl);
  ws.close();
  browser.kill();
  process.exit(1);
}

const base64 = dataUrl.replace('data:image/png;base64,', '');
writeFileSync(OUT, Buffer.from(base64, 'base64'));
console.log(`已导出: ${OUT} (${(Buffer.from(base64, 'base64').length / 1024).toFixed(0)} KB)`);

ws.close();
browser.kill();
await sleep(300);
try {
  rmSync(profileDir, { recursive: true, force: true });
} catch {}
