/**
 * 端到端流程验证（真实浏览器 + CDP，零依赖）
 *
 * 为什么不用 Playwright：本项目只需要"点完 27 题、看到结果、存出图片"这一条链路，
 * 用 Node 内置 WebSocket + CDP 已经够用，省掉 ~300MB 浏览器下载。
 *
 * 用法: node scripts/e2e-flow.mjs http://127.0.0.1:3210 [--red-flag]
 */
import { spawn } from 'node:child_process';
import { existsSync, mkdtempSync, readdirSync, rmSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const BASE = process.argv[2] ?? 'http://127.0.0.1:3210';
const HIT_RED_FLAG = process.argv.includes('--red-flag');
const PORT = 9444;

const EDGE_CANDIDATES = [
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
];
const browserPath = EDGE_CANDIDATES.find((p) => existsSync(p));
if (!browserPath) throw new Error('未找到 Edge');

const profileDir = mkdtempSync(join(tmpdir(), 'e2e-'));
const downloadDir = mkdtempSync(join(tmpdir(), 'dl-'));

const child = spawn(
  browserPath,
  [
    '--headless=new',
    '--disable-gpu',
    `--remote-debugging-port=${PORT}`,
    `--user-data-dir=${profileDir}`,
    '--no-first-run',
    '--no-default-browser-check',
    'about:blank',
  ],
  { stdio: 'ignore' },
);

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const problems = [];
const steps = [];
function record(name, ok, detail = '') {
  steps.push({ name, ok, detail });
  if (!ok) problems.push(`${name}${detail ? ` — ${detail}` : ''}`);
}

async function getWsUrl() {
  for (let i = 0; i < 40; i += 1) {
    try {
      const res = await fetch(`http://127.0.0.1:${PORT}/json/version`);
      const json = await res.json();
      if (json.webSocketDebuggerUrl) return json.webSocketDebuggerUrl;
    } catch {
      /* 还没起来 */
    }
    await sleep(250);
  }
  throw new Error('CDP 未就绪');
}

class Session {
  constructor(ws) {
    this.ws = ws;
    this.id = 0;
    this.pending = new Map();
    this.events = [];
    ws.addEventListener('message', (ev) => {
      const msg = JSON.parse(ev.data);
      if (msg.id && this.pending.has(msg.id)) {
        const { resolve, reject } = this.pending.get(msg.id);
        this.pending.delete(msg.id);
        msg.error ? reject(new Error(JSON.stringify(msg.error))) : resolve(msg.result);
      } else if (msg.method) {
        this.events.push(msg);
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

const ws = new WebSocket(await getWsUrl());
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
await send('Emulation.setDeviceMetricsOverride', {
  width: 390,
  height: 844,
  deviceScaleFactor: 3,
  mobile: true,
});
await send('Browser.setDownloadBehavior', {
  behavior: 'allow',
  downloadPath: downloadDir,
  eventsEnabled: true,
});

const evalJs = async (expression) => {
  const { result, exceptionDetails } = await send('Runtime.evaluate', {
    expression,
    returnByValue: true,
    awaitPromise: true,
  });
  if (exceptionDetails) throw new Error(exceptionDetails.text ?? 'eval 异常');
  return result.value;
};

const waitFor = async (expression, timeout = 12000, interval = 150) => {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    if (await evalJs(expression)) return true;
    await sleep(interval);
  }
  return false;
};

/* ---------------- 1. 首页 ---------------- */
await send('Page.navigate', { url: `${BASE}/` });
await waitFor(`!!document.querySelector('h1')`);
const home = await evalJs(`({
  h1: document.querySelector('h1')?.textContent?.trim(),
  ctaHref: [...document.querySelectorAll('a')].find(a => a.textContent.includes('开始测测他'))?.getAttribute('href'),
  links: document.querySelectorAll('a[href="/quiz"]').length,
  overflow: document.documentElement.scrollWidth > document.documentElement.clientWidth,
  darkBg: getComputedStyle(document.body).backgroundColor,
})`);
record('首页渲染 H1', !!home.h1, home.h1 ?? '');
record('首页有进入答题页的入口', home.ctaHref === '/quiz', String(home.ctaHref));
record('首页无横向溢出', home.overflow === false);

/* ---------------- 2. 答题页 ---------------- */
await evalJs(`document.querySelector('a[href="/quiz"]').click()`);
const quizLoaded = await waitFor(`!!document.querySelector('[aria-pressed]')`);
record('答题页加载出选项', quizLoaded);

const total = await evalJs(
  `document.body.textContent.match(/第\\s*1\\s*\\/\\s*(\\d+)\\s*题/)?.[1] ?? null`,
);
record('识别题量', total === '27', `识别到 ${total}`);

// 逐题作答
let answered = 0;
for (let i = 0; i < 27; i += 1) {
  const ok = await waitFor(`document.querySelectorAll('[aria-pressed]').length === 4`, 6000);
  if (!ok) {
    record(`第 ${i + 1} 题出现选项`, false);
    break;
  }
  // 第 5 题选第 3 项（命中"否定感受"红线）；其余选第 1 项
  const optionIndex = HIT_RED_FLAG && i === 4 ? 2 : 0;
  await evalJs(`document.querySelectorAll('[aria-pressed]')[${optionIndex}].click()`);
  answered += 1;
  await sleep(320);
}
record('完成 27 题作答', answered === 27, `实际作答 ${answered} 题`);

/* ---------------- 结果页 ---------------- */
const resultBtn = await waitFor(
  `[...document.querySelectorAll('button')].some(b => b.textContent.includes('看结果'))`,
  6000,
);
record('出现「看结果」按钮', resultBtn);
if (resultBtn) {
  await evalJs(`[...document.querySelectorAll('button')].find(b => b.textContent.includes('看结果')).click()`);
}
const onResult = await waitFor(`location.pathname.startsWith('/r/')`, 10000);
record('跳转到结果页 /r/[code]', onResult, await evalJs('location.pathname'));

await waitFor(`!!document.querySelector('svg polygon')`, 8000);
// 等分数滚动动画结束（ScoreRing 动画 900ms）
await sleep(1400);
const result = await evalJs(`(() => {
  const scoreEl = document.querySelector('[aria-label^="得分"]');
  const score = scoreEl ? Number(scoreEl.textContent.trim()) : null;
  const code = location.pathname.split('/').pop();
  return {
    code,
    codeValid: /^[a-d-]{27}$/.test(code),
    score,
    scoreRingFinal: scoreEl?.getAttribute('aria-label'),
    radarPolygons: document.querySelectorAll('svg polygon').length,
    dimensionRows: [...document.querySelectorAll('span')].filter(s => /情绪价值与沟通|边界感与异性社交/.test(s.textContent)).length,
    levelText: document.querySelector('h1')?.textContent?.trim(),
    redFlagShown: document.body.textContent.includes('值得你认真看一眼'),
    cappedShown: document.body.textContent.includes('封顶'),
    adviceShown: document.body.textContent.includes('接下来可以做的'),
    shareButtons: [...document.querySelectorAll('button')].map(b => b.textContent.trim()).filter(t => /保存分享卡片|复制结果链接/.test(t)),
    overflow: document.documentElement.scrollWidth > document.documentElement.clientWidth,
    disclaimer: document.body.textContent.includes('娱乐向内容'),
  };
})()`);

record('URL code 为 27 位合法字符', result.codeValid, String(result.code));
record('结果页显示分数', typeof result.score === 'number' && result.score >= 0 && result.score <= 100, `分数 ${result.score}`);
// 雷达图 = 5 层网格多边形 + 1 个数据多边形
record('雷达图渲染', result.radarPolygons >= 6, `${result.radarPolygons} 个多边形`);
record('维度与等级渲染', !!result.levelText, String(result.levelText));
record('建议区渲染', result.adviceShown === true);
record('分享按钮存在', result.shareButtons.length === 2, result.shareButtons.join(' / '));
record('结果页无横向溢出', result.overflow === false);
record('免责声明存在', result.disclaimer === true);
if (HIT_RED_FLAG) {
  record('红线警示出现', result.redFlagShown === true);
  record('封顶提示出现', result.cappedShown === true, `分数 ${result.score}`);
}

/* ---------------- 4. 分享卡片生成 ---------------- */
// 直接点按钮，验证 Canvas 出图是否成功（下载文件出现在 downloadDir）
await evalJs(
  `[...document.querySelectorAll('button')].find(b => b.textContent.includes('保存分享卡片'))?.click()`,
);
const downloaded = await (async () => {
  for (let i = 0; i < 30; i += 1) {
    await sleep(400);
    const files = readdirSync(downloadDir).filter((f) => f.endsWith('.png'));
    if (files.length > 0) {
      const full = join(downloadDir, files[0]);
      return { name: files[0], size: statSync(full).size };
    }
  }
  return null;
})();
if (downloaded) {
  record('分享卡片 PNG 生成成功', downloaded.size > 5000, `${downloaded.name} · ${(downloaded.size / 1024).toFixed(0)} KB`);
} else {
  const btnText = await evalJs(
    `[...document.querySelectorAll('button')].map(b => b.textContent.trim()).join(' | ')`,
  );
  record('分享卡片 PNG 生成成功', false, `未检测到下载文件；按钮状态: ${btnText}`);
}

/* ---------------- 5. 控制台错误 ---------------- */
const errorEvents = root.events
  .filter((e) => e.method === 'Log.entryAdded' && e.params?.entry?.level === 'error')
  .map((e) => e.params.entry.text)
  // HMR WebSocket 在无头测试环境里可能连不上，属于测试环境噪声，不是应用缺陷
  .filter((t) => !/favicon|React DevTools|_next\/hmr|WebSocket connection/i.test(t));
record('无控制台错误', errorEvents.length === 0, errorEvents.slice(0, 3).join(' | '));

/* ---------------- 输出 ---------------- */
console.log('\n===== 端到端验证结果 =====');
for (const s of steps) {
  console.log(`${s.ok ? '  ✓' : '  ✗'} ${s.name}${s.detail ? `  (${s.detail})` : ''}`);
}
console.log(
  `\n通过 ${steps.filter((s) => s.ok).length}/${steps.length}`,
);
if (problems.length) {
  console.log('\n失败项:');
  for (const p of problems) console.log(`  - ${p}`);
}
console.log(JSON.stringify({ result, downloaded }, null, 2));

ws.close();
child.kill();
await sleep(400);
for (const dir of [profileDir, downloadDir]) {
  try {
    rmSync(dir, { recursive: true, force: true });
  } catch {
    /* Windows 占用忽略 */
  }
}
process.exit(problems.length ? 1 : 0);
