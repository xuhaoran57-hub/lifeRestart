# 任务 06：QA、自动模拟与平衡

## 1. 目标

保证独立项目稳定可玩，并通过自动模拟检查结局分布。

## 2. 写入范围

允许写入：

- `gaokao-restart/tests/**`
- `gaokao-restart/tools/simulate.mjs`
- `gaokao-restart/tools/validate-content.mjs`
- `gaokao-restart/docs/balance-report.md`

## 3. 必跑命令

```bash
cd gaokao-restart
pnpm test
pnpm validate:content
pnpm simulate
pnpm build
```

## 4. 自动模拟

`tools/simulate.mjs`：

- 加载本地 JSON 内容。
- 随机抽 10 个天赋。
- 选择 3 个合法天赋。
- 随机分配 20 点属性。
- 跑完 64 回合到结局。
- 重复 1000 局。
- 输出：
  - 结局分布。
  - 平均 `HSCR`。
  - 平均 `VOL`。
  - 平均 `RSK`。
  - 档位分布。
  - 异常局数量。

目标分布：

| 档位 | 目标 |
| --- | --- |
| SSS/SS | 2%-8% |
| S/X | 8%-18% |
| A/B | 45%-65% |
| C/D | 18%-35% |

## 5. 手动验证

至少手动跑：

- 高学力高资源局。
- 低资源县中黑马局。
- 高心态稳定局。
- 低志愿情报滑档局。
- 竞赛体质局。
- 艺体特长局。

## 6. 平衡报告

在 `docs/balance-report.md` 记录：

- 测试日期。
- 模拟次数。
- 各结局出现次数和比例。
- 已调整参数。
- 仍需观察的问题。

## 7. 验收

- 1000 局模拟无异常退出。
- 至少 6 个 MVP 结局能自然出现。
- 所有 8 个 MVP 结局可通过指定状态或固定种子触发。
- 桌面和移动端无明显 UI 重叠。
