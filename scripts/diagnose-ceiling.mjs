/**
 * 诊断：为什么"每题取主维度最优"拿不到 100 分
 *
 * 多维度加权下，一道题在主维度取最优时，它在**次要维度**上可能不是最优，
 * 于是其他维度会留下缺口。脚本找出缺口在哪，以及各维度单独可达的上限。
 *
 * 说明：直接计算而不引入 lib/scoring.ts——Node 的 ESM 解析器要求显式扩展名，
 * 而源码里的相对导入没有扩展名（Next/vitest 会处理，裸 Node 不会）。
 *
 * 用法: node --experimental-strip-types scripts/diagnose-ceiling.mjs
 */
const { QUESTIONS } = await import('../content/questions.ts');
const { DIMENSIONS } = await import('../lib/model.ts');

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

function scoreDims(answers) {
  return DIMENSIONS.map((dimension) => {
    let earned = 0;
    let max = 0;
    for (const q of QUESTIONS) {
      const qMax = q.options.reduce((m, o) => Math.max(m, o.weights[dimension.id] ?? 0), 0);
      if (qMax <= 0) continue;
      max += qMax;
      const idx = answers[q.id];
      if (idx === undefined) continue;
      earned += q.options[idx].weights[dimension.id] ?? 0;
    }
    return {
      id: dimension.id,
      label: dimension.label,
      score: max > 0 ? Math.round((earned / max) * 1000) / 10 : 0,
      earned: Math.round(earned * 100) / 100,
      max: Math.round(max * 100) / 100,
    };
  });
}

// 策略一：每题取主维度最优
const answers = {};
for (const q of QUESTIONS) answers[q.id] = bestIndex(q, q.dimension);

console.log('【策略】每题取「主维度」最优\n');
console.log('  维度        得分    已得/满分');
for (const d of scoreDims(answers)) {
  const flag = d.score < 100 ? '  ← 有缺口' : '';
  console.log(`  ${d.label.padEnd(10)} ${String(d.score).padStart(6)}   ${d.earned} / ${d.max}${flag}`);
}

console.log('\n【缺口来源】主维度最优时，次要维度没取到该维度最高值：');
for (const d of scoreDims(answers)) {
  if (d.score >= 100) continue;
  for (const q of QUESTIONS) {
    const qMax = q.options.reduce((m, o) => Math.max(m, o.weights[d.id] ?? 0), 0);
    if (qMax <= 0) continue;
    const got = q.options[answers[q.id]].weights[d.id] ?? 0;
    if (got < qMax) {
      console.log(
        `  Q${String(q.id).padStart(2)} ${d.label}：选中项得 ${got}，该维度最高 ${qMax}` +
          `（选项 #${bestIndex(q, d.id)}）`,
      );
    }
  }
}

console.log('\n【各维度单独可达上限】每题都选该维度最优：');
for (const dim of DIMENSIONS) {
  const solo = {};
  for (const q of QUESTIONS) solo[q.id] = bestIndex(q, dim.id);
  const s = scoreDims(solo).find((x) => x.id === dim.id);
  console.log(`  ${dim.label.padEnd(10)} ${s.score}`);
}

console.log('\n【全局】是否存在让七维同时满分的答案组合（贪心验证）：');
// 贪心：对每个维度取最优，若某题冲突则优先保高权重维度
const greedy = {};
const byWeight = [...DIMENSIONS].sort((a, b) => b.weight - a.weight);
for (const dim of byWeight) {
  for (const q of QUESTIONS) {
    const idx = bestIndex(q, dim.id);
    const qMax = q.options.reduce((m, o) => Math.max(m, o.weights[dim.id] ?? 0), 0);
    if (qMax <= 0) continue;
    if (greedy[q.id] === undefined) {
      greedy[q.id] = idx;
    } else if ((q.options[greedy[q.id]].weights[dim.id] ?? 0) < qMax) {
      greedy[q.id] = idx;
    }
  }
}
const g = scoreDims(greedy);
const allFull = g.every((d) => d.score === 100);
console.log(`  贪心结果：${g.map((d) => `${d.label} ${d.score}`).join('  ')}`);
console.log(`  能否七维同时满分：${allFull ? '可以' : '不可以 —— 存在维度间的内在冲突'}`);
