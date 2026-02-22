# 易宿开发说明（Monorepo）

## 1. 仓库结构

- `apps/web`：Web 前端（商户端/管理员端，React + Vite）
- `apps/mobile`：移动端（用户端，Expo + React Native）
- `apps/api`：后端接口（Express + MySQL）
- `packages/shared`：共享类型、常量、接口契约
- `docs`：架构与迁移文档

## 2. 本地开发

### 2.1 安装依赖

```bash
npm install
```

### 2.2 启动各端

```bash
npm run dev:web
npm run dev:api
npm run dev:mobile
```

### 2.3 统一测试

```bash
npm test
```

## 3. 测试命令设计

根目录 `npm test` 会串行执行：

- `npm --prefix apps/web run test`
- `npm --prefix apps/api run test`
- `npm --prefix apps/mobile run test`

对应含义：

- Web：`vite build`（保证构建可通过）
- API：`node --check server.js`（保证服务代码语法可通过）
- Mobile：`expo lint`（保证基础代码规范检查可运行）

## 4. 当前完成度与任务清单（按预期 Monorepo 结构）

### 4.1 apps/web

已完成：

- 目录迁移完成并接入 Monorepo
- 登录、管理台、酒店详情、酒店编辑、房型管理、管理员页面等基础页面已落地
- 构建链路可运行

待完成：

- 商户录入与审核闭环联调
- 发布/下线和状态流转完善
- 权限与路由守卫落地
- 页面交互与异常处理细化

### 4.2 apps/mobile

已完成：

- 目录迁移完成并接入 Monorepo
- 首页、列表、详情、定位、个人中心等页面骨架已落地
- 与 `@yisu/shared` 建立依赖关系

待完成：

- 搜索/筛选/排序/分页能力完善
- 下单与订单状态全流程对接 API
- 真机体验、性能与兼容性优化

### 4.3 apps/api

已完成：

- Express + MySQL 服务框架迁移完成
- 初始化 SQL 与样例数据已提供
- 基础酒店/房型/订单能力骨架已具备

待完成：

- RBAC（管理员/商户/用户）权限体系
- 审核、发布、下线完整接口设计与实现
- 统一响应体、错误码、分页排序规范
- 安全增强与接口文档完善

### 4.4 packages/shared

已完成：

- `shared` 工作区和基础导出文件已建立

待完成：

- DTO、Schema（含 Zod）、枚举、错误码、API Client 共建
- 三端共享契约正式落地

### 4.5 docs

已完成：

- 迁移计划与阶段文档已归档
- Web/API 联调说明已补充

待完成：

- 开发/提交流程规范文档
- 权限矩阵、路由图、联调 checklist 补齐

## 5. 数据库与环境变量

`apps/api/.env` 需配置（示例见 `apps/api/.env.example`）：

- `DB_HOST`
- `DB_PORT`
- `DB_USER`
- `DB_PASSWORD`
- `DB_NAME`
- `PORT`

建议流程：

1. 启动本地 MySQL（或使用仓库 `docker-compose.yml`）
2. 执行 `apps/api/sql/init_schema.sql`
3. 按需执行 `apps/api/sql/seed_sample.sql`
4. 再启动 `npm run dev:api` 联调 Web/Mobile

本地部署流程：
1、docker镜像安装，docker安装可参考文档https://blog.csdn.net/weixin_52286364/article/details/150379121
2、本地docker.desktop登录docker后,在项目根目录执行`docker compose up -d`启动mysql数据库
3、创建apps\api\.env文件，参照apps\api\.env.example文件写入数据库信息（直接复制内容粘贴即可）
4、在项目根目录执行`npm install`安装依赖
5、根目录执行`npm run dev`
6、http://localhost:5173/进入商家/管理端，http://localhost:8081进入用户端
