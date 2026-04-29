# 任务 07：高三 365 天冲刺版二期

## 1. 状态

冲刺版暂不进入首轮开发。只有标准版通过测试、模拟和平衡后才启动。

## 2. 定位

冲刺版是独立副模式，不是标准版换皮。它强调每回合行动选择、压力管理、模考反馈和临场兑现。

## 3. 与标准版差异

| 项 | 标准版 | 冲刺版 |
| --- | --- | --- |
| 时间 | 3 到 18 岁，每年 4 回合 | 高三 365 天 |
| 决策 | 开局决策为主 | 每回合行动选择 |
| 核心属性 | `HSCR/VOL/RSK` | `PRED/FINAL/CRS/SAN/STA` |
| 节奏 | 成长模拟 | 高压策略 |

## 4. 未来新增目录

```txt
gaokao-restart/src/content/zh-cn/sprint/
  talents.json
  actions.json
  events.json
  timeline.json
  endings.json
gaokao-restart/src/engine/sprint/
  actions.ts
  sprintLife.ts
  sprintRules.ts
```

## 5. 启动条件

- 标准版已完整可玩。
- 自动模拟工具已稳定。
- UI 可以支持回合行动选择。
- 内容生产方式明确。
