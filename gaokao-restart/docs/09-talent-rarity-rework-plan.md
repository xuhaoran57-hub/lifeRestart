# 天赋稀有度与分类改造计划

## 1. 改造目标

把当前天赋系统从单一 `grade` 展示，升级为更像抽卡池的稀有度与分类系统：

- 白色：普通。
- 蓝色：稀有。
- 紫色：史诗。
- 橙色：传说。

改造后需要满足：

- 抽到概率按白、蓝、紫、橙依次降低。
- 天赋效果强度按白、蓝、紫、橙依次增强。
- 天赋有明确玩法分类，便于 UI 展示、抽取保底、内容扩展和平衡。
- 保持现有天赋 ID 稳定，避免破坏结局、成就、角色预设中的引用。

## 2. 当前现状

当前 `talents.json` 共 160 个天赋，`grade` 分布为：

| grade | 当前数量 | 问题 |
| --- | ---: | --- |
| 0 | 53 | 混合了普通、负面和风险天赋，部分效果绝对值很大。 |
| 1 | 57 | 多数是成长型天赋，但强度不稳定。 |
| 2 | 46 | 标签里常写“稀有”，但实际应更接近史诗。 |
| 3 | 4 | 数量过少，无法支撑传说池体验。 |

当前平均效果绝对值：

| grade | 平均效果绝对值 |
| --- | ---: |
| 0 | 8.11 |
| 1 | 5.04 |
| 2 | 10.98 |
| 3 | 13.25 |

主要问题：

- `grade 0` 因为包含 `VOL -20` 等风险天赋，效果绝对值反而高于 `grade 1`。
- `grade 2` 被标记为“稀有”，但新规则中蓝色才是稀有，紫色才是史诗。
- 现有抽取是随机洗牌后截取，没有稀有度概率。
- UI 只显示 `G0/G1/G2/G3`，没有颜色和名称。
- 现有标签可以看出分类方向，但没有稳定字段。

## 3. 新稀有度规则

保留 `grade` 字段以兼容现有逻辑，同时新增或派生稀有度语义：

| grade | rarity | 中文名 | 颜色 | 定位 |
| ---: | --- | --- | --- | --- |
| 0 | `common` | 普通 | 白色 | 小幅收益、轻微代价、常见背景。 |
| 1 | `rare` | 稀有 | 蓝色 | 明确优势或可控代价。 |
| 2 | `epic` | 史诗 | 紫色 | 强路线能力、明显策略倾向。 |
| 3 | `legendary` | 传说 | 橙色 | 改变路线或显著提高上限。 |

建议颜色 token：

```ts
const TALENT_RARITY = {
  common: { grade: 0, name: '普通', color: '#f7f7f2' },
  rare: { grade: 1, name: '稀有', color: '#5aa7ff' },
  epic: { grade: 2, name: '史诗', color: '#a56cff' },
  legendary: { grade: 3, name: '传说', color: '#f6a23a' },
}
```

## 4. 天赋分类规则

新增 `category` 和 `categoryName`。先沿用现有内容方向，分 7 类：

| category | categoryName | 内容范围 |
| --- | --- | --- |
| `family` | 家庭背景 | 家庭资源、教育环境、城市/县城、父母风格。 |
| `aptitude` | 学习禀赋 | 学科能力、理解方式、记忆、审题、表达。 |
| `habit` | 习惯人格 | 作息、执行力、情绪、抗压、拖延。 |
| `relation` | 社会关系 | 老师、同伴、家校沟通、榜样和干扰。 |
| `route` | 赛道机会 | 竞赛、强基、艺体、综合评价、科创。 |
| `exam` | 考场变量 | 临场、黑天鹅、押题、身体状态。 |
| `volunteer` | 志愿信息 | 专业、院校、城市、章程、冲稳保。 |

数据结构建议：

```json
{
  "id": 21101,
  "name": "教师家庭",
  "grade": 1,
  "rarity": "rare",
  "rarityName": "稀有",
  "category": "family",
  "categoryName": "家庭背景",
  "description": "家里有人熟悉学校系统和考试节奏",
  "effect": { "VOL": 8, "INT": 1 },
  "effectBudget": 1.8,
  "tags": ["家庭背景", "稀有"]
}
```

`rarityName/categoryName/effectBudget` 可以由生成脚本写出，也可以只在运行时派生。首轮建议写入 JSON，方便内容审查。

## 5. 效果强度预算

为了让“白蓝紫橙越来越强”可校验，需要定义效果预算。建议按属性折算：

| 属性 | 预算权重 | 说明 |
| --- | ---: | --- |
| `INT/STR/MNY/SPR` | 1.0 / 点 | 四维主属性。 |
| `VOL` | 0.08 / 点 | 现版本上限 85，单点价值低于四维。 |
| `RSK` | 0.08 / 点 | 降低风险为正收益，升高风险为代价。 |
| `SCOREMOD` | 0.12 / 点 | 直接影响分数，需要谨慎。 |

预算计算：

```ts
benefitBudget =
  positive(INT/STR/MNY/SPR) * 1
  + positive(VOL) * 0.08
  + positive(-RSK) * 0.08
  + positive(SCOREMOD) * 0.12

costBudget =
  negative(INT/STR/MNY/SPR) * 1
  + negative(VOL) * 0.08
  + positive(RSK) * 0.08
  + negative(SCOREMOD) * 0.12

effectBudget = benefitBudget - costBudget * 0.65
```

建议预算范围：

| 稀有度 | effectBudget | 典型效果 |
| --- | ---: | --- |
| 普通 | 0.6 - 1.5 | 单属性 +1、小额 `VOL`、轻微代价。 |
| 稀有 | 1.6 - 2.8 | 双属性小增益、一个明确优势。 |
| 史诗 | 2.9 - 4.8 | 强路线加成、较大 `VOL/SCOREMOD` 或条件触发。 |
| 传说 | 4.9 - 7.0 | 影响结局路线的关键天赋，但应带互斥或限制。 |

负面/挑战型天赋处理：

- 可以保留，但应标记 `polarity: "drawback"` 或 `tags` 包含 `风险`。
- 负面天赋默认放普通或稀有，不放史诗/传说。
- 负面天赋不能因为绝对值大而被判定为高稀有度。

## 6. 推荐数量结构

当前 160 个天赋建议改为：

| 稀有度 | 目标数量 | 占比 |
| --- | ---: | ---: |
| 普通 | 64 | 40% |
| 稀有 | 56 | 35% |
| 史诗 | 32 | 20% |
| 传说 | 8 | 5% |

说明：

- 传说当前只有 4 个，需要从现有强路线天赋中提升 4 个，或新增生成项。
- 史诗数量应低于稀有，但要覆盖每个主要分类。
- 每个分类至少保留 1 个传说或史诗目标，避免高稀有度全部集中在竞赛/黑天鹅。

## 7. 抽取概率设计

候选池仍抽 10 个天赋，但不再简单洗牌截取。

建议每个候选位先按稀有度 roll：

| 稀有度 | 初始候选概率 | 成就满进度概率 |
| --- | ---: |
| 普通 | 70% | 60% |
| 稀有 | 20% | 25% |
| 史诗 | 8% | 11% |
| 传说 | 2% | 4% |

10 个候选的期望：

- 初始：普通约 7 个，稀有约 2 个，史诗约 0-1 个，传说约 0-1 个。
- 成就满进度：普通约 6 个，稀有约 2-3 个，史诗约 1 个，传说约 0-1 个。

成就影响规则：

- 使用已解锁成就数量影响候选稀有度概率。
- 当前内容包有 40 个成就，建议以 `achievementProgress = clamp(unlockedAchievementCount / totalAchievementCount, 0, 1)` 作为进度。
- 候选概率线性插值：

```ts
common = lerp(70, 60, achievementProgress)
rare = lerp(20, 25, achievementProgress)
epic = lerp(8, 11, achievementProgress)
legendary = lerp(2, 4, achievementProgress)
```

- 四档概率总和保持 100%。
- 如果后续成就数量变化，使用实时 `achievements.length` 作为分母，不写死 40。

抽取细则：

- 每个候选位按概率选择稀有度，再从该稀有度池内无放回抽取。
- 如果目标稀有度池已空，向低一级 fallback，再向高一级 fallback。
- 继承天赋固定插入候选池第 1 位，不消耗概率。
- 继承天赋不参与稀有度概率统计；剩余候选位仍按当前成就进度概率抽取。
- 候选池尽量覆盖至少 4 个分类；若分类过度重复，允许重新抽取 1-2 次。
- 互斥天赋可以同时出现在候选池，但选择时仍限制不能同时选择。

后续可选保底：

- 连续 5 局未见传说，则下一局候选池至少包含 1 个传说。
- 保底属于元进度二期，首轮不强制实现。

## 8. 需要改造的代码与数据

### 8.1 内容生成脚本

文件：`tools/generate-expanded-content.mjs`

待做：

- 增加 `RARITY_CONFIG` 与 `CATEGORY_CONFIG`。
- `talent()` 支持 `category`、`rarity`、`rarityName`、`categoryName`、`effectBudget`。
- `talentGroups` 从 `[startId, tag, items]` 升级为 `[startId, category, categoryName, items]`。
- 重新分配 160 个天赋的 `grade`。
- 按预算重写一批效果，确保稀有度越高，净收益越强。
- 重新生成 `talents.json` 和 `content-expansion-summary.md`。

### 8.2 内容校验

文件：`tools/validate-content.mjs`

待做：

- 校验 `rarity` 与 `grade` 一致。
- 校验 `category` 属于 7 个合法分类。
- 校验各稀有度数量接近目标数量。
- 校验普通、稀有、史诗、传说的平均 `effectBudget` 递增。
- 校验传说天赋至少 8 个。
- 校验负面天赋不能标为传说。

### 8.3 抽取逻辑

文件：`src/engine/talents.ts`

待做：

- `drawTalentCandidates()` 改为按稀有度概率抽取。
- 新增 `getTalentRarityRates(save, content)`，根据已解锁成就数计算概率。
- 新增 `rollTalentRarity(rates)`。
- 新增分类多样性修正。
- 保留 inherited talent 插入逻辑。
- 增加单元测试验证 10000 次抽取分布。

### 8.4 UI 展示

文件：`src/ui/App.ts`、`src/ui/styles/theme.css`

待做：

- 不再显示 `G0/G1/G2/G3`。
- 显示 `普通/稀有/史诗/传说`。
- 天赋卡片使用对应颜色边框和稀有度角标。
- 显示分类，例如 `家庭背景`、`学习禀赋`。
- 传说天赋可以有更醒目的但克制的边框，不做大面积闪烁动画。

### 8.5 模拟与平衡

文件：`tools/simulate.mjs`、`src/engine/simulation.ts`、`docs/balance-report.md`

待做：

- 输出候选天赋稀有度分布。
- 输出最终选择天赋稀有度分布。
- 重新跑 1000 局游戏结局分布。
- 确认高稀有度天赋不会把 SSS/SS 拉出 2%-8% 目标区间太多。

## 9. 推荐实施顺序

1. 只改生成脚本和校验脚本，生成带 `rarity/category/effectBudget` 的 `talents.json`。
2. 跑 `validate-content.mjs`，确认数据结构和预算递增。
3. 改 `drawTalentCandidates()`，让候选池按稀有度概率出现。
4. 补抽取分布测试，不接 UI 也能验证概率。
5. 改 UI 展示颜色和分类。
6. 跑 1000 局模拟，必要时调整高稀有度效果。
7. 更新 `balance-report.md`。

## 10. 验收标准

数据验收：

- 160 个天赋都有 `rarity/category`。
- 稀有度数量接近 `64/56/32/8`。
- 平均 `effectBudget` 满足：普通 < 稀有 < 史诗 < 传说。
- 内容校验通过。

抽取验收：

- 空成就存档下，10000 个候选位的稀有度比例接近 70% / 20% / 8% / 2%。
- 满成就存档下，10000 个候选位的稀有度比例接近 60% / 25% / 11% / 4%。
- 半成就存档下，10000 个候选位的稀有度比例接近 65% / 22.5% / 9.5% / 3%。
- 空成就 1000 局候选池中，出现过传说候选的局数约 18%-22%；满成就时约 32%-36%。
- 继承天赋固定进入候选池。

游戏平衡验收：

- 1000 局模拟无异常。
- 结局分布仍接近现有目标：
  - SSS/SS：2%-8%。
  - S/X：8%-18%。
  - A/B：45%-65%。
  - C/D：18%-35%。

UI 验收：

- 天赋页不再出现 `G0/G1/G2/G3`。
- 稀有度颜色在桌面和移动端都清晰可读。
- 卡片文字不溢出，分类和稀有度不遮挡描述。

## 11. 可派发 agent 任务

### Agent A：数据与生成脚本

负责：

- `tools/generate-expanded-content.mjs`
- `src/content/zh-cn/talents.json`
- `docs/content-expansion-summary.md`

产出：

- 带稀有度、分类和预算的新天赋数据。
- 稀有度数量表。

### Agent B：校验与抽取逻辑

负责：

- `tools/validate-content.mjs`
- `src/engine/talents.ts`
- `tests/**`

产出：

- 稀有度校验。
- 抽取概率实现。
- 抽取分布测试。

### Agent C：UI 展示

负责：

- `src/ui/App.ts`
- `src/ui/styles/theme.css`

产出：

- 彩色稀有度展示。
- 分类展示。
- 移动端可读性检查。

### Agent D：平衡回归

负责：

- `tools/simulate.mjs`
- `src/engine/simulation.ts`
- `docs/balance-report.md`

产出：

- 抽取分布统计。
- 1000 局结局分布。
- 高稀有度天赋对结局分布的影响分析。
