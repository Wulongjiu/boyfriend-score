import Link from 'next/link';

import { QUESTIONS, TOTAL_QUESTIONS } from '../content/questions';
import { BRAND } from '../lib/brand';
import { COPY } from '../lib/copy';
import { DIMENSIONS, RED_FLAGS } from '../lib/model';
import { LEVELS } from '../lib/levels';

/**
 * 首页（服务端组件）
 *
 * 首屏 3 秒内必须让人明白：这是什么、要花多久、能得到什么。
 * "生存指数"是玩梗，所以第一句就写「他能不能活下来，先测了再说」定调，
 * 避免被读成"评判男友该不该死"。
 */
export default function Home() {
  const levelPreview = [...LEVELS].reverse();

  return (
    <main className="mx-auto max-w-md px-5 pb-16 pt-12">
      {/* 首屏 */}
      <section className="text-center">
        <p className="text-[11px] font-medium tracking-widest text-rose-500">
          {COPY.home.eyebrow}
        </p>
        <h1 className="mt-4 text-[32px] font-extrabold leading-tight text-neutral-900">
          {COPY.home.h1}
        </h1>
        <p className="mt-4 text-sm leading-relaxed text-neutral-500">{COPY.home.sub}</p>

        <Link
          href="/quiz"
          className="mt-8 block w-full rounded-2xl bg-rose-600 px-6 py-4 text-base font-semibold text-white shadow-lg shadow-rose-200 transition active:scale-[0.98]"
        >
          {COPY.home.cta}
        </Link>
        <p className="mt-2 text-[11px] text-neutral-400">{COPY.home.ctaSub}</p>
      </section>

      {/* 信任点 */}
      <section className="mt-9 grid grid-cols-3 gap-2">
        {COPY.home.trust.map((item) => (
          <div
            key={item.title}
            className="rounded-xl border border-neutral-200 bg-white p-3 text-center"
          >
            <p className="text-lg">{item.icon}</p>
            <p className="mt-1 text-xs font-medium text-neutral-800">{item.title}</p>
            <p className="mt-1 text-[10px] leading-snug text-neutral-400">{item.desc}</p>
          </div>
        ))}
      </section>

      {/* 结果预览 */}
      <section className="mt-9 rounded-2xl border border-rose-100 bg-rose-50/60 p-5">
        <p className="text-xs font-medium text-rose-500">{COPY.home.mockTitle}</p>
        <div className="mt-4 flex items-end gap-4">
          <span className="text-5xl font-extrabold tabular-nums text-rose-600">82</span>
          <div className="pb-1">
            <p className="text-base font-bold text-neutral-800">及格线以上的甜</p>
            <p className="text-xs text-neutral-500">有爱的底子，有几个地方值得聊聊</p>
          </div>
        </div>
        <ul className="mt-4 space-y-2">
          {[
            { label: '情绪价值与沟通', score: 88 },
            { label: '时间与陪伴质量', score: 75 },
            { label: '边界感与异性社交', score: 60 },
          ].map((item) => (
            <li key={item.label}>
              <div className="flex items-baseline justify-between text-[11px] text-neutral-500">
                <span>{item.label}</span>
                <span className="tabular-nums">{item.score}</span>
              </div>
              <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-white">
                <div
                  className="h-full rounded-full bg-rose-400"
                  style={{ width: `${item.score}%` }}
                />
              </div>
            </li>
          ))}
        </ul>
        <p className="mt-4 text-[11px] text-neutral-400">{COPY.home.mockNote}</p>
      </section>

      {/* 计分说明 */}
      <section className="mt-9">
        <h2 className="text-base font-semibold text-neutral-800">
          {COPY.home.sections.howTitle}
        </h2>
        <p className="mt-2 text-sm leading-relaxed text-neutral-500">
          {COPY.home.sections.howDesc}
        </p>
        <ul className="mt-4 space-y-2">
          {DIMENSIONS.map((dimension) => {
            const count = QUESTIONS.filter((q) => q.dimension === dimension.id).length;
            return (
              <li
                key={dimension.id}
                className="flex items-center justify-between gap-3 rounded-xl border border-neutral-200 bg-white px-4 py-3"
              >
                <span className="text-sm text-neutral-700">{dimension.label}</span>
                <span className="shrink-0 text-[11px] text-neutral-400">
                  {count} 题 · 权重 {dimension.weight}%
                </span>
              </li>
            );
          })}
        </ul>
        <p className="mt-3 text-[11px] leading-relaxed text-neutral-400">
          另有 {RED_FLAGS.length} 条红线：命中会让总分封顶，避免"他平时挺好"抵消掉冷暴力这类行为。
        </p>
      </section>

      {/* 等级表 */}
      <section className="mt-9">
        <h2 className="text-base font-semibold text-neutral-800">
          {COPY.home.sections.levelsTitle}
        </h2>
        <ul className="mt-4 divide-y divide-neutral-100 overflow-hidden rounded-xl border border-neutral-200 bg-white">
          {levelPreview.map((level) => (
            <li
              key={level.id}
              className="flex flex-wrap items-baseline gap-x-3 gap-y-1 px-4 py-3 text-sm"
            >
              <span className="w-14 shrink-0 tabular-nums text-[11px] text-neutral-400">
                {level.min}–
              </span>
              <span className="font-medium text-neutral-800 sm:w-36 sm:shrink-0">
                {level.title}
              </span>
              <span className="min-w-0 flex-1 text-[11px] text-neutral-500">
                {level.oneLiner}
              </span>
            </li>
          ))}
        </ul>
      </section>

      {/* FAQ */}
      <section className="mt-9">
        <h2 className="text-base font-semibold text-neutral-800">
          {COPY.home.sections.faqTitle}
        </h2>
        <div className="mt-4 space-y-4">
          {COPY.home.faq.map((item) => (
            <div key={item.q} className="rounded-xl border border-neutral-200 bg-white p-4">
              <p className="text-sm font-medium text-neutral-800">{item.q}</p>
              <p className="mt-2 text-xs leading-relaxed text-neutral-500">{item.a}</p>
            </div>
          ))}
        </div>
      </section>

      {/* 底部 CTA */}
      <section className="mt-10 text-center">
        <Link
          href="/quiz"
          className="block w-full rounded-2xl bg-rose-600 px-6 py-4 text-base font-semibold text-white shadow-lg shadow-rose-200 transition active:scale-[0.98]"
        >
          {COPY.home.finalCta}
        </Link>
        <p className="mt-3 text-[11px] text-neutral-400">{COPY.home.footerNote}</p>
      </section>

      <footer className="mt-10 border-t border-neutral-100 pt-6 text-center">
        <p className="text-[11px] leading-relaxed text-neutral-400">
          {BRAND.disclaimer}
          <br />
          共 {TOTAL_QUESTIONS} 题 · {BRAND.signature}
        </p>
      </footer>
    </main>
  );
}
