# OgaBassey PDP Critical Rendering Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild the OgaBassey product detail page critical path so the target mobile PDP reaches live lab LCP under `2500 ms` without splitting the product SEO entity.

**Architecture:** Treat the OgaBassey PDP as a first-class product document with a narrow cached first-viewport product snapshot, a server-rendered critical shell, a hydrated commerce island, and a separate below-fold document island. Move PDP routes into their own route group so PDPs load PDP-scoped CSS instead of the broad storefront stylesheet, while listing/home/content routes keep the full stylesheet.

**Tech Stack:** Next.js 16 App Router, React 19 Server Components, TypeScript, Tailwind CSS v4, CSS Modules, Supabase cached public data, Vitest/React Testing Library, DebugBear API, Chrome DevTools trace.

---

## Current Evidence

- Target URL: `https://ogabassey.com/laptops/lenovo-legion-pro-9-16irx9-rtx-4090`.
- Scope: OgaBassey merchant PDP only.
- Pre-PR #2008 live DebugBear mobile results:
  - Quick Test `50`, `us-east`: LCP `4360 ms`, FCP `2156 ms`, TBT `345 ms`, CLS `0.000`.
  - Quick Test `51`, `southafrica`: LCP `3772 ms`, FCP `2440 ms`, TBT `614 ms`, CLS `0.000`.
- PR #2008 reduces the selected mobile PDP image candidate from `1080w` to `750w`, but live deployment still has to prove the post-merge number.
- The remaining root problem is not only image bytes. The PDP is still assembled through the generic storefront route, broad CSS ownership, and a broad client-owned product page before the final interactive state settles.

## Upgrade Corrections

- The CSS split no longer imports `storefront-full.css` from `(catalog)/layout.tsx`. PDP routes move into `(catalog)/(pdp)` and receive `storefront-pdp.css`. Listing/search/category routes move into `(catalog)/(listing)` and receive `storefront-full.css`.
- The client island no longer hides the whole existing product grid. It removes duplicate image/title/price markup while preserving desktop and mobile purchase controls.
- JSON-LD, hidden summary copy, and semantic/content sections stay outside `.commerceSlot`. The critical shell owns only first-viewport image/title/price plus the commerce island placeholder.
- The critical query does not assume a `products.review_count` column. Review count comes from existing full product normalization for hydrated UI, and the critical shell uses `schema_markup.aggregateRating` only when present.
- The server shell and client-island split ship atomically. Do not deploy a commit that renders the server shell while the old client shell still renders the same H1/image/price.
- Route tests use the existing `runtimeRouteManifest`, `existsSync`, and `resolveRsc` helpers already present in the repo.
- The DebugBear script stores raw API responses and derives follow-up URLs from the response body before assuming a polling path.
- Tailwind v4 `@source` directory entries are valid, but this plan also adds explicit nested component globs for PDP components so future subdirectories under `components/storefront/ogabassey/pdp/` are not missed.
- Every execution step starts from the isolated worktree `/Users/mac/Baci-app/.worktrees/ogabassey-pdp-critical-rendering` so route moves do not collide with another active checkout.

## Non-Goals

- Do not redesign the OgaBassey PDP.
- Do not change non-OgaBassey template behavior beyond preserving existing product route aliases.
- Do not modify `apps/web/src/proxy.ts`.
- Do not commit DebugBear, PSI, Supabase, or SSH credentials.
- Do not add a new image CDN in this slice.
- Do not add manual `React.memo`, `useCallback`, or `useMemo`.

## Target Acceptance

- Live DebugBear or PSI mobile result for the target PDP reports `LCP < 2500 ms`.
- LCP element is the real product image or the visible product shell, not a fallback skeleton.
- The product image request is discovered before full product detail joins finish.
- The PDP no longer loads the broad storefront CSS bundle as its first route stylesheet.
- The visible H1, visible price, canonical URL, OpenGraph image/price metadata, hidden crawlable summary, and Product JSON-LD describe the same product row.
- Desktop PDP still shows purchase controls, variant controls, condition controls, wishlist/share controls, and cart actions.
- Tailwind build output includes classes from nested PDP components after the `storefront-pdp.css` split.

---

## File Structure

### New Files

- `apps/web/src/components/storefront/ogabassey/pdp/critical-product.ts` maps cached LCP-hint rows and full product rows into one first-viewport product shape.
- `apps/web/src/components/storefront/ogabassey/pdp/critical-product.test.ts` verifies image, price, category, condition, and schema aggregate-rating mapping.
- `apps/web/src/components/storefront/ogabassey/pdp/critical-shell.tsx` is the server component for breadcrumbs, LCP image, brand, H1, rating copy, price, condition badge, and reserved commerce slot.
- `apps/web/src/components/storefront/ogabassey/pdp/critical-shell.module.css` contains PDP-critical first-viewport shell styles.
- `apps/web/src/components/storefront/ogabassey/pdp/critical-shell.test.tsx` verifies server-rendered image/title/price output and high-priority image attributes.
- `apps/web/src/components/storefront/ogabassey/pdp/client-islands.tsx` exports separate commerce and below-fold client islands.
- `apps/web/src/components/storefront/ogabassey/pdp/client-islands.test.tsx` proves purchase controls render without a duplicate H1/image and that below-fold content uses the non-commerce mode.
- `apps/web/src/components/storefront/ogabassey/pages/product-details-page/product-interaction-panel.tsx` renders condition controls, wishlist/share buttons, variant controls, delivery controls, cart controls, and trust cards.
- `apps/web/src/app/(storefront)/storefront-core.css` is the small theme/base CSS imported by `[slug]/layout.tsx`.
- `apps/web/src/app/(storefront)/storefront-pdp.css` is the PDP-scoped Tailwind build for layout chrome, PDP client islands, PDP deferred sections, and shared UI dependencies used by those components.
- `apps/web/src/app/(storefront)/storefront-full.css` wraps the current broad storefront stylesheet for non-PDP route families.
- `apps/web/src/app/(storefront)/[slug]/(catalog)/(pdp)/layout.tsx` imports `storefront-pdp.css` for PDP route aliases only.
- `apps/web/src/app/(storefront)/[slug]/(catalog)/(listing)/layout.tsx` imports `storefront-full.css` for category, listing, search, compare, and best-under routes.
- `apps/web/src/app/(storefront)/[slug]/(home)/layout.tsx`, `(blog)/layout.tsx`, `(content)/layout.tsx`, `(customer)/layout.tsx`, and `(utility)/layout.tsx` import `storefront-full.css`.
- `apps/web/tools/perf/measure-ogabassey-pdp-lcp.mjs` runs DebugBear quick tests, stores raw responses under `/tmp`, and prints normalized metrics.

### Moved Files

- Move `apps/web/src/app/(storefront)/[slug]/(catalog)/[category]/[productSlug]/*` to `apps/web/src/app/(storefront)/[slug]/(catalog)/(pdp)/[category]/[productSlug]/*`.
- Move `apps/web/src/app/(storefront)/[slug]/(catalog)/products/[productSlug]/*` to `apps/web/src/app/(storefront)/[slug]/(catalog)/(pdp)/products/[productSlug]/*`.
- Move `apps/web/src/app/(storefront)/[slug]/(catalog)/product/[productSlug]/*` to `apps/web/src/app/(storefront)/[slug]/(catalog)/(pdp)/product/[productSlug]/*`.
- Move `apps/web/src/app/(storefront)/[slug]/(catalog)/products/page.tsx`, `page.test.tsx`, `products-page-content.tsx`, `products-page-content.test.tsx`, `product-index-card.tsx`, and `product-index-card.test.tsx` to `apps/web/src/app/(storefront)/[slug]/(catalog)/(listing)/products/`.
- Move `apps/web/src/app/(storefront)/[slug]/(catalog)/search/*` to `apps/web/src/app/(storefront)/[slug]/(catalog)/(listing)/search/*`.
- Move `apps/web/src/app/(storefront)/[slug]/(catalog)/[category]/page.tsx`, `page.test.tsx`, `category-page-content.tsx`, `category-page-content.test.tsx`, `category-page-content-helpers.ts`, and `category-page-content-helpers.test.ts` to `apps/web/src/app/(storefront)/[slug]/(catalog)/(listing)/[category]/`.
- Move `apps/web/src/app/(storefront)/[slug]/(catalog)/[category]/compare/[comparisonSlug]/*` to `apps/web/src/app/(storefront)/[slug]/(catalog)/(listing)/[category]/compare/[comparisonSlug]/*`.
- Move `apps/web/src/app/(storefront)/[slug]/(catalog)/[category]/best-under/[priceBandSlug]/*` to `apps/web/src/app/(storefront)/[slug]/(catalog)/(listing)/[category]/best-under/[priceBandSlug]/*`.

### Modified Files

- `apps/web/src/lib/cached-data.ts` extends `CachedProductLcpHint` with price, brand, condition, stock, and schema markup fields that live on `products`.
- `apps/web/src/lib/cached-data.products.test.ts` protects the narrow query from pulling full detail joins.
- `apps/web/src/app/(storefront)/[slug]/layout.tsx` replaces the broad stylesheet import with `storefront-core.css`.
- `apps/web/src/app/(storefront)/[slug]/(commerce)/layout.tsx` imports `storefront-full.css` so cart and checkout routes keep existing styling after the parent layout stops importing broad CSS.
- `apps/web/src/app/(storefront)/[slug]/route-groups.test.ts` updates route manifest paths and asserts PDP routes are isolated from listing CSS ownership.
- `apps/web/src/app/(storefront)/[slug]/(catalog)/(pdp)/[category]/[productSlug]/page.tsx` uses the critical snapshot for early hint and server critical shell, keeps full product details behind Suspense, and renders OgaBassey client islands instead of the broad client-owned shell.
- `apps/web/src/app/(storefront)/[slug]/(catalog)/(pdp)/[category]/[productSlug]/page.test.tsx` adds no-duplicate-H1, early-shell, and SEO entity consistency checks.
- `apps/web/src/components/storefront/ogabassey/pages/product-details-page.tsx` adds a `mode` prop so legacy full-shell behavior stays available while OgaBassey PDP uses `commerce` and `belowFold` modes.
- `apps/web/src/components/storefront/ogabassey/pages/product-details-page/product-summary-panel.tsx` adds `summaryOnly` mode for share/wishlist and condition controls without duplicating the server-owned H1/price/rating block.
- `docs/audits/2026-05-13-storefront-lcp-baseline.md` gets pre-deploy and post-deploy rows without changing existing table column alignment.

---

## Task 1: Confirm Isolated Worktree Execution Path

**Files:**
- No file changes.

- [ ] **Step 1: Confirm the isolated worktree before execution**

Run:

```bash
pwd
git status --short --branch
```

Expected:

```text
/Users/mac/Baci-app/.worktrees/ogabassey-pdp-critical-rendering
## codex/ogabassey-pdp-critical-rendering...origin/main
```

If `pwd` is not `/Users/mac/Baci-app/.worktrees/ogabassey-pdp-critical-rendering`, stop and `cd /Users/mac/Baci-app/.worktrees/ogabassey-pdp-critical-rendering` before running any route move, build, test, or git command.

---

## Task 2: Establish A Trustworthy Measurement Harness

**Files:**
- Create: `apps/web/tools/perf/measure-ogabassey-pdp-lcp.mjs`
- Modify: `apps/web/package.json`
- Modify: `docs/audits/2026-05-13-storefront-lcp-baseline.md`

- [ ] **Step 1: Create the DebugBear measurement script**

Create `apps/web/tools/perf/measure-ogabassey-pdp-lcp.mjs`:

```js
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

const projectId = process.env.DEBUGBEAR_PROJECT_ID;
const apiKey = process.env.DEBUGBEAR_API_KEY;
const targetUrl =
  process.env.OGABASSEY_PDP_LCP_URL ||
  'https://ogabassey.com/laptops/lenovo-legion-pro-9-16irx9-rtx-4090';
const device = process.env.DEBUGBEAR_DEVICE || 'Mobile';
const region = process.env.DEBUGBEAR_REGION || 'us-east';
const rawDir = process.env.DEBUGBEAR_RAW_DIR || '/tmp';

if (!projectId) throw new Error('DEBUGBEAR_PROJECT_ID is required');
if (!apiKey) throw new Error('DEBUGBEAR_API_KEY is required');

async function debugbear(path, init = {}) {
  const response = await fetch(`https://www.debugbear.com/api/v1${path}`, {
    ...init,
    headers: {
      'x-api-key': apiKey,
      'Content-Type': 'application/json',
      ...(init.headers || {}),
    },
  });
  const text = await response.text();
  const body = text ? JSON.parse(text) : {};
  if (!response.ok) throw new Error(`DebugBear ${response.status}: ${text}`);
  return body;
}

function firstQuickTest(body) {
  if (Array.isArray(body)) return body[0] || null;
  if (Array.isArray(body.quickTests)) return body.quickTests[0] || null;
  if (Array.isArray(body.tests)) return body.tests[0] || null;
  return body;
}

function getQuickTestId(body) {
  const quickTest = firstQuickTest(body);
  return (
    quickTest?.id ||
    quickTest?.quickTestId ||
    quickTest?.testId ||
    quickTest?.resultId ||
    null
  );
}

function getPollPath(body, quickTestId) {
  const quickTest = firstQuickTest(body);
  const link =
    quickTest?.apiUrl ||
    quickTest?.pollUrl ||
    quickTest?.resultApiUrl ||
    quickTest?._links?.self?.href ||
    quickTest?._links?.result?.href;
  if (typeof link === 'string') {
    return new URL(link, 'https://www.debugbear.com').pathname.replace(
      '/api/v1',
      ''
    );
  }
  return `/quickTest/${quickTestId}`;
}

function isComplete(body) {
  const status = `${body.status || body.state || ''}`.toLowerCase();
  return (
    body.hasFinished === true ||
    status === 'complete' ||
    status === 'completed' ||
    Boolean(body.lighthouseResult) ||
    Boolean(body.metrics?.['performance.largestContentfulPaint'])
  );
}

function metric(body, names) {
  for (const name of names) {
    const value =
      body.metrics?.[name] ||
      body.summary?.[name] ||
      body.lighthouseResult?.audits?.[name]?.numericValue;
    if (typeof value === 'number') return value;
  }
  return null;
}

await mkdir(rawDir, { recursive: true });

const created = await debugbear(`/project/${projectId}/quickTests`, {
  method: 'POST',
  body: JSON.stringify([{ url: targetUrl, device, region }]),
});

const quickTestId = getQuickTestId(created);
await writeFile(
  join(rawDir, `debugbear-ogabassey-pdp-create-${Date.now()}.json`),
  JSON.stringify(created, null, 2)
);

if (!quickTestId) {
  console.log(JSON.stringify(created, null, 2));
  throw new Error('DebugBear response did not include a quick test id');
}

const pollPath = getPollPath(created, quickTestId);
let result = created;
for (let attempt = 0; attempt < 90; attempt += 1) {
  result = await debugbear(pollPath);
  if (isComplete(result)) break;
  await new Promise((resolve) => setTimeout(resolve, 5000));
}

await writeFile(
  join(rawDir, `debugbear-ogabassey-pdp-result-${quickTestId}.json`),
  JSON.stringify(result, null, 2)
);

console.log(
  JSON.stringify(
    {
      quickTestId,
      url: targetUrl,
      device,
      region,
      lcpMs: metric(result, [
        'performance.largestContentfulPaint',
        'largestContentfulPaint',
        'lcp',
      ]),
      fcpMs: metric(result, [
        'performance.firstContentfulPaint',
        'firstContentfulPaint',
        'fcp',
      ]),
      tbtMs: metric(result, [
        'performance.totalBlockingTime',
        'totalBlockingTime',
        'tbt',
      ]),
      cls: metric(result, [
        'performance.cumulativeLayoutShift',
        'cumulativeLayoutShift',
        'cls',
      ]),
      resultUrl:
        result.url ||
        result.resultUrl ||
        `https://www.debugbear.com/project/${projectId}/quickTest/${quickTestId}/overview`,
    },
    null,
    2
  )
);
```

- [ ] **Step 2: Add package script**

Add this script to `apps/web/package.json` while preserving existing scripts:

```json
"perf:ogabassey-pdp-lcp": "node tools/perf/measure-ogabassey-pdp-lcp.mjs"
```

- [ ] **Step 3: Verify missing-env behavior**

Run:

```bash
pnpm --dir apps/web perf:ogabassey-pdp-lcp
```

Expected:

```text
Error: DEBUGBEAR_PROJECT_ID is required
```

- [ ] **Step 4: Record current PR #2008 deployment state**

Run:

```bash
env -u GITHUB_TOKEN gh pr view 2008 --repo ogabasseyy/Baci --json state,mergedAt,mergeCommit,statusCheckRollup,url
```

Expected:

```text
state is OPEN or MERGED
mergedAt is null only when state is OPEN
statusCheckRollup contains only successful required checks when state is OPEN
```

Append one row to `docs/audits/2026-05-13-storefront-lcp-baseline.md` using the existing table shape. Do not add, remove, or reorder table columns.

- [ ] **Step 5: Commit measurement harness**

Run:

```bash
git add apps/web/tools/perf/measure-ogabassey-pdp-lcp.mjs apps/web/package.json docs/audits/2026-05-13-storefront-lcp-baseline.md
git commit -m "Add OgaBassey PDP LCP measurement harness"
```

Expected:

```text
[branch] Add OgaBassey PDP LCP measurement harness
```

---

## Task 3: Split PDP Route CSS At The Architecture Boundary

**Files:**
- Create: `apps/web/src/app/(storefront)/storefront-core.css`
- Create: `apps/web/src/app/(storefront)/storefront-pdp.css`
- Create: `apps/web/src/app/(storefront)/storefront-full.css`
- Create: `apps/web/src/app/(storefront)/[slug]/(catalog)/(pdp)/layout.tsx`
- Create: `apps/web/src/app/(storefront)/[slug]/(catalog)/(listing)/layout.tsx`
- Create: `apps/web/src/app/(storefront)/[slug]/(home)/layout.tsx`
- Create: `apps/web/src/app/(storefront)/[slug]/(blog)/layout.tsx`
- Create: `apps/web/src/app/(storefront)/[slug]/(content)/layout.tsx`
- Create: `apps/web/src/app/(storefront)/[slug]/(customer)/layout.tsx`
- Create: `apps/web/src/app/(storefront)/[slug]/(utility)/layout.tsx`
- Move: `apps/web/src/app/(storefront)/[slug]/(catalog)/[category]/[productSlug]/*` to `apps/web/src/app/(storefront)/[slug]/(catalog)/(pdp)/[category]/[productSlug]/*`
- Move: `apps/web/src/app/(storefront)/[slug]/(catalog)/products/[productSlug]/*` to `apps/web/src/app/(storefront)/[slug]/(catalog)/(pdp)/products/[productSlug]/*`
- Move: `apps/web/src/app/(storefront)/[slug]/(catalog)/product/[productSlug]/*` to `apps/web/src/app/(storefront)/[slug]/(catalog)/(pdp)/product/[productSlug]/*`
- Move: `apps/web/src/app/(storefront)/[slug]/(catalog)/products/{page.tsx,page.test.tsx,products-page-content.tsx,products-page-content.test.tsx,product-index-card.tsx,product-index-card.test.tsx}` to `apps/web/src/app/(storefront)/[slug]/(catalog)/(listing)/products/`
- Move: `apps/web/src/app/(storefront)/[slug]/(catalog)/search/*` to `apps/web/src/app/(storefront)/[slug]/(catalog)/(listing)/search/*`
- Move: `apps/web/src/app/(storefront)/[slug]/(catalog)/[category]/{page.tsx,page.test.tsx,category-page-content.tsx,category-page-content.test.tsx,category-page-content-helpers.ts,category-page-content-helpers.test.ts}` to `apps/web/src/app/(storefront)/[slug]/(catalog)/(listing)/[category]/`
- Move: `apps/web/src/app/(storefront)/[slug]/(catalog)/[category]/compare/[comparisonSlug]/*` to `apps/web/src/app/(storefront)/[slug]/(catalog)/(listing)/[category]/compare/[comparisonSlug]/*`
- Move: `apps/web/src/app/(storefront)/[slug]/(catalog)/[category]/best-under/[priceBandSlug]/*` to `apps/web/src/app/(storefront)/[slug]/(catalog)/(listing)/[category]/best-under/[priceBandSlug]/*`
- Modify: `apps/web/src/app/(storefront)/[slug]/layout.tsx`
- Modify: `apps/web/src/app/(storefront)/[slug]/(commerce)/layout.tsx`
- Modify: `apps/web/src/app/(storefront)/[slug]/route-groups.test.ts`

- [ ] **Step 1: Update the route manifest test first**

In `apps/web/src/app/(storefront)/[slug]/route-groups.test.ts`, update the moved route entries to use `(catalog)/(pdp)` for product detail routes and `(catalog)/(listing)` for listing routes. Add this test:

```ts
it('keeps PDP routes out of the full catalog CSS group', () => {
  expect(existsSync(resolve(slugDirectory, '(catalog)/layout.tsx'))).toBe(
    false
  );
  expect(
    existsSync(resolve(slugDirectory, '(catalog)/(pdp)/layout.tsx'))
  ).toBe(true);
  expect(
    existsSync(resolve(slugDirectory, '(catalog)/(listing)/layout.tsx'))
  ).toBe(true);
  expect(
    existsSync(
      resolve(
        slugDirectory,
        '(catalog)/(pdp)/[category]/[productSlug]/page.tsx'
      )
    )
  ).toBe(true);
  expect(
    existsSync(
      resolve(
        slugDirectory,
        '(catalog)/(listing)/[category]/[productSlug]/page.tsx'
      )
    )
  ).toBe(false);
});
```

Update these exact catalog entries in `runtimeRouteManifest` to the new route-group paths, including listing utility pages:

```text
'(catalog)/products/page.tsx' ->
  '(catalog)/(listing)/products/page.tsx'
'(catalog)/products/[productSlug]/page.tsx' ->
  '(catalog)/(pdp)/products/[productSlug]/page.tsx'
'(catalog)/products/[productSlug]/loading.tsx' ->
  '(catalog)/(pdp)/products/[productSlug]/loading.tsx'
'(catalog)/product/[productSlug]/page.tsx' ->
  '(catalog)/(pdp)/product/[productSlug]/page.tsx'
'(catalog)/product/[productSlug]/loading.tsx' ->
  '(catalog)/(pdp)/product/[productSlug]/loading.tsx'
'(catalog)/[category]/page.tsx' ->
  '(catalog)/(listing)/[category]/page.tsx'
'(catalog)/[category]/[productSlug]/page.tsx' ->
  '(catalog)/(pdp)/[category]/[productSlug]/page.tsx'
'(catalog)/[category]/[productSlug]/loading.tsx' ->
  '(catalog)/(pdp)/[category]/[productSlug]/loading.tsx'
'(catalog)/[category]/compare/[comparisonSlug]/loading.tsx' ->
  '(catalog)/(listing)/[category]/compare/[comparisonSlug]/loading.tsx'
'(catalog)/[category]/best-under/[priceBandSlug]/loading.tsx' ->
  '(catalog)/(listing)/[category]/best-under/[priceBandSlug]/loading.tsx'
```

Add these listing utility page entries to `runtimeRouteManifest` so the moved route pages themselves are covered, not only their loading boundaries:

```text
'(catalog)/(listing)/search/page.tsx'
'(catalog)/(listing)/[category]/compare/[comparisonSlug]/page.tsx'
'(catalog)/(listing)/[category]/best-under/[priceBandSlug]/page.tsx'
```

Update `firstPaintOwnershipManifest` in the same file so its catalog entries point to the new route-group paths:

```ts
{
  routePath: '/products',
  pagePath: '(catalog)/(listing)/products/page.tsx',
  loadingPath: '(catalog)/loading.tsx',
  label: 'Loading product listing',
  renderStrategy: 'lazy-module',
},
{
  routePath: '/phones',
  pagePath: '(catalog)/(listing)/[category]/page.tsx',
  loadingPath: '(catalog)/loading.tsx',
  label: 'Loading product listing',
  renderStrategy: 'lazy-module',
},
{
  routePath: '/products/iphone-16-pro',
  pagePath: '(catalog)/(pdp)/products/[productSlug]/page.tsx',
  loadingPath: '(catalog)/(pdp)/products/[productSlug]/loading.tsx',
  label: 'Loading product page',
  renderStrategy: 'lazy-module',
},
{
  routePath: '/product/iphone-16-pro',
  pagePath: '(catalog)/(pdp)/product/[productSlug]/page.tsx',
  loadingPath: '(catalog)/(pdp)/product/[productSlug]/loading.tsx',
  label: 'Loading product page',
  renderStrategy: 'lazy-module',
},
{
  routePath: '/phones/iphone-16-pro',
  pagePath: '(catalog)/(pdp)/[category]/[productSlug]/page.tsx',
  loadingPath: '(catalog)/(pdp)/[category]/[productSlug]/loading.tsx',
  label: 'Loading product page',
  renderStrategy: 'lazy-module',
},
```

- [ ] **Step 2: Run the route test and verify it fails**

Run:

```bash
pnpm --dir apps/web test src/app/'(storefront)'/'[slug]'/route-groups.test.ts -- -t "keeps PDP routes out"
```

Expected:

```text
FAIL ... expected false to be true
```

- [ ] **Step 3: Move route files with `git mv`**

Run:

```bash
mkdir -p apps/web/src/app/'(storefront)'/'[slug]'/'(catalog)'/'(pdp)'/'[category]'
mkdir -p apps/web/src/app/'(storefront)'/'[slug]'/'(catalog)'/'(pdp)'/products
mkdir -p apps/web/src/app/'(storefront)'/'[slug]'/'(catalog)'/'(pdp)'/product
mkdir -p apps/web/src/app/'(storefront)'/'[slug]'/'(catalog)'/'(listing)'/'[category]'
git mv apps/web/src/app/'(storefront)'/'[slug]'/'(catalog)'/'[category]'/'[productSlug]' apps/web/src/app/'(storefront)'/'[slug]'/'(catalog)'/'(pdp)'/'[category]'/'[productSlug]'
git mv apps/web/src/app/'(storefront)'/'[slug]'/'(catalog)'/products/'[productSlug]' apps/web/src/app/'(storefront)'/'[slug]'/'(catalog)'/'(pdp)'/products/'[productSlug]'
git mv apps/web/src/app/'(storefront)'/'[slug]'/'(catalog)'/product/'[productSlug]' apps/web/src/app/'(storefront)'/'[slug]'/'(catalog)'/'(pdp)'/product/'[productSlug]'
mkdir -p apps/web/src/app/'(storefront)'/'[slug]'/'(catalog)'/'(listing)'/products
git mv apps/web/src/app/'(storefront)'/'[slug]'/'(catalog)'/products/page.tsx apps/web/src/app/'(storefront)'/'[slug]'/'(catalog)'/'(listing)'/products/page.tsx
git mv apps/web/src/app/'(storefront)'/'[slug]'/'(catalog)'/products/page.test.tsx apps/web/src/app/'(storefront)'/'[slug]'/'(catalog)'/'(listing)'/products/page.test.tsx
git mv apps/web/src/app/'(storefront)'/'[slug]'/'(catalog)'/products/products-page-content.tsx apps/web/src/app/'(storefront)'/'[slug]'/'(catalog)'/'(listing)'/products/products-page-content.tsx
git mv apps/web/src/app/'(storefront)'/'[slug]'/'(catalog)'/products/products-page-content.test.tsx apps/web/src/app/'(storefront)'/'[slug]'/'(catalog)'/'(listing)'/products/products-page-content.test.tsx
git mv apps/web/src/app/'(storefront)'/'[slug]'/'(catalog)'/products/product-index-card.tsx apps/web/src/app/'(storefront)'/'[slug]'/'(catalog)'/'(listing)'/products/product-index-card.tsx
git mv apps/web/src/app/'(storefront)'/'[slug]'/'(catalog)'/products/product-index-card.test.tsx apps/web/src/app/'(storefront)'/'[slug]'/'(catalog)'/'(listing)'/products/product-index-card.test.tsx
git mv apps/web/src/app/'(storefront)'/'[slug]'/'(catalog)'/search apps/web/src/app/'(storefront)'/'[slug]'/'(catalog)'/'(listing)'/search
git mv apps/web/src/app/'(storefront)'/'[slug]'/'(catalog)'/'[category]'/page.tsx apps/web/src/app/'(storefront)'/'[slug]'/'(catalog)'/'(listing)'/'[category]'/page.tsx
git mv apps/web/src/app/'(storefront)'/'[slug]'/'(catalog)'/'[category]'/page.test.tsx apps/web/src/app/'(storefront)'/'[slug]'/'(catalog)'/'(listing)'/'[category]'/page.test.tsx
git mv apps/web/src/app/'(storefront)'/'[slug]'/'(catalog)'/'[category]'/category-page-content.tsx apps/web/src/app/'(storefront)'/'[slug]'/'(catalog)'/'(listing)'/'[category]'/category-page-content.tsx
git mv apps/web/src/app/'(storefront)'/'[slug]'/'(catalog)'/'[category]'/category-page-content.test.tsx apps/web/src/app/'(storefront)'/'[slug]'/'(catalog)'/'(listing)'/'[category]'/category-page-content.test.tsx
git mv apps/web/src/app/'(storefront)'/'[slug]'/'(catalog)'/'[category]'/category-page-content-helpers.ts apps/web/src/app/'(storefront)'/'[slug]'/'(catalog)'/'(listing)'/'[category]'/category-page-content-helpers.ts
git mv apps/web/src/app/'(storefront)'/'[slug]'/'(catalog)'/'[category]'/category-page-content-helpers.test.ts apps/web/src/app/'(storefront)'/'[slug]'/'(catalog)'/'(listing)'/'[category]'/category-page-content-helpers.test.ts
git mv apps/web/src/app/'(storefront)'/'[slug]'/'(catalog)'/'[category]'/compare apps/web/src/app/'(storefront)'/'[slug]'/'(catalog)'/'(listing)'/'[category]'/compare
git mv apps/web/src/app/'(storefront)'/'[slug]'/'(catalog)'/'[category]'/best-under apps/web/src/app/'(storefront)'/'[slug]'/'(catalog)'/'(listing)'/'[category]'/best-under
```

Expected:

```text
git status shows route file renames
```

- [ ] **Step 4: Update absolute imports after the route move**

Run:

```bash
rg -n "@/app/\\(storefront\\)/\\[slug\\]/\\(catalog\\)/(products|\\[category\\])|src/app/\\(storefront\\)/\\[slug\\]/\\(catalog\\)/(products|\\[category\\])" apps/web/src/app/'(storefront)'/'[slug]'/'(catalog)'
```

Replace these exact path prefixes where they appear:

```text
@/app/(storefront)/[slug]/(catalog)/products/[productSlug] -> @/app/(storefront)/[slug]/(catalog)/(pdp)/products/[productSlug]
@/app/(storefront)/[slug]/(catalog)/products/product-index-card -> @/app/(storefront)/[slug]/(catalog)/(listing)/products/product-index-card
src/app/(storefront)/[slug]/(catalog)/[category]/[productSlug]/page.tsx -> src/app/(storefront)/[slug]/(catalog)/(pdp)/[category]/[productSlug]/page.tsx
```

Then run:

```bash
rg -n "@/app/\\(storefront\\)/\\[slug\\]/\\(catalog\\)/(products|\\[category\\])|src/app/\\(storefront\\)/\\[slug\\]/\\(catalog\\)/(products|\\[category\\])" apps/web/src/app/'(storefront)'/'[slug]'/'(catalog)' || true
```

Expected:

```text
No stale absolute imports remain, except relative imports that intentionally stay inside their moved folder.
```

- [ ] **Step 5: Create core and route-scoped stylesheets**

Create `apps/web/src/app/(storefront)/storefront-core.css`:

```css
@theme inline {
  --color-store-primary: var(--store-primary, #2a2c6e);
  --color-store-primary-text: var(--store-primary-text, #ffffff);
  --color-store-on-primary: var(--store-on-primary, #ffffff);
  --color-store-secondary: var(--store-secondary, #f3f4f6);
  --color-store-secondary-text: var(--store-secondary-text, #111827);
  --color-store-accent: var(--store-accent, #2a2c6e);
  --color-store-accent-text: var(--store-accent-text, #ffffff);
  --color-store-background: var(--store-background, #ffffff);
  --color-store-background-text: var(--store-background-text, #111827);
  --color-store-foreground: var(--store-foreground, #111827);
  --color-store-border: var(--store-border, #e5e7eb);
  --color-store-rating: var(--store-rating, #facc15);
  --color-store-option-secondary: var(--store-option-secondary, #f3f4f6);
}

@layer base {
  *,
  ::after,
  ::before,
  ::backdrop,
  ::file-selector-button {
    border-color: var(--store-border, var(--color-gray-200, currentcolor));
  }

  html {
    -webkit-font-smoothing: antialiased;
    text-rendering: optimizeLegibility;
  }
}
```

Create `apps/web/src/app/(storefront)/storefront-full.css`:

```css
@import './storefront-globals.css';
```

Create `apps/web/src/app/(storefront)/storefront-pdp.css`:

```css
@import 'tailwindcss' source(none);
@import './storefront-core.css';

@config '../../../tailwind.storefront.config.ts';

@source './[slug]/layout.tsx';
@source './[slug]/(catalog)/(pdp)';
@source '../../components/storefront/deferred-page-view-tracker.tsx';
@source '../../components/storefront/storefront-theme-provider.tsx';
@source '../../components/storefront/ogabassey/storefront-layout.tsx';
@source '../../components/storefront/ogabassey/storefront-layout-chrome.tsx';
@source '../../components/storefront/ogabassey/storefront-layout-providers.tsx';
@source '../../components/storefront/ogabassey/layout';
@source '../../components/storefront/ogabassey/providers';
@source '../../components/storefront/ogabassey/pdp';
@source '../../components/storefront/ogabassey/pdp/**/*.tsx';
@source '../../components/storefront/ogabassey/pages/product-details-page.tsx';
@source '../../components/storefront/ogabassey/pages/product-details-page';
@source '../../components/storefront/ogabassey/pages/product-details-page/**/*.tsx';
@source '../../components/storefront/ogabassey/components/AdUnit.tsx';
@source '../../components/storefront/ogabassey/components/BannerCarousel.tsx';
@source '../../components/storefront/ogabassey/components/FlyToCartAnimation.tsx';
@source '../../components/storefront/ogabassey/components/NegotiationModal.tsx';
@source '../../components/ui/button.tsx';
@source '../../components/ui/dialog.tsx';
@source '../../components/ui/input.tsx';
@source '../../components/ui/sheet.tsx';
@source '../../components/ui/tabs.tsx';
@source '../../components/ui/tooltip.tsx';
```

- [ ] **Step 6: Change parent and route-family CSS ownership**

In `apps/web/src/app/(storefront)/[slug]/layout.tsx`, replace:

```ts
import '@/app/(storefront)/storefront-globals.css';
```

with:

```ts
import '@/app/(storefront)/storefront-core.css';
```

Create `apps/web/src/app/(storefront)/[slug]/(catalog)/(pdp)/layout.tsx`:

```tsx
import '@/app/(storefront)/storefront-pdp.css';
import type { ReactNode } from 'react';

export default function StorefrontPdpLayout({
  children,
}: {
  children: ReactNode;
}) {
  return children;
}
```

Create each full-stylesheet route-family layout with this content:

- `apps/web/src/app/(storefront)/[slug]/(catalog)/(listing)/layout.tsx`
- `apps/web/src/app/(storefront)/[slug]/(home)/layout.tsx`
- `apps/web/src/app/(storefront)/[slug]/(blog)/layout.tsx`
- `apps/web/src/app/(storefront)/[slug]/(content)/layout.tsx`
- `apps/web/src/app/(storefront)/[slug]/(customer)/layout.tsx`
- `apps/web/src/app/(storefront)/[slug]/(utility)/layout.tsx`

```tsx
import '@/app/(storefront)/storefront-full.css';
import type { ReactNode } from 'react';

export default function StorefrontFullCssLayout({
  children,
}: {
  children: ReactNode;
}) {
  return children;
}
```

Modify the existing `apps/web/src/app/(storefront)/[slug]/(commerce)/layout.tsx` so it also imports the full stylesheet:

```tsx
import '@/app/(storefront)/storefront-full.css';
import type { ReactNode } from 'react';

export default function CommerceLayout({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
```

- [ ] **Step 7: Run tests and build after the route move**

Run:

```bash
pnpm --dir apps/web test src/app/'(storefront)'/'[slug]'/route-groups.test.ts
SUPABASE_JWT_SECRET=local-build-validation-secret pnpm --dir apps/web build
```

Expected:

```text
PASS src/app/(storefront)/[slug]/route-groups.test.ts
next build exits 0
```

- [ ] **Step 8: Verify Tailwind PDP source coverage**

Run:

```bash
rg -n "@source '../../components/storefront/ogabassey/pdp(\\/\\*\\*/\\*\\.tsx)?';|@source '../../components/storefront/ogabassey/pages/product-details-page(\\/\\*\\*/\\*\\.tsx)?';" apps/web/src/app/'(storefront)'/storefront-pdp.css
```

Expected:

```text
apps/web/src/app/(storefront)/storefront-pdp.css:...:@source '../../components/storefront/ogabassey/pdp';
apps/web/src/app/(storefront)/storefront-pdp.css:...:@source '../../components/storefront/ogabassey/pdp/**/*.tsx';
apps/web/src/app/(storefront)/storefront-pdp.css:...:@source '../../components/storefront/ogabassey/pages/product-details-page';
apps/web/src/app/(storefront)/storefront-pdp.css:...:@source '../../components/storefront/ogabassey/pages/product-details-page/**/*.tsx';
apps/web/src/app/(storefront)/storefront-pdp.css:...:@source '../../components/storefront/ogabassey/components/FlyToCartAnimation.tsx';
```

The explicit `/**/*.tsx` entries are intentional even though Tailwind v4 supports directory `@source` entries. They protect future nested PDP component folders from silently missing generated utilities.

- [ ] **Step 9: Commit the CSS and route boundary**

Run:

```bash
git add apps/web/src/app/'(storefront)' apps/web/src/app/'(storefront)'/'[slug]'/route-groups.test.ts
git commit -m "Split OgaBassey PDP CSS route boundary"
```

Expected:

```text
[branch] Split OgaBassey PDP CSS route boundary
```

---

## Task 4: Add The OgaBassey Critical Product Contract

**Files:**
- Create: `apps/web/src/components/storefront/ogabassey/pdp/critical-product.ts`
- Create: `apps/web/src/components/storefront/ogabassey/pdp/critical-product.test.ts`
- Modify: `apps/web/src/lib/cached-data.ts`
- Modify: `apps/web/src/lib/cached-data.products.test.ts`

- [ ] **Step 1: Write the mapper test**

Create `apps/web/src/components/storefront/ogabassey/pdp/critical-product.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import {
  buildOgabasseyPdpCriticalProduct,
  getOgabasseyPdpPrimaryImage,
} from './critical-product';

describe('buildOgabasseyPdpCriticalProduct', () => {
  it('maps cached product fields without requiring a review_count column', () => {
    const product = buildOgabasseyPdpCriticalProduct({
      brand: 'Lenovo',
      category: 'Laptops',
      categories: { id: 'cat-1', name: 'Laptops', slug: 'laptops' },
      condition: 'used',
      id: 'product-1',
      images: [
        { url: 'https://cdn.ogabassey.com/core-assets/products/legion.avif' },
      ],
      name: 'Lenovo Legion Pro 9',
      price: '5985000',
      schema_markup: {
        aggregateRating: {
          ratingValue: '4.5',
          reviewCount: '12',
        },
      },
      slug: 'lenovo-legion-pro-9',
      stock_quantity: 3,
    });

    expect(product).toMatchObject({
      brand: 'Lenovo',
      categoryName: 'Laptops',
      categorySlug: 'laptops',
      condition: 'used',
      id: 'product-1',
      image: 'https://cdn.ogabassey.com/core-assets/products/legion.avif',
      name: 'Lenovo Legion Pro 9',
      price: 5985000,
      rating: 4.5,
      reviewCount: 12,
      slug: 'lenovo-legion-pro-9',
      stockQuantity: 3,
    });
  });

  it('falls back to legacy string image arrays', () => {
    expect(
      getOgabasseyPdpPrimaryImage({
        images: ['https://cdn.ogabassey.com/core-assets/products/iphone.avif'],
      })
    ).toBe('https://cdn.ogabassey.com/core-assets/products/iphone.avif');
  });

  it('uses safe defaults for legacy rows without schema markup or condition', () => {
    const product = buildOgabasseyPdpCriticalProduct({
      category: null,
      condition: null,
      id: 'legacy-product',
      images: null,
      name: 'Legacy Product',
      price: null,
      schema_markup: null,
      stock_quantity: null,
    });

    expect(product).toMatchObject({
      brand: 'OgaBassey',
      categoryName: 'Electronics',
      categorySlug: 'electronics',
      condition: 'new',
      image: '/placeholder.png',
      price: 0,
      rating: 0,
      reviewCount: 0,
      slug: 'legacy-product',
      stockQuantity: null,
    });
  });
});
```

- [ ] **Step 2: Run the mapper test and verify it fails**

Run:

```bash
pnpm --dir apps/web test src/components/storefront/ogabassey/pdp/critical-product.test.ts
```

Expected:

```text
FAIL ... Cannot find module './critical-product'
```

- [ ] **Step 3: Implement the mapper**

Create `apps/web/src/components/storefront/ogabassey/pdp/critical-product.ts` with:

```ts
type CategoryShape =
  | { id?: string | null; name?: string | null; slug?: string | null }
  | null
  | undefined;
type ProductImage = string | { alt?: string | null; url?: string | null };

export interface OgabasseyPdpCriticalProductInput {
  brand?: string | null;
  category?: string | null;
  category_slug?: string | null;
  categories?: CategoryShape | CategoryShape[];
  condition?: string | null;
  id: string;
  image?: string | null;
  imageLarge?: string | null;
  images?: ProductImage[] | null;
  name: string;
  price?: number | string | null;
  product_categories?: Array<{ categories?: CategoryShape | CategoryShape[] }>;
  schema_markup?: unknown;
  slug?: string | null;
  stock_quantity?: number | null;
}

export interface OgabasseyPdpCriticalProduct {
  brand: string;
  categoryName: string;
  categorySlug: string;
  condition: string;
  id: string;
  image: string;
  name: string;
  price: number;
  rating: number;
  reviewCount: number;
  slug: string;
  stockQuantity: number | null;
}

function parseNumber(value: unknown): number {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const parsed = Number(value.replace(/,/g, ''));
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
}

function firstCategory(value: CategoryShape | CategoryShape[]) {
  return Array.isArray(value) ? value[0] : value;
}

function slugify(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

function getAggregateRating(schemaMarkup: unknown) {
  if (!schemaMarkup || typeof schemaMarkup !== 'object') {
    return { rating: 0, reviewCount: 0 };
  }
  const schema = schemaMarkup as {
    aggregateRating?: {
      ratingValue?: unknown;
      reviewCount?: unknown;
      ratingCount?: unknown;
    };
  };
  return {
    rating: parseNumber(schema.aggregateRating?.ratingValue),
    reviewCount: parseNumber(
      schema.aggregateRating?.reviewCount ?? schema.aggregateRating?.ratingCount
    ),
  };
}

export function getOgabasseyPdpPrimaryImage(
  product: Pick<
    OgabasseyPdpCriticalProductInput,
    'image' | 'imageLarge' | 'images'
  >
): string {
  const firstImage = Array.isArray(product.images) ? product.images[0] : null;
  const mappedFirstImage =
    typeof firstImage === 'string' ? firstImage : firstImage?.url || null;
  return product.imageLarge || product.image || mappedFirstImage || '/placeholder.png';
}

export function buildOgabasseyPdpCriticalProduct(
  product: OgabasseyPdpCriticalProductInput
): OgabasseyPdpCriticalProduct {
  const directCategory = firstCategory(product.categories);
  const fallbackCategory = firstCategory(product.product_categories?.[0]?.categories);
  const category = directCategory || fallbackCategory;
  const categoryName = category?.name || product.category || 'Electronics';
  const aggregateRating = getAggregateRating(product.schema_markup);

  return {
    brand: product.brand || 'OgaBassey',
    categoryName,
    categorySlug:
      category?.slug || product.category_slug || slugify(categoryName) || 'products',
    condition: product.condition || 'new',
    id: product.id,
    image: getOgabasseyPdpPrimaryImage(product),
    name: product.name,
    price: parseNumber(product.price),
    rating: aggregateRating.rating,
    reviewCount: aggregateRating.reviewCount,
    slug: product.slug || product.id,
    stockQuantity:
      typeof product.stock_quantity === 'number' ? product.stock_quantity : null,
  };
}
```

- [ ] **Step 4: Extend cached LCP hint columns**

In `apps/web/src/lib/cached-data.ts`, add these fields to `CachedProductLcpHint` and the `getCachedProductLcpHint` select:

```ts
brand?: string | null;
condition?: string | null;
manage_stock?: boolean | null;
price?: number | string | null;
schema_markup?: unknown;
stock_quantity?: number | null;
```

Do not add `review_count` to the select.

- [ ] **Step 5: Propagate critical fields through the route product mapper**

In `apps/web/src/app/(storefront)/[slug]/(catalog)/(pdp)/[category]/[productSlug]/page.tsx`, extend `LcpRouteProduct`:

```ts
interface LcpRouteProduct {
  brand?: string | null;
  categories?: { name?: string; slug?: string } | null;
  category?: string | null;
  category_slug?: string;
  condition?: string | null;
  id: string;
  image?: string;
  imageLarge?: string;
  manage_stock?: boolean | null;
  name: string;
  price?: number | string | null;
  schema_markup?: unknown;
  slug?: string;
  stock_quantity?: number | null;
}
```

Update `mapCachedProductLcpHintToRouteProduct` so the critical shell receives the fields selected by `getCachedProductLcpHint`:

```ts
  return {
    brand: cachedProduct.brand,
    categories: primaryCategory,
    category: primaryCategory?.name ?? cachedProduct.category,
    category_slug: primaryCategory?.slug,
    condition: cachedProduct.condition,
    id: cachedProduct.id,
    image: primaryImage,
    imageLarge: primaryImage,
    manage_stock: cachedProduct.manage_stock,
    name: cachedProduct.name,
    price: cachedProduct.price,
    schema_markup: cachedProduct.schema_markup,
    slug: cachedProduct.slug ?? cachedProduct.id,
    stock_quantity: cachedProduct.stock_quantity,
  };
```

Without this mapper update, the new cached columns are fetched but the critical shell still falls back to `OgaBassey`, `new`, `0`, and `0 Reviews`.

- [ ] **Step 6: Update the cached query test**

In `apps/web/src/lib/cached-data.products.test.ts`, update the test named `getCachedProductLcpHint reads only route and image fields without hydrating variants` so the expected select includes the six new product columns and still excludes:

```text
product_variants
product_offers
product_key_specs
description
specifications
review_count
```

- [ ] **Step 7: Run tests and commit**

Run:

```bash
pnpm --dir apps/web test src/components/storefront/ogabassey/pdp/critical-product.test.ts src/lib/cached-data.products.test.ts
git add apps/web/src/components/storefront/ogabassey/pdp/critical-product.ts apps/web/src/components/storefront/ogabassey/pdp/critical-product.test.ts apps/web/src/lib/cached-data.ts apps/web/src/lib/cached-data.products.test.ts
git commit -m "Add OgaBassey PDP critical product contract"
```

Expected:

```text
both test files pass
[branch] Add OgaBassey PDP critical product contract
```

---

## Task 5: Atomically Split The OgaBassey Server Shell And Client Islands

**Files:**
- Create: `apps/web/src/components/storefront/ogabassey/pdp/critical-shell.tsx`
- Create: `apps/web/src/components/storefront/ogabassey/pdp/critical-shell.module.css`
- Create: `apps/web/src/components/storefront/ogabassey/pdp/critical-shell.test.tsx`
- Create: `apps/web/src/components/storefront/ogabassey/pdp/client-islands.tsx`
- Create: `apps/web/src/components/storefront/ogabassey/pdp/client-islands.test.tsx`
- Create: `apps/web/src/components/storefront/ogabassey/pages/product-details-page/product-interaction-panel.tsx`
- Create: `apps/web/src/components/storefront/ogabassey/pages/product-details-page/product-interaction-panel.test.tsx`
- Modify: `apps/web/src/components/storefront/ogabassey/pages/product-details-page.tsx`
- Modify: `apps/web/src/components/storefront/ogabassey/pages/product-details-page/product-summary-panel.tsx`
- Modify: `apps/web/src/app/(storefront)/[slug]/(catalog)/(pdp)/[category]/[productSlug]/page.tsx`
- Modify: `apps/web/src/app/(storefront)/[slug]/(catalog)/(pdp)/[category]/[productSlug]/page.test.tsx`

- [ ] **Step 1: Add failing no-duplicate, island-mode, and document-placement tests**

In `page.test.tsx`, add:

```tsx
vi.mock('next/image', () => ({
  default: ({
    alt,
    fetchPriority,
    src,
  }: {
    alt: string;
    fetchPriority?: string;
    src: string;
  }) => <img alt={alt} data-fetch-priority={fetchPriority} src={src} />,
}));

vi.mock('@/components/storefront/ogabassey/pages/product-details-page', () => ({
  ProductDetailsPage: (props: {
    mode?: 'full' | 'commerce' | 'belowFold';
    product: { image?: string; name: string };
    semanticSections?: ReactNode;
  }) => {
    mockOgabasseyProductDetailsPage(props);
    const { mode = 'full', product, semanticSections = null } = props;

    if (mode === 'commerce') {
      return (
        <div data-testid="ogabassey-commerce-island">
          <button type="button">Mock Add to Cart</button>
        </div>
      );
    }

    if (mode === 'belowFold') {
      return (
        <div data-testid="ogabassey-below-fold-island">
          {semanticSections}
        </div>
      );
    }

    return (
      <>
        <h1>{product.name}</h1>
        {product.image ? <img alt={product.name} src={product.image} /> : null}
        {semanticSections}
      </>
    );
  },
}));

it('renders one visible OgaBassey PDP h1 after the critical shell split', async () => {
  const ui = await resolveRsc(
    await CategoryProductPage({
      params: Promise.resolve({
        slug: 'teststore',
        category: 'laptops',
        productSlug: 'hp-laptop-14-ep0063nia',
      }),
      searchParams: Promise.resolve({}),
    })
  );

  const { container } = render(ui);
  expect(container.querySelectorAll('h1')).toHaveLength(1);
  expect(
    screen.getByRole('heading', {
      level: 1,
      name: 'HP Laptop 14-ep0063nia',
    })
  ).toBeInTheDocument();
});

it('splits OgaBassey client work into commerce and below-fold islands', async () => {
  const { container } = render(
    await resolveRsc(
      await CategoryProductPage({
        params: Promise.resolve({
          slug: 'teststore',
          category: 'laptops',
          productSlug: 'hp-laptop-14-ep0063nia',
        }),
        searchParams: Promise.resolve({}),
      })
    )
  );

  expect(mockOgabasseyProductDetailsPage).toHaveBeenCalledWith(
    expect.objectContaining({
      mode: 'commerce',
      product: expect.objectContaining({
        name: 'HP Laptop 14-ep0063nia',
      }),
    })
  );
  expect(mockOgabasseyProductDetailsPage).toHaveBeenCalledWith(
    expect.objectContaining({
      mode: 'belowFold',
      product: expect.objectContaining({
        name: 'HP Laptop 14-ep0063nia',
      }),
      semanticSections: expect.anything(),
    })
  );
  expect(screen.getByTestId('ogabassey-commerce-island')).toBeInTheDocument();
  expect(screen.getByTestId('ogabassey-below-fold-island')).toBeInTheDocument();
  expect(container.querySelectorAll('img[alt="HP Laptop 14-ep0063nia"]')).toHaveLength(1);
});

it('keeps JSON-LD and hidden summary outside the critical commerce slot', async () => {
  const { container } = render(
    await resolveRsc(
      await CategoryProductPage({
        params: Promise.resolve({
          slug: 'teststore',
          category: 'laptops',
          productSlug: 'hp-laptop-14-ep0063nia',
        }),
        searchParams: Promise.resolve({}),
      })
    )
  );

  const commerceSlot = container.querySelector(
    '[data-ogabassey-pdp-commerce-slot]'
  );

  expect(commerceSlot).not.toBeNull();
  expect(commerceSlot?.querySelector('script[type="application/ld+json"]')).toBeNull();
  expect(commerceSlot?.querySelector('article[aria-label="HP Laptop 14-ep0063nia summary"]')).toBeNull();
  expect(container.querySelector('script[type="application/ld+json"]')).not.toBeNull();
  expect(
    screen.getByLabelText('HP Laptop 14-ep0063nia summary')
  ).toBeInTheDocument();
});
```

Replace the existing `ProductDetailsPage` mock instead of adding a second mock. The replacement above makes full mode keep the legacy duplicate H1 behavior until the route stops using full mode for OgaBassey PDPs.

- [ ] **Step 2: Create the server critical shell**

Create `apps/web/src/components/storefront/ogabassey/pdp/critical-shell.module.css`:

```css
.shell {
  background: var(--store-background, #ffffff);
  color: var(--store-background-text, #111827);
  padding: 1rem 1rem 7rem;
}

.inner {
  margin: 0 auto;
  max-width: 1400px;
}

.breadcrumbs {
  align-items: center;
  color: color-mix(in srgb, var(--store-background-text, #111827) 58%, transparent);
  display: flex;
  flex-wrap: wrap;
  font-size: 0.875rem;
  gap: 0.5rem;
  padding: 0.75rem 0 1rem;
}

.breadcrumbs a {
  color: inherit;
  text-decoration: none;
}

.grid {
  display: grid;
  gap: 1.5rem;
  grid-template-columns: 1fr;
}

.imageFrame {
  align-items: center;
  aspect-ratio: 1 / 1;
  background: #f9fafb;
  border: 1px solid #f3f4f6;
  border-radius: 1rem;
  display: flex;
  justify-content: center;
  overflow: hidden;
  position: relative;
}

.image {
  height: 100%;
  inset: 0;
  object-fit: cover;
  position: absolute;
  width: 100%;
}

.condition {
  background: var(--store-primary, #2a2c6e);
  border-radius: 999px;
  color: var(--store-primary-text, #ffffff);
  font-size: 0.75rem;
  font-weight: 700;
  left: 1rem;
  padding: 0.25rem 0.75rem;
  position: absolute;
  text-transform: uppercase;
  top: 1rem;
}

.summary {
  min-width: 0;
}

.brand {
  color: var(--store-primary, #2a2c6e);
  font-size: 0.875rem;
  font-weight: 700;
  margin: 0 0 0.5rem;
  text-transform: uppercase;
}

.title {
  color: var(--store-background-text, #111827);
  font-size: 1.875rem;
  font-weight: 800;
  line-height: 1.18;
  margin: 0 0 1rem;
}

.ratingRow {
  align-items: center;
  display: flex;
  gap: 0.75rem;
  margin-bottom: 1.5rem;
}

.stars {
  color: var(--store-rating, #facc15);
  font-size: 1rem;
}

.reviewCount {
  color: color-mix(in srgb, var(--store-background-text, #111827) 60%, transparent);
  font-size: 0.875rem;
  font-weight: 500;
}

.price {
  color: var(--store-primary, #2a2c6e);
  font-size: 1.875rem;
  font-weight: 800;
}

.commerceSlot {
  min-height: 16rem;
}

@media (min-width: 1024px) {
  .shell {
    padding-left: 1.5rem;
    padding-right: 1.5rem;
  }

  .grid {
    align-items: start;
    grid-template-columns: minmax(0, 5fr) minmax(0, 4fr) minmax(20rem, 3fr);
  }

  .commerceSlot {
    min-height: 20rem;
  }
}
```

Create `apps/web/src/components/storefront/ogabassey/pdp/critical-shell.tsx`:

```tsx
import Image from 'next/image';
import Link from 'next/link';
import type { ReactNode } from 'react';
import {
  OGABASSEY_PDP_PRIMARY_IMAGE_QUALITY,
  OGABASSEY_PDP_PRIMARY_IMAGE_SIZES,
} from '@/components/storefront/ogabassey/config/product-media';
import imageLoader from '@/lib/image-loader';
import type { OgabasseyPdpCriticalProduct } from './critical-product';
import styles from './critical-shell.module.css';

interface OgabasseyPdpCriticalShellProps {
  basePath: string;
  children?: ReactNode;
  product: OgabasseyPdpCriticalProduct;
}

function formatPrice(price: number) {
  return new Intl.NumberFormat('en-NG', {
    currency: 'NGN',
    maximumFractionDigits: 0,
    style: 'currency',
  }).format(price);
}

function buildPath(basePath: string, path: string) {
  const prefix = basePath === '/' ? '' : basePath.replace(/\/$/, '');
  return `${prefix}${path}` || '/';
}

export function OgabasseyPdpCriticalShell({
  basePath,
  children,
  product,
}: OgabasseyPdpCriticalShellProps) {
  return (
    <section className={styles.shell} data-ogabassey-pdp-critical-shell>
      <div className={styles.inner}>
        <nav className={styles.breadcrumbs} aria-label="Breadcrumb">
          <Link href={buildPath(basePath, '/')}>Home</Link>
          <span aria-hidden="true">/</span>
          <Link href={buildPath(basePath, `/${product.categorySlug}`)}>
            {product.categoryName}
          </Link>
          <span aria-hidden="true">/</span>
          <span aria-current="page">{product.name}</span>
        </nav>
        <div className={styles.grid}>
          <div className={styles.imageFrame}>
            <Image
              alt={product.name}
              className={styles.image}
              decoding="sync"
              fetchPriority="high"
              fill
              loader={imageLoader}
              priority
              quality={OGABASSEY_PDP_PRIMARY_IMAGE_QUALITY}
              sizes={OGABASSEY_PDP_PRIMARY_IMAGE_SIZES}
              src={product.image}
            />
            <span className={styles.condition}>{product.condition}</span>
          </div>
          <div className={styles.summary}>
            <p className={styles.brand}>{product.brand}</p>
            <h1 className={styles.title}>{product.name}</h1>
            <div className={styles.ratingRow}>
              <span className={styles.stars} aria-hidden="true">
                ★★★★★
              </span>
              <span className={styles.reviewCount}>
                {product.reviewCount} Reviews
              </span>
            </div>
            <div className={styles.price}>{formatPrice(product.price)}</div>
          </div>
          <div
            className={styles.commerceSlot}
            data-ogabassey-pdp-commerce-slot
          >
            {children}
          </div>
        </div>
      </div>
    </section>
  );
}
```

- [ ] **Step 3: Create the critical shell test**

Create `apps/web/src/components/storefront/ogabassey/pdp/critical-shell.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { OgabasseyPdpCriticalShell } from './critical-shell';

vi.mock('next/image', () => ({
  default: ({
    alt,
    fetchPriority,
    src,
  }: {
    alt: string;
    fetchPriority?: string;
    src: string;
  }) => (
    <img alt={alt} data-fetch-priority={fetchPriority} src={src} />
  ),
}));

vi.mock('next/link', () => ({
  default: ({ children, href }: { children: ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
}));

describe('OgabasseyPdpCriticalShell', () => {
  it('renders one server-owned product heading and high-priority image', () => {
    render(
      <OgabasseyPdpCriticalShell
        basePath=""
        product={{
          brand: 'Lenovo',
          categoryName: 'Laptops',
          categorySlug: 'laptops',
          condition: 'used',
          id: 'product-1',
          image: 'https://cdn.ogabassey.com/core-assets/products/legion.avif',
          name: 'Lenovo Legion Pro 9',
          price: 5985000,
          rating: 4.5,
          reviewCount: 12,
          slug: 'lenovo-legion-pro-9',
          stockQuantity: 3,
        }}
      >
        <button type="button">Add to Cart</button>
      </OgabasseyPdpCriticalShell>
    );

    expect(
      screen.getByRole('heading', { level: 1, name: 'Lenovo Legion Pro 9' })
    ).toBeInTheDocument();
    expect(screen.getByRole('img', { name: 'Lenovo Legion Pro 9' })).toHaveAttribute(
      'data-fetch-priority',
      'high'
    );
    expect(screen.getByRole('link', { name: 'Laptops' })).toHaveAttribute(
      'href',
      '/laptops'
    );
    expect(screen.getByRole('button', { name: 'Add to Cart' })).toBeInTheDocument();
  });
});
```

- [ ] **Step 4: Create commerce controls mode**

Create `apps/web/src/components/storefront/ogabassey/pages/product-details-page/product-interaction-panel.tsx`:

```tsx
'use client';

import type { Route } from 'next';
import {
  buildDescriptionExcerpt,
  type ConditionType,
  type NormalizedProductDetails,
} from './product-details-helpers';
import { ProductCartActions } from './product-cart-actions';
import { ProductOptionSelectors } from './product-option-selectors';
import { ProductSummaryPanel } from './product-summary-panel';

interface ProductInteractionPanelProps {
  availableConditions: ConditionType[];
  canPurchase: boolean;
  cartHref: Route;
  currentOfferPrice: string;
  deliveryEstimate: string;
  deliveryLocation: 'Lagos' | 'Outside Lagos';
  effectiveAxes: string[];
  formatAxisLabel: (axis: string) => string;
  getAxisOptions: (axis: string) => string[];
  inputValue: string;
  isLiked: boolean;
  onAddToCart: () => void;
  onChangeAttribute: (axis: string, value: string) => void;
  onChangeDeliveryLocation: (
    updater: (current: 'Lagos' | 'Outside Lagos') => 'Lagos' | 'Outside Lagos'
  ) => void;
  onDecrement: () => void;
  onIncrement: () => void;
  onInputBlur: () => void;
  onInputChange: (event: React.ChangeEvent<HTMLInputElement>) => void;
  onInputKeyDown: (event: React.KeyboardEvent<HTMLInputElement>) => void;
  onSelectColor: (index: number) => void;
  onSelectSecondaryColor: (index: number) => void;
  onSetCondition: (condition: ConditionType) => void;
  onShare: () => void;
  onToggleSaved: () => void;
  productData: NormalizedProductDetails;
  quantityInCart: number;
  secondaryColor: number | null;
  selectedAttributes: Record<string, string>;
  selectedColor: number | null;
  selectedCondition: ConditionType;
  showColorToast: boolean;
}

export function ProductInteractionPanel(props: ProductInteractionPanelProps) {
  return (
    <div className="flex flex-col" data-ogabassey-pdp-client-controls>
      <ProductSummaryPanel
        availableConditions={props.availableConditions}
        currentOfferPrice={props.currentOfferPrice}
        isLiked={props.isLiked}
        onShare={props.onShare}
        onToggleSaved={props.onToggleSaved}
        productData={props.productData}
        selectedCondition={props.selectedCondition}
        setSelectedCondition={props.onSetCondition}
        summaryOnly
      />
      <ProductOptionSelectors
        deliveryEstimate={props.deliveryEstimate}
        deliveryLocation={props.deliveryLocation}
        descriptionExcerpt={buildDescriptionExcerpt(
          props.productData.description || ''
        )}
        effectiveAxes={props.effectiveAxes}
        formatAxisLabel={props.formatAxisLabel}
        getAxisOptions={props.getAxisOptions}
        onChangeDeliveryLocation={props.onChangeDeliveryLocation}
        onSelectAttribute={props.onChangeAttribute}
        onSelectColor={props.onSelectColor}
        onSelectSecondaryColor={props.onSelectSecondaryColor}
        productData={props.productData}
        secondaryColor={props.secondaryColor}
        selectedAttributes={props.selectedAttributes}
        selectedColor={props.selectedColor}
        showColorToast={props.showColorToast}
      />
      <ProductCartActions
        cartHref={props.cartHref}
        canPurchase={props.canPurchase}
        inputValue={props.inputValue}
        onAddToCart={props.onAddToCart}
        onDecrement={props.onDecrement}
        onIncrement={props.onIncrement}
        onInputBlur={props.onInputBlur}
        onInputChange={props.onInputChange}
        onInputKeyDown={props.onInputKeyDown}
        quantityInCart={props.quantityInCart}
      />
    </div>
  );
}
```

Create `apps/web/src/components/storefront/ogabassey/pages/product-details-page/product-interaction-panel.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react';
import type { Route } from 'next';
import { describe, expect, it, vi } from 'vitest';
import type { NormalizedProductDetails } from './product-details-helpers';
import { ProductInteractionPanel } from './product-interaction-panel';

const { mockProductSummaryPanel } = vi.hoisted(() => ({
  mockProductSummaryPanel: vi.fn(),
}));

vi.mock('./product-summary-panel', () => ({
  ProductSummaryPanel: (props: Record<string, unknown>) => {
    mockProductSummaryPanel(props);
    return (
      <div data-testid="summary-controls">
        <button type="button">Share this product</button>
        <button type="button">Add to wishlist</button>
      </div>
    );
  },
}));

vi.mock('./product-option-selectors', () => ({
  ProductOptionSelectors: () => (
    <section aria-label="Product option selectors" />
  ),
}));

vi.mock('./product-cart-actions', () => ({
  ProductCartActions: () => (
    <button type="button">Add to Cart</button>
  ),
}));

const productData = {
  brand: 'Lenovo',
  category: 'Laptops',
  colors: [],
  condition: 'used',
  description: '<p>Gaming laptop</p>',
  id: 'product-1',
  image: 'https://cdn.ogabassey.com/core-assets/products/legion.avif',
  images: ['https://cdn.ogabassey.com/core-assets/products/legion.avif'],
  manage_stock: true,
  name: 'Lenovo Legion Pro 9',
  price: '₦5,985,000',
  rawPrice: 5985000,
  rating: 4.5,
  reviewCount: 12,
  slug: 'lenovo-legion-pro-9',
  stock: 3,
  variants: [],
} as unknown as NormalizedProductDetails;

function renderPanel() {
  return render(
    <ProductInteractionPanel
      availableConditions={['used']}
      canPurchase
      cartHref={'/cart' as Route}
      currentOfferPrice="₦5,985,000"
      deliveryEstimate="Tomorrow"
      deliveryLocation="Lagos"
      effectiveAxes={[]}
      formatAxisLabel={(axis) => axis}
      getAxisOptions={() => []}
      inputValue="1"
      isLiked={false}
      onAddToCart={vi.fn()}
      onChangeAttribute={vi.fn()}
      onChangeDeliveryLocation={vi.fn()}
      onDecrement={vi.fn()}
      onIncrement={vi.fn()}
      onInputBlur={vi.fn()}
      onInputChange={vi.fn()}
      onInputKeyDown={vi.fn()}
      onSelectColor={vi.fn()}
      onSelectSecondaryColor={vi.fn()}
      onSetCondition={vi.fn()}
      onShare={vi.fn()}
      onToggleSaved={vi.fn()}
      productData={productData}
      quantityInCart={0}
      secondaryColor={null}
      selectedAttributes={{}}
      selectedColor={null}
      selectedCondition="used"
      showColorToast={false}
    />
  );
}

describe('ProductInteractionPanel', () => {
  it('renders commerce controls without duplicating the server-owned product identity', () => {
    const { container } = renderPanel();

    expect(screen.getByTestId('summary-controls')).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Add to Cart' })
    ).toBeInTheDocument();
    expect(
      screen.getByRole('region', { name: 'Product option selectors' })
    ).toBeInTheDocument();
    expect(mockProductSummaryPanel).toHaveBeenCalledWith(
      expect.objectContaining({ summaryOnly: true })
    );
    expect(container.querySelector('h1')).toBeNull();
    expect(container.querySelector('img')).toBeNull();
  });
});
```

Modify `ProductSummaryPanelProps` in `product-summary-panel.tsx`:

```ts
summaryOnly?: boolean;
```

Change the top of `ProductSummaryPanel` so `summaryOnly` keeps share/wishlist and condition controls, but skips the brand `<h2>`, page `<h1>`, rating row, and price block because the server critical shell owns them:

```tsx
export function ProductSummaryPanel({
  availableConditions,
  currentOfferPrice,
  isLiked,
  onShare,
  onToggleSaved,
  productData,
  selectedCondition,
  setSelectedCondition,
  summaryOnly = false,
}: ProductSummaryPanelProps) {
  const baseCondition = asConditionType(productData.condition) ?? 'new';
  const conditionOptions =
    availableConditions.length > 0 ? availableConditions : [baseCondition];

  return (
    <>
      <div className="mb-2 flex items-start justify-between">
        {summaryOnly ? null : (
          <h2 className="text-sm font-bold uppercase tracking-wider text-store-primary">
            {productData.brand}
          </h2>
        )}
        <div className={summaryOnly ? 'ml-auto flex gap-3' : 'flex gap-3'}>
          <button
            type="button"
            onClick={onShare}
            className="text-store-background-text/45 transition-colors active:text-store-primary md:hover:text-store-primary"
            aria-label="Share this product"
          >
            <Share2 size={20} />
          </button>
          <button
            type="button"
            onClick={onToggleSaved}
            className={`transition-colors active:text-store-primary ${
              isLiked
                ? 'text-store-primary'
                : 'text-store-background-text/45 md:hover:text-store-primary'
            }`}
            aria-label={isLiked ? 'Remove from wishlist' : 'Add to wishlist'}
          >
            <Heart size={20} fill={isLiked ? 'currentColor' : 'none'} />
          </button>
        </div>
      </div>

      {summaryOnly ? null : (
        <>
          <h1 className="mb-4 text-3xl font-extrabold text-store-background-text md:text-3xl">
            {productData.name}
          </h1>
          <div className="mb-6 flex items-center gap-4">
            <div
              className="flex items-center gap-0.5 text-store-rating"
              role="img"
              aria-label={`Rated ${productData.rating} out of 5 stars`}
            >
              {[...Array(5)].map((_, index) => {
                const filled = Math.floor(productData.rating);
                const fraction = productData.rating - filled;
                const isFull = index < filled;
                const isPartial = index === filled && fraction > 0;
                const isEmpty = !isFull && !isPartial;

                if (isPartial) {
                  return (
                    <span
                      key={index}
                      className="relative inline-flex"
                      style={{ width: 18, height: 18 }}
                      aria-hidden="true"
                    >
                      <span
                        className="absolute inset-0 overflow-hidden"
                        style={{ width: `${fraction * 100}%` }}
                      >
                        <Star size={18} fill="currentColor" className="shrink-0" />
                      </span>
                      <Star
                        size={18}
                        fill="none"
                        className="text-store-background-text/18"
                      />
                    </span>
                  );
                }

                return (
                  <Star
                    key={index}
                    size={18}
                    fill={isFull ? 'currentColor' : 'none'}
                    className={isEmpty ? 'text-store-background-text/18' : ''}
                    aria-hidden="true"
                  />
                );
              })}
            </div>
            <span className="text-sm font-medium text-store-background-text/60">
              {productData.reviewCount} Reviews
            </span>
          </div>
          <div className="mb-6 text-3xl font-bold text-store-primary">
            {currentOfferPrice}
          </div>
        </>
      )}

      {conditionOptions.length > 1 && (
        <div className="mb-6">
          <label className="mb-3 block text-sm font-bold text-store-background-text">
            Condition:{' '}
            <span className="text-store-primary">
              {formatConditionLabel(selectedCondition)}
            </span>
          </label>
          <div role="group" aria-label="Product condition" className="flex flex-wrap gap-3">
            {conditionOptions.map((condition) => (
              <button
                key={condition}
                type="button"
                onClick={() => setSelectedCondition(condition)}
                aria-pressed={selectedCondition === condition}
                className={`rounded-lg border-2 px-4 py-2 text-sm font-bold transition-all ${
                  selectedCondition === condition
                    ? 'border-store-primary bg-store-primary/5 text-store-primary'
                    : 'border-store-background-text/15 text-store-background-text/70 hover:border-store-background-text/30'
                }`}
              >
                {formatConditionLabel(condition)}
              </button>
            ))}
          </div>
        </div>
      )}
    </>
  );
}
```

Modify `ProductDetailsPage` to accept and default the mode:

```tsx
interface ProductDetailsPageProps {
  mode?: 'full' | 'commerce' | 'belowFold';
  product: Product;
  semanticSections?: ReactNode;
}

export function ProductDetailsPage({
  mode = 'full',
  product,
  semanticSections = null,
}: ProductDetailsPageProps) {
```

Import `ProductInteractionPanel` and branch the render after `useProductDetailsState(product)` has created the existing handlers:

```tsx
const isCommerceMode = mode === 'commerce';
const isBelowFoldMode = mode === 'belowFold';

if (isBelowFoldMode) {
  return (
    <div className="mx-auto max-w-[1400px] px-4 pb-32 md:px-6">
      {semanticSections}
      <DeferredProductDetailsSectionsLoader
        activeTab={activeTab}
        normalizedReviewRatingWidth={normalizedReviewRatingWidth}
        onSelectTab={setActiveTab}
        productData={productData}
        relatedProductsProduct={relatedProductsProduct}
        storeSlug={merchantSlug}
      />
    </div>
  );
}
```

Then wrap the existing full markup with commerce guards:

```tsx
return (
  <div className={isCommerceMode ? 'relative' : 'relative bg-store-background pb-32 pt-4'}>
    {isCommerceMode ? null : (
      <div
        data-testid="product-banner-carousel"
        role="region"
        aria-label="Product banner carousel"
        className="mx-auto mb-8 hidden min-h-[208px] max-w-[1400px] px-4 md:block md:px-6"
      >
        {isDesktop ? <BannerCarousel className="h-40 md:h-52" /> : null}
      </div>
    )}

    <div className={isCommerceMode ? 'w-full' : 'mx-auto max-w-[1400px] px-4 md:px-6'}>
      {isCommerceMode ? null : (
        <ProductBreadcrumbs
          basePath={basePath}
          homeHref={homeHref}
          productData={productData}
        />
      )}

      <div className={isCommerceMode ? 'contents' : 'grid grid-cols-1 gap-12 lg:grid-cols-12 lg:gap-8'}>
        {isCommerceMode ? null : (
          <ProductMediaGallery
            onSelectImage={setSelectedImage}
            productData={productData}
            selectedCondition={selectedCondition}
            selectedImage={selectedImage}
          />
        )}

        {isCommerceMode ? (
          <ProductInteractionPanel
            availableConditions={availableConditions}
            canPurchase={canPurchase}
            cartHref={cartHref}
            currentOfferPrice={currentOffer.price}
            deliveryEstimate={deliveryEstimate}
            deliveryLocation={deliveryLocation}
            effectiveAxes={effectiveAxes}
            formatAxisLabel={formatAxisLabel}
            getAxisOptions={getAxisOptions}
            inputValue={inputValue}
            isLiked={isLiked}
            onAddToCart={validateAndAddToCart}
            onChangeAttribute={handleAttributeSelection}
            onChangeDeliveryLocation={setDeliveryLocation}
            onDecrement={handleDecrement}
            onIncrement={handleIncrement}
            onInputBlur={handleQuantityBlur}
            onInputChange={handleQuantityChange}
            onInputKeyDown={handleKeyDown}
            onSelectColor={handleColorSelection}
            onSelectSecondaryColor={handleColorDoubleClick}
            onSetCondition={setSelectedCondition}
            onShare={handleShare}
            onToggleSaved={handleToggleSaved}
            productData={productData}
            quantityInCart={quantityInCart}
            secondaryColor={secondaryColor}
            selectedAttributes={selectedAttributes}
            selectedColor={selectedColor}
            selectedCondition={selectedCondition}
            showColorToast={showColorToast}
          />
        ) : (
          <ProductPurchasePanel
            availableConditions={availableConditions}
            canPurchase={canPurchase}
            cartHref={cartHref}
            currentOfferPrice={currentOffer.price}
            deliveryEstimate={deliveryEstimate}
            deliveryLocation={deliveryLocation}
            effectiveAxes={effectiveAxes}
            formatAxisLabel={formatAxisLabel}
            getAxisOptions={getAxisOptions}
            inputValue={inputValue}
            isLiked={isLiked}
            onAddToCart={validateAndAddToCart}
            onChangeAttribute={handleAttributeSelection}
            onChangeDeliveryLocation={setDeliveryLocation}
            onDecrement={handleDecrement}
            onIncrement={handleIncrement}
            onInputBlur={handleQuantityBlur}
            onInputChange={handleQuantityChange}
            onInputKeyDown={handleKeyDown}
            onSelectColor={handleColorSelection}
            onSelectSecondaryColor={handleColorDoubleClick}
            onSetCondition={setSelectedCondition}
            onShare={handleShare}
            onToggleSaved={handleToggleSaved}
            productData={productData}
            quantityInCart={quantityInCart}
            secondaryColor={secondaryColor}
            selectedAttributes={selectedAttributes}
            selectedColor={selectedColor}
            selectedCondition={selectedCondition}
            showColorToast={showColorToast}
          />
        )}

        {isCommerceMode ? null : (
          <div className="hidden lg:col-span-3 lg:block lg:border-l lg:border-store-background-text/10 lg:pl-8">
            <div className="sticky top-24">
              <p className="mb-4 text-xs font-bold uppercase tracking-widest text-store-background-text/50">
                Sponsored
              </p>
              <AdUnit placementKey="SIDEBAR_HALF_PAGE" className="mb-6" />
            </div>
          </div>
        )}
      </div>

      {isCommerceMode ? null : semanticSections}

      {isCommerceMode ? null : (
        <DeferredProductDetailsSectionsLoader
          activeTab={activeTab}
          normalizedReviewRatingWidth={normalizedReviewRatingWidth}
          onSelectTab={setActiveTab}
          productData={productData}
          relatedProductsProduct={relatedProductsProduct}
          storeSlug={merchantSlug}
        />
      )}
    </div>

    <ProductMobileActionBar
      cartHref={cartHref}
      canPurchase={canPurchase}
      onDecrement={handleDecrement}
      onIncrement={handleIncrement}
      onMobileAddToCart={handleMobileAddToCart}
      quantityInCart={quantityInCart}
    />

    {animatingParticles.map((rect, index) => (
      <FlyToCartAnimation
        key={`${rect.x}-${rect.y}-${index}`}
        startRect={rect}
        onComplete={handleAnimationComplete}
        imageSrc={productData.images[selectedImage] ?? productData.images[0]}
      />
    ))}

    <SelectionRequiredModal
      effectiveAxes={effectiveAxes}
      formatAxisLabel={formatAxisLabel}
      getAxisOptions={getAxisOptions}
      isOpen={isSelectionModalOpen}
      missingFields={missingFields}
      onClose={() => setIsSelectionModalOpen(false)}
      onConfirm={() => {
        if (missingFields.length === 0) {
          setIsSelectionModalOpen(false);
          validateAndAddToCart();
        }
      }}
      onSelectAttribute={handleModalAttributeSelection}
      onSelectColor={handleModalColorSelection}
      productData={productData}
      selectedAttributes={selectedAttributes}
      selectedColor={selectedColor}
    />

    {isNegotiationOpen ? (
      <NegotiationModal
        isOpen
        onClose={() => setIsNegotiationOpen(false)}
        productName={productData.name}
        currentPrice={currentOffer.rawPrice}
        vatRate={merchantVatRate}
        onSuccess={handleNegotiationSuccess}
        type="single"
        itemId={String(productData.id)}
        merchantId={merchantId || ''}
      />
    ) : null}
  </div>
);
```

In `commerce` mode, `ProductDetailsPage` renders `ProductInteractionPanel`, mobile action bar, animations, and modals only. It must not render `semanticSections`, `DeferredProductDetailsSectionsLoader`, `ProductBreadcrumbs`, `ProductMediaGallery`, `ProductPurchasePanel`, or sponsored sidebar.

In `belowFold` mode, `ProductDetailsPage` renders `semanticSections` and `DeferredProductDetailsSectionsLoader` only. It must not render purchase controls, mobile action bar, modals, breadcrumbs, media gallery, or the server-owned H1/image/price.

In `apps/web/src/components/storefront/ogabassey/pages/product-details-page.test.tsx`, update the existing child-component mocks so hidden sections are observable:

```tsx
vi.mock('./product-details-page/product-breadcrumbs', () => ({
  ProductBreadcrumbs: () => <nav aria-label="Breadcrumb" />,
}));
vi.mock('./product-details-page/product-media-gallery', () => ({
  ProductMediaGallery: () => <section aria-label="Product media gallery" />,
}));
vi.mock('./product-details-page/product-mobile-action-bar', () => ({
  ProductMobileActionBar: () => <div data-testid="mobile-action-bar" />,
}));
vi.mock('./product-details-page/product-interaction-panel', () => ({
  ProductInteractionPanel: () => (
    <div data-testid="commerce-controls">
      <button type="button">Add to Cart</button>
    </div>
  ),
}));
```

Add these mode-specific tests to the same file:

```tsx
it('commerce mode renders controls without full product shell sections', () => {
  render(
    <ProductDetailsPage
      mode="commerce"
      product={{
        id: 'p-commerce',
        name: 'Commerce Mode Product',
        price: '₦12,000',
        image: 'https://example.com/commerce.jpg',
        description: 'Commerce only',
        condition: 'new' as const,
        colors: [],
        storage: [],
        images: ['https://example.com/commerce.jpg'],
      }}
      semanticSections={<a href="/smartphones">Shop more Smartphones</a>}
    />
  );

  expect(screen.getByTestId('commerce-controls')).toBeInTheDocument();
  expect(screen.getByTestId('mobile-action-bar')).toBeInTheDocument();
  expect(
    screen.queryByRole('heading', { name: 'Commerce Mode Product' })
  ).not.toBeInTheDocument();
  expect(
    screen.queryByRole('region', { name: /product banner carousel/i })
  ).not.toBeInTheDocument();
  expect(screen.queryByLabelText('Breadcrumb')).not.toBeInTheDocument();
  expect(screen.queryByLabelText('Product media gallery')).not.toBeInTheDocument();
  expect(
    screen.queryByRole('region', { name: 'Deferred product details sections' })
  ).not.toBeInTheDocument();
  expect(
    screen.queryByRole('link', { name: 'Shop more Smartphones' })
  ).not.toBeInTheDocument();
});

it('belowFold mode renders semantic and deferred sections without commerce controls', async () => {
  render(
    <ProductDetailsPage
      mode="belowFold"
      product={{
        id: 'p-below-fold',
        name: 'Below Fold Product',
        price: '₦15,000',
        image: 'https://example.com/below-fold.jpg',
        description: 'Below fold only',
        condition: 'new' as const,
        colors: [],
        storage: [],
        images: ['https://example.com/below-fold.jpg'],
      }}
      semanticSections={<a href="/laptops">Shop more Laptops</a>}
    />
  );

  expect(
    screen.getByRole('link', { name: 'Shop more Laptops' })
  ).toBeInTheDocument();
  expect(
    await screen.findByRole('region', {
      name: 'Deferred product details sections',
    })
  ).toBeInTheDocument();
  expect(screen.queryByTestId('commerce-controls')).not.toBeInTheDocument();
  expect(screen.queryByTestId('mobile-action-bar')).not.toBeInTheDocument();
  expect(
    screen.queryByRole('heading', { name: 'Below Fold Product' })
  ).not.toBeInTheDocument();
  expect(screen.queryByLabelText('Breadcrumb')).not.toBeInTheDocument();
  expect(screen.queryByLabelText('Product media gallery')).not.toBeInTheDocument();
});
```

- [ ] **Step 5: Create split client islands**

Create `apps/web/src/components/storefront/ogabassey/pdp/client-islands.tsx`:

```tsx
'use client';

import type { ReactNode } from 'react';
import { ProductDetailsPage } from '@/components/storefront/ogabassey/pages/product-details-page';
import type { Product } from '@/components/storefront/ogabassey/types';

interface OgabasseyPdpCommerceIslandProps {
  product: Product;
}

interface OgabasseyPdpBelowFoldIslandProps {
  product: Product;
  semanticSections?: ReactNode;
}

export function OgabasseyPdpCommerceIsland({
  product,
}: OgabasseyPdpCommerceIslandProps) {
  return <ProductDetailsPage mode="commerce" product={product} />;
}

export function OgabasseyPdpBelowFoldIsland({
  product,
  semanticSections = null,
}: OgabasseyPdpBelowFoldIslandProps) {
  return (
    <ProductDetailsPage
      mode="belowFold"
      product={product}
      semanticSections={semanticSections}
    />
  );
}
```

Create `apps/web/src/components/storefront/ogabassey/pdp/client-islands.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';
import type { Product } from '@/components/storefront/ogabassey/types';
import {
  OgabasseyPdpBelowFoldIsland,
  OgabasseyPdpCommerceIsland,
} from './client-islands';

const { mockProductDetailsPage } = vi.hoisted(() => ({
  mockProductDetailsPage: vi.fn(),
}));

vi.mock('@/components/storefront/ogabassey/pages/product-details-page', () => ({
  ProductDetailsPage: (props: {
    mode?: string;
    product: { name: string };
    semanticSections?: ReactNode;
  }) => {
    mockProductDetailsPage(props);
    if (props.mode === 'commerce') {
      return <button type="button">Add to Cart</button>;
    }

    return <section>{props.semanticSections}</section>;
  },
}));

const product = {
  id: 'product-1',
  image: 'https://cdn.ogabassey.com/core-assets/products/legion.avif',
  name: 'Lenovo Legion Pro 9',
  price: '₦5,985,000',
  rawPrice: 5985000,
  slug: 'lenovo-legion-pro-9',
} as unknown as Product;

describe('OgaBassey PDP client islands', () => {
  it('renders commerce controls without duplicating product heading or image', () => {
    const { container } = render(<OgabasseyPdpCommerceIsland product={product} />);

    expect(mockProductDetailsPage).toHaveBeenCalledWith(
      expect.objectContaining({ mode: 'commerce', product })
    );
    expect(screen.getByRole('button', { name: 'Add to Cart' })).toBeInTheDocument();
    expect(container.querySelector('h1')).toBeNull();
    expect(container.querySelector('img')).toBeNull();
  });

  it('renders below-fold document content in belowFold mode', () => {
    render(
      <OgabasseyPdpBelowFoldIsland
        product={product}
        semanticSections={<section aria-label="Related buying guidance" />}
      />
    );

    expect(mockProductDetailsPage).toHaveBeenCalledWith(
      expect.objectContaining({
        mode: 'belowFold',
        product,
        semanticSections: expect.anything(),
      })
    );
    expect(
      screen.getByLabelText('Related buying guidance')
    ).toBeInTheDocument();
  });
});
```

- [ ] **Step 6: Wire the route atomically**

In `page.tsx`, build the critical product from the cached route product before the Suspense boundary:

```ts
const criticalProduct =
  merchant.template_id === OGABASSEY_TEMPLATE_ID
    ? buildOgabasseyPdpCriticalProduct(product)
    : null;
```

Add imports:

```ts
import { OgabasseyPdpCriticalShell } from '@/components/storefront/ogabassey/pdp/critical-shell';
import { buildOgabasseyPdpCriticalProduct } from '@/components/storefront/ogabassey/pdp/critical-product';
import {
  OgabasseyPdpBelowFoldIsland,
  OgabasseyPdpCommerceIsland,
} from '@/components/storefront/ogabassey/pdp/client-islands';
```

Change `renderTemplateProductPage` to accept modes:

```tsx
type TemplateProductRenderMode = 'full' | 'commerce' | 'belowFold';

async function renderTemplateProductPage({
  product,
  renderMode = 'full',
  semanticSections,
  templateId,
}: {
  product: Product;
  renderMode?: TemplateProductRenderMode;
  semanticSections: ReactNode;
  templateId?: string;
}) {
  if (templateId === OGABASSEY_TEMPLATE_ID) {
    const ogabasseyProduct = toOgabasseyProduct(product);

    if (renderMode === 'commerce') {
      return <OgabasseyPdpCommerceIsland product={ogabasseyProduct} />;
    }

    if (renderMode === 'belowFold') {
      return (
        <OgabasseyPdpBelowFoldIsland
          product={ogabasseyProduct}
          semanticSections={semanticSections}
        />
      );
    }

    return (
      <>
        <OgabasseyPdpStaticResourceHints />
        <OgabasseyProductPage
          product={ogabasseyProduct}
          semanticSections={semanticSections}
        />
      </>
    );
  }

  const { DefaultProductPageRenderer } = await import(
    './default-product-page-renderer'
  );

  return (
    <DefaultProductPageRenderer
      product={product}
      semanticSections={semanticSections}
    />
  );
}
```

Extract route-result validation so the commerce island and below-fold document content cannot drift:

```tsx
interface CategoryProductPageContentProps {
  renderMode?: 'full' | 'belowFold';
  slug: string;
  searchParams: PageProps['searchParams'];
  productResultPromise: Promise<CategoryProductResult>;
}

async function getRenderableCategoryProductResult({
  productResultPromise,
  searchParams,
  slug,
}: Omit<CategoryProductPageContentProps, 'renderMode'>) {
  const result = await productResultPromise;

  if (!result) {
    notFound();
  }

  if (!('product' in result)) {
    permanentRedirect(getRedirectTargetPath(slug, result.legacyRedirectTarget));
  }

  const { product, merchant, categoryMismatch, needsValuesRedirect } = result;

  if (categoryMismatch || needsValuesRedirect) {
    permanentRedirect(getRedirectTargetPath(slug, product));
  }

  const resolvedSearchParams = await searchParams;
  redirectInvalidVariantSelectionParams(slug, product, resolvedSearchParams);

  return { merchant, product };
}

async function CategoryProductPageCommerceControls({
  slug,
  searchParams,
  productResultPromise,
}: Omit<CategoryProductPageContentProps, 'renderMode'>) {
  const { merchant, product } = await getRenderableCategoryProductResult({
    slug,
    searchParams,
    productResultPromise,
  });

  return renderTemplateProductPage({
    product,
    renderMode: 'commerce',
    semanticSections: null,
    templateId: merchant?.template_id,
  });
}
```

Change the start and end of `CategoryProductPageContent` so `renderMode="belowFold"` keeps JSON-LD and hidden summary outside the critical shell while rendering only the deferred client document island:

```tsx
async function CategoryProductPageContent({
  renderMode = 'full',
  slug,
  searchParams,
  productResultPromise,
}: CategoryProductPageContentProps) {
  const { merchant, product } = await getRenderableCategoryProductResult({
    slug,
    searchParams,
    productResultPromise,
  });

  const baseUrl = buildRequestScopedStoreUrl(merchant, await headers());
  const resolvedCategorySlug =
    product.category_slug ||
    (product.category ? generateSlug(product.category) : 'products');

  // The current block from trustProfile through breadcrumbSchema stays in this
  // server component. Only move the initial result validation into
  // getRenderableCategoryProductResult and pass renderMode through to the
  // template renderer.

  const productPage = await renderTemplateProductPage({
    product,
    renderMode,
    semanticSections,
    templateId: merchant?.template_id,
  });

  return (
    <>
      {/* nosemgrep: typescript.react.security.audit.react-dangerouslysetinnerhtml - JSON-LD is sanitized and not executed */}
      <script
        type="application/ld+json"
        // nosemgrep: react-dangerouslysetinnerhtml, typescript.react.security.audit.react-dangerouslysetinnerhtml.react-dangerouslysetinnerhtml
        // biome-ignore lint/security/noDangerouslySetInnerHtml: JSON-LD schema sanitized with safeJsonLdStringify()
        dangerouslySetInnerHTML={{ __html: safeJsonLdStringify(productSchema) }}
      />
      {/* nosemgrep: typescript.react.security.audit.react-dangerouslysetinnerhtml - JSON-LD is sanitized and not executed */}
      <script
        type="application/ld+json"
        // biome-ignore lint/security/noDangerouslySetInnerHtml: JSON-LD schema sanitized with safeJsonLdStringify()
        dangerouslySetInnerHTML={{
          __html: safeJsonLdStringify(breadcrumbSchema),
        }} // nosemgrep: react-dangerouslysetinnerhtml, typescript.react.security.audit.react-dangerouslysetinnerhtml.react-dangerouslysetinnerhtml
      />
      <article className="sr-only" aria-label={`${product.name} summary`}>
        <p>{priceSeoCopy.answer}</p>
        {plainProductDescription ? <p>{plainProductDescription}</p> : null}
        <dl>
          <dt>Brand</dt>
          <dd>{product.brand || 'OgaBassey'}</dd>
          <dt>Category</dt>
          <dd>{product.category || 'Electronics'}</dd>
          <dt>Condition</dt>
          <dd>{product.condition || 'New'}</dd>
          <dt>Price</dt>
          <dd>{priceSeoCopy.priceText || 'Contact for price'}</dd>
        </dl>
      </article>
      {productPage}
    </>
  );
}
```

Do not put `CategoryProductPageContent` inside `OgabasseyPdpCriticalShell`; that component returns JSON-LD scripts, the hidden summary, and below-fold document content.

Render the OgaBassey route as:

```tsx
return (
  <>
    {earlyProductResourceHints}
    {criticalProduct ? (
      <>
        <OgabasseyPdpStaticResourceHints />
        <OgabasseyPdpCriticalShell
          basePath={process.env.NODE_ENV === 'development' ? `/${slug}` : ''}
          product={criticalProduct}
        >
          <Suspense fallback={null}>
            <CategoryProductPageCommerceControls
              slug={slug}
              searchParams={Promise.resolve(resolvedSearchParams)}
              productResultPromise={productResultPromise}
            />
          </Suspense>
        </OgabasseyPdpCriticalShell>
        <Suspense fallback={null}>
          <CategoryProductPageContent
            renderMode="belowFold"
            slug={slug}
            searchParams={Promise.resolve(resolvedSearchParams)}
            productResultPromise={productResultPromise}
          />
        </Suspense>
      </>
    ) : (
      <Suspense
        fallback={
          <OgabasseyPdpProductLcpSkeleton
            merchant={merchant}
            primaryProductImage={primaryProductImage}
            productName={product.name}
          />
        }
      >
        <CategoryProductPageContent
          renderMode="full"
          slug={slug}
          searchParams={Promise.resolve(resolvedSearchParams)}
          productResultPromise={productResultPromise}
        />
      </Suspense>
    )}
    <StorefrontDynamicMetadataMarker />
  </>
);
```

Keep the existing full rendering path for non-OgaBassey templates and for OgaBassey only when no critical snapshot is available.

- [ ] **Step 7: Run focused tests and commit**

Run:

```bash
pnpm --dir apps/web test src/components/storefront/ogabassey/pdp/critical-product.test.ts src/components/storefront/ogabassey/pdp/critical-shell.test.tsx src/components/storefront/ogabassey/pdp/client-islands.test.tsx src/components/storefront/ogabassey/pages/product-details-page/product-interaction-panel.test.tsx src/components/storefront/ogabassey/pages/product-details-page.test.tsx src/app/'(storefront)'/'[slug]'/'(catalog)'/'(pdp)'/'[category]'/'[productSlug]'/page.test.tsx
git add apps/web/src/components/storefront/ogabassey/pdp apps/web/src/components/storefront/ogabassey/pages/product-details-page.tsx apps/web/src/components/storefront/ogabassey/pages/product-details-page.test.tsx apps/web/src/components/storefront/ogabassey/pages/product-details-page/product-interaction-panel.tsx apps/web/src/components/storefront/ogabassey/pages/product-details-page/product-interaction-panel.test.tsx apps/web/src/components/storefront/ogabassey/pages/product-details-page/product-summary-panel.tsx apps/web/src/app/'(storefront)'/'[slug]'/'(catalog)'/'(pdp)'/'[category]'/'[productSlug]'/page.tsx apps/web/src/app/'(storefront)'/'[slug]'/'(catalog)'/'(pdp)'/'[category]'/'[productSlug]'/page.test.tsx
git commit -m "Split OgaBassey PDP critical shell into commerce islands"
```

Expected:

```text
PASS src/components/storefront/ogabassey/pdp/critical-product.test.ts
PASS src/components/storefront/ogabassey/pdp/critical-shell.test.tsx
PASS src/components/storefront/ogabassey/pdp/client-islands.test.tsx
PASS src/components/storefront/ogabassey/pages/product-details-page/product-interaction-panel.test.tsx
PASS src/components/storefront/ogabassey/pages/product-details-page.test.tsx
PASS src/app/(storefront)/[slug]/(catalog)/(pdp)/[category]/[productSlug]/page.test.tsx
[branch] Split OgaBassey PDP critical shell into commerce islands
```

---

## Task 6: Preserve OgaBassey Product SEO Entity Consistency

**Files:**
- Modify: `apps/web/src/app/(storefront)/[slug]/(catalog)/(pdp)/[category]/[productSlug]/page.test.tsx`
- Modify: `docs/audits/2026-05-13-storefront-lcp-baseline.md`

- [ ] **Step 1: Add product entity consistency test**

Add to `page.test.tsx`:

```tsx
it('keeps visible OgaBassey product identity aligned with Product JSON-LD input', async () => {
  render(
    await resolveRsc(
      await CategoryProductPage({
        params: Promise.resolve({
          slug: 'teststore',
          category: 'laptops',
          productSlug: 'hp-laptop-14-ep0063nia',
        }),
        searchParams: Promise.resolve({}),
      })
    )
  );

  expect(
    screen.getByRole('heading', {
      level: 1,
      name: 'HP Laptop 14-ep0063nia',
    })
  ).toBeInTheDocument();
  expect(mockGenerateProductSchema).toHaveBeenCalledWith(
    expect.objectContaining({
      name: 'HP Laptop 14-ep0063nia',
      price: 645600,
      category: 'Laptops',
    }),
    'TestStore',
    'NGN',
    'NG',
    null,
    expect.any(Object),
    expect.any(Object)
  );
});
```

- [ ] **Step 2: Document invariant**

Append below the current audit notes in `docs/audits/2026-05-13-storefront-lcp-baseline.md`:

```markdown
### OgaBassey PDP Entity Consistency Invariant

The root LCP fix keeps the OgaBassey PDP as one product document. The server critical shell, hydrated purchase controls, Product JSON-LD, canonical URL, OpenGraph product metadata, and hidden crawlable summary must all describe the same product row. A faster page with divergent product signals is not an acceptable SEO outcome.
```

- [ ] **Step 3: Run test and commit**

Run:

```bash
pnpm --dir apps/web test src/app/'(storefront)'/'[slug]'/'(catalog)'/'(pdp)'/'[category]'/'[productSlug]'/page.test.tsx -- -t "visible OgaBassey product identity"
git add apps/web/src/app/'(storefront)'/'[slug]'/'(catalog)'/'(pdp)'/'[category]'/'[productSlug]'/page.test.tsx docs/audits/2026-05-13-storefront-lcp-baseline.md
git commit -m "Protect OgaBassey PDP SEO entity consistency"
```

Expected:

```text
targeted test passes
[branch] Protect OgaBassey PDP SEO entity consistency
```

---

## Task 7: Verify, Measure, And Decide The Next Subpart

**Files:**
- Modify: `docs/audits/2026-05-13-storefront-lcp-baseline.md`

- [ ] **Step 1: Run focused tests**

Run:

```bash
pnpm --dir apps/web test src/components/storefront/ogabassey/pdp/critical-product.test.ts src/components/storefront/ogabassey/pdp/critical-shell.test.tsx src/components/storefront/ogabassey/pdp/client-islands.test.tsx src/components/storefront/ogabassey/pages/product-details-page/product-interaction-panel.test.tsx src/components/storefront/ogabassey/pages/product-details-page.test.tsx src/app/'(storefront)'/'[slug]'/route-groups.test.ts src/app/'(storefront)'/'[slug]'/'(catalog)'/'(pdp)'/'[category]'/'[productSlug]'/page.test.tsx
```

Expected:

```text
PASS src/components/storefront/ogabassey/pdp/critical-product.test.ts
PASS src/components/storefront/ogabassey/pdp/critical-shell.test.tsx
PASS src/components/storefront/ogabassey/pdp/client-islands.test.tsx
PASS src/components/storefront/ogabassey/pages/product-details-page/product-interaction-panel.test.tsx
PASS src/components/storefront/ogabassey/pages/product-details-page.test.tsx
PASS src/app/(storefront)/[slug]/route-groups.test.ts
PASS src/app/(storefront)/[slug]/(catalog)/(pdp)/[category]/[productSlug]/page.test.tsx
```

- [ ] **Step 2: Run quality gates**

Run:

```bash
pnpm --dir apps/web lint
pnpm --dir apps/web exec tsc --noEmit --pretty false
SUPABASE_JWT_SECRET=local-build-validation-secret pnpm --dir apps/web build
```

Expected:

```text
lint exits 0
tsc exits 0
next build exits 0
```

- [ ] **Step 3: Verify local production rendering with Chrome DevTools**

Run:

```bash
PORT=3035 pnpm --dir apps/web start
```

Open:

```text
http://localhost:3035/ogabassey.com/laptops/lenovo-legion-pro-9-16irx9-rtx-4090
```

Verify in a mobile viewport:

```text
The product image is visible above the fold.
There is exactly one visible H1.
The product image currentSrc uses the 750w candidate or the smallest correct candidate for the viewport.
The product image request has high priority.
The PDP route does not load the broad storefront-full CSS artifact.
Desktop viewport still shows purchase controls.
```

- [ ] **Step 4: Run CodeRabbit before PR**

Run:

```bash
coderabbit review --agent -t committed --base origin/main -c AGENTS.md
```

Expected:

```text
review_completed
```

Fix critical and high severity findings before opening the PR.

- [ ] **Step 5: Push and open PR**

Run:

```bash
git fetch origin
git rebase --autostash origin/main
git push -u origin HEAD
PR_BODY=/tmp/ogabassey-pdp-critical-rendering-pr-body.md
printf '%s\n' \
  '## Summary' \
  '- split OgaBassey PDP CSS ownership into PDP and listing route groups' \
  '- render the OgaBassey PDP first viewport from a server critical product snapshot' \
  '- move purchase controls and below-fold document sections into separate client islands' \
  '- preserve Product JSON-LD, hidden summary, canonical metadata, and visible product identity alignment' \
  '' \
  '## Validation' \
  '- pnpm --dir apps/web test src/components/storefront/ogabassey/pdp/critical-product.test.ts src/components/storefront/ogabassey/pdp/critical-shell.test.tsx src/components/storefront/ogabassey/pdp/client-islands.test.tsx src/components/storefront/ogabassey/pages/product-details-page/product-interaction-panel.test.tsx src/components/storefront/ogabassey/pages/product-details-page.test.tsx src/app/'\''(storefront)'\''/'\''[slug]'\''/route-groups.test.ts src/app/'\''(storefront)'\''/'\''[slug]'\''/'\''(catalog)'\''/'\''(pdp)'\''/'\''[category]'\''/'\''[productSlug]'\''/page.test.tsx' \
  '- pnpm --dir apps/web lint' \
  '- pnpm --dir apps/web exec tsc --noEmit --pretty false' \
  '- SUPABASE_JWT_SECRET=local-build-validation-secret pnpm --dir apps/web build' \
  '' \
  '## Plan' \
  'Implementation plan: docs/superpowers/plans/2026-05-26-ogabassey-pdp-critical-rendering.md' \
  > "$PR_BODY"
env -u GITHUB_TOKEN gh pr create --base main --title "Rebuild OgaBassey PDP critical rendering path" --body-file "$PR_BODY"
```

Expected:

```text
https://github.com/ogabasseyy/Baci/pull/<number>
```

- [ ] **Step 6: Run post-deploy measurement**

After merge and deploy, run:

```bash
DEBUGBEAR_PROJECT_ID=100906 DEBUGBEAR_API_KEY="$DEBUGBEAR_API_KEY" pnpm --dir apps/web perf:ogabassey-pdp-lcp
```

Expected target:

```text
lcpMs < 2500
```

- [ ] **Step 7: Record the result**

Append one row to `docs/audits/2026-05-13-storefront-lcp-baseline.md` using the existing table columns:

```markdown
| 2026-05-26 | OgaBassey PDP critical rendering deployed | OgaBassey PDP | mobile | actual | actual | actual | actual | actual | actual | actual | actual | DebugBear quick test `<id>` measured live PDP after server critical shell, PDP CSS route group, and commerce island split. |
```

Replace each `actual` value with the measured value before committing the docs row.

- [ ] **Step 8: Classify the next subpart when LCP remains above target**

Use the DebugBear breakdown:

```text
TTFB > 800 ms: move the critical snapshot closer to edge/cache and inspect Supabase/cache misses.
Resource-load delay > 500 ms: move the product image hint to response headers or CDN Early Hints.
Resource-load duration > 1000 ms: inspect CDN image transform latency, cache status, and AVIF transform cache hits.
Render delay > 500 ms: continue reducing PDP CSS and above-fold client hydration.
TBT > 300 ms: defer more client islands and remove above-fold third-party work.
```

Do not mark the LCP goal complete until a live mobile result proves:

```text
OgaBassey PDP mobile LCP < 2500 ms
```

---

## Execution Notes

- Execute in an isolated worktree because this plan moves App Router files and changes CSS ownership.
- Keep Task 4 atomic. The server shell must not ship while the old client shell still duplicates image/title/price.
- Rebase onto current `origin/main` before pushing because route moves conflict easily.
- The plan is successful only when live measurement proves the target. Local Chrome evidence is a gate, not the final result.
