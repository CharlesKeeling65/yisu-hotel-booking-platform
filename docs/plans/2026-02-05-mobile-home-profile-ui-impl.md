# Mobile Home Search + Profile UI Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Implement a Ctrip-style mobile Home search card (city/location/date/rooms/adults/children/price-star) with local state and navigation params, plus a login-aware Profile screen styled to the provided reference and palette.

**Architecture:** Keep state local to screens (Option A). Home screen owns search form state and passes params to List. Profile screen toggles between logged-out and logged-in views with placeholder user data. No backend or persistence added.

**Tech Stack:** Expo Router, React Native, TypeScript, NativeWind.

---

### Task 1: Update Home search UI to include all required fields and local state

**Files:**
- Modify: `apps/mobile/app/(tabs)/index.tsx`

**Step 1: Add state for new fields**

```ts
const [city, setCity] = useState("扬州");
const [location, setLocation] = useState("瘦西湖 / 东关街");
const [checkIn, setCheckIn] = useState("02-05");
const [checkOut, setCheckOut] = useState("02-06");
const [rooms, setRooms] = useState(1);
const [adults, setAdults] = useState(1);
const [children, setChildren] = useState(0);
const [priceStar, setPriceStar] = useState("4星 450-800");
```

**Step 2: Replace the existing 3-field card with a multi-row card**

Use rows for `城市`, `位置/商圈`, `时间`, `房间数/成人/儿童`, and a segmented selection for `价格/星级`.

```tsx
<View className="mt-3 rounded-2xl border border-slate-100 bg-slate-50 p-3">
  <Text className="text-[11px] uppercase text-slate-400">城市</Text>
  <TextInput value={city} onChangeText={setCity} className="mt-1 text-base text-slate-900" />
</View>

<View className="mt-3 rounded-2xl border border-slate-100 bg-slate-50 p-3">
  <Text className="text-[11px] uppercase text-slate-400">位置/商圈</Text>
  <TextInput value={location} onChangeText={setLocation} className="mt-1 text-base text-slate-900" />
</View>

<View className="mt-3 flex-row gap-3">
  <Pressable className="flex-1 rounded-2xl border border-slate-100 bg-slate-50 p-3" onPress={() => setCheckIn("02-05")}> 
    <Text className="text-[11px] uppercase text-slate-400">入住</Text>
    <Text className="mt-1 text-base text-slate-900">{checkIn}</Text>
  </Pressable>
  <Pressable className="flex-1 rounded-2xl border border-slate-100 bg-slate-50 p-3" onPress={() => setCheckOut("02-06")}>
    <Text className="text-[11px] uppercase text-slate-400">离店</Text>
    <Text className="mt-1 text-base text-slate-900">{checkOut}</Text>
  </Pressable>
</View>
```

**Step 3: Add stepper rows for 房间数/成人/儿童**

```tsx
const CounterRow = ({ label, value, onAdd, onSub }: { label: string; value: number; onAdd: () => void; onSub: () => void; }) => (
  <View className="flex-row items-center justify-between rounded-2xl border border-slate-100 bg-slate-50 px-3 py-3">
    <Text className="text-sm text-slate-700">{label}</Text>
    <View className="flex-row items-center gap-3">
      <Pressable onPress={onSub} className="h-8 w-8 items-center justify-center rounded-full bg-slate-200">
        <Text className="text-base font-semibold text-slate-700">-</Text>
      </Pressable>
      <Text className="w-6 text-center text-base font-semibold text-slate-900">{value}</Text>
      <Pressable onPress={onAdd} className="h-8 w-8 items-center justify-center rounded-full bg-[#E6F4FF]">
        <Text className="text-base font-semibold text-[#1890FF]">+</Text>
      </Pressable>
    </View>
  </View>
);
```

**Step 4: Add price/star segmented chips using `priceStar` state**

```tsx
const PRICE_STAR_OPTIONS = ["3星 300-450", "4星 450-800", "5星 800+"];

<View className="mt-3">
  <Text className="mb-2 text-[11px] uppercase text-slate-400">价格/星级</Text>
  <View className="flex-row flex-wrap gap-2">
    {PRICE_STAR_OPTIONS.map((option) => {
      const active = option === priceStar;
      return (
        <Pressable
          key={option}
          onPress={() => setPriceStar(option)}
          className={`rounded-full px-3 py-2 ${active ? "bg-[#FFF7E6]" : "bg-[#F5F7FB]"}`}>
          <Text className={`text-xs ${active ? "text-[#FFA940] font-semibold" : "text-slate-600"}`}>{option}</Text>
        </Pressable>
      );
    })}
  </View>
</View>
```

**Step 5: Update query navigation params**

```ts
router.push({
  pathname: "/list",
  params: {
    city,
    location,
    checkIn,
    checkOut,
    rooms: String(rooms),
    adults: String(adults),
    children: String(children),
    priceStar,
  },
});
```

**Step 6: Commit**

```bash
git add apps/mobile/app/(tabs)/index.tsx
git commit -m "feat: expand mobile home search form"
```

---

### Task 2: Update list header summary to show the new search params

**Files:**
- Modify: `apps/mobile/app/list.tsx`

**Step 1: Extend params**

```ts
const { city, location, checkIn, checkOut, rooms, adults, children, priceStar } = useLocalSearchParams<{
  city?: string;
  location?: string;
  checkIn?: string;
  checkOut?: string;
  rooms?: string;
  adults?: string;
  children?: string;
  priceStar?: string;
}>();
```

**Step 2: Render the new summary rows**

```tsx
<Text className="mt-1 text-sm text-neutral-600">{location ?? "选择位置"}</Text>
<Text className="mt-1 text-sm text-neutral-600">
  {(checkIn && checkOut) ? `${checkIn} - ${checkOut}` : "选择日期"}
</Text>
<Text className="mt-1 text-sm text-neutral-600">
  {(rooms && adults) ? `${rooms}间房 ${adults}成人 ${children ?? "0"}儿童` : "选择人数"}
</Text>
<Text className="mt-1 text-sm text-neutral-600">{priceStar ?? "选择价格/星级"}</Text>
```

**Step 3: Commit**

```bash
git add apps/mobile/app/list.tsx
git commit -m "feat: show expanded search summary"
```

---

### Task 3: Implement login-aware Profile UI with placeholder data

**Files:**
- Modify: `apps/mobile/app/(tabs)/profile.tsx`

**Step 1: Replace StyleSheet layout with NativeWind layout + local state**

```ts
const [isLoggedIn, setIsLoggedIn] = useState(false);
const user = {
  name: "旅行达人小易",
  phone: "138****2468",
  city: "上海",
  memberLevel: "黄金会员",
  points: 3280,
};
```

**Step 2: Build logged-out view**

- Hero card with avatar placeholder, login CTA, and benefits chips (优惠/积分/低价)
- Primary button styled with `#1890FF`

**Step 3: Build logged-in view**

- Header card with avatar, name, membership, points
- Quick stats row (订单/收藏/优惠)
- Info list items (手机号、常用城市、账户状态)
- Secondary button to “退出登录” (local toggle only)

**Step 4: Commit**

```bash
git add apps/mobile/app/(tabs)/profile.tsx
git commit -m "feat: redesign profile screen with login states"
```

---

### Task 4: Visual polish and palette alignment

**Files:**
- Modify: `apps/mobile/app/(tabs)/index.tsx`
- Modify: `apps/mobile/app/(tabs)/profile.tsx`

**Step 1: Ensure palette usage**

- Primary CTA: `#1890FF`
- Highlight tags: `#FFA940`
- Background: pure white

**Step 2: Commit**

```bash
git add apps/mobile/app/(tabs)/index.tsx apps/mobile/app/(tabs)/profile.tsx
git commit -m "style: align home/profile palette with spec"
```

---

### Task 5: Verification

**Step 1: Note test status**

- `npm test` is not configured in this repo (missing script). Document this in the execution notes if needed.

---

## Execution Handoff

Plan complete and saved to `docs/plans/2026-02-05-mobile-home-profile-ui-impl.md`. Two execution options:

1. Subagent-Driven (this session) - I dispatch fresh subagent per task, review between tasks, fast iteration
2. Parallel Session (separate) - Open new session with executing-plans, batch execution with checkpoints

Which approach?
