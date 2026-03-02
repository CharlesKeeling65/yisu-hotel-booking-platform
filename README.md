# 易宿酒店预订平台

易宿酒店预订平台是一个基于 Monorepo 管理的酒店预订项目，包含用户移动端、商户/管理员 Web 管理端以及 Express API 服务。项目围绕酒店浏览、搜索筛选、下单支付、订单管理、酒店录入、审核发布等核心流程搭建，适合作为全栈课程项目与多端协同开发示例。

## 项目概览

- 用户端：基于 Expo + React Native，实现首页、酒店列表、详情、预订、订单、定位与登录注册等流程
- 管理端：基于 React + Vite，覆盖登录注册、酒店管理、房型维护、审核发布与上下线操作
- 服务端：基于 Express + MySQL，提供认证、酒店、房型、订单、定位和后台审核接口
- 共享包：`packages/shared` 提供跨端共享的数据结构定义

## 功能特性

### 移动端

- 首页 Banner、搜索面板、日期与人数筛选
- 酒店列表筛选、排序、分页加载
- 酒店详情与房型展示
- 下单、支付、订单详情与取消订单
- 地理定位、逆地理编码与地点联想
- 用户注册、登录与本地会话持久化

### Web 管理端

- 角色注册与登录
- 酒店列表查询、状态筛选与统计
- 酒店新建、编辑、删除与软下线
- 房型增删改与批量保存
- 管理员审核、发布、驳回流程

### API 服务

- 用户与客户账号认证
- 酒店、房型、订单 CRUD 与聚合接口
- 审核发布接口
- 地理编码与地点联想接口
- 数据库初始化与示例数据写入

## 技术栈

| 端     | 技术                                                    |
| ------ | ------------------------------------------------------- |
| Mobile | Expo Router、React Native 0.81、TypeScript、NativeWind  |
| Web    | React 19、Vite 5、React Router、Tailwind CSS、shadcn/ui |
| API    | Node.js、Express 4                                      |
| 数据库 | MySQL 8                                                 |

## 仓库结构

```text
.
├── apps
│   ├── api           # Express API 与 SQL 初始化脚本
│   ├── mobile        # Expo / React Native 用户端
│   └── web           # React + Vite 管理端
├── packages
│   └── shared        # 跨端共享类型与数据结构
├── deploy
│   ├── certbot       # 证书目录占位
│   └── nginx         # Nginx 网关配置
└── docker-compose.yml
```

## 快速开始

### 1. 环境要求

- Node.js 18+
- npm 9+
- Docker 与 Docker Compose（推荐，用于启动 MySQL 和容器化服务）
- 本地 MySQL 8（如果不使用 Docker）

### 2. 安装依赖

在仓库根目录执行：

```bash
npm install
```

### 3. 配置环境变量

API 默认读取 [apps/api/.env.example](./apps/api/.env.example) 对应的配置。首次启动可复制为 `apps/api/.env`：

```env
PORT=3000
DB_HOST=127.0.0.1
DB_PORT=3307
DB_USER=root
DB_PASS=123456
DB_NAME=yisu_db
```

可选配置：

```env
AMAP_WEB_KEY=你的高德 Web 服务 Key
GEO_PROVIDER_MODE=auto
GEO_TIMEOUT_MS=4500
```

说明：

- Web 端通过 Vite 代理访问 `/api`，默认转发到 `http://localhost:3000`
- 移动端默认请求 `http://localhost:3000`；使用真机调试时，需要把 [apps/mobile/lib/api.ts](./apps/mobile/lib/api.ts) 中的地址改成局域网 IP
- `AMAP_WEB_KEY` 只应保存在服务端，不要暴露到前端

### 4. 启动数据库

推荐直接使用 Docker：

```bash
docker compose up -d mysql
```

默认端口映射为 `127.0.0.1:3306 -> mysql:3306`。如果继续使用仓库内默认 `.env.example`，请把 `DB_PORT` 调整为你本地实际端口；若使用 `docker-compose.yml` 中的 MySQL 服务，API 容器内部使用的是 `3306`。

### 5. 启动开发环境

分别启动：

```bash
npm run dev:web
npm run dev:api
npm run dev:mobile
```

或在根目录并行启动：

```bash
npm run dev
```

启动后默认访问方式：

- Web 管理端：`http://localhost:5173`
- API 健康检查：`http://localhost:3000/api/health`
- 移动端：通过 Expo Dev Tools / 模拟器 / 真机打开

## 常用脚本

| 命令                  | 说明                      |
| --------------------- | ------------------------- |
| `npm run dev`         | 并行启动 Web、API、Mobile |
| `npm run dev:web`     | 启动 Web 管理端           |
| `npm run dev:api`     | 启动 API 服务             |
| `npm run dev:mobile`  | 启动 Expo 开发服务器      |
| `npm test`            | 依次执行三端校验          |
| `npm run test:web`    | 执行 Web 构建校验         |
| `npm run test:api`    | 执行 API 语法检查         |
| `npm run test:mobile` | 执行 Mobile lint          |

## 数据初始化说明

API 启动时会执行 [apps/api/server.js](./apps/api/server.js) 中的数据库初始化逻辑，并加载 [apps/api/sql](./apps/api/sql) 下的建表与种子脚本。

当前行为大致如下：

- 基础表结构与订单、客户相关迁移会按幂等方式执行
- 内置测试账号会被 upsert，便于演示和回归验证
- 酒店示例数据会在数量不足时补齐，不是每次启动都全量覆盖

这意味着开发时可以反复重启 API，而不必每次手动重新造数。

## 默认测试账号

项目内置了若干测试账号，完整列表可通过接口 `GET /api/auth/test-accounts` 查看，也可以直接参考 [apps/api/server.js](./apps/api/server.js) 中的测试账号定义。

常用账号示例：

- 管理员：`admin.ops / Admin#2026!Ops`
- 商户：`m.shanghai / Merchant#2026!SH`
- 演示用户：`user.demo / User#2026!Demo`

## Docker 部署

仓库根目录提供了 [docker-compose.yml](./docker-compose.yml)，可用于启动完整容器化环境：

- `mysql`
- `api`
- `web`
- `mobile-web`
- `gateway`

直接启动：

```bash
docker compose up -d --build
```

Nginx 网关配置位于 [deploy/nginx/gateway.conf](./deploy/nginx/gateway.conf)。
