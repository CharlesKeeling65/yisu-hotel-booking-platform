FROM node:24-alpine

WORKDIR /app

COPY package*.json ./
RUN npm install --omit=dev --no-audit --no-fund --progress=false \
  --maxsockets=4 --fetch-retries=5 \
  --fetch-retry-mintimeout=20000 --fetch-retry-maxtimeout=120000

COPY server.js ./
COPY sql ./sql

EXPOSE 3000

CMD ["node", "server.js"]
