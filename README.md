# 易宿酒店预订平台（Monorepo）

本仓库已完成从单仓结构到 Monorepo 的迁移，当前统一目录为：

- `apps/web`：商户端/管理员端 Web（React + Vite）
- `apps/mobile`：用户端 App（Expo + React Native）
- `apps/api`：后端 API（Express + MySQL）
- `packages/shared`：共享类型与常量
- `docs`：方案、计划、说明文档

## 快速开始

```bash
npm install

# 开发启动
npm run dev:web
npm run dev:api
npm run dev:mobile

# 统一测试入口
npm test
```

## 预期 Monorepo 结构完成度（对应《项目框架设计与合并方案.md》）

### 1. apps/web（部分完成）

已完成：
- 已落地到 `apps/web`
- 已具备登录、管理台、酒店详情、酒店编辑、房型管理、管理员页面等前端页面骨架
- 已可执行构建测试（`npm --prefix apps/web run test`）

待完成：
- 商户录入/编辑全流程与后端接口联调
- 审核列表、发布/下线等完整管理流
- 路由权限守卫（管理员/商户）与会话态统一
- 页面级数据校验、错误处理和状态反馈优化

### 2. apps/mobile（部分完成）

已完成：
- 已落地到 `apps/mobile`
- 已搭建首页、列表、详情、定位、个人中心、订单相关页面骨架
- 已接入共享包依赖（`@yisu/shared`）
- 已可执行基础检查（`npm --prefix apps/mobile run test`）

待完成：
- 搜索/筛选/排序与分页（或触底加载）联调
- 与 API 的真实下单、订单状态流转打通
- 定位、日历、房型筛选等核心体验优化
- 真机与多端兼容性回归

### 3. apps/api（部分完成）

已完成：
- 已落地到 `apps/api`
- 已提供 Express 服务、MySQL 连接、初始化 SQL 与示例种子数据
- 已提供酒店/房型/订单等基础接口能力骨架
- 已可执行语法级测试（`npm --prefix apps/api run test`）

待完成：
- `ADMIN` / `MERCHANT` / `CUSTOMER` 的 RBAC 权限体系
- 审核通过/驳回、发布/下线等管理流程接口完善
- 统一响应体、分页排序、错误码体系
- 上传能力、安全策略与接口文档化（Swagger 可选）

### 4. packages/shared（部分完成）

已完成：
- 已建立 `packages/shared` 工作区和基础导出结构

待完成：
- DTO、Zod Schema、错误码、枚举、统一 API Client 的系统化沉淀
- Web/Mobile/API 三端共享契约落地

### 5. docs 与工程规范（部分完成）

已完成：
- 迁移计划与阶段性实施文档已整理到 `docs/plans`
- Web/API 联调说明已补充到 `docs/README-web-api.md`

待完成：
- Monorepo 开发规范、分支与提交流程文档化
- 角色权限矩阵与路由结构图持续补齐

## 测试说明

当前 `npm test` 执行以下任务：

- `test:web`：执行 `vite build`，验证 Web 可构建
- `test:api`：执行 `node --check server.js`，验证 API 语法可通过
- `test:mobile`：执行 `expo lint`，进行移动端代码规范检查

说明：
- API 的数据库连接可用性依赖本地 MySQL 与 `.env` 配置，语法测试不覆盖数据库连通性。
