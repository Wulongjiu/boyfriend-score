# 男友生存指数 · bf-survival-index

> 3 分钟，回答 36 道关于他的日常，看看他能不能活下来。

面向小红书年轻女性的娱乐向测评网页。技术栈：Next.js 16（App Router）+ TypeScript + Tailwind CSS 4 + Vitest。

## 测评内核 v2（2026-09 重构）

| 层 | 说明 |
|---|---|
| **量表** | 36 题，7 维度加权。单题可同时贡献 2–3 个维度（平均 1.43） |
| **7 维度** | 情感回应性 22% / 冲突修复力 16% / 言行一致 14% / 边界与安全感 14% / 负荷分担 14% / 未来与承诺 12% / 社会融合 8% |
| **理论依据** | 主轴：感知伴侣回应性（Reis & Shaver 人际亲密过程模型：被理解/被认可/被在乎）；冲突：Gottman 四骑士；负荷：家务与心理负荷研究 |
| **关系原型** | 13 个多维度组合原型，每个含 3 段解读 + 3 个信号 + 消耗点 + 3 条行动。结果页核心结论 |
| **等级** | 6 档，仅作总分定调；具体建议下沉到原型 |
| **红牌** | 5 条（筑墙/鄙视/否定感受/边界倒打一耙/迁怒失控），命中则总分封顶 45 |

### 三个被修复的设计缺陷

1. **指向性**：v1 有 35/36 题的最优选项都在 A 位，用户能猜出规律。
   → 选项顺序在生成题库时打乱并固化，分布 A/B/C/D = 14/7/8/7；选项只写行为事实、不写优劣；加入权衡型选项。
2. **一问一维度**：v1 等于 7 个独立小测拼接，测不出关系模式。
   → 单题多维度加权，31/36 题含多维贡献。
3. **结论单薄**：v1 每档只有一两句话。
   → 原型给出多维度组合解读，先接住情绪再讲事实。

### 分数量表校准

多维度加权导致两道边界都不可达（实测：上限 99.15、下限 5.63），
因此计分时线性映射 `[5.63, 99.15] → [0, 100]`，否则"满分 100"与"0 分"都不可能出现。

⚠️ **改动题库后必须重新校准**：

```bash
node --experimental-strip-types scripts/find-score-ceiling.mjs   # 更新 SCORE_CEILING
node --experimental-strip-types scripts/find-score-floor.mjs     # 更新 SCORE_FLOOR
```

### 题库的两层结构（重要）

```
content/questions.canonical.ts   人工维护：选项按语义顺序写，便于审校
        ↓  scripts/generate-questions.mjs --write
content/questions.ts             应用使用：选项顺序已打乱并固化
```

**为什么必须固化而不是运行时打乱**：答案按展示位置（选项下标）存进 URL code，
若运行时打乱而计分按源顺序读取，分数会整体错位。固化后全链路只有一套顺序。

## 目录结构

```
app/                     路由：/ /quiz /r/[code] /_not-found
components/              RadarChart ScoreRing ResultView icons
content/                 题库（canonical 源 + 生成的正式版）
lib/                     types model scoring archetypes levels advice quiz store share-card copy brand
scripts/                 生成器、审计、校准、端到端、截图
tests/                   80 个单测（评分/编解码/设计系统契约）
docs/POSITIONING.md      产品定位与决策记录
public/fonts/            得意黑子集（OFL-1.1，附授权文件）
```

## 常用命令

```bash
npm run dev        # 本地开发
npm run verify     # typecheck + test（提交前跑）
npm run build      # 生产构建
npm run coverage   # 覆盖率

# 题库改动后
node --experimental-strip-types scripts/generate-questions.mjs --write
node --experimental-strip-types scripts/find-score-ceiling.mjs
node --experimental-strip-types scripts/find-score-floor.mjs
node --experimental-strip-types scripts/audit-questions.mjs

# 验证
node --experimental-strip-types scripts/e2e-flow.mjs <url> [--red-flag]
node scripts/measure-deployed.mjs <url>          # 布局溢出/字体/主题体检
node scripts/screenshot-pages.mjs <url> <outDir> # 三页截图
```

## 字体

| 文件 | 用途 | 体积 |
|---|---|---|
| `smiley-sans-display.woff2` | 页面标题（静态文案子集） | 97.9 KB |
| `smiley-sans-card.woff2` | 分享卡片（受控字符串子集） | 120.6 KB |

得意黑 Smiley Sans Oblique，SIL OFL 1.1，可免费商用（授权文件随字体附带）。
⚠️ 它只有斜体一个形态且汉字覆盖 8057（黑体 20902），**禁止用于正文**。

## 合规红线（写文案时务必遵守）

- 定位是"娱乐向打分"，不做心理/医学诊断表述
- 不收集姓名、手机号、聊天记录等任何身份信息
- 小红书笔记内不放站外二维码、不写导流话术（平台禁止站外导流）
- 原型文案不使用"渣男/分手吧/赶紧跑"等判决式词汇（测试有断言拦截）

## 许可

代码 MIT（`LICENSE`）；题库、维度权重、等级与原型文案 CC BY-NC 4.0（`content/LICENSE`）。
即：脚手架随便拿，题目和权重设计别拿去赚钱。
