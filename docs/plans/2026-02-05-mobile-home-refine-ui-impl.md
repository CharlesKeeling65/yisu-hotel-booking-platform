# Mobile Home Refinements + Profile Safe Area Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Refine the mobile Home search card layout and date selection (with nights count), adjust quick tag behavior, remove discount badge, and fix Profile safe-area overlap.

**Architecture:** Keep state local on Home/Profile. Use a modal-based calendar component (`react-native-calendars`) for date selection. Compute nights based on selected check-in/check-out. Quick tags trigger navigation with merged defaults. Add SafeArea top padding to Profile like Home.

**Tech Stack:** Expo Router, React Native, TypeScript, NativeWind, react-native-calendars.

---

### Task 1: Add SafeArea top padding to Profile to avoid status bar overlap

**Files:**
- Modify: `apps/mobile/app/(tabs)/profile.tsx`

**Step 1: Add `useSafeAreaInsets` and apply top padding**

```ts
import { useSafeAreaInsets } from "react-native-safe-area-context";

const insets = useSafeAreaInsets();

<ScrollView
  className="flex-1 bg-white"
  contentContainerClassName="px-4 pb-24"
  contentContainerStyle={{ paddingTop: insets.top + 12 }}
>
```

**Step 2: Commit**

```bash
git add apps/mobile/app/(tabs)/profile.tsx
git commit -m "fix: add safe area padding to profile"
```

---

### Task 2: Install calendar library and wire date selection modal

**Files:**
- Modify: `apps/mobile/package.json`
- Modify: `apps/mobile/app/(tabs)/index.tsx`

**Step 1: Add dependency**

```json
"react-native-calendars": "^1.1316.0"
```

**Step 2: Install**

```bash
npm install
```

**Step 3: Add calendar modal**

```tsx
const [isCalendarOpen, setIsCalendarOpen] = useState(false);
const [checkInDate, setCheckInDate] = useState("2026-02-05");
const [checkOutDate, setCheckOutDate] = useState("2026-02-06");

const nights = Math.max(1, differenceInCalendarDays(new Date(checkOutDate), new Date(checkInDate)));
```

Use `Calendar` with `markedDates` to show start/end and range. On date press:
- If no start or selecting new start: set `checkInDate`.
- If start exists and date after start: set `checkOutDate`.
- Otherwise reset start to new date.

**Step 4: Commit**

```bash
git add apps/mobile/package.json apps/mobile/app/(tabs)/index.tsx
git commit -m "feat: add calendar modal for date selection"
```

---

### Task 3: Compress Home layout rows per new requirements

**Files:**
- Modify: `apps/mobile/app/(tabs)/index.tsx`

**Step 1: Merge city + location fields into one row**

- City as a dropdown-styled pressable (left)
- Divider `|`
- Location input placeholder text in light gray: “位置/商圈/酒店”
- Both pressables navigate to a placeholder location picker screen (for now use `router.push("/location")` or a modal stub)

**Step 2: Combine rooms/adults/children + star dropdown into one row**

- Left: small counter group (房间数/成人/儿童) as compact steppers
- Right: star dropdown (Pressable showing selection, with chevron icon)

**Step 3: Replace star chips with dropdown**

- Remove `PRICE_STAR_OPTIONS` chips
- Add a modal or action sheet style list for star options

**Step 4: Remove discount badge**

- Delete “8折优惠” pill entirely

**Step 5: Commit**

```bash
git add apps/mobile/app/(tabs)/index.tsx
git commit -m "feat: compress home search layout and star dropdown"
```

---

### Task 4: Add quick tag behavior to jump to list

**Files:**
- Modify: `apps/mobile/app/(tabs)/index.tsx`

**Step 1: Make tags clickable**

- On press, set `location` to tag text (or append)
- Immediately navigate to `/list` with defaults and the tag value

**Step 2: Commit**

```bash
git add apps/mobile/app/(tabs)/index.tsx
git commit -m "feat: make quick tags jump to list"
```

---

### Task 5: Update list summary to include nights count

**Files:**
- Modify: `apps/mobile/app/list.tsx`

**Step 1: Add nights in summary**

Compute from params and show: “02-05 - 02-06 · 共1晚”

**Step 2: Commit**

```bash
git add apps/mobile/app/list.tsx
git commit -m "feat: show nights count in summary"
```

---

### Task 6: Verification

**Step 1: Manual check**

- Run `npm run ios` (or `npx expo start`) and tap through date selection, tag jump, and profile safe area.

---

## Execution Handoff

Plan complete and saved to `docs/plans/2026-02-05-mobile-home-refine-ui-impl.md`. Two execution options:

1. Subagent-Driven (this session) - I dispatch fresh subagent per task, review between tasks, fast iteration
2. Parallel Session (separate) - Open new session with executing-plans, batch execution with checkpoints

Which approach?
