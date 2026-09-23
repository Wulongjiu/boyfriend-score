/**
 * 埋点事件定义（单一事实来源）
 *
 * ── 设计原则 ──────────────────────────────────────────────────────────
 * 1. **事件名是契约**：客户端、服务端、报表脚本共用这一份定义，避免三处各写一套字符串。
 * 2. **只采集漏斗所需的最小字段**：不采集任何可识别个人身份的信息。
 * 3. **答案不进事件流**：埋点只记"答了第几题、用了多久"，不记选了什么
 *    （选中项编号在结果页 code 里，属于用户主动分享的内容，不进入日志）。
 *
 * ── 为什么自建而不只用 GA4 ────────────────────────────────────────────
 * 本产品的主要流量来自小红书内置浏览器，该环境常拦截第三方脚本。
 * 因此自建 /api/track 是**主通道**，GA4 只能作为补充。
 */

/** 漏斗事件（按用户路径顺序） */
export const FUNNEL_EVENTS = [
  'view_home', // 首页曝光
  'start_quiz', // 点击开始
  'answer_question', // 完成一题
  'quiz_complete', // 答完最后一题
  'view_result', // 结果页曝光
  'save_card', // 生成分享卡片
  'copy_link', // 复制结果链接
  'restart_quiz', // 重新开始
] as const;

export type FunnelEvent = (typeof FUNNEL_EVENTS)[number];

/** 事件负载：只允许这些字段，防止有人顺手把敏感信息塞进来 */
export interface EventPayload {
  /** 题号（answer_question 用） */
  questionId?: number;
  /** 该题停留毫秒数（answer_question 用，用于找"最难回答的题"） */
  durationMs?: number;
  /** 当前已答题数（任意事件可用） */
  answered?: number;
  /** 结果页分数（view_result / save_card 用，0–100） */
  score?: number;
  /** 是否命中红牌并封顶 */
  isCapped?: boolean;
  /** 命中的关系原型 id（用于统计哪种原型最常见） */
  archetypeId?: string;
  /** 进入来源（utm_content 等，用于区分不同小红书笔记） */
  source?: string;
}

/** 上报到服务端的完整事件 */
export interface TrackEvent {
  name: FunnelEvent;
  /** 匿名会话 id（同一次答题会话内保持不变） */
  sessionId: string;
  payload: EventPayload;
  /** 客户端时间戳（毫秒） */
  ts: number;
}

/** 服务端入库的一行 */
export interface EventRow {
  name: FunnelEvent;
  sessionId: string;
  /** 匿名访客标识（IP + UA 的加盐哈希，不可逆） */
  visitorHash: string | null;
  payload: EventPayload;
  /** 服务端接收时间 */
  createdAt: Date;
}

/** 事件名是否合法 */
export function isFunnelEvent(value: unknown): value is FunnelEvent {
  return typeof value === 'string' && (FUNNEL_EVENTS as readonly string[]).includes(value);
}

/**
 * 净化负载：丢弃未在 EventPayload 中声明的字段
 *
 * 这是一个**安全边界**：即使客户端被篡改、塞进额外字段，也不会落库。
 */
export function sanitizePayload(input: unknown): EventPayload {
  if (!input || typeof input !== 'object') return {};
  const raw = input as Record<string, unknown>;
  const out: EventPayload = {};

  const num = (v: unknown, min: number, max: number): number | undefined =>
    typeof v === 'number' && Number.isFinite(v) && v >= min && v <= max
      ? Math.round(v)
      : undefined;

  const qid = num(raw.questionId, 1, 999);
  if (qid !== undefined) out.questionId = qid;

  const dur = num(raw.durationMs, 0, 60 * 60 * 1000);
  if (dur !== undefined) out.durationMs = dur;

  const answered = num(raw.answered, 0, 999);
  if (answered !== undefined) out.answered = answered;

  const score = num(raw.score, 0, 100);
  if (score !== undefined) out.score = score;

  if (typeof raw.isCapped === 'boolean') out.isCapped = raw.isCapped;

  if (typeof raw.archetypeId === 'string' && /^[a-z0-9_]{1,40}$/.test(raw.archetypeId)) {
    out.archetypeId = raw.archetypeId;
  }

  if (typeof raw.source === 'string') {
    // 只保留安全字符，避免把 UTM 参数当成注入载体。
    // 注意：先过滤、再截断，而不是先判长度——否则超长但合法的来源会被整个丢弃，
    // 导致长 UTM 参数的归因数据静默丢失（这个顺序 bug 由测试抓出）。
    const cleaned = raw.source.replace(/[^A-Za-z0-9._~-]/g, '').slice(0, 60);
    if (cleaned.length > 0) out.source = cleaned;
  }

  return out;
}
