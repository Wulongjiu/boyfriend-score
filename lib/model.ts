import type { Dimension, DimensionId, RedFlag, RuleSet } from './types';

/**
 * 测评模型配置（产品可调参数集中在此处）
 *
 * ⚠️ 修改 DIMENSIONS 权重时必须保证 weight 合计 = 100，
 *    lib/scoring.ts 的单测会校验这一点，改错会直接测试失败。
 */
export const DIMENSIONS: readonly Dimension[] = [
  {
    id: 'communication',
    label: '情绪价值与沟通',
    short: '沟通',
    weight: 20,
    description: '他能不能接住你的情绪，会不会把问题变成你的问题。',
  },
  {
    id: 'companionship',
    label: '时间与陪伴质量',
    short: '陪伴',
    weight: 15,
    description: '不是在一起的时间长，而是他在的时候是不是真的在。',
  },
  {
    id: 'boundary',
    label: '边界感与异性社交',
    short: '边界',
    weight: 15,
    description: '他有没有把「我们」当成一件需要主动维护的事。',
  },
  {
    id: 'future',
    label: '未来规划与承诺',
    short: '未来',
    weight: 15,
    description: '他的未来里，有没有给你留位置。',
  },
  {
    id: 'responsibility',
    label: '责任分担与成长',
    short: '责任',
    weight: 15,
    description: '生活是两个人扛，还是你一个人扛。',
  },
  {
    id: 'ritual',
    label: '仪式感与礼物',
    short: '仪式',
    weight: 10,
    description: '他有没有在用心，而不只是在花钱。',
  },
  {
    id: 'family',
    label: '家人朋友与社交融合',
    short: '社交',
    weight: 10,
    description: '他愿不愿意让你进入他的世界。',
  },
] as const;

export const DIMENSION_MAP: Record<DimensionId, Dimension> = DIMENSIONS.reduce(
  (acc, d) => {
    acc[d.id] = d;
    return acc;
  },
  {} as Record<DimensionId, Dimension>,
);

/** 红牌库：命中后在结果页单独展示，关心口吻，不审判、不替用户下结论 */
export const RED_FLAGS: readonly RedFlag[] = [
  {
    id: 'cold_violence',
    title: '冷暴力',
    detail:
      '吵架后长时间不理你、让你自己猜、等你去哄——这不是"他不会表达"，是让你独自承担情绪。长期这样，你会越来越小心，而不是越来越放松。',
  },
  {
    id: 'invalidate_feelings',
    title: '否定你的感受',
    detail:
      '你说难过，他回"你想多了""你又来了"——把你的情绪当成问题本身。被反复这样回应的人，最后会开始怀疑自己的感受，这是需要认真对待的事。',
  },
  {
    id: 'ambiguous_boundary',
    title: '边界模糊',
    detail:
      '和异性维持在让你不舒服的距离，还说"是你多想"。一段关系里，让你安心是他的责任，不是你的过度敏感。',
  },
  {
    id: 'public_putdown',
    title: '当众贬低',
    detail:
      '在朋友面前拿你开玩笑、说你的短处——"玩笑"让你不舒服，那它就不是玩笑。被亲近的人贬低，比陌生人的伤害更久。',
  },
  {
    id: 'intimidation',
    title: '迁怒与失控',
    detail:
      '摔东西、迁怒、让你害怕——不管事后他怎么解释，让你感到害怕这件事本身就足够重要。你的安全永远排在第一位。',
  },
] as const;

export const RED_FLAG_MAP: Record<string, RedFlag> = RED_FLAGS.reduce(
  (acc, f) => {
    acc[f.id] = f;
    return acc;
  },
  {} as Record<string, RedFlag>,
);

/** 判定规则：可配置，改这里不需要动计分代码 */
export const RULES: RuleSet = {
  redFlagScoreCap: 45,
  consistencyThreshold: 28,
  consistencyHint:
    '你的答案里有一些前后不太一致的地方，可能是有些题不太好选。结果仅供参考，别太当真～',
  rounding: 'round',
  dimensionPrecision: 1,
};

/** 每道题分值上限（选项 score 的最大值） */
export const MAX_OPTION_SCORE = 4;

/** 合格线：低于此分进入"需要认真聊一次"及以下 */
export const PASS_LINE = 70;
