import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const contentDir = join(root, 'src', 'content', 'zh-cn');
const docsDir = join(root, 'docs');

const PHASES = {
  preschool: { stage: '学前期', phaseName: '学前期', ages: [3, 4, 5] },
  primary: { stage: '小学期', phaseName: '小学期', ages: [6, 7, 8, 9, 10, 11] },
  middle: { stage: '初中期', phaseName: '初中期', ages: [12, 13, 14] },
  senior1: { stage: '高一期', phaseName: '高一期', ages: [15] },
  senior2: { stage: '高二期', phaseName: '高二期', ages: [16] },
  senior3: { stage: '高三期', phaseName: '高三期', ages: [17] },
  final: { stage: '出分填报期', phaseName: '出分填报期', ages: [18] },
};

const allowedProps = ['AGE', 'INT', 'STR', 'MNY', 'SPR', 'VOL', 'RSK', 'SCR', 'HSCR', 'HVOL', 'SCOREMOD', 'SUM'];

const RARITY_CONFIG = {
  common: { grade: 0, name: '普通' },
  rare: { grade: 1, name: '稀有' },
  epic: { grade: 2, name: '史诗' },
  legendary: { grade: 3, name: '传说' },
};

const RARITY_TARGETS = {
  common: 64,
  rare: 56,
  epic: 32,
  legendary: 8,
};

const CATEGORY_CONFIG = {
  family: { name: '家庭背景' },
  aptitude: { name: '学习禀赋' },
  habit: { name: '习惯人格' },
  relation: { name: '社会关系' },
  route: { name: '赛道机会' },
  exam: { name: '考场变量' },
  volunteer: { name: '志愿信息' },
};

const LEGENDARY_TALENT_IDS = new Set([21013, 21118, 21204, 21321, 21511, 21601, 21608, 21710]);

const LEGENDARY_EFFECT_OVERRIDES = new Map([
  [21013, { VOL: 45, RSK: -8, SCOREMOD: 5, SPR: 1 }],
  [21118, { MNY: 2, INT: 2, VOL: 18 }],
  [21204, { INT: 3, STR: 1, RSK: -6, SCOREMOD: 5 }],
  [21321, { STR: 3, SPR: 1, VOL: 8, RSK: -8 }],
  [21511, { INT: 2, VOL: 25, RSK: -8, SCOREMOD: 4 }],
  [21601, { SPR: 2, VOL: 8, RSK: -8, SCOREMOD: 18 }],
  [21608, { VOL: 25, SPR: 2, SCOREMOD: 8 }],
  [21710, { VOL: 35, SPR: 1, RSK: -12, SCOREMOD: 6 }],
]);

function tags(...values) {
  return values.filter(Boolean);
}

function talent(id, name, grade, description, effect = {}, options = {}) {
  return {
    id,
    name,
    grade,
    description,
    effect,
    ...(options.condition ? { condition: options.condition } : {}),
    ...(options.pointsBonus ? { pointsBonus: options.pointsBonus } : {}),
    ...(options.exclude?.length ? { exclude: options.exclude } : {}),
    inheritAllowed: options.inheritAllowed ?? true,
    ...(options.rarity ? { rarity: options.rarity } : {}),
    ...(options.rarityName ? { rarityName: options.rarityName } : {}),
    ...(options.category ? { category: options.category } : {}),
    ...(options.categoryName ? { categoryName: options.categoryName } : {}),
    ...(typeof options.effectBudget === 'number' ? { effectBudget: options.effectBudget } : {}),
    ...(options.polarity ? { polarity: options.polarity } : {}),
    tags: options.tags || [],
  };
}

const talents = [
  talent(21001, '学前启蒙', 1, '5 岁时学力 +2', { INT: 2 }, { condition: 'AGE?[5]', tags: tags('学前', '成长') }),
  talent(21002, '重点学区房', 2, '家庭教育资源充足', { MNY: 2 }, { exclude: [21003], inheritAllowed: false, tags: tags('家庭', '资源') }),
  talent(21003, '县中黑马', 1, '环境普通，但你很能卷', { INT: 1, STR: 1 }, { exclude: [21002], tags: tags('环境', '逆袭') }),
  talent(21004, '自律成瘾', 2, '你擅长长期执行计划', { STR: 1 }, { exclude: [21005], tags: tags('习惯', '稳定') }),
  talent(21005, '重度拖延', 0, '你总把任务拖到最后', { SPR: 1 }, { exclude: [21004], tags: tags('习惯', '风险') }),
  talent(21006, '偏科怪才', 1, '你在优势学科上提升更快', { INT: 2, SPR: -1 }, { exclude: [21007], tags: tags('学习', '偏科') }),
  talent(21007, '全面均衡', 1, '你没有明显短板', { INT: 1, STR: 1, SPR: 1 }, { exclude: [21006], tags: tags('学习', '稳定') }),
  talent(21008, '家长期望过高', 0, '家里总拿你和别人比较', { SPR: -1, MNY: 1 }, { inheritAllowed: false, tags: tags('家庭', '压力') }),
  talent(21009, '班主任偏爱', 1, '老师愿意给你更多关注', { SPR: 1 }, { tags: tags('学校', '关系') }),
  talent(21010, '竞赛体质', 2, '你适合走竞赛和保送路线', { INT: 1 }, { exclude: [21011], tags: tags('竞赛', '特殊线') }),
  talent(21011, '艺体特长', 1, '你有艺体赛道可选', { STR: 1, SPR: 1 }, { exclude: [21010], tags: tags('艺体', '特殊线') }),
  talent(21012, '信息闭塞', 0, '你对升学规则总慢半拍', { VOL: -20 }, { exclude: [21013], tags: tags('志愿', '风险') }),
  talent(21013, '志愿军师', 2, '身边有人很懂报考策略', { VOL: 35 }, { exclude: [21012], tags: tags('志愿', '策略') }),
  talent(21014, '少数民族加分', 1, '你在录取政策上有优势', { SCOREMOD: 10, VOL: 10 }, { condition: 'AGE?[18]', inheritAllowed: false, tags: tags('政策', '录取') }),
  talent(21015, '逢考失眠', 0, '大考越近，你越睡不好', { SPR: -1 }, { condition: 'AGE?[17]', exclude: [21016], tags: tags('高压', '风险') }),
  talent(21016, '佛脚战神', 1, '冲刺期提升异常明显', { INT: 2 }, { condition: 'AGE?[17]', exclude: [21015], tags: tags('冲刺', '逆袭') }),
];

const talentGroups = [
  [21101, '家庭背景', [
    ['教师家庭', 2, '家里有人熟悉学校系统和考试节奏', { VOL: 15, INT: 1 }, false],
    ['书香门第', 1, '家里有稳定阅读环境', { INT: 1, SPR: 1 }, false],
    ['双职工忙碌', 0, '父母很努力，但陪伴时间有限', { MNY: 1, SPR: -1 }, false],
    ['单亲坚韧', 1, '成长环境有缺口，但你很早学会扛事', { STR: 1, SPR: 1 }, true],
    ['留守童年', 0, '你很早学会独处，也更容易缺少信息支持', { SPR: -1, VOL: -8 }, true],
    ['补课自由', 2, '家里愿意为合适的辅导投入资源', { MNY: 2, VOL: 5 }, false],
    ['城市迁徙', 1, '你在转学和适应中练出韧性', { STR: 1, VOL: 5 }, true],
    ['县城熟人社会', 1, '老师和家长之间消息传得很快', { VOL: 8, SPR: -1 }, false],
    ['家有二胎', 0, '资源被分走一些，但你更会自己安排', { MNY: -1, STR: 1 }, false],
    ['隔代抚养', 0, '祖辈照顾细致，但学习规划不太跟得上', { SPR: 1, VOL: -10 }, false],
    ['开明父母', 2, '家里能尊重你的节奏和选择', { SPR: 2, VOL: 5 }, false],
    ['高压家庭', 0, '你很早开始把排名当作安全感来源', { INT: 1, SPR: -2, RSK: 5 }, false],
    ['亲戚榜样', 1, '亲戚里有人考上好大学，给了你具体参照', { VOL: 10, SPR: 1 }, true],
    ['经济起伏', 0, '家里收入忽高忽低，计划经常被打断', { MNY: -1, RSK: 5 }, false],
    ['小镇书店', 1, '你常去镇上唯一的书店消磨时间', { INT: 1, VOL: 3 }, true],
    ['父母外派', 1, '你被迫频繁适应新学校', { STR: 1, RSK: 3, VOL: 5 }, false],
    ['教育洼地', 0, '你起步平台较弱，但竞争压力也小一些', { MNY: -2, SPR: 1 }, false],
    ['强校门票', 3, '你有机会进入顶级中学体系', { MNY: 2, INT: 1, VOL: 12 }, false],
  ]],
  [21201, '学习禀赋', [
    ['数学直觉', 2, '你对数量和结构异常敏感', { INT: 2 }, true],
    ['语文手感', 1, '你很会把模糊感受写清楚', { INT: 1, SPR: 1 }, true],
    ['英语耳朵', 1, '你很早能听出语感差异', { INT: 1, VOL: 3 }, true],
    ['记忆宫殿', 3, '大量知识点能被你整理成清晰索引', { INT: 3 }, true],
    ['慢热脑', 0, '你理解慢，但一旦想通就很扎实', { INT: -1, STR: 2 }, true],
    ['粗心惯犯', 0, '会做的题也可能丢分', { INT: 1, RSK: 8 }, true],
    ['稳定输出', 2, '你很少大起大落', { SPR: 2, RSK: -5 }, true],
    ['理综脑', 2, '你天然适合综合推理和建模', { INT: 2, STR: 1 }, true],
    ['文综地图', 1, '你擅长把历史地理政治串起来', { INT: 1, VOL: 5 }, true],
    ['错题嗅觉', 2, '你特别会从错误里找到模式', { INT: 1, STR: 1, RSK: -4 }, true],
    ['举一反三', 2, '你能把一道题的结构迁移到新题', { INT: 2 }, true],
    ['题海耐受', 1, '重复练习不容易让你厌烦', { STR: 2, SPR: -1 }, true],
    ['表达卡壳', 0, '思路有了，写出来总差一点', { INT: 1, RSK: 5 }, true],
    ['空间想象', 1, '立体几何和物理图像感很好', { INT: 1 }, true],
    ['公式洁癖', 1, '你喜欢把推导写得很干净', { INT: 1, STR: 1 }, true],
    ['审题雷达', 2, '陷阱条件很难骗过你', { INT: 1, RSK: -6 }, true],
    ['知识洁癖', 0, '一个点没搞懂就很难往下走', { INT: 1, SPR: -1 }, true],
    ['短时爆发', 1, '临近节点时效率会突然升高', { INT: 1, STR: -1 }, true],
    ['长线积累', 2, '你越学越能体现厚度', { STR: 1, INT: 1 }, true],
    ['学科洁癖', 0, '不喜欢的科目你很难投入', { INT: 1, RSK: 6 }, true],
    ['计算机器', 1, '基础运算又快又稳', { INT: 1, RSK: -3 }, true],
    ['阅读慢速', 0, '长文本会拖慢你的考试节奏', { STR: -1, RSK: 5 }, true],
    ['抽象跳跃', 2, '你经常直接跳到答案结构', { INT: 2, SPR: -1 }, true],
    ['基础盘牢', 1, '你不容易在基础题上崩盘', { INT: 1, RSK: -5 }, true],
  ]],
  [21301, '习惯人格', [
    ['晨型作息', 1, '你早上学习效率很高', { STR: 1, SPR: 1 }, true],
    ['夜猫子', 0, '越晚越清醒，但白天容易掉线', { INT: 1, STR: -1 }, true],
    ['计划本信徒', 2, '计划表能显著稳定你的节奏', { STR: 2 }, true],
    ['手机黑洞', 0, '手机一拿起来就很难放下', { SPR: 1, INT: -1, RSK: 8 }, true],
    ['运动续航', 1, '规律运动让你扛住长线压力', { STR: 2 }, true],
    ['情绪缓存', 2, '坏消息对你的影响消散很快', { SPR: 2, RSK: -6 }, true],
    ['自我怀疑', 0, '一点波动就会让你怀疑前面所有努力', { SPR: -2, RSK: 8 }, true],
    ['社交充电', 1, '和朋友聊一聊会恢复状态', { SPR: 2, VOL: 3 }, true],
    ['社交耗电', 0, '复杂人际关系会迅速消耗你', { SPR: -1, STR: -1 }, true],
    ['整理癖', 1, '你的书桌和笔记都井井有条', { STR: 1, INT: 1 }, true],
    ['临阵磨枪', 1, '最后几天你反而能集中起来', { INT: 1 }, true],
    ['畏难逃避', 0, '遇到难题会本能绕开', { SPR: 1, INT: -1, RSK: 8 }, true],
    ['问题意识', 2, '你会主动问出真正卡住的问题', { INT: 1, VOL: 8 }, true],
    ['完美主义', 0, '你常被过高标准拖住', { INT: 1, SPR: -1, RSK: 6 }, true],
    ['复盘成瘾', 2, '你特别会把经历变成方法', { INT: 1, STR: 1 }, true],
    ['抗噪体质', 1, '嘈杂环境里也能继续学', { STR: 1, SPR: 1 }, true],
    ['玻璃心', 0, '老师一句重话能影响你很久', { SPR: -2 }, true],
    ['钝感力', 1, '你不太容易被排名刺激到', { SPR: 2, INT: -1 }, true],
    ['目标感强', 2, '你知道自己为什么要学', { SPR: 1, INT: 1 }, true],
    ['短跑心态', 0, '你容易冲一阵又松下来', { STR: -1, RSK: 6 }, true],
    ['长跑心态', 2, '你愿意慢慢把优势滚起来', { STR: 2, SPR: 1 }, true],
    ['奖励驱动', 1, '小奖励能让你保持行动', { SPR: 1, STR: 1 }, true],
    ['压力上头', 0, '压力越大越容易做错简单事', { SPR: -1, RSK: 8 }, true],
    ['冷启动困难', 0, '开始学习前总要磨蹭很久', { STR: -1, SPR: 1 }, true],
  ]],
  [21401, '社会关系', [
    ['同桌学霸', 2, '同桌的节奏把你带快了', { INT: 1, STR: 1 }, true],
    ['强力对手', 2, '你身边有一个长期追赶对象', { INT: 1, SPR: -1, STR: 1 }, true],
    ['温柔老师', 1, '有老师很会保护你的自信', { SPR: 2 }, true],
    ['严厉老师', 1, '老师要求很高，也确实能逼出东西', { INT: 1, SPR: -1 }, true],
    ['竞赛教练', 2, '有人看出了你的竞赛潜力', { INT: 1, VOL: 10 }, true],
    ['班级边缘', 0, '你不太融入班集体', { SPR: -1, RSK: 5 }, true],
    ['朋友小队', 1, '你们互相打气，也互相监督', { SPR: 1, STR: 1 }, true],
    ['互卷宿舍', 1, '宿舍里没人愿意先睡', { INT: 1, STR: -1 }, true],
    ['家校沟通顺畅', 2, '老师和家长的信息能及时对齐', { VOL: 12, SPR: 1 }, false],
    ['家校误会', 0, '几次沟通偏差让你压力变大', { SPR: -1, RSK: 6 }, false],
    ['学长指路', 1, '学长学姐给过你真实建议', { VOL: 12 }, true],
    ['亲友干扰', 0, '亲戚的热心建议常常互相矛盾', { VOL: -8, SPR: -1 }, false],
    ['暗恋滤镜', 0, '你有一段很分心的朦胧喜欢', { SPR: 1, INT: -1 }, true],
    ['互助小组', 1, '你们轮流讲题，基础更稳了', { INT: 1, VOL: 5 }, true],
    ['被公开比较', 0, '长期比较让你很难轻松下来', { SPR: -2, RSK: 8 }, false],
    ['关键谈话', 2, '某次谈话让你重新校准目标', { SPR: 1, VOL: 15 }, true],
    ['家长会阴影', 0, '家长会后家里气压骤降', { SPR: -1, RSK: 5 }, false],
    ['同伴榜样', 1, '身边有人用行动证明努力有回报', { STR: 1, SPR: 1 }, true],
  ]],
  [21501, '赛道机会', [
    ['物理竞赛苗', 2, '你很早被物理老师盯上', { INT: 2 }, true],
    ['数学竞赛苗', 2, '你对难题有不正常的兴奋感', { INT: 2, SPR: -1 }, true],
    ['化学生物兴趣', 1, '实验和生命科学让你很投入', { INT: 1, VOL: 5 }, true],
    ['信息学启蒙', 2, '你接触了编程和算法', { INT: 1, VOL: 10 }, true],
    ['机器人社团', 1, '动手项目让你看见另一种学习方式', { INT: 1, STR: 1 }, true],
    ['作文获奖', 1, '你的文字被认真对待过', { SPR: 1, VOL: 5 }, true],
    ['演讲胆量', 1, '你在表达场合越来越稳', { SPR: 2 }, true],
    ['美术底子', 1, '你能走艺术训练路线', { SPR: 1, VOL: 8 }, true],
    ['音乐耳感', 1, '你有音乐考试或社团路线', { SPR: 1, VOL: 8 }, true],
    ['体育苗子', 1, '你的身体素质打开了另一条路', { STR: 2 }, true],
    ['强基关注', 2, '你开始了解强基计划和基础学科', { VOL: 18, INT: 1 }, true],
    ['外语优势', 1, '外语让你多了一点赛道弹性', { INT: 1, VOL: 8 }, true],
    ['辩论队', 1, '你训练了结构化表达和临场反应', { SPR: 1, INT: 1 }, true],
    ['科创项目', 2, '你参加过能写进材料的项目', { INT: 1, VOL: 12 }, true],
    ['校园媒体', 0, '你在活动中消耗不少精力', { SPR: 1, STR: -1 }, true],
    ['社团领队', 1, '组织活动让你更会协调资源', { VOL: 5, SPR: 1 }, true],
    ['省赛边缘', 2, '你离省级奖项只差一点', { INT: 1, RSK: 4 }, true],
    ['保送耳闻', 2, '你知道有一条不只看高考分的路', { VOL: 18 }, true],
    ['校荐资格', 2, '老师愿意把机会推给你', { VOL: 15, SPR: 1 }, true],
    ['实验班名额', 2, '你进入了更强的学习小圈子', { INT: 2, SPR: -1 }, true],
    ['竞赛沉没成本', 0, '你在竞赛上投入很多，却未必兑现', { INT: 1, RSK: 10 }, true],
    ['艺考摇摆', 0, '你在文化课和专业课之间反复横跳', { VOL: 8, RSK: 8 }, true],
    ['体育伤病隐患', 0, '训练收益伴随受伤风险', { STR: 1, RSK: 10 }, true],
    ['综合评价意识', 2, '你很早开始准备材料和面试', { VOL: 20 }, true],
  ]],
  [21601, '黑天鹅', [
    ['临场冷血', 3, '越大的考场你越冷静', { SPR: 2, SCOREMOD: 10 }, true],
    ['考前小病', 0, '关键节点前身体总会掉链子', { STR: -1, RSK: 8 }, true],
    ['押题体感', 2, '你总能闻到一点考点气味', { SCOREMOD: 12 }, true],
    ['政策窗口', 2, '某项政策恰好对你有利', { VOL: 12, SCOREMOD: 8 }, false],
    ['家庭变故', 0, '一次变故打乱了稳定节奏', { SPR: -2, RSK: 12 }, false],
    ['转学转运', 1, '换环境反而把你激活了', { INT: 1, SPR: 1 }, true],
    ['转学失速', 0, '新环境让你一度跟不上', { INT: -1, SPR: -1 }, true],
    ['神奇贵人', 2, '有人在关键节点拉了你一把', { VOL: 18, SPR: 1 }, true],
    ['消息误读', 0, '你把一条重要政策理解错了', { VOL: -15, RSK: 8 }, true],
    ['试卷洁癖', 0, '卷面稍不顺眼就影响心态', { SPR: -1, RSK: 6 }, true],
    ['大考兴奋', 1, '大考会让你异常专注', { SPR: 1, SCOREMOD: 8 }, true],
    ['大考冻结', 0, '正式考试会让你动作变慢', { SPR: -1, SCOREMOD: -10 }, true],
    ['疫情网课适应', 1, '线上学习反而让你节奏自由', { INT: 1, STR: 1 }, true],
    ['网课沉没', 0, '线上学习让你逐渐失控', { STR: -1, RSK: 10 }, true],
    ['考场幸运座', 1, '考场环境刚好很适合你', { SPR: 1, SCOREMOD: 5 }, true],
    ['考场噪音敏感', 0, '一点噪音就会打断你的节奏', { SPR: -1, RSK: 6 }, true],
    ['临门一脚', 2, '最后一次调整刚好踩中问题', { SCOREMOD: 10, VOL: 5 }, true],
    ['命运玩笑', 3, '你的人生轨迹总在关键处拐弯', { RSK: 8, SCOREMOD: 15 }, true],
  ]],
  [21701, '志愿信息', [
    ['专业雷达', 2, '你能分辨专业名背后的真实课程', { VOL: 25 }, true],
    ['城市执念', 0, '你过度执着某个城市', { VOL: 5, RSK: 8 }, true],
    ['院校数据库', 2, '你收集了大量往年录取数据', { VOL: 30 }, true],
    ['专业盲盒', 0, '你对专业几乎只有名字印象', { VOL: -20 }, true],
    ['就业导向', 1, '你会考虑四年之后的出口', { VOL: 15 }, true],
    ['名校滤镜', 0, '你容易被校名压过专业判断', { VOL: -8, RSK: 6 }, true],
    ['家庭专业偏好', 0, '家里强烈希望你读某个专业', { VOL: 5, SPR: -1 }, false],
    ['自我认知清晰', 2, '你知道自己适合什么学习方式', { VOL: 20, SPR: 1 }, true],
    ['调剂恐惧', 0, '你对服从调剂非常抗拒', { VOL: -5, RSK: 8 }, true],
    ['风险分层', 2, '你能把冲稳保拆得很清楚', { VOL: 25, RSK: -6 }, true],
    ['数据迷信', 0, '你过度相信单一年份分数线', { VOL: -8, RSK: 6 }, true],
    ['招生章程控', 2, '你真的会读招生章程', { VOL: 25 }, true],
    ['专业体验营', 1, '你提前接触过大学课堂', { VOL: 15, INT: 1 }, true],
    ['亲戚拍板', 0, '最后关头亲戚意见突然变多', { VOL: -10, SPR: -1 }, false],
    ['保底意识', 1, '你愿意认真准备保底方案', { VOL: 12, RSK: -4 }, true],
    ['冲校上头', 0, '你很容易被“再冲一冲”带走', { VOL: -5, RSK: 10 }, true],
    ['地区套利', 2, '你知道不同地区录取位次差异', { VOL: 20, SCOREMOD: 5 }, true],
    ['专业洁癖', 1, '你宁愿学校降档也要保专业', { VOL: 12, SPR: 1 }, true],
  ]],
];

for (const [startId, tag, items] of talentGroups) {
  items.forEach(([name, grade, description, effect, inheritAllowed], index) => {
    talents.push(talent(startId + index, name, grade, description, effect, {
      inheritAllowed,
      tags: tags(tag, grade >= 2 ? '稀有' : grade === 0 ? '风险' : '成长'),
    }));
  });
}

const talentByName = new Map(talents.map(item => [item.name, item]));
const exclusivePairs = [
  ['晨型作息', '夜猫子'],
  ['情绪缓存', '玻璃心'],
  ['钝感力', '压力上头'],
  ['长跑心态', '短跑心态'],
  ['专业雷达', '专业盲盒'],
  ['院校数据库', '数据迷信'],
  ['风险分层', '冲校上头'],
  ['转学转运', '转学失速'],
  ['大考兴奋', '大考冻结'],
  ['疫情网课适应', '网课沉没'],
];
for (const [a, b] of exclusivePairs) {
  const ta = talentByName.get(a);
  const tb = talentByName.get(b);
  if (ta && tb) {
    ta.exclude = [...new Set([...(ta.exclude || []), tb.id])];
    tb.exclude = [...new Set([...(tb.exclude || []), ta.id])];
  }
}

finalizeTalents();

function finalizeTalents() {
  for (const talent of talents) {
    const override = LEGENDARY_EFFECT_OVERRIDES.get(talent.id);
    if (override) talent.effect = override;

    talent.category = inferTalentCategory(talent);
    talent.categoryName = CATEGORY_CONFIG[talent.category].name;
    talent.effectBudget = calculateEffectBudget(talent.effect);
    talent.polarity = inferTalentPolarity(talent);
  }

  const assigned = new Map();
  const legendary = talents
    .filter(item => LEGENDARY_TALENT_IDS.has(item.id) && item.polarity !== 'drawback')
    .sort((a, b) => compareTalentPower(b, a))
    .slice(0, RARITY_TARGETS.legendary);
  for (const talent of legendary) assigned.set(talent.id, 'legendary');

  const remaining = talents
    .filter(item => !assigned.has(item.id))
    .sort((a, b) => compareTalentPower(b, a));

  for (const talent of remaining) {
    const rarity = pickRarityForTalent(talent, assigned);
    assigned.set(talent.id, rarity);
  }

  for (const talent of talents) {
    const rarity = assigned.get(talent.id);
    const config = RARITY_CONFIG[rarity];
    talent.rarity = rarity;
    talent.rarityName = config.name;
    talent.grade = config.grade;
    talent.tags = normalizeTalentTags(talent);
  }

  const counts = countBy(talents, item => item.rarity);
  for (const [rarity, expected] of Object.entries(RARITY_TARGETS)) {
    if (counts[rarity] !== expected) {
      throw new Error(`talent rarity ${rarity}: expected ${expected}, got ${counts[rarity] ?? 0}`);
    }
  }
}

function pickRarityForTalent(talent, assigned) {
  const counts = countBy([...assigned.values()], item => item);
  const canUse = rarity => (counts[rarity] ?? 0) < RARITY_TARGETS[rarity];

  if (talent.polarity !== 'drawback' && canUse('epic')) return 'epic';
  if (canUse('rare')) return 'rare';
  if (canUse('common')) return 'common';
  return talent.polarity !== 'drawback' && canUse('legendary') ? 'legendary' : 'common';
}

function compareTalentPower(a, b) {
  return adjustedTalentPower(a) - adjustedTalentPower(b) || a.id - b.id;
}

function adjustedTalentPower(talent) {
  const effect = talent.effect || {};
  const oldGradeBonus = (talent.grade || 0) * 0.22;
  const routeBonus = talent.category === 'route' || talent.category === 'volunteer' ? 0.08 : 0;
  const drawbackPenalty = talent.polarity === 'drawback' ? 10 : 0;
  return talent.effectBudget + oldGradeBonus + routeBonus - drawbackPenalty;
}

function inferTalentCategory(talent) {
  const id = talent.id;
  if (id >= 21100 && id < 21200) return 'family';
  if (id >= 21200 && id < 21300) return 'aptitude';
  if (id >= 21300 && id < 21400) return 'habit';
  if (id >= 21400 && id < 21500) return 'relation';
  if (id >= 21500 && id < 21600) return 'route';
  if (id >= 21600 && id < 21700) return 'exam';
  if (id >= 21700 && id < 21800) return 'volunteer';

  if ([21002, 21003, 21008].includes(id)) return 'family';
  if ([21001, 21006, 21007].includes(id)) return 'aptitude';
  if ([21004, 21005].includes(id)) return 'habit';
  if ([21009].includes(id)) return 'relation';
  if ([21010, 21011].includes(id)) return 'route';
  if ([21012, 21013, 21014].includes(id)) return 'volunteer';
  if ([21015, 21016].includes(id)) return 'exam';

  const tagSet = new Set(talent.tags || []);
  if (tagSet.has('家庭') || tagSet.has('家庭背景') || tagSet.has('资源')) return 'family';
  if (tagSet.has('学习') || tagSet.has('学前') || tagSet.has('偏科')) return 'aptitude';
  if (tagSet.has('习惯') || tagSet.has('高压') || tagSet.has('冲刺')) return 'habit';
  if (tagSet.has('学校') || tagSet.has('关系')) return 'relation';
  if (tagSet.has('竞赛') || tagSet.has('艺体') || tagSet.has('特殊线')) return 'route';
  if (tagSet.has('黑天鹅')) return 'exam';
  if (tagSet.has('志愿') || tagSet.has('政策') || tagSet.has('录取')) return 'volunteer';
  return 'aptitude';
}

function inferTalentPolarity(talent) {
  const effect = talent.effect || {};
  const tagSet = new Set(talent.tags || []);
  if (tagSet.has('风险')) return 'drawback';
  if (talent.effectBudget < 0) return 'drawback';
  if ((effect.SCOREMOD ?? 0) < 0) return 'drawback';
  if ((effect.RSK ?? 0) >= 6) return 'drawback';
  return 'benefit';
}

function calculateEffectBudget(effect = {}) {
  let benefit = 0;
  let cost = 0;
  for (const [prop, value] of Object.entries(effect)) {
    const weight = effectBudgetWeight(prop);
    if (prop === 'RSK') {
      if (value < 0) benefit += -value * weight;
      else cost += value * weight;
      continue;
    }
    if (value > 0) benefit += value * weight;
    else cost += -value * weight;
  }
  return Number((benefit - cost * 0.65).toFixed(2));
}

function effectBudgetWeight(prop) {
  if (['INT', 'STR', 'MNY', 'SPR'].includes(prop)) return 1;
  if (['VOL', 'RSK'].includes(prop)) return 0.08;
  if (prop === 'SCOREMOD') return 0.12;
  return 0;
}

function normalizeTalentTags(talent) {
  const categoryNames = new Set(Object.values(CATEGORY_CONFIG).map(item => item.name));
  const removed = new Set(['普通', '稀有', '史诗', '传说', '成长']);
  const extraTags = (talent.tags || [])
    .filter(tag => !removed.has(tag))
    .filter(tag => !categoryNames.has(tag))
    .filter(tag => tag !== '风险' || talent.polarity !== 'drawback');
  return [...new Set([
    talent.categoryName,
    talent.rarityName,
    talent.polarity === 'drawback' ? '风险' : null,
    ...extraTags,
  ].filter(Boolean))];
}

function countBy(items, keyOf) {
  return items.reduce((result, item) => {
    const key = keyOf(item);
    result[key] = (result[key] ?? 0) + 1;
    return result;
  }, {});
}

function event(id, phase, text, effect = {}, options = {}) {
  return {
    id,
    stage: PHASES[phase].stage,
    phase,
    text,
    effect,
    grade: options.grade ?? 0,
    weight: options.weight ?? 70,
    ...(options.include ? { include: options.include } : {}),
    ...(options.exclude ? { exclude: options.exclude } : {}),
    ...(options.branch ? { branch: options.branch } : {}),
    ...(options.noRandom ? { noRandom: true } : {}),
    ...(options.flag ? { flag: options.flag } : {}),
    tags: options.tags || [PHASES[phase].stage],
  };
}

const events = [
  event(31001, 'preschool', '父母开始坚持给你读睡前故事。', { INT: 1, SPR: 1 }, { include: 'MNY>3', weight: 100, tags: tags('学前', '家庭') }),
  event(31002, 'preschool', '你从小主要和电视与短视频作伴。', { SPR: 1, INT: -1 }, { weight: 90, tags: tags('学前', '风险') }),
  event(31003, 'preschool', '家里咬牙给你报了早教班。', { INT: 1, MNY: -1 }, { include: 'MNY>4', grade: 1, weight: 60, tags: tags('学前', '资源') }),
  event(31004, 'preschool', '家里搬家，你换了一个新环境。', { SPR: -1, VOL: 5 }, { weight: 50, tags: tags('家庭', '变化') }),
  event(31005, 'primary', '你第一次拿到班级前几名。', { INT: 1, SPR: 1 }, { include: 'INT>4', weight: 100, tags: tags('小学', '成绩') }),
  event(31006, 'primary', '你某一科明显跟不上节奏。', { INT: -1, SPR: -1 }, { weight: 90, tags: tags('小学', '偏科') }),
  event(31007, 'primary', '一位负责的老师很欣赏你。', { INT: 1, SPR: 1, VOL: 5 }, { include: 'SPR>4', grade: 1, weight: 70, tags: tags('小学', '老师') }),
  event(31008, 'primary', '你开始沉迷游戏，作业也越拖越久。', { SPR: 1, STR: -1, RSK: 5 }, { weight: 80, tags: tags('小学', '风险') }),
  event(31009, 'middle', '你被分进了重点班。', { INT: 1, SPR: -1 }, { include: 'INT>5', grade: 1, weight: 90, flag: '重点班', tags: tags('初中', '分流') }),
  event(31010, 'middle', '排名开始公开，你第一次感到窒息。', { SPR: -2, RSK: 10 }, { weight: 100, tags: tags('初中', '压力') }),
  event(31011, 'middle', '你在竞赛课上第一次找到天赋感。', { INT: 2 }, { include: '(INT>6)|(TLT?[21010])', grade: 1, weight: 60, flag: '竞赛苗子', tags: tags('初中', '竞赛') }),
  event(31012, 'middle', '你开始对同学产生朦胧好感，注意力有点飘。', { SPR: 1, INT: -1 }, { weight: 70, tags: tags('初中', '青春期') }),
  event(31013, 'senior1', '你选到了适合自己的科目组合。', { INT: 1, SPR: 1 }, { include: 'INT>5', grade: 1, weight: 80, flag: '选科成功', tags: tags('高一', '选科') }),
  event(31014, 'senior1', '你跟风选科，后来越学越别扭。', { INT: -1, SPR: -1, RSK: 5 }, { exclude: 'EVT?[31013]', weight: 80, flag: '选科失误', tags: tags('高一', '选科') }),
  event(31015, 'senior1', '住校后你慢慢适应了集体节奏。', { STR: 1, SPR: 1 }, { include: 'STR>4', weight: 70, tags: tags('高一', '住校') }),
  event(31016, 'senior1', '住校后你总睡不好，白天也难集中。', { STR: -1, SPR: -1 }, { weight: 70, tags: tags('高一', '住校') }),
  event(31017, 'senior2', '你被选去参加竞赛集训。', { INT: 2, SPR: -1 }, { include: 'EVT?[31011]', grade: 2, weight: 20, flag: '竞赛集训', tags: tags('高二', '竞赛') }),
  event(31018, 'senior2', '家里经济上有些吃紧，补课计划被打断了。', { MNY: -2, SPR: -1 }, { weight: 70, tags: tags('高二', '家庭') }),
  event(31019, 'senior2', '一次模考把你彻底点醒。', { INT: 1, SPR: 1, RSK: -5 }, { grade: 1, weight: 90, flag: '觉醒时刻', tags: tags('高二', '模考') }),
  event(31020, 'senior2', '你进入了成绩平台期，怎么学都像原地踏步。', { SPR: -1, RSK: 5 }, { weight: 100, flag: '平台期', tags: tags('高二', '瓶颈') }),
  event(31021, 'senior3', '一轮复习开始见效，你的基础明显扎实起来。', { INT: 2, STR: -1 }, { include: 'STR>3', grade: 1, weight: 90, flag: '冲刺见效', tags: tags('高三', '复习') }),
  event(31022, 'senior3', '二轮开始后，你反而越来越焦虑。', { SPR: -2, RSK: 10 }, { weight: 90, branch: [{ condition: 'SPR<2', next: 31026 }], flag: '心态波动', tags: tags('高三', '焦虑') }),
  event(31023, 'senior3', '百日冲刺后，你的节奏终于稳定下来了。', { INT: 1, SPR: 1, RSK: -5 }, { include: '(EVT?[31021])|(TLT?[21016])', grade: 1, weight: 80, flag: '百日冲刺', tags: tags('高三', '逆袭') }),
  event(31024, 'senior3', '一套押题卷刚好覆盖了你最担心的内容。', { INT: 1, SPR: 1 }, { include: 'TLT?[21016,21013]', grade: 1, weight: 50, flag: '押题成功', tags: tags('高三', '整活') }),
  event(31025, 'final', '高考当天你异常冷静，几乎发挥出了全部水平。', { SPR: 1, SCOREMOD: 20 }, { include: '(SPR>6)&(INT>7)', exclude: 'EVT?[31026]', grade: 2, weight: 50, flag: '高考超常', tags: tags('高考', '发挥') }),
  event(31026, 'final', '高考当天你连续失误，整个人都懵了。', { SPR: -2, SCOREMOD: -30, RSK: 15 }, { include: '(SPR<4)|(EVT?[31022])|(TLT?[21015])', grade: 1, weight: 60, flag: '临场失常', tags: tags('高考', '发挥') }),
  event(31027, 'final', '你在志愿填报上做足了功课，避开了大部分坑。', { VOL: 20 }, { include: '(VOL>30)|(TLT?[21013])', grade: 1, weight: 70, flag: '志愿稳健', tags: tags('志愿', '策略') }),
  event(31028, 'final', '你一味往上冲，最后滑到了完全不想去的专业。', { VOL: -20, RSK: 10 }, { include: '(VOL<20)|(TLT?[21012])', grade: 1, weight: 70, flag: '志愿翻车', tags: tags('志愿', '风险') }),
];

const phaseSeed = {
  preschool: [
    ['你把绘本里的字当成图案，一个个认真认。', { INT: 1, SPR: 1 }, '阅读萌芽', '学前,阅读'],
    ['家里给你买了一套拼图，你反复拼到边角都磨白了。', { INT: 1, STR: 1 }, '专注训练', '学前,专注'],
    ['你第一次在幼儿园表演时站上台，没有哭。', { SPR: 1 }, '表达启蒙', '学前,表达'],
    ['一次高烧让你缺了很久幼儿园。', { STR: -1, RSK: 5 }, '体弱', '学前,健康'],
    ['你很喜欢问“为什么”，大人有时被问到沉默。', { INT: 1 }, '好奇心', '学前,成长'],
    ['父母开始限制你看短视频的时间。', { STR: 1, SPR: -1 }, '屏幕管理', '学前,习惯'],
    ['你在早教班里只喜欢玩教具，不喜欢听课。', { SPR: 1, MNY: -1 }, '早教偏差', '学前,资源'],
    ['搬家后，你花了很久才愿意和新小朋友说话。', { SPR: -1, VOL: 3 }, '适应慢', '学前,变化'],
    ['你和邻居哥哥姐姐一起写字，提前接触了作业。', { INT: 1, VOL: 3 }, '提前入门', '学前,关系'],
    ['家里老人总夸你聪明，你开始有一点小得意。', { SPR: 1, RSK: 2 }, '早期评价', '家庭,心态'],
    ['父母工作很忙，你学会自己搭积木打发时间。', { STR: 1, SPR: -1 }, '独处', '家庭,习惯'],
    ['你第一次因为输了游戏大哭一场。', { SPR: -1 }, '挫折教育', '学前,心态'],
  ],
  primary: [
    ['你参加了第一次奥数班，发现题目像机关。', { INT: 1, RSK: 3 }, '奥数启蒙', '小学,奥数'],
    ['英语老师让你领读，你意外读得很顺。', { INT: 1, SPR: 1 }, '英语优势', '小学,英语'],
    ['你被选去参加校内讲故事比赛。', { SPR: 1, VOL: 3 }, '表达机会', '小学,活动'],
    ['期末前你忘了带复习资料，慌了一整天。', { SPR: -1, RSK: 4 }, '粗心', '小学,风险'],
    ['班主任把你的作文本当范文读了出来。', { SPR: 1, INT: 1 }, '语文反馈', '小学,语文'],
    ['你开始在草稿纸上乱画机械结构。', { INT: 1 }, '科创萌芽', '小学,兴趣'],
    ['一次体育测试让你意识到体力也会影响学习。', { STR: 1 }, '体能意识', '小学,体能'],
    ['同桌总能比你更快写完作业，你开始暗暗较劲。', { INT: 1, SPR: -1 }, '同伴刺激', '小学,关系'],
    ['你因为字迹潦草被扣了卷面分。', { RSK: 4, SPR: -1 }, '卷面问题', '小学,考试'],
    ['父母给你报了太多兴趣班，周末像赶场。', { INT: 1, STR: -1, SPR: -1 }, '兴趣班过载', '小学,资源'],
    ['你第一次在考试后主动整理错题。', { INT: 1, RSK: -3 }, '错题意识', '小学,方法'],
    ['你因为玩游戏忘记写作业，被老师请家长。', { SPR: -1, RSK: 5 }, '游戏干扰', '小学,风险'],
  ],
  middle: [
    ['你第一次在年级榜上看到自己的名字。', { INT: 1, SPR: 1 }, '年级榜', '初中,排名'],
    ['你发现班里有人刷完了你没听过的习题册。', { STR: 1, SPR: -1 }, '竞争感', '初中,压力'],
    ['竞赛老师把你叫去试做一套难题。', { INT: 2, SPR: -1 }, '竞赛试训', '初中,竞赛'],
    ['手机开始成为你和同学关系的一部分。', { SPR: 1, RSK: 5 }, '手机', '初中,社交'],
    ['你第一次因为排名下滑失眠。', { SPR: -2, RSK: 8 }, '排名焦虑', '初中,压力'],
    ['一位同学把解题思路讲得很清楚，你突然开窍。', { INT: 1, SPR: 1 }, '同伴讲题', '初中,学习'],
    ['你在一次月考里偏科问题暴露得很明显。', { INT: -1, RSK: 6 }, '偏科暴露', '初中,考试'],
    ['家长开始讨论你能不能进重点高中。', { VOL: 5, SPR: -1 }, '升学目标', '初中,中考'],
    ['你加入了学校的晚自习队伍。', { STR: 1, INT: 1 }, '晚自习', '初中,习惯'],
    ['你对一个同学有了好感，上课时常走神。', { SPR: 1, INT: -1 }, '青春期', '初中,青春期'],
    ['你第一次主动找老师问压轴题。', { INT: 1, VOL: 5 }, '主动提问', '初中,老师'],
    ['中考前的模拟排名让家里气氛紧绷。', { SPR: -1, RSK: 5 }, '中考压力', '初中,家庭'],
  ],
  senior1: [
    ['进入高中后，你第一次意识到强者密度变高了。', { SPR: -1, RSK: 5 }, '强校冲击', '高一,适应'],
    ['你在选科说明会上听懂了不少规则。', { VOL: 12 }, '选科信息', '高一,选科'],
    ['新班主任强调基础题正确率，你很受触动。', { INT: 1, RSK: -3 }, '基础意识', '高一,老师'],
    ['住校第一周，你几乎每天都想家。', { SPR: -1, STR: -1 }, '住校适应', '高一,住校'],
    ['你找到一个安静角落，逐渐固定晚自习位置。', { STR: 1, SPR: 1 }, '学习环境', '高一,习惯'],
    ['你跟风加入热门组合，几周后发现并不适合。', { INT: -1, RSK: 6 }, '选科误差', '高一,选科'],
    ['一次分班考让你摸到自己的真实位置。', { VOL: 5, SPR: -1 }, '定位', '高一,考试'],
    ['你开始认真记录每科老师的要求。', { STR: 1, INT: 1 }, '适应方法', '高一,方法'],
    ['社团活动占走了太多晚上。', { SPR: 1, STR: -1, RSK: 4 }, '社团消耗', '高一,活动'],
    ['你被邀请参加学科培优班。', { INT: 1, VOL: 8 }, '培优班', '高一,机会'],
    ['你发现自己的短板不是不会，而是不稳定。', { RSK: -4, VOL: 3 }, '稳定意识', '高一,复盘'],
    ['第一次大型考试后，家里对你的预期被重估。', { SPR: -1, VOL: 5 }, '家庭预期', '高一,家庭'],
  ],
  senior2: [
    ['你参加了强基计划宣讲，第一次认真想专业。', { VOL: 15, INT: 1 }, '强基信息', '高二,强基'],
    ['竞赛集训强度远超想象，你开始担心文化课。', { INT: 2, STR: -1, RSK: 8 }, '竞赛代价', '高二,竞赛'],
    ['一位补课老师精准指出你的漏洞。', { INT: 1, MNY: -1 }, '补课有效', '高二,补课'],
    ['成绩在同一个区间卡了很久。', { SPR: -1, RSK: 5 }, '平台期', '高二,瓶颈'],
    ['你尝试换一种错题分类法，效果不错。', { INT: 1, RSK: -4 }, '方法调整', '高二,方法'],
    ['家里因为补课费用争执了一次。', { MNY: -1, SPR: -1 }, '资源压力', '高二,家庭'],
    ['你在一次省级活动中见到了更强的学生。', { VOL: 10, SPR: -1 }, '视野打开', '高二,机会'],
    ['老师建议你不要盲目冲竞赛。', { VOL: 8, SPR: 1 }, '路线校准', '高二,老师'],
    ['你开始查大学专业介绍，却越查越迷茫。', { VOL: 8, SPR: -1 }, '专业迷茫', '高二,志愿'],
    ['一次模考让你从中游挤到前排。', { INT: 1, SPR: 2 }, '阶段突破', '高二,模考'],
    ['你熬夜太多，白天效率明显下降。', { STR: -1, RSK: 6 }, '熬夜反噬', '高二,作息'],
    ['你把手机交给家人保管，效率突然稳定。', { STR: 1, INT: 1, SPR: -1 }, '手机管理', '高二,习惯'],
  ],
  senior3: [
    ['一模结果比预期好，你开始敢想更高目标。', { SPR: 1, VOL: 8 }, '一模超常', '高三,模考'],
    ['一模失手后，你花了几天才缓过来。', { SPR: -2, RSK: 8 }, '一模失常', '高三,模考'],
    ['老师帮你拆出最该拿分的题型。', { INT: 1, VOL: 6 }, '提分清单', '高三,老师'],
    ['连续刷题后，你开始对题目麻木。', { STR: -1, SPR: -1, RSK: 6 }, '刷题疲劳', '高三,疲劳'],
    ['你终于把一个长期短板补到及格线以上。', { INT: 2, SPR: 1 }, '短板修复', '高三,逆袭'],
    ['家长开始每天问你能考多少分。', { SPR: -1, RSK: 6 }, '家庭追问', '高三,家庭'],
    ['你把志愿表提前做了三个版本。', { VOL: 18, RSK: -4 }, '志愿预案', '高三,志愿'],
    ['二模排名突然下滑，你开始怀疑复习方向。', { SPR: -2, RSK: 10 }, '二模波动', '高三,焦虑'],
    ['百日誓师后，你把倒计时贴在桌角。', { STR: 1, SPR: 1 }, '百日节点', '高三,冲刺'],
    ['你学会在每晚睡前停止复盘错题。', { SPR: 1, RSK: -5 }, '睡眠保护', '高三,心态'],
    ['一套押题资料命中了你的薄弱区。', { INT: 1, SCOREMOD: 6 }, '押题资料', '高三,押题'],
    ['临近高考，你反而开始异常平静。', { SPR: 2 }, '临场平静', '高三,临场'],
  ],
  final: [
    ['语文作文题刚好贴近你准备过的素材。', { SCOREMOD: 10, SPR: 1 }, '作文押中', '高考,作文'],
    ['数学前半场卡住，你及时跳题保住了节奏。', { SCOREMOD: 8, SPR: 1 }, '数学止损', '高考,数学'],
    ['英语听力设备有杂音，你心态受了点影响。', { SCOREMOD: -8, SPR: -1 }, '听力干扰', '高考,英语'],
    ['理综最后几分钟，你改对了一个关键选项。', { SCOREMOD: 8 }, '临场改对', '高考,理综'],
    ['出分那天，你的分数比估分高了一截。', { SCOREMOD: 12, SPR: 1 }, '估分偏低', '出分,惊喜'],
    ['你提前踩点考场，把路线和入场时间都确认了一遍。', { SPR: 1, RSK: -4 }, '考场踩点', '考前,准备'],
    ['你认真比较了城市、学校和专业。', { VOL: 18 }, '三角比较', '志愿,策略'],
    ['招生章程里一行小字救了你。', { VOL: 20, RSK: -6 }, '章程避坑', '志愿,细节'],
    ['你被一个听起来很新潮的专业名吸引。', { VOL: -8, RSK: 5 }, '专业误读', '志愿,风险'],
    ['考前一晚，你按计划收起复习资料，尽量把觉睡踏实。', { SPR: 2 }, '考前睡眠', '考前,心态'],
    ['你放弃冲名校，保住了喜欢的专业。', { VOL: 12, SPR: 1 }, '保专业', '志愿,取舍'],
    ['你在最后一天才确认志愿顺序，差点错过提交。', { RSK: 8, SPR: -1 }, '提交惊险', '志愿,风险'],
  ],
};

function expandPhase(startId, phase) {
  const seeds = phaseSeed[phase];
  const modifiers = [
    { suffixes: [''], effects: [{}] },
    {
      suffixes: [
        '后来你才发现，这一步改变了复习节奏。',
        '老师的一句提醒，让你重新调整了方法。',
        '它没有立刻见效，却慢慢影响了心态。',
        '你开始对类似情况更敏感。',
        '那几天的状态，给后面的选择留了伏笔。',
        '你和同学聊过之后，换了一个处理方式。',
        '这件小事让你重新估计了自己的承受力。',
        '你第一次认真意识到信息差也会影响结果。',
        '它让你在下一次考试前多准备了一步。',
        '你把注意力从情绪拉回了具体问题。',
        '这段经历让家里对你的判断发生了微调。',
        '你没有马上改变，但心里多了一个提醒。',
      ],
      effects: [
        { RSK: 2 },
        { RSK: 2 },
        { RSK: 2 },
        { RSK: 2 },
        { RSK: 2 },
        { RSK: 2 },
        { RSK: 2 },
        { RSK: 2 },
        { RSK: 2 },
        { RSK: 2 },
        { RSK: 2 },
        { RSK: 2 },
      ],
    },
    {
      suffixes: [
        '复盘时，你把原因拆成了几条可执行的动作。',
        '后来遇到同类问题，你处理得更快了一点。',
        '这次波动被你当成了一次提前演练。',
        '你给自己留了一条更稳的后路。',
        '它逼着你把计划从“想一想”改成“写下来”。',
        '那天之后，你对节奏失控更警惕了。',
        '你开始分清哪些事该争，哪些事该放。',
        '这让你在关键节点少走了一点弯路。',
        '你把经验告诉了身边的人，自己也更笃定。',
        '它没有改变所有事，却改变了你看问题的角度。',
        '你把这次教训折进了下一轮安排。',
        '后来回头看，它确实不是一件小事。',
      ],
      effects: [
        { STR: 1 },
        { STR: 1 },
        { STR: 1 },
        { STR: 1 },
        { STR: 1 },
        { STR: 1 },
        { STR: 1 },
        { STR: 1 },
        { STR: 1 },
        { STR: 1 },
        { STR: 1 },
        { STR: 1 },
      ],
    },
  ];
  let cursor = startId;
  const phaseEvents = [];
  for (let round = 0; round < 3; round += 1) {
    for (const [seedIndex, [text, effect, flag, tagText]] of seeds.entries()) {
      const modifier = modifiers[round];
      const suffix = modifier.suffixes[seedIndex % modifier.suffixes.length];
      const extraEffect = modifier.effects[seedIndex % modifier.effects.length];
      const merged = { ...effect };
      for (const [key, value] of Object.entries(extraEffect)) merged[key] = (merged[key] || 0) + value;
      const eventText = suffix ? `${text}${suffix}` : text;
      phaseEvents.push(event(cursor, phase, eventText, merged, {
        weight: 50 + ((cursor + round) % 6) * 10,
        grade: flag.includes('超常') || flag.includes('押中') || flag.includes('强基') ? 2 : (cursor % 5 === 0 ? 1 : 0),
        flag,
        tags: tagText.split(','),
      }));
      cursor += 1;
    }
  }
  return phaseEvents;
}

events.push(...expandPhase(31101, 'preschool'));
events.push(...expandPhase(31201, 'primary'));
events.push(...expandPhase(31301, 'middle'));
events.push(...expandPhase(31401, 'senior1'));
events.push(...expandPhase(31501, 'senior2'));
events.push(...expandPhase(31601, 'senior3'));
events.push(...expandPhase(31701, 'final'));

const baseAgePools = {
  3: [[31001, 80], [31002, 60], [31004, 30]],
  4: [[31001, 70], [31002, 60], [31003, 40]],
  5: [[31003, 60], [31004, 40]],
  6: [[31005, 60], [31006, 50], [31007, 30]],
  7: [[31005, 70], [31006, 50], [31008, 40]],
  8: [[31005, 70], [31007, 40], [31008, 50]],
  9: [[31005, 60], [31006, 60], [31008, 50]],
  10: [[31005, 60], [31006, 70], [31007, 40]],
  11: [[31006, 70], [31007, 50], [31008, 40]],
  12: [[31009, 50], [31010, 80], [31011, 30], [31012, 40]],
  13: [[31009, 60], [31010, 90], [31011, 40], [31012, 50]],
  14: [[31009, 60], [31010, 80], [31011, 50], [31012, 40]],
  15: [[31013, 70], [31014, 70], [31015, 50], [31016, 50]],
  16: [[31017, 20], [31018, 60], [31019, 70], [31020, 80]],
  17: [[31021, 80], [31022, 90], [31023, 70], [31024, 40]],
  18: [[31025, 50], [31026, 60], [31027, 70], [31028, 70]],
};

function phaseForAge(age) {
  for (const [phase, config] of Object.entries(PHASES)) {
    if (config.ages.includes(age)) return phase;
  }
  throw new Error(`No phase for age ${age}`);
}

const ROUND_NAMES = {
  preschool: ['春季启蒙', '夏季陪伴', '秋季习惯', '年末变化'],
  primary: ['开学适应', '阶段练习', '期中波动', '期末反馈'],
  middle: ['开学定位', '月考排名', '分流压力', '阶段总结'],
  senior1: ['入学适应', '选科观察', '分班磨合', '期末定位'],
  senior2: ['路线试探', '平台调整', '竞赛强基', '期末定型'],
  senior3: ['一轮复习', '二轮瓶颈', '百日冲刺', '考前状态'],
  final: ['考前调整', '高考当日', '志愿填报', '出分录取'],
};

function generatedEventBelongsToRound(item, index, round) {
  if (item.phase === 'final' && item.tags?.includes('考前')) return round === 1;
  if (item.phase === 'final' && item.tags?.includes('高考')) return round === 2;
  if (item.phase === 'final' && item.tags?.includes('志愿')) return round === 3;
  if (item.phase === 'final' && item.tags?.includes('出分')) return round === 4;
  return index % 4 === round - 1;
}

function baseEventBelongsToRound(id, age, round) {
  if (age !== 18) return true;
  if ([31027, 31028].includes(id)) return round === 3;
  if ([31025, 31026].includes(id)) return round === 2;
  return true;
}

const ages = [];
for (let age = 3; age <= 18; age += 1) {
  const phase = phaseForAge(age);
  const generated = events
    .filter(item => item.phase === phase && item.id >= 31101);
  const baseRefs = (baseAgePools[age] || []).map(([id, weight]) => ({ id, weight }));
  for (let round = 1; round <= 4; round += 1) {
    const roundName = ROUND_NAMES[phase][round - 1];
    const roundGenerated = generated
      .filter((item, index) => generatedEventBelongsToRound(item, index, round))
      .map(item => ({ id: item.id, weight: item.weight }));
    const base = baseRefs.filter(item => baseEventBelongsToRound(item.id, age, round));
    ages.push({
      step: (age - 3) * 4 + round,
      age,
      round,
      roundName,
      phase,
      phaseName: PHASES[phase].phaseName,
      eventPool: [...base, ...roundGenerated],
      talentPool: round === 1
        ? age === 5 ? [21001] : age === 17 ? [21015, 21016] : age === 18 ? [21014] : []
        : [],
      scoreFormulaTag: `${PHASES[phase].phaseName}-${roundName}`,
      note: age === 18
        ? `高考结算第 ${round} 回合：${roundName}`
        : `${age} 岁第 ${round} 回合：${roundName}`,
    });
  }
}

function ending(id, name, tier, description, condition, priority, scoreBonus, endingTags) {
  return { id, name, tier, description, condition, priority, scoreBonus, tags: endingTags };
}

const endings = [
  ending(41001, '清北边缘人', 'SS', '你在极度激烈的竞争中摸到了顶尖门槛。', '(HSCR>=680)&(VOL>=40)&(EVT?[31025])', 100, 60, tags('顶尖', '高考')),
  ending(41002, '稳上 985', 'S', '你的实力和志愿都足够稳健。', '(ADM?[985])&(MARGIN>=8)&(SLIDE=0)', 90, 40, tags('985', '稳健')),
  ending(41003, '竞赛保送生', 'SSS', '你提前锁定了顶级升学资格。', 'EVT?[31017]', 95, 70, tags('竞赛', '保送')),
  ending(41004, '普通一本', 'A', '你稳稳走到了一个不错的本科起点。', '(HSCR>=570)&(VOL>=20)', 70, 20, tags('本科', '稳定')),
  ending(41005, '志愿填报鬼才', 'X', '分数不是最高，但你把每一分都用了个遍。', '(HSCR>=540)&(VOL>=70)&(EVT?[31027])', 80, 35, tags('志愿', '隐藏')),
  ending(41006, '艺体上岸', 'X', '你走出了一条和文化课不同的成功路径。', 'TLT?[21011]', 75, 25, tags('艺体', '隐藏')),
  ending(41007, '复读一年再战', 'C', '你不甘心，决定再给自己一次机会。', '(HSCR<520)&(SPR>=3)&(EVT?[31026])', 60, 10, tags('复读', '风险')),
  ending(41008, '志愿翻车', 'D', '你不是没有实力，只是在最后一步踩进了坑里。', 'EVT?[31028]', 85, -10, tags('滑档', '失败')),
];

const scoreEndings = [
  [41101, '省排前列', 'SSS', '(HSCR>=710)&(RSK<25)', 112, 80],
  [41102, '清北稳线', 'SSS', '(HSCR>=700)&(VOL>=45)', 111, 75],
  [41103, '华五强专业', 'SS', '(HSCR>=675)&(VOL>=55)', 108, 60],
  [41104, '顶尖 985 热门专业', 'SS', '(HSCR>=660)&(VOL>=60)', 106, 55],
  [41105, '强基入围翻盘', 'SS', '(HSCR>=640)&(VOL>=70)&(TLT?[21511,21518])', 105, 55],
  [41106, '211 王牌专业', 'S', '(ADM?[211])&(ADM![985])&(MARGIN>=28)&(VOL>=55)', 84, 40],
  [41107, '双一流稳妥录取', 'S', '(ADM?[doubleFirstClass])&(MARGIN>=24)&(RSK<45)', 82, 35],
  [41108, '省会一本好专业', 'A', '(HSCR>=570)&(VOL>=55)', 82, 25],
  [41109, '城市优先成功', 'A', '(HSCR>=560)&(VOL>=60)&(TLT?[21702])', 81, 24],
  [41110, '专业优先成功', 'A', '(HSCR>=550)&(VOL>=60)&(TLT?[21718])', 81, 24],
  [41111, '普通本科稳住', 'B', '(ADMSCORE>=500)&(ADM![211])&(SLIDE=0)&(VOL>=25)&(RSK<70)', 65, 12],
  [41112, '低分捡漏本科', 'B', '(HSCR>=500)&(VOL>=80)', 78, 25],
  [41113, '民办本科咬牙上', 'C', '(HSCR>=485)&(MNY>=6)', 58, 5],
  [41114, '专科王牌路线', 'C', '(HSCR>=440)&(VOL>=65)', 57, 8],
  [41115, '高复预备役', 'C', '(HSCR<520)&(SPR>=5)&(RSK<70)', 56, 5],
  [41116, '状态崩盘出局', 'D', '(SPR<3)&(RSK>=68)', 96, -20],
  [41117, '高分低报遗憾', 'D', '(ADMSCORE>=600)&(ADM![211])&(VOL<25)&(RSK>=45)', 94, -15],
  [41118, '盲冲滑档', 'D', '(SLIDE=1)|((VOL<25)&(RSK>=65))', 97, -18],
  [41119, '调剂陌生专业', 'B', '(ADM![211])&(ADMSCORE>=540)&(VOL<45)&(RSK<75)&(SLIDE=0)', 74, 8],
  [41120, '保底院校守住', 'B', '(ADMSCORE>=500)&(MARGIN>=35)&(VOL>=35)&(SLIDE=0)', 73, 14],
];
for (const [id, name, tier, condition, priority, bonus] of scoreEndings) {
  endings.push(ending(id, name, tier, `你的分数、风险和志愿策略共同导向了「${name}」。`, condition, priority, bonus, tags('分数线', tier)));
}

const talentEndings = [
  [41121, '县中神话', 'X', '(TLT?[21003])&(HSCR>=630)&(EVT?[31301,31302,31303])'],
  [41122, '数学竞赛金线', 'SSS', '(TLT?[21502,21010])&(EVT?[31502,31017])'],
  [41123, '物理强基少年', 'SS', '(TLT?[21501])&(VOL>=55)&(HSCR>=620)'],
  [41124, '信息学破格路线', 'SS', '(TLT?[21504])&(EVT?[31501,31502,31503])'],
  [41125, '作文单科传奇', 'X', '(TLT?[21506,21202])&(EVT?[31701])'],
  [41126, '艺考文化双过线', 'X', '(TLT?[21011,21508,21509])&(HSCR>=430)'],
  [41127, '体育单招上岸', 'X', '(TLT?[21510])&(STR>=8)'],
  [41128, '强基材料满格', 'X', '(TLT?[21511,21524])&(VOL>=70)'],
  [41129, '志愿数据怪', 'X', '(TLT?[21703])&(VOL>=85)'],
  [41130, '招生章程猎人', 'X', '(TLT?[21712])&(EVT?[31708,31720,31732])'],
  [41131, '专业雷达命中', 'A', '(TLT?[21701])&(VOL>=70)&(HSCR>=540)'],
  [41132, '城市执念成真', 'A', '(TLT?[21702])&(HSCR>=560)&(VOL>=40)'],
  [41133, '名校滤镜反噬', 'D', '(TLT?[21706])&(VOL<30)'],
  [41134, '家长期望压线', 'C', '(TLT?[21008,21415])&(SPR<4)'],
  [41135, '开明家庭稳态', 'S', '(TLT?[21111])&(SPR>=8)&(HSCR>=600)'],
  [41136, '教师家庭信息差', 'S', '(TLT?[21101])&(VOL>=60)&(HSCR>=590)'],
  [41137, '错题本翻身', 'S', '(TLT?[21210,21315])&(HSCR>=600)'],
  [41138, '长跑型选手', 'S', '(TLT?[21321])&(RSK<35)&(HSCR>=590)'],
  [41139, '临场冷血兑现', 'SS', '(TLT?[21601])&(EVT?[31025,31702,31714])'],
  [41140, '大考冻结遗憾', 'D', '(TLT?[21612])&(EVT?[31026])'],
  [41141, '政策窗口上岸', 'X', '(TLT?[21604,21014])&(HSCR>=520)'],
  [41142, '专业洁癖的胜利', 'X', '(TLT?[21718])&(VOL>=65)&(HSCR>=530)'],
  [41143, '风险分层大师', 'X', '(TLT?[21710])&(RSK<30)&(VOL>=75)'],
  [41144, '冲校上头代价', 'D', '(TLT?[21716])&(EVT?[31028,31712,31724,31736])'],
];
for (const [id, name, tier, condition] of talentEndings) {
  const priority = tier === 'X' ? 78 : 88 + (id % 10);
  endings.push(ending(id, name, tier, `你的天赋组合把这局推向了「${name}」。`, condition, priority, tier === 'D' ? -15 : 35, tags('天赋路线', tier)));
}

const eventEndings = [
  [41145, '阅读种子开花', 'S', '(EVT?[31101,31113,31125])&(HSCR>=590)'],
  [41146, '奥数早鸟', 'S', '(EVT?[31201,31213,31225])&(HSCR>=600)'],
  [41147, '英语领读生', 'A', '(EVT?[31202,31214,31226])&(HSCR>=545)&(RSK<60)', 70],
  [41148, '卷面分救命', 'B', '(EVT![31209])&(HSCR>=520)&(HSCR<560)', 73],
  [41149, '中考定位成功', 'A', '(EVT?[31308,31320,31332])&(VOL>=35)&(RSK<70)&(HSCR>=500)', 78],
  [41150, '竞赛试训入坑', 'X', '(EVT?[31303,31315,31327])&(TLT?[21010,21501,21502])'],
  [41151, '选科信息优势', 'S', '(EVT?[31402,31414,31426])&(VOL>=50)'],
  [41152, '住校适应成功', 'A', '(EVT?[31405,31417,31429])&(STR>=6)'],
  [41153, '培优班收益', 'S', '(EVT?[31410,31422,31434])&(HSCR>=600)'],
  [41154, '社团消耗过量', 'C', '(EVT?[31409,31421,31433])&(STR<5)'],
  [41155, '强基宣讲点醒', 'X', '(EVT?[31501,31513,31525])&(VOL>=70)'],
  [41156, '竞赛代价失衡', 'C', '(EVT?[31502,31514,31526])&(RSK>=60)'],
  [41157, '补课精准提分', 'A', '(EVT?[31503,31515,31527])&(HSCR>=570)', 74],
  [41158, '平台期破局', 'S', '(EVT?[31505,31510,31019])&(HSCR>=590)'],
  [41159, '手机上交奇效', 'A', '(EVT?[31512,31524,31536])&(STR>=6)&(RSK<65)&(HSCR>=520)', 77],
  [41160, '一模敢想', 'S', '(EVT?[31601,31613,31625])&(SPR>=6)'],
  [41161, '二模阴影', 'C', '(EVT?[31608,31620,31632])&(SPR<4)&(RSK>=45)', 78],
  [41162, '短板修复上岸', 'S', '(EVT?[31605,31617,31629])&(HSCR>=600)'],
  [41163, '志愿三套预案', 'X', '(EVT?[31607,31619,31631])&(VOL>=75)'],
  [41164, '睡眠保护成功', 'A', '(EVT?[31610,31622,31634])&(RSK<40)'],
  [41165, '作文押中传说', 'X', '(EVT?[31701,31713,31725])'],
  [41166, '数学跳题止损', 'X', '(EVT?[31702,31714,31726])&(RSK<60)'],
  [41167, '英语听力意外', 'C', '(EVT?[31703,31715,31727])&(SPR<6)'],
  [41168, '章程一行救命', 'X', '(EVT?[31708,31720,31732])&(VOL>=60)'],
  [41169, '专业名误导', 'D', '(EVT?[31709,31721,31733])&(VOL<48)&(RSK>=35)', 78],
  [41170, '保专业上岸', 'X', '(EVT?[31711,31723,31735])&(HSCR>=520)'],
  [41171, '提交前惊魂', 'C', '(EVT?[31712,31724,31736])&(RSK>=50)'],
  [41172, '三角比较最优解', 'X', '(EVT?[31707,31719,31731])&(VOL>=75)&(HSCR>=540)'],
];
for (const [id, name, tier, condition, priority] of eventEndings) {
  const defaultPriority = tier === 'S' ? 76 : tier === 'X' ? 72 : 83 + (id % 11);
  endings.push(ending(id, name, tier, `关键经历串成了「${name}」的路线。`, condition, priority ?? defaultPriority, tier === 'D' ? -12 : tier === 'C' ? 5 : 30, tags('事件链', tier)));
}

const achievements = [
  { id: 42101, name: '第一次上岸', description: '解锁任意结局', grade: 0, condition: 'CEND>0', timing: 'summary' },
  { id: 42102, name: '稳上 985', description: '解锁稳上 985', grade: 1, condition: 'END?[41002]', timing: 'summary' },
  { id: 42103, name: '竞赛保送', description: '解锁竞赛保送生', grade: 2, condition: 'END?[41003]', timing: 'summary' },
  { id: 42104, name: '志愿鬼才', description: '解锁志愿填报鬼才', grade: 2, condition: 'END?[41005]', timing: 'summary' },
  { id: 42105, name: '滑档警示', description: '解锁志愿翻车', grade: 0, condition: 'END?[41008]', timing: 'summary' },
  { id: 42106, name: '八面开花', description: '解锁 8 个结局', grade: 3, condition: 'CEND>=8', timing: 'summary' },
  ...[
    ['县中神话', 'END?[41121]', 2],
    ['作文押中', 'END?[41165]', 1],
    ['章程猎人', 'END?[41168]', 2],
    ['低分捡漏', 'END?[41112]', 2],
    ['清北稳线', 'END?[41102]', 3],
    ['高分低报', 'END?[41117]', 1],
    ['复读预备', 'END?[41115,41007]', 0],
    ['长跑胜利', 'END?[41138]', 1],
    ['临场冷血', 'END?[41139]', 2],
    ['专业洁癖', 'END?[41142]', 1],
    ['强基入围', 'END?[41105,41155]', 2],
    ['数学止损', 'END?[41166]', 1],
    ['竞赛代价', 'END?[41156]', 1],
    ['手机上交', 'END?[41159]', 0],
    ['短板修复', 'END?[41162]', 1],
    ['省排前列', 'END?[41101]', 3],
    ['全部结局 25%', 'CEND>=20', 1],
    ['全部结局 50%', 'CEND>=40', 2],
    ['全部结局 75%', 'CEND>=60', 3],
    ['全结局收藏', 'CEND>=80', 3],
    ['见多识广', 'CEVT>=100', 1],
    ['走马观花', 'CEVT>=200', 2],
    ['天赋收藏家', 'CTLT>=80', 2],
    ['天赋全览', 'CTLT>=160', 3],
    ['百次重开', 'TMS>=100', 2],
    ['十次重开', 'TMS>=10', 0],
    ['高分选手', 'HSCR>=650', 1],
    ['极限高分', 'HSCR>=700', 3],
    ['志愿专家', 'HVOL>=90', 2],
    ['风险管理', '(RSK<20)&(HSCR>=580)', 1],
    ['压力爆表', 'RSK>=80', 1],
    ['心态守住', '(SPR>=9)&(HSCR>=580)', 1],
    ['资源逆风', '(MNY<=3)&(HSCR>=600)', 2],
    ['心态崩盘', '(SPR<2)&(RSK>=70)', 1],
  ].map(([name, condition, grade], index) => ({
    id: 42107 + index,
    name,
    description: `达成条件：${condition}`,
    grade,
    condition,
    timing: 'summary',
  })),
];

const characters = [
  { id: 52001, name: '县中黑马', description: '资源不高，但长线耐力极强。', unlockCondition: 'AEND?[41121]', init: { INT: 6, STR: 6, MNY: 3, SPR: 6, VOL: 10 }, talents: [21003, 21004] },
  { id: 52002, name: '志愿军师', description: '分数不是唯一武器，信息也是。', unlockCondition: 'AEND?[41005,41129]', init: { INT: 5, STR: 5, MNY: 5, SPR: 6, VOL: 45 }, talents: [21013, 21710] },
  { id: 52003, name: '竞赛苗子', description: '适合体验竞赛和强基路线。', unlockCondition: 'AEND?[41003,41122]', init: { INT: 8, STR: 5, MNY: 5, SPR: 5, VOL: 20 }, talents: [21010, 21502] },
  { id: 52004, name: '艺体生', description: '文化课和专业路两头拉扯。', unlockCondition: 'AEND?[41006,41126]', init: { INT: 4, STR: 8, MNY: 5, SPR: 7, VOL: 25 }, talents: [21011, 21508] },
  { id: 52005, name: '稳健一本', description: '没有神话，但每一步都很稳。', unlockCondition: 'AEND?[41004]', init: { INT: 5, STR: 6, MNY: 5, SPR: 7, VOL: 25 }, talents: [21007, 21321] },
  { id: 52006, name: '强基少年', description: '提前准备基础学科路线。', unlockCondition: 'AEND?[41105,41155]', init: { INT: 7, STR: 5, MNY: 6, SPR: 5, VOL: 40 }, talents: [21511, 21524] },
  { id: 52007, name: '作文选手', description: '押中素材时有很高上限。', unlockCondition: 'AEND?[41125,41165]', init: { INT: 6, STR: 5, MNY: 4, SPR: 7, VOL: 20 }, talents: [21202, 21506] },
  { id: 52008, name: '高压家庭', description: '分数会涨，心态也会被消耗。', unlockCondition: 'AEND?[41134]', init: { INT: 6, STR: 5, MNY: 6, SPR: 3, VOL: 18 }, talents: [21008, 21314] },
  { id: 52009, name: '专业雷达', description: '适合走专业优先和捡漏路线。', unlockCondition: 'AEND?[41131,41142]', init: { INT: 5, STR: 5, MNY: 5, SPR: 6, VOL: 50 }, talents: [21701, 21718] },
  { id: 52010, name: '临场冷血', description: '高考当天有额外稳定感。', unlockCondition: 'AEND?[41139]', init: { INT: 6, STR: 6, MNY: 4, SPR: 8, VOL: 20 }, talents: [21601, 21306] },
  { id: 52011, name: '玻璃心做题家', description: '上限不错，但压力管理很难。', unlockCondition: 'AEND?[41116,41140]', init: { INT: 7, STR: 5, MNY: 4, SPR: 3, VOL: 12 }, talents: [21006, 21317] },
  { id: 52012, name: '章程猎人', description: '适合体验志愿填报细节线。', unlockCondition: 'AEND?[41130,41168]', init: { INT: 5, STR: 5, MNY: 5, SPR: 6, VOL: 55 }, talents: [21712, 21710] },
  { id: 52013, name: '强校门票', description: '强平台开局，但压力更密集。', unlockCondition: 'TMS>=20', init: { INT: 6, STR: 5, MNY: 8, SPR: 5, VOL: 35 }, talents: [21118, 21402] },
  { id: 52014, name: '低分捡漏王', description: '靠志愿情报把有限分数用到极致。', unlockCondition: 'AEND?[41112]', init: { INT: 4, STR: 5, MNY: 5, SPR: 6, VOL: 70 }, talents: [21703, 21710] },
  { id: 52015, name: '长跑型选手', description: '慢慢积累，后期不容易崩。', unlockCondition: 'AEND?[41138]', init: { INT: 5, STR: 8, MNY: 4, SPR: 7, VOL: 20 }, talents: [21321, 21219] },
  { id: 52016, name: '手机黑洞', description: '风险很高，但也更戏剧化。', unlockCondition: 'TMS>=5', init: { INT: 5, STR: 4, MNY: 5, SPR: 6, VOL: 8 }, talents: [21304, 21016] },
  { id: 52017, name: '信息闭塞挑战', description: '适合挑战滑档边缘翻盘。', unlockCondition: 'AEND?[41008]', init: { INT: 6, STR: 6, MNY: 4, SPR: 6, VOL: 0 }, talents: [21012, 21003] },
  { id: 52018, name: '开明家庭', description: '心态优势明显，路线选择更顺。', unlockCondition: 'AEND?[41135]', init: { INT: 5, STR: 6, MNY: 6, SPR: 8, VOL: 30 }, talents: [21111, 21416] },
  { id: 52019, name: '政策窗口', description: '政策和信息一起发力的路线。', unlockCondition: 'AEND?[41141]', init: { INT: 5, STR: 5, MNY: 5, SPR: 6, VOL: 35 }, talents: [21604, 21014] },
  { id: 52020, name: '押题体感', description: '高三和高考阶段更有戏剧性。', unlockCondition: 'AEND?[41165]', init: { INT: 6, STR: 5, MNY: 5, SPR: 6, VOL: 25 }, talents: [21603, 21016] },
];

function assertCounts() {
  const expected = { talents: 160, events: 280, ages: 64, endings: 80 };
  const actual = { talents: talents.length, events: events.length, ages: ages.length, endings: endings.length };
  for (const key of Object.keys(expected)) {
    if (actual[key] !== expected[key]) throw new Error(`${key}: expected ${expected[key]}, got ${actual[key]}`);
  }
}

function assertValidRefs() {
  const talentIds = new Set(talents.map(item => item.id));
  const eventIds = new Set(events.map(item => item.id));
  const endingIds = new Set(endings.map(item => item.id));

  for (const item of talents) {
    if (!RARITY_CONFIG[item.rarity]) throw new Error(`Talent ${item.id} has invalid rarity ${item.rarity}`);
    if (item.grade !== RARITY_CONFIG[item.rarity].grade) throw new Error(`Talent ${item.id} rarity does not match grade`);
    if (!CATEGORY_CONFIG[item.category]) throw new Error(`Talent ${item.id} has invalid category ${item.category}`);
    if (item.categoryName !== CATEGORY_CONFIG[item.category].name) throw new Error(`Talent ${item.id} categoryName does not match category`);
    if (item.rarityName !== RARITY_CONFIG[item.rarity].name) throw new Error(`Talent ${item.id} rarityName does not match rarity`);
    if (item.effectBudget !== calculateEffectBudget(item.effect)) throw new Error(`Talent ${item.id} effectBudget is stale`);
    if (item.rarity === 'legendary' && item.polarity === 'drawback') throw new Error(`Talent ${item.id} is drawback legendary`);
    for (const key of Object.keys(item.effect || {})) {
      if (!allowedProps.includes(key)) throw new Error(`Talent ${item.id} has invalid effect prop ${key}`);
    }
    for (const id of item.exclude || []) {
      if (!talentIds.has(id)) throw new Error(`Talent ${item.id} excludes missing talent ${id}`);
    }
  }

  for (const item of events) {
    for (const key of Object.keys(item.effect || {})) {
      if (!allowedProps.includes(key)) throw new Error(`Event ${item.id} has invalid effect prop ${key}`);
    }
    for (const branch of item.branch || []) {
      if (!eventIds.has(branch.next)) throw new Error(`Event ${item.id} branches to missing event ${branch.next}`);
    }
  }

  for (const age of ages) {
    for (const entry of age.eventPool) {
      if (!eventIds.has(entry.id)) throw new Error(`Age ${age.age} references missing event ${entry.id}`);
    }
    for (const id of age.talentPool) {
      if (!talentIds.has(id)) throw new Error(`Age ${age.age} references missing talent ${id}`);
    }
  }

  for (const character of characters) {
    for (const id of character.talents) {
      if (!talentIds.has(id)) throw new Error(`Character ${character.id} references missing talent ${id}`);
    }
  }

  for (const achievement of achievements) {
    const refs = [...achievement.condition.matchAll(/END\?\[([0-9,]+)\]/g)].flatMap(match => match[1].split(',').map(Number));
    for (const id of refs) {
      if (!endingIds.has(id)) throw new Error(`Achievement ${achievement.id} references missing ending ${id}`);
    }
  }
}

function writeJson(relativePath, data) {
  const file = join(root, relativePath);
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, `${JSON.stringify(data, null, 2)}\n`, 'utf8');
}

function writeSummary() {
  const lines = [
    '# 标准版扩充内容包',
    '',
    '本内容包基于 `design/gaokao-mvp-content.md` 中《重回高三人生模拟》标准版 MVP 扩充，目标规模约为试玩版 10 倍。',
    '',
    '## 规模',
    '',
    `- 天赋：${talents.length} 个`,
    `- 事件：${events.length} 个`,
    `- 年龄回合表：${ages.length} 行，3-18 岁每年 4 回合`,
    `- 结局：${endings.length} 个`,
    `- 成就：${achievements.length} 个`,
    `- 预设角色：${characters.length} 个`,
    '',
    '## 天赋稀有度',
    '',
    ...raritySummaryLines(),
    '',
    '## ID 段',
    '',
    '- MVP 天赋：21001-21016',
    '- 扩充天赋：21101-21718',
    '- MVP 事件：31001-31028',
    '- 扩充事件：31101-31736',
    '- MVP 结局：41001-41008',
    '- 扩充结局：41101-41172',
    '- 成就：42101 起',
    '- 预设角色：52001 起',
    '',
    '## 内容方向',
    '',
    '- 家庭背景、学习禀赋、习惯人格、社会关系、赛道机会、黑天鹅、志愿信息七类天赋。',
    '- 学前、小学、初中、高一、高二、高三、出分填报七个阶段各新增 36 个事件。',
    '- 年龄推进改为每年 4 回合，事件池按回合拆分，天赋年龄触发只在该年龄第 1 回合发动。',
    '- 结局覆盖分数线、志愿、竞赛、艺体、强基、县中逆袭、临场发挥、滑档和隐藏路线。',
    '',
    '## 文件',
    '',
    '- `src/content/zh-cn/talents.json`',
    '- `src/content/zh-cn/events.json`',
    '- `src/content/zh-cn/ages.json`',
    '- `src/content/zh-cn/endings.json`',
    '- `src/content/zh-cn/achievements.json`',
    '- `src/content/zh-cn/characters.json`',
    '',
  ];
  writeFileSync(join(docsDir, 'content-expansion-summary.md'), `${lines.join('\n')}\n`, 'utf8');
}

function raritySummaryLines() {
  const counts = countBy(talents, item => item.rarity);
  const averageBudget = rarity => {
    const items = talents.filter(item => item.rarity === rarity);
    return items.reduce((sum, item) => sum + item.effectBudget, 0) / Math.max(1, items.length);
  };
  return [
    '| 稀有度 | 数量 | 平均效果预算 |',
    '| --- | ---: | ---: |',
    ...Object.entries(RARITY_CONFIG).map(([rarity, config]) => (
      `| ${config.name} | ${counts[rarity] ?? 0} | ${averageBudget(rarity).toFixed(2)} |`
    )),
  ];
}

assertCounts();
assertValidRefs();

writeJson('src/content/zh-cn/talents.json', talents);
writeJson('src/content/zh-cn/events.json', events);
writeJson('src/content/zh-cn/ages.json', ages);
writeJson('src/content/zh-cn/endings.json', endings);
writeJson('src/content/zh-cn/achievements.json', achievements);
writeJson('src/content/zh-cn/characters.json', characters);
writeSummary();

console.log(`Generated ${talents.length} talents, ${events.length} events, ${endings.length} endings.`);
