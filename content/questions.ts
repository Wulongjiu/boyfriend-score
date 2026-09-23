import type { Answers, Question } from '../lib/types';

/**
 * 题库 v1（27 题 · 原创撰写）
 *
 * 撰写规范：
 * - 题干用具体场景，不用抽象形容词（❌「他尊重你吗」→ ✅「他会怎么回应」）
 * - 每个选项都要写得像真的会发生，让用户能"对号入座"
 * - 分值 0–4，4 = 这项做得最好；选项顺序不必按分值排列（避免被猜规律）
 * - 红牌题的某个选项必须带 redFlag，且 id 存在于 lib/model.ts 的 RED_FLAGS
 * - validates 用于反向验证题：值 = 它所验证的题号
 *
 * ⚠️ 所有题目必须原创。可参考公开讨论中的"场景灵感"，但禁止改编受版权保护的商业量表。
 */
export const QUESTIONS: readonly Question[] = [
  /* ---------------- D1 情绪价值与沟通（Q1–Q5） ---------------- */
  {
    id: 1,
    dimension: 'communication',
    text: '你发了一条情绪不太好的消息，他通常多久回你？',
    options: [
      { text: '当天必回，而且会问你怎么了', score: 4 },
      { text: '忙完就回，可能隔几个小时', score: 3 },
      { text: '经常隔天，说没看到', score: 1 },
      { text: '看心情，有时候干脆不回', score: 0 },
    ],
  },
  {
    id: 2,
    dimension: 'communication',
    text: '你跟他吐槽今天很难受，他的第一反应是？',
    options: [
      { text: '先问「怎么啦」，让你说完', score: 4 },
      { text: '安静听着，然后想办法逗你开心', score: 3 },
      { text: '马上给你分析问题该怎么解决', score: 2 },
      { text: '说「这有什么大不了的」', score: 0 },
    ],
  },
  {
    id: 3,
    dimension: 'communication',
    text: '吵架之后，他一般会怎么做？',
    isRedFlag: true,
    options: [
      { text: '冷静一会儿，然后主动来找你说清楚', score: 4 },
      { text: '等你先开口，但会正常回你消息', score: 2 },
      { text: '一直讲道理，必须证明自己是对的', score: 1 },
      { text: '不回消息、不接电话，让你自己猜', score: 0, redFlag: 'cold_violence' },
    ],
  },
  {
    id: 4,
    dimension: 'communication',
    text: '他有没有过毫无解释就消失一整晚？',
    validates: 1,
    options: [
      { text: '从来没有，去哪都会说一声', score: 4 },
      { text: '有过一两次，事后解释清楚了', score: 3 },
      { text: '有，而且他觉得没必要解释', score: 1 },
      { text: '经常这样，我已经习惯了', score: 0 },
    ],
  },
  {
    id: 5,
    dimension: 'communication',
    text: '你因为他难过的时候，他最常说的一句话是？',
    isRedFlag: true,
    options: [
      { text: '「是我不好，我们聊聊」', score: 4 },
      { text: '「别难过了，我在」', score: 3 },
      { text: '「你想多了」', score: 0, redFlag: 'invalidate_feelings' },
      { text: '「你又来了」', score: 0, redFlag: 'invalidate_feelings' },
    ],
  },

  /* ---------------- D2 时间与陪伴质量（Q6–Q9） ---------------- */
  {
    id: 6,
    dimension: 'companionship',
    text: '你生病发烧的那天，他做的第一件事是？',
    options: [
      { text: '直接过来陪你，或者买药送到门口', score: 4 },
      { text: '电话陪着你，一直问你怎么样', score: 3 },
      { text: '让你多喝热水，早点休息', score: 2 },
      { text: '说他在忙，让你自己去医院', score: 0 },
    ],
  },
  {
    id: 7,
    dimension: 'companionship',
    text: '你们在一起的时候，他大部分时间在做什么？',
    options: [
      { text: '会放下手机，认真听你说话', score: 4 },
      { text: '偶尔看手机，但会回应你', score: 3 },
      { text: '全程打游戏，你说的他听一半', score: 1 },
      { text: '在一起也像各自一个人待着', score: 0 },
    ],
  },
  {
    id: 8,
    dimension: 'companionship',
    text: '他多久会主动约你见面（不是你提的）？',
    options: [
      { text: '基本每周都会主动安排', score: 4 },
      { text: '半个月左右会主动一次', score: 3 },
      { text: '大多数时候都是我先提', score: 1 },
      { text: '约他经常被推掉，说下次吧', score: 0 },
    ],
  },
  {
    id: 9,
    dimension: 'companionship',
    text: '他加班或者很忙的时候，你们的联系是？',
    validates: 8,
    options: [
      { text: '再忙也会抽空说一句，让我别等他', score: 4 },
      { text: '忙完会补一条消息解释', score: 3 },
      { text: '忙起来就彻底消失，事后也不提', score: 1 },
      { text: '忙的时候就把我排除在外了', score: 0 },
    ],
  },

  /* ---------------- D3 边界感与异性社交（Q10–Q12） ---------------- */
  {
    id: 10,
    dimension: 'boundary',
    text: '他手机经常有异性朋友的消息，他的态度是？',
    options: [
      { text: '主动跟我说这是谁，聊的什么', score: 4 },
      { text: '我问了就坦荡回答，不藏着', score: 3 },
      { text: '会回避，说「没什么」就过去了', score: 1 },
      { text: '不让看，还说我侵犯他隐私', score: 0 },
    ],
  },
  {
    id: 11,
    dimension: 'boundary',
    text: '他单独和异性出去吃饭、看电影，会怎么处理？',
    isRedFlag: true,
    options: [
      { text: '提前告诉你，问你在不在意', score: 4 },
      { text: '会事后说一句，觉得没什么', score: 3 },
      { text: '瞒着，被知道了才承认', score: 0, redFlag: 'ambiguous_boundary' },
      { text: '说我想多了，是他朋友而已', score: 0, redFlag: 'ambiguous_boundary' },
    ],
  },
  {
    id: 12,
    dimension: 'boundary',
    text: '他前任或暧昧对象找他，他会怎么做？',
    validates: 10,
    options: [
      { text: '告诉我，并且主动保持距离', score: 4 },
      { text: '简单回一下就结束', score: 3 },
      { text: '自己处理，不告诉我', score: 1 },
      { text: '还在联系，说只是朋友', score: 0 },
    ],
  },

  /* ---------------- D4 未来规划与承诺（Q13–Q15） ---------------- */
  {
    id: 13,
    dimension: 'future',
    text: '他有没有主动跟你聊过「以后」？',
    options: [
      { text: '会聊，还会说到具体的安排', score: 4 },
      { text: '偶尔提到，但比较模糊', score: 3 },
      { text: '只有我问的时候才说', score: 1 },
      { text: '一聊未来就转移话题', score: 0 },
    ],
  },
  {
    id: 14,
    dimension: 'future',
    text: '他身边的朋友、同事知道你的存在吗？',
    options: [
      { text: '他知道的人基本都知道我', score: 4 },
      { text: '几个要好的朋友知道', score: 3 },
      { text: '只有一两个知道，还说没必要说', score: 1 },
      { text: '几乎没人知道，他说不喜欢公开', score: 0 },
    ],
  },
  {
    id: 15,
    dimension: 'future',
    text: '他说过的承诺，兑现的比例大概是？',
    validates: 13,
    options: [
      { text: '基本都做到了', score: 4 },
      { text: '大部分能兑现', score: 3 },
      { text: '一半左右，有时候会忘', score: 1 },
      { text: '说得很好听，但基本没实现过', score: 0 },
    ],
  },

  /* ---------------- D5 责任分担与成长（Q16–Q20） ---------------- */
  {
    id: 16,
    dimension: 'responsibility',
    text: '你们一起生活或出去玩的时候，谁在操心安排？',
    options: [
      { text: '他会主动安排，也会分担琐事', score: 4 },
      { text: '两个人一起商量', score: 3 },
      { text: '基本我安排，他配合', score: 1 },
      { text: '全是我在做，他只负责出现', score: 0 },
    ],
  },
  {
    id: 17,
    dimension: 'responsibility',
    text: '他遇到工作或生活上的麻烦时，通常？',
    options: [
      { text: '自己想办法解决，需要时也会跟我商量', score: 4 },
      { text: '会跟我聊，一起想对策', score: 3 },
      { text: '主要是在抱怨，等着别人处理', score: 1 },
      { text: '把情绪发泄到我身上', score: 0, redFlag: 'intimidation' },
    ],
  },
  {
    id: 18,
    dimension: 'responsibility',
    text: '他对自己的工作和成长，是什么状态？',
    options: [
      { text: '有目标，也在认真推进', score: 4 },
      { text: '稳定踏实，没什么大起伏', score: 3 },
      { text: '经常换方向，但还愿意努力', score: 2 },
      { text: '长期不上进，也不觉得有问题', score: 0 },
    ],
  },
  {
    id: 19,
    dimension: 'responsibility',
    text: '他有没有在别人面前贬低过你、拿你开玩笑？',
    isRedFlag: true,
    options: [
      { text: '从来没有，在外人面前很护着我', score: 4 },
      { text: '开过玩笑，我提了之后就没再犯', score: 3 },
      { text: '经常开我玩笑，说「你怎么这么敏感」', score: 0, redFlag: 'public_putdown' },
      { text: '会在朋友面前说我不好', score: 0, redFlag: 'public_putdown' },
    ],
  },
  {
    id: 20,
    dimension: 'responsibility',
    text: '他生气或者压力大的时候，会怎么表现？',
    isRedFlag: true,
    options: [
      { text: '会说出来，不会迁怒于人', score: 4 },
      { text: '比较沉默，但不会冲我发火', score: 3 },
      { text: '会不耐烦、说话很难听', score: 1 },
      { text: '摔东西、吼我，让我有点害怕', score: 0, redFlag: 'intimidation' },
    ],
  },

  /* ---------------- D6 仪式感与礼物（Q21–Q23） ---------------- */
  {
    id: 21,
    dimension: 'ritual',
    text: '你随口提过想要某个东西，他后来？',
    options: [
      { text: '过段时间真的买给我了', score: 4 },
      { text: '记住了，会主动问我还要不要', score: 3 },
      { text: '当时说好，后来就忘了', score: 1 },
      { text: '完全没当回事', score: 0 },
    ],
  },
  {
    id: 22,
    dimension: 'ritual',
    text: '生日和纪念日，他一般是怎么过的？',
    options: [
      { text: '提前准备，还会给我惊喜', score: 4 },
      { text: '会记得，也会送礼物或吃饭', score: 3 },
      { text: '要我提醒才想起来', score: 1 },
      { text: '觉得这些形式没必要', score: 0 },
    ],
  },
  {
    id: 23,
    dimension: 'ritual',
    text: '他送礼物的风格更接近哪种？',
    validates: 21,
    options: [
      { text: '很懂我，送的都是我想要但没说的', score: 4 },
      { text: '会认真挑，偶尔不太合我口味', score: 3 },
      { text: '比较随意，能想到什么送什么', score: 2 },
      { text: '基本都是转账，或者干脆不送', score: 0 },
    ],
  },

  /* ---------------- D7 家人朋友与社交融合（Q24–Q27） ---------------- */
  {
    id: 24,
    dimension: 'family',
    text: '他家里人知道你吗？',
    options: [
      { text: '知道，还主动带我见过', score: 4 },
      { text: '知道，说过以后会带我见', score: 3 },
      { text: '不确定他有没有提过', score: 1 },
      { text: '明确说现在还不适合让家里知道', score: 0 },
    ],
  },
  {
    id: 25,
    dimension: 'family',
    text: '他朋友聚会的时候，他会怎么介绍你？',
    options: [
      { text: '很自然地介绍「这是我女朋友」', score: 4 },
      { text: '会带上我，但不太主动介绍', score: 3 },
      { text: '很少带我参加他的聚会', score: 1 },
      { text: '不让我去，说他们男生聚不方便', score: 0 },
    ],
  },
  {
    id: 26,
    dimension: 'family',
    text: '他和你家人、朋友的相处是？',
    options: [
      { text: '主动融入，会关心他们', score: 4 },
      { text: '礼貌配合，我安排他就去', score: 3 },
      { text: '不太愿意参与，能推就推', score: 1 },
      { text: '不喜欢我跟家人朋友走太近', score: 0 },
    ],
  },
  {
    id: 27,
    dimension: 'family',
    text: '你和他朋友的相处，给你的感觉是？',
    validates: 25,
    options: [
      { text: '他们都很接纳我，我也自在', score: 4 },
      { text: '关系一般，但没什么问题', score: 3 },
      { text: '他不太希望我和他朋友多接触', score: 1 },
      { text: '我能感觉到他们在回避我', score: 0 },
    ],
  },
] as const;

/** 题目总数 */
export const TOTAL_QUESTIONS = QUESTIONS.length;

/** 按题号索引，便于计分时 O(1) 查找 */
export const QUESTION_MAP: Record<number, Question> = QUESTIONS.reduce(
  (acc, q) => {
    acc[q.id] = q;
    return acc;
  },
  {} as Record<number, Question>,
);

/** 全部题号，按顺序 */
export const QUESTION_IDS: readonly number[] = QUESTIONS.map((q) => q.id);

/** 反向验证题对（正向题号 → 反向题号），用于一致性校验 */
export const VERIFICATION_PAIRS: readonly (readonly [number, number])[] =
  QUESTIONS.filter((q) => typeof q.validates === 'number').map(
    (q) => [q.validates as number, q.id] as const,
  );

/** 空答案集，用于初始化答题状态 */
export function createEmptyAnswers(): Answers {
  return {};
}
