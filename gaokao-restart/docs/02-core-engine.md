# 任务 02：核心玩法引擎

## 1. 目标

实现独立的高考标准版引擎，支持天赋、属性、年龄、事件、条件表达式、分数和结局。不接入原 `src/modules`。

## 2. 写入范围

允许写入：

- `gaokao-restart/src/engine/**`
- `gaokao-restart/src/app/types.ts`
- `gaokao-restart/tests/**`

## 3. 核心类型

建议定义：

```ts
type PropCode =
  | 'AGE' | 'INT' | 'STR' | 'MNY' | 'SPR'
  | 'VOL' | 'RSK' | 'SCR' | 'HSCR' | 'HVOL'
  | 'SCOREMOD' | 'SUM'

interface Talent {
  id: number
  name: string
  grade: number
  description: string
  effect?: Effect
  condition?: string
  exclude?: number[]
  inheritAllowed?: boolean
  tags?: string[]
}

interface GameEvent {
  id: number
  stage: string
  phase: PhaseCode
  text: string
  postText?: string
  effect?: Effect
  include?: string
  exclude?: string
  branch?: Branch[]
  noRandom?: boolean
  weight?: number
  flag?: string
  tags?: string[]
}

interface WeightedRef {
  id: number
  weight: number
}

interface AgeRound {
  step: number
  age: number
  round: 1 | 2 | 3 | 4
  roundName: string
  phase: PhaseCode
  phaseName: string
  eventPool: WeightedRef[]
  talentPool: number[]
}
```

## 4. 条件表达式

支持：

- `&`
- `|`
- 括号
- `> < >= <= = !=`
- `TLT?[21010]`
- `EVT?[31017]`
- `END?[41008]`

实现时不要使用 `eval`。可以参考原项目 `src/functions/condition.js` 的递归解析思路。

## 5. 引擎流程

`LifeEngine` 建议提供：

```ts
class LifeEngine {
  start(selectedTalentIds: number[], allocation: Allocation): GameState
  next(): StepResult
  runToEnd(): FinalResult
}
```

年龄表按 3 到 18 岁、每年 4 回合组织，共 64 行。`step` 从 1 到 64 递增，UI 可显示为 `年龄 + 第几回合 + roundName`。

每回合流程：

1. 读取下一个 `AgeRound`，设置 `AGE`、`round`、`roundName`。
2. 如果是该年龄第 1 回合，触发当前年龄天赋。
3. 根据当前回合事件池筛选可触发事件。
4. 加权随机一个事件。
5. 结算事件和分支。普通事件效果按 64 回合长期成长缩放，天赋效果保持完整。
6. 刷新 `SCR/HSCR/HVOL`。
7. 18 岁第 4 回合判定最终结局。

## 6. 分数与结局

沿用总计划公式。事件中如果配置了 `HSCR+20`，引擎内部应转为 `SCOREMOD+20`，避免直接覆盖历史最高分。

结局判定只在 18 岁第 4 回合执行：

1. 按 `priority` 降序。
2. 隐藏 `X` 结局使用 `priority - 12` 的有效优先级，避免过量覆盖普通录取结局。
3. 检查 `condition`。
4. 命中第一个结局。
5. 没命中则 fallback：
   - `HSCR >= 520`：普通本科，B。
   - 否则：仍需再战，C。

## 7. 测试

至少覆盖：

- 条件解析。
- 天赋互斥。
- 事件筛选。
- 分支跳转。
- 分数公式。
- 结局优先级。
- 固定随机种子下结果可复现。

## 8. 验收

- 无 UI 情况下可以用测试跑完完整一局。
- `pnpm test` 通过。
- 引擎没有引用原主工程的 `core`、`Laya`、`localStorage` 全局对象。
