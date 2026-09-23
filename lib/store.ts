'use client';

import { useCallback, useSyncExternalStore } from 'react';

import type { Answers } from './types';

/**
 * 答题进度存储（localStorage + useSyncExternalStore）
 *
 * 为什么手写而不用 Zustand：需求只有"读一个对象、写一个对象、订阅变化"，
 * 手写约 60 行、零依赖、天然 SSR 安全（服务端快照固定为 null，不会 hydration 不匹配）。
 *
 * ⚠️ 关键约束（踩过一次坑）：useSyncExternalStore 要求 getSnapshot **返回同一引用**，
 *    否则 React 会判定快照不稳定并静默中断渲染（表现为整页停在 SSR 骨架、无任何报错）。
 *    因此这里必须缓存"已构造好的对象"，而不是每次读都新建一个。
 *
 * 设计要点：
 *  - 只存选项下标，不存用户身份信息
 *  - 写入失败（隐私模式/配额满）静默降级为"仅内存"，不影响答题
 */

const STORAGE_KEY = 'bfsi:answers:v1';

/** 服务端与首次渲染统一返回 null，避免 hydration 不一致 */
const SERVER_SNAPSHOT: Answers | null = null;

/** 已解析的快照缓存：getSnapshot 必须返回它的同一引用 */
let cache: Answers | null = null;
/** cache 是否已就绪（区分"还没构造"与"构造出来是空对象"） */
let cacheReady = false;
/** 构造 cache 时对应的 localStorage 原始字符串 */
let cacheRaw: string | null = null;
const listeners = new Set<() => void>();

/** 只读快照：同一份 localStorage 内容永远返回同一引用 */
function getSnapshot(): Answers | null {
  if (typeof window === 'undefined') return SERVER_SNAPSHOT;

  let raw: string | null = null;
  try {
    raw = window.localStorage.getItem(STORAGE_KEY);
  } catch {
    raw = null; // 隐私模式：降级为空答案
  }

  if (cacheReady && raw === cacheRaw) return cache;

  cacheRaw = raw;
  cacheReady = true;
  cache = parseAnswers(raw);
  return cache;
}

/** 把原始 JSON 解析成干净答案，任何脏数据都丢弃 */
function parseAnswers(raw: string | null): Answers {
  if (!raw) return {};
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {};
    const clean: Answers = {};
    for (const [key, value] of Object.entries(parsed as Record<string, unknown>)) {
      const id = Number(key);
      if (!Number.isInteger(id) || id <= 0) continue;
      if (typeof value !== 'number' || !Number.isInteger(value)) continue;
      if (value < 0 || value > 3) continue;
      clean[id] = value;
    }
    return clean;
  } catch {
    return {};
  }
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function emit(): void {
  for (const listener of listeners) listener();
}

/** 写入并同步更新缓存（保持引用稳定语义） */
function persist(next: Answers): void {
  const serialized = JSON.stringify(next);
  cache = next;
  cacheRaw = serialized;
  cacheReady = true;
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(STORAGE_KEY, serialized);
  } catch {
    // 隐私模式或配额满：仅保留内存状态，不打断答题流程
  }
}

export interface QuizStore {
  /** null 表示尚未在客户端读取（用于避免 hydration 闪烁） */
  answers: Answers | null;
  setAnswer: (questionId: number, optionIndex: number) => void;
  reset: () => void;
}

export function useQuizStore(): QuizStore {
  const answers = useSyncExternalStore(subscribe, getSnapshot, () => SERVER_SNAPSHOT);

  const setAnswer = useCallback((questionId: number, optionIndex: number) => {
    const current = getSnapshot() ?? {};
    persist({ ...current, [questionId]: optionIndex });
    emit();
  }, []);

  const reset = useCallback(() => {
    persist({});
    emit();
  }, []);

  return { answers, setAnswer, reset };
}
