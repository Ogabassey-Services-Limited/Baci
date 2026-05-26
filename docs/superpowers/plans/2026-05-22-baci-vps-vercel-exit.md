# Baci VPS Vercel Exit Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move Baci web hosting, custom-domain activation, routing cache, and deployment from Vercel to the existing VPS while preserving Go54 domain purchase, Paystack payments, Supabase data, SEO routes, workers, and rollback safety.

**Architecture:** Keep Supabase, Go54, Paystack, Cloudflare, and existing VPS worker services. Replace Vercel as the web runtime with a self-hosted Next.js standalone server behind nginx on the VPS, then replace Vercel domain APIs and Edge Config with Baci-owned provider abstractions backed by Supabase plus process cache. Cut production DNS only after a staging VPS host passes storefront, dashboard, checkout, webhook, SEO, and domain-routing smoke gates.

**Tech Stack:** Next.js 16 App Router, TypeScript, pnpm/Turborepo, GitHub Actions self-hosted runner, nginx, systemd, Certbot or Cloudflare Origin Certificates, Supabase Postgres, Go54 Domain Reseller API, Paystack, Vitest.

---

## Context And Constraints

- The VPS is already suitable for the first low-traffic Baci web origin: Ubuntu 24.04, 4 vCPU, about 15 GiB RAM, about 99 GiB free disk, Node 24, pnpm 10, nginx, Docker, Certbot.
- The VPS already runs Baci/Ogabassey adjacent services:
  - `baci-workers` cron jobs
  - `baci-cdn-transformer.service`
  - GitHub Actions runners including `baci-deploy` and `baci-android`
  - `ogabassey-mcp`
- Current production deploy is still Vercel:
  - `.github/workflows/deploy.yml` runs `vercel pull`, `vercel build`, and `vercel deploy --prebuilt --prod`.
- Do not validate this project with ad hoc `vercel build` while implementing the VPS path. The target build path is a standard Next.js self-hosted build with a deployable VPS artifact.
- Domain purchase is already off Vercel:
  - `apps/web/src/app/api/domains/purchase/route.ts` uses Go54 via `registerDomain`.
  - `apps/web/src/app/api/domains/check-availability/route.ts` uses Go54 lookup.
  - `apps/web/src/app/api/domains/[domain]/dns/route.ts`, `email-forwarding`, and `id-protection` use Go54.
- Domain activation for bring-your-own domains is still Vercel:
  - `apps/web/src/app/api/domains/route.ts` calls `vercel.addDomain()`.
  - `apps/web/src/app/api/domains/[domain]/verify/route.ts` calls `vercel.verifyDomain()`.
  - `apps/web/src/app/api/domains/[domain]/route.ts` calls `vercel.removeDomain()`.
  - Current DNS instructions tell merchants to point A records at `76.76.21.21`.
- Do not modify `apps/web/src/proxy.ts` unless a later explicit approval is given. This plan preserves the proxy contract and changes the host/runtime around it.
- Do not edit existing Supabase migrations. Any DB changes are append-only.
- Current VPS port posture after the Awoof hardening pass:
  - Awoof `3000`, `5001`, and Postgres `5432` are now Docker-published on `127.0.0.1` only.
  - `8443` is nginx for the authenticated Ollama endpoint, and `5061`/SIP plus UDP media ports appear intentional. Do not close these blindly; verify owners and access controls before cutover.
  - Baci web must use a new loopback port such as `127.0.0.1:3100`; do not reuse Awoof's `3000`.

## PR Strategy

Use five PRs. Each PR should be independently reviewable and deployable.

1. **PR 1: Self-hosted web artifact and staging VPS service**
   - Adds a self-hosted Next build mode, release bundle script, systemd template, nginx staging template, and staging smoke checks.
   - Does not change production DNS.

2. **PR 2: Vercel runtime cleanup and neutral observability**
   - Gates or removes Vercel Analytics, Speed Insights, OTel, and Vercel cache commands from the self-hosted path.
   - Keeps Vercel production deploy working until PR 5.

3. **PR 3: Domain hosting provider abstraction**
   - Replaces direct `lib/vercel` domain add/verify/remove calls with `lib/domain-hosting/*`.
   - Keeps Go54 purchase intact.
   - Changes BYOD instructions from Vercel DNS to Baci/Cloudflare/VPS DNS.
   - Does not cut merchant custom domains until DNS verification and SSL coverage are real, not inferred.

4. **PR 4: Edge Config removal**
   - Replaces Vercel Edge Config as the primary domain-routing cache.
   - Uses Supabase plus process cache first. Redis can be added in a later optimization PR after the VPS cutover is stable.

5. **PR 5: Production cutover workflow**
   - Replaces Vercel production deployment workflow with VPS deployment.
   - Adds rollback to the previous VPS release.
   - Cuts `usebaci.com` and approved merchant domains after smoke tests pass.

---

## File Structure

### PR 1 Files

- Modify: `apps/web/next.config.ts`
  - Add feature-flagged `output: 'standalone'` for self-hosted builds only.
  - Add self-hosted `outputFileTracingRoot` at the monorepo root so workspace packages such as `packages/shared` are included in the standalone artifact.
- Create: `scripts/vps/build-web-standalone.sh`
  - Builds `@baci/web` with `BACI_SELF_HOSTED_STANDALONE=1`.
- Create: `scripts/vps/package-web-release.sh`
  - Packages `apps/web/.next/standalone`, static assets, and public assets into a tarball.
- Modify: `.gitignore`
  - Keep one-off `/scripts/*` ignored while allowing tracked `scripts/vps/**` deployment scripts.
- Create: `scripts/vps/install-web-release.sh`
  - Installs a release into `/home/bassey/baci-web/releases/baci-web-release-$BUILD_ID` and updates `/home/bassey/baci-web/current`.
- Create: `infra/web/baci-web.service`
  - systemd unit template for the Next standalone server.
- Create: `infra/web/nginx/baci-web-staging.conf`
  - nginx server block template for `vps.usebaci.com`.
- Create: `scripts/vps/smoke-web-origin.mjs`
  - HTTP smoke checker for staging/production origins.
- Create: `scripts/vps/README.md`
  - Operator runbook for first-time VPS setup and rollback.

### PR 2 Files

- Modify: `apps/web/src/instrumentation.ts`
  - Register Vercel OTel only on Vercel.
- Modify: `apps/web/src/components/analytics/deferred-platform-insights.tsx`
  - Render Vercel Analytics/Speed Insights only when enabled.
- Modify: `.github/workflows/deploy.yml`
  - Keep Vercel deploy for now, but skip Vercel cache purge commands in self-hosted smoke mode.
- Create: `apps/web/src/lib/runtime-platform.ts`
  - Centralized runtime-platform helpers.
- Create: `apps/web/src/lib/runtime-platform.test.ts`
  - Tests for Vercel vs self-hosted platform detection.

### PR 3 Files

- Create: `apps/web/src/lib/domain-hosting/types.ts`
  - Provider-neutral domain add/verify/remove result types.
- Create: `apps/web/src/lib/domain-hosting/vps-provider.ts`
  - VPS/Cloudflare-compatible provider behavior.
- Create: `apps/web/src/lib/domain-hosting/index.ts`
  - Selects provider with `DOMAIN_HOSTING_PROVIDER`.
- Create: `apps/web/src/lib/domain-hosting/vps-provider.test.ts`
  - Tests DNS instruction and verification logic.
- Modify: `apps/web/src/app/api/domains/route.ts`
  - Replace `vercel.addDomain()` with `domainHosting.addDomain()`.
- Modify: `apps/web/src/app/api/domains/[domain]/verify/route.ts`
  - Replace `vercel.verifyDomain()` with `domainHosting.verifyDomain()`.
- Modify: `apps/web/src/app/api/domains/[domain]/route.ts`
  - Replace best-effort `vercel.removeDomain()` with `domainHosting.removeDomain()`.
- Modify: `apps/web/src/app/api/domains/purchase/route.ts`
  - Stop marking purchased domains `status: active` / `ssl_status: active` until DNS routing and SSL status are confirmed by the hosting provider or Go54 DNS provisioning.
- Modify tests under `apps/web/src/app/api/domains/**`
  - Replace Vercel assertions with provider-neutral assertions.

### PR 4 Files

- Modify: `apps/web/src/lib/domain-cache-simple.ts`
  - Prefer DB/process cache or Redis over Vercel Edge Config.
- Create: `apps/web/src/lib/domain-routing-cache.ts`
  - Shared lookup/update cache for slug-to-domain and domain-to-slug.
- Create: `apps/web/src/lib/domain-routing-cache.test.ts`
  - Unit tests for cache hit, miss, stale refresh, and reverse lookup.
- Modify: `apps/web/src/app/api/edge-config/sync/route.ts`
  - Replace Vercel Edge Config updates with Baci routing-cache warm/sync semantics, or rename in PR 5 after clients are updated.
- Modify: `apps/web/src/lib/edge-config-sync.ts`
  - Keep function name for compatibility in the first pass, but route it to the new Baci routing sync.
- Modify related tests:
  - `apps/web/src/lib/edge-config-sync.test.ts`
  - `apps/web/src/app/api/edge-config/sync/route.test.ts`

### PR 5 Files

- Modify: `.github/workflows/deploy.yml`
  - Replace Vercel production deployment with VPS artifact upload/install/restart.
- Create: `.github/workflows/vps-web-smoke.yml`
  - Manual and post-deploy smoke workflow for the VPS web origin.
- Create: `.github/scripts/vps-web-deploy.sh`
  - Calls the build/package/install scripts from the self-hosted runner.
- Modify: `vercel.json`
  - Leave a final archival note or remove after production is no longer deployed through Vercel.
- Modify: `apps/web/src/config/platform.ts`
  - Stop using `VERCEL_URL` as production fallback.
- Modify: `docs/deployment/vps-web-cutover.md`
  - DNS, rollback, smoke gates, and known operational checks.

---

## PR 1: Self-Hosted Web Artifact And Staging VPS Service

### Task 1: Add Feature-Flagged Standalone Output

**Files:**
- Modify: `apps/web/next.config.ts`

- [ ] **Step 1: Write the failing test**

Create a targeted config test if the repo has an established Next config test harness. If no harness exists, add this lightweight test:

```ts
// apps/web/next.config.test.ts
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it, vi } from 'vitest';

const appDir = path.dirname(fileURLToPath(import.meta.url));

describe('next config self-hosted output', () => {
  it('enables standalone output only for self-hosted builds', async () => {
    vi.stubEnv('BACI_SELF_HOSTED_STANDALONE', '1');
    vi.resetModules();

    const configModule = await import('./next.config');
    const config = configModule.default;

    expect(config).toMatchObject({ output: 'standalone' });
    expect(config.outputFileTracingRoot).toBe(path.join(appDir, '../..'));
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
pnpm --filter @baci/web exec vitest run next.config.test.ts
```

Expected: FAIL because `output` is not set from `BACI_SELF_HOSTED_STANDALONE`.

- [ ] **Step 3: Add the minimal implementation**

In `apps/web/next.config.ts`, add a constant above `nextConfig`:

```ts
const selfHostedStandalone = process.env.BACI_SELF_HOSTED_STANDALONE === '1';
const monorepoRoot = path.join(__dirname, '../..');
```

Then add this property near the top of `nextConfig`:

```ts
  ...(selfHostedStandalone
    ? {
        output: 'standalone' as const,
        outputFileTracingRoot: monorepoRoot,
      }
    : {}),
```

Because this app is in a pnpm monorepo and imports workspace code from outside `apps/web`, the self-hosted build must trace from the repository root. With that setting, the generated standalone server lives at `apps/web/.next/standalone/apps/web/server.js`, not `apps/web/.next/standalone/server.js`.

- [ ] **Step 4: Run test to verify it passes**

Run:

```bash
pnpm --filter @baci/web exec vitest run next.config.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/web/next.config.ts apps/web/next.config.test.ts
git commit -m "feat: add self-hosted standalone build mode"
```

### Task 2: Add Build And Package Scripts

**Files:**
- Modify: `.gitignore`
- Create: `scripts/vps/build-web-standalone.sh`
- Create: `scripts/vps/package-web-release.sh`

- [ ] **Step 1: Allow tracked VPS scripts**

Change `.gitignore` so one-off scripts stay ignored, but `scripts/vps/**` can be committed:

```gitignore
# Scripts directory (one-off scripts)
/scripts/*
!/scripts/vps/
!/scripts/vps/**
```

- [ ] **Step 2: Create build script**

```bash
#!/usr/bin/env bash
set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$repo_root"

export NODE_ENV=production
export NEXT_TELEMETRY_DISABLED=1
export BACI_SELF_HOSTED_STANDALONE=1

pnpm install --frozen-lockfile
pnpm turbo build --filter=@baci/web

test -f apps/web/.next/standalone/apps/web/server.js
test -d apps/web/.next/static
```

- [ ] **Step 3: Create package script**

```bash
#!/usr/bin/env bash
set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$repo_root"

build_id="$(cat apps/web/.next/BUILD_ID)"
release_dir="${RUNNER_TEMP:-/tmp}/baci-web-release-$build_id"
artifact="${repo_root}/baci-web-release-$build_id.tgz"

rm -rf "$release_dir" "$artifact"
mkdir -p "$release_dir/apps/web/.next" "$release_dir/apps/web/public"

cp -R apps/web/.next/standalone/. "$release_dir/"
cp -R apps/web/.next/static "$release_dir/apps/web/.next/static"
cp -R apps/web/public/. "$release_dir/apps/web/public/"
if [ -f scripts/vps/smoke-web-origin.mjs ]; then
  mkdir -p "$release_dir/scripts/vps"
  cp scripts/vps/smoke-web-origin.mjs "$release_dir/scripts/vps/smoke-web-origin.mjs"
fi

# Next standalone may copy loaded .env files. Runtime secrets must come from
# /home/bassey/baci-web/.env on the VPS, never from release artifacts.
find "$release_dir" -type f \( -name '.env' -o -name '.env.*' \) -delete

test -f "$release_dir/apps/web/server.js"
test -d "$release_dir/apps/web/.next/static"
test -d "$release_dir/apps/web/public"

tar -C "$release_dir" -czf "$artifact" .
echo "$artifact"
```

- [ ] **Step 4: Make scripts executable**

Run:

```bash
chmod +x scripts/vps/build-web-standalone.sh scripts/vps/package-web-release.sh
```

- [ ] **Step 5: Run the scripts locally or on the VPS runner**

Run:

```bash
scripts/vps/build-web-standalone.sh
scripts/vps/package-web-release.sh
```

Expected:
- `apps/web/.next/standalone/apps/web/server.js` exists.
- A release tarball named with the current `apps/web/.next/BUILD_ID` is printed.

- [ ] **Step 6: Commit**

```bash
git add .gitignore scripts/vps/build-web-standalone.sh scripts/vps/package-web-release.sh
git commit -m "feat: package baci web for vps"
```

### Task 3: Add VPS Install Script And Runtime Units

**Files:**
- Create: `scripts/vps/install-web-release.sh`
- Create: `infra/web/baci-web.service`
- Create: `infra/web/nginx/baci-web-staging.conf`
- Create: `scripts/vps/README.md`

- [ ] **Step 1: Create install script**

```bash
#!/usr/bin/env bash
set -euo pipefail

artifact="${1:?Usage: install-web-release.sh ARTIFACT_TGZ}"
app_root="${BACI_WEB_ROOT:-/home/bassey/baci-web}"
release_name="$(basename "$artifact" .tgz)"
release_dir="$app_root/releases/$release_name"

mkdir -p "$app_root/releases"
rm -rf "$release_dir"
mkdir -p "$release_dir"
tar -xzf "$artifact" -C "$release_dir"

test -f "$release_dir/apps/web/server.js"
ln -sfn "$release_dir" "$app_root/current"

echo "Installed $release_dir"
```

- [ ] **Step 2: Create systemd unit template**

```ini
[Unit]
Description=Baci Web Next.js standalone server
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
User=bassey
WorkingDirectory=/home/bassey/baci-web/current/apps/web
Environment=NODE_ENV=production
Environment=NEXT_TELEMETRY_DISABLED=1
Environment=PORT=3100
Environment=HOSTNAME=127.0.0.1
EnvironmentFile=/home/bassey/baci-web/.env
ExecStart=/usr/bin/node /home/bassey/baci-web/current/apps/web/server.js
Restart=always
RestartSec=5
NoNewPrivileges=true
PrivateTmp=true
LimitNOFILE=65535

[Install]
WantedBy=multi-user.target
```

- [ ] **Step 3: Create nginx staging template**

```nginx
server {
  listen 80;
  listen [::]:80;
  server_name vps.usebaci.com;

  location /.well-known/acme-challenge/ {
    root /var/www/html;
  }

  location / {
    return 301 https://$host$request_uri;
  }
}

server {
  listen 443 ssl;
  listen [::]:443 ssl;
  http2 on;
  server_name vps.usebaci.com;

  ssl_certificate /etc/letsencrypt/live/vps.usebaci.com/fullchain.pem;
  ssl_certificate_key /etc/letsencrypt/live/vps.usebaci.com/privkey.pem;

  client_max_body_size 25m;

  location / {
    proxy_pass http://127.0.0.1:3100;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header X-Forwarded-Host $host;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";
  }
}
```

- [ ] **Step 4: Create README operator commands**

Include these commands in `scripts/vps/README.md`:

```markdown
# Baci Web VPS Runtime

First-time setup requires sudo on the VPS.

1. Create the runtime directories and env file before enabling systemd:
   `sudo install -d -o bassey -g bassey /home/bassey/baci-web/releases /home/bassey/baci-web/tmp`
   `sudo install -m 0600 -o bassey -g bassey /dev/null /home/bassey/baci-web/.env`
   Populate `/home/bassey/baci-web/.env` from the deployment secret store. At minimum it must include the production web env, `BACI_RUNTIME_PLATFORM=vps`, `HOSTNAME=127.0.0.1`, `PORT=3100`, `NEXT_PUBLIC_SITE_URL=https://usebaci.com`, `NEXT_PUBLIC_APP_URL=https://usebaci.com`, and the same `CRON_SECRET` used by `vps-workers`.

2. Copy service template:
   `sudo cp infra/web/baci-web.service /etc/systemd/system/baci-web.service`

3. Issue the certificate before enabling the SSL site, so nginx does not reference missing certificate files:
   `sudo certbot certonly --webroot -w /var/www/html -d vps.usebaci.com`

4. Copy nginx staging config:
   `sudo cp infra/web/nginx/baci-web-staging.conf /etc/nginx/sites-available/baci-web-staging`

5. Enable nginx site:
   `sudo ln -sfn /etc/nginx/sites-available/baci-web-staging /etc/nginx/sites-enabled/baci-web-staging`
   `sudo nginx -t && sudo systemctl reload nginx`

6. Start service:
   `sudo systemctl daemon-reload && sudo systemctl enable --now baci-web.service`

7. Allow the self-hosted deploy runner to restart only this service without an interactive password:
   `printf 'bassey ALL=(root) NOPASSWD: /usr/bin/systemctl restart baci-web.service, /usr/bin/systemctl status baci-web.service\n' | sudo tee /etc/sudoers.d/baci-web-deploy`
   `sudo chmod 0440 /etc/sudoers.d/baci-web-deploy`
   `sudo visudo -cf /etc/sudoers.d/baci-web-deploy`

8. Check health:
   `systemctl status baci-web.service --no-pager`
   `curl -I https://vps.usebaci.com/`

Rollback:
   `previous_release="$(ls -1dt /home/bassey/baci-web/releases/* | sed -n '2p')" && test -n "$previous_release" && ln -sfn "$previous_release" /home/bassey/baci-web/current`
   `sudo -n /usr/bin/systemctl restart baci-web.service`
```

- [ ] **Step 5: Commit**

```bash
git add scripts/vps/install-web-release.sh infra/web/baci-web.service infra/web/nginx/baci-web-staging.conf scripts/vps/README.md
git commit -m "feat: add baci web vps runtime units"
```

### Task 4: Add Staging Smoke Checker

**Files:**
- Create: `scripts/vps/smoke-web-origin.mjs`

- [ ] **Step 1: Create smoke checker**

```js
#!/usr/bin/env node

const baseUrl = process.env.BACI_WEB_SMOKE_BASE_URL || process.argv[2];
const hostHeader = process.env.BACI_WEB_SMOKE_HOST;

if (!baseUrl) {
  console.error('Usage: BACI_WEB_SMOKE_BASE_URL=https://vps.usebaci.com node scripts/vps/smoke-web-origin.mjs');
  process.exit(2);
}

const paths = hostHeader
  ? [
      '/',
      '/sitemap.xml',
      '/robots.txt',
      '/sitemap/products.xml',
      '/sitemap/categories.xml',
    ]
  : [
      '/',
      '/blog',
      '/sitemap.xml',
      '/robots.txt',
      '/ogabassey',
      '/ogabassey/sitemap/products.xml',
      '/ogabassey/sitemap/categories.xml',
    ];

for (const path of paths) {
  const url = new URL(path, baseUrl).toString();
  const response = await fetch(url, {
    headers: {
      'user-agent': 'baci-vps-web-smoke/1.0',
      ...(hostHeader ? { host: hostHeader } : {}),
    },
    signal: AbortSignal.timeout(30_000),
  });

  if (!response.ok) {
    console.error(`${url} failed with HTTP ${response.status}`);
    process.exit(1);
  }

  const text = await response.text();
  if (text.includes('NEXT_HTTP_ERROR_FALLBACK;404')) {
    console.error(`${url} rendered a Next 404 fallback marker`);
    process.exit(1);
  }

  console.log(`ok ${response.status} ${url}`);
}
```

- [ ] **Step 2: Run against staging after the service starts**

Run:

```bash
BACI_WEB_SMOKE_BASE_URL=https://vps.usebaci.com node scripts/vps/smoke-web-origin.mjs
```

Expected: each path prints `ok`.

Run a separate host-header check directly on the VPS origin before merchant-domain DNS cutover:

```bash
ssh bassey@82.29.190.219 'cd /home/bassey/baci-web/current && BACI_WEB_SMOKE_BASE_URL=http://127.0.0.1:3100 BACI_WEB_SMOKE_HOST=ogabassey.com node /home/bassey/baci-web/current/scripts/vps/smoke-web-origin.mjs'
```

Expected: the request reaches the standalone server with `Host: ogabassey.com`, proving custom-domain routing works without repointing public DNS.

- [ ] **Step 3: Commit**

```bash
git add scripts/vps/smoke-web-origin.mjs
git commit -m "test: add vps web smoke checks"
```

---

## PR 2: Runtime Cleanup And Neutral Observability

### Task 5: Add Runtime Platform Helper

**Files:**
- Create: `apps/web/src/lib/runtime-platform.ts`
- Create: `apps/web/src/lib/runtime-platform.test.ts`

- [ ] **Step 1: Write tests**

```ts
import { describe, expect, it, vi } from 'vitest';
import { getRuntimePlatform, isVercelRuntime } from './runtime-platform';

describe('runtime-platform', () => {
  it('detects Vercel when VERCEL is set', () => {
    vi.stubEnv('VERCEL', '1');
    vi.stubEnv('BACI_RUNTIME_PLATFORM', '');
    expect(getRuntimePlatform()).toBe('vercel');
    expect(isVercelRuntime()).toBe(true);
  });

  it('uses explicit self-hosted platform over Vercel fallback', () => {
    vi.stubEnv('VERCEL', '1');
    vi.stubEnv('BACI_RUNTIME_PLATFORM', 'vps');
    expect(getRuntimePlatform()).toBe('vps');
    expect(isVercelRuntime()).toBe(false);
  });
});
```

- [ ] **Step 2: Implement helper**

```ts
export type RuntimePlatform = 'vercel' | 'vps' | 'local';

export function getRuntimePlatform(): RuntimePlatform {
  const explicit = process.env.BACI_RUNTIME_PLATFORM?.trim();
  if (explicit === 'vps') return 'vps';
  if (explicit === 'vercel') return 'vercel';
  if (process.env.VERCEL) return 'vercel';
  if (process.env.NODE_ENV === 'production') return 'vps';
  return 'local';
}

export function isVercelRuntime(): boolean {
  return getRuntimePlatform() === 'vercel';
}
```

- [ ] **Step 3: Run tests**

```bash
pnpm --filter @baci/web exec vitest run src/lib/runtime-platform.test.ts
```

Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/lib/runtime-platform.ts apps/web/src/lib/runtime-platform.test.ts
git commit -m "feat: add runtime platform detection"
```

### Task 6: Gate Vercel Observability

**Files:**
- Modify: `apps/web/src/instrumentation.ts`
- Modify: `apps/web/src/components/analytics/deferred-platform-insights.tsx`
- Modify: `apps/web/src/components/analytics/deferred-platform-insights.test.tsx`
- Modify: `.github/workflows/deploy.yml`

- [ ] **Step 1: Update instrumentation**

Change `register()` to:

```ts
export async function register() {
  if (process.env.NEXT_RUNTIME !== 'nodejs') return;

  const { isVercelRuntime } = await import('@/lib/runtime-platform');
  if (!isVercelRuntime()) return;

  const { registerOTel } = await import('@vercel/otel');

  registerOTel({
    serviceName: 'baci-web',
    attributes: {
      'deployment.environment':
        process.env.VERCEL_ENV || process.env.NODE_ENV || 'development',
    },
  });
}
```

- [ ] **Step 2: Gate deferred Vercel client widgets**

In `deferred-platform-insights.tsx`, skip loading `@vercel/analytics/next` and `@vercel/speed-insights/next` unless `NEXT_PUBLIC_ENABLE_VERCEL_INSIGHTS === '1'`.

Use this guard near the dynamic import entry point:

```ts
if (process.env.NEXT_PUBLIC_ENABLE_VERCEL_INSIGHTS !== '1') {
  setModules({ Analytics: undefined, SpeedInsights: undefined });
  return;
}
```

- [ ] **Step 3: Add disabled-insights test**

Add this test to `apps/web/src/components/analytics/deferred-platform-insights.test.tsx`:

```tsx
it('renders no Vercel scripts after activation when insights are disabled', async () => {
  vi.stubEnv('NEXT_PUBLIC_ENABLE_VERCEL_INSIGHTS', '');
  const readyStateSpy = vi
    .spyOn(document, 'readyState', 'get')
    .mockReturnValue('complete');

  render(<DeferredPlatformInsights timeoutMs={1} />);

  await act(async () => {
    await vi.advanceTimersByTimeAsync(1);
    await Promise.resolve();
  });

  expect(screen.queryByText('Analytics')).not.toBeInTheDocument();
  expect(screen.queryByText('SpeedInsights')).not.toBeInTheDocument();

  readyStateSpy.mockRestore();
});
```

- [ ] **Step 4: Run tests**

```bash
pnpm --filter @baci/web exec vitest run src/components/analytics/deferred-platform-insights.test.tsx src/lib/runtime-platform.test.ts
```

Expected: PASS.

- [ ] **Step 5: Gate Vercel-only cache recovery commands**

In `.github/workflows/deploy.yml`, add an explicit deploy target marker to the existing `deploy-production` job env while it is still the Vercel deploy job:

```yaml
      DEPLOY_TARGET: vercel
```

Then update every Vercel cache-recovery `if:` expression so it also requires the Vercel deploy target:

```yaml
      - name: Invalidate storefront blog cache tag
        if: ${{ env.DEPLOY_TARGET == 'vercel' && steps.storefront-blog-smoke.outcome == 'failure' }}
        run: pnpm dlx --allow-build=esbuild vercel@52.0.0 cache invalidate --tag "${{ env.BLOG_SMOKE_TAG }}" --yes
      - name: Wait for cache invalidation to propagate
        if: ${{ env.DEPLOY_TARGET == 'vercel' && steps.storefront-blog-smoke.outcome == 'failure' }}
        run: sleep 10
      - name: Re-run storefront blog smoke test after tag invalidate
        id: storefront-blog-smoke-after-invalidate
        if: ${{ env.DEPLOY_TARGET == 'vercel' && steps.storefront-blog-smoke.outcome == 'failure' }}
        continue-on-error: true
        run: node "${RUNNER_TEMP}/blog-smoke-check.mjs"
      - name: Hard purge storefront blog cache tag
        if: ${{ env.DEPLOY_TARGET == 'vercel' && steps.storefront-blog-smoke.outcome == 'failure' && steps.storefront-blog-smoke-after-invalidate.outcome == 'failure' }}
        run: pnpm dlx --allow-build=esbuild vercel@52.0.0 cache dangerously-delete --tag "${{ env.BLOG_SMOKE_TAG }}" --yes
      - name: Wait for cache purge to propagate
        if: ${{ env.DEPLOY_TARGET == 'vercel' && steps.storefront-blog-smoke.outcome == 'failure' && steps.storefront-blog-smoke-after-invalidate.outcome == 'failure' }}
        run: sleep 10
      - name: Re-run storefront blog smoke test after hard purge
        id: storefront-blog-smoke-after-delete
        if: ${{ env.DEPLOY_TARGET == 'vercel' && steps.storefront-blog-smoke.outcome == 'failure' && steps.storefront-blog-smoke-after-invalidate.outcome == 'failure' }}
        continue-on-error: true
        run: node "${RUNNER_TEMP}/blog-smoke-check.mjs"
```

PR 5 changes this job to `DEPLOY_TARGET: vps` or removes the Vercel cache-recovery block entirely. With either option, `BACI_RUNTIME_PLATFORM=vps` must never invoke `vercel cache invalidate` or `vercel cache dangerously-delete`.

Self-hosted cache recovery must be handled separately by app-level revalidation, service restart, or a later cache-handler PR. Do not leave Vercel CLI cache commands in the VPS deployment path.

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/instrumentation.ts apps/web/src/components/analytics/deferred-platform-insights.tsx apps/web/src/components/analytics/deferred-platform-insights.test.tsx .github/workflows/deploy.yml
git commit -m "chore: gate vercel observability"
```

---

## PR 3: Domain Hosting Provider Abstraction

### Task 7: Add Domain Hosting Provider Types

**Files:**
- Create: `apps/web/src/lib/domain-hosting/types.ts`

- [ ] **Step 1: Add provider types**

```ts
export type DomainDnsInstruction = {
  type: 'A' | 'CNAME' | 'TXT';
  name: string;
  value: string;
  instructions: string;
};

export type DomainHostingVerification = {
  verified: boolean;
  sslStatus: 'pending' | 'active' | 'failed';
  status: 'pending' | 'active';
  verificationToken?: string;
  instructions: DomainDnsInstruction[];
  error?: string;
};

export type DomainHostingAddResult = DomainHostingVerification;

export type DomainHostingProvider = {
  addDomain(domain: string): Promise<DomainHostingAddResult>;
  verifyDomain(domain: string): Promise<DomainHostingVerification>;
  removeDomain(domain: string): Promise<void>;
};
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/lib/domain-hosting/types.ts
git commit -m "feat: add domain hosting provider types"
```

### Task 8: Add VPS Domain Provider

**Files:**
- Create: `apps/web/src/lib/domain-hosting/vps-provider.ts`
- Create: `apps/web/src/lib/domain-hosting/vps-provider.test.ts`

- [ ] **Step 1: Write tests**

```ts
import { describe, expect, it, vi } from 'vitest';
import { createVpsDomainHostingProvider } from './vps-provider';

describe('vps domain hosting provider', () => {
  it('returns Baci VPS DNS instructions for a new domain', async () => {
    vi.stubEnv('BACI_VPS_ORIGIN_IPV4', '82.29.190.219');

    const provider = createVpsDomainHostingProvider();
    const result = await provider.addDomain('shop.example.com');

    expect(result).toMatchObject({
      verified: false,
      status: 'pending',
      sslStatus: 'pending',
      instructions: [
        {
          type: 'A',
          name: '@',
          value: '82.29.190.219',
        },
      ],
    });
  });

  it('does not report SSL active before the selected SSL provider has issued coverage', async () => {
    vi.stubEnv('BACI_VPS_ORIGIN_IPV4', '82.29.190.219');
    vi.stubEnv('DOMAIN_SSL_PROVIDER', '');

    const provider = createVpsDomainHostingProvider();
    const result = await provider.verifyDomain('shop.example.com');

    expect(result.status).toBe('pending');
    expect(result.sslStatus).toBe('pending');
  });
});
```

- [ ] **Step 2: Implement provider**

```ts
import type {
  DomainHostingAddResult,
  DomainHostingProvider,
  DomainHostingVerification,
} from './types';

function getOriginIp(): string {
  const value = process.env.BACI_VPS_ORIGIN_IPV4?.trim();
  if (!value) {
    throw new Error('BACI_VPS_ORIGIN_IPV4 must be configured');
  }
  return value;
}

export function createVpsDomainHostingProvider(): DomainHostingProvider {
  return {
    async addDomain(domain: string): Promise<DomainHostingAddResult> {
      return buildPendingResult(domain);
    },
    async verifyDomain(domain: string): Promise<DomainHostingVerification> {
      return buildPendingResult(domain);
    },
    async removeDomain(): Promise<void> {
      return;
    },
  };
}

function buildPendingResult(domain: string): DomainHostingVerification {
  const originIp = getOriginIp();
  return {
    verified: false,
    status: 'pending',
    sslStatus: 'pending',
    verificationToken: undefined,
    instructions: [
      {
        type: 'A',
        name: '@',
        value: originIp,
        instructions: `Point ${domain} to Baci by creating an A record to ${originIp}.`,
      },
    ],
  };
}
```

This provider must not claim `sslStatus: 'active'` unless the selected SSL strategy is actually configured. For the first implementation, either:
- keep custom domains pending until Cloudflare for SaaS/custom-hostname SSL or certbot automation is wired, or
- implement cert issuance as an explicit operator-controlled follow-up before merchant-domain DNS cutover.

- [ ] **Step 3: Run tests**

```bash
pnpm --filter @baci/web exec vitest run src/lib/domain-hosting/vps-provider.test.ts
```

Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/lib/domain-hosting/vps-provider.ts apps/web/src/lib/domain-hosting/vps-provider.test.ts
git commit -m "feat: add vps domain hosting provider"
```

### Task 9: Replace Direct Vercel Domain Calls

**Files:**
- Create: `apps/web/src/lib/domain-hosting/index.ts`
- Modify: `apps/web/src/app/api/domains/route.ts`
- Modify: `apps/web/src/app/api/domains/[domain]/verify/route.ts`
- Modify: `apps/web/src/app/api/domains/[domain]/route.ts`
- Modify: domain route tests under `apps/web/src/app/api/domains/**`
- Modify: `apps/web/src/app/api/domains/purchase/route.ts`

- [ ] **Step 1: Add provider selector**

```ts
import type { DomainHostingProvider } from './types';
import { createVpsDomainHostingProvider } from './vps-provider';

export function getDomainHostingProvider(): DomainHostingProvider {
  const provider = process.env.DOMAIN_HOSTING_PROVIDER?.trim() || 'vps';

  if (provider === 'vps') {
    return createVpsDomainHostingProvider();
  }

  throw new Error(`Unsupported DOMAIN_HOSTING_PROVIDER: ${provider}`);
}
```

- [ ] **Step 2: Update `POST /api/domains`**

Replace:

```ts
import { vercel } from '@/lib/vercel';
```

with:

```ts
import { getDomainHostingProvider } from '@/lib/domain-hosting';
```

Replace `vercel.addDomain(domain)` with:

```ts
const domainHosting = getDomainHostingProvider();
const hostingResult = await domainHosting.addDomain(domain);
```

Derive status from `hostingResult.status`, SSL from `hostingResult.sslStatus`, and return `hostingResult.instructions[0]` as the verification payload.

- [ ] **Step 3: Update verify route**

Replace Vercel-specific error parsing with provider-neutral response:

```ts
const domainHosting = getDomainHostingProvider();
const verifyResult = await domainHosting.verifyDomain(domain);

if (verifyResult.verified) {
  // update DB from provider result:
  // status: verifyResult.status
  // ssl_status: verifyResult.sslStatus
  // verified_at: only when verifyResult.status === 'active'
}

return NextResponse.json(
  {
    success: false,
    verified: false,
    error: verifyResult.error || 'DNS verification failed. Please check your DNS records and try again.',
    details: verifyResult.instructions,
  },
  { status: 400 }
);
```

- [ ] **Step 4: Update delete route**

Replace best-effort `vercel.removeDomain(domain)` with:

```ts
const domainHosting = getDomainHostingProvider();
await domainHosting.removeDomain(domain);
```

Keep it best-effort after DB deletion.

- [ ] **Step 5: Update purchased-domain activation**

`apps/web/src/app/api/domains/purchase/route.ts` currently inserts purchased domains as `status: 'active'` and `ssl_status: 'active'` immediately after Go54 registration. That was tolerable while Vercel owned automatic domain attachment and TLS, but it is incorrect for self-hosting.

Change the route so purchased domains use the same hosting provider result as BYOD domains:

```ts
const domainHosting = getDomainHostingProvider();
const hostingResult = await domainHosting.addDomain(domain);
```

If Go54 DNS management is available, provision the Baci DNS records through `updateDomainDNSRecords()` before storing the row. If DNS automation fails or SSL has not been issued yet, store `status: 'pending'` and `ssl_status: 'pending'` with clear next steps instead of claiming the domain is active.

Regression tests must prove:
- a successful Go54 registration does not mark the domain active when hosting verification is still pending.
- the response no longer tells merchants only to "update nameservers" without the actual Baci A/CNAME instructions.
- `triggerDomainEdgeConfigSync()` is still called after the domain row changes.

- [ ] **Step 6: Run tests**

```bash
pnpm --filter @baci/web exec vitest run src/app/api/domains
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add apps/web/src/lib/domain-hosting apps/web/src/app/api/domains
git commit -m "feat: replace vercel domain api with hosting provider"
```

---

## PR 4: Vercel Edge Config Removal

### Task 10: Add Domain Routing Cache

**Files:**
- Create: `apps/web/src/lib/domain-routing-cache.ts`
- Create: `apps/web/src/lib/domain-routing-cache.test.ts`
- Modify: `apps/web/src/lib/domain-cache-simple.ts`

- [ ] **Step 1: Write tests**

```ts
import { describe, expect, it } from 'vitest';
import {
  createMemoryDomainRoutingCache,
  getDomainCacheKey,
} from './domain-routing-cache';

describe('domain-routing-cache', () => {
  it('normalizes domain cache keys', () => {
    expect(getDomainCacheKey('Shop.Example.COM')).toBe('domain:shop.example.com');
  });

  it('stores and reads slug mappings', async () => {
    const cache = createMemoryDomainRoutingCache();
    await cache.setDomainSlug('shop.example.com', 'merchant-one');
    await cache.setSlugDomain('merchant-one', 'shop.example.com');

    expect(await cache.getSlugForDomain('shop.example.com')).toBe('merchant-one');
    expect(await cache.getDomainForSlug('merchant-one')).toBe('shop.example.com');
  });
});
```

- [ ] **Step 2: Implement cache**

```ts
export type DomainRoutingCache = {
  getSlugForDomain(domain: string): Promise<string | null>;
  setDomainSlug(domain: string, slug: string): Promise<void>;
  getDomainForSlug(slug: string): Promise<string | null>;
  setSlugDomain(slug: string, domain: string): Promise<void>;
};

export function getDomainCacheKey(domain: string): string {
  return `domain:${domain.trim().toLowerCase()}`;
}

export function getSlugCacheKey(slug: string): string {
  return `slug:${slug.trim().toLowerCase()}`;
}

export function createMemoryDomainRoutingCache(): DomainRoutingCache {
  const values = new Map<string, string>();

  return {
    async getSlugForDomain(domain) {
      return values.get(getDomainCacheKey(domain)) ?? null;
    },
    async setDomainSlug(domain, slug) {
      values.set(getDomainCacheKey(domain), slug);
    },
    async getDomainForSlug(slug) {
      return values.get(getSlugCacheKey(slug)) ?? null;
    },
    async setSlugDomain(slug, domain) {
      values.set(getSlugCacheKey(slug), domain);
    },
  };
}
```

- [ ] **Step 3: Update `domain-cache-simple.ts`**

Remove the `@vercel/edge-config` dynamic import path. Use process cache and Supabase DB lookup as the first implementation. Keep the existing 5-minute TTL behavior.

- [ ] **Step 4: Run tests**

```bash
pnpm --filter @baci/web exec vitest run src/lib/domain-routing-cache.test.ts src/lib/domain-cache-simple.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/lib/domain-routing-cache.ts apps/web/src/lib/domain-routing-cache.test.ts apps/web/src/lib/domain-cache-simple.ts apps/web/src/lib/domain-cache-simple.test.ts
git commit -m "feat: replace edge config domain cache"
```

### Task 11: Keep Sync API But Retarget It

**Files:**
- Modify: `apps/web/src/app/api/edge-config/sync/route.ts`
- Modify: `apps/web/src/lib/edge-config-sync.ts`
- Modify: related tests

- [ ] **Step 1: Rename behavior, not path**

Keep `/api/edge-config/sync` for compatibility in this PR. Change the implementation comments and response body to indicate it warms Baci domain routing cache instead of updating Vercel Edge Config.

- [ ] **Step 2: Update sync route response**

The successful response should be:

```ts
return NextResponse.json({
  success: true,
  synced: domainMappings.length,
  provider: 'baci-domain-routing-cache',
});
```

- [ ] **Step 3: Run tests**

```bash
pnpm --filter @baci/web exec vitest run src/app/api/edge-config/sync/route.test.ts src/lib/edge-config-sync.test.ts
```

Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/app/api/edge-config/sync/route.ts apps/web/src/lib/edge-config-sync.ts apps/web/src/app/api/edge-config/sync/route.test.ts apps/web/src/lib/edge-config-sync.test.ts
git commit -m "feat: retarget domain sync away from edge config"
```

---

## PR 5: Production VPS Cutover Workflow

### Task 12: Add VPS Deploy Script

**Files:**
- Create: `.github/scripts/vps-web-deploy.sh`
- Modify: `.github/workflows/deploy.yml`

- [ ] **Step 1: Create deploy script**

```bash
#!/usr/bin/env bash
set -euo pipefail

VPS_HOST="${BACI_WEB_VPS_HOST:?BACI_WEB_VPS_HOST is required}"
VPS_USER="${BACI_WEB_VPS_USER:-bassey}"
REMOTE_TMP="/home/${VPS_USER}/baci-web/tmp"

scripts/vps/build-web-standalone.sh
artifact="$(scripts/vps/package-web-release.sh)"

ssh "${VPS_USER}@${VPS_HOST}" "mkdir -p ${REMOTE_TMP}"
rsync -av "$artifact" "${VPS_USER}@${VPS_HOST}:${REMOTE_TMP}/"
ssh "${VPS_USER}@${VPS_HOST}" "bash -s -- ${REMOTE_TMP}/$(basename "$artifact")" < scripts/vps/install-web-release.sh
ssh "${VPS_USER}@${VPS_HOST}" "sudo -n /usr/bin/systemctl restart baci-web.service"
```

- [ ] **Step 2: Update workflow**

Replace the Vercel deploy steps in `.github/workflows/deploy.yml` with:

```yaml
      - name: Deploy Baci web to VPS
        env:
          BACI_WEB_VPS_HOST: ${{ secrets.BACI_WEB_VPS_HOST }}
          BACI_WEB_VPS_USER: bassey
          NODE_OPTIONS: "--max_old_space_size=8192"
        run: .github/scripts/vps-web-deploy.sh
```

Keep the existing DB migration job before deploy.

- [ ] **Step 3: Run workflow on `workflow_dispatch` against staging first**

Expected:
- GitHub Actions deploy job succeeds.
- `https://vps.usebaci.com/` returns `200`.
- `node scripts/vps/smoke-web-origin.mjs https://vps.usebaci.com` passes.
- The deploy fails fast, not interactively, if `/etc/sudoers.d/baci-web-deploy` is missing or invalid.

- [ ] **Step 4: Commit**

```bash
git add .github/scripts/vps-web-deploy.sh .github/workflows/deploy.yml
git commit -m "feat: deploy baci web to vps"
```

### Task 13: Production Cutover Runbook

**Files:**
- Create: `docs/deployment/vps-web-cutover.md`
- Modify: `apps/web/src/config/platform.ts`

- [ ] **Step 1: Update platform URL fallback**

Change production fallback in `apps/web/src/config/platform.ts` so self-hosted production requires `NEXT_PUBLIC_SITE_URL` or `NEXT_PUBLIC_APP_URL`. Remove `VERCEL_URL` from production fallback.

- [ ] **Step 2: Add cutover runbook**

````markdown
# Baci VPS Web Cutover

## Preconditions

- `baci-web.service` is active on the VPS.
- nginx serves `https://vps.usebaci.com`.
- `BACI_RUNTIME_PLATFORM=vps` is set in `/home/bassey/baci-web/.env`.
- `HOSTNAME=127.0.0.1` and `PORT=3100` are set so the standalone server is loopback-only.
- `NEXT_PUBLIC_SITE_URL=https://usebaci.com` is set for production.
- `NEXT_PUBLIC_APP_URL=https://usebaci.com` is set for production.
- `BACI_WEB_BASE_URL` in `vps-workers` is updated or confirmed to call the new web origin after production DNS cutover.
- Non-public VPS ports are firewalled or bound to loopback; specifically, `3100` is loopback-only, and the previously exposed Awoof `3000`/`5001`/`5432` ports remain loopback-only.
- Any still-public non-web ports are intentionally owned and documented before cutover.
- Merchant custom-domain cutover is disabled unless the configured domain-hosting provider can verify DNS and confirm HTTPS coverage for each hostname.

## Smoke Gates

Run before DNS cutover:

```bash
BACI_WEB_SMOKE_BASE_URL=https://vps.usebaci.com node scripts/vps/smoke-web-origin.mjs
```

Manually verify:

- `GET /`
- `GET /blog`
- `GET /sitemap.xml`
- `GET /robots.txt`
- `GET /ogabassey`
- `GET /ogabassey/sitemap/products.xml`
- `GET /ogabassey/sitemap/categories.xml`
- custom-domain host-header smoke against `http://127.0.0.1:3100` with `Host: ogabassey.com`
- customer checkout create order
- Paystack webhook route with a signed test fixture
- merchant dashboard login
- custom-domain lookup for an active purchased domain

## DNS Cutover

Change `usebaci.com` and `www.usebaci.com` DNS to Cloudflare proxied records that target the VPS origin.

Merchant domains move after `usebaci.com` passes smoke checks for 24 hours.

## Rollback

Rollback DNS to the previous Vercel target while keeping the VPS service running for diagnosis.

Rollback app release:

```bash
ssh bassey@82.29.190.219 'ls -1 /home/bassey/baci-web/releases | tail'
ssh bassey@82.29.190.219 'previous_release="$(ls -1dt /home/bassey/baci-web/releases/* | sed -n "2p")" && test -n "$previous_release" && ln -sfn "$previous_release" /home/bassey/baci-web/current && sudo -n /usr/bin/systemctl restart baci-web.service'
```
````

- [ ] **Step 3: Run checks**

```bash
pnpm --filter @baci/web typecheck
pnpm --filter @baci/web exec vitest run src/config
```

Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add docs/deployment/vps-web-cutover.md apps/web/src/config/platform.ts
git commit -m "docs: add vps web cutover runbook"
```

---

## Final Verification Before DNS Cutover

- [ ] `pnpm turbo lint` passes.
- [ ] `pnpm turbo typecheck` passes.
- [ ] `pnpm turbo test` passes or all failures are unrelated and documented with exact failing tests.
- [ ] `BACI_WEB_SMOKE_BASE_URL=https://vps.usebaci.com node scripts/vps/smoke-web-origin.mjs` passes.
- [ ] `curl -I https://vps.usebaci.com/` returns `200` and does not show `server: Vercel`.
- [ ] `curl -I https://usebaci.com/` still returns the old Vercel origin before cutover.
- [ ] `curl -I https://ogabassey.com/` still returns the old Vercel origin before merchant-domain cutover.
- [ ] VPS app internals are locked down: `3000`, `5001`, `5432`, `3100`, and any temporary Next ports are not reachable publicly.
- [ ] `baci-web.service` has `HOSTNAME=127.0.0.1`; `ss -tuln` shows `127.0.0.1:3100`, not `0.0.0.0:3100`.
- [ ] Intentional public non-web ports are documented before cutover: `8443` remains authenticated nginx for Ollama, `5061`/SIP and UDP media ports are confirmed still needed, and any unknown listener such as `8082` is either firewalled or assigned to a named service owner.
- [ ] `baci-cdn-transformer.service` remains active.
- [ ] `baci-vercel-log-drain-receiver.service` is intentionally retired or left running only until Vercel deploy is disabled.
- [ ] Paystack webhook route has a staged validation path before DNS cutover.
- [ ] Go54 purchase flow still registers domains and writes `domains` rows.
- [ ] BYOD custom-domain flow no longer references Vercel IPs or `_vercel` TXT records.
- [ ] Merchant-domain DNS cutover is blocked unless the active domain-hosting provider can verify DNS and either issue or confirm HTTPS coverage for that hostname.

## Rollback Policy

- Before PR 5: rollback by keeping Vercel production deployment as the source of truth.
- During PR 5 staging: rollback by disabling the VPS staging nginx site and leaving Vercel untouched.
- After `usebaci.com` cutover: rollback by restoring DNS to the previous Vercel target and restarting the previous VPS release for debugging.
- After merchant custom-domain cutover: rollback one merchant domain at a time. Do not bulk-repoint all merchant domains without a successful `usebaci.com` soak.

## Self-Review Notes

- This plan keeps domain purchase on Go54; it only replaces Vercel domain activation, verification, routing, and SSL assumptions.
- This plan does not modify `apps/web/src/proxy.ts`.
- This plan preserves the current worker cron strategy in `vps-workers`.
- This plan avoids `vercel build` in the new self-hosted deployment path.
- The highest-risk PR is PR 3 because merchant-facing domain instructions and verification behavior change.
- The highest-risk operational step is public DNS cutover, so it is isolated to PR 5.
