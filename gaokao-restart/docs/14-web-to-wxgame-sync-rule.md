# Web 到微信小游戏同步规则

本文档是 `gaokao-restart` 从网页版本同步到微信小游戏版本的执行规则。以后修改网页游戏后，按这份规则检查和转换 `wxgame`，避免只改 Web UI 导致小游戏行为、流程或显示落后。

## 1. 核心原则

- `src/engine/*`、`src/app/types.ts`、`src/content/zh-cn/*` 是共享核心。Web 和微信小游戏必须共用这些模块，不要在 `src/wxgame/` 复制一份玩法逻辑。
- `src/ui/*` 是浏览器 DOM/CSS UI，只服务网页版本。
- `src/wxgame/*` 是微信小游戏 Canvas UI，只服务小游戏版本。
- `wxgame/game.js`、`wxgame/game.json`、`wxgame/project.config.json` 是微信开发者工具导入壳。
- `wxgame/js/game.bundle.js` 是构建产物，由 `pnpm --dir gaokao-restart build:wxgame` 生成，不手改。

## 2. 什么时候必须同步 wxgame

修改以下内容后必须检查微信小游戏：

- 新增、删除或重命名游戏流程页面，例如首页、天赋、属性、轨迹、结局、成就。
- 修改 `src/ui/App.ts` 中的玩家操作，例如选天赋、分配属性、下一回合、自动跑完、复读、继承天赋、重开。
- 修改 `src/app/types.ts` 的状态、结局、录取、天赋、事件结构。
- 修改 `src/engine/*` 的行为规则，导致 UI 需要显示新字段或处理新异常。
- 修改 `src/content/zh-cn/*` 的字段结构、文案长度、天赋稀有度、事件数量或结局展示信息。
- 修改存档结构或元进度逻辑。

只修改网页 CSS 且不影响流程时，不一定需要改 `src/wxgame/`，但仍要跑 `build:wxgame` 确认共享代码没有破坏小游戏构建。

## 3. 文件映射

| Web 侧 | wxgame 侧 | 同步规则 |
| --- | --- | --- |
| `src/main.ts` | `src/wxgame/main.ts` | Web 查找 `#app`，wxgame 创建 Canvas。入口不互相复用。 |
| `src/ui/App.ts` | `src/wxgame/main.ts` | 每个 Web 页面和操作都要在 Canvas 状态机中有对应实现或明确降级。 |
| `src/ui/styles/*` | `src/wxgame/main.ts` 绘制函数 | CSS 不会进入小游戏。颜色、间距、按钮、卡片都要用 Canvas 绘制。 |
| `src/app/createGame.ts` | `src/wxgame/storage.ts` | `createGame` 必须继续支持注入 storage；wxgame 使用 `wx.getStorageSync` / `wx.setStorageSync`。 |
| `src/engine/*` | 直接 import | 不复制逻辑，只修共享模块。 |
| `src/content/zh-cn/*` | 直接 import | 不复制 JSON，只修共享数据。 |
| `vite.config.ts` | `vite.wx.config.ts` | Web 和 wxgame 分开构建。 |

## 4. 转换步骤

### 4.1 先判断变更类型

每次 Web 改动后，先回答这几个问题：

1. 是否新增或删除了用户操作？
2. 是否新增了需要展示的新状态或字段？
3. 是否改变了某个页面的推进顺序？
4. 是否让事件、天赋、结局、录取文案明显变长？
5. 是否增加了列表规模，例如更多事件日志、更多候选项？

如果任一答案是“是”，继续修改 `src/wxgame/main.ts`。

### 4.2 同步流程状态机

`src/wxgame/main.ts` 中的 `Screen`、`Action`、`UiState` 必须覆盖 Web 侧核心流程。

当前最低要求：

- `home`：显示进度，进入天赋选择。
- `talents`：显示 10 个候选，选择 3 个，处理互斥和继承天赋。
- `properties`：分配 `INT`、`STR`、`MNY`、`SPR`，总和必须为 20。
- `trajectory`：显示属性、当前进度、事件日志，支持下一回合和自动跑完。
- `summary`：显示结局、录取、属性、事件、继承天赋、复读、重开确认。

如果 Web 新增页面：

- 优先在 `Screen` 增加同名状态。
- 在 `drawScrollableContent` 增加渲染分支。
- 在 `drawFooter` 增加底部操作。
- 在 `handleAction` 增加操作处理。

### 4.3 同步用户操作

Web 的 `data-action` 操作映射到 wxgame 的 `Action` 联合类型。

新增操作时：

- 先给 `Action` 增加类型。
- 在 `handleAction` 实现行为。
- 所有可点区域必须通过 `drawButton` 或 `registerButton` 注册命中区域。
- 高风险操作，例如重开、清空、覆盖存档，必须使用二次确认。

### 4.4 同步存档

不要在 wxgame 中直接使用 `window.localStorage`。

规则：

- Web 默认走 `localStorage`。
- wxgame 通过 `createWxSaveStorage(wx)` 注入。
- 如果修改 `SaveData` 结构，必须检查 `normalizeSave`、`createEmptySave`、`recordFinalResult`、`setInheritedTalent`。
- 同步后至少跑一局，确认 `times`、结局、成就、继承天赋能保存。

### 4.5 同步显示内容

Canvas 没有 DOM 自动排版，所有新增文案都要考虑宽度。

规则：

- 卡片标题必须用 `fitText` 防溢出。
- 长文案必须用 `drawWrappedText` 限制行数。
- 天赋卡片保持紧凑：标题左侧，稀有等级在同一行右侧，描述固定两行。
- 结局、录取原因、事件文本可以多行，但必须限制最大行数或使用列表分页/虚拟渲染。
- 按钮文字必须适配小屏，不能超出按钮。

### 4.6 同步列表性能

微信小游戏 Canvas 滑动时不能每帧重排和绘制所有日志。

规则：

- 长事件列表使用虚拟渲染，只绘制当前 viewport 内的卡片。
- 列表项优先固定高度，避免滑动时重新测量大量文本。
- 轨迹页和结局页的事件列表都必须使用同一套虚拟列表逻辑。
- 如果新增长列表，例如成就列表、院校列表，也按虚拟列表实现。

### 4.7 同步底部操作安全

底部按钮是误触高发区，尤其是结局页。

规则：

- 结局页不要把“再来一局”作为一键主按钮。
- 复读可用时，主按钮优先给“复读一年”。
- 重开必须先显示“看完后重开”，再进入“继续看结局 / 确认重开”二次确认。
- 首页、轨迹页的“首页/重开”按钮如后续会丢失当前局，也应加确认。

## 5. 微信小游戏限制

写 `src/wxgame/*` 时默认遵守这些限制：

- 不使用 DOM：不要写 `document.querySelector`、`innerHTML`、`HTMLElement` 依赖。
- 不使用 CSS：样式全部由 Canvas 绘制函数控制。
- 不使用浏览器 storage：只走注入的 storage 适配器。
- 不假设网页字体、滚动容器、按钮 hover 存在。
- 不手写或编辑 `wxgame/js/game.bundle.js`。

## 6. 每次同步后的验证命令

在仓库根目录执行：

```powershell
pnpm --dir gaokao-restart exec tsc --noEmit
pnpm --dir gaokao-restart build:wxgame
pnpm --dir gaokao-restart test
pnpm --dir gaokao-restart build
```

说明：

- `tsc --noEmit`：检查共享类型和 wxgame 类型。
- `build:wxgame`：生成 `wxgame/js/game.bundle.js`。
- `test`：检查引擎和内容规则。
- `build`：确认 Web 版本仍能构建。

Web build 可能继续出现大 chunk 提醒，主要来自内容 JSON。只要构建成功即可；如后续超过微信主包限制，再考虑分包或远程内容。

## 7. 微信开发者工具手动验收

构建后导入或重新编译：

```text
gaokao-restart/wxgame
```

手动检查：

- 首页可进入天赋选择。
- 天赋卡片一屏内尽量展示完整候选，长标题和描述不溢出。
- 可选中 3 个天赋，互斥提示正常。
- 属性加减和剩余点数正确。
- 下一回合和自动跑完正常。
- 事件多时上下滑动不卡顿。
- 结局页能看到结局、录取、属性、事件。
- 复读和继承天赋可用。
- 重开必须二次确认。
- 重新进入小游戏后存档进度仍存在。

如果看到旧界面，先在微信开发者工具中清理模拟器缓存，再重新编译。

## 8. 下次给 Codex 的执行提示

如果需要让 Codex 自动同步 wxgame，可以直接使用：

```text
请按 gaokao-restart/docs/14-web-to-wxgame-sync-rule.md，把本次 Web 版本变更同步到微信小游戏。不要手改 wxgame/js/game.bundle.js；修改 src/wxgame/* 或共享模块后，运行 tsc、build:wxgame、test、build 验证，并说明 wxgame 手动验收点。
```
