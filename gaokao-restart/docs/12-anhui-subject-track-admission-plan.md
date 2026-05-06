# 安徽 2025 文理分科与录取线改造计划

## 0. 结论先行

本次改造建议分两层做：

1. 游戏流程层：在高中阶段加入一次明确的“文理/选科分流”结算，把玩家本局固定到 `历史类` 或 `物理类`。
2. 录取数据层：舍弃现有 `src/content/zh-cn/admissions/**` 里的广西 2024 测试院校数据，改由 `data/anhui-2025-undergrad/anhui_2025_undergraduate_scores_slim.json` 生成安徽 2025 本科普通批录取数据，并按本局分科只使用对应科类投档线。
3. 天赋优先层：新增两个稀有天赋，分别强制本局分科为历史类或物理类。只要玩家选中对应天赋，分科事件结算必须使用固定值，不再进入属性权重和随机扰动判定。

首版不要把“分科”做成复杂交互系统。当前引擎是自动人生模拟，每回合随机事件推进，最小改造是让引擎在一个固定回合完成分科判定，然后后续事件和最终录取都读取这个状态。

## 1. 当前代码事实

核心流程在 `src/engine/life.ts`：

- `LifeEngine.start()` 初始化属性、天赋和状态。
- `LifeEngine.next()` 每回合读取 `ages.json`，抽一个事件，结算事件/分支/天赋。
- 18 岁第 4 回合直接执行：
  - `calculateExamScore()`
  - `resolveAdmission()`
  - `pickEnding()`

事件系统在 `src/engine/events.ts`：

- 事件通过 `include/exclude` 条件筛选。
- 每回合从 `AgeRound.eventPool` 加权随机抽 1 个事件。
- 事件效果目前只能修改数值属性。

录取系统在 `src/engine/admission.ts`：

- 从 `content.admissionProfiles` 取默认 profile。
- 从 `content.admissionLines` 过滤同 profile 的投档线。
- 用 `finalScore - line.minScore` 判断可达。
- 依赖 `University.tags` 判断 985/211/双一流。
- 依赖 `University.prestigeTier` 做录取偏好权重。

内容入口在 `src/content/zh-cn/index.ts`：

- 当前运行时只读 `src/content/zh-cn/admissions/profiles.json`
- `src/content/zh-cn/admissions/universities.json`
- `src/content/zh-cn/admissions/admission-lines.json`

安徽 slim 数据当前还没有接入运行时。

## 2. 安徽 slim 数据口径

源文件：

```txt
data/anhui-2025-undergrad/anhui_2025_undergraduate_scores_slim.json
```

顶层结构：

```ts
{
  metadata: {
    sourceName,
    sourceUrls: {
      "历史类": string,
      "物理类": string
    },
    publishedAt,
    rules
  },
  universities: [
    {
      "院校代码": string,
      "院校名称": string,
      "历史类": SubjectLine | null,
      "物理类": SubjectLine | null
    }
  ]
}
```

当前数据概况：

- 院校数：1177
- 有历史类线：976
- 有物理类线：1148
- 两类都有：947
- 存在少量 OCR/清洗异常，例如 `投档最低分` 缺失或小于 250，转换时必须过滤或报错。

注意：slim 文件当前按“院校代码 + 科类”保留一条代表性专业组线，规则优先保留投档人数最多的专业组。它不是严格意义上的“同校最低可进线”。首版应在 UI 和文档里称为“代表专业组投档线”或沿用“投档线模拟口径”，避免暗示真实志愿建议。

## 3. 目标数据结构

保留现有运行时三文件结构，但内容全部由安徽 slim 生成：

```txt
src/content/zh-cn/admissions/
  profiles.json
  universities.json
  admission-lines.json
```

`profiles.json` 改为两个 profile：

```json
[
  {
    "id": "ah-2025-history",
    "name": "安徽 2025 历史类",
    "year": 2025,
    "sourceProvince": "安徽",
    "subjectTrack": "历史类",
    "scoreScale": 750,
    "batch": "本科普通批"
  },
  {
    "id": "ah-2025-physics",
    "name": "安徽 2025 物理类",
    "year": 2025,
    "sourceProvince": "安徽",
    "subjectTrack": "物理类",
    "scoreScale": 750,
    "batch": "本科普通批"
  }
]
```

是否保留 `default`：

- 首版可以不给 profile 设置 `default`，录取时必须根据本局 `subjectTrack` 选择 profile。
- 如果为了兼容校验工具必须保留一个默认值，可临时把 `ah-2025-physics` 设为 `default: true`，但 `resolveAdmission()` 不应再依赖默认 profile。

`universities.json`：

- `code` 使用安徽 slim 的 `院校代码`，保持字符串，不要转数字。
- `name` 使用 `院校名称`。
- `tags` 由院校名称匹配 985/211/双一流名单生成。
- `prestigeTier` 由标签和院校性质生成。
- `province/city` 首版可以填 `"未知"`，不影响录取逻辑；后续再补全。

`admission-lines.json`：

每所院校最多生成两条线：

- `ah-2025-history`
- `ah-2025-physics`

字段映射：

```ts
profileId: "ah-2025-history" | "ah-2025-physics"
universityCode: 院校代码
universityName: 院校名称
groupCode: 从 "001专业组（不限）" 提取 "001"，提取失败则用原始专业组文本
groupName: `${院校名称} ${院校专业组}`
batch: "本科普通批"
minScore: 投档最低分
minRank: 最低分名次 ?? null
subjectRequirement: 院校专业组括号内要求，例如 "不限" / "化学" / "化学+生物学"
sourceName: metadata.sourceName
sourceUrl: metadata.sourceUrls[科类]
sourcePublishedAt: metadata.publishedAt
```

过滤规则：

- 丢弃 `投档最低分` 不是数字的行。
- 丢弃 `投档最低分 < 250` 或 `> 750` 的行。
- 保留历史类为空、物理类不为空的院校，但只生成物理类线；反之亦然。
- 转换后记录过滤数量，避免静默吃掉 OCR 异常。

## 4. 分科状态设计

新增类型：

```ts
export type SubjectTrack = 'history' | 'physics';
```

建议扩展：

```ts
interface GameState {
  subjectTrack: SubjectTrack | null;
}

interface AdmissionResult {
  subjectTrack: SubjectTrack;
  subjectTrackName: '历史类' | '物理类';
}
```

不要把分科塞进 `Props` 数值属性里。分科是离散状态，用 `GameState.subjectTrack` 更清楚，也避免影响分数公式。

如需让条件表达式支持分科事件，可以新增条件 token：

```txt
TRACK?[history]
TRACK?[physics]
```

实现方式：

- `createConditionContext()` 加入 `subjectTrack`，或把 `TRACK` 作为额外上下文。
- `condition.ts` 的 membership 判断支持 `TRACK`。

首版也可以先不用 `TRACK` 条件，直接在事件筛选时额外判断 `event.subjectTrack`。

## 4.1 分科锁定天赋

新增两个稀有天赋：

```json
[
  {
    "id": 21801,
    "name": "文科定盘",
    "grade": 1,
    "rarity": "rare",
    "rarityName": "稀有",
    "category": "route",
    "categoryName": "赛道机会",
    "description": "你很早就确认自己更适合历史类路线。高一分科时必定选择历史类。",
    "effect": { "VOL": 6, "SCOREMOD": 4 },
    "tags": ["分科", "历史类", "锁定"]
  },
  {
    "id": 21802,
    "name": "理科定盘",
    "grade": 1,
    "rarity": "rare",
    "rarityName": "稀有",
    "category": "route",
    "categoryName": "赛道机会",
    "description": "你很早就确认自己更适合物理类路线。高一分科时必定选择物理类。",
    "effect": { "INT": 1, "SCOREMOD": 4 },
    "tags": ["分科", "物理类", "锁定"]
  }
]
```

实现约束：

- 两个天赋互斥，`exclude` 彼此引用。
- 这两个天赋的分科效果不是普通 `effect`，而是由分科结算函数读取 `selectedTalentIds` 后强制返回。
- 如果保持现有“160 天赋”规模，需要替换两个现有稀有天赋；如果按“新增”处理，总量变为 162，`tools/validate-content.mjs` 的稀有天赋目标数要从 56 调整为 58。
- 建议新增专门的 helper，例如 `forcedSubjectTrackFromTalents(state)`，不要把强制逻辑散落在事件和录取模块里。

## 5. 分科事件方案

推荐放在高一阶段，也就是 15 岁。

当前年龄表中：

- 15 岁：`senior1`
- 16 岁：`senior2`
- 17 岁：`senior3`
- 18 岁：`final`

建议在 15 岁第 1 或第 2 回合加入“分科结算点”。

### 方案 A：引擎强制结算，事件只负责展示

新增 `resolveSubjectTrack(state, random)`：

```ts
forcedTrack = forcedSubjectTrackFromTalents(state)
if (forcedTrack) return forcedTrack

scorePhysics = INT * 1.2 + STR * 0.35 + MNY * 0.25 + scienceEventBonus - riskPenalty
scoreHistory = SPR * 1.0 + VOL * 0.08 + INT * 0.55 + humanitiesEventBonus
```

若存在分科锁定天赋，直接返回固定科类。否则若 `scorePhysics > scoreHistory` 则物理类，否则历史类。加入少量随机扰动，让人生模拟有变化。

然后生成一个专门分科事件：

- `32001`：你选择了偏理路线，后续以物理类参加录取。
- `32002`：你选择了偏文路线，后续以历史类参加录取。
- `32003`：你跟风分科，后续学习有些别扭。
- `32004`：老师和家里一起帮你复盘，分科选择比较稳。
- 若触发 `文科定盘` 或 `理科定盘`，分科事件文本应体现“早已确定路线”，并且事件结果必须和天赋锁定值一致。

优点：

- 每局一定有分科结果。
- 不受“每回合只抽一个随机事件”的限制。
- 录取系统永远不会缺少科类。

这是首版推荐方案。

### 方案 B：完全事件驱动

把分科事件加入 `ages.json` 的 15 岁事件池，并通过 `include/exclude` 控制互斥。

缺点：

- 当前每回合只抽 1 个事件，不能保证每局抽到分科事件。
- 如果强行让该回合只包含分科事件，会牺牲一个普通成长事件。

除非后续要做“玩家选择分科”的交互，否则不建议首版用这个方案。

## 6. 分科后的事件内容

分科后，高中事件可以按科类区分：

历史类事件示例：

- 政史地材料题训练开始见效，`VOL +8 / SCOREMOD +6`
- 背诵周让你心态波动，`SPR -1 / RSK +5`
- 作文素材库救了你一次，`SCOREMOD +8`
- 你发现历史类志愿选择更依赖城市和专业权衡，`VOL +10`

物理类事件示例：

- 数学和物理刷题形成手感，`INT +1 / SCOREMOD +8`
- 化学选考卡住，`RSK +6 / SCOREMOD -6`
- 实验题套路突然打通，`SCOREMOD +7`
- 你开始研究专业组限选科目，`VOL +12`

事件字段建议新增：

```ts
interface GameEvent {
  subjectTrack?: SubjectTrack;
}
```

筛选逻辑：

- `subjectTrack` 为空：所有玩家可触发。
- `subjectTrack === state.subjectTrack`：对应科类可触发。
- 玩家尚未分科时，忽略带 `subjectTrack` 的事件。

## 7. 录取引擎改造

`resolveAdmission()` 当前取默认 profile，需要改为按本局科类取 profile：

```ts
function getProfileForTrack(content, subjectTrack) {
  const profileId = subjectTrack === 'history'
    ? 'ah-2025-history'
    : 'ah-2025-physics';
  return content.admissionProfiles.find(item => item.id === profileId);
}
```

流程调整：

1. 若 `state.subjectTrack` 为空，抛出明确错误或兜底分科。
2. 根据 `state.subjectTrack` 选择 profile。
3. 只读取该 profile 的 `admissionLines`。
4. 正常计算 `reachable`。
5. `canReach985/canReach211` 继续使用 `University.tags`。
6. `picked` 只会来自对应科类。
7. `AdmissionResult.reason` 和 UI 文案显示“安徽 2025 历史类/物理类 本科普通批”。

重要：院校代码不能转数字。安徽 slim 存在 `"006"` 这类前导零代码，所有数据结构和比较都必须按字符串处理。

如后续要在结局条件里写 `SCHOOL?[006]`，当前 condition parser 会把 `006` 当数字解析，导致和 `"006"` 不相等。首版建议暂不写这类条件；二期再给条件表达式增加 quoted string：

```txt
SCHOOL?["006"]
```

## 8. 旧测试录取数据替换策略

明确舍弃：

```txt
src/content/zh-cn/admissions/profiles.json
src/content/zh-cn/admissions/universities.json
src/content/zh-cn/admissions/admission-lines.json
```

但不建议手工维护 1177 所院校数据。建议新增生成脚本：

```txt
tools/generate_anhui_2025_admissions.mjs
```

输入：

- `data/anhui-2025-undergrad/anhui_2025_undergraduate_scores_slim.json`
- 可选：`src/content/zh-cn/admissions/university-tags.seed.json`

输出：

- `src/content/zh-cn/admissions/profiles.json`
- `src/content/zh-cn/admissions/universities.json`
- `src/content/zh-cn/admissions/admission-lines.json`

`university-tags.seed.json` 用于按学校名补标签：

```json
{
  "北京大学": ["985", "211", "doubleFirstClass"],
  "清华大学": ["985", "211", "doubleFirstClass"],
  "安徽大学": ["211", "doubleFirstClass"],
  "合肥工业大学": ["211", "doubleFirstClass"],
  "中国科学技术大学": ["985", "211", "doubleFirstClass"]
}
```

`prestigeTier` 生成建议：

- 985：`top` 或 `strong`
- 211/双一流：`strong`
- 公办普通本科：`regional`
- 民办/独立学院/职业本科等：`private`

如果标签暂不完整，录取仍能跑，但 985/211 可达率和结局会失真。因此首版至少要补齐安徽 slim 中出现的 985、211、双一流院校名称。

## 9. UI 改造

总结页 `src/ui/App.ts` 当前已经有录取卡片，但文案还是旧广西口径。需要调整：

- 显示本局分科：`文科（历史类）` 或 `理科（物理类）`
- 显示数据口径：`安徽 2025 历史类 本科普通批`
- 显示专业组：例如 `002专业组（化学）`
- 如果某学校只有物理类线，历史类玩家永远不会录到该校。
- 删除“广西招生考试院”相关固定文案。

轨迹页可以在分科回合后显示一个状态标签：

```txt
当前科类：物理类
```

## 10. 校验与测试

更新 `tools/validate-content.mjs`：

- 支持两个安徽 profile，不再要求“必须正好一个 default profile”。
- 校验两个分科锁定稀有天赋存在且互斥。
- 校验每个 profile 都有投档线。
- 校验 `university.code` 是字符串，并保持前导零。
- 校验 `minScore` 在 250-750。
- 校验每条 line 的 `sourceUrl` 来自安徽 metadata 对应科类。
- 校验至少存在历史类和物理类投档线。
- 校验默认运行内容中没有旧 `gx-2024-physics` profile。

新增或改造测试：

1. `tests/admission.test.ts`
   - 历史类只从 `ah-2025-history` 录取。
   - 物理类只从 `ah-2025-physics` 录取。
   - 同一分数下，不会录到对应科类缺失的院校。
   - 985/211 可达判断仍然正确。
   - 低分 fallback 正常。

2. `tests/engine.test.ts`
   - 完整 64 回合后 `state.subjectTrack` 不为空。
   - 分科事件一定在 15 岁阶段前后出现。
   - 选中 `文科定盘` 时，分科结果必定为 `history`。
   - 选中 `理科定盘` 时，分科结果必定为 `physics`。
   - 最终 `admission.subjectTrack` 等于 `state.subjectTrack`。

3. `tests/condition.test.ts`
   - 若新增 `TRACK?[history]`，覆盖 true/false。

4. `tools/simulate.mjs`
   - 输出历史类/物理类比例。
   - 分别输出两类的录取率、985 可达率、211 可达率、滑档率。

## 11. 推荐实施顺序

### 阶段 1：数据生成与替换

1. 新增 `tools/generate_anhui_2025_admissions.mjs`。
2. 由 slim JSON 生成安徽 profiles、universities、admission-lines。
3. 删除旧广西测试数据内容。
4. 更新 `validate-content.mjs`，确保安徽数据通过。

验收：

- `node tools/generate_anhui_2025_admissions.mjs` 可重复生成。
- `node tools/validate-content.mjs` 通过。
- `src/content/zh-cn/admissions/**` 中不再出现 `gx-2024-physics`。

### 阶段 2：分科状态接入引擎

1. 在 `types.ts` 新增 `SubjectTrack` 和 `GameState.subjectTrack`。
2. 在 `LifeEngine.start()` 初始化 `subjectTrack: null`。
3. 新增 `文科定盘`、`理科定盘` 两个稀有互斥天赋。
4. 在 15 岁指定回合强制执行 `resolveSubjectTrack()`。
5. `resolveSubjectTrack()` 先检查分科锁定天赋；命中则直接返回固定科类，未命中再走属性权重和随机扰动。
6. 分科结果写入 `state.subjectTrack`，并生成/记录对应分科事件。

验收：

- 每局最终都有科类。
- 选中分科锁定天赋时，科类 100% 等于天赋指定值。
- 分科事件只出现一次。
- 固定 seed 下结果可复现。

### 阶段 3：录取按科类过滤

1. `resolveAdmission()` 不再读取默认 profile。
2. 根据 `state.subjectTrack` 选择 `ah-2025-history` 或 `ah-2025-physics`。
3. `AdmissionResult` 增加科类字段。
4. 更新录取原因文案。

验收：

- 历史类玩家不会使用物理类投档线。
- 物理类玩家不会使用历史类投档线。
- `canReach985/canReach211` 基于对应科类计算。

### 阶段 4：内容事件扩展

1. 增加 4-8 个分科相关事件。
2. 增加 8-16 个分科后高中事件。
3. 更新 `ages.json`，把科类事件放入高一、高二、高三池。
4. 必要时更新生成脚本，避免以后重新生成内容时覆盖手工事件。

验收：

- 分科事件能稳定出现。
- 分科后事件只在对应科类出现。
- 内容校验通过。

### 阶段 5：UI 和模拟

1. 总结页显示科类和安徽数据口径。
2. 轨迹页显示当前科类。
3. 模拟器按科类输出录取分布。
4. 根据模拟结果微调分科比例和分数公式。

验收：

- UI 不再显示广西口径。
- 1000 局模拟无异常。
- 历史类/物理类比例、录取率可解释。

## 12. 风险与取舍

- slim 数据是 OCR 和规则清洗产物，已发现少量异常分数。生成器必须过滤并报告。
- 安徽院校代码不是全国标准院校代码，不能直接复用旧 `universities.json` 的 code。
- 当前录取算法把“可达院校”和“实际录取”都建立在投档最低分上，没有位次、招生计划变化、专业调剂等真实志愿逻辑。UI 必须继续保留“模拟，不是填报建议”的提示。
- 如果分科完全随机，会削弱玩家属性的意义；如果完全按属性，会降低随机人生感。建议用属性权重 + 小随机扰动。
- 旧结局条件里已有 `ADM?[985]`、`ADM?[211]` 等逻辑。切到安徽数据后，结局分布会变化，需要跑模拟再调优。

## 13. 首版完成定义

首版完成后应满足：

- 游戏每局都有明确分科：历史类或物理类。
- 两个稀有锁定天赋可以强制分科，且互斥不可同时选择。
- 最终录取只使用本局科类对应的安徽 2025 本科普通批投档线。
- 旧广西测试院校数据不再参与运行时。
- 总结页显示：高考分数、科类、录取院校、专业组、投档线、超线分、安徽数据来源。
- 内容校验、单元测试、1000 局模拟均通过。
