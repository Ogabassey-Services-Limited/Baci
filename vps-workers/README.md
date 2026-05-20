# VPS Workers

`deploy.sh` syncs only this `vps-workers` directory to
`/home/bassey/baci-workers` and installs the worker package with
`pnpm install --frozen-lockfile --prod`.

The Jumia order sync, import queue, and AI storefront generation wrappers do not run TypeScript from this
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

The VPS wrappers run `apps/web/src/scripts/process-import-jobs.ts`,
`apps/web/src/scripts/sync-jumia-orders.ts`, and
`apps/web/src/scripts/process-ai-storefront-jobs.ts` directly through the
`tsx` runtime dependency in the full checkout, with no prior compilation step.
That dependency is not part of the standalone `/home/bassey/baci-workers`
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
OLLAMA_STOREFRONT_BASE_URL=http://localhost:11434
OLLAMA_STOREFRONT_MODEL=gemma4:e4b
OLLAMA_STOREFRONT_TIMEOUT_MS=90000
AI_STOREFRONT_GENERATION_ENABLED=false
VERCEL_ERROR_LOG_PATH=/home/bassey/baci-workers/logs/vercel-drain.jsonl
BACI_REMEDIATION_OUTPUT_DIR=/home/bassey/baci-workers/logs/vercel-error-remediator
BACI_REMEDIATION_MIN_OCCURRENCES=2
BACI_REMEDIATION_AUTOFIX_ENABLED=0
BACI_REPO_DIR=/opt/baci/app
BACI_REMEDIATION_WORKTREE_ROOT=/opt/baci/remediation-worktrees
BACI_REMEDIATION_VERIFY_COMMAND="pnpm turbo lint && pnpm turbo typecheck"
BACI_REMEDIATION_NOTIFY_EMAILS=owner@example.com
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
- `OLLAMA_STOREFRONT_BASE_URL`: Local/private Ollama base URL for async storefront generation. Use `http://localhost:11434` when Ollama runs on the same VPS.
- `OLLAMA_STOREFRONT_MODEL`: Gemma model used for storefront layout generation.
- `OLLAMA_STOREFRONT_TIMEOUT_MS`: Per-request Ollama timeout for the storefront worker.
- `AI_STOREFRONT_GENERATION_ENABLED`: Rollout flag for enqueueing new storefront generation jobs during onboarding.
- `VERCEL_ERROR_LOG_PATH`: JSONL file written by the Vercel log-drain receiver or log export process. Each line must be one Vercel log event JSON object.
- `BACI_REMEDIATION_OUTPUT_DIR`: Directory where the remediator writes Codex prompts and reports.
- `BACI_REMEDIATION_MIN_OCCURRENCES`: Minimum repeated fingerprint count before the worker creates remediation work. Default is `2`.
- `BACI_REMEDIATION_AUTOFIX_ENABLED`: Set to `1` only after Codex CLI and GitHub CLI are logged in on the VPS. Default/dry-run mode writes prompts and sends reports only.
- `BACI_REPO_DIR`: Full Baci checkout used for autonomous fix PRs. The checkout must have `origin`, dependencies, `gh`, and Codex CLI access.
- `BACI_REMEDIATION_WORKTREE_ROOT`: Directory where isolated remediation worktrees are created. Defaults beside `BACI_REPO_DIR`.
- `BACI_REMEDIATION_VERIFY_COMMAND`: Shell command run before commit/push in autofix mode.
- `BACI_REMEDIATION_NOTIFY_EMAILS`: Comma-separated report recipients. Requires `ZEPTOMAIL_TOKEN`; `ZEPTOMAIL_FROM_DOMAIN` defaults to `usebaci.com`.

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

`/api/ai-jobs/worker` is intentionally retained only for short legacy web-safe
jobs such as price list processing. Long `storefront_layout_generation` jobs
must run through `bin/process-ai-storefront-jobs.sh`, which talks to local
Ollama from the VPS checkout and processes one job per invocation.

## Vercel Error Remediator

`jobs/vercel-error-remediator.mjs` is a guarded remediation worker for Vercel
runtime/build error logs.

It does three things in dry-run mode:

- reads newline-delimited Vercel log-drain events from `VERCEL_ERROR_LOG_PATH`
- fingerprints repeated 5xx/error events and writes Codex remediation prompts
- emails an operator report when `BACI_REMEDIATION_NOTIFY_EMAILS` and `ZEPTOMAIL_TOKEN` are configured

Run manually:

```bash
cd /home/bassey/baci-workers
node jobs/vercel-error-remediator.mjs
```

Autofix mode is intentionally off by default. When
`BACI_REMEDIATION_AUTOFIX_ENABLED=1`, the worker uses the full checkout at
`BACI_REPO_DIR` to create an isolated git worktree, run Codex, inspect changed files,
require and run `BACI_REMEDIATION_VERIFY_COMMAND`, push a
`codex/vercel-remediation-*` branch, and open a GitHub PR. It blocks PR creation
if Codex touches protected surfaces:
`proxy.ts`, payment/auth/webhook routes, payment libraries, migrations, GitHub
workflows, or secret files.

`BACI_REMEDIATION_REQUEST_AUTO_MERGE=1` can request GitHub auto-merge after PR
creation, but branch protection must remain authoritative. Do not give the
worker a GitHub token that can bypass required checks or reviews.
