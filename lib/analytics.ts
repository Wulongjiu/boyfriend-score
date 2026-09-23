'use client';

import type { EventPayload, FunnelEvent } from './analytics-events';

/**
 * 客户端埋点上报
 *
 * ── 三条硬约束 ────────────────────────────────────────────────────────
 * 1. **绝不阻塞用户操作**：上报是 fire-and-forget，不 await、不弹错。
 *    埋点失败不能影响答题——这是比"数据完整"优先级更高的事。
 * 2. **关键事件用 sendBeacon**：保存卡片/复制链接时用户可能立刻离开页面，
 *    普通 fetch 会被中断；sendBeacon 由浏览器保证投递。
 * 3. **会话内去重**：同一次会话里重复触发的事件只上报一次（例如 React 严格模式
 *    下的双次 effect、用户来回切换页面）。
 *
 * ── 会话 id ───────────────────────────────────────────────────────────
 * 存在 sessionStorage（关掉标签页即失效），用于把一次答题会话的事件串起来
 * 计算漏斗。它不是用户标识——不含任何账号信息，也不跨会话追踪。
 */

const SESSION_KEY = 'bfsi:session';
const SENT_KEY = 'bfsi:sent';
const ENDPOINT = '/api/track';

/** 本会话已上报过的"一次性事件" */
const ONCE_EVENTS = new Set<FunnelEvent>(['view_home', 'start_quiz', 'quiz_complete', 'view_result']);

function randomId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID().replace(/-/g, '').slice(0, 16);
  }
  return Math.random().toString(36).slice(2, 18);
}

/** 取（或创建）本次会话 id；服务端渲染时返回 null */
export function getSessionId(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    let id = window.sessionStorage.getItem(SESSION_KEY);
    if (!id) {
      id = randomId();
      window.sessionStorage.setItem(SESSION_KEY, id);
    }
    return id;
  } catch {
    // 隐私模式下 sessionStorage 可能不可用：退化为内存 id
    return memorySessionId ?? (memorySessionId = randomId());
  }
}

let memorySessionId: string | null = null;

/** 读取进入来源（小红书笔记可用 utm_content 区分不同笔记） */
export function getSource(): string | undefined {
  if (typeof window === 'undefined') return undefined;
  try {
    const params = new URLSearchParams(window.location.search);
    const raw =
      params.get('utm_content') ??
      params.get('utm_source') ??
      params.get('from') ??
      null;
    if (!raw) return undefined;
    const cleaned = raw.replace(/[^A-Za-z0-9._~-]/g, '').slice(0, 60);
    return cleaned || undefined;
  } catch {
    return undefined;
  }
}

/** 该事件是否已经报过（用于 once 语义） */
function alreadySent(name: FunnelEvent): boolean {
  if (!ONCE_EVENTS.has(name)) return false;
  if (typeof window === 'undefined') return true;
  try {
    const raw = window.sessionStorage.getItem(SENT_KEY);
    const list: string[] = raw ? (JSON.parse(raw) as string[]) : [];
    return list.includes(name);
  } catch {
    return false;
  }
}

function markSent(name: FunnelEvent): void {
  if (!ONCE_EVENTS.has(name) || typeof window === 'undefined') return;
  try {
    const raw = window.sessionStorage.getItem(SENT_KEY);
    const list: string[] = raw ? (JSON.parse(raw) as string[]) : [];
    if (!list.includes(name)) {
      list.push(name);
      window.sessionStorage.setItem(SENT_KEY, JSON.stringify(list));
    }
  } catch {
    /* 忽略 */
  }
}

/**
 * 上报一个事件
 *
 * @param name 事件名（必须来自 FUNNEL_EVENTS）
 * @param payload 负载（服务端会再次净化）
 * @param opts.beacon 强制用 sendBeacon（页面即将卸载时用）
 */
export function track(
  name: FunnelEvent,
  payload: EventPayload = {},
  opts: { beacon?: boolean } = {},
): void {
  if (typeof window === 'undefined') return;
  if (alreadySent(name)) return;

  const sessionId = getSessionId();
  if (!sessionId) return;

  const body = JSON.stringify({
    name,
    sessionId,
    payload: { ...payload, source: payload.source ?? getSource() },
    ts: Date.now(),
  });

  markSent(name);

  try {
    // 关键事件（可能伴随页面跳转/下载）优先用 sendBeacon
    if (opts.beacon && typeof navigator !== 'undefined' && 'sendBeacon' in navigator) {
      const ok = navigator.sendBeacon(ENDPOINT, new Blob([body], { type: 'application/json' }));
      if (ok) return;
    }
    void fetch(ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body,
      keepalive: true,
    }).catch(() => {
      /* 埋点失败绝不影响用户 */
    });
  } catch {
    /* 同上 */
  }
}

/* ------------------------------------------------------------------ */
/* 答题计时                                                            */
/* ------------------------------------------------------------------ */

let questionShownAt = 0;
let currentQuestionId: number | null = null;

/** 记录某题开始展示的时刻 */
export function startQuestionTimer(questionId: number): void {
  currentQuestionId = questionId;
  questionShownAt = typeof performance !== 'undefined' ? performance.now() : Date.now();
}

/**
 * 结束计时并上报 answer_question
 *
 * durationMs 用于找出"最难回答的题"——停留时间异常长的题目，
 * 说明文案有歧义或选项都不贴切，是改题库最直接的依据。
 */
export function finishQuestionTimer(answered: number): void {
  if (currentQuestionId === null) return;
  const now = typeof performance !== 'undefined' ? performance.now() : Date.now();
  const durationMs = Math.max(0, Math.round(now - questionShownAt));
  track('answer_question', {
    questionId: currentQuestionId,
    durationMs,
    answered,
  });
  currentQuestionId = null;
}

/** 清空计时状态（重新开始时用） */
export function resetQuestionTimer(): void {
  currentQuestionId = null;
  questionShownAt = 0;
}

/** 清空本会话的去重标记（重新开始时用，让 quiz_complete 能再次上报） */
export function resetTracking(): void {
  if (typeof window === 'undefined') return;
  try {
    window.sessionStorage.removeItem(SENT_KEY);
  } catch {
    /* 忽略 */
  }
}
