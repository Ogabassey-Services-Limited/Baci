# Ogabassey ChatGPT MCP Server
FROM node:24-alpine AS deps

WORKDIR /app
RUN corepack enable pnpm

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc ./
COPY apps/web/package.json apps/web/package.json
COPY packages/shared/package.json packages/shared/package.json
COPY patches ./patches
RUN pnpm install --frozen-lockfile --prod

FROM node:24-alpine AS runner

WORKDIR /app/apps/web
ENV NODE_ENV=production
ENV MCP_PORT=8787
RUN corepack enable pnpm

COPY --from=deps /app/node_modules /app/node_modules
COPY --from=deps /app/apps/web/node_modules ./node_modules
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc /app/
COPY apps/web/package.json ./package.json
COPY apps/web/tsconfig.json ./tsconfig.json
COPY apps/web/mcp-server ./mcp-server
COPY apps/web/src ./src
COPY packages/shared /app/packages/shared

EXPOSE 8787

HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:8787/health || exit 1

USER node
CMD ["pnpm", "mcp"]
