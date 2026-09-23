import type { Answers, Question } from './types';
import {
  codeLength,
  decodeAnswers,
  encodeAnswers,
  isCompleteCode,
  isValidCode,
} from './quiz';
import { QUESTIONS } from '../content/questions';

/**
 * 独立的断言式测试（不依赖 vitest，可用 `node scripts/test-quiz.mjs` 直接跑）
 * vitest 里也有对应的套件，这里作为"零依赖自检"保留。
 */
function assert(condition: boolean, message: string): void {
  if (!condition) throw new Error(`断言失败: ${message}`);
}

function equal<T>(actual: T, expected: T, message: string): void {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(expected);
  if (a !== e) throw new Error(`断言失败: ${message}\n  实际: ${a}\n  期望: ${e}`);
}

export function runQuizSelfTest(): { passed: number; total: number; failures: string[] } {
  const questions: readonly Question[] = QUESTIONS;
  const failures: string[] = [];
  let passed = 0;

  const cases: Array<[string, () => void]> = [
    [
      'code 长度等于题数',
      () => equal(codeLength(questions), questions.length, 'codeLength'),
    ],
    [
      '全未作答编码为全 - 号',
      () => equal(encodeAnswers(questions, {}), '-'.repeat(questions.length), '空答案编码'),
    ],
    [
      '全 A 编码为全 a',
      () => {
        const answers: Answers = {};
        for (const q of questions) answers[q.id] = 0;
        equal(encodeAnswers(questions, answers), 'a'.repeat(questions.length), '全 a');
      },
    ],
    [
      '编码后解码可还原（往返一致）',
      () => {
        const answers: Answers = {};
        questions.forEach((q, i) => {
          answers[q.id] = i % 4;
        });
        const code = encodeAnswers(questions, answers);
        equal(decodeAnswers(questions, code), answers, '往返');
      },
    ],
    [
      '越界下标被编码为未作答',
      () => {
        equal(encodeAnswers(questions, { [questions[0].id]: 9 }).slice(0, 1), '-', '越界');
      },
    ],
    [
      '非法 code（长度不符）返回 null',
      () => equal(decodeAnswers(questions, 'abc'), null, '短 code'),
    ],
    [
      '非法 code（含非法字符）返回 null',
      () => equal(decodeAnswers(questions, 'z'.repeat(questions.length)), null, '非法字符'),
    ],
    [
      'null / undefined / 空串返回 null',
      () => {
        equal(decodeAnswers(questions, null), null, 'null');
        equal(decodeAnswers(questions, undefined), null, 'undefined');
        equal(decodeAnswers(questions, ''), null, '空串');
      },
    ],
    [
      'isValidCode 正确判定',
      () => {
        assert(isValidCode(questions, 'a'.repeat(questions.length)), '合法 code');
        assert(!isValidCode(questions, 'a'.repeat(questions.length - 1)), '长度不足');
        assert(!isValidCode(questions, null), 'null');
      },
    ],
    [
      '含未作答的 code 判定为不完整',
      () => {
        const partial = encodeAnswers(questions, { [questions[0].id]: 0 });
        assert(!isCompleteCode(questions, partial), '部分作答');
      },
    ],
    [
      '完整作答的 code 判定为完整',
      () => {
        const answers: Answers = {};
        for (const q of questions) answers[q.id] = 1;
        assert(isCompleteCode(questions, encodeAnswers(questions, answers)), '完整作答');
      },
    ],
    [
      'code 只包含 URL 安全字符',
      () => {
        const answers: Answers = {};
        questions.forEach((q, i) => {
          answers[q.id] = i % 4;
        });
        const code = encodeAnswers(questions, answers);
        assert(/^[a-d-]+$/.test(code), `code 字符集: ${code}`);
        assert(encodeURIComponent(code) === code, '无需转义');
      },
    ],
  ];

  for (const [name, fn] of cases) {
    try {
      fn();
      passed += 1;
    } catch (err) {
      failures.push(`${name}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  return { passed, total: cases.length, failures };
}
