/**
 * 寻找题库的「最低可达总分」（真实下限），用于完善分数量表校准
 *
 * 背景：选项权重不是非 0 即 1——很多题的"最差选项"仍有 0.1~0.3 的权重
 * （例如"你不提他就没注意"比"他说还行吧"略好）。因此"全部选最差"得到的
 * 不是 0 分，而是某个正数（实测约 6）。
 *
 * 若不校准下限，低分段会被压缩：真正糟糕的关系只能拿到 6~40 分，而 0~6 分
 * 是死区，用户永远看不到 0，量表下端的区分度也被浪费。
 *
 * 用法: node --experimental-strip-types scripts/find-score-floor.mjs
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
  return DIMENSIONS.reduce((s, d, i) => s + scores[i] * d.weight, 0) / totalWeight;
}

/** 初始解：每题取主维度最差 */
const start = {};
for (const q of QUESTIONS) {
  let wi = 0;
  let wv = 2;
  q.options.forEach((o, i) => {
    const v = o.weights[q.dimension] ?? 0;
    if (v < wv) {
      wv = v;
      wi = i;
    }
  });
  start[q.id] = wi;
}

console.log('初始解（每题主维度最差）总分:', total(start).toFixed(4));

/* ── 局部搜索最小化 ─────────────────────────────────────────────── */
let current = { ...start };
let currentTotal = total(current);
let rounds = 0;
let improved = true;
while (improved && rounds < 60) {
  improved = false;
  rounds += 1;
  for (const q of QUESTIONS) {
    for (let opt = 0; opt < q.options.length; opt += 1) {
      if (opt === current[q.id]) continue;
      const trial = { ...current, [q.id]: opt };
      const t = total(trial);
      if (t < currentTotal - 1e-9) {
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

console.log('\n═══ 结论 ═══');
console.log(`最低可达总分（真实下限）: ${currentTotal.toFixed(2)}`);
console.log(`建议的 SCORE_FLOOR: ${Math.round(currentTotal * 100) / 100}`);
console.log('含义：把该下限映射为 0 分、上限映射为 100 分，量表两端才都被用满。');
