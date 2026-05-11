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

The VPS wrappers run `apps/web/src/scripts/process-import-jobs.ts` and
`apps/web/src/scripts/sync-jumia-orders.ts` directly through the `tsx`
runtime dependency in the full checkout, with no prior compilation step. That
dependency is not part of the standalone `/home/bassey/baci-workers`
production-only install, so keep the separate `apps/web` checkout dependencies
installed before enabling these cron entries.

The web app only creates and updates Bumpa import job records in production.
Scheduled processing is owned by the VPS cron entry for
`bin/process-import-jobs.sh`; do not add a Vercel Function or Vercel Cron for
`/api/import-jobs/worker`.

Import processing can run longer and use more CPU or memory than a web request
should. Keeping it on the VPS isolates Bumpa imports from storefront traffic and
avoids Vercel Function execution limits.

`tsx` intentionally remains an `apps/web` production dependency while these
cron entrypoints execute TypeScript in production. Move it back to a
development-only dependency only after these scripts are compiled to JavaScript
and the wrappers are updated to run the compiled output.

## Environment Variables

Create `/home/bassey/baci-workers/.env` with the runtime secrets used by the
worker scripts:

```bash
touch /home/bassey/baci-workers/.env
chmod 600 /home/bassey/baci-workers/.env
```

```bash
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...
EXPO_ACCESS_TOKEN=...
JUMIA_CLIENT_ID=...
BACI_WEB_BASE_URL=...
CRON_SECRET=...
```

Do not commit this file or any `.env*` file to version control. Keep those
files covered by `.gitignore` and manage the values through the deployment
secret process.

Variable purposes:

- `NEXT_PUBLIC_SUPABASE_URL`: Supabase project URL used by web scripts and standalone workers.
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`: Public Supabase key required by the web runtime configuration.
- `SUPABASE_SERVICE_ROLE_KEY`: Server-only Supabase key for worker writes; never expose it to browsers or commit it.
- `EXPO_ACCESS_TOKEN`: Expo token used for push notification delivery and related mobile app operations.
- `JUMIA_CLIENT_ID`: Jumia application/client identifier used when refreshing integration credentials.
- `BACI_WEB_BASE_URL`: HTTPS base URL for web cron endpoint calls, for example `https://ogabassey.com`.
- `CRON_SECRET`: Shared secret that must match the web deployment and protect cron endpoints.

### Runtime Checks and Rotation

Worker startup should fail closed when required variables are missing or
invalid. At minimum, validate `NEXT_PUBLIC_SUPABASE_URL`,
`SUPABASE_SERVICE_ROLE_KEY`, `CRON_SECRET`, and the job-specific credentials
before work starts; log only the variable name and exit non-zero, never the
secret value.

To rotate a secret, generate the replacement value, deploy the updated `.env`
through the deployment secret store, restart the affected worker process, verify
successful cron execution, then revoke the old value. Rotate server-only values
such as `SUPABASE_SERVICE_ROLE_KEY`, `EXPO_ACCESS_TOKEN`, and `CRON_SECRET`
immediately after suspected exposure and on the normal security cadence.

`jobs/run-web-cron.mjs` calls the retained CRON_SECRET-gated web cron endpoints
for web-owned scheduled work. Every request sends `Authorization: Bearer
$CRON_SECRET`; `/api/cron/process-settlements` uses `POST` and the others use
`GET`:

- `/api/ai-jobs/worker`
- `/api/cron/cleanup-orders`
- `/api/cron/process-settlements`
- `/api/cron/publish-scheduled-posts`
- `/api/cron/vtu-cashback-summaries`
- `/api/cron/wallet-payouts`
- `/api/inventory/push-alerts`

`CRON_SECRET` must never be committed to source. Inject it through environment
variables or the project's secret manager, keep it aligned between the VPS
worker and web deployment, and rotate it through the normal secret-management
process. No API keys, passwords, or tokens should be stored in repo files.
