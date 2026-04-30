# 任务状态与后续 agent 交接

最后更新：2026-04-30

本文件用于记录《高考重开模拟器》独立项目当前完成情况。后续 agent 开工前先读本文件，再读对应任务文档。

## 1. 当前项目快照

- 独立目录已存在：`gaokao-restart/`。
- 已有目录：`docs/`、`tools/`、`src/app/`、`src/engine/`、`src/ui/`、`src/content/zh-cn/`、`tests/`。
- Vite 工程文件已创建：`package.json`、`index.html`、`vite.config.ts`、`tsconfig.json`。
- 标准版核心引擎已实现，可无 UI 跑完 64 回合。
- 标准版基础 UI 已实现：首页、天赋选择、属性分配、轨迹推进、总结页。
- 自动模拟入口已创建：`tools/simulate.mjs`。
- 内容包已生成并通过校验：
  - 天赋：160
  - 事件：280
  - 年龄回合：64
  - 结局：80
  - 成就：40
  - 预设角色：20
  - 录取线样本：31
- 天赋稀有度与分类改造已完成：
  - 普通：64
  - 稀有：56
  - 史诗：32
  - 传说：8
  - 抽取基础概率：70% / 20% / 8% / 2%
  - 满成就概率：60% / 25% / 11% / 4%
- 18 岁末段事件池已按回合锁定：
  - 第 1 回合：考前调整
  - 第 2 回合：高考相关事件
  - 第 3 回合：志愿填报相关事件
  - 第 4 回合：出分录取相关事件

已验证命令：

```bash
node gaokao-restart/tools/validate-content.mjs
node gaokao-restart/tools/simulate.mjs 1000
```

输出：

```txt
Content OK: 160 talents, 280 events, 64 ages, 80 endings, 40 achievements, 20 characters, 31 admission lines.
Runs: 1000
Errors: 0
Average HSCR: 579.9
Average final score: 577.9
985 reachable: 92 (9.2%)
211 reachable: 575 (57.5%)
985 admitted: 53 (5.3%)
211 admitted: 378 (37.8%)
```

额外验证：

- 使用根目录已安装的 Vite/Vitest 二进制执行测试：3 个测试文件、12 个用例通过。
- 使用根目录已安装的 Vite 二进制执行生产构建：通过。
- 直接执行 `pnpm --dir gaokao-restart test/build` 需要先在 `gaokao-restart/` 安装依赖。

当前平衡状态：

- 已完成首轮 64 回合平衡，详见 `docs/balance-report.md`。
- 1000 局模拟：SSS/SS 4.1%，S/X 17.4%，A/B 57.6%，C/D 20.9%，均进入目标区间。
- 已完成 5000 局复测并生成优化计划：`docs/11-simulation-optimization-plan.md`。
- 后续重点：降低 Top 结局集中度、扩充录取投档线、提高 B/D 档和滑档/降档路线存在感。

## 2. 状态图例

| 状态 | 含义 |
| --- | --- |
| 已完成 | 文件已落地，并通过当前可运行验证。 |
| 部分完成 | 有文档或内容基础，但核心代码/验收还没完成。 |
| 未开始 | 只有任务文档，还没有实现文件。 |
| 暂缓 | 明确不进入标准版首轮开发。 |

## 3. 总任务看板

| 任务 | 文档 | 当前状态 | 说明 |
| --- | --- | --- | --- |
| 00 独立项目总计划 | `00-development-plan.md` | 已完成 | 标准版范围、目录、公式、里程碑已确定。 |
| 01 独立项目脚手架 | `01-project-scaffold.md` | 已完成 | Vite、TS、入口页和基础样式已创建，构建验证通过。 |
| 02 核心玩法引擎 | `02-core-engine.md` | 已完成 | `LifeEngine`、条件解析、64 回合推进、结局结算和测试已完成。 |
| 03 内容数据与校验 | `03-content-data.md` | 已完成 | 内容 JSON、生成脚本、校验脚本、扩充汇总已落地。 |
| 04 标准版 UI 与交互 | `04-ui-flow.md` | 部分完成 | 基础可玩 UI 已完成；仍需浏览器手动验收和移动端细调。 |
| 05 元进度、结局与存档 | `05-meta-progression.md` | 部分完成 | 存档、解锁、继承天赋基础逻辑已实现；仍需手动验证损坏存档和总结页体验。 |
| 06 QA、自动模拟与平衡 | `06-qa-balancing.md` | 部分完成 | 内容校验、单测、模拟器和首轮平衡报告已完成；仍需浏览器手动验证和更细结局分布。 |
| 07 高三 365 天冲刺版二期 | `07-sprint-phase2.md` | 暂缓 | 等标准版完整可玩、模拟稳定后再启动。 |
| 08 天赋稀有度与分类改造 | `09-talent-rarity-rework-plan.md` | 已完成 | 数据、校验、抽取逻辑、UI 展示、概率测试和模拟复测已完成。 |
| 09 录取结局与院校投档线改造 | `10-admission-ending-rework-plan.md` | 部分完成 | 首版已实现高考分数、985/211 判断和录取院校输出；院校线仍是样本库，需继续扩充。 |
| 10 5000 局模拟优化 | `11-simulation-optimization-plan.md` | 未开始 | 已有优化计划；优先做模拟指标增强、录取线扩充、结局/院校集中度调平。 |

## 4. 推荐开发顺序

第一波：

1. 任务 10A：增强模拟器指标，输出结局覆盖、集中度、分数段和属性触顶率。
2. 任务 10B：扩充录取数据到更完整的 985/211 与普通本科院校池。

第二波：

3. 任务 10C：调平录取算法，提高低志愿高风险局的降档/滑档存在感。
4. 任务 10D：降低高频结局覆盖，补强 B/D 档路线。

第三波：

5. 任务 04：浏览器手动验收和移动端 UI 修正。
6. 任务 05：补损坏存档、成就提示、继承天赋体验细节。

第四波：

7. 任务 07：标准版稳定后再设计冲刺版。

## 5. 分任务交接

### 任务 01：独立项目脚手架

状态：已完成

写入范围：

- `gaokao-restart/package.json`
- `gaokao-restart/index.html`
- `gaokao-restart/vite.config.ts`
- `gaokao-restart/tsconfig.json`
- `gaokao-restart/src/main.ts`
- `gaokao-restart/src/app/**`
- `gaokao-restart/src/ui/**`
- `gaokao-restart/src/ui/styles/**`

已完成：

- 创建 Vite + TypeScript 项目基础文件。
- 增加 scripts：`dev`、`build`、`preview`、`test`、`validate:content`、`simulate`。
- 创建最小首页：标题、重开次数占位、开始重开按钮。
- 建立基础 CSS，保证桌面和移动端不重叠。
- 保留已有 `src/content/zh-cn/**` 和 `tools/**`，不要覆盖内容包。

待做：

- 在 `gaokao-restart/` 独立安装依赖后，确认 `pnpm test` 和 `pnpm build` 可直接运行。

验收：

```bash
cd gaokao-restart
pnpm install
pnpm dev
pnpm build
pnpm validate:content
```

### 任务 02：核心玩法引擎

状态：已完成

写入范围：

- `gaokao-restart/src/engine/**`
- `gaokao-restart/src/app/types.ts`
- `gaokao-restart/tests/**`

已完成：

- 定义 `Talent`、`GameEvent`、`AgeRound`、`Ending`、`GameState`、`StepResult` 等类型。
- 实现条件表达式解析，不使用 `eval`。
- 实现固定种子随机、属性增减、clamp、分数公式。
- 实现天赋互斥、天赋触发、事件筛选、加权随机、分支跳转。
- 实现 64 回合推进：3-18 岁，每年 4 回合。
- 年龄天赋只在对应年龄第 1 回合触发。
- 18 岁第 4 回合判定最终结局。
- `LifeEngine` 提供 `start()`、`next()`、`runToEnd()`。

待做：

- 平衡调参时可能需要回看分数公式和事件效果缩放。

验收：

```bash
cd gaokao-restart
pnpm test
```

最低测试覆盖：

- 条件解析。
- 天赋互斥。
- 事件筛选。
- 分支跳转。
- 分数公式。
- 结局优先级。
- 固定随机种子结果可复现。
- 无 UI 跑完 64 回合并产出结局。

### 任务 03：内容数据与校验

状态：已完成

已完成：

- `src/content/zh-cn/talents.json`
- `src/content/zh-cn/events.json`
- `src/content/zh-cn/ages.json`
- `src/content/zh-cn/endings.json`
- `src/content/zh-cn/achievements.json`
- `src/content/zh-cn/characters.json`
- `tools/generate-expanded-content.mjs`
- `tools/validate-content.mjs`
- `docs/content-expansion-summary.md`

当前内容规模：

- 天赋 160 个。
- 事件 280 个。
- 年龄回合 64 行。
- 结局 80 个。
- 成就 40 个。
- 预设角色 20 个。

后续注意：

- 脚手架完成后，把 `validate:content` 挂到 `package.json`。
- 如果后续修改内容，先运行生成脚本，再运行校验脚本。
- 修改 `ages.json` 时必须保持 `step` 覆盖 1-64，每个年龄 4 回合。

验收：

```bash
node gaokao-restart/tools/validate-content.mjs
```

### 任务 04：标准版 UI 与交互

状态：部分完成

写入范围：

- `gaokao-restart/src/ui/**`
- `gaokao-restart/src/main.ts`
- `gaokao-restart/src/app/**`
- `gaokao-restart/src/ui/styles/**`

已完成：

- 首页：标题、累计重开次数、开始按钮。
- 天赋页：抽 10 个候选天赋，选择 3 个，处理互斥提示。
- 属性页：20 点分配到 `INT/STR/MNY/SPR`，剩余点数为 0 才能开始。
- 轨迹页：显示年龄、阶段、回合名、属性、`SCR/HSCR`、事件日志。
- 轨迹页操作：下一回合、自动跑完。
- 总结页：结局、分数、志愿情报、风险、总评、本局天赋、继承天赋入口、再来一局。
- 桌面和移动端布局均不能出现文字溢出或元素重叠。

待做：

- 启动 dev server 后进行完整浏览器手动验收。
- 检查移动端宽度下的日志、天赋卡片和总结页按钮。

验收：

```bash
cd gaokao-restart
pnpm build
```

手动验收：

- 玩家能从首页完整跑到总结页。
- 轨迹页显示类似 `17 岁 · 第 3 回合 · 百日冲刺`。
- 结局出现后禁用“下一回合”。

### 任务 05：元进度、结局与存档

状态：部分完成

已完成：

- `achievements.json` 已有 40 个成就。
- `characters.json` 已有 20 个预设角色。
- `storage.ts` 已实现 `gaokao-restart.save.v1`。
- 总结页已接入结局解锁、已见事件、已见天赋、继承天赋。
- 继承天赋改为下局候选池一次性带入，进入候选页后即从存档消费，不再永久携带。
- 总结页保留并展示本局事件日志。

待做：

- 存档损坏时回退到空存档，不能白屏。
- 手动验证不可继承天赋不会出现在继承选择中。
- 增加成就提示或成就列表展示。

验收：

- 刷新页面后重开次数和解锁结局仍存在。
- 选择继承天赋后，下局候选天赋能带上该天赋，使用后不会继续永久保留。
- 不可继承天赋不能被选择。

### 任务 06：QA、自动模拟与平衡

状态：部分完成

已完成：

- 内容校验脚本可运行并通过。
- `tests/**` 已创建。
- `tools/simulate.mjs` 已创建。
- 核心引擎测试覆盖条件解析、天赋互斥、64 回合跑完和结局产出。
- `docs/balance-report.md` 已创建。
- 自动模拟 1000 局已输出结局分布、平均 `HSCR`、平均 `VOL`、平均 `RSK`、异常局数量。

待做：

- 补齐手动验证记录。
- 继续观察 A 档内部“中考定位成功”占比偏高、B 档结局偏少的问题。

目标分布：

| 档位 | 目标 |
| --- | --- |
| SSS/SS | 2%-8% |
| S/X | 8%-18% |
| A/B | 45%-65% |
| C/D | 18%-35% |

验收：

```bash
cd gaokao-restart
pnpm test
pnpm validate:content
pnpm simulate
pnpm build
```

### 任务 07：高三 365 天冲刺版二期

状态：暂缓

不要在标准版首轮开发中实现：

- `src/content/zh-cn/sprint/**`
- `src/engine/sprint/**`
- 高三 365 天行动系统。

启动条件：

- 标准版已完整可玩。
- 自动模拟工具已稳定。
- UI 可以支持回合行动选择。
- 内容生产方式明确。

### 任务 08：天赋稀有度与分类改造

状态：已完成

计划文档：

- `docs/09-talent-rarity-rework-plan.md`

目标：

- 白色普通、蓝色稀有、紫色史诗、橙色传说。
- 抽到概率按普通、稀有、史诗、传说依次降低。
- 天赋效果强度按普通、稀有、史诗、传说依次增强。
- 天赋新增稳定分类字段。

已完成：

- `tools/generate-expanded-content.mjs` 生成 `rarity/category/effectBudget/polarity`。
- `tools/validate-content.mjs` 校验稀有度、分类、预算递增和数量结构。
- `src/engine/talents.ts` 按稀有度概率抽候选天赋，并接入成就进度修正。
- `src/ui/App.ts` 和样式已显示中文稀有度、分类和颜色。
- `tests/engine.test.ts` 已覆盖概率插值、抽取分布和继承天赋置顶。
- `tools/simulate.mjs` 已输出候选/选择稀有度分布，并用效果预算模拟朴素玩家选择。

验收：

- 160 个天赋都有 `rarity/category`。
- 稀有度数量为普通 64、稀有 56、史诗 32、传说 8。
- 空成就存档候选位抽取比例接近 70% / 20% / 8% / 2%。
- 满成就存档候选位抽取概率为 60% / 25% / 11% / 4%。
- 1000 局结局分布仍在平衡目标区间内。

### 任务 09：录取结局与院校投档线改造

状态：部分完成

计划文档：

- `docs/10-admission-ending-rework-plan.md`

目标：

- 总结页明确输出本局高考分数。
- 根据真实投档线判断是否能被 985、211 录取。
- 如果被录取，输出录取院校、院校层级、投档线、超线分和数据口径。
- 保留当前 80 个叙事结局，新增录取结果层。

已完成：

- 新增 `src/content/zh-cn/admissions/**` 数据结构。
- 整理默认省份/科类/年份的真实投档线样本数据，当前使用广西 2024 首选物理本科普通批。
- 新增 `src/engine/admission.ts`，实现高考分数和录取结果计算。
- 扩展 `FinalResult`，把 `ending` 和 `admission` 分离。
- 修改总结页 UI，展示分数、录取院校和 985/211 可达判断。
- 扩展内容校验、单元测试和模拟器输出。

待做：

- 将样本院校线扩充到更完整的 985/211 院校池。
- 为中外合作、专项计划、民族班等特殊专业组增加 `lineType` 后再细分展示。
- 二期再迁移现有部分结局条件到 `ADM?[985] / ADM?[211] / ADMSCORE>=650`。

验收：

- 每局最终都有 `finalScore`。
- 每局最终都有 `AdmissionResult`。
- 可以判断 `canReach985/canReach211`。
- 被录取时显示具体院校；未录取时显示滑档、专科或复读等明确结果。
- 1000 局模拟输出 985/211 可达率、实录率和滑档率。

### 任务 10：5000 局模拟优化

状态：未开始

计划文档：

- `docs/11-simulation-optimization-plan.md`

评测结论：

- 5000 局模拟 0 异常，大档位分布仍在目标区间内。
- Top 5 结局占比 75.2%，重复感偏强。
- 80 个结局中只命中 50 个，覆盖不足。
- 录取 Top 2 院校占比 69.6%，院校池需要扩充。
- 滑档率 0.1%，志愿风险存在感不足。
- `INT/STR` 平均接近上限，后期成长差异偏小。

待做：

- 增强 `tools/simulate.mjs` 指标输出。
- 扩充默认 profile 的真实录取线，优先补 420-639 分段。
- 调整录取算法，减少确定性集中，提高低志愿高风险局的降档/滑档概率。
- 调整高频结局优先级和条件，补强 B/D 档路线。
- 二期支持 `ADM?[985]`、`ADM?[211]`、`ADMSCORE>=650` 等录取条件 token。

验收：

- 5000 局结局覆盖 >= 62/80。
- Top 1 结局 <= 16%，Top 3 <= 45%，Top 5 <= 60%。
- B 档 6%-10%，D 档 4%-8%。
- 滑档率 1.5%-4%。
- 录取 Top 1 院校 <= 25%，Top 2 <= 45%。
- 大档位分组仍满足 `06-qa-balancing.md` 目标。

## 6. 全局约束

- 不修改仓库根目录的主工程 `src/`。
- 不覆盖 `gaokao-standard/` 试玩 demo。
- 新代码写入 `gaokao-restart/`。
- 文档统一放在 `gaokao-restart/docs/`。
- 标准版先完成可玩闭环，再考虑冲刺版。
- 后续 agent 如果修改内容数据，必须同步运行 `validate-content.mjs`。

## 7. 可直接派发的 agent 任务

### Agent A：项目脚手架

目标：完成任务 01。

责任范围：`package.json`、`index.html`、`vite.config.ts`、`tsconfig.json`、`src/main.ts`、基础 `src/app/**` 和 `src/ui/styles/**`。

不要改：`src/content/zh-cn/**`、`tools/generate-expanded-content.mjs`。

完成后报告：

- 新增文件清单。
- `pnpm build` 是否通过。
- `pnpm validate:content` 是否通过。

### Agent B：核心引擎

目标：完成任务 02。

责任范围：`src/engine/**`、`src/app/types.ts`、核心测试。

不要改：UI 样式和内容 JSON，除非发现数据字段无法支撑引擎。

完成后报告：

- 引擎入口 API。
- 64 回合推进验证。
- 测试覆盖项和 `pnpm test` 结果。

### Agent C：标准版 UI

目标：完成任务 04。

责任范围：`src/ui/**`、`src/main.ts`、必要的 `src/app/**` 编排。

依赖：任务 01 和任务 02 的基础接口。

完成后报告：

- 页面流程截图或手动验证步骤。
- 桌面和移动端布局检查结果。
- `pnpm build` 结果。

### Agent D：元进度与总结页

目标：完成任务 05。

责任范围：`src/engine/storage.ts`、`src/engine/life.ts` 的结算钩子、`src/ui/screens/SummaryScreen.ts`。

依赖：任务 02 和任务 04。

完成后报告：

- localStorage key 和存档结构。
- 继承天赋规则。
- 刷新后存档恢复验证。

### Agent E：QA 与平衡

目标：完成任务 06。

责任范围：`tests/**`、`tools/simulate.mjs`、`docs/balance-report.md`。

依赖：任务 02 至少完成，任务 04 完成后补 UI 手动验证。

完成后报告：

- 1000 局模拟分布。
- 异常局数量。
- 建议调整的数值点。

### Agent F：5000 局模拟优化

目标：完成任务 10。

责任范围：`tools/simulate.mjs`、`src/content/zh-cn/admissions/**`、`src/engine/admission.ts`、`tools/generate-expanded-content.mjs`、相关测试与平衡文档。

依赖：任务 09 首版录取系统已完成。

执行顺序：

1. 先增强模拟器指标。
2. 再扩充真实投档线数据。
3. 然后调录取算法。
4. 最后调整结局条件和优先级。

完成后报告：

- 5000 局模拟完整输出。
- 结局覆盖、Top 集中度、B/D 档占比。
- 985/211 可达率、实录率、滑档率。
- 录取院校 Top 集中度。
