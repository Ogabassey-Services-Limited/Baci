# OgaBassey PDP LCP Discovery Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reduce OgaBassey canonical PDP mobile LCP by making the actual above-fold product image the only competing high-priority PDP image preload and by verifying the browser discovers it early without introducing SEO, CLS, or Next.js warnings.

**Architecture:** Keep the first fix narrow and PDP-scoped. The current live page already emits product-image preload hints and the visible image has `loading="eager"` plus `fetchPriority="high"`, so do not add another generic preload. Instead, remove duplicate/misaligned PDP image preloads, prevent the unrelated desktop flash-sale/PS5 banner preload from competing on PDP, and validate that exactly one mobile product-image preload is present for mobile PDP while desktop behavior remains intentional. The reviewer same-origin hero-delivery strategy is merged as the next gated escalation only if post-cleanup traces prove the residual bottleneck is CDN delivery/connection setup rather than discovery/render gating.

**Tech Stack:** Next.js 16.2.9 App Router, React 19 `react-dom/preload`, TypeScript, Vitest, Browser plugin/CDP, PageSpeed Insights, DebugBear.

---

## Evidence from production and Browser pass

- Production PDP measured after PR #2435 and Vercel restore:
  - PSI mobile PDP: performance `84`, LCP `4052ms`, FCP `1652ms`, TBT `115ms`, CLS `0`, SEO `100`.
  - DebugBear mobile PDP: LCP `4046ms`, FCP `1795ms`, TBT `311ms`, CLS `0`.
  - Raw audit prefix: `2026-06-12T09-47-19-482Z` under `output/audits/` in the DebugBear worktree.
- Visible PDP product image:
  - `src`: `https://cdn.ogabassey.com/image/width=750,quality=30,format=auto/core-assets/products/z-fold-7-jet-black.avif`
  - `loading="eager"`, `fetchPriority="high"`, above the fold.
- Browser DOM/head showed multiple image preloads:
  - Product mobile preload with `quality=30` and `media="(max-width: 767px)"`.
  - Product desktop preload with `quality=35` and `media="(min-width: 768px)"`.
  - A duplicate product mobile preload in the live DOM.
  - An unrelated desktop flash-sale/PS5 banner preload on the TriFold PDP.
- Raw HTML showed product preloads after scripts around byte `14.6KB`, not in the HTTP `Link` header.
- Therefore the next root cause to test is **preload competition/duplication and streamed discovery timing**, not image byte size or missing `fetchPriority`.

## Merged reviewer strategy

The reviewer plan's same-origin hero-delivery path is useful, but it is not the first PR because it combines several variables: route-handler byte streaming, cache behavior, Cloudflare/Vercel egress behavior, `srcset` rewiring, and optional Link-header expansion. Keep this plan's first PR causally isolated, then escalate only with trace evidence.

Execution order:

1. **First PR in this plan:** remove duplicate/competing PDP image preloads and preserve the existing eager/high-priority product image contract.
2. **Post-merge measurement gate:** repeat PSI/DebugBear and Browser checks. Accept the first PR if PDP mobile LCP improves by about `600ms`, or if repeated runs land near/under `3.0s` with CLS/SEO preserved.
3. **Escalate to same-origin hero delivery only if still sub-gate and trace-proven delivery-bound:** implement byte-streaming in `apps/web/src/lib/ogabassey-pdp-lcp-image-response.ts`, then point `apps/web/src/components/storefront/ogabassey/pdp/product-image-source.ts`, `apps/web/src/components/storefront/ogabassey/pdp/critical-shell.tsx`, and `apps/web/src/app/(storefront)/ogabassey/ogabassey-pdp-product-resource-hints.ts` at the same-origin route.
4. **Escalate to PPR hero shell hoist only after delivery work or if trace proves render gating:** pilot one category and keep bot/human metadata cache variants stable.

Do not combine step 1 and step 3 in one PR. Attribution matters more than shipping a larger mixed optimization.

## File map

- Modify: `apps/web/src/app/(storefront)/ogabassey/ogabassey-pdp-static-resource-hints.tsx`
  - Responsibility: PDP static non-product resource hints. Current static banner preload can compete with PDP product image on desktop and appears as an unrelated PS5 preload on the TriFold PDP.
- Modify: `apps/web/src/app/(storefront)/ogabassey/ogabassey-pdp-static-resource-hints.test.tsx`
  - Responsibility: Assert PDP static hints do not emit competing image preloads unless a measured desktop banner need is reintroduced with proof.
- Modify: `apps/web/src/app/(storefront)/ogabassey/ogabassey-pdp-product-resource-hints.ts`
  - Responsibility: Product-image preload construction. Ensure one effective mobile product preload and one desktop product preload are emitted per call; do not emit duplicate mobile href/srcset combinations.
- Modify: `apps/web/src/app/(storefront)/ogabassey/ogabassey-pdp-product-resource-hints.test.ts`
  - Responsibility: Assert exact `react-dom/preload` call count and no duplicate media/profile combination.
- Modify: `apps/web/src/app/(storefront)/[slug]/(catalog)/(pdp)/[category]/[productSlug]/page.tsx`
  - Responsibility: Page-level preloading. Stop double-calling product preload if the leaf layout already handled the same product image, or keep only one page/layout source after proving which one emits earliest.
- Modify: `apps/web/src/app/(storefront)/[slug]/(catalog)/(pdp)/[category]/[productSlug]/page.test.tsx`
  - Responsibility: Regression tests for OgaBassey PDP resource hints.
- Modify: `apps/web/src/app/(storefront)/[slug]/(catalog)/(pdp)/[category]/[productSlug]/layout.tsx`
  - Responsibility: Leaf layout early product hint. This is currently the earliest code-owned product-image preload source.
- Modify: `apps/web/src/app/(storefront)/[slug]/(catalog)/(pdp)/[category]/[productSlug]/layout.test.tsx`
  - Responsibility: Ensure layout-level product preload remains scoped to known OgaBassey merchant and does not block rendering on timeout/failure.
- Read-only validation: `apps/web/src/components/storefront/ogabassey/config/product-media.ts`
  - Responsibility: Shared PDP image sizes/media constants. Only change if tests prove mismatch with rendered image sizes.

---

## Task 1: Lock current preload duplication in tests

**Files:**
- Modify: `apps/web/src/app/(storefront)/ogabassey/ogabassey-pdp-product-resource-hints.test.ts`
- Modify: `apps/web/src/app/(storefront)/ogabassey/ogabassey-pdp-static-resource-hints.test.tsx`

- [ ] **Step 1: Add a product preload uniqueness regression test**

Add this test inside `describe('OgabasseyPdpProductResourceHints', ...)` in `apps/web/src/app/(storefront)/ogabassey/ogabassey-pdp-product-resource-hints.test.ts`:

```ts
  it('emits exactly one preload per responsive PDP product image profile', () => {
    const productImage =
      'https://cdn.ogabassey.com/core-assets/products/z-fold-7-jet-black.avif';

    renderToStaticMarkup(
      createElement(OgabasseyPdpProductResourceHints, { src: productImage })
    );

    const calls = mockPreload.mock.calls.map(([href, options]) => ({
      href,
      imageSizes: (options as Record<string, unknown>).imageSizes,
      imageSrcSet: (options as Record<string, unknown>).imageSrcSet,
      media: (options as Record<string, unknown>).media,
    }));

    expect(calls).toHaveLength(2);
    expect(new Set(calls.map((call) => call.media))).toEqual(
      new Set([
        OGABASSEY_PDP_PRIMARY_IMAGE_MOBILE_MEDIA,
        OGABASSEY_PDP_PRIMARY_IMAGE_DESKTOP_MEDIA,
      ])
    );
    expect(new Set(calls.map((call) => `${call.media}:${call.href}`))).toHaveSize(
      calls.length
    );
  });
```

- [ ] **Step 2: Run the product resource-hint tests**

Run:

```bash
pnpm --dir apps/web exec vitest run 'src/app/(storefront)/ogabassey/ogabassey-pdp-product-resource-hints.test.ts'
```

Expected before implementation: PASS if duplication is not inside one helper call; if it fails, fix Task 2 before proceeding. This test protects helper-level uniqueness.

- [ ] **Step 3: Add a static resource-hint test for no competing PDP banner image preload**

Replace the assertion intent in `apps/web/src/app/(storefront)/ogabassey/ogabassey-pdp-static-resource-hints.test.tsx` with a failing expectation that the static resource helper does not emit image preloads on PDP. Add this test first, leaving existing tests in place until Task 3 updates them:

```tsx
  it('does not preload the desktop flash-sale banner on PDP because product image owns LCP priority', () => {
    const html = renderToString(<OgabasseyPdpStaticResourceHints />);
    const template = document.createElement('template');
    template.innerHTML = html;

    expect(
      template.content.querySelectorAll('link[rel="preload"][as="image"]')
    ).toHaveLength(0);

    preloadOgabasseyPdpStaticResources();
    expect(mockPreload).not.toHaveBeenCalled();
  });
```

- [ ] **Step 4: Run the static resource-hint test to verify it fails**

Run:

```bash
pnpm --dir apps/web exec vitest run 'src/app/(storefront)/ogabassey/ogabassey-pdp-static-resource-hints.test.tsx'
```

Expected: FAIL because `OgabasseyPdpStaticResourceHints` currently emits a desktop flash-sale/PS5 image preload and `preloadOgabasseyPdpStaticResources()` calls `react-dom/preload`.

---

## Task 2: Keep only product-image preloads as PDP image priority hints

**Files:**
- Modify: `apps/web/src/app/(storefront)/ogabassey/ogabassey-pdp-static-resource-hints.tsx`
- Modify: `apps/web/src/app/(storefront)/ogabassey/ogabassey-pdp-static-resource-hints.test.tsx`
- Modify: `apps/web/src/app/(storefront)/[slug]/(catalog)/(pdp)/[category]/[productSlug]/page.tsx`
- Modify: `apps/web/src/app/(storefront)/[slug]/(catalog)/(pdp)/[category]/[productSlug]/page.test.tsx`

- [ ] **Step 1: Remove the PDP static flash-sale image preload implementation**

In `apps/web/src/app/(storefront)/ogabassey/ogabassey-pdp-static-resource-hints.tsx`, replace the file contents with a no-op PDP static hint module:

```tsx
import 'server-only';
import type { ReactElement } from 'react';

/**
 * PDP static resource hints intentionally do not preload decorative or
 * below-the-fold campaign images. The canonical PDP product image owns LCP
 * priority through `preloadOgabasseyPdpProductResources`.
 */
export function preloadOgabasseyPdpStaticResources(): void {
  return;
}

export function OgabasseyPdpStaticResourceHints(): ReactElement | null {
  return null;
}
```

- [ ] **Step 2: Update static resource-hint tests to match the no-op contract**

In `apps/web/src/app/(storefront)/ogabassey/ogabassey-pdp-static-resource-hints.test.tsx`, remove expectations that require `FLASH_SALE_PROMO_IMAGE`, `imageLoader`, or `next/image`. Keep only no-op behavior tests:

```tsx
import { renderToString } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

const mockPreload = vi.hoisted(() => vi.fn());

vi.mock('react-dom', () => ({
  preload: mockPreload,
}));

import {
  OgabasseyPdpStaticResourceHints,
  preloadOgabasseyPdpStaticResources,
} from '@/app/(storefront)/ogabassey/ogabassey-pdp-static-resource-hints';

describe('OgabasseyPdpStaticResourceHints', () => {
  beforeEach(() => {
    mockPreload.mockClear();
  });

  it('does not render competing static PDP image preload links', () => {
    const html = renderToString(<OgabasseyPdpStaticResourceHints />);

    expect(html).toBe('');
  });

  it('does not call react-dom preload for decorative PDP campaign images', () => {
    preloadOgabasseyPdpStaticResources();

    expect(mockPreload).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 3: Remove the page-level static resource call**

In `apps/web/src/app/(storefront)/[slug]/(catalog)/(pdp)/[category]/[productSlug]/page.tsx`, keep the import only if another test still needs it. Prefer removing both the import and this block inside the existing try/catch:

```ts
    if (criticalProduct) {
      preloadOgabasseyPdpStaticResources();
    }
```

The resulting try/catch should only preload `primaryProductImage`:

```ts
  try {
    if (primaryProductImage) {
      preloadOgabasseyPdpProductResources({ src: primaryProductImage });
    }
  } catch (error) {
    console.warn(
      'Unable to preload OgaBassey PDP resources early:',
      sanitizeLookupLogValue(productSlug),
      error
    );
  }
```

- [ ] **Step 4: Update page tests that expected static resource preloads**

In `apps/web/src/app/(storefront)/[slug]/(catalog)/(pdp)/[category]/[productSlug]/page.test.tsx`, update tests around the mocked `preloadOgabasseyPdpStaticResources` so they assert it is not called for canonical OgaBassey PDP product routes. The updated assertion should be:

```ts
expect(mockPreloadOgabasseyPdpStaticResources).not.toHaveBeenCalled();
```

Keep product-image preload expectations intact:

```ts
expect(mockPreloadOgabasseyPdpProductResources).toHaveBeenCalledWith({
  src: expect.stringContaining('z-fold-7-jet-black.avif'),
});
```

- [ ] **Step 5: Run focused tests**

Run:

```bash
pnpm --dir apps/web exec vitest run \
  'src/app/(storefront)/ogabassey/ogabassey-pdp-static-resource-hints.test.tsx' \
  'src/app/(storefront)/ogabassey/ogabassey-pdp-product-resource-hints.test.ts' \
  'src/app/(storefront)/[slug]/(catalog)/(pdp)/[category]/[productSlug]/page.test.tsx'
```

Expected: PASS. If the broad page test file is slow, rerun the specific failing/changed tests by name.

- [ ] **Step 6: Commit**

```bash
git add \
  'apps/web/src/app/(storefront)/ogabassey/ogabassey-pdp-static-resource-hints.tsx' \
  'apps/web/src/app/(storefront)/ogabassey/ogabassey-pdp-static-resource-hints.test.tsx' \
  'apps/web/src/app/(storefront)/ogabassey/ogabassey-pdp-product-resource-hints.test.ts' \
  'apps/web/src/app/(storefront)/[slug]/(catalog)/(pdp)/[category]/[productSlug]/page.tsx' \
  'apps/web/src/app/(storefront)/[slug]/(catalog)/(pdp)/[category]/[productSlug]/page.test.tsx'
git commit -m "fix(web): keep PDP image preloads product-scoped"
```

---

## Task 3: Decide whether page-level product preload duplicates layout-level product preload

**Files:**
- Modify: `apps/web/src/app/(storefront)/[slug]/(catalog)/(pdp)/[category]/[productSlug]/layout.tsx`
- Modify: `apps/web/src/app/(storefront)/[slug]/(catalog)/(pdp)/[category]/[productSlug]/layout.test.tsx`
- Modify: `apps/web/src/app/(storefront)/[slug]/(catalog)/(pdp)/[category]/[productSlug]/page.tsx`
- Modify: `apps/web/src/app/(storefront)/[slug]/(catalog)/(pdp)/[category]/[productSlug]/page.test.tsx`

- [ ] **Step 1: Add tests documenting the chosen single product-preload owner**

The preferred owner is the leaf layout because it can start from `params` before full page data resolves. In `layout.test.tsx`, keep or add this assertion for known OgaBassey PDP routes:

```ts
expect(mockPreloadOgabasseyPdpProductResources).toHaveBeenCalledTimes(1);
expect(mockPreloadOgabasseyPdpProductResources).toHaveBeenCalledWith({
  src: expect.stringContaining('z-fold-7-jet-black.avif'),
});
```

In `page.test.tsx`, update the page-level product preload tests to one of these two explicit contracts:

Option A, if layout owns product preloading after this task:

```ts
expect(mockPreloadOgabasseyPdpProductResources).not.toHaveBeenCalled();
```

Option B, if page keeps a fallback for non-known merchant IDs or layout timeout only:

```ts
expect(mockPreloadOgabasseyPdpProductResources).toHaveBeenCalledTimes(1);
expect(mockPreloadOgabasseyPdpProductResources).toHaveBeenCalledWith({
  src: expect.stringContaining('z-fold-7-jet-black.avif'),
});
```

Use Option A unless current test evidence proves the layout preload cannot cover canonical `ogabassey.com` and `/ogabassey` PDP routes.

- [ ] **Step 2: If Option A is valid, remove the page-level product preload call**

In `page.tsx`, remove this try/catch entirely if no other work remains inside it:

```ts
  try {
    if (primaryProductImage) {
      preloadOgabasseyPdpProductResources({ src: primaryProductImage });
    }
  } catch (error) {
    console.warn(
      'Unable to preload OgaBassey PDP resources early:',
      sanitizeLookupLogValue(productSlug),
      error
    );
  }
```

Also remove unused imports:

```ts
import { preloadOgabasseyPdpProductResources } from '@/app/(storefront)/ogabassey/ogabassey-pdp-product-resource-hints';
```

- [ ] **Step 3: If Option B is required, keep the page fallback but guard it from duplicate known-route layout ownership**

If tests prove the page fallback is still required, add a helper near the page preload block:

```ts
const layoutOwnsKnownOgaBasseyProductPreload =
  merchant.template_id === OGABASSEY_TEMPLATE_ID &&
  Boolean(getKnownOgaBasseyMerchantId(slug));
```

Then guard the call:

```ts
  try {
    if (primaryProductImage && !layoutOwnsKnownOgaBasseyProductPreload) {
      preloadOgabasseyPdpProductResources({ src: primaryProductImage });
    }
  } catch (error) {
    console.warn(
      'Unable to preload OgaBassey PDP resources early:',
      sanitizeLookupLogValue(productSlug),
      error
    );
  }
```

- [ ] **Step 4: Run focused layout/page tests**

Run:

```bash
pnpm --dir apps/web exec vitest run \
  'src/app/(storefront)/[slug]/(catalog)/(pdp)/[category]/[productSlug]/layout.test.tsx' \
  'src/app/(storefront)/[slug]/(catalog)/(pdp)/[category]/[productSlug]/page.test.tsx'
```

Expected: PASS with a single product-preload owner documented by tests.

- [ ] **Step 5: Commit**

```bash
git add \
  'apps/web/src/app/(storefront)/[slug]/(catalog)/(pdp)/[category]/[productSlug]/layout.tsx' \
  'apps/web/src/app/(storefront)/[slug]/(catalog)/(pdp)/[category]/[productSlug]/layout.test.tsx' \
  'apps/web/src/app/(storefront)/[slug]/(catalog)/(pdp)/[category]/[productSlug]/page.tsx' \
  'apps/web/src/app/(storefront)/[slug]/(catalog)/(pdp)/[category]/[productSlug]/page.test.tsx'
git commit -m "fix(web): avoid duplicate PDP product preload owners"
```

---

## Task 4: Browser/CDP validation before opening PR

**Files:**
- No source changes unless validation fails.

- [ ] **Step 1: Run local or production-like route if available**

If using an existing local server, verify it is current branch/build before trusting it:

```bash
curl -I -H 'Host: ogabassey.com' http://127.0.0.1:3000/smartphones/samsung-galaxy-z-trifold
```

Expected: `200`, OgaBassey PDP route headers, and no `DEPLOYMENT_DISABLED`/error shell.

- [ ] **Step 2: Use Browser at mobile viewport**

Open:

```txt
https://ogabassey.com/smartphones/samsung-galaxy-z-trifold
```

Set viewport to `390x844`. In Browser/CDP, verify:

```js
Array.from(document.querySelectorAll('link[rel="preload"][as="image"]')).map((link) => ({
  href: link.getAttribute('href'),
  imageSrcSet: link.getAttribute('imagesrcset') || link.getAttribute('imageSrcSet'),
  imageSizes: link.getAttribute('imagesizes') || link.getAttribute('imageSizes'),
  media: link.getAttribute('media'),
  fetchPriority: link.getAttribute('fetchpriority') || link.getAttribute('fetchPriority'),
}))
```

Expected after deploy/local proof:

```ts
[
  {
    href: expect.stringContaining('z-fold-7-jet-black.avif'),
    imageSrcSet: expect.stringContaining('quality=30'),
    imageSizes: 'calc(100vw - 32px)',
    media: '(max-width: 767px)',
    fetchPriority: 'high',
  },
  {
    href: expect.stringContaining('z-fold-7-jet-black.avif'),
    imageSrcSet: expect.stringContaining('quality=35'),
    media: '(min-width: 768px)',
    fetchPriority: 'high',
  },
]
```

Also verify no unrelated PS5/flash-sale preload appears on the TriFold PDP:

```js
Array.from(document.querySelectorAll('link[rel="preload"][as="image"]')).some((link) =>
  (link.getAttribute('href') || link.getAttribute('imagesrcset') || '').includes('ps5-digital-slim-console')
)
```

Expected: `false`.

- [ ] **Step 3: Verify visible product image contract**

In Browser, evaluate:

```js
Array.from(document.images).map((img) => ({
  alt: img.alt,
  src: img.currentSrc || img.src,
  loading: img.loading,
  fetchPriority: img.fetchPriority,
  rect: (() => {
    const r = img.getBoundingClientRect();
    return { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) };
  })(),
}))
```

Expected: the above-fold product image remains visible, `loading: 'eager'`, `fetchPriority: 'high'`, and uses the same `z-fold-7-jet-black.avif` resource as the mobile preload.

- [ ] **Step 4: Run local focused checks**

Run:

```bash
git diff --check
pnpm --dir apps/web lint
pnpm --dir apps/web typecheck
pnpm --dir apps/web exec vitest run \
  'src/app/(storefront)/ogabassey/ogabassey-pdp-static-resource-hints.test.tsx' \
  'src/app/(storefront)/ogabassey/ogabassey-pdp-product-resource-hints.test.ts' \
  'src/app/(storefront)/[slug]/(catalog)/(pdp)/[category]/[productSlug]/layout.test.tsx' \
  'src/app/(storefront)/[slug]/(catalog)/(pdp)/[category]/[productSlug]/page.test.tsx'
```

Expected: all pass.

- [ ] **Step 5: Commit validation-only doc note if needed**

If Browser/DebugBear evidence changes the diagnosis, update:

```txt
docs/perf/ogabassey-pdp-semantic-cwv-execution-plan.md
```

Then commit:

```bash
git add docs/perf/ogabassey-pdp-semantic-cwv-execution-plan.md
git commit -m "docs(perf): record PDP LCP discovery validation"
```

---

## Task 5: PR, deploy wait, and production measurement gate

**Files:**
- No source files unless review feedback is valid.

- [ ] **Step 1: Create PR**

```bash
git push origin HEAD
```

Open a PR with this summary:

```md
## Summary
- Removes competing decorative PDP image preloads so the canonical product image owns PDP LCP priority.
- Keeps product-image preload hints media-scoped and high priority.
- Adds regressions to prevent duplicate/irrelevant image preload hints on OgaBassey PDP.

## Validation
- git diff --check
- pnpm --dir apps/web lint
- pnpm --dir apps/web typecheck
- pnpm --dir apps/web exec vitest run ...focused PDP resource hint tests...
- Browser mobile PDP check: exactly product image preloads, no PS5/flash-sale preload
```

- [ ] **Step 2: Address reviewer comments only after verifying current code**

For each review finding:

```txt
Verify against current code -> fix only still-valid issue -> keep diff minimal -> rerun focused tests.
```

Do not accept suggestions that reintroduce broad `connection()`, global critical CSS changes, or duplicate image preloads without trace evidence.

- [ ] **Step 3: Wait for merge and production deployment**

Do not run `vercel build` or cloud build commands. The expected deployment path is the repo's VPS/prebuilt flow triggered after merge.

Verify live deployment after merge:

```bash
curl -I -L --max-time 30 https://ogabassey.com/smartphones/samsung-galaxy-z-trifold
vercel inspect ogabassey.com
```

Expected: public `200`, production deployment `Ready`, no `DEPLOYMENT_DISABLED`.

- [ ] **Step 4: Remeasure production**

Run from a worktree that has the repaired DebugBear script:

```bash
DEBUGBEAR_API_KEY='XqHvwkN7AeLpsPMOgph004B8X' \
DEBUGBEAR_PROJECT_ID='101919' \
OGABASSEY_PDP_URL='https://ogabassey.com/smartphones/samsung-galaxy-z-trifold' \
pnpm --dir apps/web perf:ogabassey-critical-path
```

Expected acceptance gate:

- PDP mobile LCP improves by at least `600ms` on repeated lab runs, or one run lands near/under `3.0s` and a second run confirms direction.
- PDP CLS remains `0` or below `0.02`.
- PSI SEO remains `100`.
- No unrelated decorative product/banner image preload appears on PDP.

- [ ] **Step 5: Stop rule and merged escalation path**

If PDP LCP does not improve by the noise gate after this narrow cleanup, do not keep editing preloads. Capture a Chrome trace or DebugBear waterfall and classify the residual bottleneck before opening the next PR.

Use this decision table:

| Trace result | Next PR | Files |
|---|---|---|
| LCP image load duration or CDN connection setup dominates after product preload cleanup | Same-origin hero delivery | `apps/web/src/lib/ogabassey-pdp-lcp-image-response.ts`, `apps/web/src/components/storefront/ogabassey/pdp/product-image-source.ts`, `apps/web/src/components/storefront/ogabassey/pdp/critical-shell.tsx`, `apps/web/src/app/(storefront)/ogabassey/ogabassey-pdp-product-resource-hints.ts` |
| Product image request still starts late despite clean preload ownership | PPR/head discovery investigation | `apps/web/src/app/(storefront)/[slug]/(catalog)/(pdp)/[category]/[productSlug]/layout.tsx`, `apps/web/src/app/(storefront)/[slug]/(catalog)/(pdp)/[category]/[productSlug]/page.tsx`, metadata/cache tests |
| Main-thread/render delay dominates after image fetch completes | Critical shell/RSC payload investigation | PDP critical shell, deferred island boundaries, serialized props crossing client boundaries |
| TTFB dominates field data but not lab | Gated cache/region experiment | no `proxy.ts` diff without explicit approval |

For same-origin hero delivery, validate these before flipping hero URLs:

```bash
curl -I -L --max-time 30 https://ogabassey.com/api/ogabassey/pdp-lcp-image/profile/mobile/samsung-galaxy-z-trifold
```

Expected after that future PR: image response is byte-streamed with correct `Content-Type` and public cache headers, or fails closed to the current 307 redirect fallback. If Cloudflare blocks Vercel egress fetches, stop and ask for the Cloudflare WAF skip/header config; do not hide the requirement in application code.

---

## Self-review

- Spec coverage: The plan addresses the verified Browser findings: duplicate/misaligned PDP image preloads, unrelated PS5/flash-sale preload, and the need to preserve high-priority visible product image behavior. It also merges the reviewer same-origin delivery strategy as a gated follow-up instead of ignoring it.
- Placeholder scan: No `TBD`, broad “add tests”, or unspecified file paths remain.
- Type consistency: The plan uses existing function names and constants from the current code: `preloadOgabasseyPdpProductResources`, `preloadOgabasseyPdpStaticResources`, `OgabasseyPdpStaticResourceHints`, `OGABASSEY_PDP_PRIMARY_IMAGE_MOBILE_MEDIA`, and `OGABASSEY_PDP_PRIMARY_IMAGE_DESKTOP_MEDIA`.
- Risk note: The first PR deliberately avoids global CSS, broad image pipeline rewrites, and `proxy.ts` changes. Same-origin byte streaming and PPR hero hoisting are explicitly gated by post-cleanup trace evidence.
