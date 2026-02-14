# Mobile Search Flow Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Implement the Ctrip-style search-first flow with new tabs and a non-tab hotel list, plus SafeArea fixes.

**Architecture:** Keep Expo Router with `(tabs)` for primary nav and move the hotel list to a standalone route. Pass search params from Home to List for summary display; mock data stays unchanged.

**Tech Stack:** Expo Router, React Native, TypeScript, NativeWind.

---

### Task 1: Update Tab Routes and Add Placeholder Screens

**Files:**
- Modify: `apps/mobile/app/(tabs)/_layout.tsx`
- Create: `apps/mobile/app/(tabs)/cart.tsx`
- Create: `apps/mobile/app/(tabs)/reviews.tsx`
- Modify: `apps/mobile/app/(tabs)/profile.tsx`

**Step 1: Update tabs to 查询 / 购物车 / 点评 / 我的**

Edit `_layout.tsx` to use `index`, `cart`, `reviews`, `profile` with new titles and icons.

**Step 2: Create Cart placeholder screen**

Create `cart.tsx` with a simple centered placeholder message.

**Step 3: Create Reviews placeholder screen**

Create `reviews.tsx` with a simple centered placeholder message.

**Step 4: Update Profile placeholder copy**

Update `profile.tsx` to show login/orders placeholder text.

**Step 5: Commit**

```bash
git add apps/mobile/app/(tabs)/_layout.tsx apps/mobile/app/(tabs)/cart.tsx apps/mobile/app/(tabs)/reviews.tsx apps/mobile/app/(tabs)/profile.tsx
git commit -m "feat: update tabs for search flow"
```

---

### Task 2: Move Hotel List to Non-Tab Route and Add Summary

**Files:**
- Move: `apps/mobile/app/(tabs)/list.tsx` -> `apps/mobile/app/list.tsx`
- Modify: `apps/mobile/app/list.tsx`

**Step 1: Move list route out of tabs**

Move the file to `app/list.tsx`.

**Step 2: Read search params and render summary**

Add `useLocalSearchParams()` and render a summary card showing city/date/guests at top of list.

**Step 3: Commit**

```bash
git add apps/mobile/app/list.tsx
git commit -m "feat: make list a standalone route"
```

---

### Task 3: Redesign Home (Search) Screen to Match Reference

**Files:**
- Modify: `apps/mobile/app/(tabs)/index.tsx`

**Step 1: Replace layout with banner + search card + quick actions**

Build the UI to match `.ref_images/携程酒店首页.png`:
- Banner area at top
- Search card with rows for destination/date/guests/price
- Primary "查询" button
- Quick action pills below

**Step 2: Use SafeArea to avoid status bar overlap**

Wrap top area with SafeArea or add top padding via `useSafeAreaInsets()`.

**Step 3: On query button, navigate to `/list` with params**

Use `router.push({ pathname: "/list", params: { city, dates, guests } })`.

**Step 4: Commit**

```bash
git add apps/mobile/app/(tabs)/index.tsx
git commit -m "feat: redesign search home"
```

---

### Task 4: Verify and Adjust Detail/List Safe Areas

**Files:**
- Modify: `apps/mobile/app/list.tsx`
- Modify: `apps/mobile/app/hotel/[id].tsx`

**Step 1: Ensure top content does not overlap status bar**

Add SafeArea padding at top for list and detail pages if needed.

**Step 2: Commit**

```bash
git add apps/mobile/app/list.tsx apps/mobile/app/hotel/[id].tsx
git commit -m "chore: adjust safe area spacing"
```

---

### Task 5: Update README Notes (Optional)

**Files:**
- Modify: `apps/mobile/README.md`

**Step 1: Add note about search flow and list access**

Document that list is accessed via the search button.

**Step 2: Commit**

```bash
git add apps/mobile/README.md
git commit -m "docs: note search-first flow"
```

---

### Task 6: Run Checks (Document Only)

**Step 1: Document run commands**

Do not run, just document expected commands:
- `npm install`
- `npx expo start --ios`

**Step 2: Commit**

```bash
git add apps/mobile/status.md
git commit -m "docs: note run commands"
```
