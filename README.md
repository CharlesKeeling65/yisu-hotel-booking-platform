# 易宿酒店预订平台（Monorepo）

> 最后梳理日期：2026-02-24

本项目是一个三端一体的酒店预订系统：
- 用户端移动应用（Expo + React Native）
- 商户/管理员 Web 管理端（React + Vite）
- 后端 API（Express + MySQL）

仓库采用 Monorepo 管理，目录如下：
- `apps/mobile`：移动端（用户搜索、列表、详情、下单、订单、定位）
- `apps/web`：Web 管理端（登录注册、酒店管理、审核发布、房型管理）
- `apps/api`：后端服务（鉴权、酒店、房型、审核、订单、定位与联想）
- `packages/shared`：共享类型（Hotel/Room 等）
- `Task_requirements`：原始需求与阶段计划
- `docs`：方案与过程文档

## 1. 技术栈（当前实际）

- Mobile：Expo Router + React Native 0.81 + TypeScript + NativeWind
- Web：React 19 + Vite + React Router + Tailwind + Radix UI
- API：Node.js + Express + mysql2 + dotenv
- DB：MySQL 8（建议 docker-compose 启动）
- Monorepo：npm workspaces

## 2. 已实现功能梳理（基于当前代码）

### 2.1 移动端（`apps/mobile`）

- 首页
  - Banner 轮播并可跳酒店详情
  - 搜索面板：城市、位置、日期、人数、价格/星级、快捷标签
  - 定位按钮：调用逆地理编码并回填城市/位置
- 定位页
  - 当前定位 + 行政区（省/市/区县）手动兜底
  - 输入联想（后端 `/api/location/suggest` + 本地 fallback）
  - 逆地理编码统一字段消费（`normalized.cityOrCounty/street`）
- 列表页
  - 条件搜索、筛选、排序
  - 触底加载（分页）
  - 过滤弹层（景点、价格/星级、标签、排序）
- 详情页
  - 酒店图集轮播、基础信息展示
  - 房型列表，按价格升序展示
  - 日期与人数可改，进入预订页
- 预订页
  - 联系人信息、入住时段、房间数与费用明细
  - 创建订单、拉起支付、支付成功跳转
- 订单页/订单列表
  - 订单列表分页、状态筛选
  - 支付、取消、订单明细（费用 breakdown）
- 登录注册
  - Customer 注册/登录
  - token 存储在 `AsyncStorage`

### 2.2 Web 管理端（`apps/web`）

- 登录/注册
  - 角色注册（admin/merchant/user）
  - 登录后保存会话到 sessionStorage
- Dashboard
  - 酒店列表分页、关键字/城市筛选
  - 状态筛选：待审核、待发布、营业中、被驳回
  - 状态统计（总数与各状态计数）
- 酒店详情
  - 基础信息 + 房型 + 状态展示
  - 管理员审核（通过/驳回）、发布、下线
  - 商户下线（软下线）
- 酒店编辑页
  - 创建/编辑酒店基础信息
  - 保存后触发状态回到待审核
- 房型管理页
  - 房型增删改
  - 批量保存（bulk-save）
  - 库存与房态联动

### 2.3 API（`apps/api/server.js`）

- 认证与用户
  - `POST /api/auth/register`
  - `POST /api/auth/login`
  - `GET /api/auth/test-accounts`
  - `POST /api/customer/register`
  - `POST /api/customer/login`
- 地理能力
  - `GET /api/geocode/reverse`（Nominatim/BigDataCloud/AMap 策略）
  - `GET /api/location/suggest`（真实联想）
- 酒店与房型
  - `GET/POST/PUT/DELETE /api/hotels`
  - `GET /api/hotels/stats`
  - `GET/POST/PUT/DELETE /api/hotels/:id/rooms`
  - `PUT /api/hotels/:id/rooms/bulk-save`
- 审核发布
  - `GET /api/admin/hotels/pending`
  - `POST /api/admin/hotels/:id/audit`
  - `POST /api/admin/hotels/:id/publish`
  - `POST /api/admin/hotels/:id/offline`
- 移动端聚合接口
  - `GET /api/mobile/home-banner`
  - `GET /api/mobile/hotels`
  - `GET /api/mobile/hotels/:id`
  - `POST /api/mobile/orders`
  - `POST /api/mobile/orders/:id/pay`
  - `PUT /api/mobile/orders/:id/cancel`
  - `GET /api/mobile/orders`
  - `GET /api/mobile/orders/:id/breakdown`

## 3. 与原始需求对比（`Task_requirements/original_task_requirements.md`）

### 3.1 完成度较高

- 移动端三大核心页（首页/列表/详情）已落地
- 列表页支持触底加载
- 详情页房型可按价格排序展示
- Web 端登录注册、酒店录入编辑、审核/发布/下线流程已打通
- 软下线能力已实现（非物理删除）

### 3.2 部分完成

- “实时更新”目前主要依靠刷新/重新请求，不是 WebSocket/SSE 实时推送
- 权限控制是前后端轻量实现，未形成完整 RBAC 中间件体系
- README 与工程文档此前不完整（本次已补齐）

### 3.3 仍有差距

- 移动端“搜索历史”未形成完整产品化能力
- 地图展示能力仍为可选状态（需求中可忽略，当前也未强依赖）
- 仍有部分页面用 mock 或静态展示数据（如 profile 统计）

## 4. 与计划文档对比（`Task_requirements/plan.md`）

`plan.md` 偏“理想化全栈规划”（含 Next.js/Prisma/NextAuth 等），与当前仓库实际技术路线存在偏差：

- 计划栈：Next.js + Prisma + NextAuth
- 实际栈：React/Vite + Expo + Express + MySQL

对比结论：
- 业务主链路（搜索、详情、下单、审核发布）已按目标方向落地
- 架构层目标（统一契约、强 RBAC、实时同步、系统化测试）尚未完全达到计划中的工程化标准

## 5. 快速启动

### 5.1 安装依赖

```bash
npm install
```

### 5.2 启动 MySQL（推荐）

```bash
docker compose up -d
```

默认映射：`127.0.0.1:3307 -> mysql:3306`

### 5.3 启动三端

```bash
npm run dev:web
npm run dev:api
npm run dev:mobile
```

或并行启动：

```bash
npm run dev
```

## 6. 环境变量

### 6.1 API（`apps/api/.env`）

可参考 `apps/api/.env.example`：

```env
PORT=3000
DB_HOST=127.0.0.1
DB_PORT=3307
DB_USER=root
DB_PASS=123456
DB_NAME=yisu_db

# 可选：定位逆地理编码
AMAP_WEB_KEY=你的高德Web服务Key
GEO_PROVIDER_MODE=auto
# auto: Nominatim -> BigDataCloud -> AMap
# amap: AMap优先，失败再回退
# amap_only: 仅AMap
GEO_TIMEOUT_MS=4500
```

说明：
- `AMAP_WEB_KEY` 仅放在后端 `.env`，不要下发到移动端/Web 端。
- Web 端通过 Vite 代理访问 `/api`。
- 移动端当前 `apps/mobile/lib/api.ts` 默认请求 `http://localhost:3000`，真机调试需改为局域网 IP。

## 7. 数据库初始化与“重置”行为说明

`npm run dev:api` 启动时，`apps/api/server.js` 会执行初始化逻辑：

- 总会执行（幂等）
  - `sql/init_schema.sql`
  - `sql/create_orders_table.sql`
  - `sql/create_customers_table.sql`（Customer 不再 drop）
  - `sql/migrate_add_room_fields.sql`
  - TEST_USERS 的 upsert（User 测试账号会更新/覆盖同 ID 记录）
- 条件执行（`Hotel_Base` 数量 `< 20`）
  - `sql/seed_sample.sql`
  - `sql/add_20_hotels_data.sql`

关键影响：
- `Customer` 表重启 API 后不会被清空，适合移动端登录态与回归测试。
- `User` 内置测试账号会被 upsert，密码与资料会回到代码中的默认值。
- 酒店种子数据仅在酒店数量不足时补种，不是每次都全量重置。

## 8. 默认测试账号（来自 `apps/api/server.js`）

- 管理员
  - `admin.ops / Admin#2026!Ops`
  - `admin.audit / Admin#2026!Audit`
  - `admin.release / Admin#2026!Release`
- 商户
  - `m.shanghai / Merchant#2026!SH`
  - `m.beijing / Merchant#2026!BJ`
  - `m.shenzhen / Merchant#2026!SZ`
  - `m.hangzhou / Merchant#2026!HZ`
  - `m.chengdu / Merchant#2026!CD`
- 演示用户
  - `user.demo / User#2026!Demo`

## 9. 测试与校验

```bash
npm test
```

当前会执行：
- Web：`vite build`
- API：`node --check server.js`
- Mobile：`expo lint`

说明：目前缺少系统化的端到端自动化测试与 API 单元测试覆盖。

## 10. 当前已知问题与下一步建议

- 建议优先补齐统一响应结构与错误码约束（当前仍存在 `msg`/`message` 混用）
- 建议补全真正的 RBAC（后端鉴权中间件 + 路由权限矩阵）
- 建议把移动端 Profile 中的静态统计替换为真实接口
- 建议增加 API 与关键业务流程测试（下单并发、审核流转、库存回滚）

---

如需查看任务目标，请直接参考：
- `Task_requirements/original_task_requirements.md`
- `Task_requirements/plan.md`
