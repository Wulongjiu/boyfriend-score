'use client';

import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { QUESTIONS, TOTAL_QUESTIONS } from '../../content/questions';
import { BRAND } from '../../lib/brand';
import { COPY } from '../../lib/copy';
import { encodeAnswers } from '../../lib/quiz';
import { getAnswerIndex, isQuizComplete } from '../../lib/scoring';
import { DIMENSION_MAP } from '../../lib/model';
import { useQuizStore } from '../../lib/store';
import type { Answers } from '../../lib/types';

/**
 * 答题页（一次一题）
 *
 * 关键取舍：
 *  - 进度存 localStorage，中途退出可续答（比"必须一次答完"的完成率高很多）
 *  - 选中后自动进入下一题，减少点击次数；最后一题改为点「看结果」
 *  - 允许回退修改，但一旦全部答完就不再自动跳转，避免覆盖用户想改的答案
 *  - 答完后以 7 字符 code 跳转结果页（服务端零存储，见 lib/quiz.ts）
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

  // 首次挂载：跳到第一个未作答的题，实现"续答"
  useEffect(() => {
    const stored: Answers = answers ?? {};
    const firstUnanswered = QUESTIONS.find(
      (q) => getAnswerIndex(stored, q) === undefined,
    );
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

      // 已经全部答完：不再自动跳题，把"看结果"的决定权交给用户
      if (isQuizComplete(next, QUESTIONS)) return;

      if (advanceTimer.current) clearTimeout(advanceTimer.current);
      advanceTimer.current = setTimeout(() => {
        // 跳到下一道未作答的题（跳过已经答过的）
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

  // 未挂载完成前不渲染题目，避免 hydration 闪烁
  if (!ready) {
    return (
      <main className="mx-auto flex min-h-[60vh] max-w-md items-center justify-center px-5">
        <p className="text-sm text-neutral-500">{COPY.common.loading}</p>
      </main>
    );
  }

  return (
    <main className="mx-auto flex min-h-[100dvh] max-w-md flex-col px-5 pb-8 pt-8">
      {/* 顶部进度 */}
      <header>
        <div className="flex items-baseline justify-between text-[11px] text-neutral-500">
          <span>{COPY.quiz.progressLabel(index + 1, TOTAL_QUESTIONS)}</span>
          <button
            type="button"
            onClick={handleRestart}
            className="text-neutral-500 underline decoration-dotted"
          >
            {COPY.quiz.restartHint}
          </button>
        </div>
        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-rose-100">
          <div
            className="h-full rounded-full bg-rose-500 transition-all duration-300"
            style={{ width: `${(answeredCount / TOTAL_QUESTIONS) * 100}%` }}
          />
        </div>
        <p className="mt-2 text-[11px] text-neutral-500">
          {COPY.quiz.subtitle}
          {answeredCount > 0 && answeredCount < TOTAL_QUESTIONS && (
            <span className="ml-2 text-rose-600">
              {COPY.quiz.resumeHint(answeredCount)}
            </span>
          )}
        </p>
      </header>

      {/* 题目 */}
      <section className="mt-8 flex-1">
        <p className="text-[11px] font-medium text-rose-600">
          {DIMENSION_MAP[current.dimension].label}
        </p>
        <h1 className="mt-2 text-xl font-bold leading-snug text-neutral-900">
          {current.text}
        </h1>

        <ul className="mt-6 space-y-3">
          {current.options.map((option, optionIndex) => {
            const isSelected = selected === optionIndex;
            return (
              <li key={option.text}>
                <button
                  type="button"
                  onClick={() => handleSelect(optionIndex)}
                  aria-pressed={isSelected}
                  className={`w-full rounded-2xl border-2 px-4 py-4 text-left text-sm leading-relaxed transition active:scale-[0.99] ${
                    isSelected
                      ? 'border-rose-500 bg-rose-50 font-medium text-rose-700'
                      : 'border-neutral-200 bg-white text-neutral-700'
                  }`}
                >
                  <span
                    className={`mr-2.5 inline-flex h-5 w-5 items-center justify-center rounded-full text-[11px] ${
                      isSelected
                        ? 'bg-rose-500 text-white'
                        : 'bg-neutral-100 text-neutral-600'
                    }`}
                  >
                    {'ABCD'[optionIndex]}
                  </span>
                  {option.text}
                </button>
              </li>
            );
          })}
        </ul>

        {nudge && (
          <p className="mt-4 rounded-xl bg-amber-50 px-4 py-2 text-xs text-amber-700">
            这一题还没选哦，随便选一个最接近的就好。
          </p>
        )}
      </section>

      {/* 底部操作 */}
      <footer className="mt-8 space-y-3">
        {complete && (
          <button
            type="button"
            onClick={handleSeeResult}
            className="w-full rounded-2xl bg-rose-600 px-6 py-4 text-base font-semibold text-white shadow-lg shadow-rose-200 transition active:scale-[0.98]"
          >
            {COPY.quiz.seeResult}
          </button>
        )}

        <div className="flex gap-3">
          <button
            type="button"
            onClick={handlePrev}
            disabled={index === 0}
            className="flex-1 rounded-xl border border-neutral-200 bg-white px-4 py-3 text-sm text-neutral-600 transition active:scale-[0.98] disabled:opacity-40"
          >
            {COPY.quiz.prev}
          </button>
          {!isLast && (
            <button
              type="button"
              onClick={handleNext}
              className="flex-1 rounded-xl border border-neutral-200 bg-white px-4 py-3 text-sm text-neutral-600 transition active:scale-[0.98]"
            >
              {COPY.quiz.next}
            </button>
          )}
        </div>

        <p className="text-center text-[10px] text-neutral-500">
          {BRAND.name} · 答案只存在你的手机上
        </p>
      </footer>
    </main>
  );
}
