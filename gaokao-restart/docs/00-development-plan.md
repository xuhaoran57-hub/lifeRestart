# 重回高三人生模拟独立项目总计划

## 1. 目标变更

《重回高三人生模拟》标准版不再接入当前《人生重开模拟器》主工程。后续以 `gaokao-restart/` 为独立 Web 项目目录开发，原主工程只作为架构和玩法参考。

这样做的好处：

- 不受 Laya UI 和原属性系统限制。
- 可快速迭代高考主题专属 UI。
- 数据、存档、测试和构建都独立，风险更低。
- 后续可单独部署、分享或包装成活动页。

## 2. 首发范围

首发只做标准版，不做高三冲刺版。

必须完成：

- 独立 Vite 项目。
- 标准版数据驱动引擎。
- 3 个天赋选择。
- 20 点属性分配。
- 3 到 18 岁推进，每年 4 回合，共 64 回合。
- `INT/STR/MNY/SPR/VOL/RSK/SCR/HSCR/HVOL` 属性系统。
- 高考分数公式。
- 8 个 MVP 结局。
- 本地存档、重开次数、已见事件、已选天赋、已解锁结局。
- 自动模拟与内容校验。

暂不做：

- 接入现有 Laya 主工程。
- 名人模式全量扩展。
- 复杂皮肤系统。
- 排行榜、分享码、后端服务。
- 高三 365 天行动系统。

## 3. 推荐目录

```txt
gaokao-restart/
  docs/
  package.json
  index.html
  vite.config.ts
  tsconfig.json
  src/
    main.ts
    app/
      createGame.ts
      types.ts
    engine/
      condition.ts
      random.ts
      properties.ts
      talents.ts
      events.ts
      endings.ts
      life.ts
      storage.ts
      simulation.ts
    content/
      zh-cn/
        talents.json
        events.json
        ages.json
        endings.json
        achievements.json
        characters.json
    ui/
      App.ts
      render.ts
      screens/
        TalentScreen.ts
        PropertyScreen.ts
        TrajectoryScreen.ts
        SummaryScreen.ts
      styles/
        base.css
        theme.css
  tools/
    validate-content.mjs
    simulate.mjs
  tests/
    condition.test.ts
    engine.test.ts
```

## 4. 技术建议

首版使用 Vite + TypeScript + 原生 DOM/CSS。这个玩法核心是文字、列表、按钮和进度，不需要引入重型前端框架。

可以使用：

- `vite`：开发服务器和构建。
- `typescript`：规则和数据类型约束。
- `vitest`：单元测试。
- `xlsx`：二期如果要从 Excel 生成 JSON，可再接入。

首版内容数据可以直接维护 JSON，减少管线成本。等规则稳定后，再补 Excel 导入。

## 5. 标准版核心循环

1. 进入首页。
2. 抽取 10 个候选天赋。
3. 选择 3 个天赋。
4. 分配 20 点到 `INT/STR/MNY/SPR`。
5. 从 3 岁推进到 18 岁，每年 4 回合。
6. 每回合触发随机事件并刷新分数，年龄天赋只在该年龄第 1 回合触发。
7. 18 岁第 4 回合执行最终录取结算。
8. 展示结局、总评、轨迹、可继承天赋。
9. 记录元进度并允许再来一局。

## 6. 标准版公式

阶段基准：

```ts
const phaseBase = {
  preschool: 245,
  primary: 305,
  middle: 360,
  senior1: 385,
  senior2: 410,
  senior3: 425,
  final: 450
}
```

分数潜力：

```ts
SCR = clamp(
  round(base + INT * 8.5 + STR * 4.8 + MNY * 3 + SPR * 5.2 + VOL * 0.2 - RSK * 1.35 + SCOREMOD * 0.6),
  250,
  750
)
```

64 回合版本的成长累计更长，首轮平衡把 `INT/STR/MNY/SPR` 上限收紧到 10，`VOL` 上限 85，`RSK` 上限 90，`SCOREMOD` 限制在 -60 到 70，避免 64 次事件后全局稳定冲到顶尖结局。

普通事件效果按 64 回合长期成长折算，天赋效果保持完整。当前缩放为：`INT/STR/MNY` 0.5，`SPR` 0.4，`VOL` 0.5，`RSK` 0.35，`SCOREMOD` 0.65。

总评：

```ts
SUM = round(HSCR * 0.45 + (HINT + HSTR + HMNY + HSPR) * 8 + HVOL * 0.8 + ending.scoreBonus)
```

## 7. 里程碑

M1：独立项目能启动，显示静态首页。

M2：核心引擎能无 UI 跑完 64 回合并产出结局。

M3：MVP 内容数据完整，校验通过。

M4：UI 完成可玩闭环。

M5：元进度可保存和读取。

M6：自动模拟 1000 局无异常，结局分布可接受。

M7：标准版验收后，启动冲刺版预研。

## 8. 总验收

- `cd gaokao-restart && pnpm install` 可安装依赖。
- `pnpm dev` 可打开独立游戏。
- `pnpm test` 通过。
- `pnpm build` 通过。
- `pnpm validate:content` 通过。
- `pnpm simulate` 能输出结局分布。
- 原主工程 `src/` 无需修改即可保持可用。
