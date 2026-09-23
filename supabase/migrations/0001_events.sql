-- 埋点事件表
--
-- 用途：把 /api/track 收到的事件落库，用于计算漏斗与找"最难回答的题"。
--
-- 隐私约束（与 app/api/track/route.ts 保持一致）：
--   · visitor_hash 是 IP+UA+盐 的 SHA-256 前 16 位，不可逆
--   · payload 只含白名单字段（题号、耗时、分数、原型 id、来源）
--   · 不存答案内容，不存任何可识别个人身份的信息
--
-- 用法：在 Supabase / Neon 的 SQL Editor 里执行本文件。
-- 执行完成后，把连接串配到 Vercel 环境变量 DATABASE_URL，
-- 再按 app/api/track/route.ts 里的 TODO 打开插入逻辑。

create table if not exists events (
  id           bigserial primary key,
  name         text        not null,
  session_id   text        not null,
  visitor_hash text,
  payload      jsonb       not null default '{}'::jsonb,
  client_ts    bigint,                       -- 客户端时间戳（毫秒）
  received_at  timestamptz not null default now()
);

-- 按事件名 + 时间查询（漏斗、趋势）
create index if not exists events_name_received_idx on events (name, received_at desc);

-- 按会话聚合（还原单次答题路径）
create index if not exists events_session_idx on events (session_id, received_at);

-- 来源维度（区分不同小红书笔记）
create index if not exists events_source_idx on events ((payload ->> 'source'));

-- ── 常用查询（可直接贴进 SQL Editor）──────────────────────────────────

-- 1) 漏斗：各环节人数与相对上一环节的转化率
-- with per_session as (
--   select session_id,
--          bool_or(name = 'view_home')      as s_home,
--          bool_or(name = 'start_quiz')     as s_start,
--          bool_or(name = 'quiz_complete')  as s_complete,
--          bool_or(name = 'view_result')    as s_result,
--          bool_or(name = 'save_card')      as s_save
--   from events group by session_id
-- )
-- select
--   count(*) filter (where s_home)     as 首页,
--   count(*) filter (where s_start)    as 开始答题,
--   count(*) filter (where s_complete) as 答完,
--   count(*) filter (where s_result)   as 看到结果,
--   count(*) filter (where s_save)     as 保存卡片,
--   round(100.0 * count(*) filter (where s_complete) / nullif(count(*) filter (where s_start), 0), 1) as 完成率,
--   round(100.0 * count(*) filter (where s_save) / nullif(count(*) filter (where s_complete), 0), 1) as 分享率
-- from per_session;

-- 2) 最难回答的题：平均停留时间最长的题目（改题库的直接依据）
-- select (payload ->> 'questionId')::int as 题号,
--        count(*)                        as 作答次数,
--        round(avg((payload ->> 'durationMs')::numeric) / 1000, 1) as 平均秒数,
--        round(percentile_cont(0.5) within group (order by (payload ->> 'durationMs')::numeric) / 1000, 1) as 中位秒数
-- from events
-- where name = 'answer_question' and payload ? 'durationMs'
-- group by 1 order by 平均秒数 desc limit 15;

-- 3) 弃答位置：哪些题被看到却没被回答
-- select (payload ->> 'questionId')::int as 题号, count(*) as 未作答次数
-- from events
-- where name = 'quiz_abandon'
-- group by 1 order by 2 desc limit 10;

-- 4) 原型分布（哪种关系形态最常见，也是内容选题依据）
-- select payload ->> 'archetypeId' as 原型, count(*) as 次数,
--        round(avg((payload ->> 'score')::numeric), 1) as 平均分
-- from events where name = 'view_result' and payload ? 'archetypeId'
-- group by 1 order by 2 desc;

-- 5) 来源效果（哪篇小红书笔记带来的完成率更高）
-- select coalesce(payload ->> 'source', '(直接访问)') as 来源,
--        count(distinct session_id) as 会话数
-- from events where name = 'start_quiz'
-- group by 1 order by 2 desc;
