# Mobile UI 学习手册（逐文件）

## 1. 先看路由骨架（决定页面怎么出现）

1. `apps/mobile/app/_layout.tsx`
- 根布局，定义 Stack 路由。
- `name="(tabs)"` 是主 Tab 容器。
- `list`、`hotel/[id]`、`location` 是从首页/列表跳转出去的独立页面。

2. `apps/mobile/app/(tabs)/_layout.tsx`
- 定义底部 4 个 Tab。
- 每个 Tab 通过 `name` 对应同目录下页面文件。
- `HapticTab` 让 iOS 点击时有轻触反馈。

## 2. 再看主业务链路（查询 -> 列表 -> 详情）

1. 首页：`apps/mobile/app/(tabs)/index.tsx`
- 管理搜索状态（城市、位置、日期、人数、星级）。
- `runSearch()` 把状态拼成路由参数跳到 `/list`。
- 使用 `SearchPanel` 承载 UI，页面只负责“状态与事件”。

2. 列表页：`apps/mobile/app/list.tsx`
- 接收路由参数回填筛选条件。
- `load(page, append)` 统一处理首屏与分页加载。
- `FlatList` 的 `onEndReached` 实现无限滚动。

3. 详情页：`apps/mobile/app/hotel/[id].tsx`
- 根据 `id` 拉酒店详情。
- 轮播图 + 设施 + 房型列表。
- 日期修改会影响“展示逻辑”和后续价格理解。

4. 位置页：`apps/mobile/app/location.tsx`
- 关键词输入、热门推荐、定位能力都在这里。
- `navigateWithSelection` 根据来源页决定回首页还是回列表。

## 3. 组件层分工（为什么可维护）

1. 搜索组件
- `apps/mobile/components/hotel/SearchPanel.tsx`：首页完整版搜索面板。
- `apps/mobile/components/hotel/CompactSearchPanel.tsx`：列表页紧凑版。

2. 列表组件
- `apps/mobile/components/hotel/HotelCard.tsx`：酒店摘要卡片。
- `apps/mobile/components/hotel/HotelFilters.tsx`：排序标签栏。

3. 详情组件
- `apps/mobile/components/hotel/RoomList.tsx`：房型信息列表。

## 4. 基础 UI 组件（跨页面复用）

1. 图标系统
- `apps/mobile/components/ui/icon-symbol.ios.tsx`：iOS 直接用 SF Symbols。
- `apps/mobile/components/ui/icon-symbol.tsx`：Android/Web 做图标映射。

2. 主题系统
- `apps/mobile/components/themed-text.tsx`：带主题色的文本。
- `apps/mobile/components/themed-view.tsx`：带主题色的容器。

3. 交互小组件
- `apps/mobile/components/ui/collapsible.tsx`：折叠面板。
- `apps/mobile/components/haptic-tab.tsx`：Tab 触感反馈。

## 5. 占位页与示例页

- `apps/mobile/app/(tabs)/cart.tsx`
- `apps/mobile/app/(tabs)/reviews.tsx`
- `apps/mobile/app/modal.tsx`
- `apps/mobile/components/hello-wave.tsx`
- `apps/mobile/components/parallax-scroll-view.tsx`
- `apps/mobile/components/external-link.tsx`

这些文件主要是模板或演示用途，复杂业务不在这里。

## 6. 修改 UI 的推荐顺序（实操）

1. 先改组件，再改页面：
- 例如先改 `SearchPanel.tsx`，再看 `index.tsx` 的状态是否要调整。

2. 先看“数据从哪里来”：
- 页面里的 `useState/useEffect` 是 UI 的数据入口。
- 组件 props 是 UI 的输入边界。

3. 只改一条链路，跑通后再扩散：
- 首页搜索区 -> 列表页 -> 详情页，按链路逐段调。

4. 交互改动优先查事件回调：
- `onPress` / `onDayPress` / `onEndReached` / `onChangeText`。

## 7. 你可以从这里开始练手

1. 练布局：改 `SearchPanel.tsx` 的按钮间距和圆角。
2. 练交互：改 `list.tsx` 的筛选后重查逻辑。
3. 练组件复用：把 `HotelCard.tsx` 的 tag 样式提取为小组件。
