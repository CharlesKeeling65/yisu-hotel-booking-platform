# Mobile + DB Link Design

**Goal:** Connect mobile hotel list + detail screens to MySQL hotel/room data via new mobile-only API endpoints, and add a mobile login API with a single hardcoded test user (mobile/123456) without impacting existing web APIs.

**Architecture:** Add `/api/mobile/*` endpoints in `apps/api/server.js` that map MySQL `hotels` + `rooms` tables into the mobile app data model. Mobile app replaces mock data fetch with API calls for list/detail and adds a simple login flow in profile screen calling `/api/mobile/login`. No schema changes to avoid impacting web.

**Tech Stack:** Express (Node), MySQL, Expo Router, React Native.

## API Endpoints
- `GET /api/mobile/hotels`
  - Source: `hotels` table + `rooms` table (for priceFrom aggregation)
  - Fields: `id, name, city, rating, address, coverImage, images[], tags[], facilities[], priceFrom`
- `GET /api/mobile/hotels/:id`
  - Source: `hotels` + `rooms`
  - Fields: list fields + `rooms[]` mapped to mobile Room type
- `POST /api/mobile/login`
  - Body: `{ username, password }`
  - Accepts only `mobile/123456`, returns a simple token + user summary.

## Mapping Rules
- `rating`: derived from `hotels.star` (if numeric) else fallback 4.5
- `coverImage`: `hotels.image` or default placeholder
- `images`: `[coverImage]` + placeholders if missing
- `tags`: derived from `roomTypes` / `discounts` (JSON fields) else fallback tags
- `facilities`: derived from `scenicSpots` / `trafficMall` else fallback facilities
- `priceFrom`: min of room `current` if available, else 0
- `rooms[]`: from `rooms` table
  - `name`: room `type`
  - `price`: `current` or `original`
  - `capacity`: default 2
  - `bedType`: infer from `type` (contains King/Queen/Twin/大床/双床) else `Queen`
  - `breakfastIncluded`: false
  - `refundable`: false

## Mobile Changes
- Replace `apps/mobile/data/mockHotels.ts` usage with API calls in:
  - `apps/mobile/app/list.tsx`
  - `apps/mobile/app/hotel/[id].tsx`
- Add login UI + API call in:
  - `apps/mobile/app/(tabs)/profile.tsx`
- Add simple API client helper (URL base) in a new file `apps/mobile/lib/api.ts`.

## Non-Goals
- No DB schema changes
- No changes to existing `/api/*` routes used by web
- No persistent auth / refresh tokens

## Manual Tests (you run)
- `npm --prefix apps/api run dev`
- `curl http://localhost:3000/api/mobile/hotels`
- `curl http://localhost:3000/api/mobile/hotels/1`
- `curl -X POST http://localhost:3000/api/mobile/login -H 'Content-Type: application/json' -d '{"username":"mobile","password":"123456"}'`
- `npm --prefix apps/mobile run start`
