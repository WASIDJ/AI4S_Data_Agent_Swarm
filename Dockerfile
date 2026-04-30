FROM node:20-bookworm-slim AS build

WORKDIR /app

# 使用中国 npm 镜像加速安装
RUN npm config set registry https://registry.npmmirror.com

COPY server/package.json server/package-lock.json ./server/
RUN npm ci --prefix server

COPY web/package.json web/package-lock.json ./web/
RUN npm ci --prefix web

COPY server ./server
COPY web ./web

RUN npm run build --prefix server
RUN npm run build --prefix web


FROM node:20-bookworm-slim AS runtime

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3456
ENV HOST=0.0.0.0

COPY --from=build /app/server/dist ./server/dist
COPY --from=build /app/server/node_modules ./server/node_modules
COPY --from=build /app/web/dist ./web/dist

RUN mkdir -p /app/data/events /app/data/logs /workspace

EXPOSE 3456

VOLUME ["/app/data", "/workspace"]

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:3456/api/health').then((res) => { if (!res.ok) process.exit(1); }).catch(() => process.exit(1))"

CMD ["node", "server/dist/index.js"]