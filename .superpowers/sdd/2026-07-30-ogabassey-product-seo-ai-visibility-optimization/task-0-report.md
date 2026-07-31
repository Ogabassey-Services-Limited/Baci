# Task 0 — writer inventory preparation report

- **Status:** IN_PROGRESS
- **Started (UTC):** 2026-07-31T13:05:27Z

## Strict TDD evidence

### RED observed before production checker existed

Command:
```bash
pnpm --filter @baci/web exec vitest run src/scripts/check-product-description-writers.test.ts
```

Material failure excerpt:
```text
Error: Failed to resolve import "./check-product-description-writers" from "src/scripts/check-product-description-writers.test.ts". Does the file exist?
Test Files  1 failed (1)
Tests  no tests
```

The test file was created first; no production checker existed at the time of this run.

## Completion

- **Status:** DONE_WITH_CONCERNS
- **Commit SHA(s):** The final atomic commit containing this report is recorded in the task response (a Git commit cannot contain its own final object ID).

### Exact files changed

- `apps/web/src/scripts/check-product-description-writers.test.ts`
- `apps/web/src/scripts/check-product-description-writers.ts`
- `docs/seo/product-description-writer-inventory-20260731T130857Z-36d42e7.csv`
- `docs/seo/ogabassey-seo-cutover-checklist-20260731T130857Z-36d42e7.md`
- `.superpowers/sdd/2026-07-30-ogabassey-product-seo-ai-visibility-optimization/task-0-report.md`

### Writer paths and callers discovered

| Path | Caller / classification |
|---|---|
| `apps/web/src/app/api/products/route.ts` | Add-product form -> `POST /api/products` |
| `apps/web/src/app/api/products/[id]/route.ts` | Edit-product form -> `PUT /api/products/[id]` |
| `apps/web/src/app/api/products/bulk-import/route.ts` | CSV bulk-import dialog -> multipart route |
| `apps/web/src/app/api/products/bulk-update/bulk-update-change-processing.ts` | Review UI/context -> bulk-update route -> processor |
| `apps/web/src/lib/import-commit/commit-bumpa-products.ts` | Claimed import job -> Bumpa commit helper |
| `apps/web/src/app/api/marketplace/jumia/products/import/route.ts` | Dashboard products action -> Jumia import route |
| `apps/web/src/ai/flows/generate-product-descriptions.ts` | Product UI server action; generates only and does not write `public.products` |
| `apps/web/src/ai/flows/autofill-product-details.ts` | Product UI server action; generates only and does not write `public.products` |
| `supabase/migrations/20260615181534_serialized_variant_inventory.sql` | Current legacy private mobile product-save implementation |
| `supabase/migrations/20260702063638_restore_mobile_admin_product_rpc_contract.sql` | Mobile save hook -> current public product-save RPC |

### GREEN verification

```bash
pnpm --filter @baci/web exec vitest run src/scripts/check-product-description-writers.test.ts
# 1 test file passed; 3 tests passed

pnpm --filter @baci/web exec tsx src/scripts/check-product-description-writers.ts \
  --output ../../docs/seo/product-description-writer-inventory-staging.csv
# Product description writer inventory verified

shasum -a 256 docs/seo/product-description-writer-inventory-staging.csv
# bd909f23165e204d610053b9f6c59e226c0fcb29a68346f26cc1848d1a3e1730

pnpm turbo lint
# passed; pre-existing warning-only diagnostics reported outside this slice

pnpm turbo typecheck
# passed: 5 successful tasks
```

The staging CSV was verification-only and removed before commit. The committed, deterministic evidence CSV has the same content hash.

### Evidence SHA-256

- `docs/seo/product-description-writer-inventory-20260731T130857Z-36d42e7.csv`: `bd909f23165e204d610053b9f6c59e226c0fcb29a68346f26cc1848d1a3e1730`
- `docs/seo/ogabassey-seo-cutover-checklist-20260731T130857Z-36d42e7.md`: `4cd011607b0bbdff61c088981a8eafeaa4abfd32f34ee116942b24048c504c1d`

### Self-review and concerns

- Confirmed no provider exports were inspected, copied, committed, or changed; no network, product, database, schema, feed, migration, or writer-behaviour change occurred.
- Confirmed the production checker is 261 lines, uses no network or database client, and only reads source/evidence before writing its requested CSV output.
- Confirmed the checker exercises every required fail-closed state in isolated temp fixtures: new unlisted writer, missing inventoried path, duplicate inventory path, header/schema drift, missing test path, and SHA-256 drift.
- Concern: `pnpm turbo lint` is green but reports pre-existing warning-only diagnostics in unrelated `@baci/mobile-storefront` files and one unrelated web component; no lint errors were introduced by this slice. Direct Biome targeting of `apps/web/src/scripts` is excluded by existing Biome configuration, so the package lint result is the applicable lint gate.
- Concern: private and public mobile RPC implementations are both inventoried because both definitions remain current source-visible product-description writers; their future provenance contract and error mapping are explicitly deferred to the ordered C2b/guard work.
- Concern: CodeRabbit review could not complete. An initial staged review attempt was unsupported by the installed CLI; an all-changes review reached setup without returning findings, and the required retry was rate-limited because the Git provider account lacks an assigned CodeRabbit seat. Manual scoped self-review and `git diff --cached --check` completed; no CodeRabbit findings were available to resolve.
