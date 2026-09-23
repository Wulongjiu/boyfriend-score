import { describe, expect, it } from 'vitest';

import { getAdviceForDimensions } from '../lib/advice';
import { getLevel, LEVELS } from '../lib/levels';
import { DIMENSIONS, MAX_OPTION_SCORE, RED_FLAG_MAP, RED_FLAGS, RULES } from '../lib/model';
import {
  checkConsistency,
  collectRedFlags,
  computeScore,
  firstUnansweredId,
  getAnswerIndex,
  isQuizComplete,
  progress,
  questionPercent,
  scoreDimensions,
} from '../lib/scoring';
import type { Answers, Dimension, Question } from '../lib/types';
import { QUESTIONS, QUESTION_MAP, TOTAL_QUESTIONS, VERIFICATION_PAIRS } from '../content/questions';

/* ------------------------------------------------------------------ */
/* 测试工具                                                             */
/* ------------------------------------------------------------------ */

/** 每题选指定下标的选项 */
function answerAll(questions: readonly Question[], index: number): Answers {
  return questions.reduce<Answers>((acc, q) => {
    acc[q.id] = index;
    return acc;
  }, {});
}

/** 取某题分值最高 / 最低的选项下标 */
function bestOptionIndex(question: Question): number {
  let best = 0;
  question.options.forEach((o, i) => {
    if (o.score > question.options[best].score) best = i;
  });
  return best;
}

function lowestOptionIndex(question: Question): number {
  let worst = 0;
  question.options.forEach((o, i) => {
    if (o.score < question.options[worst].score) worst = i;
  });
  return worst;
}

/** 每题选分值最高的选项 */
function answerBest(questions: readonly Question[]): Answers {
  return questions.reduce<Answers>((acc, q) => {
    acc[q.id] = bestOptionIndex(q);
    return acc;
  }, {});
}

/** 每题选分值最低的选项 */
function answerWorst(questions: readonly Question[]): Answers {
  return questions.reduce<Answers>((acc, q) => {
    acc[q.id] = lowestOptionIndex(q);
    return acc;
  }, {});
}

/** 指定题选第 index 项，其余全部选满分项 */
function answerBestExcept(
  questions: readonly Question[],
  overrides: Record<number, number>,
): Answers {
  const answers = answerBest(questions);
  for (const [id, index] of Object.entries(overrides)) {
    answers[Number(id)] = index;
  }
  return answers;
}

/** 为每个维度构造"该维度取第 tier 档"的答案（0 = 全最低分，5 = 全满分） */
function answersByTier(questions: readonly Question[], tier: number): Answers {
  const answers: Answers = {};
  for (const q of questions) {
    const sorted = [...q.options]
      .map((o, i) => ({ score: o.score, index: i }))
      .sort((a, b) => a.score - b.score);
    const clamped = Math.max(0, Math.min(tier, sorted.length - 1));
    answers[q.id] = sorted[clamped].index;
  }
  return answers;
}

/* ------------------------------------------------------------------ */
/* 题库与模型自检（数据契约）                                            */
/* ------------------------------------------------------------------ */

describe('题库与模型数据契约', () => {
  it('七维权重合计为 100', () => {
    const sum = DIMENSIONS.reduce((acc, d) => acc + d.weight, 0);
    expect(sum).toBe(100);
  });

  it('维度 id 唯一', () => {
    const ids = DIMENSIONS.map((d) => d.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('题号连续且从 1 开始', () => {
    const ids = QUESTIONS.map((q) => q.id);
    expect(ids).toEqual(Array.from({ length: TOTAL_QUESTIONS }, (_, i) => i + 1));
  });

  it('每题恰好 4 个选项，分值在 0–4 之间', () => {
    for (const q of QUESTIONS) {
      expect(q.options.length, `Q${q.id} 选项数`).toBe(4);
      for (const o of q.options) {
        expect(o.score, `Q${q.id} 分值`).toBeGreaterThanOrEqual(0);
        expect(o.score, `Q${q.id} 分值`).toBeLessThanOrEqual(MAX_OPTION_SCORE);
      }
    }
  });

  it('每题至少有一个满分选项（否则该题永远拿不到满分）', () => {
    for (const q of QUESTIONS) {
      const max = Math.max(...q.options.map((o) => o.score));
      expect(max, `Q${q.id} 最高分`).toBe(MAX_OPTION_SCORE);
    }
  });

  it('每个维度都至少有 3 道题', () => {
    for (const d of DIMENSIONS) {
      const count = QUESTIONS.filter((q) => q.dimension === d.id).length;
      expect(count, `${d.label} 题数`).toBeGreaterThanOrEqual(3);
    }
  });

  it('题目里出现的 redFlag 都已在 RED_FLAGS 中定义', () => {
    const defined = new Set(RED_FLAGS.map((f) => f.id));
    for (const q of QUESTIONS) {
      for (const o of q.options) {
        if (o.redFlag) {
          expect(defined.has(o.redFlag), `Q${q.id} 的 redFlag=${o.redFlag}`).toBe(true);
        }
      }
    }
  });

  it('标记为红牌题的题目，至少有一个选项带 redFlag', () => {
    const redFlagQuestions = QUESTIONS.filter((q) => q.isRedFlag);
    expect(redFlagQuestions.length).toBeGreaterThanOrEqual(5);
    for (const q of redFlagQuestions) {
      expect(
        q.options.some((o) => o.redFlag),
        `Q${q.id}`,
      ).toBe(true);
    }
  });

  it('没有孤立未使用的红牌定义', () => {
    const used = new Set(
      QUESTIONS.flatMap((q) => q.options.map((o) => o.redFlag).filter(Boolean)),
    );
    for (const flag of RED_FLAGS) {
      expect(used.has(flag.id), `红牌 ${flag.id} 未被任何选项使用`).toBe(true);
    }
  });

  it('反向验证题对指向的有效题号，且维度一致', () => {
    expect(VERIFICATION_PAIRS.length).toBeGreaterThanOrEqual(3);
    for (const [forwardId, reverseId] of VERIFICATION_PAIRS) {
      const forward = QUESTION_MAP[forwardId];
      const reverse = QUESTION_MAP[reverseId];
      expect(forward, `正向题 Q${forwardId} 存在`).toBeDefined();
      expect(reverse, `反向题 Q${reverseId} 存在`).toBeDefined();
      expect(reverse.dimension, `Q${reverseId} 与 Q${forwardId} 维度一致`).toBe(
        forward.dimension,
      );
    }
  });

  it('等级档位连续覆盖 0–100 且不重叠', () => {
    const sorted = [...LEVELS].sort((a, b) => a.min - b.min);
    expect(sorted[0].min).toBe(0);
    expect(sorted[sorted.length - 1].max).toBe(100);
    for (let i = 1; i < sorted.length; i += 1) {
      expect(sorted[i].min, `第 ${i} 档起始`).toBe(sorted[i - 1].max + 1);
    }
  });

  it('每个红牌都有非空标题与说明', () => {
    for (const flag of RED_FLAGS) {
      expect(flag.title.length, flag.id).toBeGreaterThan(0);
      expect(flag.detail.length, flag.id).toBeGreaterThan(20);
      expect(RED_FLAG_MAP[flag.id]).toBe(flag);
    }
  });
});

/* ------------------------------------------------------------------ */
/* 计分正确性                                                            */
/* ------------------------------------------------------------------ */

describe('computeScore · 计分正确性', () => {
  it('全部满分 → 总分 100，等级为最高档', () => {
    const result = computeScore(answerBest(QUESTIONS));
    expect(result.total).toBe(100);
    expect(result.rawTotal).toBe(100);
    expect(result.level.id).toBe('legend');
    expect(result.isComplete).toBe(true);
    expect(result.answeredCount).toBe(TOTAL_QUESTIONS);
    expect(result.redFlags).toEqual([]);
  });

  it('全部最低分 → 总分 0，不是最高分', () => {
    const result = computeScore(answerWorst(QUESTIONS));
    expect(result.total).toBe(0);
    expect(result.level.id).toBe('deserve_better');
  });

  it('每个维度单独满分时，总分等于该维度权重', () => {
    for (const dimension of DIMENSIONS) {
      const answers: Answers = {};
      for (const q of QUESTIONS) {
        const index =
          q.dimension === dimension.id ? bestOptionIndex(q) : lowestOptionIndex(q);
        answers[q.id] = index;
      }
      const result = computeScore(answers);
      expect(result.total, `${dimension.label} 单独满分`).toBe(dimension.weight);
      const dim = result.dimensions.find((d) => d.id === dimension.id)!;
      expect(dim.score).toBe(100);
    }
  });

  it('总分等于各维度加权平均（误差 ≤ 0.01）', () => {
    const answers = answerAll(QUESTIONS, 1);
    const result = computeScore(answers);
    const expected = result.dimensions.reduce(
      (sum, d) => sum + (d.score * d.weight) / 100,
      0,
    );
    expect(Math.abs(result.rawTotal - expected)).toBeLessThanOrEqual(0.01);
  });

  it('分值单调：成绩越好的答案集，总分不会更低', () => {
    const scores = [1, 2, 3, 4].map((tier) => computeScore(answersByTier(QUESTIONS, tier)).total);
    for (let i = 1; i < scores.length; i += 1) {
      expect(scores[i], `第 ${i} 档总分应 >= 第 ${i - 1} 档`).toBeGreaterThanOrEqual(
        scores[i - 1],
      );
    }
    expect(scores[scores.length - 1]).toBe(100);
  });

  it('单题提分不会让总分下降（1 分精度内的严格单调）', () => {
    // 0 分选项不会命中红牌（红牌选项均为 0 分），因此这里不受封顶干扰
    const indices = [0, 1, 2, 3];
    for (const a of indices) {
      for (const b of indices) {
        for (const c of indices) {
          for (const d of indices) {
            for (const e of indices) {
              for (const f of indices) {
                for (const g of indices) {
                  const combo = [a, b, c, d, e, f, g] as const;
                  const answers: Answers = {};
                  DIMENSIONS.forEach((dim, i) => {
                    for (const q of QUESTIONS.filter((q) => q.dimension === dim.id)) {
                      const sorted = [...q.options]
                        .map((o, index) => ({ score: o.score, index }))
                        .sort((x, y) => x.score - y.score);
                      answers[q.id] = sorted[combo[i]].index;
                    }
                  });
                  const base = computeScore(answers).total;
                  // 把第 1 题的选项分值 +1（若已是满分则跳过）
                  const q1 = QUESTION_MAP[1];
                  const current = answers[1]!;
                  const upgraded = q1.options
                    .map((o, i) => ({ score: o.score, index: i }))
                    .filter((o) => o.score === q1.options[current].score + 1);
                  if (upgraded.length === 0) continue;
                  const next = { ...answers, 1: upgraded[0].index };
                  expect(
                    computeScore(next).total,
                    `combo=${combo.join('')}`,
                  ).toBeGreaterThanOrEqual(base);
                }
              }
            }
          }
        }
      }
    }
  });

  it('维度得分只在 0–100 之间', () => {
    const result = computeScore(answerAll(QUESTIONS, 2));
    for (const d of result.dimensions) {
      expect(d.score).toBeGreaterThanOrEqual(0);
      expect(d.score).toBeLessThanOrEqual(100);
    }
  });

  it('空答案 → 总分 0，各维度 0 分，未完成', () => {
    const result = computeScore({});
    expect(result.total).toBe(0);
    expect(result.isComplete).toBe(false);
    expect(result.answeredCount).toBe(0);
    expect(result.dimensions.every((d) => d.score === 0 && d.answered === 0)).toBe(true);
  });

  it('纯函数：相同输入两次调用结果一致', () => {
    const answers = answerAll(QUESTIONS, 2);
    expect(computeScore(answers)).toEqual(computeScore(answers));
  });

  it('不修改传入的 answers 对象', () => {
    const answers = answerAll(QUESTIONS, 1);
    const snapshot = JSON.stringify(answers);
    computeScore(answers);
    expect(JSON.stringify(answers)).toBe(snapshot);
  });

  it('每题最多 4 分：答对 3 项、答错 1 项的时间应低于满分', () => {
    const q1 = QUESTION_MAP[1];
    const answers = answerBestExcept(QUESTIONS, { 1: lowestOptionIndex(q1) });
    const result = computeScore(answers);
    expect(result.total).toBeLessThan(100);
    expect(result.dimensions[0].score).toBeLessThan(100);
  });
});

/* ------------------------------------------------------------------ */
/* 红牌与封顶                                                            */
/* ------------------------------------------------------------------ */

describe('computeScore · 红牌与封顶', () => {
  it('命中红牌时总分封顶', () => {
    // Q5 选「你想多了」→ invalidate_feelings
    const answers = answerBestExcept(QUESTIONS, { 5: 2 });
    const result = computeScore(answers);
    expect(result.redFlags.length).toBe(1);
    expect(result.redFlags[0].id).toBe('invalidate_feelings');
    expect(result.isCapped).toBe(true);
    expect(result.total).toBe(RULES.redFlagScoreCap);
    expect(result.rawTotal).toBeGreaterThan(RULES.redFlagScoreCap);
    expect(result.total).toBeLessThanOrEqual(54); // 落入「需要认真聊一次」及以下
  });

  it('红牌封顶不影响未命中时的分数', () => {
    const clean = computeScore(answerBest(QUESTIONS));
    expect(clean.isCapped).toBe(false);
    expect(clean.redFlags).toEqual([]);
    expect(clean.total).toBe(100);
  });

  it('多个红牌只封顶一次，不叠加扣分', () => {
    const oneFlag = computeScore(answerBestExcept(QUESTIONS, { 5: 2 }));
    const twoFlags = computeScore(answerBestExcept(QUESTIONS, { 5: 2, 19: 2 }));
    expect(twoFlags.redFlags.length).toBe(2);
    expect(twoFlags.total).toBe(oneFlag.total);
  });

  it('红牌命中但原始分已低于封顶值时，不标记为封顶', () => {
    const answers = answerWorst(QUESTIONS);
    const result = computeScore(answers);
    expect(result.redFlags.length).toBeGreaterThan(0);
    expect(result.isCapped).toBe(false);
    expect(result.total).toBe(0);
  });

  it('每个红牌选项都能被正确收集', () => {
    for (const question of QUESTIONS) {
      question.options.forEach((option, index) => {
        if (!option.redFlag) return;
        const answers = answerBestExcept(QUESTIONS, { [question.id]: index });
        const hits = collectRedFlags(answers, QUESTIONS);
        expect(
          hits.some((h) => h.id === option.redFlag && h.questionId === question.id),
          `Q${question.id} 选项 ${index}`,
        ).toBe(true);
      });
    }
  });
});

/* ------------------------------------------------------------------ */
/* 部分作答 / 一致性 / 建议                                              */
/* ------------------------------------------------------------------ */

describe('部分作答', () => {
  it('未作答的题不计入分母，只答满分题应得满分', () => {
    const full = answerBest(QUESTIONS);
    const half: Answers = {};
    for (const q of QUESTIONS) {
      if (q.id % 2 === 0) half[q.id] = full[q.id];
    }
    const result = computeScore(half);
    expect(result.total).toBe(100);
    expect(result.isComplete).toBe(false);
    expect(result.answeredCount).toBe(Math.floor(TOTAL_QUESTIONS / 2));
  });

  it('越界或非整数的答案被忽略', () => {
    const answers: Answers = { 1: 99, 2: -1, 3: 1.5, 4: 0 };
    expect(getAnswerIndex(answers, QUESTION_MAP[1])).toBeUndefined();
    expect(getAnswerIndex(answers, QUESTION_MAP[2])).toBeUndefined();
    expect(getAnswerIndex(answers, QUESTION_MAP[3])).toBeUndefined();
    expect(getAnswerIndex(answers, QUESTION_MAP[4])).toBe(0);
  });

  it('firstUnansweredId / isQuizComplete / progress 行为正确', () => {
    expect(firstUnansweredId({})).toBe(1);
    expect(progress({})).toBe(0);
    expect(isQuizComplete({})).toBe(false);

    const full = answerBest(QUESTIONS);
    expect(firstUnansweredId(full)).toBeNull();
    expect(progress(full)).toBe(1);
    expect(isQuizComplete(full)).toBe(true);
  });

  it('questionPercent 对未作答题返回 null', () => {
    expect(questionPercent({}, QUESTION_MAP[1])).toBeNull();
    expect(questionPercent({ 1: 0 }, QUESTION_MAP[1])).toBe(100);
  });
});

describe('一致性校验', () => {
  it('答案完全一致时差值接近 0，且判定为一致', () => {
    const result = computeScore(answerBest(QUESTIONS));
    expect(result.consistency.comparedPairs).toBe(VERIFICATION_PAIRS.length);
    expect(result.consistency.meanDiff).toBe(0);
    expect(result.consistency.isLow).toBe(false);
  });

  it('正反题严重矛盾时判定为低一致性', () => {
    // Q1（正向）满分 + Q4（验证题）最低分，Q8 + Q9 同样矛盾 → 两组 100 分差
    const answers = answerBestExcept(QUESTIONS, {
      4: lowestOptionIndex(QUESTION_MAP[4]),
      9: lowestOptionIndex(QUESTION_MAP[9]),
    });
    const consistency = checkConsistency(answers, QUESTIONS);
    expect(consistency.isLow).toBe(true);
    expect(consistency.meanDiff).toBeGreaterThan(RULES.consistencyThreshold);
  });

  it('未答题对不参与一致性统计', () => {
    const consistency = checkConsistency({}, QUESTIONS);
    expect(consistency.comparedPairs).toBe(0);
    expect(consistency.meanDiff).toBeNull();
    expect(consistency.isLow).toBe(false);
  });

  it('低一致性不改变分数，只做提示', () => {
    const contradictory = answerBestExcept(QUESTIONS, {
      4: lowestOptionIndex(QUESTION_MAP[4]),
      9: lowestOptionIndex(QUESTION_MAP[9]),
    });
    const result = computeScore(contradictory);
    expect(result.consistency.isLow).toBe(true);
    // 分数仍按实际答案计算（92.25），没有因为"乱答嫌疑"被额外扣分
    expect(result.rawTotal).toBeGreaterThan(90);
    expect(result.rawTotal).toBeLessThan(100);
  });
});

describe('最弱维度与建议', () => {
  it('最弱维度排在最前，且未作答的维度不参与', () => {
    const answers = answerBest(QUESTIONS);
    for (const q of QUESTIONS.filter((q) => q.dimension === 'communication')) {
      answers[q.id] = lowestOptionIndex(q);
    }
    const result = computeScore(answers);
    expect(result.weakestDimensions[0]).toBe('communication');

    // 只答了仪式感维度的题 → 其它维度不进入最弱榜
    const partial = computeScore({ 21: lowestOptionIndex(QUESTION_MAP[21]) });
    expect(partial.weakestDimensions).toEqual(['ritual']);
  });

  it('最弱榜按「对总分的拉动量」排序，而非裸分', () => {
    const answers = answerBest(QUESTIONS);
    // 沟通(20% 权重) 与 未来(15% 权重) 都考 0 分，沟通应排在前面
    for (const q of QUESTIONS.filter(
      (q) => q.dimension === 'communication' || q.dimension === 'future',
    )) {
      answers[q.id] = lowestOptionIndex(q);
    }
    const result = computeScore(answers);
    const comm = result.dimensions.find((d) => d.id === 'communication')!;
    const future = result.dimensions.find((d) => d.id === 'future')!;
    expect(comm.score).toBe(future.score);
    expect(result.weakestDimensions.slice(0, 2)).toEqual(['communication', 'future']);
  });

  it('只答一个维度时也能给出建议', () => {
    const answers: Answers = {};
    for (const q of QUESTIONS.filter((q) => q.dimension === 'ritual')) {
      answers[q.id] = lowestOptionIndex(q);
    }
    const result = computeScore(answers);
    const advice = getAdviceForDimensions(result.weakestDimensions, 2);
    expect(advice.length).toBeGreaterThan(0);
    expect(result.weakestDimensions[0]).toBe('ritual');
  });

  it('getAdviceForDimensions 遵守数量上限', () => {
    const advice = getAdviceForDimensions(['communication', 'boundary', 'future'], 3);
    expect(advice).toHaveLength(3);
    expect(new Set(advice).size).toBe(3);
  });

  it('最强维度与最弱维度互补且不重复', () => {
    const answers = answerBest(QUESTIONS);
    for (const q of QUESTIONS.filter((q) => q.dimension === 'ritual')) {
      answers[q.id] = lowestOptionIndex(q);
    }
    const result = computeScore(answers);
    expect(result.weakestDimensions[0]).toBe('ritual');
    expect(result.strongestDimensions[0]).not.toBe('ritual');
    expect(new Set(result.strongestDimensions).size).toBe(result.strongestDimensions.length);
  });
});

/* ------------------------------------------------------------------ */
/* 边界与回归                                                            */
/* ------------------------------------------------------------------ */

describe('边界与回归', () => {
  it('总分始终为 0–100 的整数', () => {
    const cases: Answers[] = [
      {},
      answerAll(QUESTIONS, 0),
      answerAll(QUESTIONS, 1),
      answerAll(QUESTIONS, 2),
      answerAll(QUESTIONS, 3),
      answerBest(QUESTIONS),
      answerWorst(QUESTIONS),
    ];
    for (const answers of cases) {
      const { total } = computeScore(answers);
      expect(Number.isInteger(total), `total=${total}`).toBe(true);
      expect(total).toBeGreaterThanOrEqual(0);
      expect(total).toBeLessThanOrEqual(100);
    }
  });

  it('等级与总分始终匹配（0–100 全覆盖）', () => {
    for (let i = 0; i <= 100; i += 1) {
      const level = getLevel(i);
      expect(i, `score=${i} level=${level.id}`).toBeGreaterThanOrEqual(level.min);
      expect(i, `score=${i} level=${level.id}`).toBeLessThanOrEqual(level.max);
      expect(level.oneLiner.length).toBeGreaterThan(0);
      expect(level.advice.length).toBeGreaterThan(0);
      expect(level.description.length).toBeGreaterThan(20);
    }
  });

  it('自定义题库与维度可注入（不被硬编码污染）', () => {
    const customDimensions: Dimension[] = [
      { id: 'ritual', label: '仪式', short: '仪式', weight: 100, description: 'x' },
    ];
    const customQuestions: Question[] = [
      {
        id: 1,
        dimension: 'ritual',
        text: '测试题',
        options: [
          { text: 'A', score: 4 },
          { text: 'B', score: 0 },
        ],
      },
    ];
    const options = { questions: customQuestions, dimensions: customDimensions };

    const correct = computeScore({ 1: 0 }, options);
    expect(correct.total).toBe(100);
    expect(correct.totalQuestions).toBe(1);
    expect(correct.isComplete).toBe(true);

    const wrong = computeScore({ 1: 1 }, options);
    expect(wrong.total).toBe(0);

    const half = computeScore({}, options);
    expect(half.total).toBe(0);
    expect(half.isComplete).toBe(false);
  });

  it('维度权重按实际总和归一化（防御性：权重总和 ≠ 100 也不错分）', () => {
    const customDimensions: Dimension[] = [
      { id: 'ritual', label: '仪式', short: '仪式', weight: 30, description: 'x' },
      { id: 'family', label: '社交', short: '社交', weight: 10, description: 'x' },
    ];
    const customQuestions: Question[] = [
      {
        id: 1,
        dimension: 'ritual',
        text: 'A',
        options: [
          { text: '好', score: 4 },
          { text: '差', score: 0 },
        ],
      },
      {
        id: 2,
        dimension: 'family',
        text: 'B',
        options: [
          { text: '好', score: 4 },
          { text: '差', score: 0 },
        ],
      },
    ];
    // 仪式满分 + 社交 0 分 → 30/40 × 100 = 75
    const result = computeScore(
      { 1: 0, 2: 1 },
      { questions: customQuestions, dimensions: customDimensions },
    );
    expect(result.total).toBe(75);
  });

  it('scoreDimensions 返回全部维度且顺序与配置一致', () => {
    const result = scoreDimensions(answerBest(QUESTIONS), QUESTIONS, RULES);
    expect(result.map((d) => d.id)).toEqual(DIMENSIONS.map((d) => d.id));
    expect(result.every((d) => d.answered === d.total)).toBe(true);
  });
});
