/**
 * 生产构建下的截图（用于排除 dev 模式干扰，比如 DevTools 指示器）
 * 会自行 build + start，完成后关闭。
 * 用法: node scripts/screenshot-prod.mjs [outDir]
 */
import { spawn, spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const OUT_DIR = process.argv[2] ?? '.';
const PORT = 3222;
const CDP_PORT = 9499;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

console.log('构建生产版本…');
const build = spawnSync('npm', ['run', 'build'], { stdio: 'inherit', shell: true });
if (build.status !== 0) {
  console.error('构建失败');
  process.exit(1);
}

console.log(`启动生产服务 (端口 ${PORT})…`);
const server = spawn('npm', ['run', 'start', '--', '-p', String(PORT)], {
  stdio: 'ignore',
  shell: true,
});
await sleep(6000);

const BASE = `http://127.0.0.1:${PORT}`;
const browserPath = [
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
].find((p) => existsSync(p));
const profileDir = mkdtempSync(join(tmpdir(), 'prod-'));

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
  const { result } = await send('Runtime.evaluate', {
    expression: expr,
    returnByValue: true,
    awaitPromise: true,
  });
  return result.value;
};

mkdirSync(OUT_DIR, { recursive: true });

async function shoot(name, path) {
  await send('Emulation.setDeviceMetricsOverride', {
    width: 390,
    height: 844,
    deviceScaleFactor: 2,
    mobile: true,
  });
  await send('Page.navigate', { url: `${BASE}${path}` });
  await sleep(2500);
  const { data } = await send('Page.captureScreenshot', {
    format: 'png',
    captureBeyondViewport: true,
  });
  writeFileSync(join(OUT_DIR, name), Buffer.from(data, 'base64'));
  console.log(`  ${name}`);
}

const RED_FLAG_CODE = 'aaaacaaaaaaaaaaaaaaaaaaaaaa';
console.log('生产模式截图:');
await shoot('prod-1-home.png', '/');
await shoot('prod-2-quiz.png', '/quiz');
await shoot('prod-3-result.png', `/r/${RED_FLAG_CODE}`);

// 确认 dev 指示器不存在于生产
await send('Page.navigate', { url: `${BASE}/quiz` });
await sleep(2500);
const devIndicator = await evalJs(
  `!!document.querySelector('nextjs-portal') || !!document.querySelector('[data-next-badge]')`,
);
console.log(`\n生产环境是否残留 dev 指示器: ${devIndicator ? '是（异常）' : '否（正确）'}`);

ws.close();
browser.kill();
server.kill();
await sleep(500);
try {
  rmSync(profileDir, { recursive: true, force: true });
} catch {}
process.exit(0);
