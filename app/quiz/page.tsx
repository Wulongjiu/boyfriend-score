'use client';

import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { QUESTIONS, TOTAL_QUESTIONS } from '../../content/questions';
import { BRAND } from '../../lib/brand';
import { COPY } from '../../lib/copy';
import { DIMENSION_MAP } from '../../lib/model';
import { encodeAnswers } from '../../lib/quiz';
import { getAnswerIndex, isQuizComplete } from '../../lib/scoring';
import { useQuizStore } from '../../lib/store';
import type { Answers } from '../../lib/types';
import { IconArrow, IconLock } from '../../components/icons';

/**
 * 答题页（一次一题）—— 杂志专栏风
 *
 * 设计要点：
 *  - 进度用黑色粗描边进度条 + 得意黑题号，强化"杂志页码"的感觉
 *  - 选项卡片：白底 + 黑描边；选中态切换为玫瑰实底 + 白字（对比度 6.26:1）
 *  - 选中后有一个「按下」的位移反馈（translate + 阴影收缩），替代廉价的高亮
 *
 * 交互取舍（保持原有行为不变）：
 *  - 进度存 localStorage，中途退出可续答
 *  - 选中后自动进入下一题，减少点击；全部答完则不再自动跳转
 *  - 允许回退修改，答完以 7 字符 code 跳转结果页（服务端零存储）
 */
export default function QuizPage() {
  const router = useRouter();
  const { answers, setAnswer, reset } = useQuizStore();

  const [index, setIndex] = useState(0);
  const [ready, setReady] = useState(false);
  const [nudge, setNudge] = useState(false);
  const advanceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const current = QUESTIONS[index];
  const answeredCount = useMemo(
    () => QUESTIONS.filter((q) => getAnswerIndex(answers ?? {}, q) !== undefined).length,
    [answers],
  );
  const complete = answers ? isQuizComplete(answers, QUESTIONS) : false;

  // 首次挂载：跳到第一个未作答的题，实现「续答」
  useEffect(() => {
    const stored: Answers = answers ?? {};
    const firstUnanswered = QUESTIONS.find((q) => getAnswerIndex(stored, q) === undefined);
    if (firstUnanswered) {
      setIndex(QUESTIONS.findIndex((q) => q.id === firstUnanswered.id));
    }
    setReady(true);
    // 只在挂载时执行一次
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    return () => {
      if (advanceTimer.current) clearTimeout(advanceTimer.current);
    };
  }, []);

  const goToResult = useCallback(
    (finalAnswers: Answers) => {
      const code = encodeAnswers(QUESTIONS, finalAnswers);
      router.push(`/r/${code}`);
    },
    [router],
  );

  const handleSelect = useCallback(
    (optionIndex: number) => {
      setNudge(false);
      const next: Answers = { ...(answers ?? {}), [current.id]: optionIndex };
      setAnswer(current.id, optionIndex);

      // 已全部答完：不自动跳题，把「看结果」的决定权交给用户
      if (isQuizComplete(next, QUESTIONS)) return;

      if (advanceTimer.current) clearTimeout(advanceTimer.current);
      advanceTimer.current = setTimeout(() => {
        const nextUnanswered = QUESTIONS.find(
          (q) => q.id !== current.id && getAnswerIndex(next, q) === undefined,
        );
        if (nextUnanswered) {
          setIndex(QUESTIONS.findIndex((q) => q.id === nextUnanswered.id));
        } else if (index < TOTAL_QUESTIONS - 1) {
          setIndex(index + 1);
        }
      }, 260);
    },
    [answers, current.id, index, setAnswer],
  );

  const handlePrev = useCallback(() => {
    setNudge(false);
    setIndex((i) => Math.max(0, i - 1));
  }, []);

  const handleNext = useCallback(() => {
    if (getAnswerIndex(answers ?? {}, current) === undefined) {
      setNudge(true);
      return;
    }
    setNudge(false);
    setIndex((i) => Math.min(TOTAL_QUESTIONS - 1, i + 1));
  }, [answers, current]);

  const handleSeeResult = useCallback(() => {
    const stored = answers ?? {};
    if (!isQuizComplete(stored, QUESTIONS)) {
      const nextUnanswered = QUESTIONS.find((q) => getAnswerIndex(stored, q) === undefined);
      if (nextUnanswered) {
        setIndex(QUESTIONS.findIndex((q) => q.id === nextUnanswered.id));
        setNudge(true);
        return;
      }
    }
    goToResult(stored);
  }, [answers, goToResult]);

  const handleRestart = useCallback(() => {
    reset();
    setIndex(0);
    setNudge(false);
  }, [reset]);

  const selected = answers ? getAnswerIndex(answers, current) : undefined;
  const isLast = index === TOTAL_QUESTIONS - 1;
  const progressPercent = (answeredCount / TOTAL_QUESTIONS) * 100;

  if (!ready) {
    return (
      <main className="mx-auto flex min-h-[60vh] max-w-md items-center justify-center px-5">
        <p className="text-sm text-ink-mute">{COPY.common.loading}</p>
      </main>
    );
  }

  return (
    <main className="mx-auto flex min-h-[100dvh] max-w-md flex-col px-5 pb-8 pt-7">
      {/* ── 进度（杂志页码感） ─────────────────────────────── */}
      <header>
        <div className="flex items-end justify-between">
          <p className="font-display text-lg leading-none text-ink">
            {String(index + 1).padStart(2, '0')}
            <span className="text-ink-mute"> / {TOTAL_QUESTIONS}</span>
          </p>
          <button
            type="button"
            onClick={handleRestart}
            className="text-[11px] text-ink-mute underline decoration-dotted underline-offset-2"
          >
            {COPY.quiz.restartHint}
          </button>
        </div>

        <div className="mt-2.5 h-2.5 border-2 border-ink bg-white">
          <div
            className="h-full bg-rose-bright transition-all duration-300"
            style={{ width: `${progressPercent}%` }}
          />
        </div>

        <p className="mt-2 text-[11px] text-ink-mute">
          {COPY.quiz.subtitle}
          {answeredCount > 0 && answeredCount < TOTAL_QUESTIONS && (
            <span className="ml-2 font-semibold text-rose">
              {COPY.quiz.resumeHint(answeredCount)}
            </span>
          )}
        </p>
      </header>

      {/* ── 题目 ──────────────────────────────────────────── */}
      <section className="mt-7 flex-1">
        <p className="text-[10px] font-semibold tracking-[0.16em] text-rose">
          {DIMENSION_MAP[current.dimension].label}
        </p>
        <h1 className="mt-2 text-[22px] font-semibold leading-snug text-ink">{current.text}</h1>

        <ul className="mt-5 space-y-3">
          {current.options.map((option, optionIndex) => {
            const isSelected = selected === optionIndex;
            return (
              <li key={option.text}>
                <button
                  type="button"
                  onClick={() => handleSelect(optionIndex)}
                  aria-pressed={isSelected}
                  className={`flex w-full items-start gap-3 border-2 border-ink px-4 py-3.5 text-left text-[14px] leading-relaxed transition ${
                    isSelected
                      ? 'translate-x-[3px] translate-y-[3px] bg-rose text-white shadow-none'
                      : 'bg-white text-ink shadow-[3px_3px_0_var(--ink)] active:translate-x-[2px] active:translate-y-[2px] active:shadow-[1px_1px_0_var(--ink)]'
                  }`}
                >
                  <span
                    className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center font-display text-[13px] ${
                      isSelected ? 'bg-white text-rose' : 'bg-ink text-paper'
                    }`}
                  >
                    {'ABCD'[optionIndex]}
                  </span>
                  <span className="min-w-0 flex-1">{option.text}</span>
                </button>
              </li>
            );
          })}
        </ul>

        {nudge && (
          <p className="mt-4 border-2 border-ink bg-amber-tint px-4 py-2.5 text-[12px] text-ink">
            这一题还没选哦，随便选一个最接近的就好。
          </p>
        )}
      </section>

      {/* ── 底部操作 ──────────────────────────────────────── */}
      <footer className="mt-7 space-y-3">
        {complete && (
          <button
            type="button"
            onClick={handleSeeResult}
            className="flex w-full items-center justify-between border-2 border-ink bg-rose px-5 py-4 text-white shadow-[5px_5px_0_var(--ink)] transition active:translate-x-[3px] active:translate-y-[3px] active:shadow-[2px_2px_0_var(--ink)]"
          >
            <span className="font-display text-xl">{COPY.quiz.seeResult}</span>
            <IconArrow size={22} />
          </button>
        )}

        <div className="flex gap-3">
          <button
            type="button"
            onClick={handlePrev}
            disabled={index === 0}
            className="flex-1 border-2 border-ink bg-white px-4 py-3 text-[13px] font-medium text-ink transition active:translate-x-[2px] active:translate-y-[2px] disabled:opacity-40 disabled:shadow-none"
          >
            {COPY.quiz.prev}
          </button>
          {!isLast && (
            <button
              type="button"
              onClick={handleNext}
              className="flex-1 border-2 border-ink bg-white px-4 py-3 text-[13px] font-medium text-ink shadow-[3px_3px_0_var(--ink)] transition active:translate-x-[2px] active:translate-y-[2px] active:shadow-[1px_1px_0_var(--ink)]"
            >
              {COPY.quiz.next}
            </button>
          )}
        </div>

        <p className="flex items-center justify-center gap-1.5 pt-1 text-[10px] text-ink-mute">
          <IconLock size={12} />
          {BRAND.name} · 答案只存在你的手机上
        </p>
      </footer>
    </main>
  );
}
