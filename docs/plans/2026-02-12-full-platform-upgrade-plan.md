# 全链路酒店平台升级 Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 完成数据库结构、管理端、审核发布、用户端搜索列表详情的全链路优化并补齐文档。

**Architecture:** 以 `apps/api/server.js` 统一承载鉴权、酒店审核发布与用户查询接口；Web 端承担商家与管理员后台；Mobile 端承载用户搜索、列表、详情链路。数据库通过 `init_schema.sql` + `seed_sample.sql` 完成字段补齐与样例初始化。

**Tech Stack:** Express + MySQL2 + React + Vite + Expo Router + NativeWind

### Task 1: 数据结构与种子数据

**Files:**
- Modify: `apps/api/sql/init_schema.sql`
- Modify: `apps/api/sql/seed_sample.sql`
- Create: `过程性文档/表结构_优化整合版.md`
- Create: `过程性文档/测试账号清单.md`

### Task 2: API 鉴权与业务接口

**Files:**
- Modify: `apps/api/server.js`

### Task 3: Web 登录注册 + 商家/管理员后台

**Files:**
- Modify: `apps/web/src/App.jsx`
- Modify: `apps/web/src/pages/Login.jsx`
- Create: `apps/web/src/pages/Register.jsx`
- Modify: `apps/web/src/pages/Dashboard.jsx`
- Modify: `apps/web/src/pages/HotelEdit.jsx`
- Modify: `apps/web/src/pages/HotelRooms.jsx`
- Modify: `apps/web/src/pages/HotelDetail.jsx`
- Modify: `apps/web/src/styles/login.css`
- Modify: `apps/web/src/styles/dashboard.css`
- Modify: `apps/web/src/styles/hotel-edit.css`
- Modify: `apps/web/src/styles/hotel-detail.css`
- Modify: `apps/web/src/styles/hotel-rooms.css`

### Task 4: 移动端首页/列表/详情优化

**Files:**
- Modify: `apps/mobile/lib/api.ts`
- Modify: `apps/mobile/app/(tabs)/index.tsx`
- Modify: `apps/mobile/app/list.tsx`
- Modify: `apps/mobile/app/hotel/[id].tsx`
- Modify: `apps/mobile/components/hotel/HotelCard.tsx`
- Modify: `apps/mobile/components/hotel/HotelFilters.tsx`
- Modify: `packages/shared/src/index.ts`

### Task 5: 验证

**Files:**
- Verify build/test scripts for API/Web/Mobile
