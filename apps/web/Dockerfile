FROM node:24-alpine AS build

WORKDIR /app

COPY package.json ./
RUN npm install --no-audit --no-fund --progress=false \
  --maxsockets=4 --fetch-retries=5 \
  --fetch-retry-mintimeout=20000 --fetch-retry-maxtimeout=120000

COPY . .
RUN npm run build

FROM nginx:1.27-alpine

RUN apk add --no-cache openssl

COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html
COPY docker-entrypoint-web.sh /docker-entrypoint-web.sh
RUN chmod +x /docker-entrypoint-web.sh

EXPOSE 80
EXPOSE 443

ENTRYPOINT ["/docker-entrypoint-web.sh"]
