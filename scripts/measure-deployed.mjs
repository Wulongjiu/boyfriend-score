/**
 * 用 Chrome DevTools Protocol 精确测量线上页面的移动端布局问题
 * 用法: node scripts/measure-deployed.mjs https://example.com
 */
import { spawn } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const TARGET = process.argv[2] ?? 'https://boyfriend-score-green.vercel.app/';
const VIEWPORTS = [
  { name: 'iPhone SE/13 mini', width: 375, height: 812, scale: 3 },
  { name: 'iPhone 14/15', width: 390, height: 844, scale: 3 },
];

const EDGE_CANDIDATES = [
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
];
const { existsSync } = await import('node:fs');
const browserPath = EDGE_CANDIDATES.find((p) => existsSync(p));
if (!browserPath) throw new Error('未找到 Edge');

const profileDir = mkdtempSync(join(tmpdir(), 'cdp-'));
const port = 9333;

const child = spawn(
  browserPath,
  [
    '--headless=new',
    '--disable-gpu',
    `--remote-debugging-port=${port}`,
    `--user-data-dir=${profileDir}`,
    '--no-first-run',
    '--no-default-browser-check',
    'about:blank',
  ],
  { stdio: 'ignore', detached: false },
);

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function getWsUrl() {
  for (let i = 0; i < 40; i += 1) {
    try {
      const res = await fetch(`http://127.0.0.1:${port}/json/version`);
      const json = await res.json();
      if (json.webSocketDebuggerUrl) return json.webSocketDebuggerUrl;
    } catch {
      /* 还没起来 */
    }
    await sleep(250);
  }
  throw new Error('CDP 端口未就绪');
}

class Session {
  constructor(ws) {
    this.ws = ws;
    this.id = 0;
    this.pending = new Map();
    ws.addEventListener('message', (ev) => {
      const msg = JSON.parse(ev.data);
      if (msg.id && this.pending.has(msg.id)) {
        const { resolve, reject } = this.pending.get(msg.id);
        this.pending.delete(msg.id);
        msg.error ? reject(new Error(JSON.stringify(msg.error))) : resolve(msg.result);
      }
    });
  }
  send(method, params = {}, sessionId) {
    const id = ++this.id;
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      this.ws.send(JSON.stringify({ id, method, params, sessionId }));
    });
  }
}

const wsUrl = await getWsUrl();
const ws = new WebSocket(wsUrl);
await new Promise((resolve, reject) => {
  ws.addEventListener('open', resolve);
  ws.addEventListener('error', reject);
});
const root = new Session(ws);

const { targetId } = await root.send('Target.createTarget', { url: 'about:blank' });
const { sessionId } = await root.send('Target.attachToTarget', { targetId, flatten: true });
const send = (m, p) => root.send(m, p, sessionId);

await send('Page.enable');
await send('Runtime.enable');
await send('Log.enable');
await send('Console.enable');

const consoleErrors = [];
ws.addEventListener('message', (ev) => {
  const msg = JSON.parse(ev.data);
  if (msg.method === 'Log.entryAdded' && msg.params?.entry?.level === 'error') {
    consoleErrors.push(msg.params.entry.text);
  }
  if (msg.method === 'Runtime.exceptionThrown') {
    consoleErrors.push(msg.params?.exceptionDetails?.text ?? 'exception');
  }
});

const MEASURE = `(() => {
  const de = document.documentElement;
  const overflow = [];
  document.querySelectorAll('*').forEach((el) => {
    const r = el.getBoundingClientRect();
    if (r.width > 0 && r.right > de.clientWidth + 1) {
      overflow.push({
        tag: el.tagName.toLowerCase(),
        cls: (el.className || '').toString().slice(0, 70),
        text: (el.textContent || '').trim().slice(0, 34),
        right: Math.round(r.right),
        width: Math.round(r.width),
      });
    }
  });
  const h1 = document.querySelector('h1');
  const table = document.querySelectorAll('ul')[1]; // 等级表
  const rows = table ? [...table.querySelectorAll('li')].slice(0, 1).map((li) => {
    const cells = [...li.children].map((c) => Math.round(c.getBoundingClientRect().width));
    return { liWidth: Math.round(li.getBoundingClientRect().width), cells };
  }) : [];
  return {
    viewport: de.clientWidth,
    scrollWidth: de.scrollWidth,
    bodyScrollWidth: document.body.scrollWidth,
    horizontalOverflow: document.body.scrollWidth > de.clientWidth,
    overflowCount: overflow.length,
    overflow: overflow.slice(0, 6),
    h1: h1 ? { width: Math.round(h1.getBoundingClientRect().width), scrollWidth: h1.scrollWidth, text: h1.textContent.trim().slice(0, 40) } : null,
    levelRow: rows,
    computedBodyFont: getComputedStyle(document.body).fontFamily,
    backgroundColor: getComputedStyle(document.body).backgroundColor,
    colorScheme: getComputedStyle(de).colorScheme,
  };
})()`;

const results = [];
for (const vp of VIEWPORTS) {
  await send('Emulation.setDeviceMetricsOverride', {
    width: vp.width,
    height: vp.height,
    deviceScaleFactor: vp.scale,
    mobile: true,
  });
  await send('Page.navigate', { url: TARGET });
  await sleep(3500);
  const { result } = await send('Runtime.evaluate', {
    expression: MEASURE,
    returnByValue: true,
  });
  results.push({ viewport: vp, metrics: result.value });
}

console.log(JSON.stringify({ target: TARGET, results, consoleErrors: consoleErrors.slice(0, 8) }, null, 2));

ws.close();
child.kill();
await sleep(400);
try {
  rmSync(profileDir, { recursive: true, force: true });
} catch {
  /* Windows 可能仍占用，忽略 */
}
