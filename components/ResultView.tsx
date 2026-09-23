'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

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
import { IconAlert, IconArrow, IconDownload, IconLink } from './icons';

/**
 * 结果页（客户端计算）—— 杂志专栏风 · 翻页式
 *
 * ── 为什么改成翻页 ────────────────────────────────────────────────────
 * 原来的单列长页面有 400+ 行 JSX、约 10 个区块，用户要一路下滑，
 * 关键结论（关系原型）容易被埋在中间被划过去。翻页让每屏只讲一件事，
 * 也符合"杂志内页"的隐喻——这本就是设计方向。
 *
 * ── 页序的设计意图（不是简单切块）────────────────────────────────────
 *  1 分数与等级        ← 揭晓时刻，必须独占一屏
 *  2 红线 + 雷达图      ← 红线紧邻分数，它解释了"为什么只有 45 分"
 *  3 维度明细          ← 本身就是一份数据表，独立成页
 *  4 关系原型          ← 承载最深的内容，页数最多
 *  5 信号/消耗/行动     ← 从"看见"过渡到"可以做什么"
 *  6 分享与署名        ← 结尾即转化点
 * 刻意合并：一致性提示并入第 1 页（结果的注脚，单独成页会空）；
 *          "其他可能的原型"并入第 4 页末尾（补充说明，不值得独占一屏）。
 *
 * ── 交互 ──────────────────────────────────────────────────────────────
 * 点击左右按钮、左右滑动、方向键、进度点跳转；竖向可滚动以容纳长内容。
 * 用"只挂载相邻页"的方式控制 DOM 规模——长文页全挂载会明显拖慢首屏。
 *
 * ⚠️ 隐私约束：只展示分数、称号、维度得分与红线——绝不展示她逐题选了什么。
 */
export default function ResultView({ code }: { code: string }) {
  const [cardState, setCardState] = useState<'idle' | 'working' | 'done' | 'error'>('idle');
  const [copied, setCopied] = useState(false);
  const [page, setPage] = useState(0);
  const trackedCode = useRef<string | null>(null);
  /** 用于计算滑动方向与位移 */
  const touch = useRef<{ x: number; y: number; at: number } | null>(null);

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

  const totalPages = 6;
  const go = useCallback((next: number) => {
    setPage(Math.max(0, Math.min(totalPages - 1, next)));
  }, []);

  /* 键盘导航（桌面端与无障碍） */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight' || e.key === 'PageDown') setPage((p) => Math.min(totalPages - 1, p + 1));
      if (e.key === 'ArrowLeft' || e.key === 'PageUp') setPage((p) => Math.max(0, p - 1));
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  if (!result) return null;

  const { level, redFlags, consistency, archetypes } = result;
  const primary = archetypes[0]?.archetype ?? null;
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
      track(
        'save_card',
        { score: result.total, isCapped: result.isCapped, archetypeId: primary?.id },
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

  /* 触摸滑动：横向位移大于纵向且超过阈值才翻页，避免与竖向滚动冲突 */
  const onTouchStart = (e: React.TouchEvent) => {
    const t = e.touches[0];
    touch.current = { x: t.clientX, y: t.clientY, at: Date.now() };
  };
  const onTouchEnd = (e: React.TouchEvent) => {
    const start = touch.current;
    touch.current = null;
    if (!start) return;
    const t = e.changedTouches[0];
    const dx = t.clientX - start.x;
    const dy = t.clientY - start.y;
    if (Math.abs(dx) < 60 || Math.abs(dx) < Math.abs(dy) * 1.5) return;
    go(dx < 0 ? page + 1 : page - 1);
  };

  /* 页面定义：place 决定是否渲染（只挂载当前页与相邻页，控制 DOM 规模） */
  const pages: { key: string; label: string; body: React.ReactNode }[] = [
    {
      key: 'score',
      label: '分数',
      body: (
        <div className="flex min-h-full flex-col justify-center">
          <p className="text-[10px] font-semibold tracking-[0.18em] text-rose">
            {COPY.result.scoreLabel}
          </p>
          <div className="mt-4">
            <ScoreRing score={result.total} isCapped={result.isCapped} />
          </div>

          <h1 className="mt-6 text-center font-display text-[40px] leading-tight text-ink">
            {level.title}
          </h1>
          <p className="mt-2 text-center text-[14px] font-semibold text-rose">{level.oneLiner}</p>

          <div className="mt-7 border-2 border-ink bg-white px-4 py-4">
            <p className="text-[13px] leading-[1.75] text-ink-soft">{level.description}</p>
          </div>

          {result.isCapped && (
            <p className="mt-3 flex items-start gap-2 border-2 border-ink bg-amber-tint px-3.5 py-2.5 text-[11px] leading-relaxed text-ink">
              <IconAlert size={15} className="mt-0.5 shrink-0" />
              <span>{COPY.result.cappedNotice}</span>
            </p>
          )}

          {consistency.isLow && (
            <p className="mt-3 border-2 border-ink bg-amber-tint px-3.5 py-2.5 text-[11px] leading-relaxed text-ink">
              <span className="font-semibold">{COPY.result.consistencyTitle}：</span>
              {consistency.hint}
            </p>
          )}
        </div>
      ),
    },
    {
      key: 'redflag',
      label: '红线与七维',
      body: (
        <div className="min-h-full">
          {redFlags.length > 0 && (
            <>
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
                    <p className="mt-1.5 text-[12px] leading-relaxed text-ink-soft">
                      {flag.detail}
                    </p>
                  </li>
                ))}
              </ul>
            </>
          )}

          <h2 className={`font-display text-2xl text-ink ${redFlags.length > 0 ? 'mt-8' : ''}`}>
            {COPY.result.radarTitle}
          </h2>
          <div className="mt-2 h-[3px] w-14 bg-rose-bright" />
          <div className="mt-3 border-2 border-ink bg-white px-3 py-4">
            <RadarChart dimensions={result.dimensions} />
          </div>
          <p className="mt-3 text-[11px] leading-relaxed text-ink-mute">
            七根轴的长度差得越多，说明这段关系越"偏"——不是所有维度都差，而是某些方面被牺牲了。
          </p>
        </div>
      ),
    },
    {
      key: 'dimensions',
      label: '维度明细',
      body: (
        <div className="min-h-full">
          <h2 className="font-display text-2xl text-ink">七个维度，逐项打分</h2>
          <div className="mt-2 h-[3px] w-14 bg-rose-bright" />
          <p className="mt-3 text-[11px] leading-relaxed text-ink-mute">
            排序按重要程度（权重）从高到低。带「这块最需要聊」标记的是拖分最多的一项。
          </p>

          <div className="mt-4 border-2 border-ink bg-white">
            {[...result.dimensions]
              .sort((a, b) => b.weight - a.weight)
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
                        <span className="text-[10px] text-ink-mute">权重 {dim.weight}%</span>
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
          </div>
        </div>
      ),
    },
    {
      key: 'archetype',
      label: '关系原型',
      body: (
        <div className="min-h-full">
          {primary ? (
            <>
              <h2 className="font-display text-2xl text-ink">你们更像哪一种</h2>
              <div className="mt-2 h-[3px] w-14 bg-rose-bright" />

              <div className="mt-4 border-2 border-ink bg-white">
                <div className="border-b-2 border-ink bg-rose-tint px-4 py-3.5">
                  <p className="font-display text-[26px] leading-tight text-ink">{primary.title}</p>
                  <p className="mt-1.5 text-[12px] font-semibold text-rose">{primary.oneLiner}</p>
                </div>
                <div className="space-y-3 px-4 py-4">
                  {primary.reading.map((p, i) => (
                    <p key={i} className="text-[13px] leading-[1.75] text-ink-soft">
                      {p}
                    </p>
                  ))}
                </div>
              </div>

              {archetypes.length > 1 && (
                <div className="mt-4">
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
                </div>
              )}
            </>
          ) : (
            <div className="border-2 border-ink bg-white px-4 py-4">
              <p className="text-[13px] leading-relaxed text-ink-soft">
                答的题还太少，暂时匹配不到具体的关系形态。把剩下的题答完，这一页会给出更准的解读。
              </p>
            </div>
          )}
        </div>
      ),
    },
    {
      key: 'actions',
      label: '可以做什么',
      body: (
        <div className="min-h-full">
          {primary ? (
            <>
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

              <div className="mt-6 border-2 border-ink bg-amber-tint px-4 py-4">
                <p className="flex items-center gap-2 text-[13px] font-bold text-ink">
                  <IconAlert size={16} />
                  你正在消耗什么
                </p>
                <p className="mt-2 text-[12px] leading-[1.75] text-ink">{primary.drain}</p>
              </div>

              <h2 className="mt-8 font-display text-2xl text-ink">接下来可以做的</h2>
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
            </>
          ) : (
            <>
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
                  答的题还太少，暂时给不出针对性的解读。
                </p>
              )}
            </>
          )}
        </div>
      ),
    },
    {
      key: 'share',
      label: '存下来',
      body: (
        <div className="min-h-full">
          <h2 className="font-display text-2xl text-ink">{COPY.result.shareTitle}</h2>
          <div className="mt-2 h-[3px] w-14 bg-rose-bright" />

          <div className="mt-4 border-2 border-ink bg-white px-4 py-4">
            <p className="text-[11px] leading-relaxed text-ink-mute">
              卡片只包含分数、称号和关系原型，不会显示你选的任何一题。
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

          {/*
           * 这里不再重复免责声明——底部固定栏在每一页都已经常驻，
           * 重复出现会占掉垂直空间（原先第 6 页因此留出一大块空白）。
           */}
          <div className="mt-6 border-2 border-ink bg-paper px-4 py-4">
            <p className="text-[12px] leading-relaxed text-ink-soft">
              这一页之后就没有了。如果这个结果让你想起什么，别急着下结论——
              分数只是把你在意的那些事排了个序，怎么用是你的决定。
            </p>
            <div className="mt-3.5 flex items-center gap-5">
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
          </div>

          <p className="mt-5 text-center text-[10px] text-ink-mute">{BRAND.signature}</p>
        </div>
      ),
    },
  ];

  const current = pages[page];
  const isFirst = page === 0;
  const isLast = page === totalPages - 1;

  return (
    <main className="mx-auto flex h-[100dvh] max-w-md flex-col overflow-hidden">
      {/* ── 刊头 + 页码（固定，不随内容滚动）─────────────────── */}
      <header className="shrink-0 px-5 pt-6">
        <div className="flex items-end justify-between">
          <p className="font-display text-xl leading-none text-ink">{BRAND.name}</p>
          <p className="pb-0.5 text-[10px] font-medium tracking-[0.16em] text-ink-mute">
            {String(page + 1).padStart(2, '0')} / {String(totalPages).padStart(2, '0')} ·{' '}
            {current.label}
          </p>
        </div>
        <div className="mt-2 h-[3px] bg-ink" />
        {/* 进度：点击可跳页 */}
        <div className="mt-2 flex gap-1">
          {pages.map((p, i) => (
            <button
              key={p.key}
              type="button"
              aria-label={`跳到第 ${i + 1} 页：${p.label}`}
              aria-current={i === page}
              onClick={() => go(i)}
              className={`h-1.5 flex-1 border border-ink transition-colors ${
                i <= page ? 'bg-rose-bright' : 'bg-white'
              }`}
            />
          ))}
        </div>
      </header>

      {/* ── 页面内容（可竖向滚动以容纳长内容）─────────────── */}
      <section
        className="min-h-0 flex-1 overflow-y-auto px-5 py-6"
        onTouchStart={onTouchStart}
        onTouchEnd={onTouchEnd}
      >
        {/* 只渲染相邻页：长文页全挂载会明显拖慢首屏 */}
        {pages.map((p, i) => {
          if (Math.abs(i - page) > 1) return null;
          return (
            <div key={p.key} hidden={i !== page} aria-hidden={i !== page}>
              {p.body}
            </div>
          );
        })}
      </section>

      {/* ── 底部导航（固定）───────────────────────────────── */}
      <footer className="shrink-0 border-t-2 border-ink bg-paper px-5 pb-5 pt-3">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => go(page - 1)}
            disabled={isFirst}
            aria-label="上一页"
            className="flex h-11 w-14 shrink-0 items-center justify-center border-2 border-ink bg-white text-ink transition active:translate-x-[2px] active:translate-y-[2px] disabled:opacity-30"
          >
            <IconArrow size={20} className="rotate-180" />
          </button>

          {isLast ? (
            <Link
              href="/quiz"
              className="flex h-11 flex-1 items-center justify-center border-2 border-ink bg-rose font-display text-lg text-white shadow-[4px_4px_0_var(--ink)] transition active:translate-x-[2px] active:translate-y-[2px] active:shadow-[1px_1px_0_var(--ink)]"
            >
              {COPY.result.restart}
            </Link>
          ) : (
            <button
              type="button"
              onClick={() => go(page + 1)}
              className="flex h-11 flex-1 items-center justify-between border-2 border-ink bg-rose px-5 text-white shadow-[4px_4px_0_var(--ink)] transition active:translate-x-[2px] active:translate-y-[2px] active:shadow-[1px_1px_0_var(--ink)]"
            >
              <span className="font-display text-lg">下一页</span>
              <IconArrow size={20} />
            </button>
          )}

          <button
            type="button"
            onClick={() => go(page + 1)}
            disabled={isLast}
            aria-label="下一页"
            className="flex h-11 w-14 shrink-0 items-center justify-center border-2 border-ink bg-white text-ink transition active:translate-x-[2px] active:translate-y-[2px] disabled:opacity-30"
          >
            <IconArrow size={20} />
          </button>
        </div>
        <p className="mt-2 text-center text-[10px] text-ink-mute">
          {BRAND.disclaimer}
        </p>
      </footer>
    </main>
  );
}
