# PDP Banner LCP Preload Hint Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:executing-plans` to implement this plan task-by-task. Do not spawn subagents unless the user explicitly opts into parallel worker agents; `superpowers:subagent-driven-development` is optional only after that approval. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Emit a server-side `<link rel="preload">` for the PDP banner carousel's first image (Flash Sale promo) on the active OgaBassey PDP route, using the same custom-loader responsive `imageSrcSet`/`imageSizes` candidates that `next/image` will request, so the LCP image is discoverable from the initial HTML and starts loading before the dynamic, client-only `BannerCarousel` mounts.

**Architecture:** New server-only resource-hints component that mirrors the existing [`OgabasseyStaticResourceHints`](../../../apps/web/src/app/(storefront)/ogabassey/ogabassey-static-resource-hints.tsx) pattern (built in PR #1607 for the home hero), but with one important correction for PDP: derive the responsive preload candidates (`src`/`srcSet`, emitted by React as `imageSrcSet`/`imageSizes`) through `getImageProps()` with the app's explicit custom `imageLoader` (`apps/web/src/lib/image-loader.ts`) and the same `fill + sizes` shape used by `BannerCarousel`. That loader rewrites `https://cdn.ogabassey.com/...avif` to `https://cdn.ogabassey.com/image/width=...,quality=75,format=webp/...avif`; preloading the raw AVIF would be unused and can create a duplicate critical-path request. The component calls `ReactDOM.preload()` so React 19 hoists the link into `<head>`. It is mounted from the active PDP route's Server Component before rendering the OgaBassey product page. Does **not** touch `BannerCarousel.tsx` — the dynamic-import + `isDesktop` gate stays as-is (it exists to keep `BannerCarousel` off the mobile bundle, which we want to preserve).

**Tech Stack:** Next.js 16 App Router (Server Components), React 19 (`<link>` hoisting + `ReactDOM.preload`), Vitest + React Testing Library, `renderToString` for hint tests.

**Audit reference:** [docs/audits/2026-05-13-storefront-lcp-baseline.md](../../audits/2026-05-13-storefront-lcp-baseline.md) — Finding 2. Expected PDP desktop outcome: the Flash Sale banner request is discoverable from initial HTML, production desktop LCP falls below 1500 ms, and the LCP resource-load-delay subpart (from a fresh same-run PSI capture) falls below 500 ms.

---

## Why the previous strategy was wrong

An earlier revision of this plan proposed flipping `priority` / `preload` props inside `BannerCarousel.tsx`. That doesn't work for the active PDP path because:

1. [product-details-page.tsx:21-25](../../../apps/web/src/components/storefront/ogabassey/pages/product-details-page.tsx) imports `BannerCarousel` with `dynamic(..., { ssr: false })` — it never renders during SSR
2. [product-details-page.tsx:115](../../../apps/web/src/components/storefront/ogabassey/pages/product-details-page.tsx) gates the render behind `isDesktop`, which starts `false` and only flips in a post-hydration `useEffect`
3. By the time `BannerCarousel` mounts, the page is well past navigation start — any image-prop hints emitted at that point are post-LCP-window

Next.js docs also discourage combining the `preload` prop with explicit `fetchPriority` on `next/image` ([Image#preload](https://nextjs.org/docs/app/api-reference/components/image#preload)). The team's vetted pattern, used for the home hero, sidesteps both issues by emitting a real `<link rel="preload">` in the Server Component tree. For PDP, that hint must match the custom loader output; otherwise the browser downloads a raw AVIF preload while the mounted carousel later requests the transformed WebP URL.

---

## File Structure

**Files created:**
- `apps/web/src/app/(storefront)/ogabassey/ogabassey-pdp-static-resource-hints.tsx` — new server component, exports `OgabasseyPdpStaticResourceHints`. Emits one desktop-media-scoped image preload for `FLASH_SALE_PROMO_IMAGE` using the custom-loader-derived `imageSrcSet`/`imageSizes` from `getImageProps()` with the explicit app `imageLoader`.
- `apps/web/src/app/(storefront)/ogabassey/ogabassey-pdp-static-resource-hints.test.tsx` — colocated unit test using `renderToString` to assert the link emits with the transformed `/image/width=...,quality=75,format=webp` responsive `imageSrcSet`/`imageSizes` contract. Current React 19 omits `href` when `imageSrcSet` is supplied, so tests should not require `href`.
- `docs/audits/2026-05-13-storefront-lcp-baseline.md` — create this audit doc if it does not already exist in the branch. The plan references it for baseline and post-merge measurement evidence, but it is not present on clean `origin/main` as of 2026-05-13.

**Files modified:**
- `apps/web/src/app/(storefront)/[slug]/(catalog)/[category]/[productSlug]/page.tsx` — mounts the new hints component before `<OgabasseyProductPage>` (only when `templateId === OGABASSEY_TEMPLATE_ID`).
- `apps/web/src/app/(storefront)/[slug]/(catalog)/[category]/[productSlug]/page.test.tsx` — route-level regression test that the hint mounts for the OgaBassey template branch and not for generic templates.

**Files NOT touched (intentional):**
- `apps/web/src/components/storefront/ogabassey/components/BannerCarousel.tsx` — preserve the existing dynamic + isDesktop pattern (mobile-bundle-size protection). The preload happens at the HTML head; the carousel still mounts later as designed.
- `apps/web/src/components/storefront/ogabassey/components/BannerCarousel.test.tsx` — no test changes needed.
- `apps/web/src/app/(storefront)/[slug]/storefront-hero-preload-decision.tsx` — home-only decision component; PDP gets its own independent emit (no need to thread `isPdpPath` through a shared decision).
- `apps/web/src/components/storefront/ogabassey/storefront-layout.tsx` — already emits CDN `prefetchDNS`/`preconnect` for OgaBassey storefront routes; do not duplicate those warmup hints in the PDP component.

---

## Review Gate Protocol

Each phase below ends with a review gate. Treat the review gate as a hard stop: do not move to the next phase until the gate's checks are written down in the implementation log or PR notes. If this plan is executed in a live supervised session, pause at each gate and report the diff, command output, and any risk before continuing.

Every review gate must answer these four questions:

1. **Scope:** Did this phase modify only the files listed for the phase?
2. **Evidence:** Which command or artifact proves the phase behaved as expected?
3. **Risk:** Did the diff introduce preload duplication, mobile bandwidth cost, generic-template leakage, or Next.js App Router boundary drift?
4. **Decision:** Continue, revise this phase, or stop and ask the user.

---

## Pre-flight

- [ ] **Step 0a: Create the worktree (canonical `git worktree add` syntax)**

```bash
cd /Users/mac/Baci-app
git fetch origin main
git worktree add -b codex/pdp-banner-lcp-priority .worktrees/pdp-banner-lcp-priority origin/main
cd .worktrees/pdp-banner-lcp-priority
```

Expected: worktree created at `.worktrees/pdp-banner-lcp-priority` on new branch `codex/pdp-banner-lcp-priority` tracking `origin/main`. Verify with `git worktree list | grep pdp-banner-lcp`.

- [ ] **Step 0b: Install dependencies**

```bash
pnpm install --prefer-offline
```

Expected: completes in 30-60 s on warm cache, last line `Done in NNs using pnpm vXX.X.X`.

- [ ] **Step 0c: Ensure the audit doc exists in this branch**

Clean `origin/main` did not contain `docs/audits/2026-05-13-storefront-lcp-baseline.md` during plan review. If the file is missing in the implementation worktree, create it before opening the PR so the plan's baseline and post-merge measurement references are traceable:

```bash
mkdir -p docs/audits
test -f docs/audits/2026-05-13-storefront-lcp-baseline.md || cat > docs/audits/2026-05-13-storefront-lcp-baseline.md <<'EOF'
# Storefront LCP Baseline - 2026-05-13

## Finding 2: PDP banner image discovery delay

PSI lab capture reported the OgaBassey PDP desktop LCP element as the Flash Sale banner image.

| Observation | Baseline |
|---|---:|
| PDP desktop LCP observation | 2769 ms |
| Banner resource discovery delay observation | 3103 ms |
| TBT | 1490 ms |

The Flash Sale image is rendered by `BannerCarousel`, which is imported with `dynamic(..., { ssr: false })` and gated behind post-hydration desktop detection in `ProductDetailsPage`, so the image is not discoverable from initial HTML.

Note: the LCP and resource-delay values above came from earlier audit observations and should not be treated as one additive Lighthouse breakdown. Re-capture a same-run PSI baseline before comparing subpart deltas.
EOF
```

If the audit doc already exists with richer data, do not overwrite it.

- [ ] **Step 0d: Capture a same-run pre-fix PSI desktop baseline**

The acceptance criteria compare against a fresh same-run PSI capture, not the older mixed audit observations. Capture the pre-fix PDP desktop result before changing code and append it to the audit doc. Use an environment variable for the API key; do not paste secrets into the plan or commit history.

```bash
cd /Users/mac/Baci-app/.worktrees/pdp-banner-lcp-priority
PAGESPEED_INSIGHTS_API_KEY="${PAGESPEED_INSIGHTS_API_KEY:?set PAGESPEED_INSIGHTS_API_KEY}" node - <<'NODE'
const KEY = process.env.PAGESPEED_INSIGHTS_API_KEY;
const url = "https://ogabassey.com/lenovo/lenovo-legion-pro-9-16irx9-rtx-4090";
const qs = new URLSearchParams({
  category: "PERFORMANCE",
  key: KEY,
  strategy: "desktop",
  url,
});

const response = await fetch(
  `https://www.googleapis.com/pagespeedonline/v5/runPagespeed?${qs}`,
  { signal: AbortSignal.timeout(180_000) }
);
const result = await response.json();
if (result.error) {
  throw new Error(`PSI ${result.error.code}: ${result.error.message}`);
}

const audits = result.lighthouseResult.audits;
const lcp = audits["largest-contentful-paint"];
const breakdown =
  audits["lcp-breakdown-insight"]?.details?.items?.[0]?.items ?? [];

console.log(JSON.stringify({
  url,
  strategy: "desktop",
  fetchedAt: new Date().toISOString(),
  lcpMs: Math.round(lcp.numericValue),
  lcpDisplay: lcp.displayValue,
  breakdown: breakdown.map((item) => ({
    label: item.label,
    durationMs: Math.round(item.duration),
  })),
}, null, 2));
NODE
```

Append the JSON output to [docs/audits/2026-05-13-storefront-lcp-baseline.md](../../audits/2026-05-13-storefront-lcp-baseline.md) under:

````markdown
## Same-run baseline before PDP banner preload

Date: <YYYY-MM-DD>
Source: PSI API, desktop, production URL before this PR deployed.

```json
<paste command output>
```
````

If PSI returns a transient quota/rate-limit error, record the failed attempt in the audit doc and retry before merge. Do not invent baseline values.

- [ ] **Step 0e: Verify source exports before test/source work**

Confirm the symbols the PDP preload component will import already exist:

```bash
cd /Users/mac/Baci-app/.worktrees/pdp-banner-lcp-priority
rg "export const FLASH_SALE_PROMO_IMAGE" apps/web/src/components/storefront/ogabassey/components/hero-data.ts
rg "export default function imageLoader" apps/web/src/lib/image-loader.ts
rg "export const OGABASSEY_TEMPLATE_ID" apps/web/src/config/templates.ts
```

If either export is absent, stop and revise the plan before writing the test or component.

- [ ] **Step 0f: Verify framework and CSP prerequisites**

React 19 link hoisting and `ReactDOM.preload()` are part of this approach, so verify the app still runs on React 19 / Next 16 before writing the component:

```bash
node -e "const pkg=require('./apps/web/package.json'); console.log({react: pkg.dependencies.react, next: pkg.dependencies.next})"
```

Also confirm the storefront CSP allows image loads from the OgaBassey CDN:

```bash
rg "Content-Security-Policy|img-src|cdn.ogabassey.com" apps/web/src --type ts -A 3
```

If React is not 19.x, Next is not 16.x, or CSP blocks `https://cdn.ogabassey.com`, stop and revise the plan before implementation.

- [ ] **Step 0g: Review gate — pre-flight**

Before writing any tests or source code, record:

```markdown
### Review gate: pre-flight

- Worktree: `/Users/mac/Baci-app/.worktrees/pdp-banner-lcp-priority`
- Branch: `codex/pdp-banner-lcp-priority`
- Base: `origin/main` at `<git rev-parse --short HEAD>`
- Dependency install: `<pnpm install result>`
- Audit doc: `<created | already existed>`
- Same-run PSI baseline: `<captured JSON appended | PSI error recorded with timestamp>`
- Source exports checked: `<FLASH_SALE_PROMO_IMAGE present | missing>`, `<imageLoader present | missing>`, `<OGABASSEY_TEMPLATE_ID present | missing>`
- Framework/CSP checked: `<React 19 / Next 16 confirmed | mismatch>`, `<CDN image source allowed | blocked>`
- Decision: `<continue | revise | stop>`
```

Continue only if the worktree is isolated, dependencies are installed, and the audit doc contains either the same-run baseline JSON or a documented PSI failure/retry note.

---

## Task 1: Add the failing test for the new resource-hints component

**Files:**
- Create: `apps/web/src/app/(storefront)/ogabassey/ogabassey-pdp-static-resource-hints.test.tsx`

Focused red/green Vitest commands below intentionally use `pnpm exec vitest run` from `apps/web` so exact file lists are passed unchanged. Broader package verification still uses `pnpm turbo ... --filter=@baci/web`.

- [ ] **Step 1.1: Write the test file**

Create the file with this content:

The local `next/image` mock is intentional. `apps/web/vitest.setup.ts` provides a global `next/image` test double that does not expose `getImageProps`, and plain Node/Vitest execution does not receive Next's injected `__NEXT_IMAGE_OPTS` custom-loader config. This mock verifies that the component passes an explicit loader and that the emitted preload uses that loader's transformed URL shape. Production `getImageProps()` can still drift if Next's width/device-size config changes, so Task 6.2's deployed HTML inspection is the parity check that catches mock-vs-production mismatch.

```tsx
import { renderToString } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

// The mock validates our explicit loader + width contract; deployed HTML
// inspection in Task 6.2 catches any drift from real Next getImageProps output.
const mockGetImageProps = vi.hoisted(() =>
  vi.fn(
    (props: {
      fill?: boolean;
      loader: (params: {
        src: string;
        width: number;
        quality?: number;
      }) => string;
      quality?: number;
      sizes?: string;
      src: string;
    }) => {
      const widths = [640, 750, 828, 1080, 1200, 1920, 2048, 3840];
      const srcSet = widths
        .map(
          (width) =>
            `${props.loader({
              quality: props.quality,
              src: props.src,
              width,
            })} ${width}w`
        )
        .join(', ');

      return {
        props: {
          sizes: props.sizes,
          src: props.loader({
            quality: props.quality,
            src: props.src,
            width: widths.at(-1) ?? 3840,
          }),
          srcSet,
        },
      };
    }
  )
);

vi.mock('next/image', () => ({
  getImageProps: mockGetImageProps,
}));

import { OgabasseyPdpStaticResourceHints } from '@/app/(storefront)/ogabassey/ogabassey-pdp-static-resource-hints';

describe('OgabasseyPdpStaticResourceHints', () => {
  it('emits one desktop-only banner preload that matches the custom image loader', () => {
    const html = renderToString(<OgabasseyPdpStaticResourceHints />);
    const template = document.createElement('template');
    template.innerHTML = html;
    const links = Array.from(template.content.querySelectorAll('link'));

    const findLink = (predicate: (link: HTMLLinkElement) => boolean) =>
      links.find(predicate);

    const bannerPreload = findLink(
      (link) =>
        link.getAttribute('rel') === 'preload' &&
        link.getAttribute('as') === 'image' &&
        link.getAttribute('media') === '(min-width: 768px)'
    );

    expect(bannerPreload).toBeDefined();
    expect(mockGetImageProps).toHaveBeenCalledWith(
      expect.objectContaining({
        fill: true,
        loader: expect.any(Function),
        sizes: '(max-width: 768px) 100vw, (max-width: 1200px) 80vw, 1400px',
      })
    );
    expect(bannerPreload?.getAttribute('fetchpriority')).toBe('high');
    // React 19 responsive image preloads omit href when imageSrcSet is
    // supplied; the selectable transformed URLs live in imagesrcset.
    expect(bannerPreload?.getAttribute('href')).toBeNull();
    expect(bannerPreload?.getAttribute('imagesrcset')).toContain(
      'https://cdn.ogabassey.com/image/width='
    );
    expect(bannerPreload?.getAttribute('imagesrcset')).toContain('format=webp');
    expect(bannerPreload?.getAttribute('imagesizes')).toBe(
      '(max-width: 768px) 100vw, (max-width: 1200px) 80vw, 1400px'
    );
    expect(bannerPreload?.getAttribute('type')).toBe('image/webp');

    // Only the banner is preloaded by this hint — mobile carousel is hidden
    // (PDP wrapper uses `hidden md:block`) so no mobile-media preload exists.
    expect(
      links.filter((link) => link.getAttribute('rel') === 'preload')
    ).toHaveLength(1);
    expect(
      links.filter((link) =>
        ['dns-prefetch', 'preconnect'].includes(link.getAttribute('rel') ?? '')
      )
    ).toHaveLength(0);
  });
});
```

- [ ] **Step 1.2: Run the test to confirm it fails on a missing import**

```bash
cd /Users/mac/Baci-app/.worktrees/pdp-banner-lcp-priority/apps/web
LEFTHOOK=0 pnpm exec vitest run src/app/'(storefront)'/ogabassey/ogabassey-pdp-static-resource-hints.test.tsx
```

Expected: FAIL with a module-not-found-style error, similar to:

```
Failed to resolve import "@/app/(storefront)/ogabassey/ogabassey-pdp-static-resource-hints"
```

The test cannot find the source module because Task 2 hasn't created it yet — that's the red step.

- [ ] **Step 1.3: Review gate — red test**

Stop and review the red state before creating the component:

```markdown
### Review gate: red test

- Changed files: `apps/web/src/app/(storefront)/ogabassey/ogabassey-pdp-static-resource-hints.test.tsx`
- Red command: `LEFTHOOK=0 pnpm exec vitest run src/app/'(storefront)'/ogabassey/ogabassey-pdp-static-resource-hints.test.tsx`
- Expected failure observed: module missing for `ogabassey-pdp-static-resource-hints`
- Test intent checked: desktop-only media, transformed WebP `imagesrcset`, `image/webp` type, no CDN warmup duplication
- Decision: `<continue | revise | stop>`
```

Continue only if the failure is caused by the missing source module. If the test passes or fails for a syntax/mock error, fix the test and rerun the red command before moving on.

---

## Task 2: Create the new resource-hints component (minimal pass)

**Files:**
- Create: `apps/web/src/app/(storefront)/ogabassey/ogabassey-pdp-static-resource-hints.tsx`

- [ ] **Step 2.1: Write the component**

Create the file with this content:

```tsx
import 'server-only';
import { getImageProps } from 'next/image';
import * as ReactDOM from 'react-dom';
import { FLASH_SALE_PROMO_IMAGE } from '@/components/storefront/ogabassey/components/hero-data';
import imageLoader from '@/lib/image-loader';

const PDP_BANNER_PRELOAD_MEDIA = '(min-width: 768px)';
const PDP_BANNER_IMAGE_SIZES =
  '(max-width: 768px) 100vw, (max-width: 1200px) 80vw, 1400px';

/**
 * PDP-only resource hints for the OgaBassey product detail page.
 *
 * Emits a desktop-scoped <link rel="preload"> for the custom-loader-transformed
 * Flash Sale banner image — that's the LCP element on PDP desktop per PSI lab
 * capture 2026-05-13 (Flash Sale banner identified as the delayed LCP
 * candidate; re-capture a same-run PSI baseline before calculating deltas).
 *
 * The Flash Sale image cannot be discovered from the rendered DOM in the
 * initial HTML because BannerCarousel is dynamic({ ssr: false }) + gated
 * behind a post-hydration isDesktop state in ProductDetailsPage. This
 * server-emitted preload bridges that gap without breaking the dynamic
 * import's mobile-bundle-size benefit (the carousel still doesn't ship
 * to mobile; only the link tag, scoped via media="(min-width: 768px)").
 *
 * Mounted from the active PDP route Server Component when the OgaBassey
 * template is active. React 19 hoists the link into <head>.
 */
export function OgabasseyPdpStaticResourceHints() {
  const {
    props: { src, srcSet, sizes },
  } = getImageProps({
    alt: '',
    fill: true,
    // Keep this explicit: Vitest/plain Node do not receive Next's injected
    // image config, and this mirrors BannerCarousel's custom-loader output.
    loader: imageLoader,
    sizes: PDP_BANNER_IMAGE_SIZES,
    src: FLASH_SALE_PROMO_IMAGE,
  });

  ReactDOM.preload(src, {
    as: 'image',
    fetchPriority: 'high',
    imageSizes: sizes,
    imageSrcSet: srcSet,
    media: PDP_BANNER_PRELOAD_MEDIA,
    type: 'image/webp',
  });

  return null;
}
```

- [ ] **Step 2.2: Run the test to confirm it now passes**

```bash
cd /Users/mac/Baci-app/.worktrees/pdp-banner-lcp-priority/apps/web
LEFTHOOK=0 pnpm exec vitest run src/app/'(storefront)'/ogabassey/ogabassey-pdp-static-resource-hints.test.tsx
```

Expected:

```
✓ src/app/(storefront)/ogabassey/ogabassey-pdp-static-resource-hints.test.tsx (1 test)
  ✓ emits one desktop-only banner preload that matches the custom image loader

Test Files  1 passed (1)
      Tests  1 passed (1)
```

If it fails, re-read the file paths and named exports in Steps 1.1 and 2.1 — they must match exactly.

- [ ] **Step 2.3: Review gate — resource-hints component**

Stop and inspect the source diff before touching the route:

```markdown
### Review gate: resource-hints component

- Changed files: `ogabassey-pdp-static-resource-hints.tsx`, `ogabassey-pdp-static-resource-hints.test.tsx`
- Green command: `LEFTHOOK=0 pnpm exec vitest run src/app/'(storefront)'/ogabassey/ogabassey-pdp-static-resource-hints.test.tsx`
- Component checks: `server-only` import present, explicit `imageLoader` passed to `getImageProps`, `type: 'image/webp'`, `media: '(min-width: 768px)'`
- Non-goals preserved: no edits to `BannerCarousel.tsx`, no mobile preload, no duplicate DNS/preconnect hints
- Decision: `<continue | revise | stop>`
```

Continue only if the component remains server-only, emits one image preload, and has no client-component or generic-route coupling.

---

## Task 3: Mount the hints from the active PDP route

The active PDP route chooses its surface inside the server-side `TemplateProductPage` helper. Mount `<OgabasseyPdpStaticResourceHints />` inside the OgaBassey template branch immediately before `<OgabasseyProductPage>`, and replace the current magic-string branch check with `templateId === OGABASSEY_TEMPLATE_ID`. That keeps the hint scoped to the OgaBassey PDP path and prevents the Flash Sale banner preload from leaking into generic merchant PDPs. Add a route-level regression test for that gate so a future refactor does not accidentally preload the OgaBassey banner on generic templates.

**Files:**
- Modify: `apps/web/src/app/(storefront)/[slug]/(catalog)/[category]/[productSlug]/page.tsx`
- Modify: `apps/web/src/app/(storefront)/[slug]/(catalog)/[category]/[productSlug]/page.test.tsx`

- [ ] **Step 3.1: Locate the OgaBassey product page render site**

```bash
cd /Users/mac/Baci-app/.worktrees/pdp-banner-lcp-priority
grep -n "OgabasseyProductPage" apps/web/src/app/'(storefront)'/'[slug]'/'(catalog)'/'[category]'/'[productSlug]'/page.tsx
```

Expected:

```
7:import { ProductDetailsPage as OgabasseyProductPage } from '@/components/storefront/ogabassey/pages/product-details-page';
254:      <OgabasseyProductPage
```

(Line numbers may drift if the file changes — match by the `TemplateProductPage` helper and the JSX tag itself.)

- [ ] **Step 3.2: Add the import**

Edit `apps/web/src/app/(storefront)/[slug]/(catalog)/[category]/[productSlug]/page.tsx`. Find the existing import line:

```ts
import { ProductDetailsPage as OgabasseyProductPage } from '@/components/storefront/ogabassey/pages/product-details-page';
```

Add this line immediately below it:

```ts
import { OgabasseyPdpStaticResourceHints } from '@/app/(storefront)/ogabassey/ogabassey-pdp-static-resource-hints';
```

Also add the shared template constant with the other imports:

```ts
import { OGABASSEY_TEMPLATE_ID } from '@/config/templates';
```

- [ ] **Step 3.3: Mount the hints adjacent to the OgaBassey product page render**

In the same file, find the `TemplateProductPage` helper. Replace the OgaBassey branch:

```tsx
if (templateId === 'ogabassey') {
  const ogabasseyProduct = toOgabasseyProduct(product);
  return (
    <OgabasseyProductPage
      product={ogabasseyProduct}
      semanticSections={semanticSections}
    />
  );
}
```

with this fragment:

```tsx
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
```

- [ ] **Step 3.4: Add the route-level gating test**

Edit `apps/web/src/app/(storefront)/[slug]/(catalog)/[category]/[productSlug]/page.test.tsx`.

Update the existing hoisted mock destructuring at the top of the file. Change:

```tsx
const {
  mockNormalizeStorefrontProductVariants,
  mockOgabasseyProductDetailsPage,
  mockProductDetailClient,
} = vi.hoisted(() => ({
  mockNormalizeStorefrontProductVariants: vi.fn<
    (...args: unknown[]) => Record<string, unknown>[]
  >(() => []),
  mockOgabasseyProductDetailsPage: vi.fn<(props: unknown) => void>(),
  mockProductDetailClient: vi.fn<(props: unknown) => null>(() => null),
}));
```

to:

```tsx
const {
  mockNormalizeStorefrontProductVariants,
  mockOgabasseyPdpStaticResourceHints,
  mockOgabasseyProductDetailsPage,
  mockProductDetailClient,
} = vi.hoisted(() => ({
  mockNormalizeStorefrontProductVariants: vi.fn<
    (...args: unknown[]) => Record<string, unknown>[]
  >(() => []),
  mockOgabasseyPdpStaticResourceHints: vi.fn<() => void>(),
  mockOgabasseyProductDetailsPage: vi.fn<(props: unknown) => void>(),
  mockProductDetailClient: vi.fn<(props: unknown) => null>(() => null),
}));
```

Add this module mock immediately after the existing `ProductDetailsPage` mock:

```tsx
vi.mock('@/app/(storefront)/ogabassey/ogabassey-pdp-static-resource-hints', () => ({
  OgabasseyPdpStaticResourceHints: () => {
    mockOgabasseyPdpStaticResourceHints();
    return <div data-testid="ogabassey-pdp-resource-hints" />;
  },
}));
```

Clear it in `beforeEach` with the other route mocks:

```tsx
mockOgabasseyPdpStaticResourceHints.mockClear();
```

Add these two render tests inside `describe('[category]/[productSlug] page render', () => { ... })`, after `it('renders only the visible product heading for the page', ...)`:

```tsx
it('mounts the OgaBassey PDP preload hints for the OgaBassey template branch', async () => {
  render(
    await CategoryProductPage({
      params: Promise.resolve({
        slug: 'teststore',
        category: 'laptops',
        productSlug: 'hp-laptop-14-ep0063nia',
      }),
      searchParams: Promise.resolve({}),
    })
  );

  expect(mockOgabasseyPdpStaticResourceHints).toHaveBeenCalledTimes(1);
  expect(screen.getByTestId('ogabassey-pdp-resource-hints')).toBeInTheDocument();
});

it('does not mount OgaBassey PDP preload hints for generic template product pages', async () => {
  mockGetRequestScopedMerchant.mockResolvedValue({
    ...baseMerchant,
    template_id: 'default',
  });

  render(
    await CategoryProductPage({
      params: Promise.resolve({
        slug: 'teststore',
        category: 'laptops',
        productSlug: 'hp-laptop-14-ep0063nia',
      }),
      searchParams: Promise.resolve({}),
    })
  );

  expect(mockOgabasseyPdpStaticResourceHints).not.toHaveBeenCalled();
  expect(screen.queryByTestId('ogabassey-pdp-resource-hints')).not.toBeInTheDocument();
});
```

- [ ] **Step 3.5: Verify the route still typechecks**

```bash
cd /Users/mac/Baci-app/.worktrees/pdp-banner-lcp-priority
LEFTHOOK=0 pnpm turbo typecheck --filter=@baci/web
```

Expected:

```
@baci/web:typecheck: > tsc --noEmit
Tasks:    1 successful, 1 total
```

If TypeScript reports issues, they're almost certainly about JSX-children/fragments — adjust the wrapping per the rules in Step 3.3.

- [ ] **Step 3.6: Review gate — route mount**

Stop and inspect the route diff before broader verification:

```markdown
### Review gate: route mount

- Changed files: category PDP `page.tsx`, category PDP `page.test.tsx`
- Gate command: `LEFTHOOK=0 pnpm turbo typecheck --filter=@baci/web`
- Template scope: hint renders only when `templateId === OGABASSEY_TEMPLATE_ID`
- Generic scope: generic template test proves no OgaBassey preload hint renders
- SEO/JSON-LD safety: existing product and breadcrumb schema output remains unchanged
- Decision: `<continue | revise | stop>`
```

Continue only if the preload is mounted next to the OgaBassey PDP render path, not in a parent layout or generic storefront route.

---

## Task 4: Wider verification (existing tests should not regress)

Because we didn't touch any client component, the surface area is small. But run the storefront test scope to catch any unexpected coupling — including the active category route and PDP page tests.

- [ ] **Step 4.1: Run scoped tests**

```bash
cd /Users/mac/Baci-app/.worktrees/pdp-banner-lcp-priority/apps/web
LEFTHOOK=0 pnpm exec vitest run \
  src/app/'(storefront)'/ogabassey/ogabassey-pdp-static-resource-hints.test.tsx \
  src/app/'(storefront)'/ogabassey/ogabassey-static-resource-hints.test.tsx \
  src/app/'(storefront)'/'[slug]'/'(catalog)'/'[category]'/'[productSlug]'/page.test.tsx \
  src/components/storefront/ogabassey/pages/product-details-page.test.tsx \
  src/components/storefront/ogabassey/pages/product-details.test.tsx \
  src/components/storefront/ogabassey/pages/category-page.test.tsx \
  src/components/storefront/ogabassey/pages/category.test.tsx \
  src/components/storefront/ogabassey/components/BannerCarousel.test.tsx
```

Expected: all green.

If a page test fails, it's likely because the test snapshots / DOM queries assume the route returns exactly one root child — fix by wrapping in a fragment in the test mock (or updating the query) without weakening the assertion's intent.

- [ ] **Step 4.2: Run lint scoped to changed files**

```bash
cd /Users/mac/Baci-app/.worktrees/pdp-banner-lcp-priority
LEFTHOOK=0 pnpm exec biome check --write \
  apps/web/src/app/'(storefront)'/ogabassey/ogabassey-pdp-static-resource-hints.tsx \
  apps/web/src/app/'(storefront)'/ogabassey/ogabassey-pdp-static-resource-hints.test.tsx \
  apps/web/src/app/'(storefront)'/'[slug]'/'(catalog)'/'[category]'/'[productSlug]'/page.tsx \
  apps/web/src/app/'(storefront)'/'[slug]'/'(catalog)'/'[category]'/'[productSlug]'/page.test.tsx
```

Expected: `Checked 4 files in NNms. No fixes applied.` (or any formatting auto-fixes are accepted).

- [ ] **Step 4.3: Run package lint**

```bash
cd /Users/mac/Baci-app/.worktrees/pdp-banner-lcp-priority
LEFTHOOK=0 pnpm turbo lint --filter=@baci/web
```

Expected:

```
@baci/web:lint: Checked N files in NNms. No fixes applied.
Tasks:    1 successful, 1 total
```

- [ ] **Step 4.4: Run repo-wide typecheck once more (defensive)**

```bash
cd /Users/mac/Baci-app/.worktrees/pdp-banner-lcp-priority
LEFTHOOK=0 pnpm turbo typecheck --filter=@baci/web
```

Expected: green. (Same command as 3.5 but rerun after 4.2's auto-format and 4.3's package lint.)

- [ ] **Step 4.5: Run the web package test gate before opening the PR**

```bash
cd /Users/mac/Baci-app/.worktrees/pdp-banner-lcp-priority
LEFTHOOK=0 pnpm turbo test --filter=@baci/web
```

Expected: green. If this exposes an apparently unrelated failure, stop and capture the failing suite names/current failure text; do not open the PR until the failure is resolved or the user explicitly approves proceeding with that known gate failure.

- [ ] **Step 4.6: Review gate — verification results**

Stop and summarize verification before review/commit:

```markdown
### Review gate: verification

- Scoped Vitest: `<pass/fail with command>`
- Biome changed-file check: `<pass/fail with command>`
- Package lint: `<pass/fail with command>`
- Package typecheck: `<pass/fail with command>`
- Web package tests: `<pass/fail with command>`
- Diff risk review: no duplicate preloads, no mobile media cost, no generic-template leakage, no client bundle widening
- Decision: `<continue | revise | stop>`
```

Continue only if all planned gates pass. If a gate fails, fix or document the exact failure and get explicit user approval before opening a PR.

---

## Task 5: Commit + push + open PR

- [ ] **Step 5.0a: Run CodeRabbit AI review on uncommitted changes**

```bash
cd /Users/mac/Baci-app/.worktrees/pdp-banner-lcp-priority
coderabbit review --prompt-only -t uncommitted -c AGENTS.md
```

Expected: CodeRabbit completes. Fix all actionable critical/high/major feedback before committing. If CodeRabbit returns only non-blocking comments, either apply the small correction immediately or document why it is intentionally skipped in the PR notes.

- [ ] **Step 5.1: Commit**

```bash
cd /Users/mac/Baci-app/.worktrees/pdp-banner-lcp-priority
git add \
  apps/web/src/app/'(storefront)'/ogabassey/ogabassey-pdp-static-resource-hints.tsx \
  apps/web/src/app/'(storefront)'/ogabassey/ogabassey-pdp-static-resource-hints.test.tsx \
  apps/web/src/app/'(storefront)'/'[slug]'/'(catalog)'/'[category]'/'[productSlug]'/page.tsx \
  apps/web/src/app/'(storefront)'/'[slug]'/'(catalog)'/'[category]'/'[productSlug]'/page.test.tsx \
  docs/audits/2026-05-13-storefront-lcp-baseline.md
LEFTHOOK=0 git commit -m "$(cat <<'EOF'
perf(storefront): preload PDP banner LCP image via server-emitted link hint

PSI lab capture 2026-05-13 found the OgaBassey PDP desktop LCP element
is the Flash Sale banner image, and separate audit observations showed
late banner resource discovery. The image cannot be discovered from the
rendered DOM because BannerCarousel is imported via dynamic({ ssr: false })
in ProductDetailsPage and gated behind a post-hydration isDesktop
useEffect — by the time the carousel mounts and emits its <img>, LCP
has already been measured against a delayed network request.

Mirrors the home hero preload pattern shipped in PR #1607, but derives
the preload imageSrcSet/imageSizes through getImageProps with the same
fill/sizes shape as BannerCarousel and the explicit app imageLoader.
The browser preloads the same transformed
/image/width=...,quality=75,format=webp candidates that BannerCarousel
will request after hydration instead of wasting bandwidth on the raw AVIF.
The link is scoped to media="(min-width: 768px)" so mobile (where the
carousel is hidden via CSS) doesn't pay for it. React 19 hoists the
link into <head> during SSR.

Strategy notes:
- Does NOT change BannerCarousel.tsx — its dynamic + isDesktop gate
  exists to keep the carousel JS off the mobile bundle, which we want
  to preserve.
- Does NOT add a `preload` prop to <Image> — Next.js Image docs
  discourage combining `preload` with explicit `fetchPriority`, and
  the team's vetted pattern is manual <link> hints for storefront
  preload anyway.
- Does NOT duplicate CDN warmup hints — OgabasseyStorefrontLayout
  already emits dns-prefetch + preconnect for the CDN.

Audit: docs/audits/2026-05-13-storefront-lcp-baseline.md (Finding 2).
Expected PDP desktop after deploy: LCP <1500ms and same-run resource
load delay <500ms.
EOF
)"
```

Expected: commit succeeds. Verify with `git log --oneline -1`.

- [ ] **Step 5.2: Push the branch**

```bash
cd /Users/mac/Baci-app/.worktrees/pdp-banner-lcp-priority
LEFTHOOK=0 git push -u origin codex/pdp-banner-lcp-priority
```

Expected: `* [new branch] codex/pdp-banner-lcp-priority -> codex/pdp-banner-lcp-priority`.

- [ ] **Step 5.3: Open the PR**

```bash
cd /Users/mac/Baci-app/.worktrees/pdp-banner-lcp-priority
gh pr create --base main --head codex/pdp-banner-lcp-priority \
  --title "perf(storefront): preload PDP banner LCP image via server-emitted link hint" \
  --body "$(cat <<'BODY'
## Summary

PSI lab capture (2026-05-13) showed the OgaBassey PDP desktop LCP element is the Flash Sale banner image, and the audit identified late banner image discovery as the relevant LCP bottleneck. The image cannot be discovered from the initial HTML today because [\`product-details-page.tsx\`](https://github.com/ogabasseyy/Baci/blob/main/apps/web/src/components/storefront/ogabassey/pages/product-details-page.tsx#L21) imports \`BannerCarousel\` via \`dynamic(..., { ssr: false })\` and gates the render behind \`isDesktop\` (post-hydration \`useEffect\`).

This PR adds a server-emitted \`<link rel=\"preload\">\` for the Flash Sale image scoped to \`media=\"(min-width: 768px)\"\`, mirroring the home hero preload pattern shipped in PR #1607 while deriving the exact transformed \`imageSrcSet\`/\`imageSizes\` through \`getImageProps\` with the same \`fill + sizes\` shape as \`BannerCarousel\` and the explicit app \`imageLoader\`. The app's custom image loader rewrites OgaBassey CDN assets to \`/image/width=...,quality=75,format=webp...\`; the preload candidates must match those URLs or the browser will download the raw AVIF and then fetch the transformed WebP again when the carousel mounts. The dynamic carousel still mounts client-side as before — only now the same transformed image is already loading by the time it does.

## What changed

| Change | File |
|---|---|
| New | \`apps/web/src/app/(storefront)/ogabassey/ogabassey-pdp-static-resource-hints.tsx\` |
| New (test) | \`apps/web/src/app/(storefront)/ogabassey/ogabassey-pdp-static-resource-hints.test.tsx\` |
| Mount the hint | \`apps/web/src/app/(storefront)/[slug]/(catalog)/[category]/[productSlug]/page.tsx\` |
| Route gating test | \`apps/web/src/app/(storefront)/[slug]/(catalog)/[category]/[productSlug]/page.test.tsx\` |

## What did NOT change

| Why preserved | File |
|---|---|
| Keep BannerCarousel off mobile bundle | \`BannerCarousel.tsx\` (dynamic import + isDesktop gate intact) |
| No \`preload\` + \`fetchPriority\` conflict | \`next/image\` props (manual \`<link>\` hint used instead) |
| No duplicate CDN warmup calls | \`OgabasseyStorefrontLayout\` already emits CDN DNS-prefetch/preconnect |
| Home decision module is single-purpose | \`storefront-hero-preload-decision.tsx\` |

## Why not the previous strategy (flip \`preload\` on BannerCarousel)

Earlier revision tried flipping props inside \`BannerCarousel\`. That doesn't help PDP because BannerCarousel is dynamic + post-hydration on the active PDP route — any image-prop hints emitted at mount-time are post-LCP-window. The fix has to land in the initial HTML; only a Server Component preload achieves that.

Next.js docs also discourage \`preload\` + \`fetchPriority\` together on \`<Image>\` ([Image#preload](https://nextjs.org/docs/app/api-reference/components/image#preload)), so a manual \`<link>\` hint is the right surface. The hint uses \`imageSrcSet\`/\`imageSizes\` from \`getImageProps\` with the explicit app \`imageLoader\` so it matches the custom image loader's transformed request in both production and unit tests.

## Verification

- \`pnpm exec vitest run src/app/'(storefront)'/ogabassey/ogabassey-pdp-static-resource-hints.test.tsx\` — green (new component asserted, including transformed WebP URL/srcset)
- \`pnpm exec vitest run src/app/'(storefront)'/'[slug]'/'(catalog)'/'[category]'/'[productSlug]'/page.test.tsx\` — green (route gate asserted)
- \`pnpm turbo typecheck --filter=@baci/web\` — green
- \`pnpm turbo lint --filter=@baci/web\` — green
- \`pnpm turbo test --filter=@baci/web\` — green
- Scoped vitest sweep over PDP/category/banner tests — green

## Expected post-deploy LCP

PDP desktop target: **LCP < 1500 ms** and same-run LCP resource-load-delay subpart **< 500 ms** once the preload starts the image request from the initial HTML parse.

Mobile PDP: still expected to time out in PSI due to JS heaviness (TBT 1490 ms × 4 mobile slowdown). That's tracked separately as Finding 3 in the audit.

## Test plan

- [ ] CI green
- [ ] Visual: PDP desktop renders the BannerCarousel correctly after hydration (no behavior regression)
- [ ] Visual: PDP mobile renders correctly (carousel hidden via \`hidden md:block\`, preload doesn't fire for mobile-media)
- [ ] Inspect production HTML: \`view-source:https://ogabassey.com/lenovo/lenovo-legion-pro-9-16irx9-rtx-4090\` after deploy → confirm \`<link rel=\"preload\" imagesrcset=\"https://cdn.ogabassey.com/image/width=...format=webp...\" media=\"(min-width: 768px)\" type=\"image/webp\">\` is in \`<head>\` (React code uses camelCase options like \`imageSrcSet\`, but serialized HTML/DOM inspection commonly shows lowercase attributes)
- [ ] Re-run PSI on PDP desktop, confirm LCP < 1500 ms

Audit: \`docs/audits/2026-05-13-storefront-lcp-baseline.md\` (Finding 2).
BODY
)"
```

Expected: a PR URL printed (e.g. `https://github.com/ogabasseyy/Baci/pull/XXXX`).

- [ ] **Step 5.4: Review gate — PR readiness**

Stop after opening the PR and verify the external review surface:

```markdown
### Review gate: PR readiness

- PR: `<url>`
- Commit: `<sha>`
- CodeRabbit: `<no P1/P2 actionable items | items fixed | skipped with reason>`
- GitHub checks: `<pending | passing | failing with exact check names>`
- Review threads: `<none | unresolved thread URLs>`
- PR description matches implementation: yes/no
- Decision: `<continue to merge-watch | revise PR | stop>`
```

Continue to merge-watch only if the PR description accurately describes the implementation and no known high-severity review item remains unaddressed.

---

## Task 6: Post-merge re-measurement

After the PR merges and the Vercel `deploy-production` check completes:

- [ ] **Step 6.1: Wait for deploy + verify CDN serves new build**

```bash
gh pr view <PR_NUMBER> --json mergedAt,mergeCommit
# Then poll the deploy-production check-run until status=completed conclusion=success
gh api repos/ogabasseyy/Baci/commits/<MERGE_SHA>/check-runs \
  --jq '.check_runs[] | select(.name == "deploy-production") | "\(.status) \(.conclusion)"'
```

Then:

```bash
curl -sI https://ogabassey.com/lenovo/lenovo-legion-pro-9-16irx9-rtx-4090 \
  | grep -iE "^age:|^date:|x-vercel-cache"
```

Expected: `x-vercel-cache: PRERENDER` (fresh from new build) or `age: <60`. If `age: >300` and `x-vercel-cache: HIT`, wait a few minutes for cache rollover and re-check.

- [ ] **Step 6.2: Verify the preload link is in production HTML**

```bash
curl -s https://ogabassey.com/lenovo/lenovo-legion-pro-9-16irx9-rtx-4090 \
  | grep -oiE '<link[^>]*preload[^>]*>' | head -10
```

Expected: at least one line matching the Flash Sale preload. Attribute case can differ between raw server output and DOM serialization, but grep the production output case-insensitively if needed; the important fields are `as="image"`, the transformed `imageSrcSet`/`imagesrcset`, `imageSizes`/`imagesizes`, `fetchPriority`/`fetchpriority`, `media="(min-width: 768px)"`, and `type="image/webp"`. Current React 19 responsive image preloads omit `href` when `imageSrcSet` is supplied.

```html
<link rel="preload" as="image" imagesrcset="https://cdn.ogabassey.com/image/width=640,quality=75,format=webp/core-assets/products/ps5-digital-slim-console-1tb.avif 640w, ... https://cdn.ogabassey.com/image/width=3840,quality=75,format=webp/core-assets/products/ps5-digital-slim-console-1tb.avif 3840w" imagesizes="(max-width: 768px) 100vw, (max-width: 1200px) 80vw, 1400px" fetchpriority="high" media="(min-width: 768px)" type="image/webp"/>
```

If the link is missing from production HTML, the mount in Task 3 isn't firing — diagnose by checking that the route returns the `<OgabasseyPdpStaticResourceHints />` element in its JSX tree (not stripped by a conditional). If the link exists but neither `imageSrcSet` nor `href` contains the transformed `/image/width=...,quality=75,format=webp/...` URL, the component forgot to derive props through `getImageProps()` and will cause duplicate image downloads.

- [ ] **Step 6.3: Re-run PSI on the PDP URL (desktop)**

```bash
PAGESPEED_INSIGHTS_API_KEY="${PAGESPEED_INSIGHTS_API_KEY:?set PAGESPEED_INSIGHTS_API_KEY}" node -e '
const KEY = process.env.PAGESPEED_INSIGHTS_API_KEY;
(async () => {
  const u = "https://ogabassey.com/lenovo/lenovo-legion-pro-9-16irx9-rtx-4090";
  const qs = new URLSearchParams({ url: u, strategy: "desktop", key: KEY, category: "PERFORMANCE" });
  const r = await fetch(`https://www.googleapis.com/pagespeedonline/v5/runPagespeed?${qs}`, { signal: AbortSignal.timeout(180_000) });
  const j = await r.json();
  if (j.error) { console.error(`HTTP ${j.error.code}: ${j.error.message.slice(0,200)}`); return; }
  const lcp = j.lighthouseResult?.audits?.["largest-contentful-paint"];
  const bd = j.lighthouseResult?.audits?.["lcp-breakdown-insight"]?.details?.items?.[0]?.items;
  console.log(`LCP: ${lcp?.numericValue?.toFixed(0)}ms (display: ${lcp?.displayValue})`);
  if (bd) for (const x of bd) console.log(`  ${x.label}: ${x.duration.toFixed(0)}ms`);
})().catch(e => console.error(e.message));
'
```

Expected: LCP < 1500 ms with resource load delay < 500 ms. Compare against a fresh same-run baseline recorded in [docs/audits/2026-05-13-storefront-lcp-baseline.md](../../audits/2026-05-13-storefront-lcp-baseline.md); do not calculate subpart deltas from the older mixed audit observations.

Acceptance: PDP desktop LCP under 1500 ms AND same-run resource load delay under 500 ms.

- [ ] **Step 6.4: Append result to the audit doc on a follow-up docs branch**

Do not push post-merge measurement commits to `codex/pdp-banner-lcp-priority` after that PR is merged; a merged PR branch is no longer the path to `main`. Create a small follow-up docs branch from the updated `origin/main`, append the measurement, and open a docs-only PR.

```bash
cd /Users/mac/Baci-app
git fetch origin main
git worktree add -b codex/pdp-banner-lcp-measurement .worktrees/pdp-banner-lcp-measurement origin/main
cd .worktrees/pdp-banner-lcp-measurement
```

Edit [docs/audits/2026-05-13-storefront-lcp-baseline.md](../../audits/2026-05-13-storefront-lcp-baseline.md). Append a new section:

```markdown
## Re-measurement: post Fix 1 (PDP banner preload hint)

Date: <YYYY-MM-DD>
Merge: PR #<N>, commit `<SHA>`

| Subpart | Pre-fix | Post-fix | Δ |
|---|---|---|---|
| TTFB | <same-run baseline> ms | <N> ms | <Δ> |
| Resource load delay | <same-run baseline> ms | <N> ms | <Δ> |
| Resource load duration | <same-run baseline> ms | <N> ms | <Δ> |
| Element render delay | <same-run baseline> ms | <N> ms | <Δ> |
| **Total LCP** | **<same-run baseline> ms** | **<N> ms** | **<Δ>** |
```

Commit separately:

```bash
git add docs/audits/2026-05-13-storefront-lcp-baseline.md
LEFTHOOK=0 git commit -m "docs(audits): record post-PDP-preload LCP measurement"
LEFTHOOK=0 git push -u origin codex/pdp-banner-lcp-measurement
gh pr create --base main --head codex/pdp-banner-lcp-measurement \
  --title "docs(audits): record post-PDP-preload LCP measurement" \
  --body "Records the post-deploy PSI desktop re-measurement for the OgaBassey PDP banner preload intervention."
```

- [ ] **Step 6.5: Review gate — post-merge measurement**

Stop and compare post-deploy evidence against the target:

```markdown
### Review gate: post-merge measurement

- Production deploy: `<merge sha deployed | not deployed>`
- Production HTML preload: `<present | missing>`
- PDP desktop LCP: `<N> ms`
- Resource load delay: `<N> ms`
- Target met: `<yes | no>`
- Follow-up: `<none | create next optimization plan/PR>`
- Decision: `<close loop | continue iteration | stop>`
```

If PDP desktop LCP remains above 1500 ms or resource load delay remains above 500 ms, do not call the goal complete. Open the next iteration from measured evidence instead of guessing.

---

## Cleanup

- [ ] **Step 7.1: Remove the worktrees once the implementation PR and measurement PR are merged**

```bash
cd /Users/mac/Baci-app
git worktree remove .worktrees/pdp-banner-lcp-priority
git worktree remove .worktrees/pdp-banner-lcp-measurement
```

Expected: worktrees removed cleanly. If the measurement worktree was never created because post-merge measurement was intentionally skipped, remove only `.worktrees/pdp-banner-lcp-priority`.

- [ ] **Step 7.2: Review gate — cleanup**

Confirm no local implementation state is left behind:

```markdown
### Review gate: cleanup

- Implementation worktree removed: `<yes | no with reason>`
- Measurement worktree removed: `<yes | not created | no with reason>`
- Local branches: `<kept intentionally | deleted after merge>`
- Audit doc merged: `<yes | no>`
- Decision: `<complete | follow-up needed>`
```

---

## Notes for the engineer

- **Why this works:** React 19 hoists `<link>` elements rendered inside Server Components into the document `<head>` automatically. The preload starts the image fetch during HTML parse, well before any client JS executes. By the time `BannerCarousel` mounts (post-hydration), the image is in the browser cache and renders instantly.

- **Why media-scoping matters:** the PDP wrapper at [product-details-page.tsx:183](../../../apps/web/src/components/storefront/ogabassey/pages/product-details-page.tsx) uses `hidden md:block` — the carousel is invisible on mobile viewports. Without the `media="(min-width: 768px)"` constraint, mobile browsers would download the image and never use it. The media query keeps mobile bundles + bandwidth clean.

- **What this PR does NOT fix:** PDP JS heaviness (TBT 1490 ms, 291 KiB unused JS) — that's why mobile PDP times out in PSI even after this preload lands. Tracked separately as Finding 3 in the audit. A bundle-analyzer-driven plan should come next.

- **Why no decision component:** the existing [storefront-hero-preload-decision.tsx](../../../apps/web/src/app/(storefront)/[slug]/storefront-hero-preload-decision.tsx) gates on `isStorefrontHomePath`. We could extend it to also handle PDP, but the active PDP route Server Component already knows it's rendering the OgaBassey template (it explicitly renders `<OgabasseyProductPage>`). Mounting the hints directly next to that JSX is simpler and avoids growing the decision module's surface area. If a second PDP-variant template is ever introduced, refactor toward a decision component then.
