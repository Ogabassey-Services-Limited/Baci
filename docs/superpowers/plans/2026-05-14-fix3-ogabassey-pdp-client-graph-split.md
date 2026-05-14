# Fix 3 OgaBassey PDP Client Graph Split Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove the generic product-detail client graph from OgaBassey PDP first-load JavaScript so Framer Motion and generic mobile sticky-cart code do not run on the critical PDP LCP path.

**Architecture:** Keep the OgaBassey PDP branch synchronous and template-specific. Move the default-template `ProductDetailClient` into a small Server Component renderer that is dynamically imported only when the merchant is not using `OGABASSEY_TEMPLATE_ID`. Validate the code path with unit tests and validate the bundle boundary with `route-bundle-stats.json`.

**Tech Stack:** Next.js 16 App Router, React 19 Server/Client Components, Turbopack route bundle diagnostics, Vitest + React Testing Library, Biome.

---

## Investigation Summary

The live canonical PDP (`https://ogabassey.com/laptops/lenovo-legion-pro-9-16irx9-rtx-4090`) currently loads 33 JS chunks from initial HTML. The top PSI unused chunk `06lahl58v69w8.js` contains Framer Motion signatures (`createMotionProxy`, `MotionConfigContext`). Local `route-bundle-stats.json` for `/[slug]/[category]/[productSlug]` confirms two first-load Framer chunks:

```text
0uwk4x99eg-k..js   50,599 bytes  QuantityButton, useRecentlyViewed, MotionConfigContext
0osky5~p0fo6g.js  159,955 bytes  createMotionProxy, MotionConfigContext
```

The import path is:

```text
apps/web/src/app/(storefront)/[slug]/(catalog)/[category]/[productSlug]/page.tsx
  static import ProductDetailClient
apps/web/src/app/(storefront)/[slug]/(catalog)/products/[productSlug]/product-detail-client.tsx
  import StickyAddToCart
apps/web/src/components/storefront/sticky-add-to-cart.tsx
  import QuantityButton
apps/web/src/components/ui/animated-icons.tsx
  import framer-motion
```

OgaBassey does not render `ProductDetailClient`; it renders `ProductDetailsPage` from `components/storefront/ogabassey`. The generic client is included because the shared route imports both template branches at module scope.

Current Next.js docs guidance checked via Context7 (`/vercel/next.js`, lazy-loading guide): lazy loading applies to Client Components; `ssr: false` is not allowed from Server Components; dynamically importing a Server Component can lazy-load its child Client Components. This plan uses a branch-local Server Component renderer instead of `dynamic(..., { ssr: false })` in the route.

---

## File Structure

Files created:

- `apps/web/src/app/(storefront)/[slug]/(catalog)/[category]/[productSlug]/default-product-page-renderer.tsx`  
  Server Component renderer for the non-OgaBassey fallback product page. It owns the static `ProductDetailClient` import so the generic client graph is not referenced by the shared route module.

- `apps/web/src/app/(storefront)/[slug]/(catalog)/[category]/[productSlug]/default-product-page-renderer.test.tsx`  
  Colocated regression test proving the default renderer still passes the product and semantic sections into `ProductDetailClient`.

Files modified:

- `apps/web/src/app/(storefront)/[slug]/(catalog)/[category]/[productSlug]/page.tsx`  
  Remove the module-scope `ProductDetailClient` import. Load `default-product-page-renderer` only in the non-OgaBassey branch.

- `apps/web/src/app/(storefront)/[slug]/(catalog)/[category]/[productSlug]/page.test.tsx`  
  Add a source-level bundle-boundary regression test and keep existing branch behavior tests green.

Files NOT touched:

- `apps/web/src/app/(storefront)/[slug]/(catalog)/products/[productSlug]/product-detail-client.tsx`
- `apps/web/src/components/ui/animated-icons.tsx`
- `apps/web/src/components/storefront/sticky-add-to-cart.tsx`
- `apps/web/src/components/storefront/ogabassey/pages/product-details-page.tsx`
- `apps/web/src/proxy.ts`
- `supabase/migrations/*`

---

## Pre-flight

- [ ] **Step 1: Create the implementation worktree from current main**

```bash
# From your local Baci repository root:
git fetch origin main
git worktree add -b codex/fix3-ogabassey-pdp-client-graph-split .worktrees/fix3-ogabassey-pdp-client-graph-split origin/main
cd .worktrees/fix3-ogabassey-pdp-client-graph-split
```

Expected:

```text
Preparing worktree (new branch 'codex/fix3-ogabassey-pdp-client-graph-split')
HEAD is now at <origin/main sha>
```

- [ ] **Step 2: Verify isolation and install state**

```bash
git status -sb
test -d node_modules && echo "root node_modules present"
test -d apps/web/node_modules && echo "web node_modules present"
```

Expected:

```text
## codex/fix3-ogabassey-pdp-client-graph-split...origin/main
root node_modules present
web node_modules present
```

If `node_modules` is missing, run:

```bash
pnpm install
```

Expected: install completes without lockfile changes.

---

## Task 1: Add the Default Renderer Test First

**Files:**
- Create: `apps/web/src/app/(storefront)/[slug]/(catalog)/[category]/[productSlug]/default-product-page-renderer.test.tsx`

- [ ] **Step 1: Write the failing test**

Create `apps/web/src/app/(storefront)/[slug]/(catalog)/[category]/[productSlug]/default-product-page-renderer.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';
import type { Product } from '@/lib/products';
import { DefaultProductPageRenderer } from './default-product-page-renderer';

const mockProductDetailClient = vi.hoisted(() =>
  vi.fn(({ product }: { product: Product }) => (
    <article aria-label="Default product detail">{product.name}</article>
  ))
);

vi.mock(
  '@/app/(storefront)/[slug]/(catalog)/products/[productSlug]/product-detail-client',
  () => ({
    default: (props: { product: Product }) => mockProductDetailClient(props),
  })
);

function makeProduct(): Product {
  return {
    brand: 'HP',
    category: 'Laptops',
    category_slug: 'laptops',
    condition: 'new',
    description: 'A laptop',
    fulfillmentFields: [],
    gtin: '',
    id: 'product-1',
    image: '/hp.jpg',
    imageHint: 'hp laptop',
    imageLarge: '/hp.jpg',
    manage_stock: true,
    merchant_id: 'merchant-1',
    mpn: '',
    name: 'HP Laptop 14',
    price: 645600,
    slug: 'hp-laptop-14',
    status: 'active',
    stock: 5,
  };
}

describe('DefaultProductPageRenderer', () => {
  it('renders the generic product client with semantic sections', () => {
    const semanticSections: ReactNode = (
      <section aria-label="Semantic product sections">Crawlable details</section>
    );

    render(
      <DefaultProductPageRenderer
        product={makeProduct()}
        semanticSections={semanticSections}
      />
    );

    expect(mockProductDetailClient).toHaveBeenCalledWith(
      expect.objectContaining({
        product: expect.objectContaining({ name: 'HP Laptop 14' }),
      })
    );
    expect(
      screen.getByRole('article', { name: 'Default product detail' })
    ).toHaveTextContent('HP Laptop 14');
    expect(
      screen.getByRole('region', { name: 'Semantic product sections' })
    ).toHaveTextContent('Crawlable details');
  });
});
```

- [ ] **Step 2: Run the new test and verify it fails**

```bash
LEFTHOOK=0 pnpm exec vitest run src/app/'(storefront)'/'[slug]'/'(catalog)'/'[category]'/'[productSlug]'/default-product-page-renderer.test.tsx
```

Expected:

```text
FAIL ...default-product-page-renderer.test.tsx
Cannot find module './default-product-page-renderer'
```

---

## Task 2: Add the Route Bundle-Boundary Regression Test

**Files:**
- Modify: `apps/web/src/app/(storefront)/[slug]/(catalog)/[category]/[productSlug]/page.test.tsx`

- [ ] **Step 1: Add the source-boundary assertion**

Modify the top imports in `page.test.tsx`:

```tsx
import { readFileSync } from 'node:fs';
import { render, screen } from '@testing-library/react';
import { type ReactNode, Suspense } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { OGABASSEY_TEMPLATE_ID } from '@/config/templates';
```

Add this test near the OgaBassey branch tests:

```tsx
it('keeps the generic product client behind the default branch loader', () => {
  const routeSource = readFileSync(new URL('./page.tsx', import.meta.url), 'utf8');

  expect(routeSource).not.toContain(
    "import ProductDetailClient from '@/app/(storefront)/[slug]/(catalog)/products/[productSlug]/product-detail-client'"
  );
  expect(routeSource).toContain("import('./default-product-page-renderer')");
});
```

- [ ] **Step 2: Run the page test and verify it fails**

```bash
LEFTHOOK=0 pnpm exec vitest run src/app/'(storefront)'/'[slug]'/'(catalog)'/'[category]'/'[productSlug]'/page.test.tsx --testNamePattern "keeps the generic product client"
```

Expected:

```text
FAIL ...page.test.tsx > keeps the generic product client behind the default branch loader
expected "...import ProductDetailClient..." not to contain ...
```

---

## Task 3: Implement the Default Renderer Split

**Files:**
- Create: `apps/web/src/app/(storefront)/[slug]/(catalog)/[category]/[productSlug]/default-product-page-renderer.tsx`
- Modify: `apps/web/src/app/(storefront)/[slug]/(catalog)/[category]/[productSlug]/page.tsx`

- [ ] **Step 1: Create the renderer**

Create `default-product-page-renderer.tsx`:

```tsx
import type { ReactNode } from 'react';
import ProductDetailClient from '@/app/(storefront)/[slug]/(catalog)/products/[productSlug]/product-detail-client';
import type { Product } from '@/lib/products';

interface DefaultProductPageRendererProps {
  product: Product;
  semanticSections: ReactNode;
}

export function DefaultProductPageRenderer({
  product,
  semanticSections,
}: DefaultProductPageRendererProps) {
  return (
    <>
      <ProductDetailClient product={product} />
      {semanticSections}
    </>
  );
}
```

- [ ] **Step 2: Move the generic client load out of the route module scope**

In `page.tsx`, remove this import:

```tsx
import ProductDetailClient from '@/app/(storefront)/[slug]/(catalog)/products/[productSlug]/product-detail-client';
```

Replace the current `TemplateProductPage` function with this async version:

```tsx
async function renderDefaultProductPage({
  product,
  semanticSections,
}: {
  product: Product;
  semanticSections: ReactNode;
}) {
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

async function TemplateProductPage({
  product,
  templateId,
  semanticSections,
}: {
  product: Product;
  templateId?: string;
  semanticSections: ReactNode;
}) {
  // Ogabassey template
  if (templateId === OGABASSEY_TEMPLATE_ID) {
    const ogabasseyProduct = toOgabasseyProduct(product);
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

  return renderDefaultProductPage({ product, semanticSections });
}
```

Before the final `return` in `CategoryProductPage`, compute the template page:

```tsx
  const productPage = await TemplateProductPage({
    product,
    semanticSections,
    templateId: merchant?.template_id,
  });
```

Then replace the JSX usage:

```tsx
      {productPage}
```

The end of the component should no longer contain:

```tsx
      <TemplateProductPage
        product={product}
        semanticSections={semanticSections}
        templateId={merchant?.template_id}
      />
```

- [ ] **Step 3: Run focused tests**

```bash
LEFTHOOK=0 pnpm exec vitest run \
  src/app/'(storefront)'/'[slug]'/'(catalog)'/'[category]'/'[productSlug]'/default-product-page-renderer.test.tsx \
  src/app/'(storefront)'/'[slug]'/'(catalog)'/'[category]'/'[productSlug]'/page.test.tsx
```

Expected:

```text
Test Files  2 passed
Tests       all passed
```

---

## Task 4: Verify the Bundle Boundary

**Files:**
- No source changes in this task.

- [ ] **Step 1: Build with the same environment pattern used in the prep investigation**

If `apps/web/.env.production` is missing but `apps/web/.env.vercel.production` exists:

```bash
cp apps/web/.env.vercel.production apps/web/.env.production
```

Then build:

```bash
SUPABASE_JWT_SECRET="dummy" LEFTHOOK=0 pnpm --filter @baci/web build
```

Expected:

```text
@baci/web:build: ✓ Compiled successfully
```

- [ ] **Step 2: Assert PDP first-load chunks no longer contain generic client / Framer markers**

Run:

```bash
node - <<'NODE'
const fs = require('node:fs');
const stats = JSON.parse(
  fs.readFileSync('apps/web/.next/diagnostics/route-bundle-stats.json', 'utf8')
);
const route = stats.find(
  (entry) => entry.route === '/[slug]/[category]/[productSlug]'
);

if (!route) {
  throw new Error('PDP route stats missing');
}

const forbidden = {
  framer: ['createMotionProxy', 'MotionConfigContext'],
  genericProductClient: ['AnimatedIcon', 'QuantityButton', 'useRecentlyViewed'],
};

const hits = [];
for (const chunkPath of route.firstLoadChunkPaths) {
  const filePath = chunkPath.replace(/^\.next\//, 'apps/web/.next/');
  const source = fs.readFileSync(filePath, 'utf8');
  for (const [name, tokens] of Object.entries(forbidden)) {
    if (tokens.some((token) => source.includes(token))) {
      hits.push(`${name}: ${chunkPath}`);
    }
  }
}

console.log(
  JSON.stringify(
    {
      route: route.route,
      firstLoadUncompressedJsBytes: route.firstLoadUncompressedJsBytes,
      chunkCount: route.firstLoadChunkPaths.length,
      hits,
    },
    null,
    2
  )
);

if (hits.length > 0) {
  throw new Error(`Forbidden PDP first-load chunks remain: ${hits.join(', ')}`);
}
NODE
```

Expected:

```json
{
  "route": "/[slug]/[category]/[productSlug]",
  "firstLoadUncompressedJsBytes": <number lower than 1679122>,
  "chunkCount": <number>,
  "hits": []
}
```

If the script still reports Framer or generic client markers, stop and inspect whether the default renderer is still statically imported by the route or whether OgaBassey itself gained a real Framer dependency.

---

## Task 5: Full Validation Gates

**Files:**
- All changed files from Tasks 1-3.

- [ ] **Step 1: Format/check touched files with Biome**

```bash
LEFTHOOK=0 pnpm exec biome check --write \
  apps/web/src/app/'(storefront)'/'[slug]'/'(catalog)'/'[category]'/'[productSlug]'/page.tsx \
  apps/web/src/app/'(storefront)'/'[slug]'/'(catalog)'/'[category]'/'[productSlug]'/page.test.tsx \
  apps/web/src/app/'(storefront)'/'[slug]'/'(catalog)'/'[category]'/'[productSlug]'/default-product-page-renderer.tsx \
  apps/web/src/app/'(storefront)'/'[slug]'/'(catalog)'/'[category]'/'[productSlug]'/default-product-page-renderer.test.tsx
```

Expected:

```text
Checked 4 files. No fixes applied.
```

or

```text
Checked 4 files. Fixed <n> files.
```

- [ ] **Step 2: Run web lint**

```bash
LEFTHOOK=0 pnpm turbo lint --filter=@baci/web
```

Expected: exits `0` with no Biome errors.

- [ ] **Step 3: Run web typecheck**

```bash
LEFTHOOK=0 pnpm turbo typecheck --filter=@baci/web
```

Expected: exits `0`.

- [ ] **Step 4: Run web tests**

```bash
LEFTHOOK=0 pnpm turbo test --filter=@baci/web
```

Expected: exits `0`.

- [ ] **Step 5: Run CodeRabbit pre-commit review**

```bash
coderabbit review --prompt-only -t uncommitted
```

Expected: no critical/high findings. Fix any valid critical/high findings before committing.

---

## Task 6: Commit, Push, and Open PR

**Files:**
- All changed files.

- [ ] **Step 1: Review the diff**

```bash
git diff --stat
git diff -- apps/web/src/app/'(storefront)'/'[slug]'/'(catalog)'/'[category]'/'[productSlug]'
```

Expected: only the PDP route and new renderer/test files are changed.

- [ ] **Step 2: Commit**

```bash
git add \
  apps/web/src/app/'(storefront)'/'[slug]'/'(catalog)'/'[category]'/'[productSlug]'/page.tsx \
  apps/web/src/app/'(storefront)'/'[slug]'/'(catalog)'/'[category]'/'[productSlug]'/page.test.tsx \
  apps/web/src/app/'(storefront)'/'[slug]'/'(catalog)'/'[category]'/'[productSlug]'/default-product-page-renderer.tsx \
  apps/web/src/app/'(storefront)'/'[slug]'/'(catalog)'/'[category]'/'[productSlug]'/default-product-page-renderer.test.tsx
git commit -m "perf: split OgaBassey PDP client graph"
```

Expected:

```text
[codex/fix3-ogabassey-pdp-client-graph-split <sha>] perf: split OgaBassey PDP client graph
```

- [ ] **Step 3: Push**

```bash
git push -u origin codex/fix3-ogabassey-pdp-client-graph-split
```

Expected: branch pushes successfully. If hooks fail because the worktree has no dependencies, run the validation commands above in the worktree with dependencies before using `--no-verify`.

- [ ] **Step 4: Open PR**

```bash
gh pr create \
  --base main \
  --head codex/fix3-ogabassey-pdp-client-graph-split \
  --title "Trim OgaBassey PDP first-load client graph" \
  --body "## Summary
- move the generic product detail client behind the non-OgaBassey branch
- keep OgaBassey PDP resource hints and rendering path intact
- add bundle-boundary regression coverage for the shared PDP route

## Validation
- LEFTHOOK=0 pnpm exec vitest run src/app/'(storefront)'/'[slug]'/'(catalog)'/'[category]'/'[productSlug]'/default-product-page-renderer.test.tsx src/app/'(storefront)'/'[slug]'/'(catalog)'/'[category]'/'[productSlug]'/page.test.tsx
- SUPABASE_JWT_SECRET=dummy LEFTHOOK=0 pnpm --filter @baci/web build
- route-bundle-stats assertion: no Framer/generic product client markers in /[slug]/[category]/[productSlug]
- LEFTHOOK=0 pnpm turbo lint --filter=@baci/web
- LEFTHOOK=0 pnpm turbo typecheck --filter=@baci/web
- LEFTHOOK=0 pnpm turbo test --filter=@baci/web
- coderabbit review --prompt-only -t uncommitted"
```

Expected: PR URL is printed.

---

## Task 7: Post-Merge Measurement

**Files:**
- Create a separate docs PR after measurement if results need to be recorded.

- [ ] **Step 1: Wait for merge + production deploy**

```bash
gh pr view <PR_NUMBER> --json state,mergedAt,mergeCommit
```

Expected:

```json
{"state":"MERGED", ...}
```

Then confirm production deploy for the merge commit through GitHub checks or Vercel.

- [ ] **Step 2: Re-run PSI on the canonical PDP URL**

```bash
PAGESPEED_INSIGHTS_API_KEY="..." node -e '
const KEY = process.env.PAGESPEED_INSIGHTS_API_KEY;
const URL_TO_TEST = "https://ogabassey.com/laptops/lenovo-legion-pro-9-16irx9-rtx-4090";
(async () => {
  for (const strategy of ["desktop", "mobile"]) {
    const qs = new URLSearchParams({ url: URL_TO_TEST, strategy, key: KEY, category: "PERFORMANCE" });
    const r = await fetch(`https://www.googleapis.com/pagespeedonline/v5/runPagespeed?${qs}`, { signal: AbortSignal.timeout(180_000) });
    const j = await r.json();
    if (j.error) { console.log(strategy, "ERROR", j.error.message.slice(0, 200)); continue; }
    const lcp = j.lighthouseResult.audits["largest-contentful-paint"];
    const tbt = j.lighthouseResult.audits["total-blocking-time"];
    const unused = j.lighthouseResult.audits["unused-javascript"];
    console.log(strategy, "LCP:", Math.round(lcp.numericValue), "ms TBT:", Math.round(tbt.numericValue), "ms unused-JS:", Math.round((unused.numericValue || 0) / 1024), "KiB");
  }
})();
'
```

Expected: mobile PDP completes successfully and unused JS drops from the post-#1634 baseline.

- [ ] **Step 3: Record the measurement in a separate docs PR**

Append a short section to `docs/audits/2026-05-13-storefront-lcp-baseline.md`:

```markdown
## PDP measurement after Fix 3 PR 1 — Generic Client Graph Split

Canonical URL: `https://ogabassey.com/laptops/lenovo-legion-pro-9-16irx9-rtx-4090`

| Strategy | LCP | TBT | Unused JS | Notes |
|---|---:|---:|---:|---|
| Desktop | `<value> ms` | `<value> ms` | `<value> KiB` | Compare against post-#1634 desktop LCP 1357 ms / TBT 445 ms |
| Mobile | `<value> ms` | `<value> ms` | `<value> KiB` | Compare against post-#1634 mobile LCP 4824 ms |
```

Expected: docs PR is separate from the implementation PR.

---

## Review Gates

- [ ] After Task 2, review the failing tests. They must fail for the intended reason, not because mocks are broken.
- [ ] After Task 4, review `route-bundle-stats.json`. If Framer remains, do not proceed to PR; trace the remaining import path first.
- [ ] Before commit, run CodeRabbit and manually inspect for invalid Next.js dynamic import usage.
- [ ] After PR opens, resolve every review thread before merge.
- [ ] After merge, do not claim SEO/CWV improvement until PSI re-measurement is captured on the deployed production URL.

---

## Expected Outcome

This PR should remove roughly 200 KiB of Framer/generic product-client first-load JavaScript from the OgaBassey PDP route. It is not expected to solve all mobile PDP LCP by itself; it is the first narrow Fix 3 bundle intervention. The next intervention should be chosen only after the post-merge PSI and route-bundle-stats deltas are recorded.
