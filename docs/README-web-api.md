# Web + API + DB (Monorepo)

## MySQL (Docker)
From repo root:
```bash
docker compose up -d
```

## API
```bash
npm --prefix apps/api run dev
```

Smoke test:
```bash
curl http://localhost:3000/api/hotels
```

Mobile API tests:
```bash
curl http://localhost:3000/api/mobile/hotels
curl http://localhost:3000/api/mobile/hotels/1
curl -X POST http://localhost:3000/api/mobile/login -H 'Content-Type: application/json' -d '{"username":"mobile","password":"123456"}'
```

## Web
```bash
npm --prefix apps/web run dev
```

## Mobile (sanity run)
```bash
npm --prefix apps/mobile run start
```
