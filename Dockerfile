FROM node:22-alpine AS base
WORKDIR /app
RUN corepack enable pnpm

# Install dependencies only when needed
FROM base AS deps
# Check https://github.com/nodejs/docker-node/tree/b4117f9333da4138b03a546ec926ef50a31506c3#nodealpine to understand why libc6-compat might be needed.
RUN apk add --no-cache libc6-compat
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/mobile-admin/package.json apps/mobile-admin/package.json
COPY apps/mobile-storefront/package.json apps/mobile-storefront/package.json
COPY apps/web/package.json apps/web/package.json
COPY packages/shared/package.json packages/shared/package.json
COPY patches ./patches
# Install all dependencies (including dev) for the build stage
RUN pnpm install --frozen-lockfile

# Rebuild the source code only when needed
FROM base AS builder
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# Next.js collects completely anonymous telemetry data about general usage.
# Learn more here: https://nextjs.org/telemetry
# Uncomment the following line in case you want to disable telemetry during the build.
ENV NEXT_TELEMETRY_DISABLED 1
RUN pnpm run build

# Production dependencies stage
FROM base AS prod-deps
RUN apk add --no-cache libc6-compat
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/mobile-admin/package.json apps/mobile-admin/package.json
COPY apps/mobile-storefront/package.json apps/mobile-storefront/package.json
COPY apps/web/package.json apps/web/package.json
COPY packages/shared/package.json packages/shared/package.json
COPY patches ./patches
# Install production dependencies only
RUN pnpm install --frozen-lockfile --prod

# Production image, copy all the files and run next
FROM base AS runner
WORKDIR /app
ENV NODE_ENV production
ENV NEXT_TELEMETRY_DISABLED 1

# Create non-root user for security
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs

COPY --from=builder /app/next.config.ts ./
COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next ./.next
COPY --from=prod-deps /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./package.json

USER nextjs

EXPOSE 3000
# nosemgrep: dockerfile.security.missing-user.missing-user
CMD ["pnpm", "start"]

# Development image
FROM base AS dev
WORKDIR /app
ENV NODE_ENV development
ENV NEXT_TELEMETRY_DISABLED 1

# Create non-root user for security
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs

# Install all dependencies including devDependencies
COPY --from=deps /app/node_modules ./node_modules
COPY --chown=nextjs:nodejs . .

USER nextjs

# nosemgrep: dockerfile.security.missing-user.missing-user
CMD ["pnpm", "run", "dev"]
