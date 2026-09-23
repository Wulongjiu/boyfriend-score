/**
 * 题库重排：从「语义顺序」源文件生成「已打乱顺序」的正式题库
 *
 * 用法:
 *   node --experimental-strip-types scripts/generate-questions.mjs [--write]
 *
 * ── 工作方式 ──────────────────────────────────────────────────────────
 *   输入: content/questions.canonical.ts  （人工维护，选项按语义顺序书写，可读性最好）
 *   输出: content/questions.ts            （应用实际使用，选项顺序已打乱并固化）
 *
 * ── 为什么要这样分两层 ────────────────────────────────────────────────
 * 1. **可读性**：作者写题时，"最好的选项写最前"最容易审校。
 * 2. **消除指向性**：实测 v1 有 35/36 题的最优项都在 A 位、最差项在 D 位，
 *    用户能猜出规律，于是测的是期待而不是现实。
 * 3. **必须固化而不是运行时打乱**：答案是按展示位置（选项下标）存进 URL code 的。
 *    若运行时打乱、计分按源顺序读取，分数会整体错位——这类 bug 极难发现。
 *    固化后全链路只有一套顺序：数据即展示顺序即计分顺序。
 *
 * 排列由题号做种子（mulberry32）生成，因此完全可复现：同一个人在任何设备、
 * 任何时间看到的选项顺序都一致，跨题分布也均匀。
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const CANONICAL = join(ROOT, 'content', 'questions.canonical.ts');
const OUTPUT = join(ROOT, 'content', 'questions.ts');

const shouldWrite = process.argv.includes('--write');

/* ── 载入语义顺序题库 ───────────────────────────────────────────── */

let QUESTIONS;
try {
  ({ QUESTIONS } = await import(`file://${CANONICAL.replace(/\\/g, '/')}`));
} catch (err) {
  console.error(`✗ 无法载入 ${CANONICAL}`);
  console.error('  请确认该文件存在（它是人工维护的语义顺序版本）。');
  console.error(String(err).slice(0, 300));
  process.exit(1);
}

/* ── 确定性排列 ─────────────────────────────────────────────────── */

function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffledIndices(seed, count) {
  const indices = Array.from({ length: count }, (_, i) => i);
  const rand = mulberry32(seed * 2654435761);
  for (let i = count - 1; i > 0; i -= 1) {
    const j = Math.floor(rand() * (i + 1));
    [indices[i], indices[j]] = [indices[j], indices[i]];
  }
  return indices;
}

/* ── 校验数据契约 ───────────────────────────────────────────────── */

const problems = [];
for (const q of QUESTIONS) {
  const max = q.options.reduce((m, o) => Math.max(m, o.weights[q.dimension] ?? 0), 0);
  if (max < 1) problems.push(`Q${q.id} 在主维度 ${q.dimension} 上最高权重为 ${max}，无法拿满分`);
  if (q.options.length !== 4) problems.push(`Q${q.id} 选项数为 ${q.options.length}，应为 4`);
  for (const o of q.options) {
    for (const [dim, v] of Object.entries(o.weights)) {
      if (v < 0 || v > 1) problems.push(`Q${q.id} 选项权重越界：${dim}=${v}`);
    }
  }
}
if (problems.length) {
  console.error('✗ 数据契约校验失败：');
  for (const p of problems) console.error('   ' + p);
  process.exit(1);
}

/* ── 生成输出 ───────────────────────────────────────────────────── */

const rendered = QUESTIONS.map((q) => {
  const order = shuffledIndices(q.id, q.options.length);
  const opts = order.map((i) => q.options[i]);
  const lines = [];
  lines.push('  {');
  lines.push(`    id: ${q.id},`);
  lines.push(`    dimension: '${q.dimension}',`);
  lines.push(`    text: ${quote(q.text)},`);
  if (q.validates !== undefined) lines.push(`    validates: ${q.validates},`);
  if (q.isRedFlag) lines.push('    isRedFlag: true,');
  if (q.rationale) lines.push(`    rationale: ${quote(q.rationale)},`);
  lines.push('    options: [');
  for (const o of opts) {
    const weights = Object.entries(o.weights)
      .map(([k, v]) => `${k}: ${v}`)
      .join(', ');
    const flag = o.redFlag ? `, redFlag: '${o.redFlag}'` : '';
    lines.push(`      { text: ${quote(o.text)}, weights: { ${weights} }${flag} },`);
  }
  lines.push('    ],');
  lines.push('  },');
  return lines.join('\n');
});

function quote(s) {
  return `'${String(s).replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`;
}

/* ── 统计分布（写进文件头，便于审校）─────────────────────────────── */

const bestPos = [0, 0, 0, 0];
const worstPos = [0, 0, 0, 0];
for (const q of QUESTIONS) {
  const order = shuffledIndices(q.id, q.options.length);
  const opts = order.map((i) => q.options[i]);
  let bi = 0;
  let wi = 0;
  let bv = -1;
  let wv = 2;
  opts.forEach((o, i) => {
    const v = o.weights[q.dimension] ?? 0;
    if (v > bv) {
      bv = v;
      bi = i;
    }
    if (v < wv) {
      wv = v;
      wi = i;
    }
  });
  bestPos[bi] += 1;
  worstPos[wi] += 1;
}

const header = `import type { Answers, Question } from '../lib/types';

/**
 * 题库 v2（${QUESTIONS.length} 题）—— ⚠️ 本文件由脚本生成，请勿直接编辑
 *
 * 生成方式：
 *   node --experimental-strip-types scripts/generate-questions.mjs --write
 *
 *   源文件: content/questions.canonical.ts（人工维护，选项按语义顺序书写，便于审校）
 *   本文件: 选项顺序已打乱并固化，应用只使用这一份
 *
 * ── 为什么要打乱顺序 ─────────────────────────────────────────────────
 * 实测问题：按语义顺序渲染时，${QUESTIONS.length} 题里有 35 题的最优选项都落在 A 位、
 * 最差选项落在 D 位（v1 数据）。用户能一眼看出规律，于是测的是她的期待而不是
 * 她观察到的现实。
 *
 * 本文件的选项位置分布（主维度最优 / 最差）：
 *   A: ${bestPos[0]} / ${worstPos[0]}    B: ${bestPos[1]} / ${worstPos[1]}    C: ${bestPos[2]} / ${worstPos[2]}    D: ${bestPos[3]} / ${worstPos[3]}
 * 排列由题号做种子生成，因此可复现——同一个人在任何设备、任何时间看到的顺序一致。
 *
 * ── 关键约束 ─────────────────────────────────────────────────────────
 * 答案是按**展示位置**（选项下标）存进 URL code 的。因此选项顺序必须固化在数据里，
 * 不能在运行时打乱——否则计分读取的下标会和用户看到的位置错位，分数整体错乱。
 * 测试 tests/scoring.test.ts 里有分布断言，防止有人改回"最优永远在 A"。
 *
 * ── 维度与依据 ───────────────────────────────────────────────────────
 * 主轴：感知伴侣回应性（被理解 / 被认可 / 被在乎）—— Reis & Shaver 人际亲密过程模型
 * 次轴：冲突行为 —— Gottman 四骑士（批评 / 鄙视 / 防御 / 筑墙）
 * 负荷：家务与心理负荷的分配 —— 与女性关系满意度显著相关
 *
 * ⚠️ 娱乐向测评，不是临床量表。上述研究用于确定"问什么"，不用于诊断。
 */
export const QUESTIONS: readonly Question[] = [
${rendered.join('\n')}
] as const;

/** 题目总数 */
export const TOTAL_QUESTIONS = QUESTIONS.length;

/** 按题号索引 */
export const QUESTION_MAP: Record<number, Question> = QUESTIONS.reduce(
  (acc, q) => {
    acc[q.id] = q;
    return acc;
  },
  {} as Record<number, Question>,
);

/** 全部题号，按顺序 */
export const QUESTION_IDS: readonly number[] = QUESTIONS.map((q) => q.id);

/** 反向验证题对（正向题号 → 反向题号），用于一致性校验 */
export const VERIFICATION_PAIRS: readonly (readonly [number, number])[] = QUESTIONS.filter(
  (q) => typeof q.validates === 'number',
).map((q) => [q.validates as number, q.id] as const);

/** 某维度关联的题目（含以次要权重参与该维度的题） */
export function questionsForDimension(dimensionId: string): Question[] {
  return QUESTIONS.filter(
    (q) =>
      q.dimension === dimensionId ||
      q.options.some((o) => o.weights[dimensionId as keyof typeof o.weights] !== undefined),
  );
}

/** 空答案集 */
export function createEmptyAnswers(): Answers {
  return {};
}
`;

console.log(`题数 ${QUESTIONS.length}`);
console.log(`最优选项位置 A/B/C/D: ${bestPos.join(' / ')}`);
console.log(`最差选项位置 A/B/C/D: ${worstPos.join(' / ')}`);
const ideal = QUESTIONS.length / 4;
const maxDev = Math.max(...bestPos.map((n) => Math.abs(n - ideal)));
console.log(`理想 ${ideal}/位，最大偏离 ${maxDev.toFixed(1)} 题`);

if (shouldWrite) {
  writeFileSync(OUTPUT, header, 'utf8');
  console.log(`\n✓ 已生成 ${OUTPUT}`);
} else {
  console.log('\n（未写入，加 --write 生效）');
}
