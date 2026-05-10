# Async Gemma Storefront Generation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Generate AI-designed Puck storefront drafts with self-hosted Gemma in the background while merchants continue onboarding and complete KYC before launch.

**Architecture:** Create a deterministic starter Puck storefront immediately, enqueue a `storefront_layout_generation` job in the existing `ai_jobs` table, process it through a repo-backed VPS-local worker that talks to Ollama on `localhost`, validate and normalize the model output into a safe Puck config, then expose it as an AI draft the merchant can preview/apply. Launch readiness remains gated by KYC, bank setup, product setup, and the existing publish API; AI design generation is a non-blocking build milestone, not a hard dependency for selling.

**Tech Stack:** Next.js 16 App Router, TypeScript, Zod, Supabase/Postgres/RLS, existing Puck builder, existing `ai_jobs` table, VPS-local TypeScript worker, Ollama/Gemma on VPS, Biome, Vitest/React Testing Library.

---

## Product Contract

- Starter store is created synchronously during onboarding using the existing deterministic template path.
- AI layout generation never blocks account creation, dashboard access, product creation, or KYC submission.
- AI output is never published automatically.
- AI output is saved as a draft candidate in `ai_jobs.output` and can be applied to `page_configs.draft_config` only after validation and merchant action.
- Public launch remains blocked by the existing KYC/payment/product publish gate.
- If Gemma fails, the merchant keeps the starter store and sees a retryable status.
- First release uses a small, safe AI component allowlist: `Header`, `Hero`, `Features`, `ProductGrid`, `TrustBadges`, `Newsletter`, `Footer`.
- Explicitly exclude risky or unstable blocks from model generation: `CodeEmbed`, `Map`, arbitrary HTML/JS, Instagram embeds, and any component that depends on third-party keys.

## Review Corrections To Apply Before Execution

- Keep AI job schemas before worker processing. Task 5 creates `storefrontLayoutJobInputSchema`; Task 6 imports it, so do not reorder those tasks during execution.
- Do not use invented Puck props in strict schemas. Align the AI layout schema and normalizer with the actual props in `apps/web/src/components/builder/config.tsx` and the simplified map in `apps/web/src/components/builder/component-schema.ts`.
- The existing VPS cron runs `/api/ai-jobs/worker` daily at 02:00. Do not use that web route for Gemma storefront generation. Add a VPS-local worker script for `storefront_layout_generation` and schedule it every 1-2 minutes with `flock` preventing overlap.
- Do not call mutating APIs with raw `fetch` from client components. The apply action must use `fetchWithCsrf` from `apps/web/src/lib/api-client.ts`.
- Applying an AI draft must not silently overwrite merchant edits made while Gemma was generating. Store the page config `updated_at` used for generation, compare it when applying, and return `409` unless the user explicitly confirms replacement.
- Use storefront-specific Ollama environment variables. Do not overload the CAC verification `OLLAMA_BASE_URL` path unless both use cases are intentionally served by the same authenticated gateway.
- Long Gemma jobs must not run through the web worker route. The web route can remain for short `price_list_processing` jobs, but storefront generation must run through the repo-backed VPS script with batch size `1` and local/private Ollama access.
- VPS TypeScript worker scripts must import `dotenv/config` before reading env vars. `run-web-script.sh` sets `DOTENV_CONFIG_PATH`, but dotenv still has to be loaded by the script.
- AI draft preview fields must be added to both `BuilderLoadResponse` and `BuilderLoadPayload`; otherwise the builder client/API changes will not typecheck.
- Apply handlers must treat `409 ai_draft_stale` as an explicit replacement-confirmation flow, malformed JSON as `400`, and apply persistence as an atomic RPC operation.
- Applying an AI draft must be atomic. Use a Postgres RPC so `page_configs.draft_config` and `ai_jobs.result_applied_at` change in one database transaction, not as two independent API updates.
- The apply RPC must be a narrowly scoped definer function because `ai_jobs` intentionally has no merchant UPDATE RLS policy. The function must perform its own `auth.uid()` owner/staff builder-edit authorization check before touching rows.
- Staff with builder access must be able to read `storefront_layout_generation` jobs for readiness, preview, and apply flows. Add a narrow SELECT policy for that job type only; do not grant staff read access to every `ai_jobs` type.
- Preview permission and apply permission must be separate. Staff with `builder.view` can preview AI drafts, but Apply AI design must only render when `canApplyAiDraft` is true from owner or `builder.edit` access.
- The apply RPC must set `page_configs.updated_at` in the same update as `draft_config`; stale-draft protection depends on that timestamp advancing every time the builder draft changes.
- Worker claims must use leases (`locked_by`, `locked_at`, `lease_expires_at`) so crashed VPS runs can be recovered automatically.
- Onboarding must use an idempotency key for `storefront_layout_generation` jobs so duplicate form submissions do not enqueue duplicate AI builds, including duplicate submits after the first job completed.
- Storefront generation must be behind a rollout flag and must write enough metadata for production monitoring: queue wait, generation duration, model, worker id, validation failures, and retry count.
- TestFlight AI Copilot failures shown as `Failed to process AI request` map to `apps/mobile-admin/hooks/useBuilderConfig.ts` posting to `/api/builder/gemini`; that exact string is returned only by the web route's generic `500` catch after the route has entered server-side AI generation or generated-output validation. Do not treat this as a UI-only issue. Add structured server error codes, request IDs, mobile-specific error messages, centralized mobile API-client usage, and a fallback UX before production rollout.
- Main already has migrations after April 28, 2026. Use a new migration timestamp after the current main tip, `20260510110000_extend_ai_jobs_for_storefront_generation.sql`, and keep every plan reference aligned to that filename.
- Every worker claim, success update, and failure update must check both Supabase `error` and whether the lease-scoped update returned a row. Silent persistence failures create duplicate generation and stuck jobs.

## Phase Map And Required Review Gates

Each phase below is a stop-the-line checkpoint. Do not start the next phase until the current phase review gate is passed, documented in the implementation notes, and any P1/P2 findings are fixed or explicitly deferred by the product owner. A phase gate is not a general “looks good” review; it must check the phase-specific failure modes listed here.

### Phase 0: Preflight Plan Gate

**Covers:** task ordering, file list completeness, and execution safety before code changes.

**Required before Task 1 starts:**

- Confirm Task 5 (`apps/web/src/schemas/ai-jobs.ts`) is executed before Task 6 (`apps/web/src/scripts/process-ai-storefront-jobs.ts`). The worker must not import `storefrontLayoutJobInputSchema` before the schema task exists.
- Confirm `apps/web/src/types/builder.ts` is listed anywhere builder preview response fields are added. `BuilderClient` casts the API payload to `BuilderLoadResponse`, so missing type fields are compile blockers.
- Confirm the web `/api/ai-jobs/worker` remains scoped to short jobs only; storefront generation must be assigned to the VPS script.
- Confirm the implementation will not modify existing Supabase migrations, `apps/web/src/proxy.ts`, or `.env*` files.

**Review evidence required:**

```bash
rg -n "storefrontLayoutJobInputSchema|BuilderLoadResponse|process-ai-storefront-jobs|/api/ai-jobs/worker" docs/superpowers/plans/2026-04-28-async-gemma-storefront-generation.md
```

Expected: schema work appears before worker work, builder type file appears in the file list, and storefront jobs are described as VPS-worker work rather than web-worker work.

### Phase 1: Database, RLS, And Atomic Apply Gate

**Covers:** Task 1.

**Required before Task 2 starts:**

- The migration creates the queue columns and indexes without editing older migrations.
- The apply path uses a narrowly scoped `SECURITY DEFINER` RPC, not a `SECURITY INVOKER` function that depends on a missing `ai_jobs` UPDATE RLS policy.
- The RPC performs its own `auth.uid()` owner or staff `builder.edit` authorization check before updating any row.
- The RPC updates `page_configs.draft_config`, advances `page_configs.updated_at`, and sets `ai_jobs.result_applied_at` in one database transaction.
- The RPC returns explicit codes for `unauthorized`, `forbidden`, `job_not_found`, `page_config_not_found`, and `ai_draft_stale`.
- A narrow staff SELECT policy exists for `type = 'storefront_layout_generation'` only, so staff with builder access can preview/apply/read readiness without broad access to every AI job type.

**Review evidence required:**

```bash
rg -n "SECURITY DEFINER|check_staff_permission|result_applied_at|updated_at =|ai_draft_stale|Staff can view storefront generation jobs" supabase/migrations/20260510110000_extend_ai_jobs_for_storefront_generation.sql
pnpm supabase db lint
```

Expected: all critical strings are present. `pnpm supabase db lint` must pass against a running local Supabase DB; if the local DB is unavailable, record the blocker and run it before merge.

### Phase 2: Schemas, Normalizer, And Ollama Client Gate

**Covers:** Tasks 2-5.

**Required before Task 6 starts:**

- The AI layout schema is strict and allowlists only safe storefront components.
- Unsafe components such as `CodeEmbed`, arbitrary HTML/JS, map embeds, and third-party embeds are rejected.
- The normalizer produces a valid `BuilderConfigInput` and preserves the deterministic starter config shape.
- The Ollama client uses storefront-specific env getters, validates HTTPS except local URLs, sends structured JSON format, and enforces a timeout.
- `storefrontLayoutJobInputSchema` and `createAiJobSchema` exist before worker code imports them.

**Review evidence required:**

```bash
pnpm --filter @baci/web test \
  src/schemas/ai-storefront-layout.test.ts \
  src/schemas/ai-jobs.test.ts \
  src/schemas/builder.test.ts \
  src/lib/ai-storefront/normalize-ai-storefront-layout.test.ts \
  src/lib/ai-storefront/ollama-storefront-client.test.ts
pnpm turbo typecheck --filter=@baci/web
```

Expected: tests and typecheck pass. Any schema looseness must be reviewed as a security issue, not a style issue.

### Phase 3: VPS Worker And Queue Processing Gate

**Covers:** Task 6.

**Required before Task 7 starts:**

- `apps/web/src/scripts/process-ai-storefront-jobs.ts` imports `dotenv/config` as the first executable import so VPS runs load `.env`.
- The storefront worker batch size is capped at `1`.
- The storefront worker claims only `type = 'storefront_layout_generation'`.
- Claims use `locked_by`, `locked_at`, and `lease_expires_at` so crashed runs can be recovered.
- Failed jobs increment attempts, write retry metadata, and release the lease.
- The existing web worker route excludes storefront jobs and remains limited to short `price_list_processing`.

**Review evidence required:**

```bash
head -5 apps/web/src/scripts/process-ai-storefront-jobs.ts
rg -n "MAX_BATCH_SIZE = 1|storefront_layout_generation|locked_by|lease_expires_at|price_list_processing" apps/web/src/scripts/process-ai-storefront-jobs.ts apps/web/src/app/api/ai-jobs/worker/route.ts
pnpm --filter @baci/web test \
  src/lib/ai-storefront/process-storefront-layout-job.test.ts \
  src/scripts/process-ai-storefront-jobs.test.ts \
  src/app/api/ai-jobs/worker/route.test.ts
```

Expected: first lines include `import 'dotenv/config';`, worker tests pass, and no storefront Gemma call is routed through `/api/ai-jobs/worker`.

### Phase 4: Onboarding And Apply API Gate

**Covers:** Tasks 7-8.

**Required before Task 9 starts:**

- Onboarding checks `page_configs.insert(...).select('updated_at').single()` errors before enqueueing AI work.
- Starter store creation failure prevents onboarding success because the immediate fallback store is the product guarantee.
- AI enqueue failure is logged and non-blocking after the starter store exists.
- The apply endpoint allows an empty body but returns `400` for malformed JSON.
- The apply endpoint compares current `page_configs.updated_at` to `output.generatedAgainstUpdatedAt` and returns `409 ai_draft_stale` unless `{ force: true }` is explicitly supplied.
- The apply endpoint calls the atomic RPC and does not independently update `page_configs` or `ai_jobs.result_applied_at`.

**Review evidence required:**

```bash
rg -n "page_configs|select\\('updated_at'\\)|ai_draft_stale|Invalid JSON body|apply_ai_storefront_draft|force" apps/web/src/app/onboarding/actions.ts 'apps/web/src/app/api/ai-jobs/[jobId]/apply/route.ts'
pnpm --filter @baci/web test \
  src/app/onboarding/actions.test.ts \
  src/app/api/ai-jobs/route.test.ts \
  'src/app/api/ai-jobs/[jobId]/apply/route.test.ts'
```

Expected: onboarding tests prove starter insert failure blocks success, and apply route tests prove malformed JSON, stale conflict, and forced apply behavior.

### Phase 5: Builder Preview, Dashboard, And Staff Permission Gate

**Covers:** Tasks 9-10.

**Required before Task 10.5 starts:**

- Readiness includes the latest storefront AI job status and `canApplyAiDraft` based on owner or `builder.edit`.
- Builder API preview mode loads completed storefront draft jobs for users with `builder.view`.
- `BuilderLoadPayload` and `BuilderLoadResponse` both include `previewMode`, `aiDraftJobId`, and `canApplyAiDraft`.
- Builder preview renders Apply AI design only when `canApplyAiDraft` is true.
- Dashboard card renders Preview for view-capable staff but hides Apply AI design unless `canApplyAiDraft` is true.
- Builder and dashboard apply handlers both treat `409 ai_draft_stale` as a confirmation flow and retry with `{ force: true }`.

**Review evidence required:**

```bash
rg -n "previewMode|aiDraftJobId|canApplyAiDraft|ai_draft_stale|force: true" apps/web/src/types/builder.ts apps/web/src/app/api/builder apps/web/src/app/builder/builder-client.tsx apps/web/src/components/dashboard/store-build-status-card.tsx
pnpm --filter @baci/web test \
  src/app/api/merchant/readiness/route.test.ts \
  src/app/api/builder/route.test.ts \
  src/app/api/builder/builder-route-utils.test.ts \
  src/app/builder/builder-client.test.tsx \
  src/components/dashboard/store-build-status-card.test.tsx
pnpm turbo typecheck --filter=@baci/web
```

Expected: view-only staff can preview without seeing Apply, edit-capable users can apply, stale applies ask for confirmation, and typecheck proves the response fields are wired.

### Phase 5.5: Mobile AI Copilot Compatibility Gate

**Covers:** Task 10.5.

**Required before Task 11 starts:**

- The TestFlight failure path is addressed explicitly: `apps/mobile-admin/hooks/useBuilderConfig.ts` no longer posts to `/api/builder/gemini` through raw `fetch` or a hard-coded `WEB_API_BASE`.
- Mobile AI editing uses `apiClient` from `apps/mobile-admin/lib/api-client.ts` so production base URL resolution, Bearer auth, timeout handling, and structured `NetworkError.data` parsing are consistent with the rest of the mobile app.
- `/api/builder/gemini` returns stable JSON error payloads with `code` and `requestId`; it must not return the opaque user-facing string `Failed to process AI request`.
- Provider/model/quota/output-validation failures return a client-safe message such as `AI editor is temporarily unavailable`, plus `code: 'ai_provider_unavailable'` or `code: 'ai_builder_invalid_output'`.
- Rate limits return `code: 'rate_limited'`, status `429`, and a retry delay that the mobile UI renders as a wait message.
- The synchronous mobile edit route uses a short retry policy and bounded timeout; it must not behave like a long background storefront-generation job that leaves TestFlight stuck on `Thinking...`.
- Server logs include `requestId`, `userId`, `merchantId`, model name, prompt length, config component count, and sanitized error name/message so production logs can identify whether the cause is API key, model availability, quota, timeout, or schema validation.
- Mobile UI keeps the current draft safe on every AI-edit failure, clears the thinking state, and shows an actionable message rather than repeating the generic failure bubble.
- If synchronous Gemini editing is unavailable or disabled, mobile tells the merchant to continue onboarding while the async Gemma storefront build continues; do not block KYC, product setup, or starter-store editing.

**Review evidence required:**

```bash
! rg -n "WEB_API_BASE|Failed to process AI request" apps/mobile-admin/hooks/useBuilderConfig.ts apps/web/src/app/api/builder/gemini/route.ts
rg -n "apiClient|NetworkError|formatAiCopilotError|ai_provider_unavailable|ai_builder_invalid_output|rate_limited|requestId|ACTIVE_TEXT_MODEL_NAME" apps/mobile-admin/hooks apps/web/src/ai/provider.ts apps/web/src/app/api/builder/gemini
pnpm --filter baci-mobile-admin test hooks/useBuilderConfig.test.ts hooks/format-ai-copilot-error.test.ts
pnpm --filter @baci/web test \
  src/app/api/builder/gemini/route.test.ts \
  src/app/api/builder/gemini/route.error-codes.test.ts
pnpm turbo typecheck --filter=baci-mobile-admin
pnpm turbo typecheck --filter=@baci/web
```

Expected: the mobile hook uses the centralized API client, web route errors are diagnosable by `requestId`, provider failures do not leak internals, and the TestFlight UI can no longer get stuck with only a generic failure bubble.

### Phase 6: VPS Production Wiring Gate

**Covers:** Task 11.

**Required before Task 12 starts:**

- VPS docs and scripts run the repo-backed worker, not the Next.js web worker route.
- Cron/systemd cadence is 1-2 minutes with `flock` or equivalent overlap prevention.
- Required env vars are documented: Supabase URL, service role key, `OLLAMA_STOREFRONT_BASE_URL`, optional auth, model, timeout, rollout flag, and worker id.
- Ollama access remains local/private or authenticated; do not expose unauthenticated Ollama publicly.
- A dry-run or smoke command is documented for operators.

**Review evidence required:**

```bash
rg -n "process-ai-storefront-jobs|flock|OLLAMA_STOREFRONT|AI_STOREFRONT_GENERATION_ENABLED|service role|localhost" docs/ops vps-workers apps/web/src/scripts/process-ai-storefront-jobs.ts
```

Expected: ops docs and scripts all point to the storefront worker script, with no instructions to run long Gemma jobs through `/api/ai-jobs/worker`.

### Phase 7: Rollout, Observability, And Final Release Gate

**Covers:** Tasks 12-13.

**Required before merge or production enablement:**

- Rollout flag defaults to off.
- Metrics or logs capture queue wait, generation duration, model, worker id, validation failures, retry count, stale apply count, and apply success/failure count.
- Visual QA covers starter-store fallback, queued, processing, ready, stale confirm, applied, failed, and view-only staff states.
- Final quality gate runs lint, typecheck, focused tests, full web tests, Supabase lint, and CodeRabbit/manual review.
- Any unavailable external gate, such as CodeRabbit rate limit or local Supabase unavailable, is recorded as a blocker and must be rerun before merge.

**Review evidence required:**

```bash
pnpm turbo lint --filter=@baci/web
pnpm turbo typecheck --filter=@baci/web
pnpm --filter @baci/web test \
  src/schemas/ai-storefront-layout.test.ts \
  src/schemas/ai-jobs.test.ts \
  src/lib/ai-storefront/normalize-ai-storefront-layout.test.ts \
  src/lib/ai-storefront/ollama-storefront-client.test.ts \
  src/lib/ai-storefront/process-storefront-layout-job.test.ts \
  src/scripts/process-ai-storefront-jobs.test.ts \
  src/app/api/ai-jobs/route.test.ts \
  src/app/api/ai-jobs/worker/route.test.ts \
  'src/app/api/ai-jobs/[jobId]/apply/route.test.ts' \
  src/app/onboarding/actions.test.ts \
  src/app/api/merchant/readiness/route.test.ts \
  src/app/api/builder/route.test.ts \
  src/app/api/builder/builder-route-utils.test.ts \
  src/app/builder/builder-client.test.tsx \
  src/components/dashboard/store-build-status-card.test.tsx \
  src/app/api/builder/gemini/route.test.ts \
  src/app/api/builder/gemini/route.error-codes.test.ts
pnpm --filter baci-mobile-admin test \
  hooks/useBuilderConfig.test.ts \
  hooks/format-ai-copilot-error.test.ts
pnpm turbo test --filter=@baci/web
pnpm turbo test --filter=baci-mobile-admin
pnpm supabase db lint
coderabbit review --prompt-only -t uncommitted
```

Expected: every command passes. If `pnpm supabase db lint` or CodeRabbit cannot run due local DB or account limits, this phase remains blocked until those checks are completed or the product owner explicitly accepts the risk.

## File Structure

### Database
- Create: `supabase/migrations/20260510110000_extend_ai_jobs_for_storefront_generation.sql`

### Schemas And Validation
- Create: `apps/web/src/schemas/ai-storefront-layout.ts`
- Create: `apps/web/src/schemas/ai-storefront-layout.test.ts`
- Modify: `apps/web/src/schemas/builder.ts`
- Modify: `apps/web/src/schemas/builder.test.ts`

### AI Storefront Library
- Create: `apps/web/src/lib/ai-storefront/normalize-ai-storefront-layout.ts`
- Create: `apps/web/src/lib/ai-storefront/normalize-ai-storefront-layout.test.ts`
- Create: `apps/web/src/lib/ai-storefront/ollama-storefront-client.ts`
- Create: `apps/web/src/lib/ai-storefront/ollama-storefront-client.test.ts`
- Create: `apps/web/src/lib/ai-storefront/process-storefront-layout-job.ts`
- Create: `apps/web/src/lib/ai-storefront/process-storefront-layout-job.test.ts`

### AI Jobs API And Worker
- Create: `apps/web/src/schemas/ai-jobs.ts`
- Create: `apps/web/src/schemas/ai-jobs.test.ts`
- Modify: `apps/web/src/app/api/ai-jobs/route.ts`
- Modify: `apps/web/src/app/api/ai-jobs/worker/route.ts`
- Create: `apps/web/src/scripts/process-ai-storefront-jobs.ts`
- Create: `apps/web/src/scripts/process-ai-storefront-jobs.test.ts`
- Create: `apps/web/src/app/api/ai-jobs/[jobId]/apply/route.ts`
- Create: `apps/web/src/app/api/ai-jobs/[jobId]/apply/route.test.ts`

### Onboarding
- Modify: `apps/web/src/app/onboarding/actions.ts`
- Modify: `apps/web/src/app/onboarding/actions.test.ts`

### Readiness API And Dashboard UI
- Modify: `apps/web/src/app/api/merchant/readiness/route.ts`
- Modify: `apps/web/src/app/api/merchant/readiness/route.test.ts`
- Modify: `apps/web/src/app/api/builder/route.ts`
- Modify: `apps/web/src/app/api/builder/route.test.ts`
- Modify: `apps/web/src/app/api/builder/builder-route-utils.ts`
- Modify: `apps/web/src/app/api/builder/builder-route-utils.test.ts`
- Modify: `apps/web/src/app/builder/builder-client.tsx`
- Modify: `apps/web/src/app/builder/builder-client.test.tsx`
- Modify: `apps/web/src/types/builder.ts`
- Create: `apps/web/src/components/dashboard/store-build-status-card.tsx`
- Create: `apps/web/src/components/dashboard/store-build-status-card.test.tsx`
- Modify: `apps/web/src/app/dashboard/client-page.tsx`

### Mobile Admin AI Copilot Compatibility
- Create: `apps/mobile-admin/hooks/format-ai-copilot-error.ts`
- Create: `apps/mobile-admin/hooks/format-ai-copilot-error.test.ts`
- Modify: `apps/mobile-admin/hooks/useBuilderConfig.ts`
- Create: `apps/mobile-admin/hooks/useBuilderConfig.test.ts`
- Modify: `apps/web/src/app/api/builder/gemini/route.ts`
- Modify: `apps/web/src/app/api/builder/gemini/route.test.ts`
- Create: `apps/web/src/app/api/builder/gemini/route.error-codes.test.ts`
- Modify: `apps/web/src/ai/provider.ts`

### Environment And Ops Docs
- Modify: `apps/web/src/env.ts`
- Create: `docs/ops/self-hosted-gemma-storefront-worker.md`
- Create: `vps-workers/bin/process-ai-storefront-jobs.sh`
- Modify: `vps-workers/deploy.sh`
- Modify: `vps-workers/README.md`
- Modify: `docs/ops/vps-workers.md`

---

## Task 1: Extend `ai_jobs` For Background Storefront Generation

**Files:**
- Create: `supabase/migrations/20260510110000_extend_ai_jobs_for_storefront_generation.sql`

- [ ] **Step 1: Create the migration**

Do not add a broad merchant `UPDATE` policy on `ai_jobs`. The only path that marks `result_applied_at` is the `apply_ai_storefront_draft` RPC below, and it must recheck owner/staff `builder.edit` access before bypassing RLS as a definer function.

```sql
ALTER TABLE public.ai_jobs
  ADD COLUMN IF NOT EXISTS attempts integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS max_attempts integer NOT NULL DEFAULT 3,
  ADD COLUMN IF NOT EXISTS next_run_at timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS model text,
  ADD COLUMN IF NOT EXISTS result_applied_at timestamptz,
  ADD COLUMN IF NOT EXISTS locked_at timestamptz,
  ADD COLUMN IF NOT EXISTS locked_by text,
  ADD COLUMN IF NOT EXISTS lease_expires_at timestamptz,
  ADD COLUMN IF NOT EXISTS idempotency_key text,
  ADD COLUMN IF NOT EXISTS metadata jsonb NOT NULL DEFAULT '{}'::jsonb;

CREATE INDEX IF NOT EXISTS idx_ai_jobs_storefront_generation_queue
  ON public.ai_jobs (type, status, next_run_at, lease_expires_at, created_at)
  WHERE type = 'storefront_layout_generation';

CREATE INDEX IF NOT EXISTS idx_ai_jobs_merchant_type_created_at
  ON public.ai_jobs (merchant_id, type, created_at DESC);

CREATE UNIQUE INDEX IF NOT EXISTS idx_ai_jobs_storefront_active_idempotency
  ON public.ai_jobs (merchant_id, type, idempotency_key)
  WHERE type = 'storefront_layout_generation'
    AND idempotency_key IS NOT NULL
    AND status IN ('pending', 'processing', 'completed');

CREATE POLICY "Staff can view storefront generation jobs"
  ON public.ai_jobs
  FOR SELECT
  TO authenticated
  USING (
    type = 'storefront_layout_generation'
    AND (
      EXISTS (
        SELECT 1
        FROM public.merchants m
        WHERE m.id = ai_jobs.merchant_id
          AND m.user_id = (SELECT auth.uid())
      )
      OR
      public.check_staff_permission(
        (SELECT auth.uid()),
        merchant_id,
        'builder',
        'view'
      )
      OR public.check_staff_permission(
        (SELECT auth.uid()),
        merchant_id,
        'builder',
        'edit'
      )
    )
  );

CREATE OR REPLACE FUNCTION public.apply_ai_storefront_draft(
  p_job_id uuid,
  p_merchant_id uuid,
  p_page_slug text,
  p_generated_config jsonb,
  p_generated_against_updated_at timestamptz,
  p_force boolean DEFAULT false
)
RETURNS TABLE (
  applied boolean,
  code text,
  page_config_id uuid,
  updated_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_actor_id uuid := auth.uid();
  v_authorized boolean := false;
  v_job_id uuid;
  v_page_config_id uuid;
  v_current_updated_at timestamptz;
  v_next_updated_at timestamptz;
BEGIN
  IF v_actor_id IS NULL THEN
    RETURN QUERY SELECT false, 'unauthorized'::text, NULL::uuid, NULL::timestamptz;
    RETURN;
  END IF;

  SELECT EXISTS (
      SELECT 1
      FROM public.merchants m
      WHERE m.id = p_merchant_id
        AND m.user_id = v_actor_id
    )
    OR public.check_staff_permission(v_actor_id, p_merchant_id, 'builder', 'edit')
    INTO v_authorized;

  IF NOT v_authorized THEN
    RETURN QUERY SELECT false, 'forbidden'::text, NULL::uuid, NULL::timestamptz;
    RETURN;
  END IF;

  SELECT id
    INTO v_job_id
    FROM public.ai_jobs
    WHERE id = p_job_id
      AND merchant_id = p_merchant_id
      AND type = 'storefront_layout_generation'
      AND status = 'completed'
    FOR UPDATE;

  IF NOT FOUND THEN
    RETURN QUERY SELECT false, 'job_not_found'::text, NULL::uuid, NULL::timestamptz;
    RETURN;
  END IF;

  SELECT id, updated_at
    INTO v_page_config_id, v_current_updated_at
    FROM public.page_configs
    WHERE merchant_id = p_merchant_id
      AND page_slug = p_page_slug
    FOR UPDATE;

  IF NOT FOUND THEN
    RETURN QUERY SELECT false, 'page_config_not_found'::text, NULL::uuid, NULL::timestamptz;
    RETURN;
  END IF;

  IF NOT p_force AND v_current_updated_at IS DISTINCT FROM p_generated_against_updated_at THEN
    RETURN QUERY SELECT false, 'ai_draft_stale'::text, v_page_config_id, v_current_updated_at;
    RETURN;
  END IF;

  UPDATE public.page_configs
    SET draft_config = p_generated_config,
        updated_at = clock_timestamp()
    WHERE id = v_page_config_id
    RETURNING page_configs.updated_at INTO v_next_updated_at;

  UPDATE public.ai_jobs
    SET result_applied_at = clock_timestamp(),
        metadata = COALESCE(metadata, '{}'::jsonb)
          || jsonb_build_object('lastAppliedPageConfigUpdatedAt', v_next_updated_at)
    WHERE id = p_job_id
      AND merchant_id = p_merchant_id
      AND type = 'storefront_layout_generation'
      AND status = 'completed';

  IF NOT FOUND THEN
    RAISE EXCEPTION 'AI storefront job % was not found while marking applied', p_job_id;
  END IF;

  RETURN QUERY SELECT true, NULL::text, v_page_config_id, v_next_updated_at;
END;
$$;

ALTER FUNCTION public.apply_ai_storefront_draft(
  uuid, uuid, text, jsonb, timestamptz, boolean
) OWNER TO postgres;

REVOKE ALL ON FUNCTION public.apply_ai_storefront_draft(
  uuid, uuid, text, jsonb, timestamptz, boolean
) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.apply_ai_storefront_draft(
  uuid, uuid, text, jsonb, timestamptz, boolean
) TO authenticated;

COMMENT ON COLUMN public.ai_jobs.attempts IS
  'Number of processing attempts made by background workers.';

COMMENT ON COLUMN public.ai_jobs.max_attempts IS
  'Maximum attempts before the job is left failed for manual retry.';

COMMENT ON COLUMN public.ai_jobs.next_run_at IS
  'Earliest time a background worker should attempt this job.';

COMMENT ON COLUMN public.ai_jobs.model IS
  'Model used by the worker, for example gemma4:e4b.';

COMMENT ON COLUMN public.ai_jobs.result_applied_at IS
  'When a completed generated result was applied to the merchant builder draft.';

COMMENT ON COLUMN public.ai_jobs.locked_at IS
  'When a worker last claimed this job for processing.';

COMMENT ON COLUMN public.ai_jobs.locked_by IS
  'Stable worker id that currently owns the processing lease.';

COMMENT ON COLUMN public.ai_jobs.lease_expires_at IS
  'When a processing lease expires and another worker may reclaim the job.';

COMMENT ON COLUMN public.ai_jobs.idempotency_key IS
  'Deduplication key for job creators such as onboarding.';

COMMENT ON COLUMN public.ai_jobs.metadata IS
  'Non-authoritative processing metadata such as latency, validation notes, and conflict status.';
```

- [ ] **Step 2: Run migration syntax check locally**

Run:

```bash
pnpm supabase db lint
```

Expected: no SQL lint errors for the new migration. If the project does not have Supabase CLI configured locally, run the migration in a local Supabase branch or mark this verification as blocked with the exact missing command output.

- [ ] **Step 3: Verify RLS intent in migration review**

Confirm the migration adds only:
- A narrow `SELECT` policy for `storefront_layout_generation` jobs so staff with `builder.view` or `builder.edit` can load readiness status and AI drafts.
- A scoped definer RPC for applying drafts.

Do not add direct merchant/staff `UPDATE` policies on `ai_jobs`; applying remains RPC-only.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/20260510110000_extend_ai_jobs_for_storefront_generation.sql
git commit -m "feat: extend ai jobs for storefront generation"
```

---

## Task 2: Define Strict AI Storefront Layout Schemas

**Files:**
- Create: `apps/web/src/schemas/ai-storefront-layout.ts`
- Create: `apps/web/src/schemas/ai-storefront-layout.test.ts`
- Modify: `apps/web/src/schemas/builder.ts`
- Modify: `apps/web/src/schemas/builder.test.ts`

- [ ] **Step 1: Write failing schema tests**

Add tests that prove the AI subset accepts safe components and rejects unsafe/freeform output.

```ts
import { describe, expect, it } from 'vitest';
import {
  aiStorefrontComponentSchema,
  aiStorefrontLayoutSchema,
  aiStorefrontThemeSchema,
} from './ai-storefront-layout';

describe('aiStorefrontLayoutSchema', () => {
  it('accepts a minimal safe commerce layout', () => {
    const result = aiStorefrontLayoutSchema.safeParse({
      theme: {
        primary: '#111827',
        accent: '#f59e0b',
        background: '#ffffff',
      },
      sections: [
        { type: 'Header', props: { id: 'header', showLogo: true, showSearch: true } },
        {
          type: 'Hero',
          props: {
            id: 'hero',
            title: 'Premium phones delivered fast',
            subtitle: 'Shop trusted devices, accessories, and repair essentials.',
            ctaText: 'Shop now',
          },
        },
        {
          type: 'ProductGrid',
          props: {
            id: 'products',
            title: 'Featured products',
            limit: 8,
          },
        },
        { type: 'Footer', props: { id: 'footer', showQuickLinks: true, showNewsletter: false } },
      ],
    });

    expect(result.success).toBe(true);
  });

  it('rejects unsafe CodeEmbed output', () => {
    const result = aiStorefrontComponentSchema.safeParse({
      type: 'CodeEmbed',
      props: { id: 'x', code: '<script>alert(1)</script>' },
    });

    expect(result.success).toBe(false);
  });

  it('rejects non-hex theme colors', () => {
    const result = aiStorefrontThemeSchema.safeParse({
      primary: 'javascript:alert(1)',
    });

    expect(result.success).toBe(false);
  });
});
```

Run:

```bash
pnpm --filter @baci/web test src/schemas/ai-storefront-layout.test.ts
```

Expected: FAIL because the schema file does not exist yet.

- [ ] **Step 2: Implement the strict schema**

Create `apps/web/src/schemas/ai-storefront-layout.ts`:

```ts
import { z } from 'zod';

const hexColorSchema = z
  .string()
  .trim()
  .regex(/^#[0-9a-fA-F]{6}$/, 'Expected a 6-digit hex color');

const shortTextSchema = z.string().trim().min(1).max(120);
const mediumTextSchema = z.string().trim().min(1).max(240);
const optionalShortTextSchema = shortTextSchema.optional();
const optionalMediumTextSchema = mediumTextSchema.optional();
const safeHrefSchema = z
  .string()
  .trim()
  .min(1)
  .max(200)
  .refine(
    (value) => value.startsWith('/') || value.startsWith('https://'),
    'Expected an internal path or HTTPS URL'
  );

const basePropsSchema = z
  .object({
    id: z.string().trim().min(1).max(80),
  })
  .strict();

const linkSchema = z
  .object({
    label: shortTextSchema,
    url: safeHrefSchema,
  })
  .strict();

const iconNameSchema = z
  .enum([
    'award',
    'check',
    'headphones',
    'refresh-cw',
    'shield-check',
    'star',
    'truck',
  ])
  .default('check');

const headerComponentSchema = z.object({
  type: z.literal('Header'),
  props: basePropsSchema.extend({
    showLogo: z.boolean().default(true),
    showSearch: z.boolean().default(true),
    showCart: z.boolean().default(true),
    showMenu: z.boolean().default(true),
    sticky: z.boolean().default(true),
    navigationLinks: z.array(linkSchema).min(1).max(6).optional(),
    ctaButton: z
      .object({
        show: z.boolean().default(false),
        text: optionalShortTextSchema,
        url: safeHrefSchema.optional(),
      })
      .strict()
      .optional(),
    layout: z
      .enum(['logo-left-nav-center', 'logo-left-nav-right', 'logo-center'])
      .default('logo-left-nav-center'),
    searchStyle: z.enum(['outline', 'filled', 'minimal']).default('outline'),
    searchRadius: z.enum(['none', 'sm', 'md', 'full']).default('md'),
    paddingY: z.enum(['sm', 'md', 'lg']).default('md'),
    glassEffect: z.boolean().default(false),
  }),
});

const heroComponentSchema = z.object({
  type: z.literal('Hero'),
  props: basePropsSchema.extend({
    title: shortTextSchema,
    subtitle: optionalMediumTextSchema,
    ctaText: optionalShortTextSchema,
    ctaLink: safeHrefSchema.default('/products'),
    backgroundImage: z.string().trim().url().startsWith('https://').optional(),
    overlay: z.boolean().default(false),
    align: z.enum(['left', 'center', 'right']).default('center'),
    padding: z.enum(['small', 'medium', 'large']).default('medium'),
    headingLevel: z.enum(['h1', 'h2', 'div']).default('h1'),
  }),
});

const featureItemSchema = z
  .object({
    title: shortTextSchema,
    description: mediumTextSchema,
    icon: iconNameSchema,
  })
  .strict();

const featuresComponentSchema = z.object({
  type: z.literal('Features'),
  props: basePropsSchema.extend({
    title: optionalShortTextSchema,
    subtitle: optionalMediumTextSchema,
    columns: z.union([z.literal(2), z.literal(3), z.literal(4)]).default(3),
    features: z.array(featureItemSchema).min(2).max(6),
  }),
});

const productGridComponentSchema = z.object({
  type: z.literal('ProductGrid'),
  props: basePropsSchema.extend({
    title: optionalShortTextSchema,
    columns: z.number().int().min(1).max(4).default(3),
    limit: z.number().int().min(4).max(12).default(8),
    category: z.string().trim().max(80).optional(),
    sortBy: z.enum(['newest', 'price-low', 'price-high', 'name']).default('newest'),
    showFilters: z.boolean().default(true),
  }),
});

const trustBadgesComponentSchema = z.object({
  type: z.literal('TrustBadges'),
  props: basePropsSchema.extend({
    badges: z.array(featureItemSchema).min(2).max(4),
    layout: z.enum(['horizontal', 'grid']).default('horizontal'),
    style: z.enum(['cards', 'minimal', 'icons-only']).default('cards'),
  }),
});

const newsletterComponentSchema = z.object({
  type: z.literal('Newsletter'),
  props: basePropsSchema.extend({
    title: optionalShortTextSchema,
    description: optionalMediumTextSchema,
    placeholder: z.string().trim().min(1).max(80).default('Enter your email'),
    buttonText: optionalShortTextSchema,
  }),
});

const socialLinksSchema = z
  .object({
    facebook: z.string().trim().url().startsWith('https://').optional(),
    instagram: z.string().trim().url().startsWith('https://').optional(),
    twitter: z.string().trim().url().startsWith('https://').optional(),
    linkedin: z.string().trim().url().startsWith('https://').optional(),
    youtube: z.string().trim().url().startsWith('https://').optional(),
  })
  .strict();

const footerComponentSchema = z.object({
  type: z.literal('Footer'),
  props: basePropsSchema.extend({
    copyrightText: optionalShortTextSchema,
    showQuickLinks: z.boolean().default(true),
    quickLinks: z.array(linkSchema).min(1).max(8).optional(),
    socialLinks: socialLinksSchema.optional(),
    showNewsletter: z.boolean().default(false),
  }),
});

export const aiStorefrontComponentSchema = z.discriminatedUnion('type', [
  headerComponentSchema,
  heroComponentSchema,
  featuresComponentSchema,
  productGridComponentSchema,
  trustBadgesComponentSchema,
  newsletterComponentSchema,
  footerComponentSchema,
]);

export const aiStorefrontThemeSchema = z
  .object({
    primary: hexColorSchema.optional(),
    accent: hexColorSchema.optional(),
    background: hexColorSchema.optional(),
  })
  .strict();

export const aiStorefrontLayoutSchema = z
  .object({
    theme: aiStorefrontThemeSchema.optional(),
    sections: z.array(aiStorefrontComponentSchema).min(4).max(9),
    designRationale: z.string().trim().max(500).optional(),
  })
  .strict();

export type AiStorefrontComponent = z.infer<typeof aiStorefrontComponentSchema>;
export type AiStorefrontLayout = z.infer<typeof aiStorefrontLayoutSchema>;
export type AiStorefrontTheme = z.infer<typeof aiStorefrontThemeSchema>;
```

- [ ] **Step 3: Export a strict AI validation helper from `builder.ts`**

Keep the existing permissive `builderConfigSchema` for backward compatibility, but add a named helper that later code can call after normalization.

```ts
export function parseBuilderConfigForAiDraft(value: unknown): BuilderConfigInput {
  return builderConfigSchema.parse(value);
}
```

- [ ] **Step 4: Run schema tests**

```bash
pnpm --filter @baci/web test src/schemas/ai-storefront-layout.test.ts src/schemas/builder.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/schemas/ai-storefront-layout.ts apps/web/src/schemas/ai-storefront-layout.test.ts apps/web/src/schemas/builder.ts apps/web/src/schemas/builder.test.ts
git commit -m "feat: add strict ai storefront layout schemas"
```

---

## Task 3: Normalize AI Layouts Into Safe Puck Builder Configs

**Files:**
- Create: `apps/web/src/lib/ai-storefront/normalize-ai-storefront-layout.ts`
- Create: `apps/web/src/lib/ai-storefront/normalize-ai-storefront-layout.test.ts`

- [ ] **Step 1: Write failing normalizer tests**

```ts
import { describe, expect, it } from 'vitest';
import { aiStorefrontLayoutSchema } from '@/schemas/ai-storefront-layout';
import { normalizeAiStorefrontLayout } from './normalize-ai-storefront-layout';

describe('normalizeAiStorefrontLayout', () => {
  it('adds required commerce sections when the model omits them', () => {
    const config = normalizeAiStorefrontLayout({
      businessName: 'Bassey Phones',
      layout: aiStorefrontLayoutSchema.parse({
        sections: [
          { type: 'Hero', props: { id: 'hero', title: 'Phones for every budget' } },
          { type: 'Footer', props: { id: 'footer' } },
          {
            type: 'Newsletter',
            props: { id: 'newsletter', title: 'Get deals first' },
          },
          {
            type: 'Features',
            props: {
              id: 'features',
              features: [
                { title: 'Fast delivery', description: 'Same-week delivery in major cities.' },
                { title: 'Trusted devices', description: 'Carefully checked phones and accessories.' },
              ],
            },
          },
        ],
      }),
      starterConfig: { content: [], root: { title: 'Home' }, zones: {} },
    });

    expect(config.content.map((section) => section.type)).toContain('Header');
    expect(config.content.map((section) => section.type)).toContain('ProductGrid');
    expect(config.root.title).toBe('Home');
  });

  it('keeps only one Header and one Footer', () => {
    const config = normalizeAiStorefrontLayout({
      businessName: 'Bassey Phones',
      layout: aiStorefrontLayoutSchema.parse({
        sections: [
          { type: 'Header', props: { id: 'header-a' } },
          { type: 'Header', props: { id: 'header-b' } },
          { type: 'Hero', props: { id: 'hero', title: 'Premium phones' } },
          { type: 'ProductGrid', props: { id: 'products', limit: 8 } },
          { type: 'Footer', props: { id: 'footer-a' } },
          { type: 'Footer', props: { id: 'footer-b' } },
        ],
      }),
      starterConfig: { content: [], root: { title: 'Home' }, zones: {} },
    });

    expect(config.content.filter((section) => section.type === 'Header')).toHaveLength(1);
    expect(config.content.filter((section) => section.type === 'Footer')).toHaveLength(1);
  });
});
```

Run:

```bash
pnpm --filter @baci/web test src/lib/ai-storefront/normalize-ai-storefront-layout.test.ts
```

Expected: FAIL because the normalizer does not exist.

- [ ] **Step 2: Implement the normalizer**

```ts
import type { BuilderConfigInput } from '@/schemas/builder';
import type { AiStorefrontComponent, AiStorefrontLayout } from '@/schemas/ai-storefront-layout';

interface NormalizeAiStorefrontLayoutInput {
  businessName: string;
  layout: AiStorefrontLayout;
  starterConfig: BuilderConfigInput;
}

function withId(component: AiStorefrontComponent, index: number): AiStorefrontComponent {
  return {
    ...component,
    props: {
      ...component.props,
      id: component.props.id || `${component.type.toLowerCase()}-${index + 1}`,
    },
  } as AiStorefrontComponent;
}

function defaultHeader(): AiStorefrontComponent {
  return {
    type: 'Header',
    props: {
      id: 'header',
      showLogo: true,
      showSearch: true,
      showCart: true,
      showMenu: true,
      sticky: true,
      navigationLinks: [
        { label: 'Home', url: '/' },
        { label: 'Shop', url: '/products' },
      ],
      ctaButton: { show: false },
      layout: 'logo-left-nav-center',
      searchStyle: 'outline',
      searchRadius: 'md',
      paddingY: 'md',
      glassEffect: false,
    },
  };
}

function defaultProductGrid(): AiStorefrontComponent {
  return {
    type: 'ProductGrid',
    props: {
      id: 'product-grid',
      title: 'Featured products',
      columns: 3,
      limit: 8,
      sortBy: 'newest',
      showFilters: true,
    },
  };
}

function defaultFooter(businessName: string): AiStorefrontComponent {
  return {
    type: 'Footer',
    props: {
      id: 'footer',
      copyrightText: `(c) ${new Date().getFullYear()} ${businessName}. All rights reserved.`,
      showQuickLinks: true,
      quickLinks: [
        { label: 'About', url: '/about' },
        { label: 'Contact', url: '/contact' },
        { label: 'Terms', url: '/terms' },
      ],
      socialLinks: {},
      showNewsletter: false,
    },
  };
}

function enforceRequiredSections(
  sections: AiStorefrontComponent[],
  businessName: string
): AiStorefrontComponent[] {
  const next = [...sections];

  if (!next.some((section) => section.type === 'Header')) {
    next.unshift(defaultHeader());
  }

  if (!next.some((section) => section.type === 'ProductGrid')) {
    const footerIndex = next.findIndex((section) => section.type === 'Footer');
    if (footerIndex >= 0) {
      next.splice(footerIndex, 0, defaultProductGrid());
    } else {
      next.push(defaultProductGrid());
    }
  }

  if (!next.some((section) => section.type === 'Footer')) {
    next.push(defaultFooter(businessName));
  }

  return next;
}

function dedupeSingletons(sections: AiStorefrontComponent[]): AiStorefrontComponent[] {
  const seen = new Set<string>();
  return sections.filter((section) => {
    if (section.type !== 'Header' && section.type !== 'Footer') return true;
    if (seen.has(section.type)) return false;
    seen.add(section.type);
    return true;
  });
}

export function normalizeAiStorefrontLayout({
  businessName,
  layout,
  starterConfig,
}: NormalizeAiStorefrontLayoutInput): BuilderConfigInput {
  const sections = dedupeSingletons(
    enforceRequiredSections(layout.sections.map(withId), businessName)
  );

  return {
    ...starterConfig,
    root: {
      ...starterConfig.root,
      title: starterConfig.root?.title || 'Home',
    },
    content: sections.map((section) => ({
      type: section.type,
      props: section.props,
    })),
    zones: starterConfig.zones ?? {},
    ...(layout.theme
      ? {
          theme: {
            colors: {
              primary: layout.theme.primary,
              accent: layout.theme.accent,
              background: layout.theme.background,
            },
          },
        }
      : {}),
  } as BuilderConfigInput;
}
```

- [ ] **Step 3: Run normalizer tests**

```bash
pnpm --filter @baci/web test src/lib/ai-storefront/normalize-ai-storefront-layout.test.ts
```

Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/lib/ai-storefront/normalize-ai-storefront-layout.ts apps/web/src/lib/ai-storefront/normalize-ai-storefront-layout.test.ts
git commit -m "feat: normalize ai storefront layouts"
```

---

## Task 4: Add A Storefront-Specific Ollama Client

**Files:**
- Modify: `apps/web/src/env.ts`
- Create: `apps/web/src/lib/ai-storefront/ollama-storefront-client.ts`
- Create: `apps/web/src/lib/ai-storefront/ollama-storefront-client.test.ts`

- [ ] **Step 1: Add env entries**

Extend `serverSchema` in `apps/web/src/env.ts`:

```ts
OLLAMA_STOREFRONT_BASE_URL: z
  .string()
  .url()
  .refine(
    (u) => {
      const url = new URL(u);
      const isLocal =
        url.hostname === 'localhost' ||
        url.hostname.startsWith('127.') ||
        url.hostname === '::1';
      return u.startsWith('https://') || isLocal;
    },
    { message: 'OLLAMA_STOREFRONT_BASE_URL must use HTTPS except for localhost' }
  )
  .optional(),
OLLAMA_STOREFRONT_BASIC_AUTH: z.string().optional(),
OLLAMA_STOREFRONT_MODEL: z.string().default('gemma4:e4b'),
OLLAMA_STOREFRONT_TIMEOUT_MS: z.coerce.number().int().positive().default(90_000),
AI_STOREFRONT_GENERATION_ENABLED: z.enum(['true', 'false']).default('false'),
```

Add values to the env object creation block:

```ts
OLLAMA_STOREFRONT_BASE_URL: process.env.OLLAMA_STOREFRONT_BASE_URL,
OLLAMA_STOREFRONT_BASIC_AUTH: process.env.OLLAMA_STOREFRONT_BASIC_AUTH,
OLLAMA_STOREFRONT_MODEL: process.env.OLLAMA_STOREFRONT_MODEL,
OLLAMA_STOREFRONT_TIMEOUT_MS: process.env.OLLAMA_STOREFRONT_TIMEOUT_MS,
AI_STOREFRONT_GENERATION_ENABLED: process.env.AI_STOREFRONT_GENERATION_ENABLED,
```

Add server-only getters:

```ts
export const getOllamaStorefrontBaseUrl = () => {
  if (typeof window !== 'undefined')
    throw new Error('OLLAMA_STOREFRONT_BASE_URL cannot be accessed on the client');
  return env?.OLLAMA_STOREFRONT_BASE_URL;
};

export const getOllamaStorefrontBasicAuth = () => {
  if (typeof window !== 'undefined')
    throw new Error('OLLAMA_STOREFRONT_BASIC_AUTH cannot be accessed on the client');
  return env?.OLLAMA_STOREFRONT_BASIC_AUTH;
};

export const getOllamaStorefrontModel = () => {
  if (typeof window !== 'undefined')
    throw new Error('OLLAMA_STOREFRONT_MODEL cannot be accessed on the client');
  return env.OLLAMA_STOREFRONT_MODEL;
};

export const getOllamaStorefrontTimeoutMs = () => {
  if (typeof window !== 'undefined')
    throw new Error('OLLAMA_STOREFRONT_TIMEOUT_MS cannot be accessed on the client');
  return env.OLLAMA_STOREFRONT_TIMEOUT_MS;
};

export const isAiStorefrontGenerationEnabled = () => {
  if (typeof window !== 'undefined')
    throw new Error('AI_STOREFRONT_GENERATION_ENABLED cannot be accessed on the client');
  return env.AI_STOREFRONT_GENERATION_ENABLED === 'true';
};
```

- [ ] **Step 2: Write client tests**

Mock `fetch` and test that the client posts to `/api/generate`, uses `format`, includes Basic Auth when configured, handles non-2xx responses, and times out.

```ts
import { afterEach, describe, expect, it, vi } from 'vitest';
import { generateStorefrontLayoutWithOllama } from './ollama-storefront-client';

vi.mock('@/env', () => ({
  getOllamaStorefrontBaseUrl: () => 'https://ollama.example.com',
  getOllamaStorefrontBasicAuth: () => 'encoded-basic-token',
  getOllamaStorefrontModel: () => 'gemma4:e4b',
  getOllamaStorefrontTimeoutMs: () => 90_000,
}));

afterEach(() => {
  vi.restoreAllMocks();
});

describe('generateStorefrontLayoutWithOllama', () => {
  it('requests a structured storefront layout from Ollama', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          response: JSON.stringify({
            sections: [
              { type: 'Header', props: { id: 'header' } },
              { type: 'Hero', props: { id: 'hero', title: 'Premium phones' } },
              { type: 'ProductGrid', props: { id: 'products', limit: 8 } },
              { type: 'Footer', props: { id: 'footer' } },
            ],
          }),
        }),
        { status: 200 }
      )
    );

    const result = await generateStorefrontLayoutWithOllama({
      businessName: 'Bassey Phones',
      businessType: 'electronics',
      brandColors: { primary: '#111827', accent: '#f59e0b' },
      productCount: 0,
    });

    expect(result.sections[0]?.type).toBe('Header');
    expect(fetch).toHaveBeenCalledWith(
      'https://ollama.example.com/api/generate',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({ Authorization: 'Basic encoded-basic-token' }),
      })
    );
  });
});
```

- [ ] **Step 3: Implement the client**

Create a focused client that returns only parsed `AiStorefrontLayout`. Use Ollama `format` JSON Schema to constrain output.

```ts
import {
  getOllamaStorefrontBaseUrl,
  getOllamaStorefrontBasicAuth,
  getOllamaStorefrontModel,
  getOllamaStorefrontTimeoutMs,
} from '@/env';
import { aiStorefrontLayoutSchema, type AiStorefrontLayout } from '@/schemas/ai-storefront-layout';

interface StorefrontLayoutPromptInput {
  businessName: string;
  businessType: string;
  brandColors: Record<string, unknown> | null;
  productCount: number;
}

const OLLAMA_LAYOUT_FORMAT = {
  type: 'object',
  additionalProperties: false,
  properties: {
    theme: {
      type: 'object',
      additionalProperties: false,
      properties: {
        primary: { type: 'string' },
        accent: { type: 'string' },
        background: { type: 'string' },
      },
    },
    sections: {
      type: 'array',
      minItems: 4,
      maxItems: 9,
      items: {
        type: 'object',
        additionalProperties: false,
        properties: {
          type: {
            type: 'string',
            enum: ['Header', 'Hero', 'Features', 'ProductGrid', 'TrustBadges', 'Newsletter', 'Footer'],
          },
          props: { type: 'object' },
        },
        required: ['type', 'props'],
      },
    },
    designRationale: { type: 'string' },
  },
  required: ['sections'],
};

function normalizeBaseUrl(baseUrl: string): string {
  return baseUrl.replace(/\/+$/, '').replace(/\/api$/i, '');
}

function buildPrompt(input: StorefrontLayoutPromptInput): string {
  return [
    'Design a safe ecommerce homepage using only existing Puck components.',
    'Return JSON only. Do not include HTML, JavaScript, markdown, or code.',
    'Allowed components: Header, Hero, Features, ProductGrid, TrustBadges, Newsletter, Footer.',
    `Business name: ${input.businessName}`,
    `Business type: ${input.businessType}`,
    `Known product count: ${input.productCount}`,
    `Brand colors: ${JSON.stringify(input.brandColors ?? {})}`,
    'The homepage must include Header, Hero, ProductGrid, and Footer.',
  ].join('\n');
}

export async function generateStorefrontLayoutWithOllama(
  input: StorefrontLayoutPromptInput
): Promise<AiStorefrontLayout> {
  const baseUrl = getOllamaStorefrontBaseUrl();
  if (!baseUrl) throw new Error('OLLAMA_STOREFRONT_BASE_URL is not configured');

  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  const basicAuth = getOllamaStorefrontBasicAuth();
  if (basicAuth) headers.Authorization = `Basic ${basicAuth}`;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), getOllamaStorefrontTimeoutMs());

  try {
    const response = await fetch(`${normalizeBaseUrl(baseUrl)}/api/generate`, {
      method: 'POST',
      headers,
      signal: controller.signal,
      body: JSON.stringify({
        model: getOllamaStorefrontModel(),
        prompt: buildPrompt(input),
        stream: false,
        format: OLLAMA_LAYOUT_FORMAT,
        options: { temperature: 0.2 },
      }),
    });

    if (!response.ok) throw new Error(`Ollama returned ${response.status}`);

    const payload = (await response.json()) as { response?: unknown };
    const raw = typeof payload.response === 'string' ? JSON.parse(payload.response) : payload.response;
    return aiStorefrontLayoutSchema.parse(raw);
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error('Ollama storefront generation timed out');
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}
```

- [ ] **Step 4: Run tests**

```bash
pnpm --filter @baci/web test src/lib/ai-storefront/ollama-storefront-client.test.ts
pnpm turbo typecheck --filter=@baci/web
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/env.ts apps/web/src/lib/ai-storefront/ollama-storefront-client.ts apps/web/src/lib/ai-storefront/ollama-storefront-client.test.ts
git commit -m "feat: add ollama storefront layout client"
```

---

## Task 5: Define AI Job Schemas

**Files:**
- Create: `apps/web/src/schemas/ai-jobs.ts`
- Create: `apps/web/src/schemas/ai-jobs.test.ts`

- [ ] **Step 1: Write failing schema tests**

```ts
import { describe, expect, it } from 'vitest';
import { createAiJobSchema, storefrontLayoutJobInputSchema } from './ai-jobs';

describe('storefrontLayoutJobInputSchema', () => {
  it('accepts a valid storefront layout generation input', () => {
    const result = storefrontLayoutJobInputSchema.safeParse({
      pageSlug: 'home',
      businessName: 'Bassey Phones',
      businessType: 'electronics',
      brandColors: { primary: '#111827', accent: '#f59e0b' },
      createdPageConfigUpdatedAt: '2026-04-28T10:00:00.000Z',
    });

    expect(result.success).toBe(true);
  });

  it('rejects missing business context', () => {
    const result = storefrontLayoutJobInputSchema.safeParse({
      pageSlug: 'home',
      brandColors: null,
      createdPageConfigUpdatedAt: null,
    });

    expect(result.success).toBe(false);
  });
});

describe('createAiJobSchema', () => {
  it('validates storefront layout job input by type', () => {
    const result = createAiJobSchema.safeParse({
      type: 'storefront_layout_generation',
      input: {
        pageSlug: 'home',
        businessName: 'Bassey Phones',
        businessType: 'electronics',
        brandColors: null,
        createdPageConfigUpdatedAt: null,
      },
    });

    expect(result.success).toBe(true);
  });
});
```

Run:

```bash
pnpm --filter @baci/web test src/schemas/ai-jobs.test.ts
```

Expected: FAIL because the schema file does not exist yet.

- [ ] **Step 2: Add job schemas**

Create `apps/web/src/schemas/ai-jobs.ts`:

```ts
import { z } from 'zod';

export const aiJobTypeSchema = z.enum([
  'price_list_processing',
  'storefront_layout_generation',
]);

export const storefrontLayoutJobInputSchema = z
  .object({
    pageSlug: z.string().trim().min(1).default('home'),
    businessName: z.string().trim().min(1).max(120),
    businessType: z.string().trim().min(1).max(80),
    brandColors: z.record(z.string(), z.unknown()).nullable(),
    createdPageConfigUpdatedAt: z.string().datetime({ offset: true }).nullable(),
  })
  .strict();

export const createAiJobSchema = z
  .object({
    type: aiJobTypeSchema,
    input: z.unknown(),
  })
  .superRefine((value, ctx) => {
    if (value.type === 'storefront_layout_generation') {
      const parsed = storefrontLayoutJobInputSchema.safeParse(value.input);
      if (!parsed.success) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['input'],
          message: 'Invalid storefront layout generation input',
        });
      }
    }
  });

export type AiJobType = z.infer<typeof aiJobTypeSchema>;
export type StorefrontLayoutJobInput = z.infer<typeof storefrontLayoutJobInputSchema>;
```

- [ ] **Step 3: Run schema tests**

```bash
pnpm --filter @baci/web test src/schemas/ai-jobs.test.ts
```

Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/schemas/ai-jobs.ts apps/web/src/schemas/ai-jobs.test.ts
git commit -m "feat: add ai job schemas"
```

---

## Task 6: Process `storefront_layout_generation` Jobs

**Files:**
- Create: `apps/web/src/lib/ai-storefront/process-storefront-layout-job.ts`
- Create: `apps/web/src/lib/ai-storefront/process-storefront-layout-job.test.ts`
- Create: `apps/web/src/scripts/process-ai-storefront-jobs.ts`
- Create: `apps/web/src/scripts/process-ai-storefront-jobs.test.ts`
- Modify: `apps/web/src/app/api/ai-jobs/worker/route.ts`
- Create/Modify: `apps/web/src/app/api/ai-jobs/worker/route.test.ts`


- [ ] **Step 1: Write processor and runner tests**

Processor tests:
- Completed output is stored on the job without publishing.
- If the starter page is missing, processor fails with a clear error.
- If Gemma output fails schema validation, job attempt metadata records the validation error.

VPS runner tests:
- Claims only `storefront_layout_generation` jobs where `status = 'pending'` and `next_run_at` is null or due.
- Processes one storefront job per invocation by default.
- Does not select or fail `price_list_processing` jobs.
- Claims work with `locked_by`, `locked_at`, and `lease_expires_at`.
- Throws when the claim query returns a Supabase error.
- Throws when a completed-job update returns an error or no row for the active `locked_by` lease.
- Throws when a failed-job update returns an error or no row for the active `locked_by` lease.
- Reclaims `processing` jobs only after `lease_expires_at <= now()`.
- On failure, increments `attempts`; if attempts remain, sets `status = 'pending'` and exponential-ish `next_run_at`; otherwise sets `status = 'failed'`.
- Writes metadata for queue wait, duration, model, worker id, retry count, and validation errors.

Web worker route safety test:
- `/api/ai-jobs/worker` continues to process short `price_list_processing` jobs only and never claims `storefront_layout_generation`.

Use explicit mocked Supabase query chains. The expected output shape should be:

```ts
{
  generatedConfig: {
    content: expect.arrayContaining([
      expect.objectContaining({ type: 'Header' }),
      expect.objectContaining({ type: 'ProductGrid' }),
    ]),
    root: { title: 'Home' },
    zones: {},
  },
  designRationale: expect.any(String),
  applied: false,
}
```

- [ ] **Step 2: Implement the processor**

Create `processStorefrontLayoutJob` with this public signature:

```ts
import type { SupabaseClient } from '@supabase/supabase-js';
import { builderConfigSchema, type BuilderConfigInput } from '@/schemas/builder';
import type { StorefrontLayoutJobInput } from '@/schemas/ai-jobs';
import { generateStorefrontLayoutWithOllama } from './ollama-storefront-client';
import { normalizeAiStorefrontLayout } from './normalize-ai-storefront-layout';

export interface ProcessStorefrontLayoutJobArgs {
  supabase: SupabaseClient;
  jobId: string;
  merchantId: string;
  input: StorefrontLayoutJobInput;
}

export async function processStorefrontLayoutJob({
  supabase,
  merchantId,
  input,
}: ProcessStorefrontLayoutJobArgs) {
  const { data: pageConfig, error: pageError } = await supabase
    .from('page_configs')
    .select('id, draft_config, updated_at')
    .eq('merchant_id', merchantId)
    .eq('page_slug', input.pageSlug)
    .maybeSingle();

  if (pageError) throw new Error(`Failed to load page config: ${pageError.message}`);
  if (!pageConfig?.draft_config) throw new Error('Starter page config is missing');

  const parsedStarter = builderConfigSchema.safeParse(pageConfig.draft_config);
  if (!parsedStarter.success) throw new Error('Starter page config failed validation');

  const { count: productCount } = await supabase
    .from('products')
    .select('id', { count: 'exact', head: true })
    .eq('merchant_id', merchantId)
    .eq('status', 'active');

  const layout = await generateStorefrontLayoutWithOllama({
    businessName: input.businessName,
    businessType: input.businessType,
    brandColors: input.brandColors,
    productCount: productCount ?? 0,
  });

  const generatedConfig: BuilderConfigInput = normalizeAiStorefrontLayout({
    businessName: input.businessName,
    layout,
    starterConfig: parsedStarter.data,
  });

  const parsedGenerated = builderConfigSchema.safeParse(generatedConfig);
  if (!parsedGenerated.success) throw new Error('Generated page config failed validation');

  return {
    generatedConfig: parsedGenerated.data,
    designRationale: layout.designRationale ?? null,
    pageSlug: input.pageSlug,
    generatedAgainstUpdatedAt: pageConfig.updated_at,
    applied: false,
    skippedAutoApplyReason:
      pageConfig.updated_at !== input.createdPageConfigUpdatedAt
        ? 'page_config_changed_after_job_created'
        : null,
  };
}
```

- [ ] **Step 3: Add the VPS-local storefront worker script**

Do not put Gemma generation behind a Vercel/web function. Add `apps/web/src/scripts/process-ai-storefront-jobs.ts` and run it through `vps-workers/bin/run-web-script.sh` from the VPS. The script must use the Supabase service role only in the server-side worker process, never in client code.

Core runner shape:

```ts
import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';
import { randomUUID } from 'node:crypto';
import { processStorefrontLayoutJob } from '@/lib/ai-storefront/process-storefront-layout-job';
import { storefrontLayoutJobInputSchema } from '@/schemas/ai-jobs';

const DEFAULT_BATCH_SIZE = 1;
const MAX_BATCH_SIZE = 1;
const WORKER_LEASE_MS = 5 * 60_000;
const WORKER_ID = process.env.AI_STOREFRONT_WORKER_ID ?? `vps-${randomUUID()}`;

function getBatchSize(): number {
  const parsed = Number(process.env.STOREFRONT_AI_WORKER_BATCH_SIZE ?? DEFAULT_BATCH_SIZE);
  if (!Number.isSafeInteger(parsed) || parsed < 1) return DEFAULT_BATCH_SIZE;
  return Math.min(parsed, MAX_BATCH_SIZE);
}

function getRetryDelayMs(attempts: number): number {
  return Math.min(15 * 60_000, 60_000 * 2 ** Math.max(0, attempts - 1));
}

function asMetadataRecord(value: unknown): Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

async function main() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error('Missing Supabase worker credentials');
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey);
  const now = new Date().toISOString();
  const { data: jobs, error } = await supabase
    .from('ai_jobs')
    .select('id, merchant_id, input, attempts, max_attempts, created_at, metadata, status')
    .eq('type', 'storefront_layout_generation')
    .or(`status.eq.pending,and(status.eq.processing,lease_expires_at.lte.${now})`)
    .or(`next_run_at.is.null,next_run_at.lte.${now}`)
    .order('created_at', { ascending: true })
    .limit(getBatchSize());

  if (error) throw new Error(`Failed to load storefront jobs: ${error.message}`);
  if (!jobs?.length) return;

  for (const job of jobs) {
    const claimStartedAt = Date.now();
    const claimTime = new Date().toISOString();
    const leaseExpiresAt = new Date(Date.now() + WORKER_LEASE_MS).toISOString();
    const { data: claimedJob, error: claimError } = await supabase
      .from('ai_jobs')
      .update({
        status: 'processing',
        started_at: claimTime,
        locked_at: claimTime,
        locked_by: WORKER_ID,
        lease_expires_at: leaseExpiresAt,
      })
      .eq('id', job.id)
      .or(`status.eq.pending,and(status.eq.processing,lease_expires_at.lte.${claimTime})`)
      .select('id, merchant_id, input, attempts, max_attempts, created_at, metadata')
      .maybeSingle();

    if (claimError) {
      throw new Error(`Failed to claim storefront job ${job.id}: ${claimError.message}`);
    }

    if (!claimedJob) continue;

    try {
      const output = await processStorefrontLayoutJob({
        supabase,
        jobId: claimedJob.id,
        merchantId: claimedJob.merchant_id,
        input: storefrontLayoutJobInputSchema.parse(claimedJob.input),
      });

      const { data: completedJob, error: completeError } = await supabase
        .from('ai_jobs')
        .update({
          status: 'completed',
          output,
          completed_at: new Date().toISOString(),
          locked_at: null,
          locked_by: null,
          lease_expires_at: null,
          metadata: {
            ...asMetadataRecord(claimedJob.metadata),
            workerId: WORKER_ID,
            durationMs: Date.now() - claimStartedAt,
            queueWaitMs:
              Date.now() - new Date(claimedJob.created_at as string).getTime(),
            model: process.env.OLLAMA_STOREFRONT_MODEL ?? 'gemma4:e4b',
            completedAt: new Date().toISOString(),
          },
        })
        .eq('id', claimedJob.id)
        .eq('locked_by', WORKER_ID)
        .select('id')
        .maybeSingle();

      if (completeError) {
        throw new Error(
          `Failed to persist completed storefront job ${claimedJob.id}: ${completeError.message}`
        );
      }

      if (!completedJob) {
        throw new Error(
          `Failed to persist completed storefront job ${claimedJob.id}: active lease was lost`
        );
      }
    } catch (error) {
      const attempts = (claimedJob.attempts ?? 0) + 1;
      const maxAttempts = claimedJob.max_attempts ?? 3;
      const shouldRetry = attempts < maxAttempts;
      const { data: failedJob, error: failError } = await supabase
        .from('ai_jobs')
        .update({
          status: shouldRetry ? 'pending' : 'failed',
          attempts,
          error: error instanceof Error ? error.message : 'Unknown error',
          next_run_at: shouldRetry
            ? new Date(Date.now() + getRetryDelayMs(attempts)).toISOString()
            : null,
          completed_at: shouldRetry ? null : new Date().toISOString(),
          locked_at: null,
          locked_by: null,
          lease_expires_at: null,
          metadata: {
            ...asMetadataRecord(claimedJob.metadata),
            workerId: WORKER_ID,
            durationMs: Date.now() - claimStartedAt,
            attempts,
            failedAt: new Date().toISOString(),
            validationOrGenerationError:
              error instanceof Error ? error.message : 'Unknown error',
          },
        })
        .eq('id', claimedJob.id)
        .eq('locked_by', WORKER_ID)
        .select('id')
        .maybeSingle();

      if (failError) {
        throw new Error(
          `Failed to persist failed storefront job ${claimedJob.id}: ${failError.message}`
        );
      }

      if (!failedJob) {
        throw new Error(
          `Failed to persist failed storefront job ${claimedJob.id}: active lease was lost`
        );
      }
    }
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
```

- [ ] **Step 4: Keep the web worker out of storefront generation**

In `apps/web/src/app/api/ai-jobs/worker/route.ts`, keep the route for short web-safe jobs only:

- Select only `price_list_processing` jobs in the pending job query.
- Do not add a `storefront_layout_generation` branch to this route.
- Add a regression test proving storefront jobs are ignored by the route instead of being claimed, failed, or sent to Gemma.
- If a future emergency manual endpoint is added for storefront jobs, it must be admin-only, batch size `1`, and explicitly configured with a duration limit that fits the deployed Vercel plan. That fallback is out of scope for the first release.

Safe branch:

```ts
if (job.type === 'price_list_processing') {
  output = await processPriceList(job.input);
} else {
  throw new Error(`Unknown job type: ${job.type}`);
}
```

- [ ] **Step 5: Run worker tests**

```bash
pnpm --filter @baci/web test src/lib/ai-storefront/process-storefront-layout-job.test.ts src/scripts/process-ai-storefront-jobs.test.ts src/app/api/ai-jobs/worker/route.test.ts
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/lib/ai-storefront/process-storefront-layout-job.ts apps/web/src/lib/ai-storefront/process-storefront-layout-job.test.ts apps/web/src/scripts/process-ai-storefront-jobs.ts apps/web/src/scripts/process-ai-storefront-jobs.test.ts apps/web/src/app/api/ai-jobs/worker/route.ts apps/web/src/app/api/ai-jobs/worker/route.test.ts
git commit -m "feat: process ai storefront generation jobs"
```

---

## Task 7: Enqueue Storefront Generation During Onboarding

**Files:**
- Create/Modify: `apps/web/src/schemas/ai-jobs.ts`
- Create/Modify: `apps/web/src/schemas/ai-jobs.test.ts`
- Modify: `apps/web/src/app/onboarding/actions.ts`
- Modify: `apps/web/src/app/onboarding/actions.test.ts`

- [ ] **Step 1: Use the AI job schemas from Task 5**

Do not recreate schemas in this task. Import `createAiJobSchema` and `storefrontLayoutJobInputSchema` from `apps/web/src/schemas/ai-jobs.ts`, which was created before the worker task.

- [ ] **Step 2: Update `/api/ai-jobs` validation**

Replace raw body destructuring in `apps/web/src/app/api/ai-jobs/route.ts` with `createAiJobSchema.safeParse(body)`. Keep auth and permission checks first. Use `builder.edit` permission for `storefront_layout_generation`; keep product permission for `price_list_processing`.

- [ ] **Step 3: Write onboarding test**

Add a test case to `apps/web/src/app/onboarding/actions.test.ts` that asserts onboarding still returns success when `ai_jobs.insert` fails.
Add a separate test case that asserts onboarding returns the existing failure shape if `page_configs.insert(...).select('updated_at').single()` fails, and that no AI job is enqueued in that case. The starter store is the guaranteed synchronous fallback; do not report onboarding success if that row was not created.
Add duplicate-submit tests that simulate the unique `idempotency_key` constraint for an existing `pending`, `processing`, or `completed` storefront job and assert onboarding still succeeds without creating another onboarding-generated storefront job.
Add a rollout-flag test that mocks `isAiStorefrontGenerationEnabled()` as `false` and asserts no AI job is enqueued.

Expected behavior:

```ts
expect(result).toEqual(expect.objectContaining({ success: true }));
expect(mockFrom).toHaveBeenCalledWith('ai_jobs');
```

- [ ] **Step 4: Enqueue after starter page config insert**

In `apps/web/src/app/onboarding/actions.ts`, after successful `page_configs` insert, insert a non-blocking job:

```ts
import { isAiStorefrontGenerationEnabled } from '@/env';

const { data: insertedPageConfig, error: pageConfigInsertError } = await adminSupabase
  .from('page_configs')
  .insert({
    merchant_id: merchant.id,
    page_slug: 'home',
    page_name: 'Home',
    draft_config: config,
    published_config: config,
    is_published: true,
  })
  .select('updated_at')
  .single();

if (pageConfigInsertError || !insertedPageConfig) {
  throw new Error(
    `Failed to create starter page config: ${
      pageConfigInsertError?.message ?? 'No page config returned'
    }`
  );
}

if (isAiStorefrontGenerationEnabled()) {
  const idempotencyKey = `storefront-layout:${merchant.id}:home:onboarding`;
  const { error: aiJobError } = await adminSupabase.from('ai_jobs').insert({
    merchant_id: merchant.id,
    type: 'storefront_layout_generation',
    status: 'pending',
    idempotency_key: idempotencyKey,
    input: {
      pageSlug: 'home',
      businessName,
      businessType: finalBusinessType,
      brandColors: safeBrandColors,
      createdPageConfigUpdatedAt: insertedPageConfig.updated_at,
    },
    model: process.env.OLLAMA_STOREFRONT_MODEL ?? 'gemma4:e4b',
    metadata: {
      source: 'onboarding',
      createdPageConfigUpdatedAt: insertedPageConfig.updated_at,
    },
  });

  if (aiJobError && aiJobError.code !== '23505') {
    logger.error({
      message: 'AI storefront generation job enqueue failed',
      merchantId: merchant.id,
      error: aiJobError,
    });
  }
}
```

Note: this code is inside the existing server action path that already uses the admin client. Do not introduce admin client usage in browser code or public client components.

- [ ] **Step 5: Run tests**

```bash
pnpm --filter @baci/web test src/schemas/ai-jobs.test.ts src/app/onboarding/actions.test.ts src/app/api/ai-jobs/route.test.ts
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/schemas/ai-jobs.ts apps/web/src/schemas/ai-jobs.test.ts apps/web/src/app/onboarding/actions.ts apps/web/src/app/onboarding/actions.test.ts apps/web/src/app/api/ai-jobs/route.ts apps/web/src/app/api/ai-jobs/route.test.ts
git commit -m "feat: enqueue ai storefront generation during onboarding"
```

---

## Task 8: Add Apply Endpoint For Completed AI Drafts

**Files:**
- Create: `apps/web/src/app/api/ai-jobs/[jobId]/apply/route.ts`
- Create: `apps/web/src/app/api/ai-jobs/[jobId]/apply/route.test.ts`

- [ ] **Step 1: Write route tests**

Cover:
- `401` unauthenticated.
- `403` no builder edit permission.
- `404` job missing or different merchant.
- `400` job not completed or output missing `generatedConfig`.
- `400` malformed JSON body. Empty body is allowed and defaults to `{ force: false }`.
- `409` current `page_configs.updated_at` differs from `output.generatedAgainstUpdatedAt` and request body does not include explicit `force: true`.
- `200` for a staff user with `builder.edit` permission applying a completed storefront AI draft owned by the merchant.
- `500` if the atomic apply RPC fails.
- `401` if the atomic apply RPC returns `unauthorized`.
- `403` if the atomic apply RPC returns `forbidden`.
- `404` if the atomic apply RPC returns `job_not_found` or `page_config_not_found`.
- `200` atomically updates `page_configs.draft_config`, advances `page_configs.updated_at`, sets `result_applied_at`, and does not publish.
- `200` with `{ force: true }` applies a stale-but-valid draft only after explicit user confirmation.
- Supabase `.rpc('apply_ai_storefront_draft', ...)` receives the validated config, expected `updated_at`, and `force` flag.

Implementation requirement: validate the optional request body with Zod as `{ force: z.boolean().optional().default(false) }`. Load the current home `page_configs.updated_at` before updating `draft_config`. If it differs from `job.output.generatedAgainstUpdatedAt`, return `{ error: 'AI draft is stale', code: 'ai_draft_stale' }` with status `409` unless `force` is true. The route's `ai_jobs` read must work for merchant owners and staff with `builder.edit`, using the narrow storefront-generation SELECT policy from Task 1. The route must still call the RPC for the final mutation because the RPC performs the transaction, rechecks authorization, rechecks staleness, updates `draft_config`, advances `updated_at`, and marks `result_applied_at` atomically.

- [ ] **Step 2: Implement the route**

```ts
import { type NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { hasPermission } from '@/lib/api-auth';
import { checkCsrfProtection } from '@/lib/csrf';
import {
  getMerchantForApiRequest,
  toUserAccess,
} from '@/lib/get-merchant-for-api-request';
import { getAuthenticatedUser } from '@/lib/supabase/mobile-auth';
import { builderConfigSchema } from '@/schemas/builder';

const applyAiDraftSchema = z
  .object({
    force: z.boolean().optional().default(false),
  })
  .strict();

interface RouteContext {
  params: Promise<{ jobId: string }>;
}

interface AiDraftOutput {
  generatedConfig?: unknown;
  generatedAgainstUpdatedAt?: unknown;
}

function getAiDraftOutput(output: unknown): AiDraftOutput | null {
  if (typeof output !== 'object' || output === null || Array.isArray(output)) {
    return null;
  }

  return output as AiDraftOutput;
}

type RequestBodyResult =
  | { body: unknown; response?: never }
  | { response: NextResponse; body?: never };

async function readOptionalJsonBody(request: NextRequest): Promise<RequestBodyResult> {
  const rawBody = await request.text();
  if (!rawBody.trim()) return { body: {} };

  try {
    return { body: JSON.parse(rawBody) as unknown };
  } catch {
    return {
      response: NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 }),
    };
  }
}

export async function POST(request: NextRequest, context: RouteContext) {
  const auth = await getAuthenticatedUser(request);
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { valid, response } = await checkCsrfProtection(request);
  if (!valid) return response as NextResponse;

  const { user, supabase } = auth;
  const merchantContext = await getMerchantForApiRequest(supabase, user.id);
  if (!merchantContext) {
    return NextResponse.json({ error: 'Merchant not found' }, { status: 404 });
  }

  const access = toUserAccess(merchantContext);
  if (!hasPermission(access, 'builder', 'edit')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const bodyResult = await readOptionalJsonBody(request);
  if (bodyResult.response) return bodyResult.response;

  const parsedRequest = applyAiDraftSchema.safeParse(bodyResult.body);
  if (!parsedRequest.success) {
    return NextResponse.json(
      { error: 'Invalid request body', details: parsedRequest.error.flatten() },
      { status: 400 }
    );
  }

  const { jobId } = await context.params;
  const { data: job, error: jobError } = await supabase
    .from('ai_jobs')
    .select('id, merchant_id, type, status, output')
    .eq('id', jobId)
    .eq('merchant_id', merchantContext.merchantId)
    .maybeSingle();

  if (jobError) return NextResponse.json({ error: 'Failed to load job' }, { status: 500 });
  if (!job || job.type !== 'storefront_layout_generation') {
    return NextResponse.json({ error: 'AI draft not found' }, { status: 404 });
  }
  if (job.status !== 'completed') {
    return NextResponse.json({ error: 'AI draft is not ready' }, { status: 400 });
  }

  const draftOutput = getAiDraftOutput(job.output);
  const parsedConfig = builderConfigSchema.safeParse(draftOutput?.generatedConfig);
  const generatedAgainstUpdatedAt =
    typeof draftOutput?.generatedAgainstUpdatedAt === 'string'
      ? draftOutput.generatedAgainstUpdatedAt
      : null;

  if (!parsedConfig.success || !generatedAgainstUpdatedAt) {
    return NextResponse.json({ error: 'AI draft output is invalid' }, { status: 400 });
  }

  const { data: pageConfig, error: pageConfigError } = await supabase
    .from('page_configs')
    .select('id, updated_at')
    .eq('merchant_id', merchantContext.merchantId)
    .eq('page_slug', 'home')
    .maybeSingle();

  if (pageConfigError) {
    return NextResponse.json({ error: 'Failed to load page config' }, { status: 500 });
  }
  if (!pageConfig) {
    return NextResponse.json({ error: 'Home page config not found' }, { status: 404 });
  }

  if (!parsedRequest.data.force && pageConfig.updated_at !== generatedAgainstUpdatedAt) {
    return NextResponse.json(
      {
        error: 'AI draft is stale',
        code: 'ai_draft_stale',
        message:
          'This AI draft was generated from an older version of your store. Review before replacing your current draft.',
      },
      { status: 409 }
    );
  }

  const { data: applyResult, error: applyError } = await supabase
    .rpc('apply_ai_storefront_draft', {
      p_job_id: job.id,
      p_merchant_id: merchantContext.merchantId,
      p_page_slug: 'home',
      p_generated_config: parsedConfig.data,
      p_generated_against_updated_at: generatedAgainstUpdatedAt,
      p_force: parsedRequest.data.force,
    })
    .maybeSingle<{
      applied: boolean;
      code: string | null;
      page_config_id: string | null;
      updated_at: string | null;
    }>();

  if (applyError) {
    console.error('Failed to atomically apply AI draft', applyError);
    return NextResponse.json({ error: 'Failed to apply AI draft' }, { status: 500 });
  }

  if (!applyResult) {
    return NextResponse.json({ error: 'Failed to apply AI draft' }, { status: 500 });
  }

  if (!applyResult.applied && applyResult.code === 'unauthorized') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (!applyResult.applied && applyResult.code === 'forbidden') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  if (!applyResult.applied && applyResult.code === 'job_not_found') {
    return NextResponse.json({ error: 'AI draft not found' }, { status: 404 });
  }

  if (!applyResult.applied && applyResult.code === 'page_config_not_found') {
    return NextResponse.json({ error: 'Home page config not found' }, { status: 404 });
  }

  if (!applyResult.applied && applyResult.code === 'ai_draft_stale') {
    return NextResponse.json(
      { error: 'AI draft is stale', code: 'ai_draft_stale' },
      { status: 409 }
    );
  }

  if (!applyResult.applied) {
    return NextResponse.json({ error: 'Failed to apply AI draft' }, { status: 500 });
  }

  return NextResponse.json({ success: true, lastUpdated: applyResult.updated_at });
}
```

- [ ] **Step 3: Run tests**

```bash
pnpm --filter @baci/web test 'src/app/api/ai-jobs/[jobId]/apply/route.test.ts'
```

Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add 'apps/web/src/app/api/ai-jobs/[jobId]/apply/route.ts' 'apps/web/src/app/api/ai-jobs/[jobId]/apply/route.test.ts'
git commit -m "feat: apply ai storefront drafts"
```

---

## Task 9: Add Store Build Status To Readiness API

**Files:**
- Modify: `apps/web/src/app/api/merchant/readiness/route.ts`
- Modify: `apps/web/src/app/api/merchant/readiness/route.test.ts`

- [ ] **Step 1: Extend response types**

Add:

```ts
export interface StoreBuildStatus {
  starterStoreReady: boolean;
  aiStatus: 'not_started' | 'pending' | 'processing' | 'ready' | 'applied' | 'failed';
  latestJobId: string | null;
  canApplyAiDraft: boolean;
  message: string;
}
```

Extend `StoreReadiness`:

```ts
storeBuild: StoreBuildStatus;
```

Add route tests that prove `ai_jobs` and `page_configs` query errors return the existing `500` error shape instead of silently reporting `not_started` or `starterStoreReady: false`. Backend failures must not look like normal merchant setup gaps.

- [ ] **Step 2: Query latest storefront generation job**

In the readiness route, query only needed columns. This query must work for merchant owners and staff with builder access through the narrow storefront-generation SELECT policy from Task 1:

```ts
const { data: latestStorefrontJob, error: latestStorefrontJobError } = await supabase
  .from('ai_jobs')
  .select('id, status, error, result_applied_at, created_at')
  .eq('merchant_id', validMerchant.id)
  .eq('type', 'storefront_layout_generation')
  .order('created_at', { ascending: false })
  .limit(1)
  .maybeSingle();

if (latestStorefrontJobError) {
  console.error('[Readiness API] storefront AI job lookup failed:', {
    merchantId: validMerchant.id,
    error: latestStorefrontJobError,
  });
  throw new Error('Failed to load storefront build status');
}
```

Also query home page config existence:

```ts
const { data: homePageConfig, error: homePageConfigError } = await supabase
  .from('page_configs')
  .select('id')
  .eq('merchant_id', validMerchant.id)
  .eq('page_slug', 'home')
  .maybeSingle();

if (homePageConfigError) {
  console.error('[Readiness API] home page config lookup failed:', {
    merchantId: validMerchant.id,
    error: homePageConfigError,
  });
  throw new Error('Failed to load starter storefront status');
}
```

Compute `canApplyAiDraft` from the existing merchant access decision: merchant owners can apply, and staff must have `builder.edit`. Staff with only `builder.view` can load readiness and preview the AI draft, but must receive `canApplyAiDraft: false`.

- [ ] **Step 3: Map job state to product language**

```ts
function buildStoreBuildStatus(
  starterStoreReady: boolean,
  job: { id: string; status: string; result_applied_at: string | null } | null,
  canApplyAiDraft: boolean
): StoreBuildStatus {
  if (!job) {
    return {
      starterStoreReady,
      aiStatus: 'not_started',
      latestJobId: null,
      canApplyAiDraft,
      message: starterStoreReady
        ? 'Starter storefront is ready. AI design has not started yet.'
        : 'Starter storefront is being created.',
    };
  }

  if (job.result_applied_at) {
    return {
      starterStoreReady,
      aiStatus: 'applied',
      latestJobId: job.id,
      canApplyAiDraft,
      message: 'AI storefront has been applied to your draft.',
    };
  }

  if (job.status === 'completed') {
    return {
      starterStoreReady,
      aiStatus: 'ready',
      latestJobId: job.id,
      canApplyAiDraft,
      message: 'Your AI storefront is ready to preview and apply.',
    };
  }

  if (job.status === 'processing') {
    return {
      starterStoreReady,
      aiStatus: 'processing',
      latestJobId: job.id,
      canApplyAiDraft,
      message: 'Your AI storefront is being designed.',
    };
  }

  if (job.status === 'failed') {
    return {
      starterStoreReady,
      aiStatus: 'failed',
      latestJobId: job.id,
      canApplyAiDraft,
      message: 'Starter storefront is ready. AI design can be retried.',
    };
  }

  return {
    starterStoreReady,
    aiStatus: 'pending',
    latestJobId: job.id,
    canApplyAiDraft,
    message: 'Your AI storefront is queued.',
  };
}
```

- [ ] **Step 4: Keep launch readiness separate**

Do not include AI design completion in `isReady`. Keep KYC, bank, products, country, and contact info as launch blockers. Add AI storefront as a recommended/store milestone, not a required item.

- [ ] **Step 5: Run tests**

```bash
pnpm --filter @baci/web test src/app/api/merchant/readiness/route.test.ts
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/app/api/merchant/readiness/route.ts apps/web/src/app/api/merchant/readiness/route.test.ts
git commit -m "feat: expose storefront build status in readiness"
```

---

## Task 10: Add Dashboard Store Build Status UI

**Files:**
- Create: `apps/web/src/components/dashboard/store-build-status-card.tsx`
- Create: `apps/web/src/components/dashboard/store-build-status-card.test.tsx`
- Modify: `apps/web/src/app/dashboard/client-page.tsx`
- Modify: `apps/web/src/app/api/builder/route.ts`
- Modify: `apps/web/src/app/api/builder/route.test.ts`
- Modify: `apps/web/src/app/api/builder/builder-route-utils.ts`
- Modify: `apps/web/src/app/api/builder/builder-route-utils.test.ts`
- Modify: `apps/web/src/app/builder/builder-client.tsx`
- Modify: `apps/web/src/app/builder/builder-client.test.tsx`
- Modify: `apps/web/src/types/builder.ts`

- [ ] **Step 1: Write UI tests**

Test:
- Pending/processing shows “building your store” and no apply button.
- Ready for a merchant owner or staff with `builder.edit` shows Preview, Apply AI design, and Edit in builder actions.
- Ready for staff with only `builder.view` shows Preview and a builder entry action but does not show Apply AI design.
- Applied shows completed state.
- Failed shows starter store ready and retry guidance.
- `/api/builder?slug=home&aiDraftJobId=<id>` returns the completed AI draft config in read-only preview mode for the merchant that owns the job.
- `/api/builder?slug=home&aiDraftJobId=<id>` returns the completed AI draft config for a staff user with `builder.view` or `builder.edit` permission.
- Builder preview mode hides Save/Publish and surfaces an Apply AI design action only for owners or staff with `builder.edit`.
- Builder preview mode for staff with only `builder.view` hides Save/Publish, hides Apply AI design, and shows a read-only preview message.
- Apply handlers surface `409 ai_draft_stale` as a replacement confirmation flow, not a generic retry error.

- [ ] **Step 2: Add read-only AI draft preview support**

Implement Preview as a read-only builder session rather than applying the AI draft first:

- In `apps/web/src/app/api/builder/route.ts`, parse optional `aiDraftJobId` with Zod from the query string.
- In `builder-route-utils.ts`, load the completed `ai_jobs` row scoped to the current merchant when `aiDraftJobId` is present. This query must work for merchant owners and staff with `builder.view` or `builder.edit`, using the narrow storefront-generation SELECT policy from Task 1.
- Validate `job.output.generatedConfig` with `builderConfigSchema` before returning it.
- In `apps/web/src/types/builder.ts`, extend `BuilderLoadResponse` with `previewMode: 'ai_draft' | null`, `aiDraftJobId: string | null`, and `canApplyAiDraft: boolean` so `BuilderClient` can consume preview permissions without type assertions.
- In `builder-route-utils.ts`, add the same fields to `BuilderLoadPayload` and populate `previewMode`/`aiDraftJobId` as `null` for the normal builder path. Populate `canApplyAiDraft` from owner or staff `builder.edit` access.
- Return the AI config as the builder payload with `canEdit: false`, `previewMode: 'ai_draft'`, `aiDraftJobId`, and `canApplyAiDraft`.
- Return `404` for a missing/different-merchant job and `400` for incomplete or invalid draft output.
- In `builder-client.tsx`, detect `previewMode: 'ai_draft'`, show a read-only banner, and hide Save/Publish. Expose an Apply AI design button only when `canApplyAiDraft` is true and `aiDraftJobId` is present; staff with only `builder.view` must never see an Apply CTA that will predictably return `403`.
- In both builder preview and dashboard card apply handlers, handle `409 ai_draft_stale` by warning that the store changed after generation. Only send `{ force: true }` after the merchant explicitly confirms replacement.

Do not reuse `draft_config` for preview. Preview must read from `ai_jobs.output` so merchants can inspect the AI design without overwriting their starter draft.

- [ ] **Step 3: Implement card component**

Create a focused component instead of expanding the already-large `setup-checklist.tsx`.

```tsx
'use client';

import { CheckCircle2, Eye, Loader2, Palette, Store } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { useToast } from '@/hooks/use-toast';
import { fetchWithCsrf } from '@/lib/api-client';

interface StoreBuildStatus {
  starterStoreReady: boolean;
  aiStatus: 'not_started' | 'pending' | 'processing' | 'ready' | 'applied' | 'failed';
  latestJobId: string | null;
  canApplyAiDraft: boolean;
  message: string;
}

interface StoreBuildStatusCardProps {
  status: StoreBuildStatus;
  onApplied?: () => void;
}

interface ApiErrorBody {
  code?: string;
  error?: string;
  message?: string;
}

async function readApiError(response: Response): Promise<ApiErrorBody> {
  try {
    return (await response.json()) as ApiErrorBody;
  } catch {
    return {};
  }
}

function progressForStatus(status: StoreBuildStatus): number {
  if (status.aiStatus === 'applied') return 100;
  if (status.aiStatus === 'ready') return 85;
  if (status.aiStatus === 'processing') return 65;
  if (status.aiStatus === 'pending') return 45;
  return status.starterStoreReady ? 35 : 10;
}

export function StoreBuildStatusCard({ status, onApplied }: StoreBuildStatusCardProps) {
  const { toast } = useToast();
  const [applying, setApplying] = useState(false);

  const canPreview = status.aiStatus === 'ready' && !!status.latestJobId;
  const canApply = canPreview && status.canApplyAiDraft;

  const applyAiDraft = async (force = false) => {
    if (!status.latestJobId || !status.canApplyAiDraft) return;
    setApplying(true);
    try {
      const response = await fetchWithCsrf(`/api/ai-jobs/${status.latestJobId}/apply`, {
        method: 'POST',
        body: force ? JSON.stringify({ force: true }) : undefined,
      });
      if (response.status === 409) {
        const errorBody = await readApiError(response);
        if (errorBody.code === 'ai_draft_stale') {
          const confirmed = window.confirm(
            'Your starter store changed after this AI design was generated. Replace your current draft with the AI design?'
          );
          if (confirmed) {
            await applyAiDraft(true);
          } else {
            toast({ title: 'AI design not applied', description: 'Your current draft was kept.' });
          }
          return;
        }
      }
      if (!response.ok) throw new Error('Failed to apply AI storefront');
      toast({ title: 'AI storefront applied', description: 'Open the builder to review and publish your changes.' });
      onApplied?.();
    } catch {
      toast({ variant: 'destructive', title: 'Could not apply AI storefront', description: 'Please try again.' });
    } finally {
      setApplying(false);
    }
  };

  return (
    <Card className="border-primary/20 bg-gradient-to-br from-primary/5 via-background to-amber-500/5">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          {status.aiStatus === 'applied' ? (
            <CheckCircle2 className="h-5 w-5 text-green-600" />
          ) : status.aiStatus === 'processing' || status.aiStatus === 'pending' ? (
            <Loader2 className="h-5 w-5 animate-spin text-primary" />
          ) : (
            <Store className="h-5 w-5 text-primary" />
          )}
          Building your store
        </CardTitle>
        <CardDescription>{status.message}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Progress value={progressForStatus(status)} aria-label="Store build progress" />
        <div className="flex flex-wrap gap-2">
          <Button asChild variant="outline">
            <Link href="/builder">Edit starter store</Link>
          </Button>
          {canPreview && (
            <Button asChild variant="outline">
              <Link href={`/builder?aiDraftJobId=${status.latestJobId}`}>
                <Eye className="mr-2 h-4 w-4" />
                Preview AI design
              </Link>
            </Button>
          )}
          {canApply && (
            <Button onClick={() => void applyAiDraft()} disabled={applying}>
              <Palette className="mr-2 h-4 w-4" />
              {applying ? 'Applying...' : 'Apply AI design'}
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
```

- [ ] **Step 4: Add card to dashboard**

In `apps/web/src/app/dashboard/client-page.tsx`, fetch readiness once and pass `storeBuild` into the card, or have the card fetch `/api/merchant/readiness` internally. Prefer fetching in the card only if it keeps `client-page.tsx` smaller and avoids duplicating existing checklist state.

For first release, place the card above `<SetupChecklist dismissible />` so the merchant sees build status before launch blockers.

- [ ] **Step 5: Poll while building**

Add polling only while `aiStatus` is `pending` or `processing`. Use `setInterval` inside `useEffect`; clear it on unmount. Do not poll after `ready`, `applied`, or `failed`.

- [ ] **Step 6: Run UI tests**

```bash
pnpm --filter @baci/web test src/components/dashboard/store-build-status-card.test.tsx src/app/api/builder/route.test.ts src/app/api/builder/builder-route-utils.test.ts src/app/builder/builder-client.test.tsx
pnpm turbo typecheck --filter=@baci/web
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add apps/web/src/components/dashboard/store-build-status-card.tsx apps/web/src/components/dashboard/store-build-status-card.test.tsx apps/web/src/app/dashboard/client-page.tsx apps/web/src/app/api/builder/route.ts apps/web/src/app/api/builder/route.test.ts apps/web/src/app/api/builder/builder-route-utils.ts apps/web/src/app/api/builder/builder-route-utils.test.ts apps/web/src/app/builder/builder-client.tsx apps/web/src/app/builder/builder-client.test.tsx apps/web/src/types/builder.ts
git commit -m "feat: show ai storefront build status"
```

---

## Task 10.5: Fix Mobile AI Copilot Failure Handling And Fallback UX

**Investigation note:** the TestFlight screenshot shows the mobile customize chat displaying `Failed to process AI request`. In the current code, `apps/mobile-admin/hooks/useBuilderConfig.ts` posts directly to `https://usebaci.com/api/builder/gemini` through raw `fetch`, and `apps/web/src/app/api/builder/gemini/route.ts` returns that exact string only from the generic catch block around server-side AI generation/output validation. That means the request likely passed network, auth, permission, and request-body validation, then failed inside `generateObject`, model/provider setup, quota, timeout, or generated-config validation. Production logs are still required to distinguish those causes, so this task adds request IDs and structured server logs before changing user-facing behavior.

**Files:**
- Create: `apps/mobile-admin/hooks/format-ai-copilot-error.ts`
- Create: `apps/mobile-admin/hooks/format-ai-copilot-error.test.ts`
- Modify: `apps/mobile-admin/hooks/useBuilderConfig.ts`
- Create: `apps/mobile-admin/hooks/useBuilderConfig.test.ts`
- Modify: `apps/web/src/app/api/builder/gemini/route.ts`
- Modify: `apps/web/src/app/api/builder/gemini/route.test.ts`
- Create: `apps/web/src/app/api/builder/gemini/route.error-codes.test.ts`
- Modify: `apps/web/src/ai/provider.ts`

- [ ] **Step 1: Add web route tests for stable error payloads**

Create `apps/web/src/app/api/builder/gemini/route.error-codes.test.ts` using the same mock setup pattern as `route.test.ts`. Cover at minimum:

- `withRetry`/`generateObject` rejects: returns status `503`, `code: 'ai_provider_unavailable'`, a client-safe `error`, and a `requestId`.
- `generateObject` exceeds the server-side timeout: returns status `503`, `code: 'ai_provider_unavailable'`, a client-safe `error`, and a `requestId`.
- Generated object is missing a valid `content` array: returns status `502`, `code: 'ai_builder_invalid_output'`, a client-safe `error`, and a `requestId`.
- Rate limit exceeded: returns status `429`, `code: 'rate_limited'`, `details`, and `X-RateLimit-Reset`.

Example assertion shape:

```ts
expect(response.status).toBe(503);
expect(body).toEqual({
  error: 'AI editor is temporarily unavailable',
  code: 'ai_provider_unavailable',
  requestId: expect.any(String),
});
expect(body.error).not.toContain('quota');
expect(body.error).not.toContain('API key');
```

- [ ] **Step 2: Replace opaque `/api/builder/gemini` errors**

In `apps/web/src/app/api/builder/gemini/route.ts`, create a request ID once per request and use it in every non-validation AI failure response:

```ts
const requestId = crypto.randomUUID();
```

In `apps/web/src/ai/provider.ts`, export the selected model name alongside `activeTextModel` so logs identify the real provider model instead of a local variable name:

```ts
export const ACTIVE_TEXT_MODEL_NAME = 'gemini-3-flash-preview';
const gemini3Flash = google(ACTIVE_TEXT_MODEL_NAME);
```

Use a short retry profile for interactive edits so a provider outage does not leave the mobile app stuck in `Thinking...`:

```ts
const BUILDER_GEMINI_RETRY_CONFIG = {
  maxRetries: 1,
  initialDelayMs: 750,
  maxDelayMs: 1500,
  backoffMultiplier: 2,
};

const BUILDER_GEMINI_TIMEOUT_MS = 25_000;
```

Call `withRetry` with that config for `/api/builder/gemini`; do not reuse the default four-attempt AI retry profile for mobile chat editing. Wrap the provider call in a server-side timeout so the route also terminates, not just the mobile client request:

```ts
async function runBuilderGeminiWithTimeout<T>(
  operation: (abortSignal: AbortSignal) => Promise<T>
): Promise<T> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), BUILDER_GEMINI_TIMEOUT_MS);

  try {
    return await operation(controller.signal);
  } catch (error) {
    if (controller.signal.aborted) {
      throw new Error('builder_gemini_timeout');
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}
```

Move the existing inline user/config prompt string into `const builtPrompt = ...`, then use the timeout wrapper around `generateObject`:

```ts
const result = await runBuilderGeminiWithTimeout((abortSignal) =>
  withRetry(
    () =>
      generateObject({
        model: activeTextModel,
        schema: aiBuilderConfigSchema,
        system: BUILDER_GEMINI_SYSTEM_PROMPT,
        prompt: builtPrompt,
        abortSignal,
      }),
    BUILDER_GEMINI_RETRY_CONFIG
  )
);
```

Update the rate-limit response to include a stable code:

```ts
return NextResponse.json(
  {
    error: 'Rate limit exceeded',
    code: 'rate_limited',
    details: `Please wait ${Math.ceil(rateLimit.resetIn / 1000)} seconds before trying again.`,
    requestId,
  },
  {
    status: 429,
    headers: {
      'X-RateLimit-Remaining': '0',
      'X-RateLimit-Reset': String(Math.ceil(rateLimit.resetIn / 1000)),
    },
  }
);
```

Replace generated-output `throw new Error(...)` branches with client-safe responses:

```ts
if (!updatedConfig.content || !Array.isArray(updatedConfig.content)) {
  console.error('Gemini AI Builder Invalid Output:', {
    requestId,
    userId: user.id,
    merchantId: merchantContext.merchantId,
    model: ACTIVE_TEXT_MODEL_NAME,
    promptLength: sanitizedPrompt.length,
    componentCount: currentConfig.content.length,
    reason: 'missing_content_array',
  });

  return NextResponse.json(
    {
      error: 'AI editor returned an invalid draft',
      code: 'ai_builder_invalid_output',
      requestId,
    },
    { status: 502 }
  );
}
```

Replace the catch response with a provider-unavailable response and structured log:

```ts
} catch (error) {
  console.error('Gemini AI Builder Error:', {
    requestId,
    userId: aiLogContext.userId,
    merchantId: aiLogContext.merchantId,
    model: aiLogContext.model,
    promptLength: aiLogContext.promptLength,
    componentCount: aiLogContext.componentCount,
    errorName: error instanceof Error ? error.name : 'UnknownError',
    errorMessage: error instanceof Error ? error.message : String(error),
    stack: error instanceof Error ? error.stack : undefined,
  });

  return NextResponse.json(
    {
      error: 'AI editor is temporarily unavailable',
      code: 'ai_provider_unavailable',
      requestId,
    },
    { status: 503 }
  );
}
```

Define `aiLogContext` near `requestId` and populate it after auth, merchant lookup, prompt sanitization, and body validation so the catch block has correlation fields even when provider generation fails:

```ts
const aiLogContext: {
  userId?: string;
  merchantId?: string;
  model?: string;
  promptLength?: number;
  componentCount?: number;
} = {};
```

Populate it before the provider call:

```ts
Object.assign(aiLogContext, {
  userId: user.id,
  merchantId: merchantContext.merchantId,
  model: ACTIVE_TEXT_MODEL_NAME,
  promptLength: sanitizedPrompt.length,
  componentCount: currentConfig.content.length,
});
```

Do not expose provider details, API keys, quota text, stack traces, raw prompts, or full configs to the client.

- [ ] **Step 3: Add mobile error-message helper tests**

Create `apps/mobile-admin/hooks/format-ai-copilot-error.test.ts` and test these cases:

- `NetworkError` with `data.code = 'ai_provider_unavailable'` returns `AI editor is temporarily unavailable. Your current draft is safe. Continue onboarding; we'll keep building your store.`
- `NetworkError` with `data.code = 'ai_builder_invalid_output'` returns `AI could not produce a safe edit. Your current draft was not changed. Try a simpler request.`
- `NetworkError` with status `429` or `data.code = 'rate_limited'` returns a wait message using `details` when present.
- timeout returns `AI editing timed out. Your current draft is safe. Please try again.`
- offline returns `Unable to reach Baci. Check your connection and try again.`
- `401` and `403` return auth/permission messages instead of AI-provider messages.

- [ ] **Step 4: Implement mobile error-message helper**

Create `apps/mobile-admin/hooks/format-ai-copilot-error.ts`:

```ts
import { NetworkError } from '@/lib/api-client';

interface AiCopilotErrorBody {
  code?: string;
  error?: string;
  details?: string;
  requestId?: string;
}

function getErrorBody(error: NetworkError): AiCopilotErrorBody {
  if (!error.data || typeof error.data !== 'object') {
    return {};
  }

  const data = error.data as Record<string, unknown>;
  return {
    code: typeof data.code === 'string' ? data.code : undefined,
    error: typeof data.error === 'string' ? data.error : undefined,
    details: typeof data.details === 'string' ? data.details : undefined,
    requestId: typeof data.requestId === 'string' ? data.requestId : undefined,
  };
}

export function formatAiCopilotError(error: unknown): string {
  if (error instanceof NetworkError) {
    const body = getErrorBody(error);

    if (error.statusCode === 401) {
      return 'Please sign in again to use AI editing.';
    }

    if (error.statusCode === 403) {
      return 'You need builder edit access to use AI editing.';
    }

    if (error.isTimeout) {
      return 'AI editing timed out. Your current draft is safe. Please try again.';
    }

    if (error.isOffline) {
      return 'Unable to reach Baci. Check your connection and try again.';
    }

    if (error.statusCode === 429 || body.code === 'rate_limited') {
      return body.details ?? 'AI editing is busy. Please wait a moment and try again.';
    }

    if (body.code === 'ai_builder_invalid_output') {
      return 'AI could not produce a safe edit. Your current draft was not changed. Try a simpler request.';
    }

    if (body.code === 'ai_provider_unavailable') {
      return "AI editor is temporarily unavailable. Your current draft is safe. Continue onboarding; we'll keep building your store.";
    }
  }

  return 'AI editing is temporarily unavailable. Your current draft is safe. Please try again.';
}
```

- [ ] **Step 5: Add mobile hook tests**

Create `apps/mobile-admin/hooks/useBuilderConfig.test.ts` using the existing `useStorePublish.test.ts` `renderHook` + `QueryClientProvider` pattern. Mock `@/lib/api-client`, `@/hooks/useAuth`, and `formatAiCopilotError`.

Cover at minimum:

- Fetch config calls `apiClient('/api/builder?slug=home')` rather than raw `fetch`.
- AI edit calls `apiClient('/api/builder/gemini', { method: 'POST', timeout: 45000, body: ... })`.
- A provider-unavailable `NetworkError` appends the formatted system message and does not change `currentConfig`.
- Save draft uses `apiClient('/api/builder', { method: 'POST', body: ... })`.
- Publish saves the draft first, then calls `apiClient('/api/builder', { method: 'PUT', body: ... })`.

Use this mock error pattern:

```ts
class TestNetworkError extends Error {
  public readonly isTimeout: boolean;
  public readonly isOffline: boolean;
  public readonly statusCode?: number;
  public readonly data?: unknown;

  constructor(message: string, options: { isTimeout?: boolean; isOffline?: boolean; statusCode?: number; data?: unknown } = {}) {
    super(message);
    this.name = 'NetworkError';
    this.isTimeout = options.isTimeout ?? false;
    this.isOffline = options.isOffline ?? false;
    this.statusCode = options.statusCode;
    this.data = options.data;
  }
}
```

- [ ] **Step 6: Move `useBuilderConfig` onto the centralized mobile API client**

In `apps/mobile-admin/hooks/useBuilderConfig.ts`:

- Remove `WEB_API_BASE`.
- Import `apiClient` from `@/lib/api-client`.
- Import `formatAiCopilotError` from `./format-ai-copilot-error`.
- Replace all direct `fetch` calls in the hook with `apiClient`.
- Keep the local `session?.access_token` checks so unauthenticated UI still fails fast before making requests.
- Give the AI edit request a longer but bounded timeout, `45000`, so the UI does not hang indefinitely while the web route retries the provider.
- On AI-edit failure, append the formatted system message, throw `new Error(formattedMessage)`, and leave `currentConfig` unchanged.

The AI edit request should follow this shape:

```ts
try {
  const data = await apiClient<GeminiResponse>('/api/builder/gemini', {
    method: 'POST',
    timeout: 45000,
    body: JSON.stringify({
      prompt,
      currentConfig: effectiveConfig,
    }),
  });

  setMessages((prev) => [
    ...prev,
    {
      id: `${Date.now() + 1}`,
      role: 'assistant',
      content: "Done! I've updated your storefront. Check the preview to see the changes.",
      timestamp: new Date(),
    },
  ]);
  setCurrentConfig(data.config);
  return data.config;
} catch (error) {
  const content = formatAiCopilotError(error);
  setMessages((prev) => [
    ...prev,
    {
      id: `${Date.now() + 1}`,
      role: 'system',
      content,
      timestamp: new Date(),
    },
  ]);
  throw new Error(content);
}
```

- [ ] **Step 7: Add fallback UX rule to the mobile customize screen**

Keep this rule in the hook or the chat panel, whichever keeps files below 300 lines: if the formatted error is provider-unavailable, the chat must not instruct merchants to retry repeatedly as the only path forward. It must tell them the current draft is safe and onboarding can continue while the async storefront build progresses.

Do not auto-apply an async Gemma draft from the mobile Copilot. The mobile Copilot remains an edit surface; initial AI storefront generation remains the Task 7-10 async build-status flow.

- [ ] **Step 8: Run mobile and web tests**

```bash
pnpm --filter baci-mobile-admin test \
  hooks/format-ai-copilot-error.test.ts \
  hooks/useBuilderConfig.test.ts
pnpm --filter @baci/web test \
  src/app/api/builder/gemini/route.test.ts \
  src/app/api/builder/gemini/route.error-codes.test.ts
pnpm turbo typecheck --filter=baci-mobile-admin
pnpm turbo typecheck --filter=@baci/web
```

Expected: PASS.

- [ ] **Step 9: Review gate**

Run:

```bash
! rg -n "WEB_API_BASE|Failed to process AI request" apps/mobile-admin/hooks/useBuilderConfig.ts apps/web/src/app/api/builder/gemini/route.ts
rg -n "apiClient|NetworkError|formatAiCopilotError|ai_provider_unavailable|ai_builder_invalid_output|rate_limited|requestId|ACTIVE_TEXT_MODEL_NAME" apps/mobile-admin/hooks apps/web/src/ai/provider.ts apps/web/src/app/api/builder/gemini
```

Expected: no raw mobile base URL remains in `useBuilderConfig`, no generic `Failed to process AI request` remains in the web route response, and both client/server have structured error-code handling.

- [ ] **Step 10: Commit**

```bash
git add apps/mobile-admin/hooks/format-ai-copilot-error.ts apps/mobile-admin/hooks/format-ai-copilot-error.test.ts apps/mobile-admin/hooks/useBuilderConfig.ts apps/mobile-admin/hooks/useBuilderConfig.test.ts apps/web/src/ai/provider.ts apps/web/src/app/api/builder/gemini/route.ts apps/web/src/app/api/builder/gemini/route.test.ts apps/web/src/app/api/builder/gemini/route.error-codes.test.ts
git commit -m "fix: make mobile ai copilot failures actionable"
```

---

## Task 11: VPS / Ollama Production Wiring

**Files:**
- Create: `docs/ops/self-hosted-gemma-storefront-worker.md`
- Create: `vps-workers/bin/process-ai-storefront-jobs.sh`
- Modify: `vps-workers/deploy.sh`
- Modify: `vps-workers/README.md`
- Modify: `docs/ops/vps-workers.md`

- [ ] **Step 1: Document current VPS findings**

Include:

```md
# Self-Hosted Gemma Storefront Worker

Host: `bassey@82.29.190.219`
Hostname: `ogabassey`
OS: Ubuntu 24.04.4 LTS
CPU/RAM: 4 vCPU, 15 GiB RAM
GPU: none detected
Ollama: 0.20.4 active
Models:
- gemma4:e2b
- gemma4:e4b

Measured generation:
- gemma4:e4b warm tiny JSON: about 2s
- gemma4:e4b Puck-like JSON: about 28s
- cold starts can be 27s-55s
```

- [ ] **Step 2: Document required ops changes**

Include:

```md
## Required Before Production Use

1. Keep first-release storefront generation on the VPS-local worker, not `/api/ai-jobs/worker`.
2. Set `OLLAMA_STOREFRONT_BASE_URL=http://127.0.0.1:11434` in `$HOME/baci-workers/.env` on the VPS.
3. Keep `STOREFRONT_AI_WORKER_BATCH_SIZE=1`; do not batch multiple Gemma generations in one invocation on the 4 vCPU / no-GPU host.
4. Configure `NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `OLLAMA_STOREFRONT_MODEL`, `OLLAMA_STOREFRONT_TIMEOUT_MS`, `AI_STOREFRONT_WORKER_ID`, and `STOREFRONT_AI_WORKER_BATCH_SIZE` for the VPS worker process.
5. Keep `AI_STOREFRONT_GENERATION_ENABLED=false` in production until internal QA is complete; turn it on only for the planned rollout window.
6. Do not expose raw Ollama publicly. If an HTTPS gateway is later needed, renew/fix TLS for `ollama.usebaci.com`, proxy only `/api/generate`, and require Basic Auth or a private bearer token.
7. Set request body and timeout limits on any future proxy.
8. Add a low-frequency warmup cron only if cold starts are unacceptable in production monitoring.
```

- [ ] **Step 3: Add optional safe Nginx example**

This is not required for the first-release VPS-local worker. Include it only as a safe pattern if a future web runtime must call the VPS over HTTPS.

```nginx
server {
  listen 443 ssl http2;
  server_name ollama.usebaci.com;

  client_max_body_size 2m;

  location /api/generate {
    auth_basic "Baci internal AI";
    auth_basic_user_file /etc/nginx/.ollama_htpasswd;

    proxy_pass http://127.0.0.1:11434/api/generate;
    proxy_http_version 1.1;
    proxy_read_timeout 120s;
    proxy_send_timeout 120s;
    proxy_set_header Host $host;
    proxy_set_header X-Forwarded-Proto https;
  }

  location / {
    return 404;
  }
}
```

- [ ] **Step 4: Add warmup guidance**

```bash
curl -fsS http://127.0.0.1:11434/api/generate \
  -H 'Content-Type: application/json' \
  -d '{"model":"gemma4:e4b","prompt":"Return {\"ok\":true}","stream":false,"format":"json","options":{"temperature":0}}' >/dev/null
```

Run every 5-10 minutes only if operational monitoring shows cold-load latency is hurting UX.

- [ ] **Step 5: Update VPS worker cadence**

Add `vps-workers/bin/process-ai-storefront-jobs.sh`:

```bash
#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
export NODE_ENV="${NODE_ENV:-production}"
export OLLAMA_STOREFRONT_BASE_URL="${OLLAMA_STOREFRONT_BASE_URL:-http://127.0.0.1:11434}"
export STOREFRONT_AI_WORKER_BATCH_SIZE="${STOREFRONT_AI_WORKER_BATCH_SIZE:-1}"

exec "$SCRIPT_DIR/run-web-script.sh" ai-storefront-jobs src/scripts/process-ai-storefront-jobs.ts
```

Make the script executable and schedule it every 2 minutes. Use `flock` so slow Gemma generations do not overlap:

```cron
*/2 * * * * flock -n $REMOTE_DIR/locks/ai-storefront-jobs.lock bash -lc 'export NODE_ENV=production && cd $REMOTE_DIR && $REMOTE_DIR/bin/process-ai-storefront-jobs.sh' >> $REMOTE_DIR/logs/ai-storefront-jobs.log 2>&1
```

Do not schedule `/api/ai-jobs/worker` for storefront generation. That route may remain on its current cadence for short legacy jobs, but Gemma storefront work must use the local script above.

Update `vps-workers/README.md` and `docs/ops/vps-workers.md` to document:
- `process-ai-storefront-jobs.sh` runs every 2 minutes.
- It uses the repo checkout through `run-web-script.sh`.
- It talks to Ollama at `http://127.0.0.1:11434` by default.
- It processes at most one storefront generation per run.
- Logs live at `$REMOTE_DIR/logs/ai-storefront-jobs.log`.

- [ ] **Step 6: Commit**

```bash
git add docs/ops/self-hosted-gemma-storefront-worker.md vps-workers/bin/process-ai-storefront-jobs.sh vps-workers/deploy.sh vps-workers/README.md docs/ops/vps-workers.md
git commit -m "docs: document self-hosted gemma worker ops"
```

---

## Task 12: Add Rollout, Observability, And Visual QA Gates

**Files:**
- Modify: `docs/ops/self-hosted-gemma-storefront-worker.md`
- Modify: `docs/ops/vps-workers.md`
- Modify: `apps/web/src/scripts/process-ai-storefront-jobs.test.ts`

- [ ] **Step 1: Add observability requirements to worker docs**

Document these production metrics in `docs/ops/self-hosted-gemma-storefront-worker.md`:

```md
## Production Metrics

Track these values from `ai_jobs.metadata` and worker logs:

- `queueWaitMs`: time from `ai_jobs.created_at` to worker claim.
- `durationMs`: total Gemma generation and normalization time.
- `workerId`: worker process that claimed the job.
- `model`: Ollama model used for generation.
- `attempts`: retry count before success or failure.
- `validationOrGenerationError`: sanitized failure reason.
- `completedAt` / `failedAt`: terminal event timestamp.

Alert thresholds:

- Queue depth for `storefront_layout_generation` pending jobs > 25 for 10 minutes.
- p95 `queueWaitMs` > 10 minutes.
- p95 `durationMs` > 120 seconds.
- Validation failure rate > 10% over 30 minutes.
- Any job stuck in `processing` with expired `lease_expires_at` for more than 10 minutes.
```

- [ ] **Step 2: Add rollout flag runbook**

Document the rollout flag in `docs/ops/vps-workers.md`:

````md
## AI Storefront Generation Rollout

The worker only receives onboarding jobs when:

```env
AI_STOREFRONT_GENERATION_ENABLED=true
```

Rollout phases:

1. Local/dev merchants only: keep the flag disabled in production.
2. Internal production merchants: enable the flag and manually monitor the first 20 jobs.
3. 5% merchant cohort: enable for selected merchants if the feature flag system supports merchant-level targeting.
4. Broad rollout: expand only after p95 queue wait, p95 duration, validation failures, and stale apply rates stay inside thresholds for 48 hours.

Rollback:

1. Set `AI_STOREFRONT_GENERATION_ENABLED=false`.
2. Leave the VPS worker running so already-queued jobs can complete or fail safely.
3. Do not delete existing `ai_jobs`; dashboard readiness can still show completed drafts.
````

- [ ] **Step 3: Add visual and accessibility QA checklist**

Add this release gate to `docs/ops/self-hosted-gemma-storefront-worker.md`:

```md
## Generated Storefront QA Gate

Before enabling broad rollout:

1. Generate at least 10 storefront drafts across different business types.
2. Preview each draft on mobile and desktop.
3. Verify header, hero, product grid, footer, and CTA navigation render without hydration errors.
4. Run `pnpm --filter @baci/web seo:pagespeed` against a preview URL when available.
5. Confirm accessibility score stays at or above the existing SEO tool threshold.
6. Confirm LCP remains under 2.5s and CLS under 0.1 on preview/public pages.
7. Confirm no generated config contains unsupported components or arbitrary HTML/JS.
```

- [ ] **Step 4: Extend worker tests for metadata**

In `apps/web/src/scripts/process-ai-storefront-jobs.test.ts`, assert completed and failed jobs write metadata:

```ts
expect(updatePayload.metadata).toEqual(
  expect.objectContaining({
    workerId: expect.any(String),
    durationMs: expect.any(Number),
    queueWaitMs: expect.any(Number),
    model: expect.any(String),
  })
);
```

For failure cases:

```ts
expect(updatePayload.metadata).toEqual(
  expect.objectContaining({
    workerId: expect.any(String),
    durationMs: expect.any(Number),
    attempts: expect.any(Number),
    validationOrGenerationError: expect.any(String),
  })
);
```

- [ ] **Step 5: Run docs and worker tests**

```bash
pnpm --filter @baci/web test src/scripts/process-ai-storefront-jobs.test.ts
pnpm turbo typecheck --filter=@baci/web
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add docs/ops/self-hosted-gemma-storefront-worker.md docs/ops/vps-workers.md apps/web/src/scripts/process-ai-storefront-jobs.test.ts
git commit -m "docs: add ai storefront rollout and observability gates"
```

---

## Task 13: End-To-End Verification And Rollout Gate

**Files:**
- No new source files unless tests reveal a defect.

- [ ] **Step 1: Run targeted tests**

```bash
pnpm --filter @baci/web test \
  src/schemas/ai-storefront-layout.test.ts \
  src/schemas/ai-jobs.test.ts \
  src/lib/ai-storefront/normalize-ai-storefront-layout.test.ts \
  src/lib/ai-storefront/ollama-storefront-client.test.ts \
  src/lib/ai-storefront/process-storefront-layout-job.test.ts \
  src/scripts/process-ai-storefront-jobs.test.ts \
  src/app/api/ai-jobs/route.test.ts \
  src/app/api/ai-jobs/worker/route.test.ts \
  'src/app/api/ai-jobs/[jobId]/apply/route.test.ts' \
  src/app/api/builder/route.test.ts \
  src/app/api/builder/builder-route-utils.test.ts \
  src/app/builder/builder-client.test.tsx \
  src/app/onboarding/actions.test.ts \
  src/app/api/merchant/readiness/route.test.ts \
  src/components/dashboard/store-build-status-card.test.tsx \
  src/app/api/builder/gemini/route.test.ts \
  src/app/api/builder/gemini/route.error-codes.test.ts
pnpm --filter baci-mobile-admin test \
  hooks/useBuilderConfig.test.ts \
  hooks/format-ai-copilot-error.test.ts
```

Expected: PASS.

- [ ] **Step 2: Run quality gates**

```bash
pnpm turbo lint
pnpm turbo typecheck
pnpm turbo test
```

Expected: all pass.

- [ ] **Step 3: Manual local smoke test**

1. Create a test merchant through onboarding.
2. Confirm starter store exists immediately in `page_configs`.
3. Confirm an `ai_jobs` row exists with `type = 'storefront_layout_generation'`.
4. Run the local worker manually: `NODE_ENV=production pnpm --filter @baci/web exec tsx src/scripts/process-ai-storefront-jobs.ts`, or run `$REMOTE_DIR/bin/process-ai-storefront-jobs.sh` on the VPS.
5. Confirm job becomes `completed` and `output.generatedConfig` exists.
6. Open dashboard and confirm build card says AI storefront is ready.
7. Click Preview AI design and confirm `/builder?aiDraftJobId=<id>` opens a read-only AI draft preview.
8. As the merchant owner or a staff user with `builder.edit`, click Apply AI design.
9. Open `/builder` and confirm draft changed but public launch is still blocked until KYC/payment/product requirements are complete.
10. Edit the starter draft while a separate test job is processing, then attempt to apply that old job and confirm the API returns `409` unless `force: true` is explicitly sent.

- [ ] **Step 4: Run CodeRabbit review**

```bash
coderabbit review --prompt-only -t uncommitted
```

Expected: no critical or high severity issues remain.

- [ ] **Step 5: Commit final integration fixes**

```bash
git add apps/web/src apps/mobile-admin/hooks docs/ops supabase/migrations vps-workers
git commit -m "feat: generate storefront drafts with async gemma"
```

---

## Rollout Strategy

1. Enable only for internal/test merchants first.
2. Add a feature flag before broad rollout if the existing feature system has a suitable merchant-level flag.
3. Monitor job duration, validation failure rate, apply rate, and fallback rate.
4. Keep managed Gemini available only as an emergency fallback for admin-triggered regeneration, not as the default onboarding path.
5. After reliability is proven, consider making AI design generation visible earlier in onboarding with more detailed progress copy.

## Acceptance Criteria

- New merchants get a starter store immediately.
- New merchants get a background `storefront_layout_generation` job.
- Gemma output cannot introduce arbitrary code, unsupported components, or invalid colors.
- Completed AI output can be reviewed and applied, but is not auto-published.
- Ready state includes Preview and a builder entry action for users with builder access.
- Ready state includes Apply AI design only for merchant owners or staff with `builder.edit`.
- Applying stale AI output returns `409 ai_draft_stale` unless the user explicitly confirms replacement.
- Applying AI output is atomic: `page_configs.draft_config` and `ai_jobs.result_applied_at` are committed in one RPC transaction.
- The apply RPC uses explicit owner/staff builder-edit authorization and does not require a broad merchant UPDATE policy on `ai_jobs`.
- Staff with `builder.view` can preview storefront AI drafts but cannot see Apply AI design actions.
- Staff with `builder.edit` can preview and apply storefront AI drafts.
- Staff cannot read unrelated `ai_jobs` types through the new policy.
- Applying AI output advances `page_configs.updated_at`, so future stale-draft checks compare against the actual latest draft version.
- Storefront Gemma generation runs through the VPS-local script, not the web worker route.
- VPS worker jobs use leases and can be reclaimed after `lease_expires_at`.
- Duplicate onboarding submissions do not enqueue duplicate active storefront generation jobs.
- The rollout flag can disable new generation without breaking starter-store onboarding.
- Worker metadata captures queue wait, duration, model, worker id, attempts, and sanitized failures for production monitoring.
- If the starter page insert fails, onboarding does not enqueue an AI job or report a working starter store.
- KYC remains the launch gate.
- Dashboard shows real build status instead of a fake spinner.
- Failed AI generation does not block onboarding or store setup.
- Broad rollout requires mobile/desktop visual QA, accessibility checks, LCP under 2.5s, and CLS under 0.1.
- Quality gates pass: `pnpm turbo lint`, `pnpm turbo typecheck`, `pnpm turbo test`.

## Self-Review Notes

- Scope is focused on async AI storefront generation and readiness UX. It does not attempt to replace the full template system.
- The plan reuses existing `ai_jobs` infrastructure instead of adding a duplicate job table.
- The plan avoids modifying `apps/web/src/proxy.ts`.
- Public Ollama exposure is explicitly blocked unless TLS and auth are fixed.
- The plan keeps AI generation out of the publish gate so model failure cannot prevent merchants from launching with the starter store.
