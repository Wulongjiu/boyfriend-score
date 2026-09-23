import Link from 'next/link';
import { COPY } from '../lib/copy';
import { TOTAL_QUESTIONS } from '../content/questions';

/**
 * 全局 404 / 无效链接页
 * 结果页遇到非法 code 会调用 notFound()，渲染的就是这个页面。
 * 注：404 页面不做任何跳转，因此这里不需要客户端能力，保持纯静态即可。
 */
export default function NotFound() {
  return (
    <main className="mx-auto flex min-h-[80vh] max-w-md flex-col items-center justify-center px-6 text-center">
      <p className="text-5xl">🫥</p>
      <h1 className="mt-6 text-xl font-semibold text-neutral-800">
        {COPY.common.notFoundTitle}
      </h1>
      <p className="mt-3 text-sm leading-relaxed text-neutral-600">
        {COPY.common.notFoundDesc}
      </p>
      <Link
        href="/quiz"
        className="mt-8 w-full rounded-2xl bg-rose-600 px-6 py-4 text-center text-base font-semibold text-white shadow-lg shadow-rose-200 transition active:scale-[0.98]"
      >
        {COPY.common.notFoundCta}
      </Link>
      <Link href="/" className="mt-4 text-sm text-neutral-500 underline">
        {COPY.result.backHome}
      </Link>
      <p className="mt-10 text-xs text-neutral-500">
        共 {TOTAL_QUESTIONS} 道题 · 约 3 分钟
      </p>
    </main>
  );
}
