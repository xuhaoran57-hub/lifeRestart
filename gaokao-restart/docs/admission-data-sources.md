# 录取数据来源记录

最后更新：2026-05-08

## 当前默认口径

```txt
profileId: ah-2025-history / ah-2025-physics
年份：2025
生源省份：安徽
科类：历史类 / 物理类
分制：750
批次：本科普通批
```

当前版本使用安徽 2025 本科普通批普通专业组代表线，并额外补入一组精选中外合作办学专业组。运行时数据由本仓库脚本生成：

- 普通代表线来源：`data/anhui-2025-undergrad/anhui_2025_undergraduate_scores_slim.json`。
- 中外合作线来源：`data/anhui-2025-undergrad/anhui_2025_undergraduate_scores.json` 明细行白名单。
- 生成脚本：`tools/generate_anhui_2025_admissions.mjs`。

这不是完整志愿填报数据库。后续扩展时应继续按同一口径补齐更多专业组。

## 分数线来源

- 来源名称：安徽省教育招生考试院官网。
- 历史类数据页：`https://www.ahzsks.cn/ggl/8466.htm`
- 物理类数据页：`https://www.ahzsks.cn/ggl/8467.htm`
- 发布时间：2025-07-24
- 数据口径：安徽 2025 年普通高校招生本科普通批院校专业组投档最低分数线。

当前 `admission-lines.json` 中每条记录都保存了：

- `sourceName`
- `sourceUrl`
- `sourcePublishedAt`

普通代表线由 slim 数据生成，slim 生成规则会去除中外合作办学记录，并按院校代码与科类保留一个代表专业组。中外合作办学不进入普通代表线，而是由生成脚本从原始明细中挑选白名单专业组追加。

中外合作办学线会额外保存：

- `lineType: "sinoForeign"`
- `resourceNeed`：游戏内资源属性门槛，用于影响录取权重和结局条件。

## 院校标签来源

院校的 `985/211/doubleFirstClass` 标签使用教育部公开名单口径维护：

- 985 工程学校名单：`https://www.moe.gov.cn/srcsite/A22/s7065/200612/t20061206_128833.html`
- 211 工程学校名单：`https://www.moe.gov.cn/srcsite/A22/s7065/200512/t20051223_82762.html`
- 第二轮双一流建设高校及建设学科名单：`https://www.moe.gov.cn/srcsite/A22/s7065/202202/t20220211_598710.html`

## 后续扩表规则

- 不跨省混用分数线。
- 不混用历史类、物理类、文科、理科。
- 同一学校可以有多个专业组，但 `profileId + universityCode + groupCode` 不能重复。
- 同校最低投档线只代表“可进该校某专业组”，不代表任意专业都能录取。
- 中外合作办学已使用 `lineType: "sinoForeign"` 标记；专项计划、民族班、护理、预科等特殊专业组后续也应按同样方式细分展示。
