# Mobile Search Flow + Home UI Redesign

Date: 2026-02-05

## Goal
Restructure the mobile app UX so the **search page** is the primary entry point. The **hotel list page is no longer a Tab**, and appears only after the user taps "查询". The Home page should visually reference the Ctrip-style layout (see `.ref_images/携程酒店首页.png`). Bottom tabs are: `查询 / 购物车 / 点评 / 我的`.

## Scope
- Redesign Home (search) page layout to match the reference feel.
- Update tab bar labels and routes.
- Change list page to be a non-tab route and show search summary from params.
- Fix iOS status bar overlap by adding safe area padding and/or removing top title text.

## Non-Goals
- No real filtering or search API integration.
- No persistence or global search state.

## UX Flow
1. User lands on **查询** page (Home).
2. User taps **查询** button.
3. App navigates to **List** page with query params (city/date/guests).
4. User taps a hotel card to enter **Detail** page.

## Information Architecture
### Tabs
- 查询 (Home)
- 购物车
- 点评
- 我的

### Routes
- `(tabs)/index` => 查询页
- `(tabs)/cart` => 购物车占位
- `(tabs)/reviews` => 点评占位
- `(tabs)/profile` => 我的占位
- `list` => 酒店列表页（非 Tab）
- `hotel/[id]` => 酒店详情页

## Layout Plan
### Home (Search)
- **Top Banner**: decorative image/gradient block.
- **Search Card**: a white rounded card with rows for destination/date/guests/price, and primary CTA "查询".
- **Quick Actions**: small pill buttons for quick picks.
- Use SafeArea padding to avoid status bar overlap.

### List
- **Search Summary** at top, showing city/date/guests from params.
- Existing filter bar and hotel cards.
- Mock infinite load footer.

### Detail
- Keep existing carousel, facilities, and room list.

## Data Flow
- Home passes params via `router.push({ pathname: "/list", params: { ... } })`.
- List reads params with `useLocalSearchParams()` and renders summary text.
- Mock data remains static; params do not filter for now.

## Implementation Notes
- Remove large top title text if it overlaps status bar.
- Add `SafeAreaView` or top padding for screens with headers.
- Update `apps/mobile/README.md` if navigation changes require.

## Success Criteria
- `npm install` works and app runs.
- Tabs show `查询 / 购物车 / 点评 / 我的`.
- Hotel list is only accessible from "查询" button.
- iOS status bar no longer overlaps main title.
