/**
 * 寻找题库的「最高可达总分」（真实上限），用于校准分数量表
 *
 * 背景：单题多维度加权会产生维度间的取舍——某些题在 A 维度取最优时，
 * B 维度会留缺口。因此"七维同时满分"通常不可达，理论最高分小于 100。
 * 结果是：用户永远看不到 100 分，"95+ 人间理想"这一档在数学上不可达。
 *
 * 本脚本用贪心 + 局部搜索（每轮尝试把每题换成任意选项，取最优）逼近真实上限，
 * 得到 SCORE_CEILING，供计分时把"最高可达"映射为 100 分。
 *
 * 用法: node --experimental-strip-types scripts/find-score-ceiling.mjs
 */
const { QUESTIONS } = await import('../content/questions.ts');
const { DIMENSIONS } = await import('../lib/model.ts');

function dimScores(answers) {
  return DIMENSIONS.map((dim) => {
    let earned = 0;
    let max = 0;
    for (const q of QUESTIONS) {
      const qMax = q.options.reduce((m, o) => Math.max(m, o.weights[dim.id] ?? 0), 0);
      if (qMax <= 0) continue;
      max += qMax;
      const idx = answers[q.id];
      if (idx === undefined) continue;
      earned += q.options[idx].weights[dim.id] ?? 0;
    }
    return max > 0 ? (earned / max) * 100 : 0;
  });
}

function total(answers) {
  const scores = dimScores(answers);
  const totalWeight = DIMENSIONS.reduce((s, d) => s + d.weight, 0);
  const weighted = DIMENSIONS.reduce((s, d, i) => s + scores[i] * d.weight, 0);
  return weighted / totalWeight;
}

/** 初始解：每题取主维度最优 */
const start = {};
for (const q of QUESTIONS) {
  let bi = 0;
  let bv = -1;
  q.options.forEach((o, i) => {
    const v = o.weights[q.dimension] ?? 0;
    if (v > bv) {
      bv = v;
      bi = i;
    }
  });
  start[q.id] = bi;
}

console.log('初始解（每题主维度最优）总分:', total(start).toFixed(2));

/* ── 局部搜索：逐题尝试所有选项，取能提升总分的 ─────────────────── */
let current = { ...start };
let currentTotal = total(current);
let improved = true;
let rounds = 0;

while (improved && rounds < 60) {
  improved = false;
  rounds += 1;
  for (const q of QUESTIONS) {
    for (let opt = 0; opt < q.options.length; opt += 1) {
      if (opt === current[q.id]) continue;
      const trial = { ...current, [q.id]: opt };
      const t = total(trial);
      if (t > currentTotal + 1e-9) {
        current = trial;
        currentTotal = t;
        improved = true;
      }
    }
  }
}

console.log(`局部搜索 ${rounds} 轮后总分: ${currentTotal.toFixed(4)}`);

const scores = dimScores(current);
console.log('\n该解下各维度得分：');
DIMENSIONS.forEach((d, i) => {
  console.log(`  ${d.label.padEnd(10)} ${scores[i].toFixed(2)}`);
});

console.log('\n各题所选选项（用于核对取舍）：');
const diffs = QUESTIONS.filter((q) => current[q.id] !== start[q.id]);
for (const q of diffs) {
  const a = q.options[start[q.id]];
  const b = q.options[current[q.id]];
  console.log(
    `  Q${String(q.id).padStart(2)} ${q.dimension}：` +
      `主维度最优「${a.text.slice(0, 18)}」→ 改用「${b.text.slice(0, 18)}」`,
  );
}

console.log(`\n═══ 结论 ═══`);
console.log(`最高可达总分（真实上限）: ${currentTotal.toFixed(2)}`);
console.log(`建议的 SCORE_CEILING: ${Math.round(currentTotal * 100) / 100}`);
console.log(
  '含义：把该上限映射为 100 分，分数才能覆盖 0–100 的完整语义区间，' +
    '否则「95+ 人间理想」永远不可达。',
);
