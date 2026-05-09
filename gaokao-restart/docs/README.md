# 高考重开模拟器独立项目文档

本目录是《高考重开模拟器》独立项目的统一文档入口。后续开发不再把标准版接入现有 Laya 主工程，而是在仓库根目录新建 `gaokao-restart/` 作为独立 Web 项目开发。

## 1. 参考资料

- `design/gaokao-restart-design.md`：完整高考主题策划，含标准版和冲刺版。
- `design/gaokao-mvp-content.md`：标准版 MVP 内容表。
- `gaokao-standard/`：已有试玩 demo，只作为玩法和数值验证参考。
- `src/modules/*`：原《人生重开模拟器》主工程代码，只参考系统思想，不直接接入。

## 2. 项目定位

首发版本只做《高考重开模拟器》标准版：玩家选择 3 个天赋，分配学力、精力、资源、心态，按 3 到 18 岁、每年 4 回合推进，最终根据分数潜力、志愿情报、风险和关键事件获得录取结局。

## 3. 文档清单

- `00-development-plan.md`：独立项目总计划。
- `01-project-scaffold.md`：项目脚手架与工程结构。
- `02-core-engine.md`：核心玩法引擎。
- `03-content-data.md`：内容数据与校验。
- `04-ui-flow.md`：标准版 UI 与交互。
- `05-meta-progression.md`：结局、成就、存档与继承。
- `06-qa-balancing.md`：测试、自动模拟和平衡。
- `07-sprint-phase2.md`：高三 365 天冲刺版二期预研。
- `08-task-status.md`：当前任务状态、完成情况和后续 agent 交接清单。
- `09-talent-rarity-rework-plan.md`：天赋稀有度、分类、概率和效果强度改造计划。
- `10-admission-ending-rework-plan.md`：高考分数、985/211 判断和真实投档线录取结局改造计划。
- `11-simulation-optimization-plan.md`：5000 局模拟后的结局覆盖、录取分布和数值优化计划。
- `admission-data-sources.md`：录取投档线与院校标签来源记录。
- `14-web-to-wxgame-sync-rule.md`：网页版本变更同步到微信小游戏的执行规则。

## 4. 子 agent 执行顺序

执行前先阅读 `08-task-status.md`，确认当前完成情况和写入范围。

第一波：

- 任务 01：创建 `gaokao-restart/` 独立项目脚手架。
- 任务 03：录入 MVP 内容数据和校验脚本。

第二波：

- 任务 02：实现核心引擎和规则。
- 任务 04：实现标准版 UI 流程。

第三波：

- 任务 05：补齐元进度。
- 任务 06：测试、模拟和平衡。
- 任务 08：天赋稀有度与分类改造已完成，后续只需随内容扩展维护。
- 任务 09：录取结局与院校投档线改造已落地首版，后续继续扩充院校投档线数据。
- 任务 10：执行 5000 局模拟优化计划，优先增强模拟指标、扩充录取线、降低结局和院校集中度。

第四波：

- 任务 07：标准版稳定后再启动冲刺版。

## 5. 统一约束

- 不修改 `src/` 主工程。
- 不覆盖 `gaokao-standard/` demo。
- 新代码写入 `gaokao-restart/`。
- 文档统一放在 `gaokao-restart/docs/`。
- 标准版先完成可玩闭环，再考虑冲刺版和美术扩展。
