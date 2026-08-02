# Self-Hosted Gemma Storefront Worker

The async storefront generator runs on the VPS, not in a Vercel Function. New
merchants get a deterministic starter Puck storefront immediately. The hosted
Cerebras-first chain is the active Builder/shared-text path; this Ollama/Gemma
worker remains a separate legacy full-layout compatibility path for historical
and explicitly created jobs only.

## Runtime Contract

- `storefront_layout_generation` jobs are processed only by
  `apps/web/src/scripts/process-ai-storefront-jobs.ts`.
- `vps-workers/bin/process-ai-storefront-jobs.sh` invokes that TypeScript
  worker through `vps-workers/bin/run-web-script.sh`.
- The worker imports `dotenv/config`, and `run-web-script.sh` points dotenv at
  `/home/bassey/baci-workers/.env` with `DOTENV_CONFIG_PATH`.
- Batch size is capped at `1`; the signed trigger service starts the worker as
  soon as web creates a job, and cron runs every 10 minutes only as a recovery
  sweep.
- `vps-workers/jobs/ai-storefront-trigger-server.mjs` listens on
  `127.0.0.1:3917` by default, requires a bearer token, and starts the worker
  under both `ollama-workload.lock` and `ai-storefront-jobs.lock`.
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
AI_STOREFRONT_TRIGGER_SECRET=...
AI_STOREFRONT_TRIGGER_HOST=127.0.0.1
AI_STOREFRONT_TRIGGER_PORT=3917
```

`AI_STOREFRONT_GENERATION_ENABLED` remains parseable only for compatibility. It
does not enqueue onboarding jobs and is not a worker pause switch.

The web deployment also needs:

```bash
AI_STOREFRONT_TRIGGER_URL=https://<worker-host>/ai-storefront/trigger
AI_STOREFRONT_TRIGGER_SECRET=...
AI_STOREFRONT_TRIGGER_TIMEOUT_MS=5000
```

Expose the trigger URL through HTTPS and proxy only to the local listener. Do
not expose the Ollama port.

## Manual Smoke Test

From the full Baci checkout on the VPS:

```bash
NODE_ENV=production pnpm --filter @baci/web exec tsx src/scripts/process-ai-storefront-jobs.ts
```

Or from `/home/bassey/baci-workers`:

```bash
NODE_ENV=production ./bin/process-ai-storefront-jobs.sh
```

Trigger service smoke test from the VPS:

```bash
curl -i \
  -X POST \
  -H "Authorization: Bearer $AI_STOREFRONT_TRIGGER_SECRET" \
  -H "Content-Type: application/json" \
  --data '{"source":"manual","merchantId":"smoke-test"}' \
  http://127.0.0.1:3917/ai-storefront/trigger
```

Cron example:

```cron
*/10 * * * * flock -n /home/bassey/baci-workers/locks/ollama-workload.lock flock -n /home/bassey/baci-workers/locks/ai-storefront-jobs.lock bash -lc 'export NODE_ENV=production && export BACI_WORKER_PROFILE=ai-storefront-jobs && cd /home/bassey/baci-workers && /home/bassey/baci-workers/bin/process-ai-storefront-jobs.sh' >> /home/bassey/baci-workers/logs/ai-storefront-jobs.log 2>&1
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
- `baci-ai-storefront-trigger.service` is running and accepts signed local
  trigger requests.
- Cron contains `process-ai-storefront-jobs.sh` every 10 minutes with the
  shared Ollama and storefront worker locks.
- Web production has `AI_STOREFRONT_TRIGGER_URL` and the matching
  `AI_STOREFRONT_TRIGGER_SECRET`.
- Monitor queue depth and failed-job counts while observing the explicit,
  authenticated Builder legacy-job path for `storefront_layout_generation`.
  Do not use onboarding as a trigger and do not enable or disable
  `AI_STOREFRONT_GENERATION_ENABLED`: it is a compatibility-only no-op, not an
  onboarding enqueue or worker-control switch.
