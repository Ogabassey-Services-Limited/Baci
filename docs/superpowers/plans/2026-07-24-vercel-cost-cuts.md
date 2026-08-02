# Vercel Cost Cuts Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove the highest-confidence avoidable Vercel runtime and Runtime Cache work without changing payments, authentication, private-route behavior, or public storefront correctness.

**Architecture:** Remove request-time PDP social-image functions, reject comparison URLs that are not present in the maintained comparison-route manifest before product-detail hydration, scope remote-cache invalidation by merchant while keeping legacy category fallbacks local, and execute Petrock/quiz minute jobs directly from the existing VPS checkout. The authenticated web cron routes remain as manual fallbacks, and the production deployment continues through the VPS prebuilt flow.

**Tech Stack:** Next.js 16 App Router, TypeScript, Vitest, Next Cache Components, Supabase, pnpm/Turborepo, Node.js VPS workers.

## Global Constraints

- Do not modify `apps/web/src/proxy.ts`.
- Do not edit existing Supabase migrations or introduce a migration.
- Do not add service-role authority to a browser or user-facing route.
- Do not expose secrets, raw provider payloads, or customer identifiers in logs.
- Keep the existing `CRON_SECRET`-protected Petrock and quiz HTTP routes as manual fallbacks.
- The normal VPS Petrock and quiz minute schedules must not make HTTP requests to Vercel.
- Preserve Petrock leasing, submission-unknown handling, remediation reconciliation, and notification idempotency.
- Preserve quiz ordering: close due product events, apply the global production gate, then finalize eligible prizes.
- Comparison containment must preserve discovery-curated and maintained-graph routes, plus current reverse-order noindex aliases for an approved canonical pair.
- Unknown legacy category URLs must retain their current fallback query behavior but must not write those high-cardinality entries to the remote cache.
- Remote category and blog-content-link invalidation must be merchant-scoped on normal mutation paths.
- Use TDD: add a failing regression test, observe the expected failure, implement the minimum change, and observe the passing result.
- Use pnpm and Biome; do not add ESLint, `any`, or manual React memoization.
- Production deployment must finish with `vercel deploy --prebuilt --prod` through the established VPS prebuilt workflow; never run a cloud-building Vercel deployment.

---

### Task 1: Remove request-time PDP social-image functions

**Files:**
- Delete: `apps/web/src/app/(storefront)/[slug]/(catalog)/(pdp)/[category]/[productSlug]/opengraph-image.tsx`
- Delete: `apps/web/src/app/(storefront)/[slug]/(catalog)/(pdp)/products/[productSlug]/opengraph-image.tsx`
- Create: `apps/web/src/app/(storefront)/[slug]/(catalog)/(pdp)/product-social-image-architecture.test.ts`
- Modify: `apps/web/src/app/(storefront)/[slug]/opengraph-image.satori-style.test.ts`

**Interfaces:**
- Consumes: existing PDP metadata, which already resolves product image URLs for `openGraph.images` and `twitter.images`.
- Produces: PDP routes with no nested request-time `opengraph-image.tsx`; the storefront-level branded fallback remains available.

- [ ] **Step 1: Add the failing architecture test**

```ts
it('does not define request-time product social-image functions', () => {
  expect(existsSync(categoryPdpOgPath)).toBe(false);
  expect(existsSync(flatPdpOgPath)).toBe(false);
});
```

- [ ] **Step 2: Run the focused test and verify RED**

Run:

```bash
pnpm --filter @baci/web exec vitest run 'src/app/(storefront)/[slug]/(catalog)/(pdp)/product-social-image-architecture.test.ts'
```

Expected: FAIL because both nested OG route files exist.

- [ ] **Step 3: Remove the two nested OG route files and narrow the storefront Satori architecture assertion**

The storefront Satori test must cover only the remaining storefront-level generator and must not expect either deleted PDP generator.

- [ ] **Step 4: Run focused tests and verify GREEN**

```bash
pnpm --filter @baci/web exec vitest run \
  'src/app/(storefront)/[slug]/(catalog)/(pdp)/product-social-image-architecture.test.ts' \
  'src/app/(storefront)/[slug]/opengraph-image.satori-style.test.ts'
```

Expected: both suites pass.

- [ ] **Step 5: Commit**

```bash
git add -A -- \
  'apps/web/src/app/(storefront)/[slug]/(catalog)/(pdp)' \
  'apps/web/src/app/(storefront)/[slug]/opengraph-image.satori-style.test.ts'
git commit -m "perf(storefront): remove request-time PDP social images"
```

---

### Task 2: Contain arbitrary comparison routes

**Files:**
- Create: `apps/web/src/lib/storefront-compare/get-maintained-compare-route-manifest.ts`
- Create: `apps/web/src/lib/storefront-compare/get-maintained-compare-route-manifest.test.ts`
- Modify: `apps/web/src/lib/storefront-compare/load-compare-page.ts`
- Modify: `apps/web/src/lib/storefront-compare/load-compare-page.test.ts`

**Interfaces:**
- Consumes: bounded merchant/category comparison inventory, `buildCuratedCompareSlugSet`, and the same maintained-graph approval policy used by `isMaintainedCompareGraphSlug`.
- Produces: `getMaintainedCompareRouteManifest(input): ReadonlySet<string>`, containing canonical discovery-curated and maintained-graph product comparison slugs for that merchant/category inventory.

- [ ] **Step 1: Add failing loader regression coverage**

```ts
it('returns null without hydrating details for an existing pair absent from the maintained route manifest', async () => {
  const result = await loadComparePage({
    merchantSlug: 'test-store',
    categorySlug: 'smartphones',
    comparisonSlug: 'unapproved-left-vs-unapproved-right',
  });

  expect(result).toBeNull();
  expect(mockGetCachedProductWithDetails).not.toHaveBeenCalled();
});
```

Also retain explicit tests proving:

```ts
expect(graphMaintainedDiscoveryNonCuratedResult?.isIndexable).toBe(true);
expect(reverseApprovedAliasResult?.isLegacyFallback).toBe(true);
expect(discoveryCuratedResult?.isIndexable).toBe(true);
```

- [ ] **Step 2: Run the focused test and verify RED**

```bash
pnpm --filter @baci/web exec vitest run src/lib/storefront-compare/load-compare-page.test.ts
```

Expected: the unapproved existing pair hydrates product details or returns a legacy model instead of returning `null` before detail hydration.

- [ ] **Step 3: Implement the maintained-route manifest**

```ts
export function getMaintainedCompareRouteManifest(
  input: BuildCompareLinkGraphInput & {
    curatedSlugs: ReadonlySet<string>;
  }
): ReadonlySet<string> {
  return new Set([
    ...input.curatedSlugs,
    ...buildCategoryCompareGraphSlugSet(input),
  ]);
}
```

The implementation must include the bounded maintained graph and the anchored/PDP-emitted approval cases already accepted by `isMaintainedCompareGraphSlug`; it must build the per-category manifest once per cached inventory snapshot, not rebuild an O(products²) graph for every untrusted URL.

- [ ] **Step 4: Gate product detail hydration**

After the bounded inventory resolves and both product rows are located, but before `getCachedProductWithDetails`, return `null` when the canonical product pair is absent from the maintained manifest:

```ts
if (
  leftProduct &&
  rightProduct &&
  !maintainedRouteManifest.has(parsed.canonicalSlug)
) {
  logCompareRouteMiss({
    ...args,
    canonicalSlug: parsed.canonicalSlug,
    reason: 'unapproved_product_compare_route',
  });
  return null;
}
```

Brand-comparison behavior remains unchanged. Reverse-order requests for an approved canonical pair pass the canonical membership check and retain their current noindex/canonical fallback behavior.

- [ ] **Step 5: Run focused compare tests and verify GREEN**

```bash
pnpm --filter @baci/web exec vitest run \
  src/lib/storefront-compare/get-maintained-compare-route-manifest.test.ts \
  src/lib/storefront-compare/load-compare-page.test.ts \
  'src/app/(storefront)/[slug]/(catalog)/(listing)/[category]/compare/[comparisonSlug]/page.test.tsx' \
  'src/app/(storefront)/[slug]/(catalog)/(listing)/[category]/compare/[comparisonSlug]/compare-page-content.test.tsx'
```

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/lib/storefront-compare \
  'apps/web/src/app/(storefront)/[slug]/(catalog)/(listing)/[category]/compare/[comparisonSlug]'
git commit -m "perf(storefront): contain arbitrary comparison routes"
```

---

### Task 3: Reduce cross-merchant Runtime Cache writes

**Files:**
- Create: `apps/web/src/lib/category-page-cache-tags.ts`
- Create: `apps/web/src/lib/category-page-cache-tags.test.ts`
- Create: `apps/web/src/lib/blog-content-link-cache-tags.ts`
- Create: `apps/web/src/lib/blog-content-link-cache-tags.test.ts`
- Modify: `apps/web/src/lib/cached-data.ts`
- Modify: `apps/web/src/lib/product-cache-revalidation.ts`
- Modify: `apps/web/src/lib/cache-revalidation.ts`
- Modify: `apps/web/src/lib/cached-dead-content-links.ts`
- Modify: `apps/web/src/lib/cached-content-link-rewrites.ts`
- Modify: `apps/web/src/schemas/internal-revalidate-blog-route.ts`
- Modify normal blog mutation callers and their colocated tests.
- Modify: `apps/web/src/lib/cached-data.category.test.ts`
- Modify: `apps/web/src/lib/cached-data.cache-directives.test.ts`
- Modify: `apps/web/src/lib/cache-revalidation.test.ts`
- Modify: `apps/web/src/lib/cached-dead-content-links.test.ts`
- Modify: `apps/web/src/lib/cached-content-link-rewrites.test.ts`

**Interfaces:**
- Produces: `getCategoryPageDataCacheTag(merchantId): string`.
- Produces: `getBlogContentLinksCacheTag(merchantId): string`.
- Extends: `BlogRevalidationOptions` with `merchantId?: string`.
- Preserves: broad `blog-content-links` compatibility invalidation only when an external/legacy invocation lacks `merchantId`.

- [ ] **Step 1: Add failing cache-tag and directive tests**

```ts
expect(getCategoryPageDataCacheTag(MERCHANT_ID)).toBe(
  `category-page-data-${MERCHANT_ID}`
);
expect(getBlogContentLinksCacheTag(MERCHANT_ID)).toBe(
  `blog-content-links-${MERCHANT_ID}`
);
expect(mockRevalidateTag).toHaveBeenCalledWith(
  `category-page-data-${MERCHANT_ID}`,
  'storefront-page'
);
expect(mockRevalidateTag).not.toHaveBeenCalledWith(
  'category-page-data',
  'storefront-page'
);
```

Directive tests must prove canonical category ID/count readers remain `'use cache: remote'`, while legacy ID/count readers use local `'use cache'` and never `'use cache: remote'`.

- [ ] **Step 2: Run focused tests and verify RED**

```bash
pnpm --filter @baci/web exec vitest run \
  src/lib/category-page-cache-tags.test.ts \
  src/lib/blog-content-link-cache-tags.test.ts \
  src/lib/cached-data.cache-directives.test.ts \
  src/lib/cache-revalidation.test.ts
```

- [ ] **Step 3: Scope the two remote category entries**

Use `getCategoryPageDataCacheTag(merchantId)` in:

```ts
getCachedCategoryPageProductIds
getCachedCategoryPageProductTotalCount
productCacheRevalidation.revalidateProducts
revalidateCategories
```

Remove generic `category-page-data` only from those remote readers and central invalidators. Local category/compare caches keep their current tags and remain covered by `products-${merchantId}` / `categories-${merchantId}`.

- [ ] **Step 4: Route legacy category scopes through local cache readers**

Add local-cache equivalents for the ordered ID list and exact count:

```ts
async function getCachedLegacyCategoryPageProductIds(...) {
  'use cache';
  cacheLife('storefront-page');
  cacheTag(
    getCategoryPageDataCacheTag(merchantId),
    `products-${merchantId}`,
    `categories-${merchantId}`
  );
  // Run the same bounded legacy query and extraction.
}
```

The dispatcher must select local readers only when `scope.kind === 'legacy'`; canonical category, collection, and none scopes retain the remote readers. Do not change the legacy SQL filters or empty/error semantics.

- [ ] **Step 5: Scope the two remote blog content-link entries**

Both remote resolver entries carry:

```ts
cacheTag(
  getBlogContentLinksCacheTag(merchantId),
  'blog-content-links',
  ...existingProductAndCategoryTags
);
```

`revalidateBlogPosts` invalidates the merchant tag when `merchantId` is present, otherwise the compatibility tag. Existing `blog-posts`, RSS, path, and Cloudflare revalidation remains unchanged.

Pass `merchantId` from normal mutation paths:

```ts
revalidateBlogPosts({
  merchantId,
  identifiers,
  canonicalMerchantSlug,
  listingCategories,
  listingPages,
  postSlugs,
});
```

The internal revalidation schema accepts an optional UUID merchant ID so older senders retain the broad fallback.

- [ ] **Step 6: Run all affected cache and route tests**

```bash
pnpm --filter @baci/web exec vitest run \
  src/lib/category-page-cache-tags.test.ts \
  src/lib/blog-content-link-cache-tags.test.ts \
  src/lib/cached-data.category.test.ts \
  src/lib/cached-data.cache-directives.test.ts \
  src/lib/cache-revalidation.test.ts \
  src/lib/cached-dead-content-links.test.ts \
  src/lib/cached-content-link-rewrites.test.ts \
  src/schemas/internal-revalidate-blog-route.test.ts
```

Run every modified blog route’s colocated test as part of this task.

- [ ] **Step 7: Commit**

```bash
git add apps/web/src/lib apps/web/src/schemas \
  apps/web/src/app/api/merchant/blog \
  apps/web/src/app/api/cron/publish-scheduled-posts \
  apps/web/src/app/api/cache/revalidate \
  apps/web/src/app/api/internal/revalidate-blog
git commit -m "perf(cache): scope storefront invalidation by merchant"
```

---

### Task 4: Execute Petrock and quiz minute jobs directly on the VPS

**Files:**
- Create: `apps/web/src/lib/imei-providers/petrock/run-petrock-reconciliation.ts`
- Create: `apps/web/src/lib/imei-providers/petrock/run-petrock-reconciliation.test.ts`
- Create: `apps/web/src/lib/quiz/finalize-due-quiz-events.ts`
- Create: `apps/web/src/lib/quiz/finalize-due-quiz-events.test.ts`
- Create: `apps/web/src/scripts/process-petrock-reconciliation.ts`
- Create: `apps/web/src/scripts/process-petrock-reconciliation.test.ts`
- Create: `apps/web/src/scripts/process-quiz-finalization.ts`
- Create: `apps/web/src/scripts/process-quiz-finalization.test.ts`
- Create: `vps-workers/bin/process-petrock-reconciliation.sh`
- Create: `vps-workers/bin/process-quiz-finalization.sh`
- Create: `vps-workers/bin/direct-web-worker-wrappers.test.mjs`
- Modify: both existing HTTP routes and route tests.
- Modify: `apps/web/tsconfig.tools-workers.json`
- Modify: `vps-workers/deploy.sh`
- Modify: `vps-workers/jobs/deploy-crontab.test.mjs`
- Modify: `vps-workers/jobs/run-web-cron.mjs`
- Modify: `vps-workers/jobs/run-web-cron.test.mjs`
- Modify: `vps-workers/package.json`
- Modify: `vps-workers/README.md`
- Modify: `docs/ops/vps-workers.md`

**Interfaces:**
- Produces: a shared Petrock job function returning the current summary/status data without constructing a `NextResponse`.
- Produces: a shared quiz finalization function returning closed/finalized/skipped data and typed failures.
- Produces: two CLI entrypoints that set `process.exitCode = 1` for operational errors.
- Preserves: authenticated HTTP routes as thin adapters around the shared functions.

- [ ] **Step 1: Add failing shared-service, CLI, wrapper, crontab, and allowlist tests**

Tests must prove:

```ts
// Petrock
expect(providerSubmittingLookup).toBecomeSubmissionUnknown();
expect(leaseLostLookup).toRemainPending();
expect(remediationAndNotifications).toRun();
expect(unconfiguredPetrock).toReturnSkipped();

// Quiz
expect(closeDueEvents).toHaveBeenCalledBefore(productionGateCheck);
expect(finalizeDueEvents).not.toHaveBeenCalledWhenProductionIsUnapproved();
expect(finalizeDueEvents).toHaveBeenCalledWhenProductionIsApproved();
```

VPS tests must assert the minute entries retain the existing `flock` lock and log paths, call the new direct wrappers, and contain neither selected Vercel URL. `run-web-cron.mjs` must reject both removed paths.

- [ ] **Step 2: Run focused tests and verify RED**

```bash
pnpm --filter @baci/web exec vitest run \
  src/lib/imei-providers/petrock/run-petrock-reconciliation.test.ts \
  src/lib/quiz/finalize-due-quiz-events.test.ts \
  src/scripts/process-petrock-reconciliation.test.ts \
  src/scripts/process-quiz-finalization.test.ts
node --test \
  vps-workers/bin/direct-web-worker-wrappers.test.mjs \
  vps-workers/jobs/deploy-crontab.test.mjs \
  vps-workers/jobs/run-web-cron.test.mjs
```

- [ ] **Step 3: Extract the shared job services**

Move route-owned business logic without reordering it. The HTTP adapters retain authentication as their first operation, invoke the shared service, and map the returned result/failure to the same status codes and response shapes.

- [ ] **Step 4: Add direct CLI entrypoints**

Petrock requires a credential-free HTTPS `BACI_WEB_BASE_URL` because remediation URLs need an origin. Quiz requires the existing Supabase/admin and quiz gate variables, but neither direct CLI sends `CRON_SECRET`.

```ts
try {
  const result = await runJob();
  console.info('[job-name] completed', sanitizeSummary(result));
} catch {
  console.error('[job-name] failed');
  process.exitCode = 1;
}
```

- [ ] **Step 5: Add shell wrappers and change the VPS schedule**

Each shell wrapper uses:

```bash
#!/usr/bin/env bash
set -euo pipefail
SCRIPT_DIR="$(CDPATH= cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
exec "$SCRIPT_DIR/run-web-script.sh" <label> <script-path>
```

Replace only the two selected minute entries in `deploy.sh`. Keep their lock files, log files, and cadence unchanged.

- [ ] **Step 6: Remove the selected paths from the web-cron allowlist and update operations documentation**

Document that direct VPS execution is the normal path, HTTP routes are manual fallbacks, failures exit nonzero and remain in persistent logs, and no verified pager transport exists.

- [ ] **Step 7: Run focused web and VPS worker tests and verify GREEN**

```bash
pnpm --filter @baci/web exec vitest run \
  src/lib/imei-providers/petrock/run-petrock-reconciliation.test.ts \
  src/lib/quiz/finalize-due-quiz-events.test.ts \
  src/scripts/process-petrock-reconciliation.test.ts \
  src/scripts/process-quiz-finalization.test.ts \
  'src/app/api/cron/petrock-reconcile/route.test.ts' \
  'src/app/api/quiz/finalize/route.test.ts'
pnpm --dir vps-workers test
```

- [ ] **Step 8: Commit**

```bash
git add apps/web/src/lib/imei-providers/petrock apps/web/src/lib/quiz \
  apps/web/src/scripts apps/web/src/app/api/cron/petrock-reconcile \
  apps/web/src/app/api/quiz/finalize apps/web/tsconfig.tools-workers.json \
  vps-workers docs/ops/vps-workers.md
git commit -m "perf(workers): run Petrock and quiz directly on VPS"
```

---

### Task 5: Integrate, review, deploy, and verify

**Files:**
- No planned source changes; fixes are allowed only for review or verification findings.

- [ ] **Step 1: Run the repository quality gate**

```bash
pnpm turbo lint
pnpm turbo typecheck
pnpm turbo test
```

- [ ] **Step 2: Run the VPS worker suite and tools-worker compile gate**

```bash
pnpm --dir vps-workers test
pnpm --filter @baci/web exec tsc -p tsconfig.tools-workers.json --noEmit
```

- [ ] **Step 3: Run CodeRabbit**

```bash
coderabbit review --agent -t uncommitted
```

Fix all applicable critical/high findings and rerun their covering tests.

- [ ] **Step 4: Review the exact branch diff**

Confirm:

```bash
git diff --check origin/main...HEAD
git status --short
git log --oneline origin/main..HEAD
```

- [ ] **Step 5: Push and complete the repository merge gate**

Require fresh substantive review for the exact head SHA, green required checks, and resolved applicable threads before production deployment.

- [ ] **Step 6: Deploy through the established VPS prebuilt workflow**

Do not run a Vercel cloud build. The deployment must use the repository’s VPS/local prebuilt process and finish with:

```bash
vercel deploy --prebuilt --prod
```

- [ ] **Step 7: Apply the VPS worker schedule and verify**

Verify the installed Petrock and quiz minute entries invoke direct wrappers and that their logs show successful runs. Keep the web routes available for authenticated manual fallback.

- [ ] **Step 8: Verify production behavior and cost denominators**

Confirm:

- PDP requests no longer execute a nested product `opengraph-image` function.
- An approved comparison page remains `200`.
- An unapproved arbitrary product pair returns `404` without detail hydration.
- Petrock and quiz are absent from normal Vercel minute traffic after the VPS schedule cutover.
- Runtime Cache tag telemetry no longer shows normal cross-merchant invalidation for the scoped category/blog resolver tags.
