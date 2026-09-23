import type { Answers, Question } from '../lib/types';

/**
 * 题库 v2（36 题 · 原创撰写）
 *
 * ── v1 → v2 的改动（针对 v1 被指出的三个问题）─────────────────────────
 *
 * **问题一：指向性太明显。** v1 的选项按分值从优到劣排列，用户能猜出"哪个是
 * 正确答案"，于是测的是她的期待而不是她观察到的现实。
 * → v2 的对策：
 *   1. 每题选项**打乱顺序**，最优项刻意不固定在第 1 位；
 *   2. 选项只写**行为事实**（"他会……"），不写"好/坏"，判断留给计分；
 *   3. 加入**权衡型选项**（都有代价，没有明显更优），降低"答对"的可得性；
 *   4. 避免出现"尊重""负责"这类带价值暗示的词。
 *
 * **问题二：一问一维度太浅。** v1 每题只喂一个维度，等于 7 个独立小测拼接。
 * → v2 的对策：每个选项携带 `weights`，一题可同时给 2–3 个维度不同权重，
 *   从而捕捉跨维度行为（例：生病时的反应同时反映回应性与负荷分担）。
 *
 * **问题三：缺乏理论与结构。** → v2 以感知伴侣回应性为主轴（rationale 标注依据），
 *   冲突题取材 Gottman 四骑士，负荷题取材心理负荷研究。
 *
 * ── 撰写规范 ──────────────────────────────────────────────────────────
 * - 题干必须是**可观察的场景**，不能是可评价的形容词
 *   （❌「他尊重你吗」→ ✅「你想去的地方他不想去时，通常怎么定」）
 * - weights 取值 0–1，1 = 该维度上表现最好，0 = 最差
 * - 红牌选项必须带 redFlag，且 id 存在于 lib/model.ts 的 RED_FLAGS
 * - 反向验证题用 `validates` 指向正向题号，用于检测乱答
 * - ⚠️ 所有题目原创。可参考公开讨论的场景灵感，禁止改编受版权保护的商业量表
 *   （PPR 量表等仅用于确定"测什么"，不得照搬条目文字）。
 */
export const QUESTIONS: readonly Question[] = [
  /* ══════════════ D1 情感回应性（Q1–Q7）══════════════ */
  {
    id: 1,
    dimension: 'responsiveness',
    text: '你发消息说「今天有点累」，他通常回你什么？',
    rationale: '回应性最日常的观察点：他接的是信息，还是情绪。',
    options: [
      { text: '「怎么了？跟我说说」', weights: { responsiveness: 1, conflict: 0.6 } },
      { text: '「累就早点睡」', weights: { responsiveness: 0.4 } },
      { text: '回一个表情包', weights: { responsiveness: 0.2 } },
      { text: '「谁不累啊」', weights: { responsiveness: 0 }, redFlag: 'invalidation' },
    ],
  },
  {
    id: 2,
    dimension: 'responsiveness',
    text: '你跟他讲一件今天让你很烦的事，讲到一半他会？',
    rationale: '区分「解决问题」与「接住情绪」——很多矛盾来自前者被误当成不爱。',
    options: [
      { text: '先问你「是不是特别委屈」', weights: { responsiveness: 1 } },
      { text: '安静听完，然后问你要不要建议', weights: { responsiveness: 0.9 } },
      { text: '直接告诉你该怎么处理', weights: { responsiveness: 0.5, load: 0.5 } },
      { text: '边听边看手机', weights: { responsiveness: 0.1 } },
    ],
  },
  {
    id: 3,
    dimension: 'responsiveness',
    text: '你心情不好，但没直说。他一般？',
    rationale: '感知力：不需要明说也能被察觉，是「被在乎」的核心体验。',
    options: [
      { text: '会问「你是不是不太开心」', weights: { responsiveness: 1 } },
      { text: '看得出来，会主动逗你', weights: { responsiveness: 0.8 } },
      { text: '完全没察觉，跟平时一样', weights: { responsiveness: 0.2 } },
      { text: '察觉到了，但装作没看见', weights: { responsiveness: 0.1 } },
    ],
  },
  {
    id: 4,
    dimension: 'responsiveness',
    text: '你换了个新发型，或者买了件新衣服，他？',
    rationale: '关注度：注意外表变化是最低成本的「我在看你」信号。',
    options: [
      { text: '一眼就发现，还会具体说出哪里不一样', weights: { responsiveness: 1 } },
      { text: '当场没发现，你提了之后认真夸', weights: { responsiveness: 0.7 } },
      { text: '你不提他就一直没注意', weights: { responsiveness: 0.3 } },
      { text: '发现了，但说「还行吧」', weights: { responsiveness: 0.2 } },
    ],
  },
  {
    id: 5,
    dimension: 'responsiveness',
    text: '你们待在一起，他一般是什么状态？',
    rationale: '陪伴质量的关键是「在场感」，不是时长。',
    options: [
      { text: '手机放着，会看着你说话', weights: { responsiveness: 1, load: 0.4 } },
      { text: '各做各的，但你要说话他会停下手上的事', weights: { responsiveness: 0.8 } },
      { text: '主要在看手机或打游戏', weights: { responsiveness: 0.2 } },
      { text: '在同一个空间，但基本没交流', weights: { responsiveness: 0.1 } },
    ],
  },
  {
    id: 6,
    dimension: 'responsiveness',
    text: '你因为他说的一句话难受了，他？',
    rationale: '承接情绪的能力，比道歉本身更重要。',
    options: [
      { text: '会问你「哪句话让你不舒服了」', weights: { responsiveness: 1, conflict: 0.9 } },
      { text: '说「我没那个意思」，然后不往下聊', weights: { responsiveness: 0.4, conflict: 0.3 } },
      { text: '说「你想多了」', weights: { responsiveness: 0, conflict: 0 }, redFlag: 'invalidation' },
      { text: '说「那我以后不说了」', weights: { responsiveness: 0.2, conflict: 0.2 } },
    ],
  },
  {
    id: 7,
    dimension: 'responsiveness',
    text: '他最近一次夸你，是关于什么？',
    rationale: '被认可感：只夸外表、或只在需要你时夸，与真正看见对方不同。',
    options: [
      { text: '具体到某件事，比如「你今天处理得特别好」', weights: { responsiveness: 1 } },
      { text: '关于你的性格或做事方式', weights: { responsiveness: 0.9 } },
      { text: '关于外表', weights: { responsiveness: 0.6 } },
      { text: '想不起来他最近夸过', weights: { responsiveness: 0.1 } },
    ],
  },

  /* ══════════════ D2 冲突修复力（Q8–Q12、Q36）══════════════ */
  {
    id: 8,
    dimension: 'conflict',
    text: '最近一次你们吵架，最后是怎么结束的？',
    rationale: 'Gottman：关系不看吵不吵，看能不能修复（repair）。',
    options: [
      {
        text: '他先来找我，或者我找他之后他愿意好好说',
        weights: { conflict: 1, responsiveness: 0.7 },
      },
      { text: '各自冷静了一会儿，然后像没事一样继续', weights: { conflict: 0.5 } },
      { text: '不了了之，谁也没再提', weights: { conflict: 0.3 } },
      { text: '他一直在讲道理，最后我妥协了', weights: { conflict: 0.2, responsiveness: 0.2 } },
    ],
  },
  {
    id: 9,
    dimension: 'conflict',
    text: '你们意见不合的时候，他通常？',
    options: [
      { text: '会问「你更在意的是哪一点」', weights: { conflict: 1, responsiveness: 0.8 } },
      { text: '会争，但争完能听进去一部分', weights: { conflict: 0.6 } },
      { text: '一定要说服我，证明他是对的', weights: { conflict: 0.2, responsiveness: 0.2 } },
      { text: '直接不聊了，说「随便你」', weights: { conflict: 0.1 } },
    ],
  },
  {
    id: 10,
    dimension: 'conflict',
    text: '他做错事之后，一般怎么处理？',
    options: [
      { text: '承认得挺直接，会说下次怎么改', weights: { conflict: 1, consistency: 0.8 } },
      { text: '会道歉，但下次还会犯', weights: { conflict: 0.4, consistency: 0.2 } },
      { text: '说「行了行了别说了」', weights: { conflict: 0.2, responsiveness: 0.2 } },
      { text: '很少道歉，觉得事情没那么严重', weights: { conflict: 0.1 } },
    ],
  },
  {
    id: 11,
    dimension: 'conflict',
    text: '你生气的时候，他会怎么反应？',
    options: [
      { text: '先哄，然后会问清楚到底怎么回事', weights: { responsiveness: 1, conflict: 1 } },
      { text: '会有点慌，一直问你「怎么了」', weights: { responsiveness: 0.7, conflict: 0.6 } },
      { text: '比你还生气，觉得你小题大做', weights: { conflict: 0.1, responsiveness: 0.1 } },
      { text: '不说话，等你自己消气', weights: { conflict: 0.2, responsiveness: 0.2 } },
    ],
  },
  {
    id: 12,
    dimension: 'conflict',
    text: '你们冷战最长的一次，持续了多久？',
    rationale: '测筑墙（stonewalling）：冷战的时长本身就是信号。',
    options: [
      { text: '没有冷战过，都是当场或当天说开', weights: { conflict: 1, responsiveness: 0.6 } },
      { text: '一两天，之后有人先开口', weights: { conflict: 0.7 } },
      { text: '一周左右', weights: { conflict: 0.3 } },
      {
        text: '超过一周，最后是我先低头的',
        weights: { conflict: 0, responsiveness: 0 },
        redFlag: 'stonewalling',
      },
    ],
  },

  /* ══════════════ D3 言行一致（Q13–Q17）══════════════ */
  {
    id: 13,
    dimension: 'consistency',
    text: '他随口承诺的小事（「我明天给你带那个」「周末陪你去」），兑现率大概是？',
    options: [
      { text: '基本都做到了', weights: { consistency: 1 } },
      { text: '大部分能，偶尔忘', weights: { consistency: 0.7 } },
      { text: '一半左右', weights: { consistency: 0.4 } },
      { text: '说得挺好，但基本没下文', weights: { consistency: 0 } },
    ],
  },
  {
    id: 14,
    dimension: 'consistency',
    text: '他说过要改的事（比如少打游戏、多陪你），现在？',
    options: [
      { text: '确实改了，能看出来在努力', weights: { consistency: 1, responsiveness: 0.6 } },
      { text: '改了一阵，又回到原样', weights: { consistency: 0.3 } },
      { text: '当时答应了，其实没动', weights: { consistency: 0.2 } },
      { text: '我说的那些他不太当回事', weights: { consistency: 0 } },
    ],
  },
  {
    id: 15,
    dimension: 'consistency',
    text: '你随口提过想要的东西，过段时间他？',
    options: [
      { text: '真的买给我了，我都没再提', weights: { responsiveness: 1, consistency: 1 } },
      { text: '记住了，会问我还要不要', weights: { responsiveness: 0.8, consistency: 0.7 } },
      { text: '当时说好，后来忘了', weights: { responsiveness: 0.3, consistency: 0.3 } },
      { text: '不记得我提过', weights: { responsiveness: 0.1, consistency: 0.1 } },
    ],
  },
  {
    id: 16,
    dimension: 'consistency',
    text: '他答应陪你做的事，临时有别的安排时会？',
    options: [
      { text: '先问你的意见，再决定去不去', weights: { consistency: 1, responsiveness: 0.7 } },
      { text: '会解释原因，然后改约时间', weights: { consistency: 0.7 } },
      { text: '直接去，事后跟你说一声', weights: { consistency: 0.2, responsiveness: 0.2 } },
      { text: '经常临时变卦，我都习惯了', weights: { consistency: 0 } },
    ],
  },
  {
    id: 17,
    dimension: 'consistency',
    text: '他说「我在忙」的时候，你知道他大概在忙什么吗？',
    rationale: '信息透明度：不知道对方状态，是关系里最常见的不安全感来源。',
    options: [
      { text: '知道，他平时会说自己在做什么', weights: { consistency: 1, responsiveness: 0.5 } },
      { text: '大概知道，工作或家里的事', weights: { consistency: 0.7 } },
      { text: '不太清楚，只知道他忙', weights: { consistency: 0.3 } },
      { text: '不知道，问了也说得含糊', weights: { consistency: 0.1 } },
    ],
  },

  /* ══════════════ D4 边界与安全感（Q18–Q22）══════════════ */
  {
    id: 18,
    dimension: 'boundary',
    text: '他身边走得近的异性朋友，你是怎么知道的？',
    options: [
      { text: '他主动跟我提过', weights: { boundary: 1, responsiveness: 0.6 } },
      { text: '一起玩的时候见过', weights: { boundary: 0.8 } },
      { text: '我自己发现的', weights: { boundary: 0.2 } },
      { text: '到现在也不太清楚有哪些人', weights: { boundary: 0.1 } },
    ],
  },
  {
    id: 19,
    dimension: 'boundary',
    text: '他单独和异性出去，会怎么处理？',
    options: [
      { text: '提前告诉我，还问我要不要一起', weights: { boundary: 1, responsiveness: 0.7 } },
      { text: '提前说一声，觉得没什么', weights: { boundary: 0.8 } },
      { text: '事后提一句', weights: { boundary: 0.3 } },
      {
        text: '瞒着，被我知道了才承认，还说是我多想',
        weights: { boundary: 0 },
        redFlag: 'boundary_violation',
      },
    ],
  },
  {
    id: 20,
    dimension: 'boundary',
    text: '你表达过对某个女生的不舒服，他之后？',
    options: [
      {
        text: '主动拉开了距离，后来还主动跟我说进展',
        weights: { boundary: 1, responsiveness: 0.9 },
      },
      { text: '嘴上说知道了，行为上看不出变化', weights: { boundary: 0.3 } },
      { text: '觉得我管太多，说他们只是朋友', weights: { boundary: 0.1 } },
      { text: '为那个女生跟我争过', weights: { boundary: 0 } },
    ],
  },
  {
    id: 21,
    dimension: 'boundary',
    text: '他手机放在桌上，来消息时一般？',
    rationale: '注意：这里测的是「你是否需要警惕」，不是「该不该看手机」。',
    options: [
      { text: '他不在意，有时候还会念给我听', weights: { boundary: 1 } },
      { text: '正常放着，我不会想去看', weights: { boundary: 0.9 } },
      { text: '屏幕扣着放，或者反扣过来', weights: { boundary: 0.3 } },
      { text: '你一靠近就收起来', weights: { boundary: 0.1 } },
    ],
  },
  {
    id: 22,
    dimension: 'boundary',
    text: '他晚上出去跟朋友玩，一般会？',
    options: [
      { text: '会说去哪、和谁、大概几点回', weights: { boundary: 1, consistency: 0.6 } },
      { text: '会说一声「我出去一下」', weights: { boundary: 0.7 } },
      { text: '去了之后我发消息才知道', weights: { boundary: 0.3 } },
      { text: '一整晚联系不上，第二天才回', weights: { boundary: 0, consistency: 0 } },
    ],
  },

  /* ══════════════ D5 负荷分担（Q23–Q27）══════════════ */
  {
    id: 23,
    dimension: 'load',
    text: '你们一起出去玩，行程一般是谁安排的？',
    options: [
      { text: '他安排得比我细，我只负责出现', weights: { load: 1, responsiveness: 0.5 } },
      { text: '一起商量，各管一部分', weights: { load: 0.9 } },
      { text: '我提需求，他执行', weights: { load: 0.4 } },
      { text: '基本都是我查、我订、我提醒', weights: { load: 0 } },
    ],
  },
  {
    id: 24,
    dimension: 'load',
    text: '纪念日、生日、要送谁礼物这类事，是谁在记？',
    rationale: '心理负荷的经典测法：不是「谁做」，而是「谁记得」。',
    options: [
      {
        text: '他记得比我还清楚，会提前问我怎么安排',
        weights: { load: 1, responsiveness: 0.6 },
      },
      { text: '各记各的，他会记得他家那边', weights: { load: 0.8 } },
      { text: '主要我记，他会配合', weights: { load: 0.3 } },
      { text: '全靠我，他连我们纪念日都记不住', weights: { load: 0 } },
    ],
  },
  {
    id: 25,
    dimension: 'load',
    text: '你生病发烧那天，实际发生了什么？',
    options: [
      { text: '他过来照顾，或者把药和吃的送到门口', weights: { load: 1, responsiveness: 1 } },
      { text: '一直打电话问情况，让我有事叫他', weights: { load: 0.6, responsiveness: 0.9 } },
      { text: '让我多喝热水早点睡', weights: { load: 0.2, responsiveness: 0.3 } },
      { text: '那天他在忙，我自己去的医院', weights: { load: 0, responsiveness: 0.1 } },
    ],
  },
  {
    id: 26,
    dimension: 'load',
    text: '你们之间的小矛盾，一般是谁先察觉、谁先提？',
    options: [
      {
        text: '他比较敏感，常是他先问我「是不是不高兴」',
        weights: { load: 1, responsiveness: 1, conflict: 0.8 },
      },
      { text: '谁先发现谁提，不一定', weights: { load: 0.7, responsiveness: 0.7 } },
      { text: '基本都是我先提', weights: { load: 0.2, responsiveness: 0.3 } },
      { text: '我提了也没用，他不太回应', weights: { load: 0, responsiveness: 0.1 } },
    ],
  },
  {
    id: 27,
    dimension: 'load',
    text: '他工作或生活上遇到麻烦的时候，会？',
    options: [
      { text: '自己先处理，需要我时明确说需要什么', weights: { load: 1, responsiveness: 0.6 } },
      { text: '会跟我聊，一起想办法', weights: { load: 0.9, responsiveness: 0.8 } },
      { text: '主要是抱怨，等我给建议', weights: { load: 0.3 } },
      { text: '把情绪发到我身上', weights: { load: 0, conflict: 0 }, redFlag: 'intimidation' },
    ],
  },

  /* ══════════════ D6 未来与承诺（Q28–Q31）══════════════ */
  {
    id: 28,
    dimension: 'future',
    text: '他谈未来的时候，用的是什么样的句子？',
    rationale: '承诺的语言标记：主语是「我」还是「我们」。',
    options: [
      { text: '「我们明年……」这种，带具体安排', weights: { future: 1, consistency: 0.6 } },
      { text: '会说「以后」，但比较模糊', weights: { future: 0.6 } },
      { text: '基本都是「我」要怎样，很少带「我们」', weights: { future: 0.2 } },
      { text: '一聊未来就换话题', weights: { future: 0.1 } },
    ],
  },
  {
    id: 29,
    dimension: 'future',
    text: '如果需要在「他的城市」和「你的城市」之间选，你们聊过吗？',
    rationale: '权衡型问题：不预设答案，看这件事是否已被认真对待。',
    options: [
      { text: '认真聊过，他甚至提过具体怎么兼顾', weights: { future: 1, responsiveness: 0.6 } },
      { text: '聊过，但没结论，说以后再看', weights: { future: 0.5 } },
      { text: '我提过，他不太想谈', weights: { future: 0.2 } },
      { text: '感觉这事在他那里根本不算问题', weights: { future: 0.1 } },
    ],
  },
  {
    id: 30,
    dimension: 'future',
    text: '他花钱的方式，给你的感觉是？',
    rationale: '承诺的现实面：是否在为「共同生活」做准备，而不只是愿不愿意花钱。',
    options: [
      { text: '有在存钱或规划，会跟我聊到', weights: { future: 1, responsiveness: 0.4 } },
      { text: '花钱挺正常，没想过那么远', weights: { future: 0.5 } },
      { text: '花得比较随意，也不太跟我谈钱', weights: { future: 0.3 } },
      { text: '聊到钱就回避或烦躁', weights: { future: 0.1 } },
    ],
  },
  {
    id: 31,
    dimension: 'future',
    text: '你说想换个城市工作或读研，他第一反应是？',
    options: [
      { text: '问细节，然后一起想怎么安排', weights: { future: 1, responsiveness: 0.9 } },
      { text: '支持，但说「到时候再说」', weights: { future: 0.5 } },
      { text: '说「那我们的关系怎么办」', weights: { future: 0.4 } },
      { text: '不太高兴，觉得我没考虑他', weights: { future: 0.3, responsiveness: 0.2 } },
    ],
  },

  /* ══════════════ D7 社会融合（Q32–Q34）══════════════ */
  {
    id: 32,
    dimension: 'integration',
    text: '他家里知道你的存在吗？',
    options: [
      { text: '知道，见过面或视频过', weights: { integration: 1, future: 0.7 } },
      { text: '知道，他说以后带我见', weights: { integration: 0.7 } },
      { text: '不确定他提过没有', weights: { integration: 0.3 } },
      { text: '他说现在还不适合让家里知道', weights: { integration: 0.1, future: 0.1 } },
    ],
  },
  {
    id: 33,
    dimension: 'integration',
    text: '他朋友聚会的时候，他一般？',
    options: [
      { text: '自然介绍「这是我女朋友」，会顾着我', weights: { integration: 1, responsiveness: 0.6 } },
      { text: '会带我去，但不太主动介绍', weights: { integration: 0.6 } },
      { text: '很少带我参加', weights: { integration: 0.3 } },
      { text: '不太想让我去，说男生聚不方便', weights: { integration: 0.1 } },
    ],
  },
  {
    id: 34,
    dimension: 'integration',
    text: '他跟你朋友的相处是？',
    options: [
      { text: '会主动跟我朋友聊天，处得来', weights: { integration: 1, responsiveness: 0.5 } },
      { text: '礼貌配合，我叫我他就去', weights: { integration: 0.7 } },
      { text: '能推就推', weights: { integration: 0.3 } },
      { text: '不太喜欢我跟朋友走太近', weights: { integration: 0.1 } },
    ],
  },

  /* ══════════════ 反向验证题（Q35–Q36）══════════════ */
  {
    id: 35,
    dimension: 'responsiveness',
    text: '反过来看：他有没有过很长时间不回你消息、也不解释？',
    validates: 1,
    rationale: '反向验证 Q1：Q1 从正面问回应，这里从反面再问一次，检测乱答。',
    options: [
      { text: '从来没有，去哪都会说一声', weights: { responsiveness: 1, consistency: 0.8 } },
      { text: '有过一两次，事后解释清楚了', weights: { responsiveness: 0.7, consistency: 0.6 } },
      { text: '有，而且他觉得没必要解释', weights: { responsiveness: 0.2, consistency: 0.2 } },
      { text: '经常这样，我都不指望他回了', weights: { responsiveness: 0 } },
    ],
  },
  {
    id: 36,
    dimension: 'conflict',
    text: '反过来看：他有没有在外面说过你的不好？',
    validates: 8,
    rationale: '反向验证 Q8：冲突题讲修复，这里从「对外评价」侧面验证同一件事。',
    options: [
      { text: '没有，对外一直是维护我的', weights: { conflict: 1, integration: 0.8 } },
      { text: '开过玩笑，我说了之后就没再犯', weights: { conflict: 0.7, integration: 0.6 } },
      {
        text: '经常拿我开玩笑，说「你怎么这么敏感」',
        weights: { conflict: 0 },
        redFlag: 'contempt',
      },
      { text: '会在朋友面前抱怨我', weights: { conflict: 0.1, integration: 0.1 } },
    ],
  },
] as const;

/** 题目总数 */
export const TOTAL_QUESTIONS = QUESTIONS.length;

/** 按题号索引 */
export const QUESTION_MAP: Record<number, Question> = QUESTIONS.reduce(
  (acc, q) => {
    acc[q.id] = q;
    return acc;
  },
  {} as Record<number, Question>,
);

/** 全部题号，按顺序 */
export const QUESTION_IDS: readonly number[] = QUESTIONS.map((q) => q.id);

/** 反向验证题对（正向题号 → 反向题号） */
export const VERIFICATION_PAIRS: readonly (readonly [number, number])[] = QUESTIONS.filter(
  (q) => typeof q.validates === 'number',
).map((q) => [q.validates as number, q.id] as const);

/** 某维度关联的题目（含以次要权重参与该维度的题） */
export function questionsForDimension(dimensionId: string): Question[] {
  return QUESTIONS.filter(
    (q) =>
      q.dimension === dimensionId ||
      q.options.some((o) => o.weights[dimensionId as keyof typeof o.weights] !== undefined),
  );
}

/** 空答案集 */
export function createEmptyAnswers(): Answers {
  return {};
}
