# Mobile + DB Link Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add mobile-only API endpoints for hotels/rooms + login, and wire the mobile app list/detail/profile screens to those endpoints with minimal UI changes.

**Architecture:** Extend `apps/api/server.js` with `/api/mobile/*` routes that map `hotels` and `rooms` tables into the mobile model. Add a small mobile API helper to call these routes, replace mock data usage in list/detail, and add a simple login flow in profile screen. No DB schema changes.

**Tech Stack:** Express, MySQL, Expo Router, React Native.

---

### Task 1: Add mobile API routes (server)

**Files:**
- Modify: `/Users/wyb/File/Work/携程前端训练营/大作业/react_native_test/repo/.worktrees/codex/web-db-merge/apps/api/server.js`

**Step 1: Write a failing manual test (expected 404)**
Run: `curl http://localhost:3000/api/mobile/hotels`
Expected: 404 Not Found.

**Step 2: Implement `/api/mobile/hotels` + `/api/mobile/hotels/:id` + `/api/mobile/login`**
- Add helper mapping functions near top of file.
- Use `hotels` table + `rooms` table to build response.
- For login: if `username==='mobile' && password==='123456'` return `{code:200,data:{token, user}}` else 401.

**Step 3: Run manual test**
Run:
- `curl http://localhost:3000/api/mobile/hotels`
- `curl http://localhost:3000/api/mobile/hotels/1`
- `curl -X POST http://localhost:3000/api/mobile/login -H 'Content-Type: application/json' -d '{"username":"mobile","password":"123456"}'`
Expected: `code:200` responses (if DB has data).

**Step 4: Commit**
```bash
git add /Users/wyb/File/Work/携程前端训练营/大作业/react_native_test/repo/.worktrees/codex/web-db-merge/apps/api/server.js

git commit -m "feat(api): add mobile hotel and login endpoints"
```

---

### Task 2: Add mobile API helper

**Files:**
- Create: `/Users/wyb/File/Work/携程前端训练营/大作业/react_native_test/repo/.worktrees/codex/web-db-merge/apps/mobile/lib/api.ts`

**Step 1: Write a minimal helper**
- `API_BASE_URL` set to `http://localhost:3000`.
- `getJson` wrapper.
- Export `fetchMobileHotels`, `fetchMobileHotelById`, `loginMobile`.

**Step 2: Commit**
```bash
git add /Users/wyb/File/Work/携程前端训练营/大作业/react_native_test/repo/.worktrees/codex/web-db-merge/apps/mobile/lib/api.ts

git commit -m "feat(mobile): add api helper"
```

---

### Task 3: Wire hotel list to API

**Files:**
- Modify: `/Users/wyb/File/Work/携程前端训练营/大作业/react_native_test/repo/.worktrees/codex/web-db-merge/apps/mobile/app/list.tsx`
- Modify: `/Users/wyb/File/Work/携程前端训练营/大作业/react_native_test/repo/.worktrees/codex/web-db-merge/apps/mobile/data/mockHotels.ts` (optional: keep for fallback)

**Step 1: Replace mock data usage**
- Use `useEffect` to call `fetchMobileHotels`.
- Add loading state + fallback empty list.

**Step 2: Commit**
```bash
git add /Users/wyb/File/Work/携程前端训练营/大作业/react_native_test/repo/.worktrees/codex/web-db-merge/apps/mobile/app/list.tsx

git commit -m "feat(mobile): load hotel list from api"
```

---

### Task 4: Wire hotel detail to API

**Files:**
- Modify: `/Users/wyb/File/Work/携程前端训练营/大作业/react_native_test/repo/.worktrees/codex/web-db-merge/apps/mobile/app/hotel/[id].tsx`

**Step 1: Replace mock getHotelById**
- Call `fetchMobileHotelById(id)` in `useEffect`.
- Add loading/empty states.
- Use `rooms` from API for `RoomList`.

**Step 2: Commit**
```bash
git add /Users/wyb/File/Work/携程前端训练营/大作业/react_native_test/repo/.worktrees/codex/web-db-merge/apps/mobile/app/hotel/[id].tsx

git commit -m "feat(mobile): load hotel detail from api"
```

---

### Task 5: Add mobile login flow in profile

**Files:**
- Modify: `/Users/wyb/File/Work/携程前端训练营/大作业/react_native_test/repo/.worktrees/codex/web-db-merge/apps/mobile/app/(tabs)/profile.tsx`

**Step 1: Add simple login form**
- Input fields `username`, `password` (default `mobile`/`123456` for quick test).
- Call `loginMobile` and set `isLoggedIn` + user info.

**Step 2: Commit**
```bash
git add /Users/wyb/File/Work/携程前端训练营/大作业/react_native_test/repo/.worktrees/codex/web-db-merge/apps/mobile/app/(tabs)/profile.tsx

git commit -m "feat(mobile): add login via api"
```

---

### Task 6: Documentation

**Files:**
- Modify: `/Users/wyb/File/Work/携程前端训练营/大作业/react_native_test/repo/.worktrees/codex/web-db-merge/docs/README-web-api.md`

**Step 1: Add mobile API endpoints and login instructions**

**Step 2: Commit**
```bash
git add /Users/wyb/File/Work/携程前端训练营/大作业/react_native_test/repo/.worktrees/codex/web-db-merge/docs/README-web-api.md

git commit -m "docs: add mobile api usage"
```
