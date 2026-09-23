import type { EventPayload, FunnelEvent, EventRow } from './analytics-events';

/**
 * 埋点事件存储层
 *
 * ── 设计目标 ──────────────────────────────────────────────────────────
 * 1. **驱动可选**：没配 DATABASE_URL 时整个模块不加载任何数据库依赖，
 *    事件只走结构化日志。这样本地开发、未配库的部署都不会崩。
 * 2. **失败绝不影响用户**：写库失败只记日志、不抛错——埋点的重要性
 *    永远低于用户正在做的事。
 * 3. **SQL 与逻辑可测试**：SQL 文本与参数构造是纯函数，可单测；
 *    只有真正执行时才依赖驱动。
 *
 * ── 表结构 ────────────────────────────────────────────────────────────
 * 见 supabase/migrations/0001_events.sql（与 SQL_INSERT 保持一致）。
 */

/** 建表语句（与迁移文件一致；启动时执行是幂等的） */
export const SQL_CREATE_TABLE = `
create table if not exists events (
  id           bigserial primary key,
  name         text        not null,
  session_id   text        not null,
  visitor_hash text,
  payload      jsonb       not null default '{}'::jsonb,
  client_ts    bigint,
  received_at  timestamptz not null default now()
)`;

/** 插入语句（参数化，禁止拼接用户输入） */
export const SQL_INSERT = `
insert into events (name, session_id, visitor_hash, payload, client_ts)
values ($1, $2, $3, $4::jsonb, $5)`;

/** 插入参数（顺序与 SQL_INSERT 对应） */
export interface InsertParams {
  name: FunnelEvent;
  sessionId: string;
  visitorHash: string | null;
  payload: EventPayload;
  clientTs: number;
}

/** 构造插入参数（纯函数，可单测） */
export function buildInsertParams(
  name: FunnelEvent,
  sessionId: string,
  visitorHash: string | null,
  payload: EventPayload,
  clientTs: number,
): [string, string, string | null, string, number] {
  return [name, sessionId, visitorHash, JSON.stringify(payload), clientTs];
}

/** 是否配置了数据库 */
export function hasDatabase(): boolean {
  return Boolean(process.env.DATABASE_URL);
}

/* ------------------------------------------------------------------ */
/* 驱动适配：postgres.js                                               */
/* ------------------------------------------------------------------ */

/**
 * postgres 包是**可选依赖**：这里用运行时动态导入（而非静态 import），
 * 因此没装也不会导致 TypeScript 报错、构建失败。
 * 想启用数据库：`npm i postgres` 并配置 DATABASE_URL。
 *
 * 说明：用 `new Function` 包一层是为了让打包器/TS 不静态解析这个模块名
 * ——我们明确希望它在未安装时"不存在也没关系"。
 */
const dynamicImport = new Function('specifier', 'return import(specifier)') as (
  specifier: string,
) => Promise<unknown>;

type SqlClient = {
  (strings: TemplateStringsArray, ...values: unknown[]): Promise<unknown>;
  unsafe: (query: string, params?: unknown[]) => Promise<unknown>;
  end: (options?: { timeout?: number }) => Promise<void>;
};

let client: SqlClient | null = null;
let driverMissing = false;
let schemaReady = false;

async function getClient(): Promise<SqlClient | null> {
  if (!hasDatabase() || driverMissing) return null;
  if (client) return client;
  try {
    const mod = (await dynamicImport('postgres')) as {
      default: (url: string, opts?: Record<string, unknown>) => SqlClient;
    };
    client = mod.default(process.env.DATABASE_URL as string, {
      max: 1, // Serverless：每实例一个连接足够，避免打满数据库连接数
      idle_timeout: 20,
      connect_timeout: 10,
      prepare: false, // 兼容 Supabase 连接池（pgbouncer 事务模式）
    });
    return client;
  } catch {
    driverMissing = true;
    console.warn(
      '[track] DATABASE_URL 已配置但未安装 postgres 驱动，事件仅写入日志。安装：npm i postgres',
    );
    return null;
  }
}

/** 确保表存在（幂等，每个实例只做一次） */
async function ensureSchema(sql: SqlClient): Promise<void> {
  if (schemaReady) return;
  try {
    await sql.unsafe(SQL_CREATE_TABLE);
    schemaReady = true;
  } catch (err) {
    console.warn('[track] 建表检查失败（将继续尝试插入）:', String(err).slice(0, 200));
  }
}

/**
 * 写库（永不抛错）
 * @returns 是否成功写入
 */
export async function persistEvent(params: InsertParams): Promise<boolean> {
  const sql = await getClient();
  if (!sql) return false;

  try {
    await ensureSchema(sql);
    const args = buildInsertParams(
      params.name,
      params.sessionId,
      params.visitorHash,
      params.payload,
      params.clientTs,
    );
    await sql.unsafe(SQL_INSERT, args);
    return true;
  } catch (err) {
    // 埋点写入失败不能影响用户请求
    console.warn('[track] 写入失败:', String(err).slice(0, 300));
    return false;
  }
}

/** 供测试使用的重置（清空模块级缓存） */
export function __resetStoreForTests(): void {
  client = null;
  driverMissing = false;
  schemaReady = false;
}

/** 类型守卫：判断一行是否是合法事件行（报表脚本读库时用） */
export function isEventRow(value: unknown): value is EventRow {
  if (!value || typeof value !== 'object') return false;
  const r = value as Record<string, unknown>;
  return typeof r.name === 'string' && typeof r.sessionId === 'string';
}
