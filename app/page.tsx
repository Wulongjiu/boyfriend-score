import { QUESTIONS, TOTAL_QUESTIONS } from '../content/questions';
import { BRAND } from '../lib/brand';
import { DIMENSIONS, RED_FLAGS } from '../lib/model';
import { LEVELS } from '../lib/levels';
import { computeScore } from '../lib/scoring';

export default function Home() {
  // 用一份示例答案渲染真实的计分结果（Day 1 模型预览，真正的答题页在第 6–8 天）
  const sampleAnswers = {
    1: 0,
    2: 0,
    3: 1,
    5: 1,
    6: 0,
    7: 1,
    10: 1,
    13: 0,
    16: 1,
    21: 1,
    24: 1,
  };
  const sample = computeScore(sampleAnswers);

  return (
    <main className="mx-auto max-w-3xl px-5 py-14 text-neutral-800">
      <p className="text-xs font-medium tracking-widest text-rose-500">
        {BRAND.name} · DAY 1 模型预览
      </p>
      <h1 className="mt-3 text-3xl font-semibold leading-snug">{BRAND.tagline}</h1>
      <p className="mt-3 text-sm text-neutral-500">
        当前进度：{TOTAL_QUESTIONS} 道题 / {DIMENSIONS.length} 个维度 / {LEVELS.length} 个等级 /{' '}
        {RED_FLAGS.length} 条红线，计分逻辑已通过 46 个单元测试。
      </p>

      {/* 示例结果 */}
      <section className="mt-10 rounded-2xl border border-rose-100 bg-rose-50/50 p-6">
        <p className="text-xs text-rose-500">示例结果（只答了 11 题）</p>
        <div className="mt-2 flex items-end gap-3">
          <span className="text-6xl font-bold tabular-nums text-rose-600">
            {sample.total}
          </span>
          <div className="pb-2">
            <p className="text-lg font-semibold">{sample.level.title}</p>
            <p className="text-sm text-neutral-600">{sample.level.oneLiner}</p>
          </div>
        </div>
        <p className="mt-3 text-xs text-neutral-500">
          已答 {sample.answeredCount} / {sample.totalQuestions} 题 · 未答题目不计入分母（
          {sample.isComplete ? '已完成' : '进行中'}）
        </p>
      </section>

      {/* 维度表 */}
      <section className="mt-10">
        <h2 className="text-lg font-semibold">七个维度与权重</h2>
        <ul className="mt-4 space-y-3">
          {DIMENSIONS.map((dimension) => {
            const result = sample.dimensions.find((d) => d.id === dimension.id)!;
            const count = QUESTIONS.filter((q) => q.dimension === dimension.id).length;
            return (
              <li key={dimension.id} className="rounded-xl border border-neutral-200 p-4">
                <div className="flex items-baseline justify-between gap-3">
                  <span className="font-medium">
                    {dimension.label}
                    <span className="ml-2 text-xs text-neutral-400">
                      权重 {dimension.weight}% · {count} 题
                    </span>
                  </span>
                  <span className="tabular-nums text-sm text-neutral-500">
                    {result.answered > 0 ? `${result.score} 分` : '未答'}
                  </span>
                </div>
                <p className="mt-1 text-sm text-neutral-500">{dimension.description}</p>
                <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-neutral-100">
                  <div
                    className="h-full rounded-full bg-rose-400"
                    style={{ width: `${result.score}%` }}
                  />
                </div>
              </li>
            );
          })}
        </ul>
      </section>

      {/* 等级表 */}
      <section className="mt-10">
        <h2 className="text-lg font-semibold">六个等级</h2>
        <ul className="mt-4 divide-y divide-neutral-100 overflow-hidden rounded-xl border border-neutral-200">
          {[...LEVELS].reverse().map((level) => (
            <li key={level.id} className="flex items-baseline gap-4 px-4 py-3 text-sm">
              <span className="w-20 shrink-0 tabular-nums text-neutral-400">
                {level.min}–{level.max}
              </span>
              <span className="w-40 shrink-0 font-medium">{level.title}</span>
              <span className="text-neutral-500">{level.oneLiner}</span>
            </li>
          ))}
        </ul>
      </section>

      {/* 第一题预览 */}
      <section className="mt-10">
        <h2 className="text-lg font-semibold">第 1 题长这样</h2>
        <div className="mt-4 rounded-xl border border-neutral-200 p-5">
          <p className="font-medium">{QUESTIONS[0].text}</p>
          <ul className="mt-3 space-y-2">
            {QUESTIONS[0].options.map((option, index) => (
              <li
                key={option.text}
                className="rounded-lg border border-neutral-200 px-4 py-3 text-sm text-neutral-700"
              >
                <span className="mr-2 text-neutral-400">{'ABCD'[index]}</span>
                {option.text}
                <span className="float-right text-xs text-neutral-300">
                  {option.score} 分
                </span>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <p className="mt-12 text-xs text-neutral-400">
        Day 1 交付物已就位：定位文档 <code>docs/POSITIONING.md</code> · 题库{' '}
        <code>content/questions.ts</code> · 模型 <code>lib/model.ts</code> · 计分{' '}
        <code>lib/scoring.ts</code> · 测试 <code>tests/scoring.test.ts</code>
      </p>
    </main>
  );
}
