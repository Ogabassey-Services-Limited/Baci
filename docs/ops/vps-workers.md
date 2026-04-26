# VPS Workers Runbook

Vercel cron scheduling is disabled in `vercel.json`. Production schedules live in `vps-workers/deploy.sh`, which installs a delimited `baci-workers` crontab block on the VPS.

The web cron API routes under `apps/web/src/app/api/cron/` remain as manual fallbacks only. Do not re-enable Vercel Cron for these routes unless the VPS worker architecture is intentionally rolled back. When adding or removing cron routes, update this runbook and `vps-workers/deploy.sh` in the same PR so the documented manual fallback surface stays aligned with the deployed worker schedule.

Manual fallback invocation requires the existing `CRON_SECRET` authentication. Prefer running the matching VPS worker directly when possible, for example:

```bash
cd /home/bassey/baci-workers
export NODE_ENV=production
bin/sync-jumia-orders.sh
```

`bin/sync-jumia-orders.sh` is a worker checkout wrapper. It delegates to the TypeScript Baci checkout under `/opt/baci/app` by default, or to `BACI_REPO_DIR` when that environment variable is set.

For the import queue, run the repo-backed script from the worker checkout:

```bash
export NODE_ENV=production
/home/bassey/baci-workers/bin/process-import-jobs.sh
```

The import queue and Jumia order sync runners execute web-owned TypeScript entrypoints through `tsx` from a separate Baci repo checkout. `tsx` stays in `devDependencies` to avoid expanding the Next.js production dependency surface.

That Baci checkout is separate from the `vps-workers` deployment directory installed by `deploy.sh`. `vps-workers/deploy.sh` always installs the worker directory with `pnpm install --frozen-lockfile --prod`.

The separate Baci checkout must use a full workspace install (`pnpm install --frozen-lockfile`, not `--prod`) until the TypeScript worker entrypoints are compiled to JavaScript. Use the repo's normal pnpm/turbo commands for validation and app workflows.

## Separate Baci Checkout for TypeScript Runners

Use `/opt/baci/app` as the preferred full monorepo checkout for TypeScript-backed workers. If that path is not available, set `BACI_REPO_DIR` in the worker environment to the checkout that contains `apps/web`.

Initial setup:

```bash
sudo mkdir -p /opt/baci
sudo chown -R bassey:bassey /opt/baci
git clone git@github.com:ogabasseyy/Baci.git /opt/baci/app
cd /opt/baci/app
pnpm install --frozen-lockfile
```

Do not install this checkout with `--prod`; `tsx` and other devDependencies must remain available until these TypeScript entrypoints are compiled before deployment. Keep this checkout on the same deployed commit as the worker schedule when promoting VPS cron changes.

Some cron work intentionally remains in the web app because it needs web-only runtime integrations. The VPS schedule calls these CRON_SECRET-gated routes through `node jobs/run-web-cron.mjs <path>`:

- `/api/ai-jobs/worker`, scheduled daily at 02:00.
- `/api/cron/wallet-payouts`, scheduled daily at 06:00.
- `/api/cron/publish-scheduled-posts`, scheduled every 15 minutes.
- `/api/inventory/push-alerts`, scheduled every 6 hours.

These entries require `BACI_WEB_BASE_URL` and `CRON_SECRET` in `/home/bassey/baci-workers/.env`. `BACI_WEB_BASE_URL` must be an `https://` TLS-terminated production web origin, for example `https://ogabassey.com`; do not use `http://` for production web cron calls because `CRON_SECRET` is sent on each request. `CRON_SECRET` must exist in both the VPS worker environment and the web deployment environment with the same value; rotate both copies together through the normal secret-management process.

## Troubleshooting

If `process-import-jobs.sh` or `sync-jumia-orders.sh` fails, inspect the matching log in `/home/bassey/baci-workers/logs/` first. Stale locks can be checked with `ls -la /home/bassey/baci-workers/locks`; only remove a lock after confirming no matching worker process is running. Missing environment values should be fixed in `/home/bassey/baci-workers/.env` or the `BACI_WORKER_ENV` file used by cron.

If a web cron wrapper fails, inspect the matching log first: `/home/bassey/baci-workers/logs/ai-jobs-worker.log`, `/home/bassey/baci-workers/logs/wallet-payouts.log`, `/home/bassey/baci-workers/logs/publish-scheduled-posts.log`, or `/home/bassey/baci-workers/logs/inventory-push-alerts.log`. A 401 almost always means the VPS `CRON_SECRET` does not match the web deployment.

If a repo-backed TypeScript runner reports that `tsx` is missing, the separate Baci checkout used to run the web script was likely installed with production-only dependencies. Run `pnpm install --frozen-lockfile` in that checkout, then rerun the affected `/home/bassey/baci-workers/bin/*.sh` script.

Rotate `/home/bassey/baci-workers/logs/process-import-jobs.log` and the rest of `/home/bassey/baci-workers/logs/` with logrotate or a cron-based size/age policy so worker logs do not grow without bound. If disk space is already low, archive or truncate the affected log only after confirming the worker is not actively writing to it.
