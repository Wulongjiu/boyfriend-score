# 男友生存指数 · bf-survival-index

> 3 分钟，回答 27 道关于他的日常，看看他能不能活下来。

面向小红书年轻女性的娱乐向测评网页。技术栈：Next.js 16（App Router）+ TypeScript + Tailwind CSS 4 + Vitest。

**已拍板的产品决策**（详见 `docs/POSITIONING.md` §8）：命名「男友生存指数」· 27 题全上 · 红牌命中总分封顶 45 · 分享以 PNG 卡片为主 + 极简分数链（链接只显示分数与称号，7 天过期，`noindex`）。

## 当前进度

| 阶段 | 状态 | 说明 |
|---|---|---|
| **Day 1 · P0 定位与测评模型** | ✅ 完成 | 定位文档、七维模型、27 题题库、6 档文案、计分纯函数 + 46 个单测 |
| Day 2–5 · 工程骨架与部署 | ⏳ | Vercel 空壳上线 |
| Day 5–14 · 核心功能 | ⏳ | 首页 / 答题 / 结果 / 分享图 / 存储 / 埋点 |

## 目录结构

```
app/                     Next.js 路由（当前只有模型预览首页）
content/questions.ts     题库 v1：27 题 / 7 维度 / 反向验证题 / 红牌题
lib/types.ts             全站类型契约
lib/model.ts             维度、权重、红牌库、判定规则（产品可调参数都在这里）
lib/scoring.ts           计分纯函数（可注入题库与规则，无副作用）
lib/levels.ts            6 档等级文案
lib/advice.ts            维度 → 改进建议库
tests/scoring.test.ts    46 个单元测试
docs/POSITIONING.md      Day 1 定位与模型定稿文档
```

## 常用命令

```bash
npm run dev        # 本地开发（含模型预览页）
npm run test       # 跑单元测试
npm run coverage   # 测试覆盖率报告
npm run typecheck  # TypeScript 类型检查
npm run verify     # typecheck + test（提交前跑这个）
npm run build      # 生产构建
```

## 计分规则（详见 docs/POSITIONING.md）

1. 每题 4 个选项，分值 0–4；维度得分 = 该维已答题实得分 / 已答题满分 × 100
2. 总分 = Σ(维度得分 × 权重) / Σ权重，四舍五入到整数
3. 未作答的题不计入分母（不做"未答 = 0 分"的误伤）
4. 命中任一红牌 → 总分封顶 45（防止"冷暴力 + 送礼 = 高分"）
5. 反向验证题差值过大 → 只提示、不扣分

## 改内容时的注意事项

- 改权重：只改 `lib/model.ts` 的 `DIMENSIONS`，测试会校验权重合计必须为 100
- 改题目：只改 `content/questions.ts`；新增红牌选项必须同时满足「选项带 redFlag」+「红牌 id 已在 RED_FLAGS 定义」，测试会拦截不一致
- 改判定规则（封顶值、一致性阈值）：改 `lib/model.ts` 的 `RULES`
- 所有内容改动后跑 `npm run verify`，全绿再提交

## 合规红线（写文案时务必遵守）

- 定位是"娱乐向打分"，不做心理/医学诊断表述
- 不收集姓名、手机号、聊天记录等任何身份信息
- 小红书笔记内不放站外二维码、不写导流话术（平台禁止站外导流）

## 许可

本项目**代码与内容分开授权**：

| 范围 | 许可 | 说明 |
|---|---|---|
| 代码、工程配置、测试 | MIT（见 `LICENSE`） | 欢迎复用，包括商业化使用 |
| 题库、维度权重、等级文案、红牌规则、建议文案 | CC BY-NC 4.0（见 `content/LICENSE`） | 可学习参考，**不可商用**；商用需单独授权 |

换句话说：**脚手架随便拿，27 道题和权重设计别拿去赚钱。**
