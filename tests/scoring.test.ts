import { describe, expect, it } from 'vitest';

import { getAdviceForDimensions, DIMENSION_ADVICE } from '../lib/advice';
import { getLevel, LEVELS } from '../lib/levels';
import { DIMENSIONS, RED_FLAG_MAP, RED_FLAGS, RULES, SCORE_CEILING } from '../lib/model';
import { ARCHETYPES } from '../lib/archetypes';
import {
  checkConsistency,
  collectRedFlags,
  computeScore,
  firstUnansweredId,
  getAnswerIndex,
  isQuizComplete,
  matchArchetypes,
  progress,
  questionDimensionPercent,
  scoreDimensions,
} from '../lib/scoring';
import type { Answers, Archetype, Dimension, DimensionId, Question } from '../lib/types';
import { QUESTIONS, QUESTION_MAP, TOTAL_QUESTIONS, VERIFICATION_PAIRS } from '../content/questions';
import { runQuizSelfTest } from '../lib/quiz-selftest';

/* ------------------------------------------------------------------ */
/* 测试工具                                                             */
/* ------------------------------------------------------------------ */

/** 某题在某维度上的最高权重（= 计分时的题权重） */
function questionMax(question: Question, dimension: DimensionId): number {
  return question.options.reduce((m, o) => Math.max(m, o.weights[dimension] ?? 0), 0);
}

/** 某题在某维度上权重最高的选项下标 */
function bestOptionIndex(question: Question, dimension: DimensionId): number {
  let best = 0;
  let bestVal = -1;
  question.options.forEach((o, i) => {
    const v = o.weights[dimension] ?? 0;
    if (v > bestVal) {
      bestVal = v;
      best = i;
    }
  });
  return best;
}

/** 某题在某维度上权重最低的选项下标 */
function worstOptionIndex(question: Question, dimension: DimensionId): number {
  let worst = 0;
  let worstVal = 2;
  question.options.forEach((o, i) => {
    const v = o.weights[dimension] ?? 0;
    if (v < worstVal) {
      worstVal = v;
      worst = i;
    }
  });
  return worst;
}

/** 找到某题携带指定红牌的选项下标（选项顺序已打乱，不能写死下标） */
function optionIndexWithRedFlag(question: Question, flagId: string): number {
  const idx = question.options.findIndex((o) => o.redFlag === flagId);
  if (idx === -1) throw new Error('Q' + question.id + ' 没有 redFlag=' + flagId + ' 的选项');
  return idx;
}

/** 每题选同一位置的选项 */
function answerAll(questions: readonly Question[], index: number): Answers {
  const answers: Answers = {};
  for (const q of questions) answers[q.id] = Math.min(index, q.options.length - 1);
  return answers;
}

/** 每题选"主维度上最差"的选项 */
function answerWorst(questions: readonly Question[] = QUESTIONS): Answers {
  const answers: Answers = {};
  for (const q of questions) answers[q.id] = worstOptionIndex(q, q.dimension);
  return answers;
}

/** 原始加权总分（局部搜索的评分函数） */
function rawWeightedTotal(answers: Answers, questions: readonly Question[]): number {
  const scored = scoreDimensions(answers, questions);
  const totalWeight = scored.reduce((s, d) => s + d.weight, 0);
  if (totalWeight <= 0) return 0;
  return scored.reduce((s, d) => s + d.score * d.weight, 0) / totalWeight;
}

/**
 * 「七维都尽量拉满」的解（贪心 + 局部搜索）
 *
 * 为什么不能简单用"每题主维度最优"：多维度加权下存在维度间的取舍
 * （某题在主维度取最优时次要维度会留缺口），因此那样拿不到量表上限。
 * 这里用与 scripts/find-score-ceiling.mjs 相同的策略逼近上限，
 * 得到的解经 SCORE_CEILING 校准后应恰好为 100 分。
 */
function answerCeiling(questions: readonly Question[] = QUESTIONS): Answers {
  const dims = DIMENSIONS.filter((d) =>
    questions.some((q) => q.options.some((o) => (o.weights[d.id] ?? 0) > 0)),
  );

  const answers: Answers = {};
  for (const dim of [...dims].sort((a, b) => b.weight - a.weight)) {
    for (const q of questions) {
      const qMax = questionMax(q, dim.id);
      if (qMax <= 0) continue;
      const currentIdx = answers[q.id];
      if (currentIdx === undefined) {
        answers[q.id] = bestOptionIndex(q, dim.id);
      } else if ((q.options[currentIdx].weights[dim.id] ?? 0) < qMax) {
        answers[q.id] = bestOptionIndex(q, dim.id);
      }
    }
  }

  let currentTotal = rawWeightedTotal(answers, questions);
  for (let round = 0; round < 8; round += 1) {
    let improved = false;
    for (const q of questions) {
      for (let opt = 0; opt < q.options.length; opt += 1) {
        if (opt === answers[q.id]) continue;
        const trial = { ...answers, [q.id]: opt };
        const t = rawWeightedTotal(trial, questions);
        if (t > currentTotal + 1e-9) {
          answers[q.id] = opt;
          currentTotal = t;
          improved = true;
        }
      }
    }
    if (!improved) break;
  }
  return answers;
}

/** 在量表上限解的基础上覆盖指定题 */
function answerCeilingExcept(
  overrides: Record<number, number>,
  questions: readonly Question[] = QUESTIONS,
): Answers {
  const answers = answerCeiling(questions);
  for (const [id, index] of Object.entries(overrides)) {
    answers[Number(id)] = index;
  }
  return answers;
}

/* ------------------------------------------------------------------ */
/* 数据契约                                                             */
/* ------------------------------------------------------------------ */

describe('题库与模型数据契约（v2）', () => {
  it('七维权重合计为 100', () => {
    expect(DIMENSIONS.reduce((acc, d) => acc + d.weight, 0)).toBe(100);
  });

  it('维度 id 唯一且都有 explanation', () => {
    const ids = DIMENSIONS.map((d) => d.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const d of DIMENSIONS) {
      expect(d.explanation.length, d.label).toBeGreaterThan(20);
    }
  });

  it('题号为 1 到 36 连续', () => {
    expect(TOTAL_QUESTIONS).toBe(36);
    expect(QUESTIONS.map((q) => q.id)).toEqual(
      Array.from({ length: TOTAL_QUESTIONS }, (_, i) => i + 1),
    );
  });

  it('每题恰好 4 个选项', () => {
    for (const q of QUESTIONS) expect(q.options.length, 'Q' + q.id).toBe(4);
  });

  it('所有选项权重在 0-1 之间，且只使用合法维度 id', () => {
    const validIds = new Set<string>(DIMENSIONS.map((d) => d.id));
    for (const q of QUESTIONS) {
      for (const [i, o] of q.options.entries()) {
        const entries = Object.entries(o.weights);
        expect(entries.length, 'Q' + q.id + ' 选项' + i).toBeGreaterThan(0);
        for (const [dim, v] of entries) {
          expect(validIds.has(dim), 'Q' + q.id + ' 非法维度 ' + dim).toBe(true);
          expect(v, 'Q' + q.id + ' ' + dim).toBeGreaterThanOrEqual(0);
          expect(v, 'Q' + q.id + ' ' + dim).toBeLessThanOrEqual(1);
        }
      }
    }
  });

  it('每题在其主维度上至少有一个权重为 1 的选项', () => {
    for (const q of QUESTIONS) {
      expect(questionMax(q, q.dimension), 'Q' + q.id).toBe(1);
    }
  });

  it('多维度覆盖：大量题目同时贡献至少 2 个维度', () => {
    const multi = QUESTIONS.filter((q) =>
      q.options.some((o) => Object.keys(o.weights).length >= 2),
    );
    expect(multi.length).toBeGreaterThanOrEqual(20);
  });

  it('每个维度都至少有 3 道题参与计分', () => {
    for (const d of DIMENSIONS) {
      const involved = QUESTIONS.filter((q) => questionMax(q, d.id) > 0).length;
      expect(involved, d.label).toBeGreaterThanOrEqual(3);
    }
  });

  it('题目里出现的 redFlag 都已在 RED_FLAGS 中定义', () => {
    const defined = new Set(RED_FLAGS.map((f) => f.id));
    for (const q of QUESTIONS) {
      for (const o of q.options) {
        if (o.redFlag) expect(defined.has(o.redFlag), 'Q' + q.id).toBe(true);
      }
    }
  });

  it('没有孤立未使用的红牌定义', () => {
    const used = new Set(
      QUESTIONS.flatMap((q) => q.options.map((o) => o.redFlag).filter(Boolean)),
    );
    for (const flag of RED_FLAGS) {
      expect(used.has(flag.id), flag.id).toBe(true);
    }
  });

  it('每个红牌都有标题、说明与研究依据', () => {
    for (const flag of RED_FLAGS) {
      expect(flag.title.length, flag.id).toBeGreaterThan(0);
      expect(flag.detail.length, flag.id).toBeGreaterThan(30);
      expect(flag.basis?.length ?? 0, flag.id).toBeGreaterThan(10);
      expect(RED_FLAG_MAP[flag.id]).toBe(flag);
    }
  });

  it('反向验证题对指向有效题号，且共享至少一个维度', () => {
    expect(VERIFICATION_PAIRS.length).toBeGreaterThanOrEqual(2);
    for (const [forwardId, reverseId] of VERIFICATION_PAIRS) {
      const forward = QUESTION_MAP[forwardId];
      const reverse = QUESTION_MAP[reverseId];
      expect(forward, 'Q' + forwardId).toBeDefined();
      expect(reverse, 'Q' + reverseId).toBeDefined();
      const shared = DIMENSIONS.some(
        (d) => questionMax(forward, d.id) > 0 && questionMax(reverse, d.id) > 0,
      );
      expect(shared, forwardId + '-' + reverseId).toBe(true);
    }
  });

  it('指向性弱化：最优选项位置不集中在某一处', () => {
    const positions = [0, 0, 0, 0];
    for (const q of QUESTIONS) positions[bestOptionIndex(q, q.dimension)] += 1;
    const maxShare = Math.max(...positions) / TOTAL_QUESTIONS;
    expect(maxShare, positions.join('/')).toBeLessThan(0.6);
  });

  it('等级档位连续覆盖 0-100 且不重叠', () => {
    const sorted = [...LEVELS].sort((a, b) => a.min - b.min);
    expect(sorted[0].min).toBe(0);
    expect(sorted[sorted.length - 1].max).toBe(100);
    for (let i = 1; i < sorted.length; i += 1) {
      expect(sorted[i].min, '第' + i + '档').toBe(sorted[i - 1].max + 1);
    }
  });

  it('等级文案达标且不含判决词', () => {
    for (const level of LEVELS) {
      expect(level.oneLiner.length, level.id).toBeGreaterThan(6);
      expect(level.description.length, level.id).toBeGreaterThan(40);
      for (const banned of ['渣男', '分手吧', '有病', '活该']) {
        expect(level.description.includes(banned), level.id + banned).toBe(false);
      }
    }
  });
});

/* ------------------------------------------------------------------ */
/* 关系原型                                                             */
/* ------------------------------------------------------------------ */

describe('关系原型（archetypes）', () => {
  it('原型 id 唯一', () => {
    const ids = ARCHETYPES.map((a) => a.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('每个原型结构完整：标题/一句话/解读/信号/消耗/行动', () => {
    for (const a of ARCHETYPES) {
      expect(a.title.length, a.id).toBeGreaterThan(3);
      expect(a.oneLiner.length, a.id).toBeGreaterThan(6);
      expect(a.reading.length, a.id).toBeGreaterThanOrEqual(3);
      for (const p of a.reading) {
        expect(p.length, a.id + ' 段落过短').toBeGreaterThan(50);
      }
      expect(a.signals.length, a.id).toBeGreaterThanOrEqual(3);
      // drain 长度门槛放宽到 25：健康关系的"消耗点"本身就短
      // （例如"目前不太有"），强行拉长只会凑字数。
      expect(a.drain.length, a.id).toBeGreaterThan(25);
      expect(a.actions.length, a.id).toBeGreaterThanOrEqual(3);
      for (const act of a.actions) {
        expect(act.length, a.id + ' 行动过短').toBeGreaterThan(25);
      }
    }
  });

  it('原型条件使用合法维度，区间下限不大于上限', () => {
    const validIds = new Set<string>(DIMENSIONS.map((d) => d.id));
    for (const a of ARCHETYPES) {
      expect(a.conditions.length, a.id).toBeGreaterThan(0);
      for (const c of a.conditions) {
        expect(validIds.has(c.dimension), a.id + c.dimension).toBe(true);
        expect(c.min ?? 0, a.id).toBeLessThanOrEqual(c.max ?? 100);
      }
    }
  });

  it('原型文案不含判决式词汇', () => {
    for (const a of ARCHETYPES) {
      const text = [a.title, a.oneLiner, ...a.reading, ...a.actions, a.drain].join(' ');
      for (const banned of ['渣男', '建议分手', '赶紧跑', '有病', '活该']) {
        expect(text.includes(banned), a.id + banned).toBe(false);
      }
    }
  });

  it('全维度拉满时命中「他把你放在心上」且总分为 100', () => {
    const result = computeScore(answerCeiling());
    expect(result.total).toBe(100);
    expect(result.archetypes.length).toBeGreaterThan(0);
    expect(result.archetypes[0].archetype.id).toBe('responsive_partner');
  });

  it('原型匹配是纯函数且可注入自定义原型', () => {
    const custom: Archetype[] = [
      {
        id: 'test',
        title: '测试原型',
        oneLiner: '仅用于测试',
        priority: 999,
        conditions: [{ dimension: 'responsiveness', min: 0, max: 100 }],
        reading: ['a', 'b', 'c'],
        signals: ['x'],
        drain: 'y',
        actions: ['z'],
      },
    ];
    const dims = scoreDimensions(answerCeiling(), QUESTIONS);
    expect(matchArchetypes(dims, custom)).toEqual(matchArchetypes(dims, custom));
    expect(matchArchetypes(dims, custom)[0].archetype.id).toBe('test');
  });

  it('条件不满足时不命中', () => {
    const custom: Archetype[] = [
      {
        id: 'impossible',
        title: '不可能命中',
        oneLiner: 'x',
        priority: 1,
        conditions: [{ dimension: 'responsiveness', min: 0, max: 1 }],
        reading: ['a', 'b', 'c'],
        signals: ['x'],
        drain: 'y',
        actions: ['z'],
      },
    ];
    expect(matchArchetypes(scoreDimensions(answerCeiling(), QUESTIONS), custom)).toEqual([]);
  });

  it('未作答的维度不参与原型匹配', () => {
    expect(matchArchetypes(scoreDimensions({}, QUESTIONS), ARCHETYPES)).toEqual([]);
  });

  it('原型按优先级排序', () => {
    const matches = matchArchetypes(scoreDimensions(answerCeiling(), QUESTIONS), ARCHETYPES, 5);
    for (let i = 1; i < matches.length; i += 1) {
      expect(matches[i - 1].archetype.priority).toBeGreaterThanOrEqual(
        matches[i].archetype.priority,
      );
    }
  });
});

/* ------------------------------------------------------------------ */
/* 计分正确性                                                           */
/* ------------------------------------------------------------------ */

describe('computeScore 计分正确性', () => {
  it('量表上限解经校准后为 100 分（满分可达）', () => {
    const result = computeScore(answerCeiling());
    expect(result.total).toBe(100);
    expect(result.level.id).toBe('legend');
    expect(result.isComplete).toBe(true);
    expect(result.answeredCount).toBe(TOTAL_QUESTIONS);
    expect(result.redFlags).toEqual([]);
  });

  it('量表校准：原始分不超过 SCORE_CEILING，展示分不超过 100', () => {
    const result = computeScore(answerCeiling());
    expect(result.rawTotal).toBeLessThanOrEqual(SCORE_CEILING + 0.05);
    expect(result.total).toBeLessThanOrEqual(100);
  });

  it('每题选主维度最差得到 0 分', () => {
    const result = computeScore(answerWorst());
    expect(result.total).toBe(0);
    expect(result.level.id).toBe('deserve_better');
  });

  it('维度得分等于实得权重比', () => {
    const d = scoreDimensions(answerCeiling(), QUESTIONS)[0];
    expect(d.max).toBeGreaterThan(0);
    expect(d.score).toBeCloseTo((d.earned / d.max) * 100, 1);
  });

  it('单题多维度：同一道题同时影响两个维度', () => {
    const q = QUESTION_MAP[25];
    expect(questionMax(q, 'load')).toBeGreaterThan(0);
    expect(questionMax(q, 'responsiveness')).toBeGreaterThan(0);

    const best = computeScore(answerCeilingExcept({ 25: bestOptionIndex(q, 'load') }));
    const worst = computeScore(answerCeilingExcept({ 25: worstOptionIndex(q, 'load') }));
    const dimOf = (r: typeof best, id: DimensionId) => r.dimensions.find((d) => d.id === id)!.score;

    expect(dimOf(best, 'load')).toBeGreaterThan(dimOf(worst, 'load'));
    expect(dimOf(best, 'responsiveness')).toBeGreaterThan(dimOf(worst, 'responsiveness'));
  });

  it('维度得分恒在 0-100', () => {
    for (const i of [0, 1, 2, 3]) {
      for (const d of computeScore(answerAll(QUESTIONS, i)).dimensions) {
        expect(d.score, d.label + i).toBeGreaterThanOrEqual(0);
        expect(d.score, d.label + i).toBeLessThanOrEqual(100);
      }
    }
  });

  it('总分恒为 0-100 的整数', () => {
    const cases: Answers[] = [
      {},
      answerAll(QUESTIONS, 0),
      answerAll(QUESTIONS, 1),
      answerAll(QUESTIONS, 2),
      answerAll(QUESTIONS, 3),
      answerCeiling(),
      answerWorst(),
    ];
    for (const answers of cases) {
      const { total } = computeScore(answers);
      expect(Number.isInteger(total)).toBe(true);
      expect(total).toBeGreaterThanOrEqual(0);
      expect(total).toBeLessThanOrEqual(100);
    }
  });

  it('空答案得到 0 分、未完成、无原型', () => {
    const result = computeScore({});
    expect(result.total).toBe(0);
    expect(result.isComplete).toBe(false);
    expect(result.answeredCount).toBe(0);
    expect(result.archetypes).toEqual([]);
  });

  it('answeredCount 按题统计，不因多维度贡献重复计数', () => {
    const half = answerAll(QUESTIONS, 0);
    for (const q of QUESTIONS) if (q.id % 2 === 0) delete half[q.id];
    expect(computeScore(half).answeredCount).toBe(QUESTIONS.filter((q) => q.id % 2 !== 0).length);
  });

  it('纯函数：结果一致且不修改入参', () => {
    const answers = answerAll(QUESTIONS, 2);
    const snapshot = JSON.stringify(answers);
    expect(computeScore(answers)).toEqual(computeScore(answers));
    expect(JSON.stringify(answers)).toBe(snapshot);
  });
});

/* ------------------------------------------------------------------ */
/* 红牌与封顶                                                           */
/* ------------------------------------------------------------------ */

describe('computeScore 红牌与封顶', () => {
  it('命中红牌则总分封顶', () => {
    const idx = optionIndexWithRedFlag(QUESTION_MAP[6], 'invalidation');
    const result = computeScore(answerCeilingExcept({ 6: idx }));
    expect(result.redFlags.map((f) => f.id)).toContain('invalidation');
    expect(result.isCapped).toBe(true);
    expect(result.total).toBe(RULES.redFlagScoreCap);
  });

  it('红牌只降不升', () => {
    const clean = computeScore(answerCeiling());
    const idx = optionIndexWithRedFlag(QUESTION_MAP[6], 'invalidation');
    expect(computeScore(answerCeilingExcept({ 6: idx })).total).toBeLessThanOrEqual(clean.total);
  });

  it('多个红牌只封顶一次，不叠加扣分', () => {
    const i6 = optionIndexWithRedFlag(QUESTION_MAP[6], 'invalidation');
    const i36 = optionIndexWithRedFlag(QUESTION_MAP[36], 'contempt');
    const one = computeScore(answerCeilingExcept({ 6: i6 }));
    const two = computeScore(answerCeilingExcept({ 6: i6, 36: i36 }));
    expect(two.redFlags.length).toBeGreaterThan(one.redFlags.length);
    expect(two.total).toBe(one.total);
  });

  it('原始分低于封顶值时不算被 cap', () => {
    const result = computeScore(answerWorst());
    expect(result.redFlags.length).toBeGreaterThan(0);
    expect(result.isCapped).toBe(false);
    expect(result.total).toBe(0);
  });

  it('每个带 redFlag 的选项都能被收集', () => {
    for (const q of QUESTIONS) {
      q.options.forEach((o, i) => {
        if (!o.redFlag) return;
        const hits = collectRedFlags(answerCeilingExcept({ [q.id]: i }), QUESTIONS);
        expect(
          hits.some((h) => h.id === o.redFlag && h.questionId === q.id),
          'Q' + q.id + ' 选项' + i,
        ).toBe(true);
      });
    }
  });
});

/* ------------------------------------------------------------------ */
/* 部分作答 / 一致性 / 兜底建议                                          */
/* ------------------------------------------------------------------ */

describe('部分作答与工具函数', () => {
  it('未作答的题不计入分母（只答高分题也不会被拖低）', () => {
    const full = answerCeiling();
    const half: Answers = {};
    for (const q of QUESTIONS) if (q.id % 2 === 0) half[q.id] = full[q.id];
    const result = computeScore(half);
    // 只答一半题时无法拿到精确 100：某些维度会缺低分题、某些缺高分题，
    // 维度间的平衡被打破。但"未作答"绝不会被当成 0 分拖低总分——这正是本测试的目的。
    expect(result.total).toBeGreaterThanOrEqual(95);
    expect(result.isComplete).toBe(false);
    expect(result.answeredCount).toBe(QUESTIONS.filter((q) => q.id % 2 === 0).length);
  });

  it('越界或非整数答案被忽略', () => {
    const answers: Answers = { 1: 99, 2: -1, 3: 1.5, 4: 0 };
    expect(getAnswerIndex(answers, QUESTION_MAP[1])).toBeUndefined();
    expect(getAnswerIndex(answers, QUESTION_MAP[2])).toBeUndefined();
    expect(getAnswerIndex(answers, QUESTION_MAP[3])).toBeUndefined();
    expect(getAnswerIndex(answers, QUESTION_MAP[4])).toBe(0);
  });

  it('firstUnansweredId / isQuizComplete / progress', () => {
    expect(firstUnansweredId({})).toBe(1);
    expect(progress({})).toBe(0);
    expect(isQuizComplete({})).toBe(false);
    const full = answerCeiling();
    expect(firstUnansweredId(full)).toBeNull();
    expect(progress(full)).toBe(1);
    expect(isQuizComplete(full)).toBe(true);
  });

  it('questionDimensionPercent 对未作答与不相关维度返回 null', () => {
    expect(questionDimensionPercent({}, QUESTION_MAP[1], 'responsiveness')).toBeNull();
    const q24 = QUESTION_MAP[24];
    expect(questionDimensionPercent({ 24: 0 }, q24, 'future')).toBeNull();
    expect(questionDimensionPercent({ 24: bestOptionIndex(q24, 'load') }, q24, 'load')).toBe(100);
  });
});

describe('一致性校验', () => {
  it('量表上限解不判低一致性', () => {
    const result = computeScore(answerCeiling());
    expect(result.consistency.comparedPairs).toBeGreaterThan(0);
    expect(result.consistency.isLow).toBe(false);
  });

  it('正反题矛盾则判低一致性，且不额外扣分', () => {
    const contradictory = answerCeilingExcept({
      35: worstOptionIndex(QUESTION_MAP[35], 'responsiveness'),
    });
    const result = computeScore(contradictory);
    expect(result.consistency.isLow).toBe(true);
    expect(result.consistency.hint).not.toBeNull();
    expect(result.total).toBeGreaterThan(80);
  });

  it('无作答时一致性为 null 且不判低', () => {
    const c = checkConsistency({}, QUESTIONS);
    expect(c.comparedPairs).toBe(0);
    expect(c.meanDiff).toBeNull();
    expect(c.isLow).toBe(false);
  });
});

describe('兜底建议', () => {
  it('每个维度都有兜底建议且不短', () => {
    for (const d of DIMENSIONS) {
      const list = DIMENSION_ADVICE[d.id];
      expect(list.length, d.label).toBeGreaterThan(0);
      for (const item of list) {
        expect(item.length, d.label).toBeGreaterThan(25);
      }
    }
  });

  it('getAdviceForDimensions 遵守上限且不重复', () => {
    const advice = getAdviceForDimensions(['responsiveness', 'conflict', 'load'], 3);
    expect(advice).toHaveLength(3);
    expect(new Set(advice).size).toBe(3);
  });
});

/* ------------------------------------------------------------------ */
/* 边界与回归                                                           */
/* ------------------------------------------------------------------ */

describe('边界与回归', () => {
  it('等级与总分始终匹配', () => {
    for (let i = 0; i <= 100; i += 1) {
      const level = getLevel(i);
      expect(i).toBeGreaterThanOrEqual(level.min);
      expect(i).toBeLessThanOrEqual(level.max);
      expect(level.oneLiner.length).toBeGreaterThan(0);
    }
  });

  it('自定义题库与维度可注入，且不做量表校准', () => {
    const customDimensions: Dimension[] = [
      {
        id: 'responsiveness',
        label: '测试维',
        short: '测试',
        weight: 100,
        description: 'x',
        explanation: 'y',
      },
    ];
    const customQuestions: Question[] = [
      {
        id: 1,
        dimension: 'responsiveness',
        text: '测试题',
        options: [
          { text: 'A', weights: { responsiveness: 1 } },
          { text: 'B', weights: { responsiveness: 0 } },
        ],
      },
    ];
    const options = { questions: customQuestions, dimensions: customDimensions };
    expect(computeScore({ 1: 0 }, options).total).toBe(100);
    expect(computeScore({ 1: 1 }, options).total).toBe(0);
    expect(computeScore({}, options).total).toBe(0);
  });

  it('scoreDimensions 返回全部维度且顺序与配置一致', () => {
    expect(scoreDimensions(answerCeiling(), QUESTIONS).map((d) => d.id)).toEqual(
      DIMENSIONS.map((d) => d.id),
    );
  });

  it('零依赖自检脚本全部通过', () => {
    const { passed, total, failures } = runQuizSelfTest();
    expect(failures).toEqual([]);
    expect(passed).toBe(total);
  });
});
