/**
 * 埋点报表：从结构化日志或数据库导出计算漏斗
 *
 * 用法:
 *   1) 从 Vercel 日志导出（零配置）
 *      vercel logs <deployment-url> --json > events.ndjson
 *      node scripts/analytics-report.mjs events.ndjson
 *
 *   2) 直接喂含 [track] 行的任意文本
 *      node scripts/analytics-report.mjs raw.txt
 *
 * 输出：漏斗转化、每题停留时长（找"最难回答的题"）、弃答位置、
 *       原型分布、来源效果、每小时趋势。
 *
 * 为什么单独做脚本而不做后台页面：
 *   当前阶段数据量小、看的人只有你一个，脚本比后台更快也更省事。
 *   等需要多人看或自动告警时（Phase 2）再把它换成页面。
 */
import { readFileSync } from 'node:fs';

const file = process.argv[2];
if (!file) {
  console.error('用法: node scripts/analytics-report.mjs <events.ndjson|raw.txt>');
  process.exit(1);
}

/* ── 解析：同时兼容 Vercel JSON 日志与纯 [track] 行 ────────────────── */

const raw = readFileSync(file, 'utf8');
const events = [];

for (const line of raw.split('\n')) {
  const trimmed = line.trim();
  if (!trimmed) continue;

  // 优先尝试整行 JSON（vercel logs --json）
  let text = trimmed;
  try {
    const obj = JSON.parse(trimmed);
    // Vercel 日志结构里的消息字段名可能不同，逐个尝试
    text = obj.message ?? obj.text ?? obj.msg ?? trimmed;
  } catch {
    /* 不是 JSON，按纯文本处理 */
  }

  const at = text.indexOf('[track] ');
  if (at === -1) continue;
  const jsonPart = text.slice(at + '[track] '.length);
  try {
    const row = JSON.parse(jsonPart);
    if (row?.name && row?.session_id) events.push(row);
  } catch {
    /* 跳过解析失败的行 */
  }
}

if (events.length === 0) {
  console.error('未找到任何 [track] 事件行。');
  console.error('提示：先导出日志，例如 vercel logs <url> --json > events.ndjson');
  process.exit(1);
}

/* ── 工具 ──────────────────────────────────────────────────────────── */

const pct = (a, b) => (b > 0 ? `${((a / b) * 100).toFixed(1)}%` : '—');
const num = (v) => (typeof v === 'number' && Number.isFinite(v) ? v : null);
const bar = (ratio, width = 28) => '█'.repeat(Math.max(0, Math.round(ratio * width)));

/** 按会话聚合 */
const bySession = new Map();
for (const e of events) {
  const key = e.session_id;
  if (!bySession.has(key)) bySession.set(key, new Set());
  bySession.get(key).add(e.name);
}
const sessions = [...bySession.values()];
const countWith = (name) => sessions.filter((s) => s.has(name)).length;

console.log('════════ 埋点报表 ════════');
console.log(`事件总数: ${events.length}    会话数: ${sessions.length}`);
const times = events.map((e) => e.received_at).filter(Boolean).sort();
if (times.length) console.log(`时间范围: ${times[0]} → ${times[times.length - 1]}`);

/* ── 1. 漏斗 ───────────────────────────────────────────────────────── */

const steps = [
  ['view_home', '首页曝光'],
  ['start_quiz', '开始答题'],
  ['quiz_complete', '答完全部题'],
  ['view_result', '看到结果'],
  ['save_card', '保存卡片'],
];

console.log('\n【漏斗】按会话去重');
let prev = null;
for (const [name, label] of steps) {
  const n = countWith(name);
  const fromPrev = prev === null ? null : pct(n, prev);
  const fromTop = pct(n, countWith('view_home'));
  console.log(
    `  ${label.padEnd(12)} ${String(n).padStart(5)}   ${bar(countWith('view_home') ? n / countWith('view_home') : 0)}` +
      `   占首页 ${fromTop}${fromPrev ? `  环比 ${fromPrev}` : ''}`,
  );
  prev = n;
}

const started = countWith('start_quiz');
const completed = countWith('quiz_complete');
const savedCard = countWith('save_card');
console.log(`\n  完成率 = 答完 / 开始 = ${pct(completed, started)}   （目标 ≥ 55%）`);
console.log(`  分享率 = 保存卡片 / 答完 = ${pct(savedCard, completed)}   （目标 ≥ 25%）`);

/* ── 2. 最难回答的题 ────────────────────────────────────────────────── */

const perQuestion = new Map();
for (const e of events) {
  if (e.name !== 'answer_question') continue;
  const qid = num(e.payload?.questionId);
  const dur = num(e.payload?.durationMs);
  if (qid === null || dur === null) continue;
  if (!perQuestion.has(qid)) perQuestion.set(qid, []);
  perQuestion.get(qid).push(dur);
}

if (perQuestion.size > 0) {
  const rows = [...perQuestion.entries()]
    .map(([qid, arr]) => {
      const sorted = [...arr].sort((a, b) => a - b);
      const median = sorted[Math.floor(sorted.length / 2)];
      const avg = arr.reduce((s, v) => s + v, 0) / arr.length;
      return { qid, n: arr.length, avg: avg / 1000, median: median / 1000 };
    })
    .sort((a, b) => b.avg - a.avg);

  console.log('\n【最难回答的 10 题】平均停留时长（秒）—— 改题库的直接依据');
  const maxAvg = rows[0].avg || 1;
  for (const r of rows.slice(0, 10)) {
    console.log(
      `  Q${String(r.qid).padStart(2)}  平均 ${r.avg.toFixed(1)}s  中位 ${r.median.toFixed(1)}s  n=${r.n}  ${bar(r.avg / maxAvg)}`,
    );
  }
  const overall = rows.reduce((s, r) => s + r.avg * r.n, 0) / rows.reduce((s, r) => s + r.n, 0);
  console.log(`\n  全题平均 ${overall.toFixed(1)}s。显著高于平均的题目说明文案有歧义，或选项都不贴切。`);
}

/* ── 3. 弃答位置（从已答数量反推）──────────────────────────────────── */

const maxAnswered = new Map();
for (const e of events) {
  if (e.name !== 'answer_question') continue;
  const n = num(e.payload?.answered);
  if (n === null) continue;
  const key = e.session_id;
  maxAnswered.set(key, Math.max(maxAnswered.get(key) ?? 0, n));
}

const abandoned = [...maxAnswered.entries()].filter(([sid]) => !bySession.get(sid)?.has('quiz_complete'));
if (abandoned.length > 0) {
  const buckets = new Map();
  for (const [, n] of abandoned) {
    const bucket = n <= 5 ? '1-5 题' : n <= 10 ? '6-10 题' : n <= 20 ? '11-20 题' : n <= 30 ? '21-30 题' : '31+ 题';
    buckets.set(bucket, (buckets.get(bucket) ?? 0) + 1);
  }
  console.log(`\n【弃答分布】未答完的会话共 ${abandoned.length} 个`);
  for (const label of ['1-5 题', '6-10 题', '11-20 题', '21-30 题', '31+ 题']) {
    const n = buckets.get(label) ?? 0;
    if (n === 0) continue;
    console.log(`  ${label.padEnd(10)} ${String(n).padStart(4)}  ${bar(n / abandoned.length)}`);
  }
  const early = abandoned.filter(([, n]) => n <= 5).length;
  if (early / abandoned.length > 0.4) {
    console.log('  ⚠ 超过四成在开头 5 题就流失：优先检查首屏承诺与第 1 题的文案。');
  }
}

/* ── 4. 原型分布 ───────────────────────────────────────────────────── */

const archetypes = new Map();
const scores = [];
for (const e of events) {
  if (e.name !== 'view_result') continue;
  const id = e.payload?.archetypeId;
  if (typeof id === 'string') archetypes.set(id, (archetypes.get(id) ?? 0) + 1);
  const sc = num(e.payload?.score);
  if (sc !== null) scores.push(sc);
}

if (archetypes.size > 0) {
  const total = [...archetypes.values()].reduce((a, b) => a + b, 0);
  console.log('\n【原型分布】哪种关系形态最常见（也是内容选题依据）');
  for (const [id, n] of [...archetypes.entries()].sort((a, b) => b[1] - a[1])) {
    console.log(`  ${id.padEnd(22)} ${String(n).padStart(4)}  ${pct(n, total)}`);
  }
}

if (scores.length > 0) {
  const sorted = [...scores].sort((a, b) => a - b);
  const mean = scores.reduce((a, b) => a + b, 0) / scores.length;
  console.log('\n【分数分布】');
  console.log(`  平均 ${mean.toFixed(1)}   中位 ${sorted[Math.floor(sorted.length / 2)]}   最低 ${sorted[0]}   最高 ${sorted[sorted.length - 1]}`);
  const buckets = [0, 40, 55, 70, 85, 95, 101];
  const labels = ['0-39 值得更好', '40-54 需要聊', '55-69 还行', '70-84 及格以上', '85-94 别人家的', '95+ 限量款'];
  for (let i = 0; i < labels.length; i += 1) {
    const n = scores.filter((s) => s >= buckets[i] && s < buckets[i + 1]).length;
    if (n === 0) continue;
    console.log(`  ${labels[i].padEnd(16)} ${String(n).padStart(4)}  ${bar(n / scores.length)}`);
  }
}

/* ── 5. 来源效果 ───────────────────────────────────────────────────── */

const sources = new Map();
for (const e of events) {
  if (e.name !== 'start_quiz') continue;
  const src = e.payload?.source ?? '(直接访问/未标记)';
  if (!sources.has(src)) sources.set(src, { sessions: new Set(), completed: 0 });
  const entry = sources.get(src);
  entry.sessions.add(e.session_id);
}
for (const e of events) {
  if (e.name !== 'quiz_complete') continue;
  const src = e.payload?.source ?? '(直接访问/未标记)';
  const entry = sources.get(src);
  if (entry) entry.completed += 1;
}

if (sources.size > 0) {
  console.log('\n【来源效果】用 utm_content 区分不同小红书笔记');
  for (const [src, v] of [...sources.entries()].sort((a, b) => b[1].sessions.size - a[1].sessions.size)) {
    console.log(
      `  ${src.padEnd(24)} 会话 ${String(v.sessions.size).padStart(4)}   完成 ${String(v.completed).padStart(4)}   ${pct(v.completed, v.sessions.size)}`,
    );
  }
  console.log('\n  提示：笔记里用不同链接（?utm_content=note1 / note2）才能区分效果。');
}

/* ── 6. 每小时趋势 ─────────────────────────────────────────────────── */

const hours = new Map();
for (const e of events) {
  if (e.name !== 'view_home' || !e.received_at) continue;
  const key = String(e.received_at).slice(0, 13); // YYYY-MM-DDTHH
  hours.set(key, (hours.get(key) ?? 0) + 1);
}
if (hours.size > 1) {
  console.log('\n【每小时首页曝光】');
  const max = Math.max(...hours.values());
  for (const [hour, n] of [...hours.entries()].sort()) {
    console.log(`  ${hour}  ${String(n).padStart(4)}  ${bar(n / max)}`);
  }
}

console.log('\n════════ 报表结束 ════════');
