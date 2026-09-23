import type {
  Answers,
  Archetype,
  ArchetypeMatch,
  ConsistencyResult,
  Dimension,
  DimensionId,
  DimensionResult,
  Question,
  RedFlagHit,
  RuleSet,
  ScoreResult,
} from './types';
import { getLevel } from './levels';
import { ARCHETYPES } from './archetypes';
import { DIMENSIONS, RED_FLAG_MAP, RULES, SCORE_CEILING, SCORE_FLOOR } from './model';
import { QUESTIONS, VERIFICATION_PAIRS } from '../content/questions';

/* ------------------------------------------------------------------ */
/* 工具函数                                                             */
/* ------------------------------------------------------------------ */

function roundTo(value: number, precision: number): number {
  const factor = 10 ** precision;
  return Math.round(value * factor) / factor;
}

function applyRounding(value: number, mode: RuleSet['rounding']): number {
  return mode === 'floor' ? Math.floor(value) : Math.round(value);
}

/** 取用户对某题选择的选项下标；未作答或越界返回 undefined */
export function getAnswerIndex(
  answers: Answers,
  question: Question,
): number | undefined {
  const index = answers[question.id];
  if (typeof index !== 'number' || !Number.isInteger(index)) return undefined;
  if (index < 0 || index >= question.options.length) return undefined;
  return index;
}

/* ------------------------------------------------------------------ */
/* 维度计分（支持单题多维度贡献）                                        */
/* ------------------------------------------------------------------ */

/**
 * 按维度汇总得分
 *
 * v2 算法：每个选项对若干维度给出 0–1 的权重贡献。
 *   维度得分 = Σ(选中选项在该维度的权重 × 题权重) / Σ(已答题的题权重) × 100
 *
 * 为什么用"题权重"而非"选项数"：一道题对不同维度的重要性可能不同，
 * 题权重取该题在该维度上所有选项权重的最大值（即"这题最多能贡献多少"），
 * 这样不会因为某题整体权重低而拉低该维度。
 *
 * 未作答的题不计入分母，避免"未答 = 0 分"的误伤。
 */
export function scoreDimensions(
  answers: Answers,
  questions: readonly Question[],
  rules: RuleSet = RULES,
  dimensions: readonly Dimension[] = DIMENSIONS,
): DimensionResult[] {
  return dimensions.map((dimension) => {
    let earned = 0;
    let max = 0;
    let answered = 0;
    let total = 0;

    for (const question of questions) {
      // 该题在该维度上可能的最高贡献
      const questionMax = question.options.reduce(
        (m, o) => Math.max(m, o.weights[dimension.id] ?? 0),
        0,
      );
      if (questionMax <= 0) continue; // 该题不参与这个维度
      total += 1;

      const index = getAnswerIndex(answers, question);
      if (index === undefined) continue;

      earned += question.options[index].weights[dimension.id] ?? 0;
      max += questionMax;
      answered += 1;
    }

    const raw = max > 0 ? (earned / max) * 100 : 0;
    return {
      id: dimension.id,
      label: dimension.label,
      short: dimension.short,
      weight: dimension.weight,
      score: roundTo(raw, rules.dimensionPrecision),
      earned: roundTo(earned, 3),
      max: roundTo(max, 3),
      answered,
      total,
    };
  });
}

/** 加权总分（未应用红牌封顶） */
export function weightedTotal(dimensions: readonly DimensionResult[]): number {
  const totalWeight = dimensions.reduce((sum, d) => sum + d.weight, 0);
  if (totalWeight <= 0) return 0;
  const weighted = dimensions.reduce((sum, d) => sum + d.score * d.weight, 0);
  return weighted / totalWeight;
}

/* ------------------------------------------------------------------ */
/* 红牌与一致性                                                          */
/* ------------------------------------------------------------------ */

export function collectRedFlags(
  answers: Answers,
  questions: readonly Question[],
): RedFlagHit[] {
  const hits: RedFlagHit[] = [];
  for (const question of questions) {
    const index = getAnswerIndex(answers, question);
    if (index === undefined) continue;
    const option = question.options[index];
    if (!option.redFlag) continue;
    const flag = RED_FLAG_MAP[option.redFlag];
    hits.push({
      id: option.redFlag,
      questionId: question.id,
      optionIndex: index,
      title: flag?.title ?? option.redFlag,
      detail: flag?.detail ?? '',
      basis: flag?.basis,
    });
  }
  return hits;
}

/**
 * 一致性校验：比较正向题与反向验证题在同一维度上的百分比差异
 *
 * v2 说明：参与校验的题只在**共同维度**上比较——因为 v2 的题是多维的，
 * 拿两个不同维度的分数比较没有意义。
 */
export function checkConsistency(
  answers: Answers,
  questions: readonly Question[],
  rules: RuleSet = RULES,
): ConsistencyResult {
  const questionMap = new Map(questions.map((q) => [q.id, q]));
  const diffs: number[] = [];

  for (const [forwardId, reverseId] of VERIFICATION_PAIRS) {
    const forward = questionMap.get(forwardId);
    const reverse = questionMap.get(reverseId);
    if (!forward || !reverse) continue;

    // 找出两题共同参与的维度
    const sharedDims = (
      Object.keys(forward.options[0]?.weights ?? {}) as DimensionId[]
    ).filter((dim) => reverse.options.some((o) => o.weights[dim] !== undefined));
    if (sharedDims.length === 0) continue;

    const dim = sharedDims[0];
    const a = questionDimensionPercent(answers, forward, dim);
    const b = questionDimensionPercent(answers, reverse, dim);
    if (a === null || b === null) continue;
    diffs.push(Math.abs(a - b));
  }

  if (diffs.length === 0) {
    return { meanDiff: null, isLow: false, comparedPairs: 0, hint: null };
  }

  const meanDiff = diffs.reduce((sum, d) => sum + d, 0) / diffs.length;
  const isLow = meanDiff > rules.consistencyThreshold;
  return {
    meanDiff: roundTo(meanDiff, 1),
    isLow,
    comparedPairs: diffs.length,
    hint: isLow ? rules.consistencyHint : null,
  };
}

/** 单题在某维度上得分的百分比（0–100）；未作答或该题不参与该维度返回 null */
export function questionDimensionPercent(
  answers: Answers,
  question: Question,
  dimension: DimensionId,
): number | null {
  const index = getAnswerIndex(answers, question);
  if (index === undefined) return null;
  const max = question.options.reduce((m, o) => Math.max(m, o.weights[dimension] ?? 0), 0);
  if (max <= 0) return null;
  const value = question.options[index].weights[dimension] ?? 0;
  return (value / max) * 100;
}

/* ------------------------------------------------------------------ */
/* 关系原型匹配                                                          */
/* ------------------------------------------------------------------ */

/**
 * 把维度得分换算到 0–100（已经是），供原型条件使用
 *
 * 匹配算法：
 *  1. 对每个原型，检查它的每个条件（维度是否落在区间内）
 *  2. 只有**全部条件都满足**才视为命中（避免"有点像"的模糊结论）
 *  3. 命中后按条件的紧密度给匹配度打分（离区间中心越近越贴合）
 *  4. 按 优先级 → 匹配度 排序
 *
 * 为什么要求全部满足：原型的价值在于"说中"，差不多就命中会稀释可信度。
 * 若没有任何原型命中，结果页退化为「按最弱维度给建议」，不会没有结论。
 */
export function matchArchetypes(
  dimensions: readonly DimensionResult[],
  archetypes: readonly Archetype[] = ARCHETYPES,
  limit = 3,
): ArchetypeMatch[] {
  const scoreOf = (id: DimensionId): number | null => {
    const d = dimensions.find((x) => x.id === id);
    if (!d || d.answered === 0) return null;
    return d.score;
  };

  const matches: ArchetypeMatch[] = [];

  for (const archetype of archetypes) {
    let matched = 0;
    let closeness = 0;
    let totalWeight = 0;
    let ok = true;

    for (const condition of archetype.conditions) {
      const value = scoreOf(condition.dimension);
      if (value === null) {
        ok = false;
        break;
      }
      const min = condition.min ?? 0;
      const max = condition.max ?? 100;
      if (value < min || value > max) {
        ok = false;
        break;
      }
      matched += 1;
      const w = condition.weight ?? 1;
      totalWeight += w;
      // 离区间中心越近，越贴合
      const center = (min + max) / 2;
      const halfSpan = Math.max((max - min) / 2, 1);
      closeness += w * (1 - Math.min(1, Math.abs(value - center) / halfSpan));
    }

    if (!ok || matched === 0) continue;

    const score = totalWeight > 0 ? closeness / totalWeight : 0;
    matches.push({ archetype, score: roundTo(score, 3), matched });
  }

  return matches
    .sort((a, b) =>
      b.archetype.priority !== a.archetype.priority
        ? b.archetype.priority - a.archetype.priority
        : b.score - a.score,
    )
    .slice(0, limit);
}

/* ------------------------------------------------------------------ */
/* 顺序工具                                                             */
/* ------------------------------------------------------------------ */

/**
 * 排序维度：按「对总分的实际拉动量」而非裸分排序
 *
 * 为什么不用裸分：一个 8% 权重维度考 60 分，和一个 22% 权重维度考 60 分，
 * 后者对总分的影响接近三倍。用 impact 排序才能让"最该聊的那件事"排在前面。
 */
function sortByImpact(
  dimensions: readonly DimensionResult[],
  direction: 'asc' | 'desc',
  limit: number,
): DimensionId[] {
  const answered = dimensions.filter((d) => d.answered > 0);
  if (answered.length === 0) return [];
  const sorted = [...answered].sort((a, b) => {
    const impactA = (a.score * a.weight) / 100;
    const impactB = (b.score * b.weight) / 100;
    if (impactA !== impactB) {
      return direction === 'asc' ? impactA - impactB : impactB - impactA;
    }
    return b.weight - a.weight;
  });
  return sorted.slice(0, limit).map((d) => d.id);
}

/* ------------------------------------------------------------------ */
/* 主入口                                                               */
/* ------------------------------------------------------------------ */

/**
 * 计算测评结果（纯函数：相同输入必然得到相同输出）
 *
 * 规则：
 * 1. 维度得分 = Σ(选中选项权重) / Σ(题权重) × 100
 * 2. 总分 = Σ(维度得分 × 权重) / Σ权重，四舍五入
 * 3. 命中任一红牌 → 总分封顶 rules.redFlagScoreCap
 * 4. 无任何作答 → 总分 0，归入最低档
 */
export function computeScore(
  answers: Answers,
  options: {
    questions?: readonly Question[];
    rules?: RuleSet;
    dimensions?: readonly Dimension[];
    archetypes?: readonly Archetype[];
  } = {},
): ScoreResult {
  const questions = options.questions ?? QUESTIONS;
  const rules = options.rules ?? RULES;
  const dimensionsConfig = options.dimensions ?? DIMENSIONS;

  const dimensions = scoreDimensions(answers, questions, rules, dimensionsConfig);
  const rawTotal = weightedTotal(dimensions);

  // 量表校准：把"最高可达分"映射为 100。
  // 原因见 lib/model.ts 的 SCORE_CEILING 注释——多维加权下七维无法同时满分，
  // 不校准的话「满分 100」「95+ 人间理想」永远不可达。
  const normalizedTotal = normalizeScore(rawTotal, questions);

  const redFlags = collectRedFlags(answers, questions);
  const isCapped = redFlags.length > 0 && normalizedTotal > rules.redFlagScoreCap;
  const cappedTotal = isCapped ? rules.redFlagScoreCap : normalizedTotal;
  const total = applyRounding(cappedTotal, rules.rounding);

  const consistency = checkConsistency(answers, questions, rules);
  // 注意：不能按维度累加——v2 里一道题可能参与多个维度，累加会把完成数算多。
  // 必须按"题"统计已作答数量。
  const answeredCount = questions.filter(
    (q) => getAnswerIndex(answers, q) !== undefined,
  ).length;

  return {
    total,
    rawTotal: roundTo(rawTotal, 2),
    isCapped,
    dimensions,
    weakestDimensions: sortByImpact(dimensions, 'asc', 3),
    strongestDimensions: sortByImpact(dimensions, 'desc', 3),
    redFlags,
    consistency,
    level: getLevel(total),
    archetypes: matchArchetypes(dimensions, options.archetypes ?? ARCHETYPES),
    answeredCount,
    totalQuestions: questions.length,
    isComplete: answeredCount === questions.length,
  };
}

/**
 * 把原始加权分换算到展示分（0–100）
 *
 * 线性映射 [SCORE_FLOOR, SCORE_CEILING] → [0, 100]。
 * 上下限的来由见 lib/model.ts 的常量注释：多维加权下，"全部选最差"拿不到 0、
 * "尽量拉满"也拿不到 100，不校准会让量表两端各留一段死区。
 *
 * 仅当传入的是**默认题库**时才做校准——注入自定义题库（测试用）时上下限未知，
 * 直接返回原始分，避免把测试题的期望值改掉。
 */
export function normalizeScore(
  rawTotal: number,
  questions: readonly Question[] = QUESTIONS,
): number {
  if (questions !== QUESTIONS) return rawTotal;
  const span = SCORE_CEILING - SCORE_FLOOR;
  if (span <= 0) return rawTotal;
  const normalized = ((rawTotal - SCORE_FLOOR) / span) * 100;
  return Math.max(0, Math.min(100, normalized));
}

/** 是否所有题目都已作答 */
export function isQuizComplete(
  answers: Answers,
  questions: readonly Question[] = QUESTIONS,
): boolean {
  return questions.every((q) => getAnswerIndex(answers, q) !== undefined);
}

/** 第一个未作答的题号（用于"继续答题"）；全部作答则返回 null */
export function firstUnansweredId(
  answers: Answers,
  questions: readonly Question[] = QUESTIONS,
): number | null {
  for (const question of questions) {
    if (getAnswerIndex(answers, question) === undefined) return question.id;
  }
  return null;
}

/** 答题进度 0–1 */
export function progress(
  answers: Answers,
  questions: readonly Question[] = QUESTIONS,
): number {
  if (questions.length === 0) return 0;
  const answered = questions.filter(
    (q) => getAnswerIndex(answers, q) !== undefined,
  ).length;
  return answered / questions.length;
}
