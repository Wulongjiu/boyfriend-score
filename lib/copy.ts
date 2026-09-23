import { BRAND } from './brand';
import { TOTAL_QUESTIONS } from '../content/questions';

/**
 * 全站文案集中管理
 *
 * 为什么集中：文案是这个产品的核心资产，改文案的频率远高于改代码。
 * 集中后可以整体审校语气（尤其是"生存指数"带来的玩梗边界），
 * 也方便 Day 12 做分享卡片时复用同一套文字。
 */
export const COPY = {
  home: {
    eyebrow: `${TOTAL_QUESTIONS} 道题 · 3 分钟 · 不用注册`,
    h1: '他能不能活下来，先测了再说。',
    sub: `${TOTAL_QUESTIONS} 道关于他日常的选择题。答完你会得到一个分数、七个维度的拆解、一个属于你们的关系原型，和一句你早就知道、但一直没说出口的话。`,
    cta: '开始测测他',
    ctaSub: '不收集手机号，不保存你说过的话',
    trust: [
      { icon: '🔒', title: '不收集隐私', desc: '不需要注册登录，不存你的原始答案' },
      { icon: '⏱', title: '3 分钟', desc: `${TOTAL_QUESTIONS} 道选择题，中途退出可以接着答` },
      { icon: '📊', title: '有依据', desc: '7 个维度加权计分，不是随机出分' },
    ],
    mockTitle: '测完你会看到',
    mockNote: '（下面是示例效果，不是你的结果）',
    sections: {
      howTitle: '它是怎么算的',
      howDesc:
        '不是让你凭感觉打分，而是把「他做了什么」拆成 7 个维度分别计分，再按重要程度上权重。',
      weightsTitle: '七个维度与权重',
      levelsTitle: '六个等级',
      faqTitle: '你可能想问',
    },
    faq: [
      {
        q: '这算心理测评吗？',
        a: '不算。这是一个娱乐向的小测试，结果不代表任何专业诊断。如果你正在经历让你害怕或长期难受的事，请找专业人士聊聊，那比任何分数都重要。',
      },
      {
        q: '他会知道我的答案吗？',
        a: '不会。我们不保存你的原始答案，也不要求登录。分享出去的只有分数和称号，看不到你每一题选了什么。',
      },
      {
        q: '分数低说明该分手吗？',
        a: `不说明。分数只反映你在这 ${TOTAL_QUESTIONS} 个场景里的感受，它是一面镜子，不是一个判决。要不要继续，只有你能决定。`,
      },
      {
        q: '为什么有"红线"这种设置？',
        a: '因为有些行为不该被"他平时对我还挺好"抵消。命中红线会让总分封顶，是为了不让冷暴力加上送礼物得出一个好看的分。',
      },
    ],
    finalCta: '测一测他',
    footerNote: '给自己测也是一次整理思绪的过程。答完记得对自己好一点。',
  },

  quiz: {
    title: '如实回答就好',
    subtitle: '没有标准答案，选最接近的那个',
    progressLabel: (current: number, total: number) => `第 ${current} / ${total} 题`,
    prev: '上一题',
    next: '下一题',
    seeResult: '看结果',
    resumeHint: (count: number) => `已答 ${count} 题，接着往下就好`,
    restartHint: '重新开始',
    tooFastHint: '答得这么快？再确认一下也可以',
  },

  result: {
    scoreLabel: '他的生存指数',
    outOf: '满分 100',
    cappedNotice: '因为命中了下方红线，总分被限制在 45 分以内',
    radarTitle: '七个维度',
    dimensionLowTag: '这块最需要聊',
    redFlagTitle: '有一个地方，值得你认真看一眼',
    redFlagSub: '不是让你立刻做决定，是提醒你这不该被忽略',
    redFlagQuestionPrefix: '对应第',
    redFlagQuestionSuffix: '题',
    adviceTitle: '接下来可以做的',
    consistencyTitle: '温馨提示',
    shareTitle: '把结果存下来',
    saveCard: '保存分享卡片',
    savingCard: '正在生成…',
    copyLink: '复制结果链接',
    copied: '已复制',
    restart: '重新测一次',
    backHome: '回到首页',
    disclaimer: '本测评为娱乐向内容，结果不构成心理学或医学诊断建议。',
    shareText: (score: number, level: string) =>
      `我在「${BRAND.name}」上给他测了一下：${score} 分，${level}。你也来测测？`,
  },

  common: {
    loading: '加载中…',
    notFoundTitle: '这条链接读不出结果',
    notFoundDesc: '可能是链接被截断了，或者已经过期。重新测一次就好，只要 3 分钟。',
    notFoundCta: '重新测一次',
    brand: BRAND.name,
    signature: BRAND.signature,
    disclaimer: BRAND.disclaimer,
  },
} as const;
