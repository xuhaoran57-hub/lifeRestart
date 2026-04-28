const talents = [
  { id: 21001, name: "学前启蒙", grade: 1, description: "5 岁时学力 +2", effect: "INT+2", triggerAge: 5, tags: "学前,成长" },
  { id: 21002, name: "重点学区房", grade: 2, description: "家庭教育资源充足", effect: "MNY+2", exclusive: [21003], tags: "家庭,资源" },
  { id: 21003, name: "县中黑马", grade: 1, description: "环境普通，但你很能卷", effect: "INT+1,STR+1", exclusive: [21002], tags: "环境,逆袭" },
  { id: 21004, name: "自律成瘾", grade: 2, description: "你擅长长期执行计划", effect: "STR+1", exclusive: [21005], tags: "习惯,稳定" },
  { id: 21005, name: "重度拖延", grade: 0, description: "你总把任务拖到最后", effect: "SPR+1", exclusive: [21004], tags: "习惯,风险" },
  { id: 21006, name: "偏科怪才", grade: 1, description: "你在优势学科上提升更快", effect: "INT+2,SPR-1", exclusive: [21007], tags: "学习,偏科" },
  { id: 21007, name: "全面均衡", grade: 1, description: "你没有明显短板", effect: "INT+1,STR+1,SPR+1", exclusive: [21006], tags: "学习,稳定" },
  { id: 21008, name: "家长期望过高", grade: 0, description: "家里总拿你和别人比较", effect: "SPR-1,MNY+1", tags: "家庭,压力" },
  { id: 21009, name: "班主任偏爱", grade: 1, description: "老师愿意给你更多关注", effect: "SPR+1", tags: "学校,关系" },
  { id: 21010, name: "竞赛体质", grade: 2, description: "你适合走竞赛和保送路线", effect: "INT+1", exclusive: [21011], tags: "竞赛,特殊线" },
  { id: 21011, name: "艺体特长", grade: 1, description: "你有艺体赛道可选", effect: "STR+1,SPR+1", exclusive: [21010], tags: "艺体,特殊线" },
  { id: 21012, name: "信息闭塞", grade: 0, description: "你对升学规则总慢半拍", effect: "VOL-20", exclusive: [21013], tags: "志愿,风险" },
  { id: 21013, name: "志愿军师", grade: 2, description: "身边有人很懂报考策略", effect: "VOL+35", exclusive: [21012], tags: "志愿,策略" },
  { id: 21014, name: "少数民族加分", grade: 1, description: "你在录取政策上有优势", effect: "VOL+10", triggerAge: 18, tags: "政策,录取" },
  { id: 21015, name: "逢考失眠", grade: 0, description: "大考越近，你越睡不好", effect: "SPR-1", triggerAge: 17, exclusive: [21016], tags: "高压,风险" },
  { id: 21016, name: "佛脚战神", grade: 1, description: "冲刺期提升异常明显", effect: "INT+2", triggerAge: 17, exclusive: [21015], tags: "冲刺,逆袭" },
];

const events = [
  [31001, "学前期", "父母开始坚持给你读睡前故事。", "INT+1,SPR+1", "MNY>3", "", "", 100, ""],
  [31002, "学前期", "你从小主要和电视与短视频作伴。", "SPR+1,INT-1", "", "", "", 90, ""],
  [31003, "学前期", "家里咬牙给你报了早教班。", "INT+1,MNY-1", "MNY>4", "", "", 60, ""],
  [31004, "学前期", "家里搬家，你换了一个新环境。", "SPR-1,VOL+5", "", "", "", 50, ""],
  [31005, "小学期", "你第一次拿到班级前几名。", "INT+1,SPR+1", "INT>4", "", "", 100, ""],
  [31006, "小学期", "你某一科明显跟不上节奏。", "INT-1,SPR-1", "", "", "", 90, ""],
  [31007, "小学期", "一位负责的老师很欣赏你。", "INT+1,SPR+1,VOL+5", "SPR>4", "", "", 70, ""],
  [31008, "小学期", "你开始沉迷游戏，作业也越拖越久。", "SPR+1,STR-1,RSK+5", "", "", "", 80, ""],
  [31009, "初中期", "你被分进了重点班。", "INT+1,SPR-1", "INT>5", "", "", 90, "重点班"],
  [31010, "初中期", "排名开始公开，你第一次感到窒息。", "SPR-2,RSK+10", "", "", "", 100, ""],
  [31011, "初中期", "你在竞赛课上第一次找到天赋感。", "INT+2", "(INT>6)|(TLT?[21010])", "", "", 60, "竞赛苗子"],
  [31012, "初中期", "你开始对同学产生朦胧好感，注意力有点飘。", "SPR+1,INT-1", "", "", "", 70, ""],
  [31013, "高一期", "你选到了适合自己的科目组合。", "INT+1,SPR+1", "INT>5", "", "", 80, "选科成功"],
  [31014, "高一期", "你跟风选科，后来越学越别扭。", "INT-1,SPR-1,RSK+5", "", "EVT?[31013]", "", 80, "选科失误"],
  [31015, "高一期", "住校后你慢慢适应了集体节奏。", "STR+1,SPR+1", "STR>4", "", "", 70, ""],
  [31016, "高一期", "住校后你总睡不好，白天也难集中。", "STR-1,SPR-1", "", "", "", 70, ""],
  [31017, "高二期", "你被选去参加竞赛集训。", "INT+2,SPR-1", "EVT?[31011]", "", "", 40, "竞赛集训"],
  [31018, "高二期", "家里经济上有些吃紧，补课计划被打断了。", "MNY-2,SPR-1", "", "", "", 70, ""],
  [31019, "高二期", "一次模考把你彻底点醒。", "INT+1,SPR+1,RSK-5", "", "", "", 90, "觉醒时刻"],
  [31020, "高二期", "你进入了成绩平台期，怎么学都像原地踏步。", "SPR-1,RSK+5", "", "", "", 100, "平台期"],
  [31021, "高三期", "一轮复习开始见效，你的基础明显扎实起来。", "INT+2,STR-1", "STR>3", "", "", 90, "冲刺见效"],
  [31022, "高三期", "二轮开始后，你反而越来越焦虑。", "SPR-2,RSK+10", "", "", "SPR<2:31026", 90, "心态波动"],
  [31023, "高三期", "百日冲刺后，你的节奏终于稳定下来了。", "INT+1,SPR+1,RSK-5", "(EVT?[31021])|(TLT?[21016])", "", "", 80, "百日冲刺"],
  [31024, "高三期", "一套押题卷刚好覆盖了你最担心的内容。", "INT+1,SPR+1", "TLT?[21016,21013]", "", "", 50, "押题成功"],
  [31025, "出分填报期", "高考当天你异常冷静，几乎发挥出了全部水平。", "HSCR+20,SPR+1", "(SPR>6)&(INT>7)", "EVT?[31026]", "", 50, "高考超常"],
  [31026, "出分填报期", "高考当天你连续失误，整个人都懵了。", "HSCR-30,SPR-2,RSK+15", "(SPR<4)|(EVT?[31022])|(TLT?[21015])", "", "", 60, "临场失常"],
  [31027, "出分填报期", "你在志愿填报上做足了功课，避开了大部分坑。", "VOL+20", "(VOL>30)|(TLT?[21013])", "", "", 70, "志愿稳健"],
  [31028, "出分填报期", "你一味往上冲，最后滑到了完全不想去的专业。", "VOL-20,RSK+10", "(VOL<20)|(TLT?[21012])", "", "", 70, "志愿翻车"],
].map(([id, stage, content, effect, include, exclude, branch, weight, flag]) => ({ id, stage, content, effect, include, exclude, branch, weight, flag }));

const ages = [
  [3, "学前期", "31001*80,31002*60,31004*30"],
  [4, "学前期", "31001*70,31002*60,31003*40"],
  [5, "学前期", "31003*60,31004*40"],
  [6, "小学期", "31005*60,31006*50,31007*30"],
  [7, "小学期", "31005*70,31006*50,31008*40"],
  [8, "小学期", "31005*70,31007*40,31008*50"],
  [9, "小学期", "31005*60,31006*60,31008*50"],
  [10, "小学期", "31005*60,31006*70,31007*40"],
  [11, "小学期", "31006*70,31007*50,31008*40"],
  [12, "初中期", "31009*50,31010*80,31011*30,31012*40"],
  [13, "初中期", "31009*60,31010*90,31011*40,31012*50"],
  [14, "初中期", "31009*60,31010*80,31011*50,31012*40"],
  [15, "高一期", "31013*70,31014*70,31015*50,31016*50"],
  [16, "高二期", "31017*40,31018*60,31019*70,31020*80"],
  [17, "高三期", "31021*80,31022*90,31023*70,31024*40"],
  [18, "出分填报期", "31025*50,31026*60,31027*70,31028*70"],
].map(([age, phase, pool]) => ({ age, phase, pool: parsePool(pool) }));

const endings = [
  { id: 41001, name: "清北边缘人", tier: "SS", description: "你在极度激烈的竞争中摸到了顶尖门槛。", condition: "(HSCR>=680)&(VOL>=40)&(EVT?[31025])", priority: 100, bonus: 60 },
  { id: 41002, name: "稳上 985", tier: "S", description: "你的实力和志愿都足够稳健。", condition: "(HSCR>=630)&(VOL>=35)&(EVT![31028])", priority: 90, bonus: 40 },
  { id: 41003, name: "竞赛保送生", tier: "SSS", description: "你提前锁定了顶级升学资格。", condition: "EVT?[31017]", priority: 95, bonus: 70 },
  { id: 41004, name: "普通一本", tier: "A", description: "你稳稳走到了一个不错的本科起点。", condition: "(HSCR>=570)&(VOL>=20)", priority: 70, bonus: 20 },
  { id: 41005, name: "志愿填报鬼才", tier: "X", description: "分数不是最高，但你把每一分都用了个遍。", condition: "(HSCR>=540)&(VOL>=70)&(EVT?[31027])", priority: 80, bonus: 35 },
  { id: 41006, name: "艺体上岸", tier: "X", description: "你走出了一条和文化课不同的成功路径。", condition: "TLT?[21011]", priority: 75, bonus: 25 },
  { id: 41007, name: "复读一年再战", tier: "C", description: "你不甘心，决定再给自己一次机会。", condition: "(HSCR<520)&(SPR>=3)&(EVT?[31026])", priority: 60, bonus: 10 },
  { id: 41008, name: "志愿翻车", tier: "D", description: "你不是没有实力，只是在最后一步踩进了坑里。", condition: "EVT?[31028]", priority: 85, bonus: -10 },
];

const labels = { INT: "学力", STR: "精力", MNY: "资源", SPR: "心态", VOL: "志愿", RSK: "风险" };
const setup = document.querySelector("#setup");
const game = document.querySelector("#game");
const talentList = document.querySelector("#talentList");
const allocationList = document.querySelector("#allocationList");
const pointsLeft = document.querySelector("#pointsLeft");
const startGame = document.querySelector("#startGame");
const stats = document.querySelector("#stats");
const log = document.querySelector("#log");
const pickedTalents = document.querySelector("#pickedTalents");
const phaseLabel = document.querySelector("#phaseLabel");
const scoreText = document.querySelector("#scoreText");
const scoreBar = document.querySelector("#scoreBar");

let shownTalents = [];
let selectedTalentIds = [];
let allocation = { INT: 5, STR: 5, MNY: 5, SPR: 5 };
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

function renderAllocation() {
  allocationList.innerHTML = Object.keys(allocation).map(key => `
    <label class="allocation">
      <span>${labels[key]}</span>
      <input type="range" min="0" max="10" value="${allocation[key]}" data-prop="${key}">
      <strong>${allocation[key]}</strong>
    </label>
  `).join("");
  updateStartState();
}

function updateStartState() {
  const total = Object.values(allocation).reduce((sum, value) => sum + value, 0);
  const left = 20 - total;
  pointsLeft.textContent = left;
  pointsLeft.style.color = left === 0 ? "var(--good)" : "var(--bad)";
  startGame.disabled = selectedTalentIds.length !== 3 || left !== 0;
}

function start() {
  state = {
    props: { AGE: 2, INT: 0, STR: 0, MNY: 0, SPR: 0, VOL: 10, RSK: 0, HSCR: 0, SCOREMOD: 0 },
    talents: [...selectedTalentIds],
    events: [],
    flags: [],
    finished: false,
  };
  Object.entries(allocation).forEach(([prop, value]) => state.props[prop] = value);
  for (const id of state.talents) {
    const talent = getTalent(id);
    if (!talent.triggerAge) applyEffect(talent.effect);
  }
  setup.classList.add("hidden");
  game.classList.remove("hidden");
  log.innerHTML = "";
  pickedTalents.innerHTML = state.talents.map(id => talentCard(getTalent(id))).join("");
  addLog("开局", `你带着 ${state.talents.map(id => getTalent(id).name).join("、")} 开始了这轮升学人生。`);
  nextAge();
}

function nextAge() {
  if (state.finished) return;
  state.props.AGE += 1;
  const ageData = ages.find(item => item.age === state.props.AGE);
  if (!ageData) return finish();

  for (const talent of talents.filter(item => state.talents.includes(item.id) && item.triggerAge === state.props.AGE)) {
    applyEffect(talent.effect);
    addLog(`${state.props.AGE} 岁天赋`, `${talent.name}：${talent.description}`);
  }

  const event = chooseEvent(ageData.pool);
  if (event) doEvent(event);
  updateScore(ageData.phase);
  renderGame(ageData.phase);

  if (state.props.AGE >= 18) finish();
}

function doEvent(event) {
  let active = event;
  if (active.branch) {
    const [condition, nextId] = active.branch.split(":");
    if (check(condition)) active = getEvent(Number(nextId));
  }
  state.events.push(active.id);
  if (active.flag) state.flags.push(active.flag);
  applyEffect(active.effect);
  addLog(`${state.props.AGE} 岁 · ${active.stage}`, `${active.content}${active.flag ? `（${active.flag}）` : ""}`);
}

function finish() {
  state.finished = true;
  updateScore("高考结算", true);
  const ending = [...endings].sort((a, b) => b.priority - a.priority).find(item => check(item.condition)) || {
    name: state.props.HSCR >= 520 ? "普通本科" : "仍需再战",
    tier: state.props.HSCR >= 520 ? "B" : "C",
    description: state.props.HSCR >= 520 ? "你获得了一个普通但真实的起点。" : "这次结果不理想，但路还没完全封死。",
    bonus: 0,
  };
  const summary = Math.round(state.props.HSCR * .45 + (state.props.INT + state.props.STR + state.props.MNY + state.props.SPR) * 8 + state.props.VOL * .8 + ending.bonus);
  addLog("结局", `<div class="ending"><strong>${ending.tier} · ${ending.name}</strong><p>${ending.description}</p><p>总评：${summary}</p></div>`);
  document.querySelector("#nextAge").disabled = true;
  document.querySelector("#autoRun").disabled = true;
  renderGame("结算完成");
}

function chooseEvent(pool) {
  const candidates = pool.map(([id, weight]) => [getEvent(id), weight])
    .filter(([event]) => (!event.include || check(event.include)) && (!event.exclude || !check(event.exclude)));
  if (!candidates.length) return null;
  return weightRandom(candidates);
}

function updateScore(phase, final = false) {
  const p = state.props;
  const phaseBase = { "学前期": 300, "小学期": 370, "初中期": 450, "高一期": 500, "高二期": 535, "高三期": 565, "出分填报期": 590, "高考结算": 590 }[phase] || 420;
  const score = clamp(Math.round(phaseBase + p.INT * 13 + p.STR * 7 + p.MNY * 5 + p.SPR * 8 - p.RSK * 1.8 + p.SCOREMOD), 250, 750);
  p.SCR = score;
  p.HSCR = final || p.AGE >= 18 ? score : Math.max(p.HSCR, score);
}

function applyEffect(effect = "") {
  effect.split(",").map(item => item.trim()).filter(Boolean).forEach(item => {
    const [, prop, sign, raw] = item.match(/^([A-Z]+)([+-])(\d+)$/) || [];
    if (!prop) return;
    const value = Number(raw) * (sign === "-" ? -1 : 1);
    const key = prop === "HSCR" ? "SCOREMOD" : prop;
    state.props[key] = (state.props[key] || 0) + value;
    if (["INT", "STR", "MNY", "SPR"].includes(prop)) state.props[prop] = clamp(state.props[prop], 0, 15);
    if (prop === "VOL") state.props.VOL = clamp(state.props.VOL, 0, 100);
    if (prop === "RSK") state.props.RSK = clamp(state.props.RSK, 0, 100);
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

function renderGame(phase) {
  phaseLabel.textContent = `${state.props.AGE} 岁 · ${phase}`;
  stats.innerHTML = ["INT", "STR", "MNY", "SPR", "VOL", "RSK"].map(prop => `
    <div class="stat"><span>${labels[prop]}</span><strong>${state.props[prop] || 0}</strong></div>
  `).join("");
  scoreText.textContent = state.props.HSCR || state.props.SCR || 0;
  scoreBar.style.width = `${clamp((state.props.HSCR || state.props.SCR || 0) / 750 * 100, 0, 100)}%`;
}

function addLog(title, html) {
  const li = document.createElement("li");
  li.innerHTML = `<strong>${title}</strong><p>${html}</p>`;
  log.prepend(li);
}

function parsePool(value) {
  return value.split(",").map(item => {
    const [id, weight = 1] = item.split("*");
    return [Number(id), Number(weight)];
  });
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
  const talent = getTalent(id);
  if (selectedTalentIds.includes(id)) {
    selectedTalentIds = selectedTalentIds.filter(item => item !== id);
  } else if (selectedTalentIds.length < 3 && !selectedTalentIds.some(item => talent.exclusive?.includes(item) || getTalent(item).exclusive?.includes(id))) {
    selectedTalentIds.push(id);
  }
  renderTalentList();
});

allocationList.addEventListener("input", event => {
  const prop = event.target.dataset.prop;
  if (!prop) return;
  allocation[prop] = Number(event.target.value);
  renderAllocation();
});

document.querySelector("#rerollTalents").addEventListener("click", rerollTalents);
document.querySelector("#startGame").addEventListener("click", start);
document.querySelector("#nextAge").addEventListener("click", nextAge);
document.querySelector("#autoRun").addEventListener("click", () => {
  while (!state.finished) nextAge();
});
document.querySelector("#restart").addEventListener("click", () => location.reload());

rerollTalents();
renderAllocation();
