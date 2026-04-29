# 平衡报告

测试日期：2026-04-29

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
Average HSCR: 576.4
Average INT/STR/MNY/SPR: 10.0/9.9/4.0/3.5
Average VOL: 65.2
Average RSK: 43.1
Average SCOREMOD: 4.7
Runs with legendary candidate: 210 (21.0%)
Candidate rarity distribution:
- common: 6916 (69.2%)
- rare: 2048 (20.5%)
- epic: 798 (8.0%)
- legendary: 238 (2.4%)
Selected rarity distribution:
- common: 540 (18.0%)
- rare: 1440 (48.0%)
- epic: 782 (26.1%)
- legendary: 238 (7.9%)
Tier distribution:
- A: 524 (52.4%)
- B: 28 (2.8%)
- C: 216 (21.6%)
- D: 9 (0.9%)
- S: 167 (16.7%)
- SS: 7 (0.7%)
- SSS: 37 (3.7%)
- X: 12 (1.2%)
```

折算到目标分组：

| 分组 | 当前 | 目标 | 状态 |
| --- | ---: | ---: | --- |
| SSS/SS | 4.4% | 2%-8% | 达标 |
| S/X | 17.9% | 8%-18% | 达标 |
| A/B | 55.2% | 45%-65% | 达标 |
| C/D | 22.5% | 18%-35% | 达标 |

## 5. 仍需观察

- 天赋稀有度改造后，模拟器不再从全库随机选天赋，而是先按 70% / 20% / 8% / 2% 抽候选，再用效果预算和稀有度模拟朴素玩家选 3 个。
- `中考定位成功` 占比 32.4%，A 档内部仍偏集中，后续可补更多 A/B 结局或降低该结局优先级。
- `B` 档占比仅 2.8%，普通本科、保底、调剂类路线还可以扩展。
