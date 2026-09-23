/**
 * 题库结构审计：量化"指向性"与数据契约问题
 *
 * 用法: node scripts/audit-questions.mjs
 *
 * 检查项：
 *  1. 最优选项位置分布（越均匀，用户越难猜出"正确答案"）
 *  2. 每题主维度是否有满分选项（否则该题永远拿不到满分）
 *  3. 最差选项位置分布（同理）
 *  4. 各维度的题目覆盖数
 */
import { register } from 'node:module';

const { QUESTIONS } = await import('../content/questions.ts');
const { DIMENSIONS } = await import('../lib/model.ts');

function maxOf(q, dim) {
  return q.options.reduce((m, o) => Math.max(m, o.weights[dim] ?? 0), 0);
}
function minOf(q, dim) {
  return q.options.reduce((m, o) => Math.min(m, o.weights[dim] ?? 0), 2);
}
function bestIndex(q, dim) {
  let best = 0;
  let val = -1;
  q.options.forEach((o, i) => {
    const v = o.weights[dim] ?? 0;
    if (v > val) {
      val = v;
      best = i;
    }
  });
  return best;
}
function worstIndex(q, dim) {
  let worst = 0;
  let val = 2;
  q.options.forEach((o, i) => {
    const v = o.weights[dim] ?? 0;
    if (v < val) {
      val = v;
      worst = i;
    }
  });
  return worst;
}

const LETTERS = ['A', 'B', 'C', 'D'];

console.log('═══ 1. 最优选项位置分布 ═══');
const bestPos = [0, 0, 0, 0];
for (const q of QUESTIONS) bestPos[bestIndex(q, q.dimension)] += 1;
bestPos.forEach((n, i) => {
  const bar = '█'.repeat(Math.round((n / QUESTIONS.length) * 40));
  console.log(`  ${LETTERS[i]}: ${String(n).padStart(2)} 题 ${bar}`);
});
const ideal = QUESTIONS.length / 4;
const maxDev = Math.max(...bestPos.map((n) => Math.abs(n - ideal)));
console.log(`  理想: ${ideal} 题/位；最大偏离: ${maxDev.toFixed(1)} 题`);

console.log('\n═══ 2. 最差选项位置分布 ═══');
const worstPos = [0, 0, 0, 0];
for (const q of QUESTIONS) worstPos[worstIndex(q, q.dimension)] += 1;
worstPos.forEach((n, i) => {
  const bar = '█'.repeat(Math.round((n / QUESTIONS.length) * 40));
  console.log(`  ${LETTERS[i]}: ${String(n).padStart(2)} 题 ${bar}`);
});

console.log('\n═══ 3. 主维度无法拿满分 / 拿不到 0 分的题 ═══');
const noFull = [];
const noZero = [];
for (const q of QUESTIONS) {
  if (maxOf(q, q.dimension) < 1) noFull.push(`Q${q.id}(${q.dimension} max=${maxOf(q, q.dimension)})`);
  if (minOf(q, q.dimension) > 0) noZero.push(`Q${q.id}(${q.dimension} min=${minOf(q, q.dimension)})`);
}
console.log(`  拿不到满分 (${noFull.length}): ${noFull.join(', ') || '无'}`);
console.log(`  拿不到 0 分 (${noZero.length}): ${noZero.join(', ') || '无'}`);

console.log('\n═══ 4. 各维度覆盖 ═══');
for (const d of DIMENSIONS) {
  const involved = QUESTIONS.filter((q) => maxOf(q, d.id) > 0).length;
  const asMain = QUESTIONS.filter((q) => q.dimension === d.id).length;
  console.log(`  ${d.label.padEnd(8)} 参与 ${String(involved).padStart(2)} 题（主维度 ${asMain} 题，权重 ${d.weight}%）`);
}

console.log('\n═══ 5. 多维度贡献统计 ═══');
const multiCount = QUESTIONS.filter((q) =>
  q.options.some((o) => Object.keys(o.weights).length >= 2),
).length;
const avgDims =
  QUESTIONS.reduce(
    (s, q) => s + q.options.reduce((t, o) => t + Object.keys(o.weights).length, 0) / q.options.length,
    0,
  ) / QUESTIONS.length;
console.log(`  含多维贡献的题: ${multiCount}/${QUESTIONS.length}`);
console.log(`  每题平均贡献维度数: ${avgDims.toFixed(2)}`);

console.log('\n═══ 6. 主维度值序列（用于规划重排）═══');
for (const q of QUESTIONS) {
  const vals = q.options.map((o) => o.weights[q.dimension] ?? 0);
  const flag = maxOf(q, q.dimension) < 1 ? ' ⚠无法满分' : '';
  console.log(`  Q${String(q.id).padStart(2)} ${q.dimension.padEnd(14)} [${vals.join(', ')}]${flag}`);
}
