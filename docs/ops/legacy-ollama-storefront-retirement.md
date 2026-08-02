# Legacy Ollama Storefront Retirement

The hosted Cerebras-first chain is the active Builder and shared-text path.
The VPS Ollama/Gemma full-layout worker remains a legacy compatibility path for
historical and explicitly created `storefront_layout_generation` jobs. New web
and mobile onboarding provision the deterministic curated homepage and do not
enqueue or trigger this worker.

This document is the evidence gate for a **later, separately owner-approved
decommission PR**. It does not authorize or perform a production query, job
mutation, service stop, cron change, secret change, deployment, or deletion.
Do not treat a passing local search as approval to remove the worker.

## Current Surface Inventory

The retirement PR owner must re-run this inventory against its exact reviewed
head; a new producer, consumer, or operational dependency resets the gate.

| Surface | Current responsibility | Required verification |
| --- | --- | --- |
| `apps/web/src/app/api/ai-jobs/route.ts` | The only current production creator for `storefront_layout_generation`. Its authenticated, CSRF-protected builder-edit POST inserts the job, then calls the trigger after response work. Its GET remains a tenant-scoped job reader. | `rg -n "storefront_layout_generation|triggerAiStorefrontWorker" apps/web/src/app/api/ai-jobs/route.ts` |
| `apps/web/src/schemas/ai-jobs.ts` | Defines the storefront job type, creation input, and draft-apply input. | `rg -n "storefront_layout_generation|storefrontLayoutJobInputSchema" apps/web/src/schemas/ai-jobs.ts` |
| `apps/web/src/app/api/ai-jobs/[id]/route.ts` and `apps/web/src/app/api/ai-jobs/[id]/apply/route.ts` | Authenticated, merchant-scoped read and explicit merchant draft-apply endpoints for completed storefront jobs. Applying uses `apply_ai_storefront_draft`; it must never be automatic. | `rg -n "storefront_layout_generation|apply_ai_storefront_draft" 'apps/web/src/app/api/ai-jobs/[id]'` |
| `apps/web/src/app/api/ai-jobs/worker/route.ts` | Deliberately does **not** process storefront layout jobs; it remains for short web-safe jobs such as `price_list_processing`. | `rg -n "price_list_processing|storefront_layout_generation" apps/web/src/app/api/ai-jobs/worker/route.ts` |
| `apps/web/src/app/api/builder/ai-draft-preview.ts`, `builder-load-payload.ts`, `apps/web/src/lib/store-readiness/load-store-readiness.ts`, and `apps/web/src/lib/store-build-status.ts` | Tenant-scoped consumers of storefront job state for Builder preview, Builder payload routing, store readiness, and the UI-facing build status. | `rg -n "storefront_layout_generation|result_applied_at|loadAiStorefrontDraftPreview|StorefrontBuildJob" apps/web/src/app/api/builder/ai-draft-preview.ts apps/web/src/app/api/builder/builder-load-payload.ts apps/web/src/lib/store-readiness/load-store-readiness.ts apps/web/src/lib/store-build-status.ts` |
| `apps/web/src/scripts/process-ai-storefront-jobs.ts` | Claims only due `pending` or expired-lease `processing` storefront jobs, records attempts/leases, and persists completed or failed outcomes. | `rg -n "storefront_layout_generation|lease_expires_at|result_applied_at" apps/web/src/scripts/process-ai-storefront-jobs.ts` |
| `apps/web/src/lib/ai-storefront/process-storefront-layout-job.ts`, `ollama-storefront-client.ts`, and normalizer files | Loads the starter page/product count, calls local Ollama, validates/normalizes the generated config, and returns an unapplied draft. | `rg -n "generateStorefrontLayoutWithOllama|normalizeAiStorefrontLayout" apps/web/src/lib/ai-storefront` |
| `apps/web/src/lib/ai-storefront/trigger-storefront-worker.ts` | Sends the signed web-to-VPS trigger; a missing URL or secret is a non-throwing `not_configured` result and leaves cron as recovery. | `rg -n "AI_STOREFRONT_TRIGGER|ai-storefront/trigger" apps/web/src/lib/ai-storefront/trigger-storefront-worker.ts` |
| `apps/web/src/env.ts` | Parses server-only Ollama storefront and trigger settings. `AI_STOREFRONT_GENERATION_ENABLED` is a compatibility-only no-op: it neither creates onboarding jobs nor pauses the worker. | `rg -n "OLLAMA_STOREFRONT|AI_STOREFRONT" apps/web/src/env.ts` |
| `vps-workers/bin/process-ai-storefront-jobs.sh` and `vps-workers/bin/run-web-script.sh` | VPS wrapper and TypeScript runner for the worker profile `ai-storefront-jobs`. | `rg -n "ai-storefront-jobs|process-ai-storefront-jobs" vps-workers/bin/process-ai-storefront-jobs.sh vps-workers/bin/run-web-script.sh` |
| `vps-workers/jobs/ai-storefront-trigger-server.mjs` and `vps-workers/deploy.sh` | Signed localhost trigger listener and the `baci-ai-storefront-trigger.service` user-service installation. | `rg -n "ai-storefront-trigger|baci-ai-storefront-trigger" vps-workers/jobs/ai-storefront-trigger-server.mjs vps-workers/deploy.sh` |
| `vps-workers/deploy.sh` and `vps-workers/jobs/deploy-crontab.test.mjs` | Ten-minute fallback sweep using `ai-storefront-jobs.lock` and the shared `ollama-workload.lock`. `ollama-workload.lock` is also used by agentic-commerce-health and must not be removed merely because storefront work retires. | `rg -n "ai-storefront-jobs.lock|ollama-workload.lock" vps-workers/deploy.sh vps-workers/jobs/deploy-crontab.test.mjs` |
| `supabase/migrations/20260510110000_extend_ai_jobs_for_storefront_generation.sql`, `20260525143500_fix_ai_storefront_apply_updated_at_ambiguity.sql`, and `20260611233642_consolidate_permissive_rls_policies.sql` | Existing job columns/indexes, atomic apply function, and authenticated owner/staff SELECT policy. These immutable migrations are historical evidence, not deletion targets. | `rg -n "storefront_layout_generation|result_applied_at|apply_ai_storefront_draft" supabase/migrations/20260510110000_extend_ai_jobs_for_storefront_generation.sql supabase/migrations/20260525143500_fix_ai_storefront_apply_updated_at_ambiguity.sql supabase/migrations/20260611233642_consolidate_permissive_rls_policies.sql` |
| `docs/ops/self-hosted-gemma-storefront-worker.md`, `docs/ops/vps-workers.md`, `vps-workers/README.md`, and this file | Current operational instructions and environment/trigger/runbook references. | `rg -n -i "ollama|storefront_layout_generation|ai-storefront" docs/ops vps-workers/README.md` |

The onboarding contract is an explicit non-producer check:

```bash
rg -n "storefront_layout_generation|triggerAiStorefrontWorker|ai_jobs" \
  'apps/web/src/app/(platform)/onboarding'
```

At the current baseline that command must find no onboarding production edge.
If a future change adds one, the zero-job window cannot begin until that edge is
removed and independently reviewed.

## Evidence Gate Before Decommission

The owner must approve all of the following in writing before a decommission PR
is opened:

1. Freeze the exact release SHA and the inventory above. Run the static checks
   in the table and the relevant local tests:

   ```bash
   pnpm --filter @baci/web exec vitest run \
     src/lib/ai-storefront/process-storefront-layout-job.test.ts \
     src/lib/ai-storefront/ollama-storefront-client.test.ts \
     src/lib/ai-storefront/trigger-storefront-worker.test.ts \
     src/scripts/process-ai-storefront-jobs.test.ts \
     src/app/api/ai-jobs/route.test.ts \
     'src/app/api/ai-jobs/[id]/apply/route.test.ts'
   pnpm --dir vps-workers test
   ```

2. Complete one **full enforced native release window** with zero new
   production `storefront_layout_generation` jobs. Before it starts, the owner
   records and validates `:release_start` and `:release_end` as RFC 3339 UTC
   timestamps with `release_start < release_end`, together with the current
   required mobile version floors, web release SHA, and evidence that older
   native clients cannot continue using an older producer. The audit uses the
   half-open interval `[release_start, release_end)` (`created_at >= start` and
   `created_at < end`), so adjacent windows neither overlap nor leave a boundary
   timestamp ambiguous. Start only after the floors are actually enforced, and
   set `release_end` only after enforcement has remained continuously in place;
   a build upload, staged rollout, or merge alone does not start or complete the
   window.

3. During that whole window, the approved read-only audit must show
   `new_in_window = 0` and no unresolved historical work: `pending = 0`,
   `processing = 0`, `failed = 0`, and `completed_unapplied = 0` for every
   in-scope merchant. `new_in_window` counts every job created in the window,
   including a job that has already completed or been applied. Any nonzero
   count, incomplete coverage, audit error, RLS visibility uncertainty, or
   evidence that the release/version enforcement changed aborts the gate.
   Preserve only redacted count receipts. After the cause is corrected and the
   enforcement evidence is revalidated, discard the prior interval and reset
   the window with a new validated `release_start`; do not retry, apply, delete,
   or reassign jobs as part of the audit.

4. Create an owner-approved, retention-bound backup before removal. It must
   preserve the database state needed to recover historical drafts and the
   reviewed worker configuration/revision, without copying plaintext secrets
   into a ticket, repository, terminal transcript, or this document. Verify a
   restore in an isolated non-production environment and retain only the
   secret-free receipt.

5. Name the abort and rollback owners before executing the PR. Abort immediately
   if a job is created, a queue count is nonzero, a trigger/sweep/service is
   still active after removal, a required source scan has a match, rollback
   validation fails, or the production release/version enforcement changes.

## Read-Only Merchant-Safe Queue Audit

Run this only in the later approved audit window. Use an authenticated
merchant-owner or builder-authorized read-only session that is already scoped by
RLS to one merchant. Bind `:merchant_id` from that authorized context; do not
use a service-role key, do not select `input`, `output`, `error`, `metadata`,
job IDs, customer data, or another merchant's rows.

```sql
-- Read-only aggregate for one RLS-authorized merchant.
SELECT
  count(*) FILTER (
    WHERE created_at >= :release_start::timestamptz
      AND created_at < :release_end::timestamptz
  ) AS new_in_window,
  count(*) FILTER (WHERE status = 'pending') AS pending,
  count(*) FILTER (WHERE status = 'processing') AS processing,
  count(*) FILTER (WHERE status = 'failed') AS failed,
  count(*) FILTER (
    WHERE status = 'completed' AND result_applied_at IS NULL
  ) AS completed_unapplied
FROM public.ai_jobs
WHERE merchant_id = :merchant_id::uuid
  AND type = 'storefront_layout_generation';
```

Bind only the validated release timestamps recorded for the complete window;
the query's creation count is deliberately independent of final status so that
completed or applied jobs cannot disappear from the gate. Record only the
merchant-safe aggregate counts, audit timestamp, release SHA, validated interval,
and authorized audit scope. A platform-wide conclusion requires complete
coverage of the in-scope merchant set through an owner-approved read-only
reporting mechanism; do not bypass RLS or infer missing merchants from an empty
result. The status `completed_unapplied` is intentionally included because a
completed draft remains merchant-controlled until the explicit apply route sets
`result_applied_at`.

## Dedicated Decommission PR

Only after the evidence gate passes, use a dedicated, exact-head reviewed PR.
It must not mix retirement with unrelated Builder, payment, queue, migration,
or deployment changes. The checklist is deliberately narrow:

- Remove the legacy storefront type's creation/trigger path from
  `apps/web/src/app/api/ai-jobs/route.ts`, while preserving other AI-job types.
- Remove storefront-specific read, preview, readiness, apply-route, schema,
  worker, Ollama client/normalizer, and tests only after confirming no other
  current caller. Do not remove the whole `ai_jobs` API or
  `/api/ai-jobs/worker`; price-list processing remains independent.
- Remove `vps-workers/bin/process-ai-storefront-jobs.sh`, the signed trigger
  server, its package script, and only the
  `baci-ai-storefront-trigger.service` install/enable path. Remove the
  ten-minute storefront fallback cron and `ai-storefront-jobs.lock`.
- Preserve `ollama-workload.lock` unless a fresh inventory also proves that
  agentic-commerce-health and every other consumer no longer needs it.
- Remove the trigger reverse-proxy endpoint `/ai-storefront/trigger` only after
  the service is gone and no producer remains. Remove only storefront-specific
  route handling; retain unrelated endpoints and worker services.
- Remove the parseable compatibility key
  `AI_STOREFRONT_GENERATION_ENABLED` **only in this approved gate PR**, after
  the producer/consumer audit. Review remaining storefront-specific Ollama and
  trigger configuration through secret management without printing values.
- Update or remove only the legacy storefront documentation and monitoring
  references in the inventory. Retain documentation for active hosted Builder,
  shared-text, price-list, and agentic-health paths.
- Do not alter existing migrations or delete historical `ai_jobs` rows merely
  to make the counts zero. Any schema or retention change requires its own
  approved migration plan and RLS review.

## Post-Removal Validation and Rollback

Before merge, require a fresh exact-head review, passing relevant web/VPS tests,
and a clean diff proving that no storefront trigger, fallback cron, dedicated
lock, service, endpoint, or compatibility flag reference remains. On the VPS,
the later approved operator verifies the intended absence without exposing
secrets:

```bash
systemctl --user is-active baci-ai-storefront-trigger.service
crontab -l | rg 'process-ai-storefront-jobs|ai-storefront-jobs.lock'
rg -n 'ai-storefront-trigger|process-ai-storefront-jobs|ai-storefront-jobs.lock' \
  /home/bassey/baci-workers
```

The expected result is inactive/absent storefront-specific service and cron
surfaces. A match for the shared `ollama-workload.lock` alone is not a failure
until its non-storefront consumers have been separately retired.

If any validation fails, do not patch production in place. Roll back by
reverting the dedicated PR, redeploying the previously reviewed pre-removal
revision through the normal prebuilt release process, and restoring the
service/cron/lock configuration from the verified backup through the secret
manager. Re-run the merchant-safe audit before any manual reprocessing. Never
auto-apply historical drafts or requeue failed jobs without explicit owner
approval.

This documentation task performs none of the remote audit, backup, service
decommission, cron removal, endpoint removal, deployment, or rollback steps.
