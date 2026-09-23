import fs from 'node:fs';
import { describe, expect, it } from 'vitest';

import { RED_FLAGS } from '../lib/model';
import { ARCHETYPES } from '../lib/archetypes';
import { LEVELS } from '../lib/levels';

/**
 * 中文排印规范测试
 *
 * 为什么需要：文案里曾写成 `他回"你想多了""你又来了"`。ASCII 双引号在中文里
 * 有两个问题——连排时视觉糊成一片；得意黑对 ASCII 引号的支持不如中文标点，
 * 分享卡片上会显得突兀。统一用「」后既规范又美观。
 *
 * 这条测试防止以后有人手写文案时又混进 ASCII 引号。
 */

const DQ = String.fromCharCode(34); // ASCII 双引号

/** 提取一行里单引号字符串的内容 */
function stringLiterals(line: string): string[] {
  const out: string[] = [];
  let i = 0;
  while (i < line.length) {
    if (line[i] !== "'") {
      i += 1;
      continue;
    }
    i += 1;
    let seg = '';
    while (i < line.length) {
      if (line[i] === '\\' && i + 1 < line.length) {
        seg += line[i] + line[i + 1];
        i += 2;
        continue;
      }
      if (line[i] === "'") break;
      seg += line[i];
      i += 1;
    }
    out.push(seg);
    i += 1;
  }
  return out;
}

const COPY_FILES = [
  'lib/model.ts',
  'lib/archetypes.ts',
  'lib/levels.ts',
  'lib/advice.ts',
  'lib/copy.ts',
  'content/questions.canonical.ts',
];

describe('中文排印规范', () => {
  it('用户可见文案不含 ASCII 双引号（应用「」）', () => {
    const offenders: string[] = [];

    for (const file of COPY_FILES) {
      const lines = fs.readFileSync(file, 'utf8').split('\n');
      lines.forEach((line, i) => {
        const trimmed = line.trim();
        // 跳过注释行
        if (trimmed.startsWith('*') || trimmed.startsWith('//') || trimmed.startsWith('/*')) {
          return;
        }
        for (const literal of stringLiterals(line)) {
          if (literal.includes(DQ)) {
            offenders.push(`${file}:${i + 1}`);
            break;
          }
        }
      });
    }

    expect(offenders, `以下文件的文案含 ASCII 双引号: ${offenders.join(', ')}`).toEqual([]);
  });

  it('红牌说明用「」引用对话', () => {
    const invalidation = RED_FLAGS.find((f) => f.id === 'invalidation');
    expect(invalidation?.detail).toContain('「你想多了」');
    expect(invalidation?.detail).not.toContain(DQ);
  });

  it('原型文案用「」而非 ASCII 引号', () => {
    const withQuotes = ARCHETYPES.filter((a) =>
      [...a.reading, ...a.signals, ...a.actions, a.drain, a.oneLiner].some((t) =>
        t.includes(DQ),
      ),
    );
    expect(withQuotes.map((a) => a.id)).toEqual([]);
  });

  it('至少有一处使用中文引号（确认转换确实发生过）', () => {
    const all = [
      ...ARCHETYPES.flatMap((a) => [...a.reading, ...a.actions, a.drain]),
      ...LEVELS.map((l) => l.description),
      ...RED_FLAGS.map((f) => f.detail),
    ].join('');
    expect(all).toContain('「');
  });
});
