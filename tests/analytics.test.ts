import { describe, expect, it, afterEach } from 'vitest';

import {
  FUNNEL_EVENTS,
  isFunnelEvent,
  sanitizePayload,
} from '../lib/analytics-events';
import {
  SQL_CREATE_TABLE,
  SQL_INSERT,
  buildInsertParams,
  hasDatabase,
  isEventRow,
} from '../lib/analytics-store';

/**
 * 埋点契约测试
 *
 * 重点在 sanitizePayload——它是**安全边界**：客户端请求可被任意篡改，
 * 服务端必须只接受白名单字段、丢弃越界值。这些断言就是那条边界。
 */

describe('事件名校验', () => {
  it('已知漏斗事件被接受', () => {
    for (const name of FUNNEL_EVENTS) {
      expect(isFunnelEvent(name), name).toBe(true);
    }
  });

  it('未知事件名被拒绝', () => {
    for (const bad of ['unknown', 'view_home ', 'VIEW_HOME', '', 'track', 'click']) {
      expect(isFunnelEvent(bad), JSON.stringify(bad)).toBe(false);
    }
  });

  it('非字符串一律拒绝', () => {
    for (const bad of [null, undefined, 123, {}, [], true]) {
      expect(isFunnelEvent(bad)).toBe(false);
    }
  });

  it('漏斗事件不重复且数量稳定（改名是破坏性变更）', () => {
    expect(new Set(FUNNEL_EVENTS).size).toBe(FUNNEL_EVENTS.length);
    expect(FUNNEL_EVENTS.length).toBe(8);
  });
});

describe('sanitizePayload · 安全边界', () => {
  it('丢弃未声明白名单的字段', () => {
    const out = sanitizePayload({
      questionId: 3,
      // 以下都应被丢弃
      phone: '13800138000',
      name: '张三',
      answers: [0, 1, 2],
      secret: 'x',
    });
    expect(out).toEqual({ questionId: 3 });
    expect(Object.keys(out)).not.toContain('phone');
    expect(Object.keys(out)).not.toContain('answers');
  });

  it('越界数值被丢弃而不是被夹取', () => {
    expect(sanitizePayload({ score: 999 }).score).toBeUndefined();
    expect(sanitizePayload({ score: -5 }).score).toBeUndefined();
    expect(sanitizePayload({ questionId: 0 }).questionId).toBeUndefined();
    expect(sanitizePayload({ answered: -1 }).answered).toBeUndefined();
  });

  it('非数值/NaN/Infinity 被丢弃', () => {
    expect(sanitizePayload({ score: '80' }).score).toBeUndefined();
    expect(sanitizePayload({ score: NaN }).score).toBeUndefined();
    expect(sanitizePayload({ score: Infinity }).score).toBeUndefined();
    expect(sanitizePayload({ durationMs: null }).durationMs).toBeUndefined();
  });

  it('时长上限 1 小时，防止伪造超长停留污染"最难回答的题"统计', () => {
    expect(sanitizePayload({ durationMs: 60 * 60 * 1000 }).durationMs).toBe(60 * 60 * 1000);
    expect(sanitizePayload({ durationMs: 60 * 60 * 1000 + 1 }).durationMs).toBeUndefined();
  });

  it('archetypeId 只接受小写标识符，拒绝注入型字符串', () => {
    expect(sanitizePayload({ archetypeId: 'cold_war' }).archetypeId).toBe('cold_war');
    expect(sanitizePayload({ archetypeId: 'cold war' }).archetypeId).toBeUndefined();
    expect(sanitizePayload({ archetypeId: '<script>' }).archetypeId).toBeUndefined();
    expect(sanitizePayload({ archetypeId: 'a'.repeat(41) }).archetypeId).toBeUndefined();
  });

  it('source 过滤不安全字符并限长（UTM 参数是外部输入）', () => {
    expect(sanitizePayload({ source: 'note-1_abc' }).source).toBe('note-1_abc');
    expect(sanitizePayload({ source: 'note 1;drop table' }).source).toBe('note1droptable');
    expect(sanitizePayload({ source: '<img src=x>' }).source).toBe('imgsrcx');
    expect(sanitizePayload({ source: 'x'.repeat(200) })?.source?.length).toBe(60);
    expect(sanitizePayload({ source: '' }).source).toBeUndefined();
    expect(sanitizePayload({ source: 123 }).source).toBeUndefined();
  });

  it('布尔字段只接受真布尔', () => {
    expect(sanitizePayload({ isCapped: true }).isCapped).toBe(true);
    expect(sanitizePayload({ isCapped: false }).isCapped).toBe(false);
    expect(sanitizePayload({ isCapped: 'true' }).isCapped).toBeUndefined();
    expect(sanitizePayload({ isCapped: 1 }).isCapped).toBeUndefined();
  });

  it('非对象输入返回空负载（不抛异常）', () => {
    for (const bad of [null, undefined, 'str', 123, [], true]) {
      expect(sanitizePayload(bad)).toEqual({});
    }
  });

  it('数值会被取整（避免小数污染统计）', () => {
    expect(sanitizePayload({ durationMs: 1234.7 }).durationMs).toBe(1235);
    expect(sanitizePayload({ score: 79.6 }).score).toBe(80);
  });

  it('合法负载完整保留', () => {
    const payload = {
      questionId: 12,
      durationMs: 3200,
      answered: 12,
      score: 68,
      isCapped: false,
      archetypeId: 'sweet_talker',
      source: 'note-2',
    };
    expect(sanitizePayload(payload)).toEqual(payload);
  });

  it('不采集任何可识别个人身份的字段（隐私约束）', () => {
    // 这些键名即使客户端发送，也必须被丢弃
    const piiKeys = ['phone', 'email', 'name', 'wechat', 'ip', 'userAgent', 'location'];
    const out = sanitizePayload(
      Object.fromEntries(piiKeys.map((k) => [k, 'sensitive-value'])),
    );
    expect(out).toEqual({});
  });
});

/* ------------------------------------------------------------------ */
/* 存储层（SQL 与参数构造是纯函数，驱动可选）                            */
/* ------------------------------------------------------------------ */

describe('埋点存储层', () => {
  afterEach(() => {
    delete process.env.DATABASE_URL;
  });

  it('未配置 DATABASE_URL 时不认为有数据库', () => {
    delete process.env.DATABASE_URL;
    expect(hasDatabase()).toBe(false);
  });

  it('配置了 DATABASE_URL 时认为有数据库', () => {
    process.env.DATABASE_URL = 'postgresql://user:pw@host/db';
    expect(hasDatabase()).toBe(true);
  });

  it('插入语句使用参数占位符，不拼接任何用户输入', () => {
    // 这是防注入的关键：SQL 文本里不能出现 1..5 之外的值
    expect(SQL_INSERT).toContain('$1');
    expect(SQL_INSERT).toContain('$5');
    expect(SQL_INSERT).not.toMatch(/values\s*\(\s*'/i);
    expect(SQL_INSERT).toContain('::jsonb');
  });

  it('建表语句是幂等的（if not exists）', () => {
    expect(SQL_CREATE_TABLE).toContain('create table if not exists');
  });

  it('插入参数顺序与占位符一致，payload 序列化为 JSON', () => {
    const args = buildInsertParams(
      'view_result',
      'sess12345678',
      'abcdef0123456789',
      { score: 72, archetypeId: 'cold_war' },
      1700000000000,
    );
    expect(args).toHaveLength(5);
    expect(args[0]).toBe('view_result');
    expect(args[1]).toBe('sess12345678');
    expect(args[2]).toBe('abcdef0123456789');
    expect(typeof args[3]).toBe('string');
    expect(JSON.parse(args[3] as string)).toEqual({ score: 72, archetypeId: 'cold_war' });
    expect(args[4]).toBe(1700000000000);
  });

  it('visitorHash 可以为空（无 IP/UA 时）', () => {
    const args = buildInsertParams('view_home', 'sess12345678', null, {}, 1);
    expect(args[2]).toBeNull();
  });

  it('isEventRow 判定合法事件行', () => {
    expect(isEventRow({ name: 'view_home', sessionId: 'abc' })).toBe(true);
    expect(isEventRow({ name: 'view_home' })).toBe(false);
    expect(isEventRow(null)).toBe(false);
    expect(isEventRow('x')).toBe(false);
  });
});
