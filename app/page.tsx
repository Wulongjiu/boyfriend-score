import Link from 'next/link';

import { QUESTIONS, TOTAL_QUESTIONS } from '../content/questions';
import { BRAND } from '../lib/brand';
import { COPY } from '../lib/copy';
import { DIMENSIONS, RED_FLAGS } from '../lib/model';
import { LEVELS } from '../lib/levels';
import { IconAlert, IconArrow, IconChart, IconLock, IconTimer } from '../components/icons';

/**
 * 首页（服务端组件）—— 杂志专栏风
 *
 * 设计要点（对应 skill 的 Design Dials：VARIANCE 6 / DENSITY 4）：
 *  - 刊头（masthead）+ 玫瑰色分隔线：建立"这是一本杂志／一份专栏"的第一印象
 *  - 标题左对齐、超大字号（得意黑），刻意不做居中式 hero
 *  - 粗黑描边 + 硬投影替代柔和的圆角阴影，避免"通用 AI 卡片"质感
 *  - 图标用 SVG 而非 emoji：得意黑缺 emoji 字形，且 emoji 跨平台不一致
 *
 * 服务端渲染：不引入任何客户端 JS，首屏体积最小。
 */
const TRUST_ICONS = [IconLock, IconTimer, IconChart] as const;

export default function Home() {
  const levelPreview = [...LEVELS].reverse();

  return (
    <main className="mx-auto max-w-md px-5 pb-16">
      {/* ── 刊头 ───────────────────────────────────────────── */}
      <header className="pt-9">
        <div className="flex items-end justify-between">
          <p className="font-display text-2xl leading-none text-ink">{BRAND.name}</p>
          <p className="pb-0.5 text-[10px] font-medium tracking-[0.18em] text-ink-mute">
            NO.{String(TOTAL_QUESTIONS).padStart(2, '0')}
          </p>
        </div>
        <div className="mt-2.5 h-[3px] bg-ink" />
        <div className="mt-1 flex items-center justify-between text-[10px] tracking-[0.14em] text-ink-mute">
          <span>恋爱关系观察</span>
          <span>娱乐向</span>
        </div>
      </header>

      {/* ── 首屏 ───────────────────────────────────────────── */}
      <section className="pt-8">
        <p className="inline-block border-2 border-ink bg-amber-tint px-2.5 py-1 text-[11px] font-semibold tracking-wide text-ink">
          {TOTAL_QUESTIONS} 道题 · 3 分钟 · 不用注册
        </p>

        <h1 className="mt-5 font-display text-[46px] leading-[1.06] tracking-tight text-ink">
          他能不能
          <br />
          活下来，
          <br />
          <span className="text-rose">先测了再说。</span>
        </h1>

        <p className="mt-5 text-[15px] leading-relaxed text-ink-soft">{COPY.home.sub}</p>

        <Link
          href="/quiz"
          className="mt-7 flex w-full items-center justify-between border-2 border-ink bg-rose px-5 py-4 text-white shadow-[5px_5px_0_var(--ink)] transition active:translate-x-[3px] active:translate-y-[3px] active:shadow-[2px_2px_0_var(--ink)]"
        >
          <span className="font-display text-xl">{COPY.home.cta}</span>
          <IconArrow size={22} />
        </Link>
        <p className="mt-3 text-center text-[11px] text-ink-mute">{COPY.home.ctaSub}</p>
      </section>

      {/* ── 信任点 ─────────────────────────────────────────── */}
      <section className="mt-9 border-y-2 border-ink py-4">
        <ul className="space-y-3">
          {COPY.home.trust.map((item, i) => {
            const Icon = TRUST_ICONS[i] ?? IconLock;
            return (
              <li key={item.title} className="flex items-start gap-3">
                <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center border-2 border-ink bg-paper text-ink">
                  <Icon size={15} />
                </span>
                <span className="min-w-0">
                  <span className="text-[13px] font-semibold text-ink">{item.title}</span>
                  <span className="ml-2 text-[12px] text-ink-mute">{item.desc}</span>
                </span>
              </li>
            );
          })}
        </ul>
      </section>

      {/* ── 结果预览 ───────────────────────────────────────── */}
      <section className="mt-9">
        <p className="text-[10px] font-semibold tracking-[0.16em] text-ink-mute">
          {COPY.home.mockTitle}
        </p>

        <div className="mt-3 border-2 border-ink bg-white shadow-[5px_5px_0_var(--ink)]">
          <div className="flex items-center justify-between border-b-2 border-ink bg-rose-tint px-4 py-2">
            <span className="text-[11px] font-semibold text-ink">示例结果</span>
            <span className="text-[10px] text-ink-mute">{COPY.home.mockNote}</span>
          </div>

          <div className="flex items-end gap-4 px-4 pt-4">
            <span className="font-display text-[64px] leading-[0.85] text-ink">82</span>
            <span className="pb-1">
              <span className="block text-[13px] font-bold text-ink">及格线以上的甜</span>
              <span className="mt-0.5 block text-[11px] text-ink-mute">
                有爱的底子，有几个地方值得聊聊
              </span>
            </span>
          </div>

          <ul className="mt-4 space-y-2.5 px-4 pb-4">
            {[
              { label: '情绪价值与沟通', score: 88 },
              { label: '时间与陪伴质量', score: 75 },
              { label: '边界感与异性社交', score: 60 },
            ].map((item) => (
              <li key={item.label}>
                <div className="flex items-baseline justify-between text-[11px] text-ink-soft">
                  <span>{item.label}</span>
                  <span className="tabular-nums font-semibold">{item.score}</span>
                </div>
                <div className="mt-1 h-2 border-2 border-ink bg-white">
                  <div className="h-full bg-rose-bright" style={{ width: `${item.score}%` }} />
                </div>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* ── 计分说明 ───────────────────────────────────────── */}
      <section className="mt-10">
        <h2 className="font-display text-2xl text-ink">{COPY.home.sections.howTitle}</h2>
        <div className="mt-2 h-[3px] w-14 bg-rose-bright" />
        <p className="mt-4 text-[13px] leading-relaxed text-ink-soft">
          {COPY.home.sections.howDesc}
        </p>

        <ul className="mt-5 divide-y-2 divide-ink border-2 border-ink">
          {DIMENSIONS.map((dimension, i) => {
            const count = QUESTIONS.filter((q) => q.dimension === dimension.id).length;
            return (
              <li
                key={dimension.id}
                className="flex items-center gap-3 bg-white px-3.5 py-3"
              >
                <span className="font-display w-6 shrink-0 text-lg text-rose-bright">
                  {i + 1}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-[13px] font-semibold text-ink">
                    {dimension.label}
                  </span>
                  <span className="mt-0.5 block text-[11px] leading-snug text-ink-mute">
                    {dimension.description}
                  </span>
                </span>
                <span className="shrink-0 text-right">
                  <span className="block font-display text-base text-ink">
                    {dimension.weight}%
                  </span>
                  <span className="block text-[10px] text-ink-mute">{count} 题</span>
                </span>
              </li>
            );
          })}
        </ul>

        <p className="mt-3 flex items-start gap-2 border-2 border-ink bg-amber-tint px-3.5 py-3 text-[11px] leading-relaxed text-ink">
          <IconAlert size={15} className="mt-0.5 shrink-0" />
          <span>
            另有 {RED_FLAGS.length} 条红线：命中会让总分封顶，避免"他平时挺好"抵消掉冷暴力这类行为。
          </span>
        </p>
      </section>

      {/* ── 等级表 ─────────────────────────────────────────── */}
      <section className="mt-10">
        <h2 className="font-display text-2xl text-ink">{COPY.home.sections.levelsTitle}</h2>
        <div className="mt-2 h-[3px] w-14 bg-rose-bright" />
        <ul className="mt-5 border-2 border-ink">
          {levelPreview.map((level, i) => (
            <li
              key={level.id}
              className={`flex flex-wrap items-baseline gap-x-3 gap-y-1 px-3.5 py-3 ${
                i > 0 ? 'border-t-2 border-ink' : ''
              } ${i === levelPreview.length - 1 ? 'bg-rose-tint' : 'bg-white'}`}
            >
              <span className="w-16 shrink-0 font-display text-[15px] tabular-nums text-ink">
                {level.min}–{level.max}
              </span>
              <span className="text-[13px] font-semibold text-ink">{level.title}</span>
              <span className="min-w-0 flex-1 text-[11px] leading-snug text-ink-mute">
                {level.oneLiner}
              </span>
            </li>
          ))}
        </ul>
      </section>

      {/* ── FAQ ───────────────────────────────────────────── */}
      <section className="mt-10">
        <h2 className="font-display text-2xl text-ink">{COPY.home.sections.faqTitle}</h2>
        <div className="mt-2 h-[3px] w-14 bg-rose-bright" />
        <div className="mt-5 space-y-3">
          {COPY.home.faq.map((item) => (
            <div key={item.q} className="border-2 border-ink bg-white px-3.5 py-3">
              <p className="text-[13px] font-semibold text-ink">{item.q}</p>
              <p className="mt-1.5 text-[12px] leading-relaxed text-ink-soft">{item.a}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── 底部 CTA ───────────────────────────────────────── */}
      <section className="mt-11">
        <Link
          href="/quiz"
          className="flex w-full items-center justify-between border-2 border-ink bg-rose px-5 py-4 text-white shadow-[5px_5px_0_var(--ink)] transition active:translate-x-[3px] active:translate-y-[3px] active:shadow-[2px_2px_0_var(--ink)]"
        >
          <span className="font-display text-xl">{COPY.home.finalCta}</span>
          <IconArrow size={22} />
        </Link>
        <p className="mt-3 text-center text-[11px] text-ink-mute">{COPY.home.footerNote}</p>
      </section>

      <footer className="mt-9 border-t-2 border-ink pt-5">
        <p className="text-center text-[11px] leading-relaxed text-ink-mute">
          {BRAND.disclaimer}
          <br />
          共 {TOTAL_QUESTIONS} 题 · {BRAND.signature}
        </p>
      </footer>
    </main>
  );
}
