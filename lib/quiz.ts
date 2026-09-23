import type { Answers, Question } from './types';

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
