import { TOTAL_QUESTIONS } from '../content/questions';

/**
 * 品牌与文案配置（单一事实来源）
 *
 * 命名已拍板：男友生存指数（Day 1 决策）
 * 语调约定：「生存」是玩梗，不是威胁。文案要好玩、站她这边，
 * 不允许把低分写成"这男的不能要"，也不允许把高分写成"你不配"。
 *
 * 题量一律从 TOTAL_QUESTIONS 动态取，不写死——v1 曾把"27 道题"硬编码在
 * 5 处用户可见文案里，题库扩到 36 题时全部过期。测试有断言防止再漂移。
 */
export const BRAND = {
  /** 产品名 */
  name: '男友生存指数',
  /** 英文/项目代号，用于仓库、域名、埋点前缀 */
  slug: 'bf-survival-index',
  /** 一句话定位（首页首屏） */
  tagline: `3 分钟，回答 ${TOTAL_QUESTIONS} 道关于他的日常，看看他能不能活下来。`,
  /** 更克制的副标题，用于分享卡片与 OG 图 */
  subtitle: `${TOTAL_QUESTIONS} 道关于他的日常，3 分钟得出一个分数。`,
  /** 首页按钮 */
  startCta: '开始测测他',
  /** 卡片署名（分享卡片右下角） */
  signature: '男友生存指数 · 玩梗不判决',
  /** 免责声明，首页底部与结果页必须出现 */
  disclaimer: '本测评为娱乐向内容，结果不构成心理学或医学诊断建议。',
  /** 小红书导流话术（站内合规：不放二维码/不外链） */
  xhsKeyword: '男友生存指数',
} as const;

export type Brand = typeof BRAND;
