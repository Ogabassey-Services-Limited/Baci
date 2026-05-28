# OgaBassey PDP Critical CSS Architecture Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move direct OgaBassey PDP entries onto a small, deterministic critical rendering path so mobile PDP LCP drops below `2500 ms`; home is measured only as a no-regression guard in this slice.

**Architecture:** Treat the OgaBassey PDP first viewport as a separate commerce answer layer. Product image, name, price, trust facts, canonical metadata, Product JSON-LD, and crawlable semantic product sections stay server-rendered, while only quantity/cart interaction hydrates in a small client island. Tailwind route CSS is ratcheted only after CSS Module coverage is proven; homepage critical CSS isolation moves to a Phase 2 plan after PDP direct-entry LCP is fixed.

**Tech Stack:** Next.js 16 App Router, React 19 Server Components, TypeScript, CSS Modules, Tailwind CSS v4, Vitest/React Testing Library, PageSpeed Insights API, DebugBear Quick Tests API, Chrome DevTools traces.

---

## Implementation Update - 2026-05-28

- The final implementation splits PDP CSS at the route boundary instead of only narrowing `storefront-pdp.css` in place. The shared PDP layout no longer imports the large PDP stylesheet.
- Direct OgaBassey category PDP entries import `storefront-ogabassey-pdp-critical.css`, backed by `tailwind.storefront.scoped.config.ts` with `content: []` plus explicit Tailwind v4 `@source` entries.
- The below-fold `ProductDetailsPage` imports `storefront-ogabassey-pdp-deferred.css`, so its full interactive detail styles are loaded with the deferred dynamic client chunk instead of blocking the first viewport.
- Local production build manifest evidence after the split: direct category PDP initial CSS totals `29472` raw bytes (`0wa-0ys_qm7tq.css` `2110`, `0.gyf7wczwbku.css` `275`, `0k94ro3ma3pch.css` `27087`), down from the earlier `~247 KB` failed split and `~255 KB` pre-split route sheet.
- Live PSI/DebugBear post-deploy measurement remains the next goal step after merge; this branch proves the architectural payload cut locally.

---

## Current Evidence

- Live production commit measured: `5687e8dfc4`.
- PSI mobile home: Performance `95`, LCP `2.9 s`, FCP `1.5 s`, TBT `30 ms`, CLS `0.001`.
- PSI mobile PDP: Performance `84`, LCP `4.1 s`, FCP `1.5 s`, TBT `130 ms`, CLS `0`.
- DebugBear mobile home quick test: LCP `2418 ms`, TBT `419 ms`, CLS `0.194`; CrUX URL p75 LCP `5202 ms`.
- DebugBear mobile PDP quick test: LCP `3083 ms`, TBT `979 ms`, CLS `0.065`; CrUX origin p75 LCP `4933 ms`.
- PSI says LCP image discovery is already good: eager loading, request discoverable in the initial document, and `fetchpriority=high`.
- The remaining mobile blocker is CSS/render cost:
  - Home route CSS chunk `0v0gupm.9byzw.css`: `446098` raw body bytes, `~51489` declared/content-length bytes.
  - PDP route CSS chunk `0nbozyu212x7w.css`: `258171` raw body bytes, `~32944` declared/content-length bytes.
  - PDP CSS comes from `apps/web/src/app/(storefront)/storefront-pdp.css`, especially the broad `@source` ownership of `product-details-page` components and shared UI components.
- The streamed PDP HTML still carries `business_type: "fashion"` for OgaBassey even though the merchant entity is phones/laptops/gadgets. This is not the direct LCP cause, but it weakens source/entity clarity and should be corrected with the same architectural pass.

## Non-Goals

- Do not modify `apps/web/src/proxy.ts`.
- Do not change non-OgaBassey storefront templates.
- Do not redesign the PDP or home page visually.
- Do not remove Product JSON-LD, canonical metadata, crawlable summary copy, or semantic sections.
- Do not ship inert Add to cart or Buy controls. The critical CTA must call the existing cart store before the PR is mergeable.
- Do not hide crawlable PDP semantic sections behind `dynamic(..., { ssr: false })` or any other client-only island.
- Do not make homepage CSS isolation a Phase 1 blocking deliverable. This plan may guard home against regressions, but PDP direct-entry LCP is the release target.
- Do not use `vercel deploy --prod` without `--prebuilt`.
- Do not commit PSI, DebugBear, Supabase, SSH, or Vercel credentials.
- Do not add manual `React.memo`, `useCallback`, or `useMemo`.

## Target Acceptance

### Phase 1 PDP Acceptance

- Mobile PDP PSI LCP `< 2500 ms` on the canonical OgaBassey PDP `https://ogabassey.com/laptops/dell-alienware-m18-r3-rtx-5080`.
- DebugBear mobile PDP LCP `< 2500 ms` and TBT `< 300 ms` on at least one post-deploy quick test.
- PDP initial route CSS budget:
  - No CSS chunk over `75000` raw bytes in the direct PDP initial HTML.
  - Total direct PDP initial CSS raw body bytes under `110000`.
  - Declared/content-length bytes are recorded for evidence but are not used as the pass/fail guard because they are not a reliable transfer-byte measurement across all servers.
- PDP direct HTML still has one visible H1, product image, price, availability/condition signal, CTA path, canonical URL, OpenGraph product image, Product JSON-LD, and crawlable semantic product content for the same product entity.
- Above-fold Add to cart works through the existing `useCart()` store without importing `ProductDetailsPage`, `ProductInteractionPanel`, `ProductCartActions`, or `ui/*` into the critical commerce island.
- OgaBassey merchant entity no longer serializes as `business_type: "fashion"` on public OgaBassey storefront HTML.

### Home Guardrails Only

- Mobile home PSI/DebugBear are re-measured and documented, but home LCP `< 2500 ms` is not a blocking acceptance criterion for this PDP-first plan.
- The home page must not regress into blank hero/product images, duplicate visible H1s, or stale "fashion and style" language.
- If home CSS still loads `storefront-full.css`, record it as a Phase 2 follow-up instead of blocking this PDP architectural fix.

---

## File Structure

### Create

- `apps/web/src/components/storefront/ogabassey/pdp/critical-commerce.tsx`
  - Server/client boundary wrapper for above-fold PDP purchase controls that does not import `ProductDetailsPage`.
- `apps/web/src/components/storefront/ogabassey/pdp/critical-commerce.client.tsx`
  - Minimal client island for quantity and real add-to-cart actions backed by the existing cart store.
- `apps/web/src/components/storefront/ogabassey/pdp/critical-commerce.module.css`
  - CSS Module for the critical purchase controls.
- `apps/web/src/components/storefront/ogabassey/pdp/critical-cart-product.ts`
  - Adapter from the full server `@/lib/products` product record to the smallest cart-compatible product shape required by `useCart().addToCart`, preserving default variant resolution data.
- `apps/web/src/components/storefront/ogabassey/pdp/critical-cart-product.test.ts`
  - Tests that the adapter provides safe defaults without forcing a full PDP data dependency into the first viewport.
- `apps/web/src/components/storefront/ogabassey/pdp/deferred-detail-island.tsx`
  - Server wrapper that keeps semantic sections in SSR HTML and mounts only non-critical interactive details after the first viewport.
- `apps/web/src/components/storefront/ogabassey/pdp/deferred-detail-island.client.tsx`
  - Viewport/idle-gated client-only below-fold interactive details and widgets. It must not receive `semanticSections`.
- `apps/web/src/components/storefront/ogabassey/pdp/deferred-detail-island.client.test.tsx`
  - Regression tests proving `ProductDetailsPage` is not rendered while viewport activation is inactive and only mounts after activation.
- `apps/web/src/lib/storefront/ogabassey-entity.ts`
  - OgaBassey merchant entity normalization and central business-type override.
- `apps/web/src/lib/storefront/ogabassey-entity.test.ts`
  - Tests that OgaBassey resolves to electronics/gadgets, not fashion.
- `apps/web/tools/perf/measure-ogabassey-critical-path.mjs`
  - Runs PSI and DebugBear for home plus canonical PDPs, stores raw JSON under `output/audits/`, and prints a compact table.
- `apps/web/tools/perf/assert-ogabassey-css-budget.mjs`
  - Fetches live or local HTML, follows CSS links, checks raw CSS budgets, and records declared/content-length bytes as evidence only.
- `apps/web/tools/perf/assert-ogabassey-css-budget.test.mjs`
  - Unit tests for HTML/CSS budget parsing.

### Modify

- `apps/web/src/app/(storefront)/storefront-pdp.css`
  - Ratchet broad Tailwind source ownership only after each still-rendered PDP component has CSS Module coverage, a narrow file-level `@source`, or is proven absent from the full direct PDP route.
- `apps/web/src/app/(storefront)/storefront-full.css`
  - No Phase 1 changes unless a PDP direct entry still imports it unexpectedly.
- `apps/web/src/app/(storefront)/ogabassey/page.tsx`
  - No Phase 1 changes; only verify home guardrails.
- `apps/web/src/app/(storefront)/ogabassey.com/page.tsx`
  - No Phase 1 changes; only verify home guardrails.
- `apps/web/src/app/(storefront)/[slug]/(home)/page.tsx`
  - No Phase 1 changes; homepage CSS isolation belongs in a separate follow-up plan.
- `apps/web/src/app/(storefront)/[slug]/(catalog)/(pdp)/[category]/[productSlug]/page.tsx`
  - Replace `OgabasseyPdpCommerceIsland` usage with `OgabasseyPdpCriticalCommerce`.
- `apps/web/src/components/storefront/ogabassey/pdp/client-islands.tsx`
  - Keep only deferred/non-critical islands after critical commerce split.
- `apps/web/src/components/storefront/ogabassey/pdp/critical-shell.tsx`
  - Reserve stable mobile/desktop CTA space, expose data attributes for budget/browser checks, and avoid dependencies that pull Tailwind into the first viewport.
- `apps/web/src/components/storefront/ogabassey/pdp/critical-shell.module.css`
  - Tighten mobile first viewport spacing and avoid below-fold padding that increases the LCP candidate area.
- `apps/web/src/components/storefront/ogabassey/pages/product-details-page.tsx`
  - Remove `mode="commerce"` after `critical-commerce.client.tsx` takes over above-fold controls.
- `apps/web/src/components/storefront/ogabassey/pages/product-details-page/*`
  - Convert below-fold styles to CSS Modules or keep narrow file-level Tailwind ownership for any files still rendered after deferred activation.
- `apps/web/src/components/storefront/ogabassey/pages/product-details-page/product-interaction-panel.tsx`
  - Either delete if unused or keep for legacy full mode only; it must not be imported by the OgaBassey PDP critical path.
- `apps/web/src/app/(storefront)/[slug]/(catalog)/(pdp)/[category]/[productSlug]/page.test.tsx`
  - Assert critical commerce renders before deferred details, semantic content remains server-rendered, and `ProductDetailsPage` is not used for OgaBassey above-fold commerce.
- `apps/web/src/components/storefront/ogabassey/pdp/critical-shell.test.tsx`
  - Add stable first viewport and no-duplicate-commerce assertions.
- `apps/web/src/components/storefront/ogabassey/pdp/client-islands.test.tsx`
  - Adjust tests after commerce mode moves out.
- `apps/web/package.json`
  - Add scripts:
    - `"perf:ogabassey-critical-path": "node tools/perf/measure-ogabassey-critical-path.mjs"`
    - `"perf:ogabassey-css-budget": "node tools/perf/assert-ogabassey-css-budget.mjs"`
- `docs/audits/2026-05-13-storefront-lcp-baseline.md`
  - Add rows for pre-change and post-change measurements without changing the existing table columns.

---

## Task 1: Prepare Isolated Worktree And Baseline

**Files:**
- No source changes.

- [ ] **Step 1: Create and enter a clean worktree from `origin/main`**

```bash
git fetch origin main
git worktree add /Users/mac/Baci-app-ogabassey-critical-css origin/main
cd /Users/mac/Baci-app-ogabassey-critical-css
git checkout -b codex/ogabassey-critical-css-architecture
```

Expected:

```text
HEAD is now at <sha> <latest main commit>
Switched to a new branch 'codex/ogabassey-critical-css-architecture'
```

- [ ] **Step 2: Confirm no inherited dirty files**

```bash
git status --short --branch
```

Expected:

```text
## codex/ogabassey-critical-css-architecture
```

- [ ] **Step 3: Copy the current measurement artifacts into the audit row notes**

Use these current artifacts as the pre-change baseline:

```text
/Users/mac/Baci-app/output/audits/2026-05-27T19-54-33-584Z-ogabassey-current-psi.json
/Users/mac/Baci-app/output/audits/2026-05-27T19-58-31-893Z-ogabassey-pdp-psi.json
/Users/mac/Baci-app/output/audits/2026-05-27T20-02-39-455Z-debugbear-quicktests-results.json
/Users/mac/Baci-app/output/audits/2026-05-27T20-03-02-780Z-debugbear-lhr-waterfall.json
```

Do not move these files into git. Reference their summarized numbers in the audit document only.

---

## Task 2: Add A CSS Budget Guard Before Changing Rendering

**Files:**
- Create: `apps/web/tools/perf/assert-ogabassey-css-budget.mjs`
- Create: `apps/web/tools/perf/assert-ogabassey-css-budget.test.mjs`
- Modify: `apps/web/package.json`

- [ ] **Step 1: Add the parser/budget script**

Create `apps/web/tools/perf/assert-ogabassey-css-budget.mjs`:

```js
import { strict as assert } from 'node:assert';

export function extractStylesheetUrls(html, baseUrl) {
  return [...html.matchAll(/<link\s+[^>]*rel=["']stylesheet["'][^>]*>/gi)]
    .map((match) => match[0].match(/\shref=["']([^"']+)["']/i)?.[1])
    .filter(Boolean)
    .map((href) => new URL(href, baseUrl).toString());
}

export async function fetchCssBudget(url, limits) {
  const htmlResponse = await fetch(url, { redirect: 'follow' });
  assert.equal(htmlResponse.ok, true, `Failed to fetch ${url}`);
  const html = await htmlResponse.text();
  const stylesheets = extractStylesheetUrls(html, url);
  const css = [];

  for (const href of stylesheets) {
    const response = await fetch(href);
    assert.equal(response.ok, true, `Failed to fetch CSS ${href}`);
    const body = await response.arrayBuffer();
    css.push({
      href,
      rawBytes: body.byteLength,
      declaredBytes:
        Number(response.headers.get('content-length')) || body.byteLength,
    });
  }

  const largestRawBytes = Math.max(0, ...css.map((item) => item.rawBytes));
  const totalRawBytes = css.reduce(
    (total, item) => total + item.rawBytes,
    0
  );
  const totalDeclaredBytes = css.reduce(
    (total, item) => total + item.declaredBytes,
    0
  );

  return {
    css,
    largestRawBytes,
    passed:
      largestRawBytes <= limits.maxSingleRawBytes &&
      totalRawBytes <= limits.maxTotalRawBytes,
    totalDeclaredBytes,
    totalRawBytes,
    url,
  };
}

const routeBudgets = [
  {
    enforce: false,
    label: 'home',
    url: process.env.OGABASSEY_HOME_URL || 'https://ogabassey.com/',
    limits: {
      maxSingleRawBytes: 150000,
      maxTotalRawBytes: 350000,
    },
  },
  {
    enforce: true,
    label: 'pdp',
    url:
      process.env.OGABASSEY_PDP_URL ||
      'https://ogabassey.com/laptops/dell-alienware-m18-r3-rtx-5080',
    limits: {
      maxSingleRawBytes: 75000,
      maxTotalRawBytes: 110000,
    },
  },
];

if (import.meta.url === `file://${process.argv[1]}`) {
  const results = [];
  for (const route of routeBudgets) {
    const result = await fetchCssBudget(route.url, route.limits);
    results.push({
      enforce: route.enforce,
      label: route.label,
      ...result,
      limits: route.limits,
    });
  }

  console.log(JSON.stringify(results, null, 2));
  const failed = results.filter((result) => result.enforce && !result.passed);
  if (failed.length > 0) {
    throw new Error(
      `OgaBassey CSS budget failed for ${failed
        .map((result) => result.label)
        .join(', ')}`
    );
  }
}
```

- [ ] **Step 2: Add parser tests**

Create `apps/web/tools/perf/assert-ogabassey-css-budget.test.mjs`:

```js
import { describe, expect, it } from 'vitest';
import { extractStylesheetUrls } from './assert-ogabassey-css-budget.mjs';

describe('extractStylesheetUrls', () => {
  it('returns absolute URLs for route stylesheet links only', () => {
    const html = `
      <link rel="stylesheet" href="/_next/static/chunks/core.css">
      <link rel="preload" href="/_next/static/chunks/later.css" as="style">
      <link href="https://cdn.example.com/app.css" rel="stylesheet">
    `;

    expect(extractStylesheetUrls(html, 'https://ogabassey.com/path')).toEqual([
      'https://ogabassey.com/_next/static/chunks/core.css',
      'https://cdn.example.com/app.css',
    ]);
  });
});
```

- [ ] **Step 3: Wire scripts**

Modify `apps/web/package.json`:

```json
{
  "scripts": {
    "perf:ogabassey-css-budget": "node tools/perf/assert-ogabassey-css-budget.mjs"
  }
}
```

Preserve existing scripts and add only this key if it is missing.

- [ ] **Step 4: Verify the budget guard fails on current production**

```bash
pnpm --dir apps/web test tools/perf/assert-ogabassey-css-budget.test.mjs
pnpm --dir apps/web perf:ogabassey-css-budget
```

Expected:

```text
PASS tools/perf/assert-ogabassey-css-budget.test.mjs
Error: OgaBassey CSS budget failed for pdp
```

This failure is expected before the architectural fix. Home is still printed for visibility, but Phase 1 only fails the PDP budget.

---

## Task 3: Split PDP Above-Fold Commerce Out Of `ProductDetailsPage`

**Files:**
- Create: `apps/web/src/components/storefront/ogabassey/pdp/critical-commerce.tsx`
- Create: `apps/web/src/components/storefront/ogabassey/pdp/critical-commerce.client.tsx`
- Create: `apps/web/src/components/storefront/ogabassey/pdp/critical-commerce.module.css`
- Create: `apps/web/src/components/storefront/ogabassey/pdp/critical-cart-product.ts`
- Create: `apps/web/src/components/storefront/ogabassey/pdp/critical-cart-product.test.ts`
- Create: `apps/web/src/components/storefront/ogabassey/pdp/critical-commerce.test.tsx`
- Modify: `apps/web/src/app/(storefront)/[slug]/(catalog)/(pdp)/[category]/[productSlug]/page.tsx`
- Modify: `apps/web/src/components/storefront/ogabassey/pdp/client-islands.tsx`
- Modify: `apps/web/src/app/(storefront)/[slug]/(catalog)/(pdp)/[category]/[productSlug]/page.test.tsx`

- [ ] **Step 1: Write the critical cart adapter test**

Create `apps/web/src/components/storefront/ogabassey/pdp/critical-cart-product.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import type { Product as CartProduct } from '@/lib/products';
import { createCriticalCartProduct } from './critical-cart-product';

describe('createCriticalCartProduct', () => {
  it('creates a cart-compatible product from the server PDP product', () => {
    const sourceProduct = {
      brand: 'Dell',
      category: 'Laptops',
      category_slug: 'laptops',
      condition: 'used',
      description: '<p>Gaming laptop</p>',
      gtin: '',
      id: 'product-1',
      image: 'https://cdn.ogabassey.com/alienware.avif',
      imageHint: 'Dell Alienware laptop',
      imageLarge: 'https://cdn.ogabassey.com/alienware-large.avif',
      manage_stock: true,
      mpn: 'AW-M18-R3',
      name: 'Dell Alienware m18 R3 (RTX 5080)',
      price: 7098000,
      slug: 'dell-alienware-m18-r3-rtx-5080',
      status: 'active',
      stock: 4,
    } satisfies CartProduct;
    const cartProduct = createCriticalCartProduct(sourceProduct);

    expect(cartProduct).toMatchObject({
      brand: 'Dell',
      category: 'Laptops',
      category_slug: 'laptops',
      condition: 'used',
      description: '<p>Gaming laptop</p>',
      id: 'product-1',
      image: 'https://cdn.ogabassey.com/alienware.avif',
      imageLarge: 'https://cdn.ogabassey.com/alienware-large.avif',
      manage_stock: true,
      price: 7098000,
      slug: 'dell-alienware-m18-r3-rtx-5080',
      status: 'active',
      stock: 4,
    });
  });

  it('preserves variant data so addToCart can resolve a default variant', () => {
    const cartProduct = createCriticalCartProduct({
      brand: 'Lenovo',
      description: 'Lenovo Legion Pro 9',
      gtin: '',
      has_variants: true,
      id: 'product-2',
      image: 'https://cdn.ogabassey.com/legion.avif',
      imageHint: 'Lenovo Legion laptop',
      imageLarge: 'https://cdn.ogabassey.com/legion.avif',
      manage_stock: true,
      mpn: 'LEGION-PRO-9',
      name: 'Lenovo Legion Pro 9',
      price: 5985000,
      slug: 'lenovo-legion-pro-9',
      status: 'active',
      stock: 2,
      variants: [
        {
          attributes: { platform: 'EU', storage: '2TB' },
          condition: 'new',
          id: 'variant-1',
          merchant_id: 'merchant-1',
          product_id: 'product-2',
          stock_quantity: 2,
        },
      ],
    });

    expect(cartProduct.has_variants).toBe(true);
    expect(cartProduct.variants?.[0]).toMatchObject({
      id: 'variant-1',
      attributes: { platform: 'EU', storage: '2TB' },
    });
  });
});
```

- [ ] **Step 2: Implement the critical cart adapter**

Create `apps/web/src/components/storefront/ogabassey/pdp/critical-cart-product.ts`:

```ts
import type {
  Product as CartProduct,
  ProductCondition,
} from '@/lib/products';

const VALID_CART_CONDITIONS = new Set<ProductCondition>([
  'new',
  'used',
  'open_box',
  'refurbished',
]);

type CriticalCartSource = Pick<
  CartProduct,
  | 'available_conditions'
  | 'brand'
  | 'category'
  | 'category_slug'
  | 'compare_at_price'
  | 'condition'
  | 'default_variant_id'
  | 'description'
  | 'gtin'
  | 'has_variants'
  | 'id'
  | 'image'
  | 'imageHint'
  | 'imageLarge'
  | 'manage_stock'
  | 'mpn'
  | 'name'
  | 'offers'
  | 'price'
  | 'slug'
  | 'status'
  | 'stock'
  | 'variants'
>;

function normalizeCartCondition(
  condition: ProductCondition | string | null | undefined
): ProductCondition | undefined {
  if (!condition) return undefined;
  return VALID_CART_CONDITIONS.has(condition as ProductCondition)
    ? (condition as ProductCondition)
    : undefined;
}

export function createCriticalCartProduct(
  product: CriticalCartSource
): CartProduct {
  const condition = normalizeCartCondition(product.condition);

  return {
    available_conditions: product.available_conditions,
    brand: product.brand || 'OgaBassey',
    category: product.category,
    category_slug: product.category_slug,
    compare_at_price: product.compare_at_price,
    condition,
    default_variant_id: product.default_variant_id,
    description: product.description || product.name,
    gtin: product.gtin || '',
    has_variants: product.has_variants,
    id: product.id,
    image: product.image,
    imageHint: product.imageHint || product.name,
    imageLarge: product.imageLarge || product.image,
    manage_stock: product.manage_stock ?? true,
    mpn: product.mpn || product.slug || product.id,
    name: product.name,
    offers: product.offers,
    price: product.price,
    slug: product.slug,
    status: product.status,
    stock: Math.max(0, product.stock || 0),
    variants: product.variants,
  };
}
```

- [ ] **Step 3: Write the critical-commerce behavior tests**

Create `apps/web/src/components/storefront/ogabassey/pdp/critical-commerce.test.tsx` with tests that assert:

```tsx
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { Product as CartProduct } from '@/lib/products';
import { OgabasseyPdpCriticalCommerceClient } from './critical-commerce.client';
import { OgabasseyPdpCriticalCommerce } from './critical-commerce';

const cartMocks = vi.hoisted(() => ({
  addToCart: vi.fn(),
  setIsCartOpen: vi.fn(),
}));

vi.mock('@/hooks/cart', () => ({
  useCart: () => ({
    addToCart: cartMocks.addToCart,
    setIsCartOpen: cartMocks.setIsCartOpen,
  }),
}));

const product = {
  brand: 'Dell',
  categoryName: 'Laptops',
  categorySlug: 'laptops',
  condition: 'used' as const,
  id: 'product-1',
  image: 'https://cdn.ogabassey.com/alienware.avif',
  name: 'Dell Alienware m18 R3 (RTX 5080)',
  price: 7098000,
  slug: 'dell-alienware-m18-r3-rtx-5080',
  stockQuantity: 4,
  variantCount: 1,
};

const cartProduct: CartProduct = {
  brand: 'Dell',
  description: 'Dell Alienware m18 R3 (RTX 5080)',
  gtin: '',
  id: 'product-1',
  image: 'https://cdn.ogabassey.com/alienware.avif',
  imageHint: 'Dell Alienware m18 R3 (RTX 5080)',
  imageLarge: 'https://cdn.ogabassey.com/alienware.avif',
  manage_stock: true,
  mpn: 'dell-alienware-m18-r3-rtx-5080',
  name: 'Dell Alienware m18 R3 (RTX 5080)',
  price: 7098000,
  status: 'active',
  stock: 4,
};

describe('OgabasseyPdpCriticalCommerce', () => {
  it('renders static commerce facts before the client controls hydrate', () => {
    render(
      <OgabasseyPdpCriticalCommerce
        cartHref="/cart"
        cartProduct={cartProduct}
        product={product}
      />
    );

    expect(screen.getByText('Ready to buy')).toBeInTheDocument();
    expect(screen.getByText('Used')).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /add to cart/i })
    ).toBeInTheDocument();
  });
});

describe('OgabasseyPdpCriticalCommerceClient', () => {
  it('adds the selected quantity to the existing cart store', () => {
    render(
      <OgabasseyPdpCriticalCommerceClient
        cartHref="/cart"
        cartProduct={cartProduct}
        condition="used"
        productName={cartProduct.name}
        variantCount={1}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: /increase quantity/i }));
    fireEvent.click(screen.getByRole('button', { name: /add to cart/i }));

    expect(cartMocks.addToCart).toHaveBeenCalledWith(cartProduct, 2, {
      condition: 'used',
    });
    expect(cartMocks.setIsCartOpen).toHaveBeenCalledWith(true);
  });
});
```

- [ ] **Step 4: Implement the server wrapper**

Create `apps/web/src/components/storefront/ogabassey/pdp/critical-commerce.tsx`:

```tsx
import type { Route } from 'next';
import type { Product as CartProduct } from '@/lib/products';
import type { OgabasseyPdpCriticalProduct } from './critical-product';
import { OgabasseyPdpCriticalCommerceClient } from './critical-commerce.client';
import styles from './critical-commerce.module.css';

interface OgabasseyPdpCriticalCommerceProps {
  cartHref: Route;
  cartProduct: CartProduct;
  product: Pick<
    OgabasseyPdpCriticalProduct,
    | 'brand'
    | 'categoryName'
    | 'categorySlug'
    | 'condition'
    | 'id'
    | 'image'
    | 'name'
    | 'price'
    | 'slug'
    | 'stockQuantity'
  > & {
    variantCount?: number;
  };
}

function formatCondition(condition: string) {
  return condition.charAt(0).toUpperCase() + condition.slice(1);
}

export function OgabasseyPdpCriticalCommerce({
  cartHref,
  cartProduct,
  product,
}: OgabasseyPdpCriticalCommerceProps) {
  return (
    <aside className={styles.panel} aria-label="Purchase options">
      <div className={styles.facts}>
        <p className={styles.eyebrow}>Ready to buy</p>
        <p className={styles.fact}>
          <span>Condition</span>
          <strong>{formatCondition(product.condition)}</strong>
        </p>
        <p className={styles.fact}>
          <span>Delivery</span>
          <strong>Lagos and nationwide</strong>
        </p>
      </div>
      <OgabasseyPdpCriticalCommerceClient
        cartHref={cartHref}
        cartProduct={cartProduct}
        condition={cartProduct.condition}
        productName={product.name}
        variantCount={product.variantCount || 0}
      />
    </aside>
  );
}
```

- [ ] **Step 5: Implement the real cart client island without importing `ProductDetailsPage`**

Create `apps/web/src/components/storefront/ogabassey/pdp/critical-commerce.client.tsx`:

```tsx
'use client';

import Link from 'next/link';
import type { Route } from 'next';
import { useState } from 'react';
import { useCart } from '@/hooks/cart';
import type {
  Product as CartProduct,
  ProductCondition,
} from '@/lib/products';
import styles from './critical-commerce.module.css';

interface OgabasseyPdpCriticalCommerceClientProps {
  cartHref: Route;
  cartProduct: CartProduct;
  condition?: ProductCondition;
  productName: string;
  variantCount: number;
}

export function OgabasseyPdpCriticalCommerceClient({
  cartHref,
  cartProduct,
  condition,
  productName,
  variantCount,
}: OgabasseyPdpCriticalCommerceClientProps) {
  const [quantity, setQuantity] = useState(1);
  const { addToCart, setIsCartOpen } = useCart();

  function handleAddToCart() {
    addToCart(cartProduct, quantity, { condition });
    setIsCartOpen(true);
  }

  return (
    <div className={styles.controls}>
      {variantCount > 1 ? (
        <p className={styles.selectionHint}>Choose options below before checkout.</p>
      ) : null}
      <div className={styles.quantity} aria-label="Quantity">
        <button
          aria-label={`Decrease quantity for ${productName}`}
          disabled={quantity <= 1}
          onClick={() => setQuantity((current) => Math.max(1, current - 1))}
          type="button"
        >
          -
        </button>
        <output aria-live="polite">{quantity}</output>
        <button
          aria-label={`Increase quantity for ${productName}`}
          onClick={() => setQuantity((current) => current + 1)}
          type="button"
        >
          +
        </button>
      </div>
      <button
        className={styles.primaryAction}
        onClick={handleAddToCart}
        type="button"
      >
        Add to cart
      </button>
      <Link className={styles.secondaryAction} href={cartHref}>
        View cart
      </Link>
    </div>
  );
}
```

Do not proceed if this control is inert. Import `useCart` from the narrow `@/hooks/cart` context export, not from `@/hooks/use-cart`; if bundle analysis still shows an unacceptable graph in the critical island, extract a narrower cart action module in this same task and keep the public `addToCart(product, quantity, options)` behavior identical.

- [ ] **Step 6: Add the CSS Module**

Create `apps/web/src/components/storefront/ogabassey/pdp/critical-commerce.module.css`:

```css
.panel {
  background: #ffffff;
  border: 1px solid color-mix(in srgb, var(--store-background-text, #111827) 10%, transparent);
  border-radius: 1rem;
  box-shadow: 0 18px 45px rgba(15, 23, 42, 0.08);
  display: grid;
  gap: 1rem;
  padding: 1rem;
}

.facts {
  display: grid;
  gap: 0.75rem;
}

.eyebrow {
  color: var(--store-primary, #d62027);
  font-size: 0.75rem;
  font-weight: 800;
  letter-spacing: 0.08em;
  margin: 0;
  text-transform: uppercase;
}

.fact {
  align-items: center;
  display: flex;
  justify-content: space-between;
  margin: 0;
}

.fact span {
  color: color-mix(in srgb, var(--store-background-text, #111827) 62%, transparent);
  font-size: 0.875rem;
}

.fact strong {
  color: var(--store-background-text, #111827);
  font-size: 0.875rem;
}

.controls {
  display: grid;
  gap: 0.75rem;
}

.selectionHint {
  color: color-mix(in srgb, var(--store-background-text, #111827) 70%, transparent);
  font-size: 0.875rem;
  margin: 0;
}

.quantity {
  align-items: center;
  border: 1px solid color-mix(in srgb, var(--store-background-text, #111827) 12%, transparent);
  border-radius: 999px;
  display: grid;
  grid-template-columns: 2.75rem 1fr 2.75rem;
  min-height: 3rem;
  overflow: hidden;
}

.quantity button {
  background: transparent;
  border: 0;
  color: var(--store-background-text, #111827);
  font-size: 1.25rem;
  min-height: 3rem;
}

.quantity output {
  font-weight: 800;
  text-align: center;
}

.primaryAction,
.secondaryAction {
  align-items: center;
  border-radius: 999px;
  display: inline-flex;
  font-weight: 800;
  justify-content: center;
  min-height: 3rem;
  text-decoration: none;
}

.primaryAction {
  background: var(--store-primary, #d62027);
  border: 0;
  color: var(--store-on-primary, #ffffff);
}

.secondaryAction {
  border: 1px solid color-mix(in srgb, var(--store-primary, #d62027) 30%, transparent);
  color: var(--store-primary, #d62027);
}
```

- [ ] **Step 7: Replace the critical PDP commerce import**

In `apps/web/src/app/(storefront)/[slug]/(catalog)/(pdp)/[category]/[productSlug]/page.tsx`, replace the OgaBassey critical shell children:

```tsx
<Suspense fallback={null}>
  <CategoryProductPageCommerceControls
    slug={slug}
    searchParams={Promise.resolve(resolvedSearchParams)}
    productResultPromise={productResultPromise}
  />
</Suspense>
```

with:

```tsx
const ogabasseyBasePath =
  process.env.NODE_ENV === 'development' ? `/${slug}` : '';

<OgabasseyPdpCriticalCommerce
  cartHref={asRoute(`${ogabasseyBasePath}/cart`)}
  cartProduct={createCriticalCartProduct(product)}
  product={criticalProduct}
/>
```

Import `asRoute` from `@/lib/routes`, `OgabasseyPdpCriticalCommerce` from `@/components/storefront/ogabassey/pdp/critical-commerce`, and `createCriticalCartProduct` from `@/components/storefront/ogabassey/pdp/critical-cart-product`.

- [ ] **Step 8: Keep full controls below the fold only**

Move `CategoryProductPageCommerceControls` usage to the deferred/below-fold content if it is still needed for advanced variants, negotiation, and complete interaction parity. The critical shell must not import `ProductDetailsPage`, `ProductInteractionPanel`, `ProductOptionSelectors`, `ProductCartActions`, or shared `ui/*` components.

- [ ] **Step 9: Run focused tests**

```bash
pnpm --dir apps/web test src/components/storefront/ogabassey/pdp/critical-cart-product.test.ts
pnpm --dir apps/web test src/components/storefront/ogabassey/pdp/critical-commerce.test.tsx
pnpm --dir apps/web test 'src/app/(storefront)/[slug]/(catalog)/(pdp)/[category]/[productSlug]/page.test.tsx'
```

Expected: all three test files pass.

---

## Task 4: Ratchet `storefront-pdp.css` Source Ownership Safely

**Files:**
- Modify: `apps/web/src/app/(storefront)/storefront-pdp.css`
- Modify: `apps/web/src/app/(storefront)/[slug]/(catalog)/(pdp)/[category]/[productSlug]/page.test.tsx`
- Modify: `apps/web/tools/perf/assert-ogabassey-css-budget.mjs`

- [ ] **Step 1: Check current source ownership before removing anything**

Run:

```bash
sed -n '1,80p' 'apps/web/src/app/(storefront)/storefront-pdp.css'
pnpm --dir apps/web build
pnpm --dir apps/web perf:ogabassey-css-budget
```

Expected before removal: PDP still fails the CSS budget because `product-details-page` and shared `ui/*` sources are still part of the PDP stylesheet.

- [ ] **Step 2: Remove only sources that have replacement style ownership**

In `apps/web/src/app/(storefront)/storefront-pdp.css`, remove each candidate only after Task 3 and Task 5 prove one of these is true:

- the component is not used on any OgaBassey PDP path after the split;
- the component has been converted to CSS Modules;
- the component is below-fold/deferred and has a narrow file-level `@source` entry instead of the broad directory glob.

Do not treat "not required by first paint" as enough evidence. The deferred detail island still mounts below-fold PDP UI after viewport/timeout activation, so styles for those components must remain owned somewhere.

Initial candidates to remove or replace:

```css
@source "../../components/storefront/ogabassey/pages/product-details-page.tsx";
@source "../../components/storefront/ogabassey/pages/product-details-page";
@source "../../components/storefront/ogabassey/pages/product-details-page/**/*.tsx";
@source "../../components/storefront/ogabassey/components/AdUnit.tsx";
@source "../../components/storefront/ogabassey/components/BannerCarousel.tsx";
@source "../../components/storefront/ogabassey/components/FlyToCartAnimation.tsx";
@source "../../components/storefront/ogabassey/components/NegotiationModal.tsx";
@source "../../components/ui/button.tsx";
@source "../../components/ui/dialog.tsx";
@source "../../components/ui/input.tsx";
@source "../../components/ui/sheet.tsx";
@source "../../components/ui/tabs.tsx";
@source "../../components/ui/tooltip.tsx";
```

Keep these OgaBassey PDP sources until the owning components are converted to CSS Modules:

```css
@source "./[slug]/layout.tsx";
@source "./[slug]/(catalog)/(pdp)";
@source "../../components/storefront/ogabassey/pdp";
@source "../../components/storefront/ogabassey/pdp/**/*.tsx";
```

Do not add React/component tests that read CSS files with `fs.readFileSync`. This ratchet is guarded by the CSS budget tool and route behavior tests, not by component tests that assert implementation details.

- [ ] **Step 3: Verify build CSS size after each removal batch**

```bash
pnpm --dir apps/web build
find apps/web/.next/static/chunks -name '*.css' -exec wc -c {} + | sort -nr | head -20
```

In another terminal, start the production server:

```bash
pnpm --dir apps/web start
```

Then check the local route budget against that build:

```bash
OGABASSEY_PDP_URL=http://localhost:3000/ogabassey/laptops/dell-alienware-m18-r3-rtx-5080 \
pnpm --dir apps/web perf:ogabassey-css-budget
```

Expected: the PDP-specific CSS chunk associated with `storefront-pdp.css` is no longer near `258171` raw bytes. Target: `< 75000` raw bytes.

- [ ] **Step 4: If below-fold PDP styles break, stop and restore ownership before removing more sources**

If Playwright/Chrome shows unstyled below-fold PDP widgets after a source removal, restore that specific ownership before continuing. Do not blindly remove all `product-details-page` sources while `ProductDetailsPage` still renders after deferred activation. The acceptable end state is either CSS Module ownership for below-fold PDP details or narrow `@source` lines for the exact deferred files still used.

---

## Task 5: Defer PDP Detail And Widget Runtime Work

**Files:**
- Create: `apps/web/src/components/storefront/ogabassey/pdp/deferred-detail-island.tsx`
- Create: `apps/web/src/components/storefront/ogabassey/pdp/deferred-detail-island.client.tsx`
- Create: `apps/web/src/components/storefront/ogabassey/pdp/deferred-detail-island.client.test.tsx`
- Modify: `apps/web/src/components/storefront/ogabassey/pdp/client-islands.tsx`
- Modify: `apps/web/src/components/storefront/ogabassey/pages/product-details-page.tsx`
- Modify: `apps/web/src/components/storefront/ogabassey/pages/product-details-page/deferred-product-details-sections-loader.tsx`
- Modify: `apps/web/src/components/storefront/ogabassey/pdp/client-islands.test.tsx`
- Modify: `apps/web/src/app/(storefront)/[slug]/(catalog)/(pdp)/[category]/[productSlug]/page.test.tsx`
- Modify: `apps/web/src/app/(storefront)/[slug]/(catalog)/(pdp)/[category]/[productSlug]/ogabassey-pdp-semantic-sections.test.tsx`

- [ ] **Step 1: Create a server semantic wrapper**

Create `apps/web/src/components/storefront/ogabassey/pdp/deferred-detail-island.tsx`:

```tsx
import type { ReactNode } from 'react';
import type { Product } from '@/components/storefront/ogabassey/types';
import { OgabasseyPdpDeferredDetailClient } from './deferred-detail-island.client';

interface OgabasseyPdpDeferredDetailIslandProps {
  product: Product;
  semanticSections?: ReactNode;
}

export function OgabasseyPdpDeferredDetailIsland({
  product,
  semanticSections = null,
}: OgabasseyPdpDeferredDetailIslandProps) {
  return (
    <section aria-label="Product details" data-ogabassey-pdp-semantics>
      {semanticSections}
      <OgabasseyPdpDeferredDetailClient product={product} />
    </section>
  );
}
```

- [ ] **Step 2: Create the client-only interactive details island**

Create `apps/web/src/components/storefront/ogabassey/pdp/deferred-detail-island.client.tsx`:

```tsx
'use client';

import dynamic from 'next/dynamic';
import type { Product } from '@/components/storefront/ogabassey/types';
import { useViewportActivation } from '@/components/storefront/use-viewport-activation';
import { DeferredDetailsSkeleton } from '@/components/storefront/ogabassey/pages/product-details-page/deferred-details-skeleton';

const ProductDetailsPage = dynamic(
  () =>
    import('@/components/storefront/ogabassey/pages/product-details-page').then(
      (mod) => mod.ProductDetailsPage
    ),
  {
    loading: () => null,
    ssr: false,
  }
);

interface OgabasseyPdpDeferredDetailClientProps {
  product: Product;
}

export function OgabasseyPdpDeferredDetailClient({
  product,
}: OgabasseyPdpDeferredDetailClientProps) {
  const { ref, isActive } = useViewportActivation<HTMLDivElement>({
    rootMargin: '400px 0px',
    timeoutMs: 1600,
  });

  return (
    <div ref={ref} data-ogabassey-pdp-deferred-detail-client>
      {isActive ? (
        <ProductDetailsPage mode="belowFold" product={product} />
      ) : (
        <DeferredDetailsSkeleton
          aria-busy={false}
          aria-label=""
          aria-live="off"
          role=""
        />
      )}
    </div>
  );
}
```

The `ssr: false` boundary is allowed only here because it no longer carries `semanticSections`, and the heavy `ProductDetailsPage` branch is not rendered until viewport/timeout activation. The semantic article, specs, FAQs, and crawlable summary must already be present in the server wrapper above.

- [ ] **Step 3: Replace `OgabasseyPdpBelowFoldIsland` implementation**

In `apps/web/src/components/storefront/ogabassey/pdp/client-islands.tsx`, export `OgabasseyPdpDeferredDetailIsland` for below-fold usage and remove direct above-fold commerce imports from `ProductDetailsPage`.

- [ ] **Step 4: Add deferred activation tests**

Create `apps/web/src/components/storefront/ogabassey/pdp/deferred-detail-island.client.test.tsx` and mock `useViewportActivation` plus `next/dynamic`. Assert:

```tsx
it('does not render ProductDetailsPage before viewport activation', () => {
  mockUseViewportActivation.mockReturnValue({
    ref: { current: null },
    isActive: false,
  });

  render(<OgabasseyPdpDeferredDetailClient product={product} />);

  expect(mockProductDetailsPage).not.toHaveBeenCalled();
  expect(screen.getByTestId('deferred-product-details-placeholder')).toBeInTheDocument();
});

it('renders below-fold ProductDetailsPage after viewport activation', () => {
  mockUseViewportActivation.mockReturnValue({
    ref: { current: null },
    isActive: true,
  });

  render(<OgabasseyPdpDeferredDetailClient product={product} />);

  expect(mockProductDetailsPage).toHaveBeenCalledWith(
    expect.objectContaining({ mode: 'belowFold', product })
  );
});
```

- [ ] **Step 5: Add route tests for server-rendered semantic content**

In `apps/web/src/app/(storefront)/[slug]/(catalog)/(pdp)/[category]/[productSlug]/page.test.tsx`, assert the direct OgaBassey PDP HTML path renders semantic sections outside the client-only island:

```tsx
const semanticSection = screen.getByLabelText('Product details');

expect(semanticSection).toHaveAttribute(
  'data-ogabassey-pdp-semantics'
);
expect(semanticSection).toHaveTextContent(/Dell Alienware/i);
expect(semanticSection).toHaveTextContent(/spec/i);
```

- [ ] **Step 6: Make heavy PDP widgets interaction/visibility triggered**

In `ProductDetailsPage`, ensure these components are not imported by the critical commerce path:

```tsx
AdUnit
BannerCarousel
NegotiationModal
FlyToCartAnimation
SelectionRequiredModal
ProductMobileActionBar
DeferredProductDetailsSectionsLoader
```

The first viewport can expose static CTA controls. Advanced modals and animations can load only after interaction.

- [ ] **Step 7: Verify TBT improves in local Lighthouse/DebugBear after deploy**

Expected post-deploy DebugBear mobile PDP:

```text
performance.totalBlockingTime < 300
performance.largestContentfulPaint < 2500
```

---

## Task 6: Verify Home Guardrails Without Expanding Phase 1 Scope

**Files:**
- No Phase 1 source changes unless this guardrail reveals a direct regression caused by PDP work.

- [ ] **Step 1: Build and run the route locally**

```bash
pnpm --dir apps/web build
pnpm --dir apps/web start
```

- [ ] **Step 2: Verify homepage visual guardrails in Chrome/Playwright**

Check `https://ogabassey.com/` or the local production URL with a mobile viewport and desktop viewport:

- mobile hero image is visible;
- featured product images are visible;
- no "Best Sellers / Featured Products" blank image regression;
- no duplicate visible H1;
- no "fashion and style" text appears for OgaBassey.

- [ ] **Step 3: Record home numbers as guardrail evidence only**

Run:

```bash
PAGESPEED_INSIGHTS_API_KEY="$(grep '^PAGESPEED_INSIGHTS_API_KEY=' .env.local | cut -d= -f2-)" \
DEBUGBEAR_PROJECT_ID=100906 \
DEBUGBEAR_API_KEY="$DEBUGBEAR_API_KEY" \
pnpm --dir apps/web perf:ogabassey-critical-path
```

Expected: the script prints home metrics, but it does not fail the Phase 1 run when home still loads `storefront-full.css`.

- [ ] **Step 4: Open a separate Phase 2 plan if home remains above target**

If home remains above `2500 ms`, create a separate plan for homepage critical CSS and product-grid image visibility. Do not add those source moves to this PDP PR unless the PDP branch itself caused the home regression.

---

## Task 7: Normalize OgaBassey Central Entity

**Files:**
- Create: `apps/web/src/lib/storefront/ogabassey-entity.ts`
- Create: `apps/web/src/lib/storefront/ogabassey-entity.test.ts`
- Modify: `apps/web/src/lib/cached-data.ts`
- Modify: `apps/web/src/app/(storefront)/[slug]/layout.tsx`
- Modify: `apps/web/src/app/(storefront)/[slug]/(catalog)/(pdp)/[category]/[productSlug]/page.tsx`
- Modify: `apps/web/src/app/(storefront)/ogabassey/ogabassey-home-page-content.tsx`

- [ ] **Step 1: Add central entity helper**

Create `apps/web/src/lib/storefront/ogabassey-entity.ts`:

```ts
export const OGABASSEY_ENTITY = {
  businessType: 'electronics',
  categories: ['phones', 'laptops', 'gaming', 'gadgets', 'accessories'],
  displayName: 'OgaBassey',
  topicalFocus:
    'phones, laptops, gaming devices, accessories, repairs, and flexible gadget payments in Nigeria',
} as const;

export function normalizeOgabasseyBusinessType(input: {
  custom_domain?: string | null;
  slug?: string | null;
  business_type?: string | null;
}): string {
  const isOgabassey =
    input.slug?.toLowerCase() === 'ogabassey' ||
    input.custom_domain?.toLowerCase() === 'ogabassey.com';

  return isOgabassey
    ? OGABASSEY_ENTITY.businessType
    : input.business_type?.trim() || 'general';
}
```

- [ ] **Step 2: Add tests**

Create `apps/web/src/lib/storefront/ogabassey-entity.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { normalizeOgabasseyBusinessType } from './ogabassey-entity';

describe('normalizeOgabasseyBusinessType', () => {
  it('normalizes OgaBassey away from stale fashion classification', () => {
    expect(
      normalizeOgabasseyBusinessType({
        slug: 'ogabassey',
        custom_domain: 'ogabassey.com',
        business_type: 'fashion',
      })
    ).toBe('electronics');
  });

  it('preserves non-OgaBassey merchant business type', () => {
    expect(
      normalizeOgabasseyBusinessType({
        slug: 'demo',
        custom_domain: 'demo.example',
        business_type: 'fashion',
      })
    ).toBe('fashion');
  });
});
```

- [ ] **Step 3: Apply helper at public merchant shell serialization**

Find the public storefront merchant normalization paths:

```bash
rg -n "business_type|businessType|shellSnapshot|StorefrontMerchantProvider|generateMetadata" apps/web/src/lib apps/web/src/app apps/web/src/components/storefront
```

Apply `normalizeOgabasseyBusinessType` only at request-scoped public serialization boundaries:

```ts
const publicBusinessType = normalizeOgabasseyBusinessType({
  business_type: merchant.business_type,
  custom_domain: merchant.custom_domain,
  slug: merchant.slug,
});
```

Concrete targets to inspect first:

```text
apps/web/src/lib/cached-data.ts
apps/web/src/app/(storefront)/[slug]/layout.tsx
apps/web/src/app/(storefront)/[slug]/(catalog)/(pdp)/[category]/[productSlug]/page.tsx
apps/web/src/app/(storefront)/ogabassey/ogabassey-home-page-content.tsx
```

Do not modify `apps/web/src/config/business-types.ts` for this fix. If the database row can be corrected safely through normal admin tooling, do that separately; this code path is still required as a public-render fallback for stale cached rows.

- [ ] **Step 4: Verify live HTML no longer leaks fashion for OgaBassey**

After deploy:

```bash
curl -sS https://ogabassey.com/laptops/dell-alienware-m18-r3-rtx-5080 | rg -i 'business_type|fashion|electronics|gadgets'
```

Expected: no `business_type":"fashion"` for OgaBassey.

---

## Task 8: Add Cluster Measurement Script

**Files:**
- Create: `apps/web/tools/perf/measure-ogabassey-critical-path.mjs`
- Modify: `apps/web/package.json`

- [ ] **Step 1: Create the measurement script**

The script must measure:

```js
const routeCandidates = [
  { label: 'home', url: 'https://ogabassey.com/' },
  {
    label: 'pdp-alienware',
    url: 'https://ogabassey.com/laptops/dell-alienware-m18-r3-rtx-5080',
  },
];
```

It must:

- read `PAGESPEED_INSIGHTS_API_KEY` from `.env.local`;
- read `DEBUGBEAR_API_KEY` and `DEBUGBEAR_PROJECT_ID` from env, not from source;
- resolve and verify canonical URLs before sending any PDP URL to PSI or DebugBear;
- fail before measurement if a PDP candidate returns non-2xx, redirects to an unrelated page, or has a canonical URL different from the final URL;
- write raw JSON to `output/audits/<timestamp>-ogabassey-critical-path/`;
- print a table with `source`, `route`, `strategy/device`, `perf`, `lcp`, `fcp`, `tbt`, `cls`.

Use this canonical resolver pattern before the measurement loop:

```js
export async function resolveCanonicalUrl(candidateUrl) {
  const response = await fetch(candidateUrl, { redirect: 'follow' });
  if (!response.ok) {
    throw new Error(`Cannot measure ${candidateUrl}: ${response.status}`);
  }

  const finalUrl = response.url;
  const html = await response.text();
  const candidatePath = new URL(candidateUrl).pathname;
  const finalPath = new URL(finalUrl).pathname;
  const canonicalTag = [...html.matchAll(/<link\b[^>]*>/gi)]
    .map((match) => match[0])
    .find((tag) => /\brel=["']canonical["']/i.test(tag));
  const canonicalHref = canonicalTag?.match(/\bhref=["']([^"']+)["']/i)?.[1];
  const canonicalUrl = canonicalHref
    ? new URL(canonicalHref, finalUrl).toString()
    : finalUrl;

  if (candidatePath !== '/' && candidatePath !== finalPath) {
    throw new Error(`Measure the final PDP URL directly: ${finalUrl}`);
  }

  if (candidatePath !== '/' && canonicalUrl !== finalUrl) {
    throw new Error(
      `Use canonical PDP URL for ${candidateUrl}: ${canonicalUrl}`
    );
  }

  return canonicalUrl;
}
```

Do not measure the previously suggested `/lenovo/lenovo-legion-pro-9-16irx9-rtx-4090` URL unless this resolver proves it is canonical. A redirected or non-canonical PDP can make PSI results noisy or fail the run for the wrong reason.

- [ ] **Step 2: Add package script**

Modify `apps/web/package.json`:

```json
{
  "scripts": {
    "perf:ogabassey-critical-path": "node tools/perf/measure-ogabassey-critical-path.mjs"
  }
}
```

- [ ] **Step 3: Run before deploy and after deploy**

```bash
PAGESPEED_INSIGHTS_API_KEY="$(grep '^PAGESPEED_INSIGHTS_API_KEY=' .env.local | cut -d= -f2-)" \
DEBUGBEAR_PROJECT_ID=100906 \
DEBUGBEAR_API_KEY="$DEBUGBEAR_API_KEY" \
pnpm --dir apps/web perf:ogabassey-critical-path
```

Expected: raw files under `apps/web/output/audits/` or repo `output/audits/`, depending on script cwd. Do not commit raw outputs.

---

## Task 9: Update Audit Tracking Without Table Corruption

**Files:**
- Modify: `docs/audits/2026-05-13-storefront-lcp-baseline.md`

- [ ] **Step 1: Preserve the existing table column shape**

Before editing:

```bash
sed -n '40,90p' docs/audits/2026-05-13-storefront-lcp-baseline.md
```

Do not insert prose inside the markdown table. Do not add new metric columns unless every historical row is normalized.

- [ ] **Step 2: Add one pre-change row and one post-change row**

Use the existing table headers exactly. Notes should include:

```text
Mobile PDP bottleneck is now CSS/render path: PSI LCP discovery passes, PDP CSS raw chunk was 258171 bytes pre-change, home CSS raw chunk was 446098 bytes pre-change.
```

- [ ] **Step 3: Verify table rows have the same pipe count**

```bash
node - <<'NODE'
const fs = require('node:fs');
const file = 'docs/audits/2026-05-13-storefront-lcp-baseline.md';
const content = fs.readFileSync(file, 'utf8');
const sectionStart = content.indexOf('\n## Post-merge tracking');
if (sectionStart === -1) process.exit(1);

const lines = content.slice(sectionStart).split('\n');
const tableLines = [];
let insideTable = false;

for (const line of lines) {
  if (line.startsWith('|')) {
    insideTable = true;
    tableLines.push(line);
    continue;
  }

  if (insideTable && line.trim() !== '') {
    break;
  }
}

const counts = tableLines.map((line) => line.split('|').length);
const unique = [...new Set(counts)];
console.log(unique);
if (tableLines.length < 2 || unique.length !== 1) process.exit(1);
NODE
```

Expected: one unique pipe count.

---

## Task 10: Verification And Shipping

**Files:**
- All modified files.

- [ ] **Step 1: Focused tests**

```bash
pnpm --dir apps/web test src/components/storefront/ogabassey/pdp/critical-cart-product.test.ts
pnpm --dir apps/web test src/components/storefront/ogabassey/pdp/critical-commerce.test.tsx
pnpm --dir apps/web test src/components/storefront/ogabassey/pdp/deferred-detail-island.client.test.tsx
pnpm --dir apps/web test src/components/storefront/ogabassey/pdp/critical-shell.test.tsx
pnpm --dir apps/web test src/lib/storefront/ogabassey-entity.test.ts
pnpm --dir apps/web test tools/perf/assert-ogabassey-css-budget.test.mjs
pnpm --dir apps/web test 'src/app/(storefront)/[slug]/(catalog)/(pdp)/[category]/[productSlug]/page.test.tsx'
```

- [ ] **Step 2: Quality gates**

```bash
pnpm --dir apps/web lint
pnpm --dir apps/web typecheck
pnpm --dir apps/web build
```

- [ ] **Step 3: CSS budget checks against local build and production**

```bash
pnpm --dir apps/web build
pnpm --dir apps/web start
```

In another terminal:

```bash
OGABASSEY_PDP_URL=http://localhost:3000/ogabassey/laptops/dell-alienware-m18-r3-rtx-5080 \
pnpm --dir apps/web perf:ogabassey-css-budget
pnpm --dir apps/web perf:ogabassey-css-budget
```

Expected before deploy: the local URL passes and production may still fail until the branch ships. After deploy: production also passes.

- [ ] **Step 4: CodeRabbit review**

```bash
coderabbit review --prompt-only -t uncommitted
```

Fix critical/high findings before committing.

- [ ] **Step 5: Commit**

```bash
git status --short
git add apps/web/src apps/web/tools/perf apps/web/package.json docs/audits/2026-05-13-storefront-lcp-baseline.md
git commit -m "perf: isolate ogabassey pdp critical css path"
```

- [ ] **Step 6: Push and open PR**

```bash
git push -u origin codex/ogabassey-critical-css-architecture
gh pr create \
  --title "perf: isolate OgaBassey PDP critical CSS path" \
  --body "Moves direct OgaBassey PDP entries toward a CSS-module-owned critical shell, keeps semantic PDP content server-rendered, wires the critical cart CTA to the real cart store, adds CSS budget guardrails, and normalizes OgaBassey's central entity away from stale fashion classification."
```

- [ ] **Step 7: After merge, deploy only through the approved prebuilt path**

Use the repo production deployment workflow. Do not run `vercel deploy --prod` without `--prebuilt`.

- [ ] **Step 8: Post-deploy measurement**

```bash
pnpm --dir apps/web perf:ogabassey-css-budget
PAGESPEED_INSIGHTS_API_KEY="$(grep '^PAGESPEED_INSIGHTS_API_KEY=' .env.local | cut -d= -f2-)" \
DEBUGBEAR_PROJECT_ID=100906 \
DEBUGBEAR_API_KEY="$DEBUGBEAR_API_KEY" \
pnpm --dir apps/web perf:ogabassey-critical-path
```

Expected:

```text
pdp-alienware mobile LCP < 2500 ms
direct PDP initial CSS budget passes
home metrics recorded with no blank-image or stale-fashion regression
```

If PDP mobile LCP is still above target while CSS budgets pass, stop CSS work and inspect the post-change DebugBear waterfall for the new largest phase before making another code change.

- [ ] **Step 9: Chrome DevTools LCP phase trace**

Use Chrome DevTools/CDP or the installed Chrome DevTools MCP against the post-deploy canonical PDP to capture the LCP element and browser phase split. Record at least:

```text
url
LCP element selector/node summary
TTFB
load delay
load duration
render delay
total LCP
```

Expected: the LCP element is still the primary product image/title region, and the dominant phase is no longer CSS/render delay from broad PDP stylesheet ownership. If a different element becomes LCP, update the audit row and stop before further CSS changes.

---

## Self-Review Notes

- Spec coverage: The plan covers the current PDP CSS/render evidence, PDP first-viewport split, real cart action wiring with variant/default-variant data preserved, server-rendered semantic PDP content, gated below-fold client runtime, safe Tailwind source ratcheting with replacement style ownership, OgaBassey entity normalization, PSI/DebugBear/Chrome trace measurement, audit documentation, and deployment guardrails. Homepage critical CSS is intentionally scoped to guardrails and Phase 2 follow-up.
- Placeholder scan: No task relies on placeholder markers or unspecified tests. The implementation code shown for the guard, entity helper, variant-preserving cart adapter, critical commerce split, semantic wrapper, and viewport-gated detail island is concrete.
- Risk: If the narrow `@/hooks/cart` context import still pulls too much into the critical island, the plan requires extracting a narrower cart action module in Task 3 instead of shipping an inert CTA. If CSS budgets pass but LCP remains high, stop CSS work and inspect the next DebugBear waterfall phase before another code change.
