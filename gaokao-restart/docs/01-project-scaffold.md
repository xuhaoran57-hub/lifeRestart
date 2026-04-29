# 任务 01：独立项目脚手架

## 1. 目标

在仓库根目录创建 `gaokao-restart/` 独立 Web 项目。该项目不依赖现有 Laya 主工程，不修改 `src/`。

## 2. 写入范围

允许写入：

- `gaokao-restart/package.json`
- `gaokao-restart/index.html`
- `gaokao-restart/vite.config.ts`
- `gaokao-restart/tsconfig.json`
- `gaokao-restart/src/**`
- `gaokao-restart/tools/**`
- `gaokao-restart/tests/**`

不要写入：

- `src/**`
- `public/**`
- `data/**`
- `gaokao-standard/**`

## 3. 推荐 package scripts

```json
{
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "preview": "vite preview",
    "test": "vitest run",
    "validate:content": "node tools/validate-content.mjs",
    "simulate": "node tools/simulate.mjs"
  }
}
```

## 4. 初始页面要求

首版页面不做营销落地页，打开即进入游戏：

- 顶部显示标题和重开次数。
- 主区域显示“开始重开”。
- 点击后进入天赋选择页。

## 5. 样式方向

标准版适合安静、清晰、略带考试纸张感的界面。避免过重赛博风和大面积深色。首版只需要：

- 可读性强。
- 手机和桌面都能完整操作。
- 不出现元素重叠。
- 卡片圆角不超过 8px。

## 6. 验收

- `cd gaokao-restart && pnpm dev` 能启动。
- 首页能渲染。
- `pnpm build` 能生成产物。
- 没有修改主工程文件。

