# 任务 03：内容数据与校验

## 1. 目标

把标准版 MVP 内容扩充为独立项目首轮可玩内容包，并提供生成、校验工具。

## 2. 写入范围

允许写入：

- `gaokao-restart/src/content/zh-cn/talents.json`
- `gaokao-restart/src/content/zh-cn/events.json`
- `gaokao-restart/src/content/zh-cn/ages.json`
- `gaokao-restart/src/content/zh-cn/endings.json`
- `gaokao-restart/src/content/zh-cn/achievements.json`
- `gaokao-restart/src/content/zh-cn/characters.json`
- `gaokao-restart/tools/generate-expanded-content.mjs`
- `gaokao-restart/tools/validate-content.mjs`
- `gaokao-restart/docs/content-expansion-summary.md`

## 3. 扩充数据规模

内容以 `design/gaokao-mvp-content.md` 的标准版 MVP 为骨架，并扩充到约试玩版 10 倍规模：

- 天赋：160 个。
- 事件：280 个。
- 年龄回合：3 到 18 岁，每年 4 回合，共 64 行。
- 结局：80 个。
- 成就：40 个。
- 预设角色：20 个。

ID 规划：

- MVP 天赋：`21001-21016`。
- 扩充天赋：`21101-21718`。
- MVP 事件：`31001-31028`。
- 扩充事件：`31101-31736`。
- MVP 结局：`41001-41008`。
- 扩充结局：`41101-41172`。
- 成就：`42101` 起。
- 预设角色：`52001` 起。

## 4. JSON 结构

建议使用数组，便于编辑和校验：

```json
[
  {
    "id": 21001,
    "name": "学前启蒙",
    "grade": 1,
    "description": "5 岁时学力 +2",
    "effect": { "INT": 2 },
    "condition": "AGE?[5]",
    "inheritAllowed": true,
    "tags": ["学前", "成长"]
  }
]
```

事件：

```json
[
  {
    "id": 31001,
    "stage": "学前期",
    "phase": "preschool",
    "text": "父母开始坚持给你读睡前故事。",
    "effect": { "INT": 1, "SPR": 1 },
    "include": "MNY>3",
    "weight": 100,
    "tags": ["学前", "家庭"]
  }
]
```

年龄：

```json
[
  {
    "step": 1,
    "age": 3,
    "round": 1,
    "roundName": "春季启蒙",
    "phase": "preschool",
    "phaseName": "学前期",
    "eventPool": [{ "id": 31001, "weight": 80 }],
    "talentPool": [],
    "scoreFormulaTag": "学前期-春季启蒙",
    "note": "3 岁第 1 回合：春季启蒙"
  }
]
```

结局：

```json
[
  {
    "id": 41002,
    "name": "稳上 985",
    "tier": "S",
    "description": "你的实力和志愿都足够稳健。",
    "condition": "(HSCR>=630)&(VOL>=35)&(EVT![31028])",
    "priority": 90,
    "scoreBonus": 40,
    "tags": ["985", "稳健"]
  }
]
```

## 5. 生成与校验

扩充内容由脚本生成：

```bash
node tools/generate-expanded-content.mjs
```

校验：

```bash
node tools/validate-content.mjs
```

在 `gaokao-restart/` 项目脚手架完成后，可把命令挂到 package scripts：

```json
{
  "scripts": {
    "content:generate": "node tools/generate-expanded-content.mjs",
    "validate:content": "node tools/validate-content.mjs"
  }
}
```

`tools/validate-content.mjs` 至少检查：

- 年龄覆盖 3 到 18。
- 每个年龄必须有 4 个回合。
- `step` 唯一且完整覆盖 1-64。
- age 中的事件 ID 都存在。
- age 中的天赋 ID 都存在。
- event branch 目标 ID 都存在。
- condition 中引用的 `TLT/EVT/END` ID 存在。
- effect 属性都在允许列表中。
- 结局 priority、condition、tier 不为空。
- 至少存在 80 个结局。

## 6. 验收

- `node tools/validate-content.mjs` 通过。
- JSON 全部为 UTF-8。
- 数据不依赖原工程 `data/` 或 `public/data/`。
- `docs/content-expansion-summary.md` 记录当前内容规模。
