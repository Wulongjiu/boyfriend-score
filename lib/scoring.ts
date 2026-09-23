import type {
  Answers,
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
import { DIMENSIONS, MAX_OPTION_SCORE, RED_FLAG_MAP, RULES } from './model';
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

/** 单题得分占该题满分的百分比（0–100）；未作答返回 null */
export function questionPercent(
  answers: Answers,
  question: Question,
): number | null {
  const index = getAnswerIndex(answers, question);
  if (index === undefined) return null;
  const score = question.options[index].score;
  const max = Math.max(...question.options.map((o) => o.score));
  if (max <= 0) return null;
  return (score / max) * 100;
}

/* ------------------------------------------------------------------ */
/* 各部分计分                                                            */
/* ------------------------------------------------------------------ */

/** 按维度汇总得分（未作答的题不计入分母，避免误伤） */
export function scoreDimensions(
  answers: Answers,
  questions: readonly Question[],
  rules: RuleSet = RULES,
  dimensions: readonly Dimension[] = DIMENSIONS,
): DimensionResult[] {
  return dimensions.map((dimension) => {
    const dimQuestions = questions.filter((q) => q.dimension === dimension.id);
    let earned = 0;
    let max = 0;
    let answered = 0;

    for (const question of dimQuestions) {
      const index = getAnswerIndex(answers, question);
      if (index === undefined) continue;
      earned += question.options[index].score;
      max += MAX_OPTION_SCORE;
      answered += 1;
    }

    const raw = max > 0 ? (earned / max) * 100 : 0;
    return {
      id: dimension.id,
      label: dimension.label,
      short: dimension.short,
      weight: dimension.weight,
      score: roundTo(raw, rules.dimensionPrecision),
      earned,
      max,
      answered,
      total: dimQuestions.length,
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

/** 收集命中的红牌 */
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
    });
  }
  return hits;
}

/**
 * 一致性校验：比较正向题与反向验证题的百分比差异
 * 差异大 = 用户可能在乱答，或题目本身有歧义
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
    const a = questionPercent(answers, forward);
    const b = questionPercent(answers, reverse);
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

/**
 * 排序维度：按「对总分的实际拉动量」而非裸分排序
 *
 * 为什么不用裸分：一个 10% 权重维度考 60 分，和一个 20% 权重维度考 60 分，
 * 后者对总分的影响是前者两倍。用 impact 排序才能让"最该聊的那件事"排在前面。
 * - weakest: impact 升序（丢分最多 = 最该聊）
 * - strongest: impact 降序（贡献最大 = 最该肯定）
 */
function sortByImpact(
  dimensions: readonly DimensionResult[],
  direction: 'asc' | 'desc',
  limit: number,
): DimensionId[] {
  // 只考虑已作答的维度，避免未答维度污染建议生成
  const answered = dimensions.filter((d) => d.answered > 0);
  if (answered.length === 0) return [];
  const sorted = [...answered].sort((a, b) => {
    const impactA = (a.score * a.weight) / 100;
    const impactB = (b.score * b.weight) / 100;
    if (impactA !== impactB) {
      return direction === 'asc' ? impactA - impactB : impactB - impactA;
    }
    // 同分时按权重降序，权重大的更值得优先关注
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
 * 1. 维度得分 = 该维已答题实得分 / 已答题满分 × 100
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
  } = {},
): ScoreResult {
  const questions = options.questions ?? QUESTIONS;
  const rules = options.rules ?? RULES;
  const dimensionsConfig = options.dimensions ?? DIMENSIONS;

  const dimensions = scoreDimensions(answers, questions, rules, dimensionsConfig);
  const rawTotal = weightedTotal(dimensions);

  const redFlags = collectRedFlags(answers, questions);
  const isCapped = redFlags.length > 0 && rawTotal > rules.redFlagScoreCap;
  const cappedTotal = isCapped ? rules.redFlagScoreCap : rawTotal;

  const total = applyRounding(cappedTotal, rules.rounding);
  const consistency = checkConsistency(answers, questions, rules);

  const answeredCount = dimensions.reduce((sum, d) => sum + d.answered, 0);

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
    answeredCount,
    totalQuestions: questions.length,
    isComplete: answeredCount === questions.length,
  };
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
