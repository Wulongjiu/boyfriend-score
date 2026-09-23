import type { DimensionId } from './types';

/**
 * 维度 → 改进建议库
 *
 * 结果页会把「最弱的 2 个维度」的建议拼在一起，因此每条建议都必须
 * 独立成立、可单独阅读，不依赖上下文。
 */
export const DIMENSION_ADVICE: Record<DimensionId, readonly string[]> = {
  communication: [
    '下次你觉得委屈的时候，先别自己消化：告诉他「我现在因为XX难过」，观察他是先接住你的情绪，还是先解释自己。',
    '反复出现的「你想多了」，比一次争吵更值得警惕——它让你的感受变得不被承认。',
  ],
  companionship: [
    '注意他用「忙」解释一切的频率。忙是真的，但一个人愿意为你腾出多少时间，也是真的。',
    '试试看「说了才做」还是「不说也会做」，这个差别就是用心程度。',
  ],
  boundary: [
    '边界感不是让你查手机，而是他会不会主动让你安心。需要你反复追问才肯保持距离的，就是问题本身。',
    '如果他总说「是你多想」，请把这句话记住：让你安心是他的责任，不是你的过度敏感。',
  ],
  future: [
    '可以自然地聊一次未来（比如明年怎么安排），看他的回答里有没有「我们」这个词。',
    '承诺不用很宏大，但要具体。只谈感觉不谈安排的未来，通常只是当下的安抚。',
  ],
  responsibility: [
    '把家务和生活琐事列一列，看看是不是默认落在你身上。默认，就是最容易被忽略的不公平。',
    '看他遇到麻烦时是处理还是抱怨——这决定了他以后能不能和你一起扛事。',
  ],
  ritual: [
    '仪式感的关键不是花了多少钱，而是他有没有记住「你在意什么」。可以从一件小事开始告诉他。',
    '如果他只在被提醒后才准备，那不是不懂，是没放心上。',
  ],
  family: [
    '看他会不会主动把你介绍给他的朋友和同事。藏起来的关系，通常有它被藏起来的原因。',
    '他在家人面前怎么介绍你、怎么维护你，是他对这段关系定位的直接体现。',
  ],
};

/**
 * 取指定维度中得分最低的几个维度，返回对应的改进建议
 * @param weakestIds 已按分数升序排列的维度 id
 * @param limit 最多返回几条建议
 */
export function getAdviceForDimensions(
  weakestIds: readonly DimensionId[],
  limit = 3,
): string[] {
  const advice: string[] = [];
  for (const id of weakestIds) {
    for (const item of DIMENSION_ADVICE[id]) {
      if (advice.length >= limit) return advice;
      advice.push(item);
    }
  }
  return advice;
}
