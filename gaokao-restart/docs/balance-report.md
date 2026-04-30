# 平衡报告

测试日期：2026-04-30

## 1. 本轮目标

64 回合版本首次模拟时，1000 局中 99% 命中“清北稳线”，说明原 16 行年龄表公式不适合每年 4 回合后的事件累积。

本轮目标按 `06-qa-balancing.md`：

| 档位 | 目标 |
| --- | --- |
| SSS/SS | 2%-8% |
| S/X | 8%-18% |
| A/B | 45%-65% |
| C/D | 18%-35% |

## 2. 调整项

- 阶段基准下调，并按 64 回合重新校准。
- `INT/STR/MNY/SPR` 上限从 15 收紧到 10。
- `VOL` 上限设为 85，`RSK` 上限设为 90。
- `SCOREMOD` 限制在 -60 到 70。
- 分数公式降低四维权重，并加入少量 `VOL` 加成。
- 事件效果按长期成长折算：
  - `INT/STR/MNY`：0.5
  - `SPR`：0.4
  - `VOL`：0.5
  - `RSK`：0.35
  - `SCOREMOD`：0.65
- 隐藏 `X` 结局有效优先级折减 12，避免大量覆盖普通 A/B 录取。
- `31017 竞赛集训` 权重从 40 调整为 20，降低“竞赛保送生”过高出现率。
- 18 岁末段事件池按回合锁定：第 2 回合只放高考相关事件，第 4 回合只放出分相关事件。

## 3. 验证命令

```bash
node gaokao-restart/tools/validate-content.mjs
node gaokao-restart/tools/simulate.mjs 1000
```

测试与构建：

```bash
node ..\node_modules\vitest\vitest.mjs run
node ..\node_modules\vite\bin\vite.js build
```

## 4. 1000 局结果

```txt
Runs: 1000
Errors: 0
Average HSCR: 579.9
Average INT/STR/MNY/SPR: 10.0/9.9/3.9/4.6
Average VOL: 45.1
Average RSK: 40.9
Average SCOREMOD: 11.9
Average final score: 577.9
985 reachable: 92 (9.2%)
211 reachable: 575 (57.5%)
985 admitted: 53 (5.3%)
211 admitted: 378 (37.8%)
Slide: 0 (0.0%)
Runs with legendary candidate: 185 (18.5%)
Candidate rarity distribution:
- common: 6947 (69.5%)
- rare: 2022 (20.2%)
- epic: 827 (8.3%)
- legendary: 204 (2.0%)
Selected rarity distribution:
- common: 549 (18.3%)
- rare: 1440 (48.0%)
- epic: 807 (26.9%)
- legendary: 204 (6.8%)
Tier distribution:
- A: 544 (54.4%)
- B: 32 (3.2%)
- C: 186 (18.6%)
- D: 23 (2.3%)
- S: 160 (16.0%)
- SS: 6 (0.6%)
- SSS: 35 (3.5%)
- X: 14 (1.4%)
```

折算到目标分组：

| 分组 | 当前 | 目标 | 状态 |
| --- | ---: | ---: | --- |
| SSS/SS | 4.1% | 2%-8% | 达标 |
| S/X | 17.4% | 8%-18% | 达标 |
| A/B | 57.6% | 45%-65% | 达标 |
| C/D | 20.9% | 18%-35% | 达标 |

## 5. 仍需观察

- 天赋稀有度改造后，模拟器不再从全库随机选天赋，而是先按 70% / 20% / 8% / 2% 抽候选，再用效果预算和稀有度模拟朴素玩家选 3 个。
- 录取系统首版接入后，模拟器会输出最终高考分、985/211 可达率、实录率和滑档率。当前院校线是广西 2024 首选物理本科普通批样本库，后续扩充后分布会变化。
- `英语领读生` 和 `中考定位成功` 仍是 A 档内部高频结局，后续可补更多 A/B 结局或降低单一事件链优先级。
- `B` 档占比仍偏低，普通本科、保底、调剂类路线还可以扩展。
