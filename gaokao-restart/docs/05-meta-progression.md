# 任务 05：元进度、结局与存档

## 1. 目标

实现独立项目的长期循环：重开次数、已见事件、已选天赋、已解锁结局、成就和继承天赋。

## 2. 写入范围

允许写入：

- `gaokao-restart/src/engine/storage.ts`
- `gaokao-restart/src/engine/life.ts`
- `gaokao-restart/src/content/zh-cn/achievements.json`
- `gaokao-restart/src/content/zh-cn/characters.json`
- `gaokao-restart/src/ui/screens/SummaryScreen.ts`

## 3. 存档结构

使用独立 localStorage key：

```ts
const STORAGE_KEY = 'gaokao-restart.save.v1'
```

建议结构：

```ts
interface SaveData {
  times: number
  inheritedTalentId: number | null
  seenTalentIds: number[]
  seenEventIds: number[]
  unlockedEndingIds: number[]
  achievedIds: number[]
}
```

## 4. 结局收集

每局结算后：

- 当前结局 ID 加入 `unlockedEndingIds`。
- 本局事件加入 `seenEventIds`。
- 本局天赋加入 `seenTalentIds`。
- 点击再来一局后 `times += 1`。

## 5. 成就 MVP

建议首版成就：

| id | 名称 | 条件 |
| --- | --- | --- |
| 42101 | 第一次上岸 | 解锁任意结局 |
| 42102 | 稳上 985 | 解锁 `41002` |
| 42103 | 竞赛保送 | 解锁 `41003` |
| 42104 | 志愿鬼才 | 解锁 `41005` |
| 42105 | 滑档警示 | 解锁 `41008` |
| 42106 | 八面开花 | 解锁 8 个结局 |

成就弹窗可放二期，首版只需记录和在总结页提示。

## 6. 继承天赋

总结页只能继承 `inheritAllowed !== false` 的天赋。

不可继承示例：

- 重点学区房。
- 少数民族加分。
- 家长期望过高。

可继承示例：

- 县中黑马。
- 自律成瘾。
- 竞赛体质。
- 志愿军师。

## 7. 验收

- 刷新页面后重开次数和解锁结局仍存在。
- 总结页选择继承天赋后，下局候选天赋能带上该天赋。
- 不可继承天赋不能被选择。
- 存档损坏时能回退到空存档，不白屏。

