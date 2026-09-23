import { describe, expect, it } from 'vitest';

import { QUESTIONS, QUESTION_MAP, TOTAL_QUESTIONS } from '../content/questions';
import {
  EMPTY_CHAR,
  codeLength,
  decodeAnswers,
  encodeAnswers,
  isCompleteCode,
  isValidCode,
} from '../lib/quiz';
import { computeScore } from '../lib/scoring';
import { runQuizSelfTest } from '../lib/quiz-selftest';
import type { Answers } from '../lib/types';

/**
 * 答案编解码测试
 *
 * 这套逻辑直接决定"分享链接能不能算出正确结果"，
 * 一旦出错，用户看到的分数会和她答的题不一致——属于致命缺陷，必须测密。
 */

function allAnswered(value: number): Answers {
  const answers: Answers = {};
  for (const q of QUESTIONS) answers[q.id] = value;
  return answers;
}

describe('答案 code 编解码', () => {
  it('code 长度等于题库题数', () => {
    expect(codeLength(QUESTIONS)).toBe(TOTAL_QUESTIONS);
    expect(encodeAnswers(QUESTIONS, {})).toHaveLength(TOTAL_QUESTIONS);
  });

  it('空答案编码为全占位符', () => {
    expect(encodeAnswers(QUESTIONS, {})).toBe(EMPTY_CHAR.repeat(TOTAL_QUESTIONS));
  });

  it('全选第一项编码为全 a', () => {
    expect(encodeAnswers(QUESTIONS, allAnswered(0))).toBe('a'.repeat(TOTAL_QUESTIONS));
  });

  it('编码 → 解码 往返一致（覆盖全部 4 种选项）', () => {
    const answers: Answers = {};
    QUESTIONS.forEach((q, i) => {
      answers[q.id] = i % 4;
    });
    const code = encodeAnswers(QUESTIONS, answers);
    expect(decodeAnswers(QUESTIONS, code)).toEqual(answers);
  });

  it('部分作答只编码已答的题，其余为占位符', () => {
    const answers: Answers = { 1: 3, 5: 0 };
    const code = encodeAnswers(QUESTIONS, answers);
    expect(code[0]).toBe('d');
    expect(code[4]).toBe('a');
    expect(code[1]).toBe(EMPTY_CHAR);
    expect(decodeAnswers(QUESTIONS, code)).toEqual(answers);
  });

  it('非法输入返回 null，不抛异常', () => {
    expect(decodeAnswers(QUESTIONS, null)).toBeNull();
    expect(decodeAnswers(QUESTIONS, undefined)).toBeNull();
    expect(decodeAnswers(QUESTIONS, '')).toBeNull();
    expect(decodeAnswers(QUESTIONS, 'abc')).toBeNull();
    expect(decodeAnswers(QUESTIONS, 'z'.repeat(TOTAL_QUESTIONS))).toBeNull();
    expect(decodeAnswers(QUESTIONS, 'a'.repeat(TOTAL_QUESTIONS + 1))).toBeNull();
  });

  it('越界或非整数答案被当作未作答', () => {
    const code = encodeAnswers(QUESTIONS, { 1: 9, 2: -1, 3: 1.5 });
    expect(code.slice(0, 3)).toBe('---');
  });

  it('code 只包含 URL 安全字符，无需转义', () => {
    const answers: Answers = {};
    QUESTIONS.forEach((q, i) => {
      answers[q.id] = (i * 3) % 4;
    });
    const code = encodeAnswers(QUESTIONS, answers);
    expect(code).toMatch(/^[a-d-]+$/);
    expect(encodeURIComponent(code)).toBe(code);
  });

  it('isValidCode 正确判定合法与非法', () => {
    const valid = encodeAnswers(QUESTIONS, allAnswered(2));
    expect(isValidCode(QUESTIONS, valid)).toBe(true);
    expect(isValidCode(QUESTIONS, encodeAnswers(QUESTIONS, {}))).toBe(true); // 全未答也算结构合法
    expect(isValidCode(QUESTIONS, valid.slice(1))).toBe(false);
    expect(isValidCode(QUESTIONS, null)).toBe(false);
    expect(isValidCode(QUESTIONS, 'A'.repeat(TOTAL_QUESTIONS))).toBe(false); // 大写不合法
  });

  it('isCompleteCode 区分完整与部分作答', () => {
    expect(isCompleteCode(QUESTIONS, encodeAnswers(QUESTIONS, allAnswered(1)))).toBe(true);
    expect(isCompleteCode(QUESTIONS, encodeAnswers(QUESTIONS, { 1: 0 }))).toBe(false);
    expect(isCompleteCode(QUESTIONS, 'bad')).toBe(false);
  });

  it('关键回归：同一条链接任何人打开都得到同一个分数', () => {
    const answers: Answers = {};
    QUESTIONS.forEach((q, i) => {
      answers[q.id] = i % 4;
    });
    const code = encodeAnswers(QUESTIONS, answers);

    const direct = computeScore(answers);
    const fromCode = computeScore(decodeAnswers(QUESTIONS, code)!);
    expect(fromCode.total).toBe(direct.total);
    expect(fromCode.level.id).toBe(direct.level.id);
    expect(fromCode.dimensions.map((d) => d.score)).toEqual(
      direct.dimensions.map((d) => d.score),
    );
    expect(fromCode.redFlags.map((f) => f.id)).toEqual(direct.redFlags.map((f) => f.id));
  });

  it('分享链接不携带逐题文本（隐私约束）', () => {
    const answers = allAnswered(0);
    const code = encodeAnswers(QUESTIONS, answers);
    // code 里不应出现任何题干或选项文字
    for (const q of QUESTIONS) {
      expect(code).not.toContain(q.text);
      for (const option of q.options) {
        expect(code).not.toContain(option.text);
      }
    }
    expect(code).toMatch(/^[a-d-]+$/);
  });

  it('每道题都有 4 个选项，与字母表长度一致', () => {
    for (const q of QUESTIONS) {
      expect(q.options.length, `Q${q.id}`).toBe(4);
    }
    expect(QUESTION_MAP[1]).toBeDefined();
  });

  it('零依赖自检脚本全部通过', () => {
    const { passed, total, failures } = runQuizSelfTest();
    expect(failures).toEqual([]);
    expect(passed).toBe(total);
  });
});
