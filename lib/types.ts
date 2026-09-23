/**
 * 男友测评 · 核心类型定义 v2
 *
 * v1 → v2 的关键变化（2026-09 重构）：
 *
 * 1. **单题多维度贡献**：v1 是一题喂一个维度，等于 7 个独立小测拼接，
 *    测不出"关系模式"。v2 的 option 携带 `weights`，一道题可同时给 2–3 个
 *    维度不同权重的贡献，从而捕捉跨维度行为（例如"生病时的反应"同时反映
 *    陪伴与责任）。
 *
 * 2. **关系原型（Archetype）**：v1 只按总分给 6 档文案，太单薄。v2 用
 *    "维度组合特征"匹配具体关系形态（原型），给出多维组合解读。
 *
 * 3. **计分仍为纯函数**：不引入任何运行时依赖，全部可单测。
 */

/** 七个评测维度 */
export type DimensionId =
  | 'responsiveness' // D1 情感回应性（研究主轴：被理解/被认可/被在乎）
  | 'conflict' // D2 冲突修复力
  | 'consistency' // D3 言行一致与可靠性
  | 'boundary' // D4 边界感与安全感
  | 'load' // D5 负荷分担（家务 + 心理负荷）
  | 'future' // D6 未来与承诺
  | 'integration'; // D7 社会融合（家人朋友）

export interface Dimension {
  id: DimensionId;
  /** 展示名，如「情感回应性」 */
  label: string;
  /** 简称，用于雷达图轴标签（≤4 字最佳） */
  short: string;
  /** 权重，七维合计必须为 100 */
  weight: number;
  /** 一句话说明该维度在测什么 */
  description: string;
  /** 该维度是否允许"能力弱但态度好"的解释（影响文案语气） */
  explanation: string;
}

/**
 * 选项对维度的贡献
 *
 * 权重含义：该选项在这个维度上表现得多好，取值 0–1（不是分值，而是比例）。
 * 计分时该维度得分 = Σ(选中选项的权重 × 题权重) / Σ(题权重)。
 * 用比例而非 0–4 分值，是为了让"一题喂多维度"时各维度可独立归一化。
 */
export type OptionWeights = Partial<Record<DimensionId, number>>;

/** 单个选项 */
export interface Option {
  /** 选项文案（具体场景，不做价值判断，不按优劣排序） */
  text: string;
  /** 对各维度的贡献（0–1） */
  weights: OptionWeights;
  /**
   * 命中红牌时填写：对应 lib/model.ts 的 RED_FLAGS id
   * 红牌不是"他做了坏事"，而是"这件事不该被其他优点抵消"
   */
  redFlag?: string;
}

/** 题目 */
export interface Question {
  /** 题号，从 1 开始，顺序即展示顺序 */
  id: number;
  /** 主维度：仅用于答题页显示"这题在问什么"，计分看 option.weights */
  dimension: DimensionId;
  /** 题干文案 */
  text: string;
  /** 选项（顺序刻意不按优劣排列，避免被猜出"正确答案"） */
  options: Option[];
  /**
   * 反向验证题：填写它所要验证的题号
   * 生成时自动成对，用于检测"乱答"（例：Q3 正向问冲突后他怎么做，Q21 反向问）
   */
  validates?: number;
  /** 是否为红牌题（便于校验：红牌题至少有一个选项带 redFlag） */
  isRedFlag?: boolean;
  /** 该题的设计依据（研究来源或推理），便于日后审校 */
  rationale?: string;
}

/** 红牌定义 */
export interface RedFlag {
  /** 唯一标识，与 Option.redFlag 对应 */
  id: string;
  /** 警示标题 */
  title: string;
  /** 展开说明（关心口吻，不审判） */
  detail: string;
  /** 研究依据（如 Gottman 四骑士），便于说明"为什么这不是主观判断" */
  basis?: string;
}

/** 等级档位（保留，作为总分层） */
export interface Level {
  id: string;
  title: string;
  min: number;
  max: number;
  /** 一句话结论（会出现在分享卡片上） */
  oneLiner: string;
  /** 结果页正文 */
  description: string;
}

/* ------------------------------------------------------------------ */
/* 关系原型                                                             */
/* ------------------------------------------------------------------ */

/** 原型匹配条件：某维度需落在指定区间 */
export interface ArchetypeCondition {
  dimension: DimensionId;
  /** 下限（含），省略表示不设下限 */
  min?: number;
  /** 上限（含），省略表示不设上限 */
  max?: number;
  /** 该条件在匹配打分中的权重，越大越关键 */
  weight?: number;
}

/** 关系原型：结合多个维度给出的具体结论 */
export interface Archetype {
  id: string;
  /** 原型名（要能被截图分享，例如「他爱你，但不会爱你」） */
  title: string;
  /** 一句话（分享卡片用） */
  oneLiner: string;
  /** 优先级：越大约先匹配（用于"更具体/更严重"的原型优先） */
  priority: number;
  /** 匹配条件（全部满足才算命中） */
  conditions: ArchetypeCondition[];
  /** 完整解读（多段，要写透） */
  reading: string[];
  /** 「你要留意的三个信号」 */
  signals: string[];
  /** 「你正在消耗什么」——点出她的付出，这是情绪价值的核心 */
  drain: string;
  /** 「可以怎么做」——具体、可执行、不说教 */
  actions: string[];
  /** 命中的原型是否建议"认真考虑关系本身"（影响语气） */
  urgency?: 'normal' | 'high';
}

/** 命中的原型带匹配度信息 */
export interface ArchetypeMatch {
  archetype: Archetype;
  /** 匹配度 0–1，越高越贴合 */
  score: number;
  /** 命中的条件数 */
  matched: number;
}

/** 判定规则集 */
export interface RuleSet {
  /** 命中红牌后总分封顶值 */
  redFlagScoreCap: number;
  /** 一致性判定阈值（0–100 分制下的平均差值） */
  consistencyThreshold: number;
  /** 一致性低于该阈值时给用户的提示 */
  consistencyHint: string;
  /** 分数取整方式 */
  rounding: 'round' | 'floor';
  /** 维度得分保留小数位 */
  dimensionPrecision: number;
}

/* ------------------------------------------------------------------ */
/* 计分输入 / 输出                                                      */
/* ------------------------------------------------------------------ */

/** 答案：题号 → 选项下标 */
export type Answers = Record<number, number | undefined>;

export interface DimensionResult {
  id: DimensionId;
  label: string;
  short: string;
  weight: number;
  /** 该维得分 0–100 */
  score: number;
  /** 该维实得权重和（用于诊断） */
  earned: number;
  /** 该维满分权重和 */
  max: number;
  /** 该维参与的题目数 */
  answered: number;
  /** 该维关联的题目总数 */
  total: number;
}

export interface RedFlagHit {
  id: string;
  questionId: number;
  optionIndex: number;
  title: string;
  detail: string;
  basis?: string;
}

export interface ConsistencyResult {
  meanDiff: number | null;
  isLow: boolean;
  comparedPairs: number;
  hint: string | null;
}

export interface ScoreResult {
  /** 最终总分 0–100（已应用红牌封顶） */
  total: number;
  /** 未封顶的原始加权分 */
  rawTotal: number;
  isCapped: boolean;
  dimensions: DimensionResult[];
  /** 最需要关注的维度（按对总分的拉动量升序） */
  weakestDimensions: DimensionId[];
  /** 表现最好的维度 */
  strongestDimensions: DimensionId[];
  redFlags: RedFlagHit[];
  consistency: ConsistencyResult;
  level: Level;
  /** 匹配到的关系原型（可能为空，例如全未作答） */
  archetypes: ArchetypeMatch[];
  answeredCount: number;
  totalQuestions: number;
  isComplete: boolean;
}
