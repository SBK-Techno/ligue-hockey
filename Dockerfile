# syntax=docker/dockerfile:1

FROM node:24-bookworm-slim AS native-deps
RUN apt-get update \
    && apt-get install -y --no-install-recommends python3 make g++ \
    && rm -rf /var/lib/apt/lists/*

FROM native-deps AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

FROM node:24-bookworm-slim AS build
WORKDIR /app
# Route analysis imports the auth module; runtime configuration comes from the
# container environment. The app supplies build-only fallbacks in that phase.
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

FROM native-deps AS production-deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev

FROM node:24-bookworm-slim AS runtime
ENV NODE_ENV=production \
    PORT=3000
WORKDIR /app

RUN groupadd --system app \
    && useradd --system --gid app --home-dir /app --shell /usr/sbin/nologin app

COPY --from=production-deps /app/node_modules ./node_modules
COPY --from=build /app/build ./build
COPY --from=build /app/drizzle ./drizzle
COPY --from=build /app/scripts/backup.mjs ./scripts/backup.mjs
COPY docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh
COPY package.json ./

RUN mkdir -p /app/data \
    && chown -R app:app /app \
    && chmod +x /usr/local/bin/docker-entrypoint.sh

EXPOSE 3000
VOLUME ["/app/data"]

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
    CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||3000)+'/api/health').then((response)=>{if(!response.ok)process.exit(1)}).catch(()=>process.exit(1))"

ENTRYPOINT ["/usr/local/bin/docker-entrypoint.sh"]
CMD ["node", "build"]
