/**
 * 男友测评 · 核心类型定义
 *
 * 说明：所有计分相关逻辑必须依赖这里定义的类型，保证 content / lib / app 三层契约一致。
 * 计分本身是纯函数（见 lib/scoring.ts），不依赖任何运行时或框架。
 */

/** 七个评测维度 */
export type DimensionId =
  | 'communication' // D1 情绪价值与沟通
  | 'companionship' // D2 时间与陪伴质量
  | 'boundary' // D3 边界感与异性社交
  | 'future' // D4 未来规划与承诺
  | 'responsibility' // D5 责任分担与成长
  | 'ritual' // D6 仪式感与礼物
  | 'family'; // D7 家人朋友与社交融合

export interface Dimension {
  id: DimensionId;
  /** 展示名，如「情绪价值与沟通」 */
  label: string;
  /** 简称，用于雷达图轴标签（≤4 字最佳） */
  short: string;
  /** 权重，七维合计必须为 100 */
  weight: number;
  /** 一句话说明该维度在测什么 */
  description: string;
}

/** 单个选项 */
export interface Option {
  /** 选项文案（口语、具体、有画面感） */
  text: string;
  /** 分值 0–4，越大代表这项做得越好 */
  score: number;
  /**
   * 命中红牌时填写：该选项对应的红牌标识
   * 用于在结果页展示「这件事值得你认真看」的警示区
   */
  redFlag?: string;
}

/** 题目 */
export interface Question {
  /** 题号，从 1 开始，顺序即展示顺序 */
  id: number;
  dimension: DimensionId;
  /** 题干文案 */
  text: string;
  options: Option[];
  /**
   * 反向验证题：填写它所要验证的题号（该题与之同义，用于检测瞎答）
   * 例：Q2 正向问「他多快回应你」，Q4 反向问「他毫无预兆消失」→ Q4.validates = 2
   */
  validates?: number;
  /** 是否为红牌题（题目级别标记，便于校验：红牌题至少有一个选项带 redFlag） */
  isRedFlag?: boolean;
}

/** 红牌定义：命中后展示的警示信息 */
export interface RedFlag {
  /** 唯一标识，与 Option.redFlag 对应 */
  id: string;
  /** 警示标题 */
  title: string;
  /** 展开说明（关心口吻，不审判） */
  detail: string;
}

/** 等级档位 */
export interface Level {
  id: string;
  /** 称号，如「别人家的男朋友」 */
  title: string;
  /** 分数下限（含） */
  min: number;
  /** 分数上限（含） */
  max: number;
  /** 一句话结论（会出现在分享卡片上） */
  oneLiner: string;
  /** 结果页正文 */
  description: string;
  /** 该档位专属建议（1–3 条） */
  advice: string[];
}

/** 判定规则集：全部可配置 */
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

/**
 * 用户答案：题号 → 选项下标（0 起）
 * 使用稀疏对象，允许中途提交（未答题目会被排除出分母）
 */
export type Answers = Record<number, number | undefined>;

/** 单个维度的计分结果 */
export interface DimensionResult {
  id: DimensionId;
  label: string;
  short: string;
  weight: number;
  /** 该维得分 0–100（保留小数位见 rules.dimensionPrecision） */
  score: number;
  /** 该维实得分 */
  earned: number;
  /** 该维已答题满分 */
  max: number;
  /** 该维已答题数 */
  answered: number;
  /** 该维总题数 */
  total: number;
}

/** 命中的红牌 */
export interface RedFlagHit {
  id: string;
  questionId: number;
  optionIndex: number;
  title: string;
  detail: string;
}

/** 一致性校验结果 */
export interface ConsistencyResult {
  /** 平均差值（0–100 分制），无有效题对时为 null */
  meanDiff: number | null;
  /** 是否判定为低一致性 */
  isLow: boolean;
  /** 参与校验的题对数 */
  comparedPairs: number;
}

/** 计分结果 */
export interface ScoreResult {
  /** 最终总分 0–100（已应用红牌封顶与取整规则） */
  total: number;
  /** 未经任何封顶的原始加权分，用于调试与数据分析 */
  rawTotal: number;
  /** 是否因红牌被封顶 */
  isCapped: boolean;
  dimensions: DimensionResult[];
  /** 得分最低的维度（用于生成 Top 改进建议） */
  weakestDimensions: DimensionId[];
  /** 得分最高的维度 */
  strongestDimensions: DimensionId[];
  redFlags: RedFlagHit[];
  consistency: ConsistencyResult;
  level: Level;
  answeredCount: number;
  totalQuestions: number;
  isComplete: boolean;
}
