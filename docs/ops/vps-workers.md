# VPS Workers Runbook

Vercel cron scheduling is disabled in `vercel.json`. Production schedules live in `vps-workers/deploy.sh`, which installs a delimited `baci-workers` crontab block on the VPS.

The web cron API routes under `apps/web/src/app/api/cron/` remain as manual fallbacks only. Do not re-enable Vercel Cron for these routes unless the VPS worker architecture is intentionally rolled back. When adding or removing cron routes, update this runbook and `vps-workers/deploy.sh` in the same PR so the documented manual fallback surface stays aligned with the deployed worker schedule.

Manual fallback invocation requires the existing `CRON_SECRET` authentication. Prefer running the matching VPS worker directly when possible, for example:

```bash
cd /home/bassey/baci-workers
node jobs/sync-jumia-orders.mjs
```

For the import queue, run the repo-backed script from the worker checkout:

```bash
export NODE_ENV=production
/home/bassey/baci-workers/bin/process-import-jobs.sh
```

The import queue runner executes `apps/web/src/scripts/process-import-jobs.ts` through `tsx` from a separate Baci repo checkout, not from the `vps-workers` deployment directory installed by `deploy.sh`. `vps-workers/deploy.sh` always installs the worker directory with `pnpm install --frozen-lockfile --prod`; the separate Baci checkout must use a full workspace install (`pnpm install --frozen-lockfile`, not `--prod`) until the TypeScript worker entrypoints are compiled to JavaScript. Use the repo's normal pnpm/turbo commands for validation and app workflows. `tsx` stays in `devDependencies` to avoid expanding the Next.js production dependency surface.

Some cron work intentionally remains in the web app because it needs web-only runtime integrations. The VPS schedule calls these CRON_SECRET-gated routes through `node jobs/run-web-cron.mjs <path>`:

- `/api/ai-jobs/worker`, scheduled daily at 02:00.
- `/api/cron/wallet-payouts`, scheduled daily at 06:00.
- `/api/cron/publish-scheduled-posts`, scheduled every 15 minutes.

These entries require `BACI_WEB_BASE_URL` and `CRON_SECRET` in `/home/bassey/baci-workers/.env`. `BACI_WEB_BASE_URL` must be an `https://` TLS-terminated production web origin, for example `https://ogabassey.com`; do not use `http://` for production web cron calls because `CRON_SECRET` is sent on each request. `CRON_SECRET` must exist in both the VPS worker environment and the web deployment environment with the same value; rotate both copies together through the normal secret-management process.

## Troubleshooting

If `process-import-jobs.sh` fails, inspect `/home/bassey/baci-workers/logs/process-import-jobs.log` first. Stale locks can be checked with `ls -la /home/bassey/baci-workers/locks`; only remove a lock after confirming no matching worker process is running. Missing environment values should be fixed in `/home/bassey/baci-workers/.env` or the `BACI_WORKER_ENV` file used by cron.

If a web cron wrapper fails, inspect the matching log first: `/home/bassey/baci-workers/logs/ai-jobs-worker.log`, `/home/bassey/baci-workers/logs/wallet-payouts.log`, or `/home/bassey/baci-workers/logs/publish-scheduled-posts.log`. A 401 almost always means the VPS `CRON_SECRET` does not match the web deployment.

If the import queue reports that `tsx` is missing, the separate Baci checkout used to run `apps/web/src/scripts/process-import-jobs.ts` was likely installed with production-only dependencies. Run `pnpm install --frozen-lockfile` in that checkout, then rerun `/home/bassey/baci-workers/bin/process-import-jobs.sh`.

Rotate `/home/bassey/baci-workers/logs/process-import-jobs.log` and the rest of `/home/bassey/baci-workers/logs/` with logrotate or a cron-based size/age policy so worker logs do not grow without bound. If disk space is already low, archive or truncate the affected log only after confirming the worker is not actively writing to it.
