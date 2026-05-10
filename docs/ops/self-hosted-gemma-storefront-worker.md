# Self-Hosted Gemma Storefront Worker

The async storefront generator runs on the VPS, not in a Vercel Function. New
merchants get a deterministic starter Puck storefront immediately; Gemma
creates an optional AI draft in the background.

## Runtime Contract

- `storefront_layout_generation` jobs are processed only by
  `apps/web/src/scripts/process-ai-storefront-jobs.ts`.
- `vps-workers/bin/process-ai-storefront-jobs.sh` invokes that TypeScript
  worker through `vps-workers/bin/run-web-script.sh`.
- The worker imports `dotenv/config`, and `run-web-script.sh` points dotenv at
  `/home/bassey/baci-workers/.env` with `DOTENV_CONFIG_PATH`.
- Batch size is capped at `1`; cron can run every 2 minutes with `flock` (file
  lock) to prevent concurrent executions of the same cron job.
- Ollama should be private to the VPS, ideally
  `OLLAMA_STOREFRONT_BASE_URL=http://localhost:11434`.
- `/api/ai-jobs/worker` remains for short legacy jobs and must not process
  Gemma storefront generation.

## Required Environment

```bash
NEXT_PUBLIC_SUPABASE_URL=...
SUPABASE_SERVICE_ROLE_KEY=...
OLLAMA_STOREFRONT_BASE_URL=http://localhost:11434
OLLAMA_STOREFRONT_MODEL=gemma4:e4b
OLLAMA_STOREFRONT_TIMEOUT_MS=90000
AI_STOREFRONT_GENERATION_ENABLED=false
```

Set `AI_STOREFRONT_GENERATION_ENABLED=true` only after the worker is deployed,
logs are visible, and manual processing succeeds.

## Manual Smoke Test

From the full Baci checkout on the VPS:

```bash
NODE_ENV=production pnpm --filter @baci/web exec tsx src/scripts/process-ai-storefront-jobs.ts
```

Or from `/home/bassey/baci-workers`:

```bash
NODE_ENV=production ./bin/process-ai-storefront-jobs.sh
```

Cron example:

```cron
*/2 * * * * flock -n /var/lock/ai-storefront.lock bash -lc 'export NODE_ENV=production && /home/bassey/baci-workers/bin/process-ai-storefront-jobs.sh' >> /home/bassey/baci-workers/logs/ai-storefront-jobs.log 2>&1
```

Configure log rotation for `/home/bassey/baci-workers/logs/*.log` with
`logrotate` or an equivalent host policy before enabling the cron entry, so the
Gemma worker log cannot grow without bounds.

Expected output:

```json
{"processed":0}
```

`processed` can be greater than zero when pending jobs exist. Check
`logs/ai-storefront-jobs.log` for worker errors, validation failures, queue wait
time, duration, model, and retry metadata.

## Rollout Checklist

- Local tests for schemas, normalizer, worker, onboarding, readiness, builder,
  dashboard, and mobile Copilot pass.
- Supabase migration is applied and the `apply_ai_storefront_draft` RPC exists.
- Ollama responds locally from the VPS with the selected Gemma model.
- Cron contains `process-ai-storefront-jobs.sh` every 2 minutes with `flock`.
- Queue depth and failed-job counts are monitored before enabling the onboarding
  enqueue flag.
