'use client';

import Link from 'next/link';
import { useEffect, useMemo, useRef, useState } from 'react';

import { QUESTIONS, TOTAL_QUESTIONS } from '../content/questions';
import { BRAND } from '../lib/brand';
import { COPY } from '../lib/copy';
import { getAdviceForDimensions } from '../lib/advice';
import { DIMENSION_MAP } from '../lib/model';
import { decodeAnswers } from '../lib/quiz';
import { computeScore } from '../lib/scoring';
import { track } from '../lib/analytics';
import { downloadBlob, renderShareCard } from '../lib/share-card';
import RadarChart from './RadarChart';
import ScoreRing from './ScoreRing';
import { IconAlert, IconDownload, IconLink } from './icons';

/**
 * 结果页主体（客户端计算）—— 杂志专栏风
 *
 * 答案以 7 字符 code 存在 URL 里（见 lib/quiz.ts），结果由纯函数 computeScore 现算。
 * 好处：零数据库依赖、零隐私存储、链接天然可分享。
 *
 * ⚠️ 隐私约束：只展示分数、称号、维度得分与红线——绝不展示她逐题选了什么。
 */
export default function ResultView({ code }: { code: string }) {
  const [cardState, setCardState] = useState<'idle' | 'working' | 'done' | 'error'>('idle');
  const [copied, setCopied] = useState(false);
  /** 已上报过 view_result 的 code：避免同一次访问重复计数 */
  const trackedCode = useRef<string | null>(null);

  const result = useMemo(() => {
    const answers = decodeAnswers(QUESTIONS, code);
    if (!answers) return null;
    return computeScore(answers);
  }, [code]);

  /* 埋点：结果页曝光（漏斗第四步），带分数与命中的原型 id */
  useEffect(() => {
    if (!result) return;
    if (trackedCode.current === code) return;
    trackedCode.current = code;
    track('view_result', {
      score: result.total,
      isCapped: result.isCapped,
      archetypeId: result.archetypes[0]?.archetype.id,
    });
  }, [code, result]);

  if (!result) return null;

  const { level, redFlags, consistency, archetypes } = result;
  // 主原型：结合多维度给出的具体处境解读
  const primary = archetypes[0]?.archetype ?? null;
  // 兜底建议：只在没有任何原型命中时使用（例如作答太少）
  const fallbackAdvice = getAdviceForDimensions(result.weakestDimensions, 3);
  const lowest = result.weakestDimensions[0];

  const handleSaveCard = async () => {
    setCardState('working');
    try {
      const siteLabel = typeof window !== 'undefined' ? window.location.host : BRAND.slug;
      const blob = await renderShareCard({
        score: result.total,
        archetypeTitle: primary?.title ?? level.title,
        oneLiner: primary?.oneLiner ?? level.oneLiner,
        levelTitle: level.title,
        siteLabel,
        isCapped: result.isCapped,
      });
      downloadBlob(blob, `${BRAND.slug}-${result.total}.png`);
      setCardState('done');
      // 埋点：分享率分子。用 beacon 确保下载触发的离开也能送达
      track(
        'save_card',
        {
          score: result.total,
          isCapped: result.isCapped,
          archetypeId: primary?.id,
        },
        { beacon: true },
      );
    } catch {
      setCardState('error');
    }
  };

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      track('copy_link', { score: result.total }, { beacon: true });
    } catch {
      setCopied(false);
    }
  };

  return (
    <main className="mx-auto max-w-md px-5 pb-16">
      {/* ── 刊头 ───────────────────────────────────────────── */}
      <header className="pt-8">
        <div className="flex items-end justify-between">
          <p className="font-display text-xl leading-none text-ink">{BRAND.name}</p>
          <p className="pb-0.5 text-[10px] font-medium tracking-[0.16em] text-ink-mute">
            测评报告
          </p>
        </div>
        <div className="mt-2 h-[3px] bg-ink" />
      </header>

      {/* ── 分数 ───────────────────────────────────────────── */}
      <section className="pt-7 text-center">
        <p className="text-[10px] font-semibold tracking-[0.18em] text-rose">
          {COPY.result.scoreLabel}
        </p>
        <div className="mt-4">
          <ScoreRing score={result.total} isCapped={result.isCapped} />
        </div>

        <h1 className="mt-5 font-display text-[38px] leading-tight text-ink">{level.title}</h1>
        <p className="mt-1.5 text-[14px] font-semibold text-rose">{level.oneLiner}</p>

        {result.isCapped && (
          <p className="mx-auto mt-4 flex max-w-xs items-start gap-2 border-2 border-ink bg-amber-tint px-3.5 py-2.5 text-left text-[11px] leading-relaxed text-ink">
            <IconAlert size={15} className="mt-0.5 shrink-0" />
            <span>{COPY.result.cappedNotice}</span>
          </p>
        )}
      </section>

      {/* ── 等级点评 ───────────────────────────────────────── */}
      <section className="mt-7 border-2 border-ink bg-white px-4 py-4">
        <p className="text-[13px] leading-relaxed text-ink-soft">{level.description}</p>
      </section>

      {/* ── 一致性提示（只提示，不扣分） ───────────────────── */}
      {consistency.isLow && (
        <section className="mt-3 border-2 border-ink bg-amber-tint px-4 py-3">
          <p className="text-[12px] leading-relaxed text-ink">
            <span className="font-semibold">{COPY.result.consistencyTitle}：</span>
            {consistency.hint}
          </p>
        </section>
      )}

      {/* ── 红线警示 ───────────────────────────────────────── */}
      {redFlags.length > 0 && (
        <section className="mt-7">
          <div className="border-2 border-ink bg-rose px-4 py-3 text-white">
            <h2 className="flex items-center gap-2 font-display text-xl">
              <IconAlert size={20} />
              {COPY.result.redFlagTitle}
            </h2>
            <p className="mt-1 text-[11px] text-white/90">{COPY.result.redFlagSub}</p>
          </div>

          <ul className="border-2 border-t-0 border-ink bg-white">
            {redFlags.map((flag, i) => (
              <li
                key={`${flag.questionId}-${flag.id}`}
                className={`px-4 py-3.5 ${i > 0 ? 'border-t-2 border-ink' : ''}`}
              >
                <p className="flex items-baseline gap-2">
                  <span className="text-[14px] font-bold text-ink">{flag.title}</span>
                  <span className="text-[10px] text-ink-mute">
                    {COPY.result.redFlagQuestionPrefix}
                    {flag.questionId}
                    {COPY.result.redFlagQuestionSuffix}
                  </span>
                </p>
                <p className="mt-1.5 text-[12px] leading-relaxed text-ink-soft">{flag.detail}</p>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* ── 雷达图 ─────────────────────────────────────────── */}
      <section className="mt-8">
        <h2 className="font-display text-2xl text-ink">{COPY.result.radarTitle}</h2>
        <div className="mt-2 h-[3px] w-14 bg-rose-bright" />
        <div className="mt-3 border-2 border-ink bg-white px-3 py-4">
          <RadarChart dimensions={result.dimensions} />
        </div>
      </section>

      {/* ── 维度明细 ───────────────────────────────────────── */}
      <section className="mt-4 border-2 border-ink bg-white">
        {[...result.dimensions]
          .sort((a, b) => b.score - a.score)
          .map((dim, i) => {
            const isLowest = dim.id === lowest;
            return (
              <div
                key={dim.id}
                className={`px-4 py-3.5 ${i > 0 ? 'border-t-2 border-ink' : ''} ${
                  isLowest ? 'bg-rose-tint' : ''
                }`}
              >
                <div className="flex items-baseline justify-between gap-3">
                  <span className="flex flex-wrap items-baseline gap-2">
                    <span className="text-[13px] font-semibold text-ink">{dim.label}</span>
                    {isLowest && (
                      <span className="border-2 border-ink bg-ink px-1.5 py-px text-[9px] font-semibold text-paper">
                        {COPY.result.dimensionLowTag}
                      </span>
                    )}
                  </span>
                  <span className="shrink-0 font-display text-lg tabular-nums text-ink">
                    {Math.round(dim.score)}
                  </span>
                </div>
                <div className="mt-2 h-2 border-2 border-ink bg-white">
                  <div
                    className={`h-full ${isLowest ? 'bg-rose-bright' : 'bg-ink'}`}
                    style={{ width: `${dim.score}%` }}
                  />
                </div>
                <p className="mt-2 text-[11px] leading-snug text-ink-mute">
                  {DIMENSION_MAP[dim.id].description}
                </p>
              </div>
            );
          })}
      </section>

      {/* ── 关系原型：本页的核心结论 ───────────────────────── */}
      {primary ? (
        <>
          <section className="mt-8">
            <h2 className="font-display text-2xl text-ink">你们更像哪一种</h2>
            <div className="mt-2 h-[3px] w-14 bg-rose-bright" />

            <div className="mt-4 border-2 border-ink bg-white">
              {/* 原型标题：这是她要截图分享的那一句 */}
              <div className="border-b-2 border-ink bg-rose-tint px-4 py-3.5">
                <p className="font-display text-[26px] leading-tight text-ink">
                  {primary.title}
                </p>
                <p className="mt-1.5 text-[12px] font-semibold text-rose">{primary.oneLiner}</p>
              </div>

              {/* 完整解读：多段，不压缩 */}
              <div className="space-y-3 px-4 py-4">
                {primary.reading.map((p, i) => (
                  <p key={i} className="text-[13px] leading-[1.75] text-ink-soft">
                    {p}
                  </p>
                ))}
              </div>
            </div>
          </section>

          {/* 其他可能贴合的原型（帮她对号入座） */}
          {archetypes.length > 1 && (
            <section className="mt-4">
              <p className="text-[11px] text-ink-mute">另外两种情况，你也可以对照看看：</p>
              <ul className="mt-2 space-y-2">
                {archetypes.slice(1).map(({ archetype }) => (
                  <li key={archetype.id} className="border-2 border-ink bg-white px-4 py-3">
                    <p className="text-[13px] font-semibold text-ink">{archetype.title}</p>
                    <p className="mt-1 text-[11px] leading-relaxed text-ink-mute">
                      {archetype.oneLiner}
                    </p>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {/* 三个信号 */}
          <section className="mt-8">
            <h2 className="font-display text-2xl text-ink">可以留意的三个信号</h2>
            <div className="mt-2 h-[3px] w-14 bg-rose-bright" />
            <ul className="mt-4 border-2 border-ink bg-white">
              {primary.signals.map((s, i) => (
                <li
                  key={s}
                  className={`flex gap-3 px-4 py-3 ${i > 0 ? 'border-t-2 border-ink' : ''}`}
                >
                  <span className="font-display shrink-0 text-base leading-snug text-rose">
                    {i + 1}
                  </span>
                  <span className="text-[12px] leading-relaxed text-ink-soft">{s}</span>
                </li>
              ))}
            </ul>
          </section>

          {/* 正在消耗什么：情绪价值的核心，单独成块 */}
          <section className="mt-6 border-2 border-ink bg-amber-tint px-4 py-4">
            <p className="flex items-center gap-2 text-[13px] font-bold text-ink">
              <IconAlert size={16} />
              你正在消耗什么
            </p>
            <p className="mt-2 text-[12px] leading-[1.75] text-ink">{primary.drain}</p>
          </section>

          {/* 可以怎么做 */}
          <section className="mt-8">
            <h2 className="font-display text-2xl text-ink">接下来可以做的</h2>
            <div className="mt-2 h-[3px] w-14 bg-rose-bright" />
            <ul className="mt-4 space-y-3">
              {primary.actions.map((item, i) => (
                <li key={item} className="flex gap-3 border-2 border-ink bg-white px-4 py-3">
                  <span className="font-display mt-px shrink-0 text-lg leading-none text-rose">
                    {i + 1}
                  </span>
                  <span className="text-[12px] leading-relaxed text-ink-soft">{item}</span>
                </li>
              ))}
            </ul>
          </section>
        </>
      ) : (
        /* 兜底：作答太少或没有原型命中时，按最弱维度给通用建议 */
        <section className="mt-8">
          <h2 className="font-display text-2xl text-ink">{COPY.result.adviceTitle}</h2>
          <div className="mt-2 h-[3px] w-14 bg-rose-bright" />
          {fallbackAdvice.length > 0 ? (
            <ul className="mt-4 space-y-3">
              {fallbackAdvice.map((item, i) => (
                <li key={item} className="flex gap-3 border-2 border-ink bg-white px-4 py-3">
                  <span className="font-display mt-px shrink-0 text-lg leading-none text-rose">
                    {i + 1}
                  </span>
                  <span className="text-[12px] leading-relaxed text-ink-soft">{item}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-4 border-2 border-ink bg-white px-4 py-3 text-[12px] leading-relaxed text-ink-soft">
              答的题还太少，暂时给不出针对性的解读。把剩下的题答完，结果会更准。
            </p>
          )}
        </section>
      )}

      {/* ── 分享 ───────────────────────────────────────────── */}
      <section className="mt-8">
        <h2 className="font-display text-2xl text-ink">{COPY.result.shareTitle}</h2>
        <div className="mt-2 h-[3px] w-14 bg-rose-bright" />

        <div className="mt-4 border-2 border-ink bg-white px-4 py-4">
          <p className="text-[11px] leading-relaxed text-ink-mute">
            卡片只包含分数和称号，不会显示你选的任何一题。
          </p>

          <div className="mt-3.5 space-y-3">
            <button
              type="button"
              onClick={handleSaveCard}
              disabled={cardState === 'working'}
              className="flex w-full items-center justify-between border-2 border-ink bg-rose px-4 py-3.5 text-white shadow-[4px_4px_0_var(--ink)] transition active:translate-x-[2px] active:translate-y-[2px] active:shadow-[1px_1px_0_var(--ink)] disabled:opacity-60"
            >
              <span className="font-display text-lg">
                {cardState === 'working'
                  ? COPY.result.savingCard
                  : cardState === 'done'
                    ? '已保存到相册'
                    : COPY.result.saveCard}
              </span>
              <IconDownload size={20} />
            </button>

            <button
              type="button"
              onClick={handleCopyLink}
              className="flex w-full items-center justify-between border-2 border-ink bg-white px-4 py-3 text-ink transition active:translate-x-[2px] active:translate-y-[2px]"
            >
              <span className="text-[13px] font-medium">
                {copied ? COPY.result.copied : COPY.result.copyLink}
              </span>
              <IconLink size={18} />
            </button>

            {cardState === 'error' && (
              <p className="text-[11px] text-rose">
                生成图片失败，可以截图保存这一页，效果一样。
              </p>
            )}
          </div>
        </div>
      </section>

      {/* ── 底部 ───────────────────────────────────────────── */}
      <div className="mt-8 flex items-center justify-center gap-5">
        <Link
          href="/quiz"
          className="text-[13px] font-semibold text-rose underline decoration-2 underline-offset-4"
        >
          {COPY.result.restart}
        </Link>
        <Link href="/" className="text-[12px] text-ink-mute underline underline-offset-4">
          {COPY.result.backHome}
        </Link>
      </div>

      <footer className="mt-8 border-t-2 border-ink pt-5">
        <p className="text-center text-[11px] leading-relaxed text-ink-mute">
          {COPY.result.disclaimer}
          <br />
          共 {TOTAL_QUESTIONS} 题 · {BRAND.signature}
        </p>
      </footer>
    </main>
  );
}
