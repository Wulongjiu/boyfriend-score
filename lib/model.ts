import type { Dimension, DimensionId, RedFlag, RuleSet } from './types';

/**
 * 测评模型配置 v2
 *
 * ── 理论骨架（2026-09 重构时核实过来源）────────────────────────────────
 *
 * 测量主轴是 **感知伴侣回应性（Perceived Partner Responsiveness, PPR）**：
 * 亲密关系的核心不是"他做了多少事"，而是"她是否感到被理解、被认可、被在乎"。
 * 来源：Reis & Shaver 人际亲密过程模型；Reis 等 PPR 量表把该构念拆成
 * 理解 / 认可 / 在乎 三个成分；该构念在中国被试中有验证版本
 * （C-PPRS, BMC Psychology 2022）。
 *
 * 次轴是 **冲突中的行为**：Gottman 的四骑士（批评、鄙视、防御、筑墙）与
 * 正负互动比，是长期关系走向的稳定预测指标。其中「鄙视」预测力最强，
 * 因此本模型把当众贬低、阴阳怪气单列为红牌。
 *
 * 第三个来源是 **负荷分配**：异性恋关系中的家务与"心理负荷"（记得、安排、
 * 操心）分配不均，会显著降低女性关系满意度。因此 D5 单独考察"谁在操心"，
 * 而不只是"谁做了活"。
 *
 * ⚠️ 本模型是**娱乐向**，不是临床量表。上述研究用于确定"问什么"，不用于诊断。
 *
 * ⚠️ 修改 DIMENSIONS 权重时必须保证 weight 合计 = 100，
 *    lib/scoring.ts 的单测会校验，改错会直接测试失败。
 */
export const DIMENSIONS: readonly Dimension[] = [
  {
    id: 'responsiveness',
    label: '情感回应性',
    short: '回应',
    weight: 22,
    description: '你说话的时候，他是在听内容，还是在听你的情绪。',
    explanation:
      '这是全模型权重最高的一项。研究里最稳的结论是：关系好不好，取决于她是否感到被理解、被认可、被在乎——而不是他做了多少事。',
  },
  {
    id: 'conflict',
    label: '冲突修复力',
    short: '冲突',
    weight: 16,
    description: '吵完之后，是有人先回来，还是你一个人等。',
    explanation:
      '不吵架的关系不存在。真正拉开差距的是"吵完能不能修"——修不了的关系，会一次次卡在同一个地方。',
  },
  {
    id: 'consistency',
    label: '言行一致',
    short: '一致',
    weight: 14,
    description: '他说过的话，有多少变成了现实。',
    explanation:
      '承诺是否兑现，比承诺有多大更能预测关系稳定。落差感累积起来，就是那句"我不能再信你了"。',
  },
  {
    id: 'boundary',
    label: '边界与安全感',
    short: '边界',
    weight: 14,
    description: '他有没有主动让你安心，而不是让你一直追问。',
    explanation:
      '让你安心是他的责任。需要反复追问才肯保持距离的关系，会让你长期处在警戒状态。',
  },
  {
    id: 'load',
    label: '负荷分担',
    short: '分担',
    weight: 14,
    description: '生活里"记得、安排、操心"这部分，是谁在做。',
    explanation:
      '研究显示，异性恋关系里家务与心理负荷分配不均会明显拉低女性的关系满意度。做没做活看得见，操心看不见——所以这里专门问"谁在记"。',
  },
  {
    id: 'future',
    label: '未来与承诺',
    short: '未来',
    weight: 12,
    description: '他的计划里，有没有自动把你算进去。',
    explanation: '不是逼婚，而是看他谈未来时用的是"我"还是"我们"。',
  },
  {
    id: 'integration',
    label: '社会融合',
    short: '融合',
    weight: 8,
    description: '他愿不愿意让你进入他的世界，也走进你的。',
    explanation:
      '被藏起来的关系，通常有它被藏起来的原因。不是要求他到处宣布，而是看他会不会自然地把"我们"带进他的生活。',
  },
] as const;

export const DIMENSION_MAP: Record<DimensionId, Dimension> = DIMENSIONS.reduce(
  (acc, d) => {
    acc[d.id] = d;
    return acc;
  },
  {} as Record<DimensionId, Dimension>,
);

/**
 * 红牌库
 *
 * 设计原则（v2 收紧）：
 *  - 只有"研究上明确预示关系恶化"或"涉及人身安全"的行为才设为红牌
 *  - 不用红牌表达价值判断（例如"不主动报备"不是红牌，只是边界维度低分）
 *  - 命中红牌 → 总分封顶，避免被"他平时挺好"抵消
 */
export const RED_FLAGS: readonly RedFlag[] = [
  {
    id: 'stonewalling',
    title: '筑墙：用沉默惩罚你',
    detail:
      '吵架后长时间不理你、不回消息、让你自己猜，直到你先低头。这不是"他不会表达"——沉默在这里是一种惩罚，代价是你一个人在消化两个人的情绪。',
    basis:
      'Gottman 四骑士之一「筑墙」（stonewalling）：关闭沟通通道，是关系恶化的稳定前兆。',
  },
  {
    id: 'contempt',
    title: '鄙视：让你觉得自己很差',
    detail:
      '在别人面前拿你开玩笑、贬低你，或者用"你怎么这么敏感"堵你的嘴。鄙视和批评不一样——批评针对行为，鄙视针对你这个人。',
    basis: 'Gottman 研究中，「鄙视」是四骑士里对关系走向预测力最强的一项。',
  },
  {
    id: 'invalidation',
    title: '否定你的感受',
    detail:
      '你说难过，他回"你想多了""你又来了""这有什么大不了的"。次数多了，你会开始怀疑自己的感受是不是错的——这是最伤人也最难察觉的一种。',
    basis:
      '与感知伴侣回应性（理解/认可/在乎）直接冲突：感受被否定时，亲密感无法建立。',
  },
  {
    id: 'boundary_violation',
    title: '边界模糊且倒打一耙',
    detail:
      '和异性维持在让你不舒服的距离；你提出来，他说是你多想、是你管太多。让你安心本该是他的责任，而不是你的过度敏感。',
    basis: '安全感缺失会让人长期处于警戒状态，是关系满意度下降的直接来源。',
  },
  {
    id: 'intimidation',
    title: '迁怒与失控',
    detail:
      '摔东西、吼你、让你感到害怕。不管事后他怎么解释、怎么道歉，让你害怕这件事本身就足够重要。你的安全永远排在第一位。',
    basis: '涉及人身安全时不做任何权衡，优先级高于其余所有维度。',
  },
] as const;

export const RED_FLAG_MAP: Record<string, RedFlag> = RED_FLAGS.reduce(
  (acc, f) => {
    acc[f.id] = f;
    return acc;
  },
  {} as Record<string, RedFlag>,
);

/** 判定规则 */
export const RULES: RuleSet = {
  redFlagScoreCap: 45,
  consistencyThreshold: 28,
  consistencyHint:
    '你的答案里有几处前后不太一致，可能是有些题不太好选。结果仅供参考，别太当真～',
  rounding: 'round',
  dimensionPrecision: 1,
};

/**
 * 量表上下限（分数校准用）
 *
 * ── 为什么需要校准 ────────────────────────────────────────────────────
 * v2 的题目是**多维度加权**的，选项权重不是非 0 即 1，"最差选项"往往仍有
 * 0.1–0.3 的权重（例如"你不提他就没注意"确实比"他说还行吧"略好一点）。
 * 这带来两个后果：
 *   1. 七维不存在同时满分的组合（存在真实取舍，见下），理论最高分 < 100；
 *   2. 全部选最差也拿不到 0 分，理论最低分 > 0。
 *
 * 实测（scripts/find-score-ceiling.mjs 与 find-score-floor.mjs，
 * 贪心 + 局部搜索，均 ≤2 轮收敛）：
 *   最高可达 = 99.15（情感回应性最高只能到 96.12，它权重 22%，影响最大）
 *   最低可达 = 5.63
 *
 * 若不校准，「满分 100」与「0 分」都不可达，量表两端各有一段死区，
 * 「95+ 人间理想」这一档也会失去意义。
 *
 * ⚠️ 改动题库后必须重新跑上面两个脚本并更新这两个常量，
 *    否则分数会整体偏高或偏低。tests/scoring.test.ts 有对应断言。
 */
export const SCORE_CEILING = 99.15;
export const SCORE_FLOOR = 5.63;

/** 合格线：低于此分进入「需要认真聊一次」及以下 */
export const PASS_LINE = 70;
