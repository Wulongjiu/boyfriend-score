import Link from 'next/link';
import { COPY } from '../lib/copy';
import { TOTAL_QUESTIONS } from '../content/questions';
import { BRAND } from '../lib/brand';

/**
 * 全局 404 / 无效链接页 —— 杂志专栏风
 * 结果页遇到非法 code 会调用 notFound()，渲染的就是这个页面。
 * 纯静态，无客户端 JS。
 */
export default function NotFound() {
  return (
    <main className="mx-auto max-w-md px-5 pb-16">
      <header className="pt-9">
        <div className="flex items-end justify-between">
          <p className="font-display text-xl leading-none text-ink">{BRAND.name}</p>
          <p className="pb-0.5 text-[10px] font-medium tracking-[0.16em] text-ink-mute">
            404
          </p>
        </div>
        <div className="mt-2 h-[3px] bg-ink" />
      </header>

      <section className="flex min-h-[62vh] flex-col justify-center">
        <p className="font-display text-[92px] leading-none text-rose">404</p>
        <h1 className="mt-4 text-[20px] font-semibold leading-snug text-ink">
          {COPY.common.notFoundTitle}
        </h1>
        <p className="mt-3 text-[13px] leading-relaxed text-ink-soft">
          {COPY.common.notFoundDesc}
        </p>

        <Link
          href="/quiz"
          className="mt-8 block w-full border-2 border-ink bg-rose px-5 py-4 text-center font-display text-xl text-white shadow-[5px_5px_0_var(--ink)] transition active:translate-x-[3px] active:translate-y-[3px] active:shadow-[2px_2px_0_var(--ink)]"
        >
          {COPY.common.notFoundCta}
        </Link>
        <Link
          href="/"
          className="mt-4 text-center text-[12px] text-ink-mute underline underline-offset-4"
        >
          {COPY.result.backHome}
        </Link>
      </section>

      <footer className="border-t-2 border-ink pt-5">
        <p className="text-center text-[11px] text-ink-mute">
          共 {TOTAL_QUESTIONS} 道题 · 约 3 分钟
        </p>
      </footer>
    </main>
  );
}
