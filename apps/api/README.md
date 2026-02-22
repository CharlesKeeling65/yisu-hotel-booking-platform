# API (Express + MySQL)

## Requirements
- Node.js
- Docker (for MySQL)

## Environment
Copy `.env.example` to `.env` and adjust if needed.

## Run MySQL (from repo root)
```bash
docker compose up -d
```

## Run API
```bash
npm --prefix apps/api run dev
```

## Smoke Test
```bash
curl http://localhost:3000/api/hotels
```

Expected: JSON with `code` and `data`.
