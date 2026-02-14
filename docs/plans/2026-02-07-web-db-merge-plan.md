# Web + DB Monorepo Integration Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Integrate `hotel_demo` Web (Vite React) and root `server.js` API + MySQL docker into `react_native_test/repo` monorepo while keeping mobile app working.

**Architecture:** Add `apps/web` (Vite React) and `apps/api` (Express + MySQL, from root `server.js`) to the monorepo. Place MySQL `docker-compose.yml` at repo root. Keep mobile app intact; update root workspace config and scripts to run web/api/dev without breaking mobile.

**Tech Stack:** Node.js, Express, MySQL, Docker Compose, Vite, React, npm workspaces.

---

### Task 1: Snapshot current state and confirm targets

**Files:**
- Read: `/Users/wyb/File/Work/携程前端训练营/大作业/hotel_demo/server.js`
- Read: `/Users/wyb/File/Work/携程前端训练营/大作业/hotel_demo/frontend/**`
- Read: `/Users/wyb/File/Work/携程前端训练营/大作业/hotel_demo/sql/*.sql`
- Read: `/Users/wyb/File/Work/携程前端训练营/大作业/hotel_demo/docker-compose.yml`
- Read: `/Users/wyb/File/Work/携程前端训练营/大作业/react_native_test/repo/apps/mobile/**`

**Step 1: Verify file inventory**
Run: `ls /Users/wyb/File/Work/携程前端训练营/大作业/hotel_demo`
Expected: `frontend`, `server.js`, `sql`, `docker-compose.yml` present.

**Step 2: Verify monorepo apps**
Run: `ls /Users/wyb/File/Work/携程前端训练营/大作业/react_native_test/repo/apps`
Expected: `mobile` present, no `web` or `api` yet.

**Step 3: Commit checkpoint (no changes)**
Run: `git status -sb`
Expected: clean.

---

### Task 2: Create `apps/api` from root `server.js`

**Files:**
- Create: `/Users/wyb/File/Work/携程前端训练营/大作业/react_native_test/repo/apps/api/server.js`
- Create: `/Users/wyb/File/Work/携程前端训练营/大作业/react_native_test/repo/apps/api/package.json`
- Create: `/Users/wyb/File/Work/携程前端训练营/大作业/react_native_test/repo/apps/api/.env.example`
- Create: `/Users/wyb/File/Work/携程前端训练营/大作业/react_native_test/repo/apps/api/README.md`
- Create: `/Users/wyb/File/Work/携程前端训练营/大作业/react_native_test/repo/apps/api/sql/init_schema.sql`
- Create: `/Users/wyb/File/Work/携程前端训练营/大作业/react_native_test/repo/apps/api/sql/seed_sample.sql`
- Create: `/Users/wyb/File/Work/携程前端训练营/大作业/react_native_test/repo/apps/api/data/.gitkeep`

**Step 1: Write a minimal failing smoke test (manual)**
Run: `node /Users/wyb/File/Work/携程前端训练营/大作业/react_native_test/repo/apps/api/server.js`
Expected: fails because file doesn’t exist yet.

**Step 2: Copy root `server.js` into `apps/api`**
Command: `cp /Users/wyb/File/Work/携程前端训练营/大作业/hotel_demo/server.js /Users/wyb/File/Work/携程前端训练营/大作业/react_native_test/repo/apps/api/server.js`

**Step 3: Add API `package.json` with dependencies and scripts**
Contents:
```json
{
  "name": "yisu-api",
  "private": true,
  "version": "1.0.0",
  "main": "server.js",
  "scripts": {
    "dev": "node server.js",
    "start": "node server.js"
  },
  "dependencies": {
    "cors": "^2.8.5",
    "dotenv": "^16.0.3",
    "express": "^4.18.2",
    "multer": "^1.4.4",
    "mysql2": "^3.3.1"
  }
}
```

**Step 4: Add `.env.example` for MySQL**
```ini
PORT=3000
DB_HOST=127.0.0.1
DB_PORT=3306
DB_USER=root
DB_PASS=123456
DB_NAME=yisu_db
```

**Step 5: Copy SQL schema + seed**
Command:
- `cp /Users/wyb/File/Work/携程前端训练营/大作业/hotel_demo/sql/init_schema.sql /Users/wyb/File/Work/携程前端训练营/大作业/react_native_test/repo/apps/api/sql/init_schema.sql`
- `cp /Users/wyb/File/Work/携程前端训练营/大作业/hotel_demo/sql/seed_sample.sql /Users/wyb/File/Work/携程前端训练营/大作业/react_native_test/repo/apps/api/sql/seed_sample.sql`

**Step 6: Add API README with run steps**
Include: how to run MySQL via root docker compose, `npm --prefix apps/api run dev`, API base URL.

**Step 7: Run API (expect DB connection failure until MySQL is up)**
Run: `node /Users/wyb/File/Work/携程前端训练营/大作业/react_native_test/repo/apps/api/server.js`
Expected: fails if MySQL not running. This verifies entrypoint loads.

**Step 8: Commit**
```bash
git add /Users/wyb/File/Work/携程前端训练营/大作业/react_native_test/repo/apps/api

git commit -m "feat(api): add express server and sql schema"
```

---

### Task 3: Create `apps/web` from `hotel_demo/frontend`

**Files:**
- Create: `/Users/wyb/File/Work/携程前端训练营/大作业/react_native_test/repo/apps/web/**`
- Modify: `/Users/wyb/File/Work/携程前端训练营/大作业/react_native_test/repo/apps/web/package.json`
- Create: `/Users/wyb/File/Work/携程前端训练营/大作业/react_native_test/repo/apps/web/README.md`

**Step 1: Copy frontend source**
Command: `cp -R /Users/wyb/File/Work/携程前端训练营/大作业/hotel_demo/frontend /Users/wyb/File/Work/携程前端训练营/大作业/react_native_test/repo/apps/web`

**Step 2: Adjust `apps/web/package.json`**
- Set `name` to `yisu-web`
- Remove `yisu-backend` file dependency
- Keep Vite scripts

**Step 3: Add `apps/web/README.md`**
Include: dev command `npm --prefix apps/web run dev` and API base URL.

**Step 4: Run web dev server (optional)**
Run: `npm --prefix /Users/wyb/File/Work/携程前端训练营/大作业/react_native_test/repo/apps/web run dev`
Expected: Vite starts.

**Step 5: Commit**
```bash
git add /Users/wyb/File/Work/携程前端训练营/大作业/react_native_test/repo/apps/web

git commit -m "feat(web): add vite web app"
```

---

### Task 4: Add MySQL docker compose at monorepo root

**Files:**
- Create: `/Users/wyb/File/Work/携程前端训练营/大作业/react_native_test/repo/docker-compose.yml`

**Step 1: Copy compose file**
Command: `cp /Users/wyb/File/Work/携程前端训练营/大作业/hotel_demo/docker-compose.yml /Users/wyb/File/Work/携程前端训练营/大作业/react_native_test/repo/docker-compose.yml`

**Step 2: Update compose to mount `apps/api/sql`**
Edit compose volume to `./apps/api/sql:/docker-entrypoint-initdb.d:ro`.

**Step 3: Commit**
```bash
git add /Users/wyb/File/Work/携程前端训练营/大作业/react_native_test/repo/docker-compose.yml

git commit -m "chore(db): add mysql docker compose"
```

---

### Task 5: Update monorepo root scripts (optional but recommended)

**Files:**
- Modify: `/Users/wyb/File/Work/携程前端训练营/大作业/react_native_test/repo/package.json`

**Step 1: Add root scripts**
Add:
- `dev:web`: `npm --prefix apps/web run dev`
- `dev:api`: `npm --prefix apps/api run dev`
- `dev:mobile`: existing mobile dev command if any

**Step 2: Commit**
```bash
git add /Users/wyb/File/Work/携程前端训练营/大作业/react_native_test/repo/package.json

git commit -m "chore: add root dev scripts for web/api"
```

---

### Task 6: Verify mobile still runs

**Files:**
- Read: `/Users/wyb/File/Work/携程前端训练营/大作业/react_native_test/repo/apps/mobile/package.json`

**Step 1: Run mobile dev**
Run: `npm --prefix /Users/wyb/File/Work/携程前端训练营/大作业/react_native_test/repo/apps/mobile run dev`
Expected: Expo dev server starts (or documented equivalent).

**Step 2: Commit verification note (optional)**
No code change unless necessary.

---

### Task 7: Update documentation in monorepo

**Files:**
- Modify: `/Users/wyb/File/Work/携程前端训练营/大作业/react_native_test/repo/docs/项目框架设计与合并方案.md` (if present)
- Create: `/Users/wyb/File/Work/携程前端训练营/大作业/react_native_test/repo/docs/README-web-api.md`

**Step 1: Document run steps**
Include: `docker compose up -d`, `npm --prefix apps/api run dev`, `npm --prefix apps/web run dev`.

**Step 2: Commit**
```bash
git add /Users/wyb/File/Work/携程前端训练营/大作业/react_native_test/repo/docs

git commit -m "docs: add web/api run guide"
```

---

### Task 8: Final verification

**Step 1: Lint/format if configured**
Run: `npm --prefix /Users/wyb/File/Work/携程前端训练营/大作业/react_native_test/repo/apps/web run build`
Expected: build completes (optional).

**Step 2: Summarize status**
Confirm apps directories and compose file in place.

---

**Execution order:** Task 1 → Task 2 → Task 3 → Task 4 → Task 5 → Task 6 → Task 7 → Task 8
