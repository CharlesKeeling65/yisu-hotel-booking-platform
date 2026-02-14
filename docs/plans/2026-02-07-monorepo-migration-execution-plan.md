# Monorepo 迁移执行计划 Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 将 `react_native_test/repo` 已调通的 Monorepo 完整迁移到 `yisu-hotel-booking-platform`，并保持 Web/Mobile/API/数据库链路可运行。

**Architecture:** 以 `apps/* + packages/*` 作为统一目录结构，优先迁移已验证可运行的代码，再清理旧单仓残留，最后执行多端最小可运行验证。提交按“基础框架 → 业务应用 → 清理与文档”分段，保证回滚粒度清晰。

**Tech Stack:** Node.js, npm workspaces, React(Vite), Expo React Native, Express + MySQL, TypeScript。

### Task 1: 基线审计与迁移边界确定

**Files:**
- Read: `../项目框架设计与合并方案.md`
- Read: `react_native_test/repo/*`
- Read: `yisu-hotel-booking-platform/*`

**Step 1: 读取方案与目录**
Run: `sed -n '1,240p' ../项目框架设计与合并方案.md`
Expected: 明确预期 Monorepo 目录。

**Step 2: 读取两个仓库 git 状态**
Run: `git -C react_native_test/repo status --short --branch && git -C yisu-hotel-booking-platform status --short --branch`
Expected: 两仓库基线清晰。

**Step 3: 迁移边界定义**
Run: `git -C react_native_test/repo ls-files`
Expected: 获取“已追踪且已调通”的文件清单。

### Task 2: 根目录与工作区框架迁移

**Files:**
- Create/Modify: `package.json`, `package-lock.json`, `tsconfig.json`, `.gitignore`, `README.md`, `docker-compose.yml`
- Create: `docs/README-web-api.md`

**Step 1: 同步 Monorepo 根配置**
Run: `rsync` 从 `react_native_test/repo` 同步根配置文件到主仓库。
Expected: 主仓库具备 workspaces 基线。

**Step 2: 提交根结构迁移**
Run: `git add ... && git commit -m "[feat]: 完成Monorepo根目录与工作区配置迁移"`
Expected: 第一阶段可回滚点。

### Task 3: 迁移 Web 与 API

**Files:**
- Create: `apps/web/**`, `apps/api/**`

**Step 1: 同步 Web 与 API 应用目录**
Run: `rsync` 目录同步。
Expected: Web/API 文件完整进入主仓库。

**Step 2: 提交 Web/API 迁移**
Run: `git add apps/web apps/api && git commit -m "[feat]: 迁移Web端与API服务到Monorepo应用目录"`
Expected: 第二阶段可回滚点。

### Task 4: 迁移 Mobile 与 shared

**Files:**
- Create: `apps/mobile/**`, `packages/shared/**`

**Step 1: 同步移动端与共享包**
Run: `rsync` 目录同步。
Expected: 移动端页面与 shared 类型包就位。

**Step 2: 提交 Mobile/shared 迁移**
Run: `git add apps/mobile packages/shared && git commit -m "[feat]: 迁移移动端应用与共享包结构"`
Expected: 第三阶段可回滚点。

### Task 5: 清理旧单仓残留并补文档

**Files:**
- Delete: `app/**`, `lib/**`, `prisma/**`, `styles/**`, `next.config.js`, `postcss.config.cjs`, `tailwind.config.js`, `next-env.d.ts`, `tsconfig.tsbuildinfo`
- Modify: `docs/plans/2026-02-07-monorepo-migration-execution-plan.md`

**Step 1: 删除与 Monorepo 冲突的旧结构**
Run: `rm -rf` 删除旧 Next.js 单仓目录。
Expected: 仓库目录与方案一致。

**Step 2: 提交清理与计划文档**
Run: `git add -A && git commit -m "[feat]: 清理旧单仓结构并完成Monorepo迁移收口"`
Expected: 迁移收口提交完成。

### Task 6: 可运行性验证

**Files:**
- Verify only

**Step 1: 安装并检查根工作区**
Run: `npm install`
Expected: workspaces 依赖可解析。

**Step 2: API 启动校验**
Run: `npm run api --workspace=apps/api`
Expected: API 服务启动（需本地 MySQL 可用）。

**Step 3: Web 启动校验**
Run: `npm run dev --workspace=apps/web`
Expected: Vite 启动成功。

**Step 4: Mobile 启动校验**
Run: `npm run dev --workspace=apps/mobile`
Expected: Expo 启动成功。

**Step 5: 总结风险**
Expected: 记录环境依赖（MySQL、Expo CLI、端口占用）与后续建议。
