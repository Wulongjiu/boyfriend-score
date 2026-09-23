import type { Answers, Option, Question } from './types';

/**
 * 答案 <-> URL code 编解码
 *
 * 为什么需要它：分享链接要在「能算出结果」和「不泄露隐私」之间取平衡。
 * 把 27 个答案压成 7 个字符放进 URL，好处是：
 *  - 服务端不需要存任何东西就能渲染结果页（Day 8 才有数据库）
 *  - 分数与维度分可复现，链接天然可分享
 *  - 链接里是 'a'~'d' 而非原始文本，别人看到代码无法直接读出「她选了什么」
 *
 * ⚠️ 重要：这**不是加密**，只是编码。任何懂行的技术人拿到 code 都能反推出
 *    她选了哪个选项。因此 share 时必须遵守产品决策：
 *    分享卡片只呈现「分数 + 称号」，绝不展示逐题答案。
 */

/** 每个选项下标对应的字符 */
const ALPHABET = 'abcd';

/** 未作答的占位符 */
export const EMPTY_CHAR = '-';

/**
 * 编码答案
 * @param questions 题库（决定 code 长度与顺序）
 * @param answers 用户答案
 * @returns 形如 "abcd--a" 的字符串
 */
export function encodeAnswers(
  questions: readonly Question[],
  answers: Answers,
): string {
  return questions
    .map((q) => {
      const index = answers[q.id];
      if (typeof index !== 'number' || !Number.isInteger(index)) return EMPTY_CHAR;
      if (index < 0 || index >= ALPHABET.length) return EMPTY_CHAR;
      return ALPHABET[index];
    })
    .join('');
}

/** code 的合法长度（等于题库题数） */
export function codeLength(questions: readonly Question[]): number {
  return questions.length;
}

/** code 是否长度合法 */
export function isValidCode(
  questions: readonly Question[],
  code: string | null | undefined,
): boolean {
  if (!code) return false;
  if (code.length !== codeLength(questions)) return false;
  return /^[a-d-]+$/.test(code);
}

/**
 * 解码 code 为答案
 * @returns 题目答案映射；非法 code 返回 null
 */
export function decodeAnswers(
  questions: readonly Question[],
  code: string | null | undefined,
): Answers | null {
  if (!code) return null;
  if (code.length !== codeLength(questions)) return null;
  if (!/^[a-d-]+$/.test(code)) return null;

  const answers: Answers = {};
  questions.forEach((q, i) => {
    const char = code[i];
    if (char === EMPTY_CHAR) return;
    answers[q.id] = ALPHABET.indexOf(char);
  });
  return answers;
}

/** 该 code 是否包含全部答案（可用于判断"链接分享的是完整结果"） */
export function isCompleteCode(
  questions: readonly Question[],
  code: string | null | undefined,
): boolean {
  const answers = decodeAnswers(questions, code);
  if (!answers) return false;
  return questions.every((q) => typeof answers[q.id] === 'number');
}

/* ------------------------------------------------------------------ */
/* 选项顺序说明（重要）                                                  */
/* ------------------------------------------------------------------ */

/**
 * 关于"指向性"的处理方式
 *
 * v1 的缺陷：选项按优劣排列，实测 35/36 题的最优项都在 A 位、最差项在 D 位，
 * 用户能猜出规律，测的是期待而不是现实。
 *
 * v2 的处理：选项顺序在**写题库时**就已打乱并固化进 content/questions.ts
 * （由 scripts/bake-option-order.mjs 用题号做种子生成，分布 13/7/9/7）。
 *
 * 为什么不在运行时打乱：答案是按"展示位置"（选项下标）存进 URL code 的。
 * 如果运行时打乱、而计分按源数据顺序读取，分数会整体错位——这种 bug 极难发现。
 * 固化顺序后，全链路只有**一套**顺序：源数据即展示顺序即计分顺序。
 *
 * ⚠️ 因此：修改题库时必须重新运行 bake 脚本，否则新题的选项顺序会带着"最优在 A"
 * 的原始排列上线。测试里有分布断言会拦住这种情况。
 */
