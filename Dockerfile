# Build front
FROM node:20-alpine AS builder
WORKDIR /app

ARG VITE_SUPABASE_URL
ARG VITE_SUPABASE_ANON_KEY
ARG VITE_AUTH_MODE=cookie
ARG VITE_AUTH_BFF_URL=
ENV VITE_SUPABASE_URL=$VITE_SUPABASE_URL
ENV VITE_SUPABASE_ANON_KEY=$VITE_SUPABASE_ANON_KEY
ENV VITE_AUTH_MODE=$VITE_AUTH_MODE
ENV VITE_AUTH_BFF_URL=$VITE_AUTH_BFF_URL

COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

# Auth BFF deps
FROM node:20-alpine AS server-deps
WORKDIR /app/server
COPY server/package*.json ./
RUN npm install --omit=dev

# Runtime: nginx (static) + node (auth BFF)
FROM nginx:alpine
RUN apk add --no-cache nodejs
COPY --from=builder /app/dist /usr/share/nginx/html
COPY --from=server-deps /app/server/node_modules /app/server/node_modules
COPY server/package.json /app/server/package.json
COPY server/index.js /app/server/index.js
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY docker-entrypoint.sh /docker-entrypoint.sh
RUN chmod +x /docker-entrypoint.sh

ENV AUTH_BFF_PORT=8787
ENV AUTH_COOKIE_SECURE=true
ENV AUTH_COOKIE_SAMESITE=Lax
ENV APP_ORIGIN=*

EXPOSE 80
CMD ["/docker-entrypoint.sh"]
