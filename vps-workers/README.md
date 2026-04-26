# VPS Workers

`deploy.sh` syncs only this `vps-workers` directory to
`/home/bassey/baci-workers` and installs the worker package with
`pnpm install --frozen-lockfile --prod`.

The Jumia order sync and import queue wrappers do not run TypeScript from this
production-only worker install. They delegate to a separate full Baci monorepo
checkout, resolved from `BACI_REPO_DIR` or `/opt/baci/app`, via
`bin/run-web-script.sh`.

## Configuring BACI_REPO_DIR

`BACI_REPO_DIR` points `bin/run-web-script.sh` at the full Baci checkout that
contains `apps/web`. If it is unset, the wrapper first tries `/opt/baci/app`.
The configured path must exist, be readable by the worker user, and contain the
expected monorepo files used by the wrapper.

Common configurations:

```bash
export BACI_REPO_DIR=/opt/baci/app
```

```ini
Environment=BACI_REPO_DIR=/opt/baci/app
```

```yaml
environment:
  BACI_REPO_DIR: /opt/baci/app
```

That full checkout must be installed with:

```bash
pnpm install --frozen-lockfile
```

Do not use `--prod` for the full checkout until the TypeScript worker
entrypoints are compiled before deployment; `tsx` is intentionally available
from the web app's development dependencies in that checkout.

`jobs/run-web-cron.mjs` calls the retained CRON_SECRET-gated web GET wrappers
for web-owned scheduled work:

- `/api/ai-jobs/worker`
- `/api/cron/cleanup-orders`
- `/api/cron/process-settlements`
- `/api/cron/publish-scheduled-posts`
- `/api/cron/wallet-payouts`
- `/api/inventory/push-alerts`

`CRON_SECRET` must never be committed to source. Inject it through environment
variables or the project's secret manager, keep it aligned between the VPS
worker and web deployment, and rotate it through the normal secret-management
process. No API keys, passwords, or tokens should be stored in repo files.
