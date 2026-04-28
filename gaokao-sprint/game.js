const talents = [
  { id: 81001, name: "模考战神", grade: 1, description: "你一到模拟考就容易超常发挥。", effect: "SAN+1", actionBonus: "模考:1.2", tags: "模考,波动" },
  { id: 81002, name: "正式场软脚虾", grade: 0, description: "真到高考时你会变得手脚发凉。", effect: "SAN-1", phaseBonus: "DAY>330:FINAL-20", tags: "高考,风险" },
  { id: 81003, name: "番茄钟大师", grade: 1, description: "你的单位时间利用率极高。", effect: "EFF+2", actionBonus: "刷题:1.2,复盘错题:1.2", tags: "效率,习惯" },
  { id: 81004, name: "错题本信徒", grade: 2, description: "你特别会从错题里总结规律。", effect: "EFF+1", actionBonus: "复盘错题:1.5", tags: "学习,稳定" },
  { id: 81005, name: "熬夜圣体", grade: 1, description: "熬夜对你的打击没那么大。", effect: "STA+1", actionBonus: "刷题:1.1", tags: "体力,高压" },
  { id: 81006, name: "睡眠敏感", grade: 0, description: "只要睡不好，你第二天就像废了。", effect: "STA-1", phaseBonus: "DAY>250:STA-1", tags: "体力,风险" },
  { id: 81007, name: "家里愿意砸钱", grade: 2, description: "你能获得更强的补课和资料支持。", effect: "SUP+3", actionBonus: "补课:1.4", tags: "资源,补课" },
  { id: 81008, name: "老师单独辅导", grade: 2, description: "老师愿意给你开小灶。", effect: "SUP+1", actionBonus: "沟通老师:1.5", tags: "老师,资源" },
  { id: 81009, name: "最后一百天", grade: 2, description: "越接近高考，你越能豁出去。", effect: "SAN+1", phaseBonus: "DAY>265:EFF+2", tags: "冲刺,逆袭" },
  { id: 81010, name: "破釜沉舟", grade: 2, description: "崩盘边缘时反而更有爆发力。", effect: "SAN-1", phaseBonus: "SAN<3:PRED+15", tags: "高压,逆袭" },
  { id: 81011, name: "手稳如铁", grade: 1, description: "你的发挥波动非常小。", effect: "SAN+2", actionBonus: "模考:1.1", phaseBonus: "DAY>330:FINAL+10", tags: "稳定,高考" },
  { id: 81012, name: "夜里想太多", grade: 0, description: "睡前你总在脑内复盘失败。", effect: "SAN-1", phaseBonus: "DAY>180:CRS+10", tags: "焦虑,风险" },
  { id: 81013, name: "寺庙熟客", grade: 0, description: "你遇事不决先去求签。", effect: "SAN+1", actionBonus: "求神拜佛:1.5", tags: "玄学,整活" },
  { id: 81014, name: "押题圣体", grade: 3, description: "你总能在最后阶段撞上关键题。", effect: "EFF+1", phaseBonus: "DAY>320:FINAL+25", tags: "押题,隐藏" },
  { id: 81015, name: "社交绝缘体", grade: 1, description: "你几乎不会被同学关系干扰。", effect: "SAN+1", actionBonus: "刷题:1.1", tags: "专注,稳定" },
  { id: 81016, name: "易燃易爆炸", grade: 0, description: "你对负反馈极其敏感。", effect: "SAN-2", phaseBonus: "EVT?[82012]:CRS+15", tags: "情绪,风险" },
];

const actions = [
  [83001, "刷题", "用高重复练习换取稳定提分。", "STA-1,CRS+2", "PRED+6", "STA>0", ""],
  [83002, "复盘错题", "把错误转成真正可复用的方法。", "STA-1", "PRED+4,STB+2", "STA>0", ""],
  [83003, "补课", "用额外资源换更高提分速度。", "SUP-1,CRS+2", "PRED+8", "SUP>0", "DAY<320"],
  [83004, "睡觉", "放慢节奏，先把状态拉回来。", "PRED+0", "STA+2,SAN+1,CRS-3", "", ""],
  [83005, "运动", "通过身体活动稳定精神状态。", "STA-0", "SAN+1,CRS-2", "", ""],
  [83006, "摸鱼", "短暂逃避一切。", "PRED-2", "SAN+2", "", ""],
  [83007, "沟通老师", "获取反馈、资料或方法建议。", "STA-1", "SUP+1,VOL+5", "", "DAY<340"],
  [83008, "查志愿", "提前了解专业、城市和录取规则。", "STA-1", "VOL+10", "DAY>260", "DAY>260"],
  [83009, "求神拜佛", "以一点玄学成本换一点心理确定感。", "STA-1", "SAN+2,PRED+2", "", "DAY>240"],
].map(([id, name, description, cost, reward, include, phaseLimit]) => ({ id, name, description, cost, reward, include, phaseLimit }));

const events = [
  [82001, "适应期", "开学第一次周测把你打醒了。", "SAN-1,PRED+2", "", "", "", "", 100, ""],
  [82002, "适应期", "你开始能跟上高三作息了。", "STA+1,SAN+1", "STA>4", "", "", "", 80, ""],
  [82003, "适应期", "你发现自己和年级前排差得比想象中更多。", "SAN-2,CRS+5", "", "", "", "", 90, ""],
  [82004, "适应期", "同桌是个卷王，把你也带进节奏里。", "PRED+4,SAN+1", "", "", "", "", 70, ""],
  [82005, "提升期", "你某一科突然开窍，做题速度快了很多。", "PRED+10", "EFF>5", "", "", "刷题", 80, "开窍"],
  [82006, "提升期", "补课老师准确点出了你的漏洞。", "PRED+8,SUP-1", "SUP>1", "", "", "补课", 70, ""],
  [82007, "提升期", "你开始坚持整理错题，本周的学习更有章法。", "PRED+6,SAN+1", "", "", "", "复盘错题", 80, ""],
  [82008, "提升期", "连续高强度刷题后，你的效率开始下降。", "STA-1,CRS+6", "", "", "", "刷题", 90, "倦怠苗头"],
  [82009, "提升期", "老师单独把你叫去谈了一次。", "SUP+1,SAN+1", "SUP>3", "", "", "沟通老师", 60, ""],
  [82010, "提升期", "一次月考的进步让你重新相信自己。", "SAN+2,PRED+4", "PRED>450", "", "", "", 70, "阶段进步"],
  [82011, "瓶颈期", "你进入平台期，投入很多但提升很少。", "SAN-2,CRS+8", "", "", "", "", 100, "平台期"],
  [82012, "瓶颈期", "模考排名来回跳动，你开始怀疑一切。", "SAN-2,CRS+10", "", "", "SAN<3:82024", "", 90, "模考失利"],
  [82013, "瓶颈期", "你终于找到最适合自己的复习节奏。", "PRED+8,CRS-4", "EVT?[82011]", "", "", "", 60, "节奏稳定"],
  [82014, "瓶颈期", "家长的焦虑开始直接传导到你身上。", "SAN-1,CRS+6", "", "", "", "", 80, "家庭施压"],
  [82015, "瓶颈期", "一次彻底的休整意外让你恢复了些元气。", "STA+2,SAN+2,CRS-6", "EVT?[82008,82011]", "", "", "睡觉", 60, ""],
  [82016, "瓶颈期", "你开始偷偷查学校和专业，目标突然清晰了。", "VOL+15,SAN+1", "DAY>180", "", "", "查志愿", 70, "志愿起步"],
  [82017, "冲刺期", "百日誓师后，你第一次觉得时间真的不多了。", "CRS+4,PRED+4", "", "", "", "", 100, "百日冲刺"],
  [82018, "冲刺期", "一套押题卷正中你的薄弱点。", "PRED+10,SAN+1", "(TLT?[81014])|(SUP>4)", "", "", "", 50, "押题成功"],
  [82019, "冲刺期", "连续熬夜后，你白天开始发懵。", "STA-2,SAN-1,CRS+8", "STA<4", "", "", "", 90, "熬夜反噬"],
  [82020, "冲刺期", "你把能砍掉的社交都砍掉了，效率明显更高。", "PRED+8,SAN-1", "(TLT?[81015])|(SAN>4)", "", "", "", 60, "冲刺稳定"],
  [82021, "临场期", "高考前夜你睡得异常安稳。", "SAN+2,FINAL+10", "SAN>5", "EVT?[82022]", "", "", 60, "稳定发挥"],
  [82022, "临场期", "高考前夜你几乎整晚没睡着。", "SAN-2,FINAL-20,CRS+10", "(SAN<4)|(TLT?[81002,81006])", "", "", "", 70, "临场失常"],
  [82023, "临场期", "语文作文题目刚好和你押到的材料高度贴近。", "FINAL+20", "(TLT?[81014])|(EVT?[82018])", "", "", "", 40, "高考超常"],
  [82024, "临场期", "你在考场上突然大脑一片空白。", "FINAL-35,SAN-2", "(EVT?[82012])|(TLT?[81002,81016])", "", "", "", 60, "崩盘出局"],
].map(([id, phase, content, effect, include, exclude, branch, actionLink, weight, flag]) => ({ id, phase, content, effect, include, exclude, branch, actionLink, weight, flag }));

const timeline = [
  [1, 1, 30, "适应期", "82001", "82002*60,82003*70,82004*50", 0, "开学适应"],
  [2, 31, 60, "适应期", "", "82002*60,82003*60,82004*60", 1, "首轮周测"],
  [3, 61, 90, "提升期", "", "82005*60,82006*50,82007*60,82008*50", 0, "一轮复习前段"],
  [4, 91, 120, "提升期", "", "82005*60,82006*60,82007*70,82009*40", 1, "月考节点"],
  [5, 121, 150, "提升期", "82010", "82006*50,82007*60,82008*60", 0, "阶段提分"],
  [6, 151, 180, "瓶颈期", "82011", "82012*70,82014*60,82015*40", 1, "进入平台期"],
  [7, 181, 210, "瓶颈期", "", "82012*60,82013*50,82014*60,82016*40", 0, "排名焦虑"],
  [8, 211, 240, "瓶颈期", "", "82013*60,82014*60,82015*50,82016*60", 1, "二模前后"],
  [9, 241, 270, "冲刺期", "82017", "82018*30,82019*60,82020*50", 0, "百日冲刺"],
  [10, 271, 300, "冲刺期", "", "82018*40,82019*70,82020*60", 1, "三模节点"],
  [11, 301, 330, "冲刺期", "", "82018*40,82019*60,82020*60", 0, "最后调整"],
  [12, 331, 365, "临场期", "", "82021*50,82022*60,82023*30,82024*50", 0, "高考与出分"],
].map(([step, dayStart, dayEnd, phase, fixedEvents, randomPool, mockExam, note]) => ({
  step, dayStart, dayEnd, phase, fixedEvents: parseIds(fixedEvents), randomPool: parsePool(randomPool), mockExam: Boolean(mockExam), note
}));

const endings = [
  { id: 84001, name: "一战封神", tier: "SSS", description: "你在最关键的几天里完成了近乎完美的兑现。", condition: "(FINAL>=680)&(EVT?[82021,82023])", priority: 100, bonus: 70 },
  { id: 84002, name: "稳定上岸 985", tier: "S", description: "你没有太多戏剧性，但全程都足够稳。", condition: "(FINAL>=620)&(EVT![82024])", priority: 90, bonus: 40 },
  { id: 84003, name: "模考幻神", tier: "A", description: "你平时惊艳，但正式场没完全兑现出来。", condition: "(PRED>=650)&(FINAL<620)", priority: 80, bonus: 15 },
  { id: 84004, name: "最后一百天奇迹", tier: "X", description: "你把最后一段路走成了逆天剧本。", condition: "(TLT?[81009])&(FINAL>=620)&(EVT?[82017,82023])", priority: 95, bonus: 45 },
  { id: 84005, name: "志愿操作怪", tier: "X", description: "分数不错，报考更是漂亮。", condition: "(FINAL>=560)&(VOL>=70)", priority: 85, bonus: 30 },
  { id: 84006, name: "押题之神", tier: "X", description: "你把玄学和努力都吃满了。", condition: "(TLT?[81014])&(EVT?[82023])", priority: 88, bonus: 35 },
  { id: 84007, name: "复读预备役", tier: "D", description: "你知道自己还能更好，只是这次没顶住。", condition: "(FINAL<520)&(SAN>=2)", priority: 70, bonus: 5 },
  { id: 84008, name: "考场崩盘", tier: "D", description: "你把最怕发生的事，真的带到了那一天。", condition: "EVT?[82024]", priority: 92, bonus: -15 },
];

const templates = [
  { id: "steady", name: "稳扎稳打", description: "基础中上，状态稳定，资源一般。", props: { BAS: 480, EFF: 5, STA: 5, SAN: 6, SUP: 4, CRS: 10, PRED: 480, VOL: 10, STB: 5, FINAL: 0 } },
  { id: "resource", name: "资源拉满", description: "起点更高，但压力和期待也更重。", props: { BAS: 510, EFF: 5, STA: 4, SAN: 4, SUP: 8, CRS: 18, PRED: 510, VOL: 20, STB: 4, FINAL: 0 } },
  { id: "comeback", name: "县中逆袭", description: "基础普通，效率和抗压是主要武器。", props: { BAS: 440, EFF: 6, STA: 6, SAN: 5, SUP: 2, CRS: 12, PRED: 440, VOL: 5, STB: 5, FINAL: 0 } },
];

const labels = { PRED: "估分", FINAL: "高考", EFF: "效率", STA: "体力", SAN: "心态", SUP: "支持", CRS: "压力", VOL: "志愿" };
const setup = document.querySelector("#setup");
const game = document.querySelector("#game");
const talentList = document.querySelector("#talentList");
const templateList = document.querySelector("#templates");
const startGame = document.querySelector("#startGame");
const pickedTalents = document.querySelector("#pickedTalents");
const actionList = document.querySelector("#actionList");
const actionCounter = document.querySelector("#actionCounter");
const stats = document.querySelector("#stats");
const log = document.querySelector("#log");
const phaseLabel = document.querySelector("#phaseLabel");
const progressText = document.querySelector("#progressText");
const progressBar = document.querySelector("#progressBar");

let shownTalents = [];
let selectedTalentIds = [];
let selectedTemplateId = templates[0].id;
let state = null;

function rerollTalents() {
  shownTalents = shuffle(talents).slice(0, 10);
  selectedTalentIds = [];
  renderTalentList();
}

function renderTalentList() {
  talentList.innerHTML = shownTalents.map(talent => {
    const selected = selectedTalentIds.includes(talent.id);
    return `<button class="talent ${selected ? "selected" : ""}" data-id="${talent.id}" type="button">
      <span class="grade">${talent.grade}</span>
      <strong>${talent.name}</strong>
      <small>${talent.description}</small>
      <p class="muted">${talent.tags}</p>
    </button>`;
  }).join("");
  updateStartState();
}

function renderTemplates() {
  templateList.innerHTML = templates.map(template => `
    <button class="template ${template.id === selectedTemplateId ? "selected" : ""}" data-template="${template.id}" type="button">
      <strong>${template.name}</strong>
      <small>${template.description}</small>
      <p class="muted">估分 ${template.props.PRED} / 效率 ${template.props.EFF} / 心态 ${template.props.SAN}</p>
    </button>
  `).join("");
}

function updateStartState() {
  startGame.disabled = selectedTalentIds.length !== 3;
}

function start() {
  const template = templates.find(item => item.id === selectedTemplateId);
  state = {
    props: { DAY: 1, ...structuredClone(template.props) },
    talents: [...selectedTalentIds],
    events: [],
    actions: [],
    stepIndex: 0,
    actionsThisStep: 0,
    finished: false,
  };
  for (const id of state.talents) applyEffect(getTalent(id).effect);
  setup.classList.add("hidden");
  game.classList.remove("hidden");
  log.innerHTML = "";
  pickedTalents.innerHTML = state.talents.map(id => talentCard(getTalent(id))).join("");
  addLog("开局", `${template.name}：${state.talents.map(id => getTalent(id).name).join("、")}`);
  renderGame();
}

function doAction(actionId) {
  if (state.finished || state.actionsThisStep >= 2) return;
  const action = actions.find(item => item.id === actionId);
  if (!canUse(action)) return;
  state.actions.push(action.name);
  state.actionsThisStep += 1;
  applyEffect(action.cost);
  applyEffect(action.reward, actionMultiplier(action.name));
  addLog("行动", `${action.name}：${action.description}`);
  if (state.actionsThisStep >= 2) resolveStep();
  renderGame();
}

function resolveStep() {
  const step = timeline[state.stepIndex];
  state.props.DAY = step.dayEnd;
  step.fixedEvents.forEach(id => doEvent(getEvent(id)));
  const event = chooseEvent(step.randomPool);
  if (event) doEvent(event);
  if (step.mockExam) mockExam(step);
  applyPhaseBonuses();
  recoverBetweenSteps();
  state.stepIndex += 1;
  state.actionsThisStep = 0;
  if (state.stepIndex >= timeline.length) finish();
}

function doEvent(event) {
  let active = event;
  if (active.branch) {
    const [condition, nextId] = active.branch.split(":");
    if (check(condition)) active = getEvent(Number(nextId));
  }
  state.events.push(active.id);
  if (active.flag) state.actions.push(active.flag);
  applyEffect(active.effect);
  addLog(`${active.phase}事件`, `${active.content}${active.flag ? `（${active.flag}）` : ""}`);
}

function mockExam(step) {
  const stability = (state.props.SAN + state.props.STB) * 2 - state.props.CRS / 8;
  const random = Math.round((Math.random() - .42) * 34);
  const bonus = Math.round((stability + random) * actionMultiplier("模考"));
  state.props.PRED = clamp(state.props.PRED + bonus, 250, 730);
  addLog("模考", `${step.note}，本次波动 ${bonus >= 0 ? "+" : ""}${bonus} 分。`);
}

function finish() {
  state.finished = true;
  state.props.DAY = 365;
  const pressurePenalty = Math.max(0, state.props.CRS - 50) * .8;
  const stabilityBonus = state.props.SAN * 4 + state.props.STB * 3;
  state.props.FINAL = clamp(Math.round(state.props.PRED + state.props.FINAL + stabilityBonus - pressurePenalty), 250, 750);
  applyPhaseBonuses();
  state.props.FINAL = clamp(state.props.FINAL, 250, 750);
  const ending = [...endings].sort((a, b) => b.priority - a.priority).find(item => check(item.condition)) || {
    name: state.props.FINAL >= 520 ? "普通上岸" : "高压失利",
    tier: state.props.FINAL >= 520 ? "B" : "C",
    description: state.props.FINAL >= 520 ? "你把这一年撑完了，也拿到了一个现实的起点。" : "这一年消耗太大，结果没有兑现全部努力。",
    bonus: 0,
  };
  const summary = Math.round(state.props.FINAL * .55 + state.props.PRED * .15 + state.props.VOL * .7 + ending.bonus);
  addLog("结局", `<div class="ending"><strong>${ending.tier} · ${ending.name}</strong><p>${ending.description}</p><p>总评：${summary}</p></div>`);
  document.querySelector("#autoAction").disabled = true;
  renderGame();
}

function chooseEvent(pool) {
  const recentActions = state.actions.slice(-4);
  const candidates = pool.map(([id, weight]) => {
    const event = getEvent(id);
    const linked = event.actionLink && recentActions.includes(event.actionLink);
    return [event, linked ? weight * 1.5 : weight];
  }).filter(([event]) => (!event.include || check(event.include)) && (!event.exclude || !check(event.exclude)));
  if (!candidates.length) return null;
  return weightRandom(candidates);
}

function canUse(action) {
  return (!action.include || check(action.include)) && (!action.phaseLimit || check(action.phaseLimit));
}

function actionMultiplier(name) {
  return state.talents.reduce((rate, id) => {
    const talent = getTalent(id);
    const bonus = parseNamedBonus(talent.actionBonus)[name];
    return bonus ? rate * bonus : rate;
  }, 1);
}

function applyPhaseBonuses() {
  for (const id of state.talents) {
    const talent = getTalent(id);
    if (!talent.phaseBonus) continue;
    for (const item of talent.phaseBonus.split(",")) {
      const [condition, effect] = item.split(":");
      if (condition && effect && check(condition)) applyEffect(effect);
    }
  }
}

function recoverBetweenSteps() {
  state.props.STA = clamp(state.props.STA + 1, 0, 10);
  state.props.CRS = clamp(state.props.CRS - 1, 0, 100);
}

function applyEffect(effect = "", multiplier = 1) {
  effect.split(",").map(item => item.trim()).filter(Boolean).forEach(item => {
    const [, prop, sign, raw] = item.match(/^([A-Z]+)([+-])(\d+)$/) || [];
    if (!prop) return;
    const value = Math.round(Number(raw) * multiplier) * (sign === "-" ? -1 : 1);
    state.props[prop] = (state.props[prop] || 0) + value;
    if (["EFF", "STA", "SAN", "SUP", "STB"].includes(prop)) state.props[prop] = clamp(state.props[prop], 0, 15);
    if (prop === "VOL" || prop === "CRS") state.props[prop] = clamp(state.props[prop], 0, 100);
    if (prop === "PRED") state.props[prop] = clamp(state.props[prop], 250, 750);
  });
}

function check(condition = "") {
  if (!condition) return true;
  return parseCondition(condition.replace(/\s/g, ""));
}

function parseCondition(expression) {
  let index = 0;
  const parseOr = () => {
    let value = parseAnd();
    while (expression[index] === "|") {
      index += 1;
      value = parseAnd() || value;
    }
    return value;
  };
  const parseAnd = () => {
    let value = parseTerm();
    while (expression[index] === "&") {
      index += 1;
      value = parseTerm() && value;
    }
    return value;
  };
  const parseTerm = () => {
    if (expression[index] === "(") {
      index += 1;
      const value = parseOr();
      index += 1;
      return value;
    }
    let token = "";
    while (index < expression.length && !"()&|".includes(expression[index])) token += expression[index++];
    return checkAtom(token);
  };
  return parseOr();
}

function checkAtom(token) {
  const special = token.match(/^(TLT|EVT)([?!])\[(.+)\]$/);
  if (special) {
    const [, type, op, raw] = special;
    const values = raw.split(",").map(Number);
    const source = type === "TLT" ? state.talents : state.events;
    const hit = values.some(value => source.includes(value));
    return op === "?" ? hit : !hit;
  }
  const match = token.match(/^([A-Z]+)(>=|<=|>|<|=|!=)(-?\d+)$/);
  if (!match) return false;
  const [, prop, op, raw] = match;
  const left = state.props[prop] || 0;
  const right = Number(raw);
  if (op === ">") return left > right;
  if (op === "<") return left < right;
  if (op === ">=") return left >= right;
  if (op === "<=") return left <= right;
  if (op === "=") return left === right;
  return left !== right;
}

function renderGame() {
  const step = timeline[state.stepIndex] || timeline.at(-1);
  phaseLabel.textContent = state.finished ? "结算完成" : `${step.phase} · ${step.note}`;
  progressText.textContent = `Day ${state.props.DAY} / 365`;
  progressBar.style.width = `${clamp(state.props.DAY / 365 * 100, 0, 100)}%`;
  actionCounter.textContent = `${state.actionsThisStep} / 2`;
  stats.innerHTML = ["PRED", "FINAL", "EFF", "STA", "SAN", "SUP", "CRS", "VOL"].map(prop => `
    <div class="stat"><span>${labels[prop]}</span><strong>${state.props[prop] || 0}</strong></div>
  `).join("");
  actionList.innerHTML = actions.map(action => `
    <button class="actionCard" data-action="${action.id}" type="button" ${state.finished || state.actionsThisStep >= 2 || !canUse(action) ? "disabled" : ""}>
      <strong>${action.name}</strong>
      <small>${action.description}</small>
      <span class="effect">${action.cost} -> ${action.reward}</span>
    </button>
  `).join("");
}

function addLog(title, html) {
  const li = document.createElement("li");
  li.innerHTML = `<strong>${title}</strong><p>${html}</p>`;
  log.prepend(li);
}

function parsePool(value) {
  return value.split(",").filter(Boolean).map(item => {
    const [id, weight = 1] = item.split("*");
    return [Number(id), Number(weight)];
  });
}

function parseIds(value) {
  return value ? value.split(",").map(Number) : [];
}

function parseNamedBonus(value = "") {
  return Object.fromEntries(value.split(",").filter(Boolean).map(item => {
    const [name, rate] = item.split(":");
    return [name, Number(rate)];
  }));
}

function getTalent(id) {
  return talents.find(item => item.id === id);
}

function getEvent(id) {
  return events.find(item => item.id === id);
}

function talentCard(talent) {
  return `<div class="talent"><span class="grade">${talent.grade}</span><strong>${talent.name}</strong><small>${talent.description}</small><p class="muted">${talent.tags}</p></div>`;
}

function weightRandom(entries) {
  const total = entries.reduce((sum, [, weight]) => sum + weight, 0);
  let cursor = Math.random() * total;
  for (const [item, weight] of entries) {
    cursor -= weight;
    if (cursor <= 0) return item;
  }
  return entries.at(-1)[0];
}

function shuffle(list) {
  return [...list].sort(() => Math.random() - .5);
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

talentList.addEventListener("click", event => {
  const button = event.target.closest("[data-id]");
  if (!button) return;
  const id = Number(button.dataset.id);
  if (selectedTalentIds.includes(id)) selectedTalentIds = selectedTalentIds.filter(item => item !== id);
  else if (selectedTalentIds.length < 3) selectedTalentIds.push(id);
  renderTalentList();
});

templateList.addEventListener("click", event => {
  const button = event.target.closest("[data-template]");
  if (!button) return;
  selectedTemplateId = button.dataset.template;
  renderTemplates();
});

actionList.addEventListener("click", event => {
  const button = event.target.closest("[data-action]");
  if (!button) return;
  doAction(Number(button.dataset.action));
});

document.querySelector("#rerollTalents").addEventListener("click", rerollTalents);
document.querySelector("#startGame").addEventListener("click", start);
document.querySelector("#autoAction").addEventListener("click", () => {
  if (state.finished) return;
  while (!state.finished && state.actionsThisStep < 2) {
    const usable = actions.filter(canUse);
    if (!usable.length) break;
    const pressure = state.props.CRS > 55 || state.props.STA < 2;
    const action = pressure ? actions.find(item => item.name === "睡觉") : usable[Math.floor(Math.random() * usable.length)];
    doAction(action.id);
  }
});
document.querySelector("#restart").addEventListener("click", () => location.reload());

rerollTalents();
renderTemplates();
