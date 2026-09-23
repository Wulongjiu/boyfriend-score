'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';

import { QUESTIONS, TOTAL_QUESTIONS } from '../content/questions';
import { BRAND } from '../lib/brand';
import { COPY } from '../lib/copy';
import { getAdviceForDimensions } from '../lib/advice';
import { DIMENSION_MAP } from '../lib/model';
import { decodeAnswers } from '../lib/quiz';
import { computeScore } from '../lib/scoring';
import { downloadBlob, renderShareCard } from '../lib/share-card';
import RadarChart from './RadarChart';
import ScoreRing from './ScoreRing';

/**
 * 结果页主体（客户端计算）
 *
 * 答案以 7 字符 code 存在 URL 里（见 lib/quiz.ts），结果由纯函数 computeScore 现算。
 * 好处：零数据库依赖、零隐私存储、链接天然可分享。
 * 约束：只展示分数、称号、维度得分与红线——绝不展示她逐题选了什么。
 */
export default function ResultView({ code }: { code: string }) {
  const [cardState, setCardState] = useState<'idle' | 'working' | 'done' | 'error'>('idle');
  const [copied, setCopied] = useState(false);

  const result = useMemo(() => {
    const answers = decodeAnswers(QUESTIONS, code);
    if (!answers) return null;
    return computeScore(answers);
  }, [code]);

  if (!result) return null;

  const { level, redFlags, consistency } = result;
  const advice = getAdviceForDimensions(result.weakestDimensions, 3);
  const lowest = result.weakestDimensions[0];

  const handleSaveCard = async () => {
    setCardState('working');
    try {
      const siteLabel = typeof window !== 'undefined' ? window.location.host : BRAND.slug;
      const blob = await renderShareCard({
        score: result.total,
        levelTitle: level.title,
        oneLiner: level.oneLiner,
        siteLabel,
        isCapped: result.isCapped,
      });
      downloadBlob(blob, `${BRAND.slug}-${result.total}.png`);
      setCardState('done');
    } catch {
      setCardState('error');
    }
  };

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  };

  return (
    <main className="mx-auto max-w-md px-5 pb-16 pt-10">
      {/* 分数 */}
      <section className="text-center">
        <p className="text-xs font-medium tracking-widest text-rose-500">
          {COPY.result.scoreLabel}
        </p>
        <div className="mt-5">
          <ScoreRing score={result.total} isCapped={result.isCapped} />
        </div>
        <h1 className="mt-6 text-2xl font-bold text-neutral-900">{level.title}</h1>
        <p className="mt-2 text-sm font-medium text-rose-600">{level.oneLiner}</p>
        {result.isCapped && (
          <p className="mx-auto mt-3 max-w-xs rounded-xl bg-rose-50 px-4 py-2 text-xs leading-relaxed text-rose-700">
            {COPY.result.cappedNotice}
          </p>
        )}
      </section>

      {/* 等级点评 */}
      <section className="mt-7 rounded-2xl border border-neutral-200 bg-white p-5">
        <p className="text-sm leading-relaxed text-neutral-600">{level.description}</p>
      </section>

      {/* 一致性提示（只提示，不扣分） */}
      {consistency.isLow && (
        <section className="mt-4 rounded-2xl bg-amber-50 p-4">
          <p className="text-xs leading-relaxed text-amber-800">
            <span className="font-medium">{COPY.result.consistencyTitle}：</span>
            {consistency.hint}
          </p>
        </section>
      )}

      {/* 红线警示 */}
      {redFlags.length > 0 && (
        <section className="mt-7 rounded-2xl border-2 border-rose-200 bg-rose-50/70 p-5">
          <h2 className="text-base font-bold text-rose-700">{COPY.result.redFlagTitle}</h2>
          <p className="mt-1 text-xs text-rose-600/80">{COPY.result.redFlagSub}</p>
          <ul className="mt-4 space-y-4">
            {redFlags.map((flag) => (
              <li key={`${flag.questionId}-${flag.id}`}>
                <p className="text-sm font-semibold text-rose-700">
                  {flag.title}
                  <span className="ml-2 text-[11px] font-normal text-rose-500/80">
                    {COPY.result.redFlagQuestionPrefix}
                    {flag.questionId}
                    {COPY.result.redFlagQuestionSuffix}
                  </span>
                </p>
                <p className="mt-1 text-xs leading-relaxed text-neutral-600">{flag.detail}</p>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* 雷达图 */}
      <section className="mt-7 rounded-2xl border border-neutral-200 bg-white p-4">
        <h2 className="px-1 text-base font-semibold text-neutral-800">
          {COPY.result.radarTitle}
        </h2>
        <div className="mt-2">
          <RadarChart dimensions={result.dimensions} />
        </div>
      </section>

      {/* 维度明细 */}
      <section className="mt-4 space-y-3">
        {[...result.dimensions]
          .sort((a, b) => b.score - a.score)
          .map((dim) => {
            const isLowest = dim.id === lowest;
            return (
              <div
                key={dim.id}
                className={`rounded-xl border p-4 ${
                  isLowest ? 'border-rose-200 bg-rose-50/40' : 'border-neutral-200 bg-white'
                }`}
              >
                <div className="flex items-baseline justify-between gap-3">
                  <span className="text-sm font-medium text-neutral-800">
                    {dim.label}
                    {isLowest && (
                      <span className="ml-2 rounded-full bg-rose-600 px-2 py-0.5 text-[10px] font-normal text-white">
                        {COPY.result.dimensionLowTag}
                      </span>
                    )}
                  </span>
                  <span className="shrink-0 tabular-nums text-sm text-neutral-500">
                    {Math.round(dim.score)}
                  </span>
                </div>
                <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-neutral-100">
                  <div
                    className={`h-full rounded-full ${isLowest ? 'bg-rose-500' : 'bg-rose-300'}`}
                    style={{ width: `${dim.score}%` }}
                  />
                </div>
                <p className="mt-2 text-xs leading-relaxed text-neutral-500">
                  {DIMENSION_MAP[dim.id].description}
                </p>
              </div>
            );
          })}
      </section>

      {/* 建议 */}
      <section className="mt-7 rounded-2xl border border-neutral-200 bg-white p-5">
        <h2 className="text-base font-semibold text-neutral-800">{COPY.result.adviceTitle}</h2>
        <ul className="mt-4 space-y-3">
          {advice.map((item, i) => (
            <li key={item} className="flex gap-3 text-sm leading-relaxed text-neutral-600">
              <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-rose-100 text-[11px] font-semibold text-rose-600">
                {i + 1}
              </span>
              <span>{item}</span>
            </li>
          ))}
        </ul>
      </section>

      {/* 分享 */}
      <section className="mt-7 rounded-2xl bg-neutral-900 p-5 text-white">
        <h2 className="text-base font-semibold">{COPY.result.shareTitle}</h2>
        <p className="mt-1 text-xs text-neutral-400">
          卡片只包含分数和称号，不会显示你选的任何一题。
        </p>
        <div className="mt-4 space-y-3">
          <button
            type="button"
            onClick={handleSaveCard}
            disabled={cardState === 'working'}
            className="w-full rounded-xl bg-rose-600 px-5 py-3.5 text-sm font-semibold text-white transition active:scale-[0.98] disabled:opacity-60"
          >
            {cardState === 'working'
              ? COPY.result.savingCard
              : cardState === 'done'
                ? '✓ 已保存到相册'
                : COPY.result.saveCard}
          </button>
          <button
            type="button"
            onClick={handleCopyLink}
            className="w-full rounded-xl border border-neutral-700 px-5 py-3 text-sm font-medium text-neutral-200 transition active:scale-[0.98]"
          >
            {copied ? COPY.result.copied : COPY.result.copyLink}
          </button>
          {cardState === 'error' && (
            <p className="text-xs text-rose-400">
              生成图片失败，可以截图保存这一页，效果一样。
            </p>
          )}
        </div>
      </section>

      {/* 底部 */}
      <div className="mt-8 flex flex-col items-center gap-3">
        <Link href="/quiz" className="text-sm font-medium text-rose-600 underline">
          {COPY.result.restart}
        </Link>
        <Link href="/" className="text-xs text-neutral-400">
          {COPY.result.backHome}
        </Link>
      </div>

      <p className="mt-8 text-center text-[11px] leading-relaxed text-neutral-400">
        {COPY.result.disclaimer}
        <br />
        共 {TOTAL_QUESTIONS} 题 · {BRAND.signature}
      </p>
    </main>
  );
}
