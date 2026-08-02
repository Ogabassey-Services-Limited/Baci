# Vercel Cost Cuts Round 2

## Goal

Reduce current Vercel runtime spend and failed work using production evidence, while preserving storefront freshness and analytics correctness.

## Global Constraints

- Work from `codex/vercel-cost-cuts-round2`, based on `origin/main` at `5e09cafc335f84fd4b54fbefe64f1497a660f01d`.
- Preserve the dirty root and unrelated worktrees.
- Do not modify `apps/web/src/proxy.ts`.
- Existing Supabase migrations are append-only.
- Never expose secrets in source, logs, reports, commits, or responses.
- Production deploys must use the repository's prebuilt flow; never run a cloud-building Vercel deploy.
- Every code defect fixed must have a regression test; all new or materially changed runtime files need colocated tests.
- Before completion run `pnpm turbo lint`, `pnpm turbo typecheck`, and `pnpm turbo test`, plus focused operational probes.

## Task 1: Promote direct VPS workers

Deploy the exact current `main` worker release to the VPS using the repository-owned deployment path. Verify the VPS source guard, direct Petrock and quiz wrappers, crontab replacement, logs, and absence of further minute-frequency Vercel calls after the rollout window. Do not alter unrelated crons.

## Task 2: Make Cloudflare runtime credentials coherent

Ensure the working GitHub `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ZONE_ID` are synchronized into Vercel Production without exposing values. Add fail-closed deployment coverage so a successful GitHub purge cannot coexist silently with stale or blank Vercel runtime values. Redeploy through the prebuilt production workflow and verify both a GitHub purge and an application runtime purge succeed.

## Task 3: Repair scoped Supabase JWT signing

Replace or correct the stale Vercel production signing material used by `signScopedSupabaseJwt`. Prefer the current Supabase asymmetric signing key path when available; otherwise use the live project legacy secret through an approved secret channel. Add/adjust tests for signing-material validation and verify `/api/events` no longer emits `PGRST301` while events persist successfully.

## Task 4: Reduce ISR writes with safe Cloudflare caching

Only after Task 2 proves runtime purging works and the Cloudflare edge rule respects origin headers, close the PDP purge gaps for high-cardinality product updates, CSV/bulk publish, inventory decrement/release, category path changes, generated product images, and SEO writes. Then increase only the storefront PDP Cloudflare self-healing TTL from five minutes to one hour while leaving Vercel at five minutes and retaining stale-while-revalidate and stale-if-error protection. Replace the current greater-than-50 listing-only fallback with a bounded strategy that still evicts every affected PDP. Update stale comments outside protected `proxy.ts` and add regression coverage proving mutation-to-purge coverage, merchant scoping, and the TTL relationship.

Implementation note: purge-gap coverage is independently shippable. The PDP-only TTL split requires separate explicit approval for the minimal protected `proxy.ts` cache-class selection change; without that approval, keep the existing five-minute PDP TTL rather than widening mutable trust pages.

## Task 5: Reduce autocomplete runtime work

Measure and implement bounded short-lived caching or request coalescing for repeated identical autocomplete queries, with tenant-safe cache keys and no cross-merchant results. Adjust client debounce only if evidence supports it. Preserve Zod validation and error behavior, and add regression tests for cache hits, merchant isolation, and failures.

## Completion Gate

- Each task receives implementation and review evidence in the SDD ledger.
- Operational changes are verified against live VPS, Vercel, Cloudflare, and Supabase behavior.
- Final whole-branch review reports no unresolved critical or important issues.
- Branch is pushed and a ready-for-review PR is created; merging remains subject to the repository's exact-head gate.
