import { NextResponse } from 'next/server';
import { createHash } from 'node:crypto';

import { isFunnelEvent, sanitizePayload } from '../../../lib/analytics-events';
import type { EventPayload, FunnelEvent } from '../../../lib/analytics-events';

/**
 * 埋点接收端点 POST /api/track
 *
 * ── 为什么自建 ────────────────────────────────────────────────────────
 * 主要流量来自小红书内置浏览器，常拦截第三方脚本（GA4 等），
 * 因此这里自建是主通道。
 *
 * ── 隐私（硬约束）────────────────────────────────────────────────────
 * · 不采集 IP 原文：只存 `IP+UA+盐` 的 SHA-256 前 16 位，不可逆、无法跨站追踪
 * · 负载经过白名单净化，客户端塞进来的额外字段一律丢弃
 * · 不采集答案内容（只记题号与耗时）
 *
 * ── 存储策略（当前阶段）──────────────────────────────────────────────
 * 现阶段把事件写成**结构化 JSON 日志**（一行一个事件），原因：
 *   · 零配置即可用，Vercel 自带日志保留
 *   · 不引入未安装的数据库依赖，避免为了埋点把项目搞复杂
 * 同时 `supabase/migrations/0001_events.sql` 已备好建表语句，
 * 配好 DATABASE_URL 后可平滑切到数据库（见 TODO 标记处）。
 *
 * ── 反滥用 ───────────────────────────────────────────────────────────
 * 进程内滑动窗口限流（按 visitorHash）。Serverless 多实例下限流是近似值，
 * 但足以挡住脚本刷量；Turnstile 在国内可用性不稳，故不引入。
 */

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** 限流：每个访客 1 分钟内最多 120 个事件（正常用户远低于此） */
const RATE_WINDOW_MS = 60_000;
const RATE_MAX = 120;

/** 进程内计数器（Serverless 实例级；够用且零依赖） */
const counters = new Map<string, { count: number; resetAt: number }>();

function rateLimited(key: string): boolean {
  const now = Date.now();
  const entry = counters.get(key);
  if (!entry || now > entry.resetAt) {
    counters.set(key, { count: 1, resetAt: now + RATE_WINDOW_MS });
    return false;
  }
  entry.count += 1;
  // 顺手清理过期项，避免 Map 无限增长
  if (counters.size > 5000) {
    for (const [k, v] of counters) {
      if (now > v.resetAt) counters.delete(k);
    }
  }
  return entry.count > RATE_MAX;
}

/** 匿名访客标识：IP + UA + 盐 的哈希前缀，不可逆 */
function visitorHash(ip: string | null, ua: string | null): string | null {
  if (!ip && !ua) return null;
  const salt = process.env.RATE_LIMIT_SALT ?? 'bfsi-default-salt';
  return createHash('sha256')
    .update(`${salt}|${ip ?? ''}|${ua ?? ''}`)
    .digest('hex')
    .slice(0, 16);
}

interface ParsedBody {
  name: FunnelEvent;
  sessionId: string;
  payload: EventPayload;
  ts: number;
}

export async function POST(request: Request): Promise<Response> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: 'invalid_json' }, { status: 400 });
  }

  if (!body || typeof body !== 'object') {
    return NextResponse.json({ ok: false, error: 'invalid_body' }, { status: 400 });
  }

  const raw = body as Record<string, unknown>;

  if (!isFunnelEvent(raw.name)) {
    return NextResponse.json({ ok: false, error: 'unknown_event' }, { status: 400 });
  }

  const sessionId =
    typeof raw.sessionId === 'string' && /^[A-Za-z0-9_-]{8,64}$/.test(raw.sessionId)
      ? raw.sessionId
      : null;
  if (!sessionId) {
    return NextResponse.json({ ok: false, error: 'invalid_session' }, { status: 400 });
  }

  // 从代理头取真实 IP（Vercel 会设置 x-forwarded-for）
  const forwarded = request.headers.get('x-forwarded-for');
  const ip = forwarded ? (forwarded.split(',')[0]?.trim() ?? null) : null;
  const ua = request.headers.get('user-agent');
  const hash = visitorHash(ip, ua);

  if (hash && rateLimited(hash)) {
    // 静默丢弃而不是报错：刷量者不该得到反馈，正常用户也不会看到
    return NextResponse.json({ ok: true, dropped: 'rate_limited' }, { status: 202 });
  }

  const parsed: ParsedBody = {
    name: raw.name,
    sessionId,
    payload: sanitizePayload(raw.payload),
    ts: typeof raw.ts === 'number' && Number.isFinite(raw.ts) ? Math.round(raw.ts) : Date.now(),
  };

  const row = {
    name: parsed.name,
    session_id: parsed.sessionId,
    visitor_hash: hash,
    payload: parsed.payload,
    client_ts: parsed.ts,
    received_at: new Date().toISOString(),
  };

  // ── 主通道：结构化日志（Vercel 日志可直接检索/导出）────────────────
  // 前缀固定，便于 `vercel logs` 或脚本按行过滤
  console.log(`[track] ${JSON.stringify(row)}`);

  // ── TODO(下一步)：配好 DATABASE_URL 后在此插入数据库 ────────────────
  // 建表语句见 supabase/migrations/0001_events.sql
  // 建议用参数化插入 + 失败只记日志（埋点绝不能影响用户请求）

  return NextResponse.json({ ok: true }, { status: 202 });
}

/** GET 用于健康检查（确认端点已部署） */
export async function GET(): Promise<Response> {
  return NextResponse.json({
    ok: true,
    endpoint: 'track',
    events: 'POST { name, sessionId, payload, ts }',
  });
}
