/**
 * 端到端流程验证（真实浏览器 + CDP，零依赖）
 *
 * 为什么不用 Playwright：本项目只需要"点完所有题 → 看到结果 → 存出卡片"这一条链路，
 * 用 Node 内置 WebSocket + CDP 已经够用，省掉 ~300MB 浏览器下载。
 *
 * 用法:
 *   node --experimental-strip-types scripts/e2e-flow.mjs <baseUrl> [--red-flag]
 *   node --experimental-strip-types scripts/e2e-flow.mjs https://xxx.vercel.app
 *
 * ⚠️ 题量从 content/questions.ts 动态读取，不写死（v1 曾因硬编码 27 而失效）。
 */
import { spawn } from 'node:child_process';
import { existsSync, mkdtempSync, readdirSync, rmSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const BASE = process.argv[2] ?? 'http://127.0.0.1:3210';
const HIT_RED_FLAG = process.argv.includes('--red-flag');
const PORT = 9444;

/** 题库题量（动态） */
const { TOTAL_QUESTIONS } = await import('../content/questions.ts');

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
const steps = [];
const problems = [];
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
  overflow: document.documentElement.scrollWidth > document.documentElement.clientWidth,
  bodyBg: getComputedStyle(document.body).backgroundColor,
  fontFamily: getComputedStyle(document.body).fontFamily,
})`);
record('首页渲染 H1', !!home.h1, String(home.h1 ?? '').slice(0, 30));
record('首页有进入答题页的入口', home.ctaHref === '/quiz', String(home.ctaHref));
record('首页无横向溢出', home.overflow === false);
// 注意：font-display: swap 让标题字体异步加载，必须等 document.fonts.ready
// 再断言，否则会误判为"未使用得意黑"（本地快、线上慢时尤其明显）。
record(
  '首页使用得意黑标题',
  await evalJs(
    `document.fonts.ready.then(() =>
       [...document.querySelectorAll('h1')].some(el =>
         getComputedStyle(el).fontFamily.includes('Smiley')))`,
  ),
);

/* ---------------- 2. 答题页 ---------------- */
await evalJs(`document.querySelector('a[href="/quiz"]').click()`);
record('答题页加载出选项', await waitFor(`document.querySelectorAll('[aria-pressed]').length === 4`));

const total = await evalJs(
  `(document.body.textContent.match(/\\d+\\s*\\/\\s*(\\d+)/)?.[1]) ?? null`,
);
record('识别题量', total === String(TOTAL_QUESTIONS), `页面 ${total}，期望 ${TOTAL_QUESTIONS}`);

let answered = 0;
for (let i = 0; i < TOTAL_QUESTIONS; i += 1) {
  const ready = await waitFor(`document.querySelectorAll('[aria-pressed]').length === 4`, 6000);
  if (!ready) {
    record(`第 ${i + 1} 题出现选项`, false);
    break;
  }
  // 命中红线模式：第 6 题选第 3 项；常规模式：一律选第 1 项
  const optionIndex = HIT_RED_FLAG && i === 5 ? 2 : 0;
  await evalJs(`document.querySelectorAll('[aria-pressed]')[${optionIndex}].click()`);
  answered += 1;
  await sleep(300);
}
record(`完成 ${TOTAL_QUESTIONS} 题作答`, answered === TOTAL_QUESTIONS, `实际 ${answered} 题`);

/* ---------------- 3. 结果页 ---------------- */
const resultBtn = await waitFor(
  `[...document.querySelectorAll('button')].some(b => b.textContent.includes('看结果'))`,
  6000,
);
record('出现「看结果」按钮', resultBtn);
if (resultBtn) {
  await evalJs(
    `[...document.querySelectorAll('button')].find(b => b.textContent.includes('看结果')).click()`,
  );
}
const onResult = await waitFor(`location.pathname.startsWith('/r/')`, 10000);
record('跳转到结果页 /r/[code]', onResult, await evalJs('location.pathname'));

await waitFor(`!!document.querySelector('svg polygon')`, 8000);
await sleep(1400); // 等分数滚动动画结束

/* 结果页是**翻页式**：内容按页挂载（只渲染当前页与相邻页，控制 DOM 规模）。
 * 因此断言必须真的翻页——顺便也就验证了翻页本身可用。 */
const clickNextPage = () =>
  evalJs(`(() => {
    const next = [...document.querySelectorAll('button')].find(
      (b) => b.getAttribute('aria-label') === '下一页',
    );
    if (!next || next.disabled) return false;
    next.click();
    return true;
  })()`);

const readVisiblePage = () =>
  evalJs(`(() => {
    const visible = [...document.querySelectorAll('section > div')].find((el) => !el.hidden);
    return visible ? visible.textContent : '';
  })()`);

const pageSnapshots = [];
for (let i = 0; i < 8; i += 1) {
  pageSnapshots.push(await readVisiblePage());
  if (!(await clickNextPage())) break;
  await sleep(500);
}
const pageCount = pageSnapshots.length;
const allText = pageSnapshots.join('\n');

record('结果页为翻页式且页数正确', pageCount === 6, `共 ${pageCount} 页`);
record('第 1 页有分数与等级', (pageSnapshots[0] ?? '').includes('满分'), '');
record(
  '第 2 页有红线或雷达图',
  /红线|七根轴|七个维度/.test(pageSnapshots[1] ?? ''),
  '',
);
record('第 3 页有维度明细', (pageSnapshots[2] ?? '').includes('权重'), '');
record(
  '第 4 页有完整原型解读',
  (pageSnapshots[3] ?? '').includes('你们更像哪一种') && (pageSnapshots[3] ?? '').length > 200,
  `${(pageSnapshots[3] ?? '').length} 字`,
);
record(
  '第 5 页有信号与行动建议',
  (pageSnapshots[4] ?? '').includes('可以留意的三个信号') &&
    (pageSnapshots[4] ?? '').includes('接下来可以做的'),
  '',
);
record(
  '第 6 页有分享入口',
  /保存分享卡片|把结果存下来/.test(pageSnapshots[5] ?? ''),
  '',
);

if (HIT_RED_FLAG) {
  record('红线警示出现', allText.includes('值得你认真看一眼'), '');
  record('封顶提示出现', allText.includes('封顶'), '');
}

// 分数环 / 雷达图 / 等级在第 1、2 页，翻页后需回去再断言
await evalJs(`(() => {
  const first = [...document.querySelectorAll('button')].find(
    (b) => b.getAttribute('aria-label')?.startsWith('跳到第 1 页'),
  );
  first?.click();
})()`);
await sleep(500);
await sleep(1200); // 等分数滚动动画

const result = await evalJs(`(() => {
  const scoreEl = document.querySelector('[aria-label^="得分"]');
  const code = location.pathname.split('/').pop();
  return {
    code,
    codeValid: /^[a-d-]+$/.test(code) && code.length === ${TOTAL_QUESTIONS},
    codeLength: code.length,
    score: scoreEl ? Number(scoreEl.textContent.trim()) : null,
    radarPolygons: document.querySelectorAll('svg polygon').length,
    levelText: document.querySelector('h1')?.textContent?.trim(),
    overflow: document.documentElement.scrollWidth > document.documentElement.clientWidth,
    disclaimer: document.body.textContent.includes('娱乐向'),
  };
})()`);

record(`URL code 为 ${TOTAL_QUESTIONS} 位合法字符`, result.codeValid, `${result.codeLength} 位`);
record('结果页显示分数', typeof result.score === 'number' && result.score >= 0 && result.score <= 100, `分数 ${result.score}`);
record('雷达图渲染', result.radarPolygons >= 6, `${result.radarPolygons} 个多边形`);
record('等级称号渲染', !!result.levelText, String(result.levelText));
record('结果页无横向溢出', result.overflow === false);
record('免责声明存在', result.disclaimer === true);

/* ---------------- 4. 分享卡片生成 ---------------- */
// 确保停在最后一页（分享页）再点保存
for (let i = 0; i < 6; i += 1) {
  if (!(await clickNextPage())) break;
  await sleep(300);
}
await sleep(500);
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
  record('分享卡片 PNG 生成成功', false, '未检测到下载文件');
}

/* ---------------- 5. 控制台错误 ---------------- */
const errorEvents = root.events
  .filter((e) => e.method === 'Log.entryAdded' && e.params?.entry?.level === 'error')
  .map((e) => e.params.entry.text)
  // HMR WebSocket 在无头测试环境可能连不上，属测试环境噪声，不是应用缺陷
  .filter((t) => !/favicon|React DevTools|_next\/hmr|WebSocket connection/i.test(t));
record('无控制台错误', errorEvents.length === 0, errorEvents.slice(0, 3).join(' | '));

/* ---------------- 输出 ---------------- */
console.log('\n===== 端到端验证结果 =====');
for (const s of steps) {
  console.log(`${s.ok ? '  ✓' : '  ✗'} ${s.name}${s.detail ? `  (${s.detail})` : ''}`);
}
console.log(`\n通过 ${steps.filter((s) => s.ok).length}/${steps.length}`);
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
