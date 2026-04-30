# 录取结局与院校投档线改造计划

## 0. 首版实施状态

2026-04-30 已落地首版：

- 新增 `src/content/zh-cn/admissions/**`。
- 新增 `src/engine/admission.ts`。
- `FinalResult` 已包含 `admission`。
- 总结页已显示高考分数、录取院校、投档线、超线分和数据口径。
- `tools/validate-content.mjs` 已校验录取数据。
- `tools/simulate.mjs` 已输出 985/211 可达率、实录率和录取院校分布。

当前限制：

- 院校线是 31 条样本库，不是全量 985/211 数据库。
- 暂未迁移现有 80 个叙事结局条件到 `ADM?[985]` 等新条件。
- 暂未区分中外合作、专项计划、民族班等特殊专业组。

## 1. 改造目标

把当前“叙事结局”升级为“叙事结局 + 高考分数 + 真实口径录取结果”的双层结算：

- 总结页明确输出本局高考分数，而不是只显示 `HSCR/最高`。
- 根据分数、志愿信息 `VOL/HVOL`、风险 `RSK` 和院校投档线判断是否能被 985、211 录取。
- 若能录取，结局输出具体录取院校、院校层级、投档线、超线分和数据口径。
- 保留当前 80 个叙事结局，用来描述人生路线；新增录取结果层，用来描述“最终被哪所学校录取”。
- 每个进入游戏院校池的院校都必须有来源明确的分数线，不做无来源的“看起来真实”的占位线。

## 2. 关键口径

高考投档线没有全国统一值，必须绑定：

- 年份。
- 生源省份。
- 科类或选科类型。
- 批次。
- 院校或院校专业组。

因此首版不建议做“全国通用真实线”。建议首版采用一个默认录取档案：

```txt
year: 2024
sourceProvince: 广西
scoreScale: 750
subjectTrack: 首选物理
batch: 本科普通批
```

原因：

- 当前游戏分数公式是 250-750，适合 750 分省份。
- 广西 2024 年本科普通批投档最低分表公开且包含大量 985/211 院校，适合做首版数据底座。
- 上海等省市存在 660 分制或高分段投档信息不完整公开的问题，不适合作为首版默认口径。

后续可以扩展为多省多科类切换，例如：

- 广西 2024 首选物理。
- 广西 2024 首选历史。
- 广东 2024 物理类。
- 湖南 2024 物理类。
- 四川 2024 理科。

## 3. 数据来源原则

优先级：

1. 省级教育考试院、招生考试院发布的投档最低分。
2. 教育部/阳光高考平台转载的省级考试院数据。
3. 教育部公布的 985、211、双一流名单用于院校标签。
4. 不使用商业志愿填报站点作为分数线主来源。

已确认可作为数据来源的官方入口示例：

- 教育部 985 工程学校名单：`https://www.moe.gov.cn/srcsite/A22/s7065/200612/t20061206_128833.html`
- 教育部 211 工程学校名单：`https://www.moe.gov.cn/srcsite/A22/s7065/200512/t20051223_82762.html`
- 教育部第二轮双一流名单：`https://www.moe.gov.cn/srcsite/A22/s7065/202202/t20220211_598710.html`
- 广西招生考试院 2024 本科普通批投档最低分数线（首选物理）：`https://www.gxeea.cn/view/content_624_30533.htm`
- 阳光高考转载上海 2024 本科普通批投档线示例：`https://gaokao.chsi.com.cn/gkxx/zc/ss/202407/20240719/2293304464.html`

数据文件中必须保存来源字段：

```json
{
  "sourceName": "广西招生考试院",
  "sourceUrl": "https://www.gxeea.cn/...",
  "sourcePublishedAt": "2024-07-xx",
  "collectedAt": "2026-04-30"
}
```

## 4. 新数据结构

建议新增目录：

```txt
gaokao-restart/src/content/zh-cn/admissions/
  profiles.json
  universities.json
  admission-lines.json
```

### 4.1 `profiles.json`

```json
[
  {
    "id": "gx-2024-physics",
    "name": "广西 2024 首选物理",
    "year": 2024,
    "sourceProvince": "广西",
    "subjectTrack": "首选物理",
    "scoreScale": 750,
    "batch": "本科普通批",
    "default": true
  }
]
```

### 4.2 `universities.json`

```json
[
  {
    "code": "10001",
    "name": "北京大学",
    "province": "北京",
    "city": "北京",
    "tags": ["985", "211", "doubleFirstClass"],
    "prestigeTier": "top"
  }
]
```

### 4.3 `admission-lines.json`

```json
[
  {
    "profileId": "gx-2024-physics",
    "universityCode": "10486",
    "universityName": "武汉大学",
    "groupCode": "112",
    "groupName": "武汉大学 112 专业组",
    "batch": "本科普通批",
    "minScore": 638,
    "minRank": null,
    "subjectRequirement": "首选物理",
    "sourceName": "广西招生考试院",
    "sourceUrl": "https://www.gxeea.cn/...",
    "sourcePublishedAt": "2024-07-xx"
  }
]
```

首版院校池建议：

- 全量 39 所 985。
- 全量 211 中能在默认省份投档表中匹配到的院校。
- 适量双一流非 211 院校。
- 适量普通一本、普通本科、民办本科、专科兜底院校。

原则：进入池子的每条院校/专业组线都必须真实可溯源；不强求首版覆盖全国所有普通院校。

## 5. 高考分数模型

当前引擎已有：

- `SCR`：当前回合分数潜力。
- `HSCR`：历史最高分数潜力。
- `SCOREMOD`：直接影响分数的修正。

建议新增最终结算字段，不直接替代 `HSCR`：

```ts
interface ExamScoreResult {
  finalScore: number;
  potentialScore: number;
  variance: number;
  explanation: string;
}
```

首版公式建议：

```ts
potentialScore = props.SCR
stabilityBonus = clamp(props.SPR * 0.8 - props.RSK * 0.12, -10, 10)
varianceRange = clamp(18 + props.RSK * 0.22 - props.SPR * 1.1, 6, 35)
variance = seededRandomInt(-varianceRange, varianceRange)
finalScore = clamp(round(potentialScore + stabilityBonus + variance), 250, 750)
```

说明：

- `SCR` 代表临考实力，最终分数围绕它波动。
- `SPR` 提升稳定性，`RSK` 放大波动和翻车概率。
- 高考分数用于院校录取判断。
- 原有叙事结局第一阶段可继续使用 `HSCR`，等录取系统稳定后再逐步迁移为 `finalScore` 或新增条件 token。

## 6. 录取判断算法

新增模块：

```txt
gaokao-restart/src/engine/admission.ts
```

输入：

- `finalScore`
- `props.VOL/HVOL`
- `props.RSK`
- 选中天赋、事件、叙事结局
- `profiles.json`
- `universities.json`
- `admission-lines.json`

输出：

```ts
interface AdmissionResult {
  profileId: string;
  finalScore: number;
  canReach985: boolean;
  canReach211: boolean;
  bestReachable985?: AdmissionLine;
  bestReachable211?: AdmissionLine;
  admitted: boolean;
  admittedLine?: AdmissionLine;
  admittedUniversity?: University;
  admissionTier: '985' | '211' | 'doubleFirstClass' | 'undergraduate' | 'college' | 'retake' | 'slide';
  margin?: number;
  strategyLabel: '稳妥' | '均衡' | '冲刺' | '失误';
  reason: string;
}
```

### 6.1 可达判断

```ts
reachableLines = lines.filter(line => line.minScore <= finalScore)
canReach985 = reachableLines.some(line => university.tags.includes('985'))
canReach211 = reachableLines.some(line => university.tags.includes('211'))
```

这两个字段回答“分数能不能被 985/211 录取”，不等同于最后一定录取。

### 6.2 实际录取判断

实际录取还要受志愿信息和风险影响：

```ts
strategyScore = HVOL - RSK * 0.35 + routeBonus
```

建议规则：

- `strategyScore >= 65`：优先选择分数利用率高、层级高、超线 0-18 分的院校。
- `strategyScore 35-64`：选择层级和安全性均衡、超线 10-35 分的院校。
- `strategyScore < 35`：可能保守浪费分数，也可能冲高滑档。
- `RSK >= 70` 且 `VOL < 25`：增加滑档概率。
- 若触发“志愿翻车/消息误读/专业盲盒”等事件或天赋，可强制降档或滑档。

录取优先级建议：

1. 特殊结局或特殊路线：竞赛保送、艺体、强基可走专门解释，但仍输出学校或路线。
2. 正常本科批：从 `reachableLines` 中按策略选择。
3. 无本科可录：输出专科、复读或滑档。

## 7. 与现有结局系统的关系

当前 `Ending` 继续表示叙事结局：

```ts
interface FinalResult {
  state: GameState;
  ending: Ending;
  admission: AdmissionResult;
}
```

首版不建议删除现有 80 个结局，而是让总结页同时显示：

```txt
高考分数：642
录取结果：中南大学 101 专业组
院校层级：985 / 211 / 双一流
投档线：614
超线：+28
数据口径：广西 2024 首选物理 本科普通批
人生结局：长跑型选手
```

二期可扩展条件表达式：

```txt
ADM?[985]
ADM?[211]
SCHOOL?[10486]
ADMSCORE>=650
MARGIN>=20
```

然后把部分现有结局从 `HSCR>=630` 改成更真实的 `ADM?[985]`。

## 8. UI 改造

文件范围：

- `src/ui/App.ts`
- `src/ui/styles/theme.css`

总结页新增一个录取结果区域：

- 大号显示 `finalScore`。
- 显示录取院校、院校标签、专业组、投档线、超线分。
- 显示“可达 985/211”与“实际录取”区别。
- 显示数据口径和“模拟结果非志愿填报建议”的轻量提示。
- 若滑档，显示“可达院校”和“实际结果”的差异，例如：分数可达 211，但志愿策略失误导致普通本科或滑档。

## 9. 内容和成就扩展

可新增成就：

- `第一次 985 录取`
- `第一次 211 录取`
- `压线进名校`
- `高分低报`
- `低分捡漏`
- `志愿滑档`
- `超线 1 分`

可新增或迁移结局：

- `985 压线录取`
- `211 稳妥录取`
- `双一流冷门专业`
- `普通本科好专业`
- `高分低报遗憾`
- `冲校滑档`

首轮建议先不大规模重写 80 个结局，先让录取层稳定运行。

## 10. 校验与测试

### 10.1 内容校验

更新 `tools/validate-content.mjs`：

- 每条 `admission-line` 必须引用存在的 `universityCode`。
- `minScore` 必须在 `250-750`。
- `profileId` 必须引用存在的 profile。
- 每个进入院校池的 985/211 院校至少有一条默认 profile 的投档线。
- 同一 profile 下同一 `universityCode + groupCode` 不重复。
- 每条投档线必须有 `sourceName/sourceUrl/sourcePublishedAt`。

### 10.2 单元测试

新增 `tests/admission.test.ts`：

- 分数低于所有本科线时，输出 `college/retake/slide`。
- 分数达到某 211 线时，`canReach211=true`。
- 分数达到某 985 线时，`canReach985=true`。
- 高 `VOL` 时优先选择分数利用率更高的院校。
- 低 `VOL` 高 `RSK` 时可能滑档或明显降档。
- 同一种 seed 下录取结果可复现。

### 10.3 模拟验证

更新 `tools/simulate.mjs` 输出：

- 平均高考分数。
- 985 可达率。
- 211 可达率。
- 985 实录率。
- 211 实录率。
- 滑档率。
- 高分低报率。
- 录取院校 Top 20。

## 11. 开发任务拆分

### Agent A：院校与投档线数据

负责：

- `src/content/zh-cn/admissions/profiles.json`
- `src/content/zh-cn/admissions/universities.json`
- `src/content/zh-cn/admissions/admission-lines.json`
- `tools/validate-content.mjs`
- `docs/admission-data-sources.md`

交付：

- 默认 profile 的真实投档线数据。
- 985/211/双一流标签。
- 来源清单和采集日期。
- 内容校验通过。

### Agent B：录取引擎

负责：

- `src/app/types.ts`
- `src/engine/admission.ts`
- `src/engine/life.ts`
- `src/engine/simulation.ts`
- `tests/admission.test.ts`

交付：

- `calculateExamScore()`。
- `resolveAdmission()`。
- `FinalResult.admission`。
- 单元测试通过。

### Agent C：结局条件迁移

负责：

- `src/engine/condition.ts`
- `src/engine/endings.ts`
- `tools/generate-expanded-content.mjs`
- `src/content/zh-cn/endings.json`

交付：

- 首版先保留旧结局。
- 二期支持 `ADM?[985] / ADM?[211] / ADMSCORE>=650`。
- 将“稳上 985”“211 王牌专业”等结局逐步迁移到录取结果条件。

### Agent D：总结页 UI

负责：

- `src/ui/App.ts`
- `src/ui/styles/theme.css`

交付：

- 总结页展示高考分数和录取院校。
- 区分“可达 985/211”和“实际录取”。
- 移动端不溢出，不遮挡叙事结局。

### Agent E：模拟和平衡

负责：

- `tools/simulate.mjs`
- `docs/balance-report.md`
- `docs/08-task-status.md`

交付：

- 1000 局录取分布。
- 985/211 可达率和实录率。
- 滑档率。
- 调整数值建议。

## 12. 推荐实施顺序

1. 新增 `admissions/` 数据结构和最小真实数据样本。
2. 扩展内容校验，确保投档线可溯源。
3. 实现 `calculateExamScore()`，让最终结果明确有高考分数。
4. 实现 `resolveAdmission()`，输出 `AdmissionResult`。
5. 总结页展示录取结果。
6. 模拟器输出录取分布。
7. 再迁移现有部分结局条件，避免一次改太多导致平衡失控。

## 13. 验收标准

数据：

- 默认 profile 至少包含全量 985 院校和多数 211 院校投档线。
- 每条投档线都有来源。
- 内容校验通过。

引擎：

- 每局最终都有 `finalScore`。
- 每局最终都有 `AdmissionResult`。
- 可以判断 `canReach985/canReach211`。
- 能输出具体录取院校或明确滑档/复读/专科结果。

UI：

- 总结页明确显示高考分数。
- 总结页明确显示录取院校、投档线、超线分和数据口径。
- 不再只用“稳上 985”这类抽象结局代替院校录取。

平衡：

- 1000 局模拟无异常。
- 985 实录率、211 实录率、滑档率可解释。
- 原有 SSS/SS、S/X、A/B、C/D 分布不出现严重失控。

## 14. 风险与取舍

- 投档线强依赖省份和科类。首版必须选定一个默认省份，不要伪造全国统一线。
- 院校专业组可能同校多线，不能简单地“一校一线”。首版可以用同校最低投档线表示“能进该校”，但 UI 需要显示专业组。
- 985/211 是历史建设项目，当前政策口径更常用双一流。游戏可以保留 985/211 标签，但数据文件也应支持 `doubleFirstClass`。
- 高考录取真实过程还包含位次、专业调剂、招生计划、单列专业、民族班、中外合作、专项计划等。首版先做普通本科批模拟，不做专业级志愿推荐。
