# Ogabassey Shared Comparison Spec Matrix Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make Ogabassey product comparisons, SEO compare pages, product structured data, and blog-agent comparison tables consume one shared server-side spec matrix instead of separate partial implementations.

**Architecture:** Keep the distinct surfaces: PDP interactive comparison widget, public SEO compare pages, product pages, and blog articles. Consolidate the data/query/matrix layer underneath them. Dedicated compare pages and blog tables must be server-side/cache driven for crawlability; the PDP widget can stay client-interactive but should receive and fetch the same matrix shape.

**Tech Stack:** Next.js 16 App Router, TypeScript, Supabase/PostgREST, React 19, Vitest, Biome, R2/agent cache for external blog automation.

---

## Direct decisions

1. **Do not collapse all user-facing routes into one route.** The PDP widget, SEO compare page, category support links, and blog pages serve different UX/search purposes.
2. **Do consolidate the duplicated data layer.** There should be one product full-select, one product mapper, one spec taxonomy, and one matrix builder.
3. **Yes, blogs should consume the same matrix.** Blog agents should not invent their own small comparison field list.
4. **Yes, SEO-critical tables should be server-side driven.** Compare pages and blog tables need real HTML tables in initial HTML or published Markdown/HTML, not only client-rendered widgets.
5. **Keep compact product listing payloads small.** Only full/detail/compare queries should include `product_key_specs` and full specs.

---

## Koray and Google technical SEO hardening decisions

These decisions are required before implementation. They prevent the shared matrix from becoming a crawlable thin-page factory.

1. **Curate indexable compare URLs.** Do not let every arbitrary `left-vs-right` permutation become indexable just because it has three different specs. Indexable compare pages must come from a curated inventory: sitemap-supported category links, product support links, or matrix-approved comparison targets. Non-curated compare URLs should return `notFound()` or `noindex` according to the existing route pattern.
2. **Keep one canonical relationship per comparison.** Product compare slugs must stay sorted/canonicalized. Internal links, sitemap entries, blog links, and canonical metadata must all point to the same canonical URL.
3. **Use EAV-first semantic templates.** Each compare page/article must clearly state Entity -> Attribute -> Value facts: product/entity names, attributes, values, and buyer implication. Avoid generic paragraphs that restate table values without added judgment.
4. **Require visible-content and JSON-LD parity.** Every structured-data property from specs must be visible in the rendered page or product page content. Do not mark up hidden or hallucinated facts.
5. **Treat rich-result eligibility correctly.** Product structured data is strongest on individual product/variant pages. Compare pages can use `WebPage`, `BreadcrumbList`, and conditional `ItemList`/`Product` for understanding, but implementation must not assume Google will show product rich results for multi-product comparison pages. Keep visible FAQ content if useful to buyers, but do **not** emit `FAQPage` JSON-LD for Ogabassey compare pages because Google limits FAQ rich results to well-known authoritative government or health sites.
6. **Keep Product JSON-LD in initial HTML.** Product schema, offer price, availability, condition, and spec `additionalProperty` should be server-rendered. Do not move JSON-LD to a client-only widget.
7. **Add fact provenance to the matrix.** The matrix export must include `source`, `source_updated_at`, and `confidence` metadata for every exported product/spec group. Blog agents must say “Not listed” for absent facts, not infer values.
8. **Constrain internal links.** Compare pages and blogs should link to product A, product B, the category hub, one relevant guide/support article, and at most a small number of contextual supporting links. Avoid broad automated link blocks that dilute topical signals.
9. **Use the matrix as a semantic source, not just a UI table.** The same matrix should power headings, key-difference bullets, FAQ answers, Product JSON-LD additional properties, compare table rows, and blog tables.
10. **Preserve page performance.** Server-rendered tables must be bounded. Keep payloads compact, avoid rendering all specs for every product list, and verify initial HTML/page size does not regress materially.
11. **Keep agent egress low.** Blog agents must read the local/R2 matrix cache for catalog/spec facts. Do not make every daily agent run refetch the full product catalog; use one scheduled matrix refresh with change-hash/ETag checks and let category/news/comparison agents consume the same cached object.

---

## Current issues to fix

- `/Users/mac/Baci-app/apps/web/src/lib/product-key-specs-select.ts` has the rich `PRODUCT_KEY_SPECS_RELATION_SELECT`.
- `/Users/mac/Baci-app/apps/web/src/app/api/storefront/products/product-response.ts` imports that rich relation, but appears not to be used by the active `/api/storefront/products` route.
- `/Users/mac/Baci-app/apps/web/src/lib/storefront-products-select.ts` defines the active `STOREFRONT_PRODUCTS_SELECT`, but it does not include `product_key_specs`.
- `/Users/mac/Baci-app/apps/web/src/components/storefront/ogabassey/components/ProductComparisonTable.tsx` requests `compact=false`, expecting detailed data, but the active full select does not guarantee `product_key_specs`.
- `/Users/mac/Baci-app/apps/web/src/lib/storefront-compare/load-compare-page.ts` builds SEO compare rows from summary specs, not the deeper detailed spec matrix.
- The external Ogabassey blog agent currently uses a thinner catalog spec subset than the web app spec system.
- `/Users/mac/Baci-app/apps/web/src/lib/cached-data.ts` still duplicates a manual `product_key_specs (...)` detail projection, so PDP/compare cached data can drift from the shared relation select unless it is consolidated too.

---

## Target file structure

### Create

- `/Users/mac/Baci-app/apps/web/src/lib/storefront-specs/spec-taxonomy.ts`
  - Owns category/field definitions for comparable specs.
  - Replaces component-local taxonomy as the source of truth.

- `/Users/mac/Baci-app/apps/web/src/lib/storefront-specs/variant-attributes.ts`
  - Owns variant-axis normalization used by spec fallback rows and PDP option selectors.
  - Keeps shared spec code from importing utilities from the component folder.

- `/Users/mac/Baci-app/apps/web/src/lib/storefront-specs/spec-data.ts`
  - Owns `buildProductSpecData` and normalizes description specs, structured specs, and fallback specs.
  - Server-safe; no React imports.

- `/Users/mac/Baci-app/apps/web/src/lib/storefront-specs/spec-matrix.ts`
  - Owns `buildProductComparisonMatrix` for two or more products.
  - Produces semantic rows for compare pages, PDP widgets, and blog agents.

- `/Users/mac/Baci-app/apps/web/src/lib/storefront-specs/spec-matrix.test.ts`
  - Covers row union, category grouping, missing values, and differentiating row counts.

- `/Users/mac/Baci-app/apps/web/src/lib/storefront-compare/compare-indexability-policy.ts`
  - Owns the rule that only curated comparison URLs are indexable.
  - Combines category support links, PDP support links, and matrix-exported approved compare slugs.
  - Exports one shared approved-slug builder so the web route and agent matrix export use the same curation logic.

- `/Users/mac/Baci-app/apps/web/src/lib/storefront-compare/compare-indexability-policy.test.ts`
  - Proves arbitrary product pair permutations do not become indexable.

- `/Users/mac/Baci-app/apps/web/src/lib/storefront-specs/spec-data.test.ts`
  - Moves/expands tests for key spec formatting and fallback behavior.

- `/Users/mac/Baci-app/apps/web/src/lib/storefront-products-full-select.ts`
  - Required canonical full product select used by API/detail/compare consumers.
  - Must include `PRODUCT_KEY_SPECS_RELATION_SELECT`, `specifications`, `variant_attributes`, pricing, stock, `created_at`, `updated_at`, and category fields.

### Modify

- `/Users/mac/Baci-app/apps/web/src/components/storefront/ogabassey/variant-attributes.ts`
  - Convert into a compatibility re-export around the shared server-safe variant utility.

- `/Users/mac/Baci-app/apps/web/src/components/storefront/ogabassey/product-spec-data.ts`
  - Convert into a compatibility re-export/wrapper around the shared server-safe spec library.

- `/Users/mac/Baci-app/apps/web/src/lib/product-key-specs-select.ts`
  - Add relation-level provenance field `created_at` if live schema verification confirms it exists.

- `/Users/mac/Baci-app/apps/web/src/lib/storefront-products-select.ts`
  - Keep compact select lean and re-export/import the canonical full select where legacy imports require `STOREFRONT_PRODUCTS_SELECT`.

- `/Users/mac/Baci-app/apps/web/src/lib/cached-data.ts`
  - Reuse `PRODUCT_KEY_SPECS_RELATION_SELECT` in product detail selects instead of duplicating partial relation fields.
  - Add product-level `created_at` and `updated_at` to cached product detail data for matrix/export provenance.

- `/Users/mac/Baci-app/apps/web/src/app/api/storefront/products/storefront-products-route-data.ts`
  - Use the single full select and map `product_key_specs` into API responses.

- `/Users/mac/Baci-app/apps/web/src/app/api/storefront/products/product-response.ts`
  - Remove duplication or convert to re-export from the single source.

- `/Users/mac/Baci-app/apps/web/src/app/api/storefront/products/route.ts`
  - Continue using compact by default.
  - Use full select when `compact=false`.

- `/Users/mac/Baci-app/apps/web/src/components/storefront/ogabassey/components/ProductComparisonTable.tsx`
  - Use the shared matrix shape for rows.
  - Keep it as a client component only for interactivity/search.

- `/Users/mac/Baci-app/apps/web/src/lib/storefront-compare/load-compare-page.ts`
  - Build compare rows from `buildProductComparisonMatrix`, not only summary specs.

- `/Users/mac/Baci-app/apps/web/src/app/(storefront)/[slug]/(catalog)/(listing)/[category]/compare/[comparisonSlug]/compare-page-content.tsx`
  - Keep rendering a semantic `<table>`.
  - Render category group headers if the matrix includes grouped rows.

- `/Users/mac/Baci-app/apps/web/src/lib/storefront-compare/compare-schema.ts`
  - Remove compare-page `FAQPage` JSON-LD output for Ogabassey/non-government/non-health pages.
  - Add conditional `ItemList`/`Product` understanding schema for product compare pages, with `additionalProperty` sourced from visible matrix rows only.

- `/home/bassey/ogabassey-agents/codex_content_agent/catalog.py` on VPS
  - Replace thin hardcoded `product_key_specs(...)` subset with the shared exported matrix fields/cache schema.

- `/home/bassey/ogabassey-agents/codex_content_agent/candidates.py` on VPS
  - Select comparison candidates from matrix-backed products and only emit canonical `target_compare_slug` values.

- `/home/bassey/ogabassey-agents/codex_content_agent/prompt_builder.py` on VPS
  - Instruct comparison drafts to render tables from matrix rows and write distinct editorial verdicts.

- `/home/bassey/ogabassey-agents/codex_content_agent/validators.py` on VPS
  - Enforce comparison table, verdict, target product, target compare slug, and internal-link constraints.

---

## Task 0: Baseline audit and route inventory lock

**Files:**
- Read only: `/Users/mac/Baci-app/apps/web/src/app/(storefront)/[slug]/(catalog)/(listing)/[category]/compare/[comparisonSlug]/page.tsx`
- Read only: `/Users/mac/Baci-app/apps/web/src/app/(storefront)/[slug]/(catalog)/(listing)/[category]/compare/[comparisonSlug]/compare-page-content.tsx`
- Read only: `/Users/mac/Baci-app/apps/web/src/lib/storefront-compare/load-compare-page.ts`
- Read only: `/Users/mac/Baci-app/apps/web/src/lib/storefront-compare/build-commercial-support-links.ts`
- Read only: `/Users/mac/Baci-app/apps/web/src/lib/seo-utils.ts`
- Read only: `/Users/mac/Baci-app/apps/web/src/lib/storefront-products-select.ts`
- Read only: `/home/bassey/ogabassey-agents/codex_content_agent/catalog.py`
- Output: update this plan if the route/file map has drifted before implementation.

- [ ] **Step 1: Confirm active compare/product routes and selects**

Run:

```bash
rg -n "loadComparePage|buildCategorySupportLinks|PRODUCT_KEY_SPECS_RELATION_SELECT|STOREFRONT_PRODUCTS_SELECT|generateProductSchema" \
  /Users/mac/Baci-app/apps/web/src/app \
  /Users/mac/Baci-app/apps/web/src/lib \
  --glob '!**/.next/**'
```

Expected: identifies the active compare route, active products API route, product schema generator, and current full/compact select sources.

- [ ] **Step 2: Confirm current server HTML behavior before changes**

Run the dev server in a separate terminal, then curl a known product page and compare page:

```bash
pnpm --filter @baci/web dev
```

```bash
curl -s 'http://localhost:3000/ogabassey/smartphones' | head -c 500
curl -s 'http://localhost:3000/ogabassey/smartphones/compare/iphone-17-pro-max-vs-samsung-galaxy-z-trifold' | rg '<table|canonical|application/ld\+json|noindex' -n
```

Expected: record whether current compare table and JSON-LD appear in initial HTML. If the exact sample URL is unavailable locally, use one URL emitted by `buildCategorySupportLinks` or the storefront sitemap tests.

- [ ] **Step 3: Confirm current agent field subset**

Run:

```bash
ssh bassey@82.29.190.219 'cd /home/bassey/ogabassey-agents && grep -RIn "product_key_specs" codex_content_agent/catalog.py codex_content_agent/candidates.py codex_content_agent/prompt_builder.py'
```

Expected: confirms whether the agent still uses a thin `product_key_specs(...)` field subset. If it already changed, update Task 7 before executing.

- [ ] **Step 4: Capture baseline counts for later comparison**

Run:

```bash
ssh bassey@82.29.190.219 'cd /home/bassey/ogabassey-agents && python3 - <<"PY"
import json, pathlib
for name in ["catalog-products.json", "blog-posts-full.json", "editorial-desk-backlog.json"]:
    p = pathlib.Path("data/cache") / name
    if p.exists():
        data = json.loads(p.read_text())
        print(name, len(data) if isinstance(data, list) else sorted(data.keys())[:10])
PY'
```

Expected: records existing cache sizes so implementation can prove no product/blog coverage regression.

---

## Task 1: Add a shared spec taxonomy

**Files:**
- Create: `/Users/mac/Baci-app/apps/web/src/lib/storefront-specs/variant-attributes.ts`
- Create: `/Users/mac/Baci-app/apps/web/src/lib/storefront-specs/spec-taxonomy.ts`
- Create: `/Users/mac/Baci-app/apps/web/src/lib/storefront-specs/spec-data.ts`
- Modify: `/Users/mac/Baci-app/apps/web/src/components/storefront/ogabassey/variant-attributes.ts`
- Modify: `/Users/mac/Baci-app/apps/web/src/components/storefront/ogabassey/product-spec-data.ts`
- Test: `/Users/mac/Baci-app/apps/web/src/lib/storefront-specs/spec-data.test.ts`
- Test: `/Users/mac/Baci-app/apps/web/src/components/storefront/ogabassey/variant-attributes.test.ts`
- Test: `/Users/mac/Baci-app/apps/web/src/components/storefront/ogabassey/product-spec-data.test.ts`

- [ ] **Step 1: Write taxonomy tests**

Create `/Users/mac/Baci-app/apps/web/src/lib/storefront-specs/spec-data.test.ts` with tests proving the taxonomy formats core Ogabassey phone specs consistently.

```ts
import { describe, expect, it } from 'vitest';
import { buildProductSpecData } from './spec-data';

describe('buildProductSpecData', () => {
  it('builds detailed grouped specs from product_key_specs', () => {
    const result = buildProductSpecData({
      brand: 'Samsung',
      category: 'Smartphones',
      condition: 'new',
      product_key_specs: {
        display_type: 'Dynamic AMOLED 2X',
        screen_size_inches: 6.8,
        refresh_rate_hz: 120,
        chipset: 'Snapdragon 8 Elite',
        ram_gb: 12,
        storage_gb: 256,
        main_camera_mp: 200,
        battery_mah: 5000,
        charging_watt: 45,
        has_5g: true,
      },
    });

    expect(result.detailedSpecs).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ category: 'Display' }),
        expect.objectContaining({ category: 'Platform' }),
        expect.objectContaining({ category: 'Memory' }),
        expect.objectContaining({ category: 'Battery' }),
      ])
    );
    expect(result.specs).toEqual(
      expect.arrayContaining([
        { label: 'Display', value: '6.8 inches' },
        { label: 'Processor', value: 'Snapdragon 8 Elite' },
        { label: 'RAM', value: '12GB' },
        { label: 'Storage', value: '256GB' },
        { label: 'Camera', value: 'Single 200MP' },
        { label: 'Battery', value: '5000mAh' },
      ])
    );
  });
});
```

- [ ] **Step 2: Run the test and verify it fails**

```bash
pnpm --filter @baci/web exec vitest run src/lib/storefront-specs/spec-data.test.ts
```

Expected: fails because `spec-data.ts` does not exist yet.

- [ ] **Step 3: Move variant normalization to shared lib first**

Create `/Users/mac/Baci-app/apps/web/src/lib/storefront-specs/variant-attributes.ts` by moving the full contents of `/Users/mac/Baci-app/apps/web/src/components/storefront/ogabassey/variant-attributes.ts` into the new file unchanged.

Then replace `/Users/mac/Baci-app/apps/web/src/components/storefront/ogabassey/variant-attributes.ts` with this compatibility wrapper:

```ts
export type { VariantAttributeSource } from '@/lib/storefront-specs/variant-attributes';
export {
  canonicalizeVariantAxis,
  getAvailableOptionsForAxis,
  getRenderableVariantAxes,
  getVariantAttributeOptions,
  mergeVariantAxisOptions,
  normalizeVariantAttributes,
} from '@/lib/storefront-specs/variant-attributes';
```

- [ ] **Step 4: Move taxonomy out of component folder**

Create `/Users/mac/Baci-app/apps/web/src/lib/storefront-specs/spec-taxonomy.ts` and move the current taxonomy from `/Users/mac/Baci-app/apps/web/src/components/storefront/ogabassey/product-spec-data.ts` into it.

Use these exact export names and preserve the current category order so existing summaries remain stable.

```ts
export interface ComparableProductKeySpecs {
  [key: string]: unknown;
  android_version?: string | number;
  battery_removable?: boolean;
  card_slot_type?: string;
  has_card_slot?: boolean;
  has_dual_camera?: boolean;
  has_quad_camera?: boolean;
  has_reverse_charging?: boolean;
  has_triple_camera?: boolean;
  has_usb_otg?: boolean;
  has_wireless_charging?: boolean;
  wireless_charging_watt?: number;
}

export interface SpecField {
  key: string;
  label: string;
  dynamicLabel?: (specs: ComparableProductKeySpecs) => string;
  transform?: (value: unknown, allSpecs: ComparableProductKeySpecs) => string;
  condition?: (specs: ComparableProductKeySpecs) => boolean;
}

export interface SpecCategory {
  category: string;
  fields: SpecField[];
}

export const KEY_SPEC_CATEGORIES: SpecCategory[] = [
  {
    category: 'Network',
    fields: [
      { key: 'network_technology', label: 'Technology' },
      { key: 'has_5g', label: '5G Support', transform: (v: unknown) => (v ? 'Yes' : 'No') },
    ],
  },
  {
    category: 'Body',
    fields: [
      { key: 'dimensions_mm', label: 'Dimensions' },
      { key: 'weight_g', label: 'Weight', transform: (v: unknown) => `${v}g` },
      { key: 'build_materials', label: 'Build' },
      { key: 'sim_type', label: 'SIM' },
      { key: 'ip_rating', label: 'Protection' },
    ],
  },
  {
    category: 'Display',
    fields: [
      { key: 'display_type', label: 'Type' },
      { key: 'screen_size_inches', label: 'Size', transform: (v: unknown) => `${v} inches` },
      { key: 'display_resolution', label: 'Resolution' },
      { key: 'refresh_rate_hz', label: 'Refresh Rate', transform: (v: unknown) => `${v}Hz` },
      { key: 'display_ppi', label: 'Pixel Density', transform: (v: unknown) => `${v} ppi` },
      { key: 'display_peak_brightness', label: 'Peak Brightness', transform: (v: unknown) => `${v} nits` },
      { key: 'display_protection', label: 'Protection' },
    ],
  },
  {
    category: 'Platform',
    fields: [
      { key: 'android_version', label: 'OS', transform: (v: unknown) => `Android ${v}` },
      { key: 'chipset', label: 'Chipset' },
      { key: 'cpu_cores', label: 'CPU' },
      { key: 'gpu', label: 'GPU' },
    ],
  },
  {
    category: 'Memory',
    fields: [
      {
        key: 'has_card_slot',
        label: 'Card Slot',
        transform: (_v: unknown, allSpecs: ComparableProductKeySpecs) =>
          allSpecs.has_card_slot ? allSpecs.card_slot_type || 'Yes' : 'No',
      },
      { key: 'storage_gb', label: 'Internal Storage', transform: (v: unknown) => `${v}GB` },
      { key: 'ram_gb', label: 'RAM', transform: (v: unknown) => `${v}GB` },
    ],
  },
  {
    category: 'Main Camera',
    fields: [
      {
        key: 'main_camera_mp',
        label: 'Camera',
        dynamicLabel: (allSpecs: ComparableProductKeySpecs) =>
          allSpecs.has_quad_camera
            ? 'Quad Camera'
            : allSpecs.has_triple_camera
              ? 'Triple Camera'
              : allSpecs.has_dual_camera
                ? 'Dual Camera'
                : 'Single Camera',
        transform: (v: unknown) => `${v}MP`,
      },
      { key: 'rear_camera_features', label: 'Features' },
      { key: 'rear_camera_video', label: 'Video' },
    ],
  },
  {
    category: 'Selfie Camera',
    fields: [
      { key: 'front_camera_mp', label: 'Resolution', transform: (v: unknown) => `${v}MP` },
      { key: 'front_camera_features', label: 'Features' },
      { key: 'front_camera_video', label: 'Video' },
    ],
  },
  {
    category: 'Sound',
    fields: [
      {
        key: 'has_stereo_speakers',
        label: 'Loudspeaker',
        transform: (v: unknown) => (v ? 'Yes, with stereo speakers' : 'Yes (mono)'),
      },
      {
        key: 'has_headphone_jack',
        label: '3.5mm Jack',
        transform: (v: unknown) => (v ? 'Yes' : 'No'),
      },
    ],
  },
  {
    category: 'Connectivity',
    fields: [
      { key: 'wifi_bands', label: 'WLAN' },
      { key: 'bluetooth_version', label: 'Bluetooth' },
      { key: 'positioning', label: 'Positioning' },
      { key: 'has_nfc', label: 'NFC', transform: (v: unknown) => (v ? 'Yes' : 'No') },
      { key: 'has_fm_radio', label: 'Radio', transform: (v: unknown) => (v ? 'FM Radio' : 'No') },
      {
        key: 'usb_type',
        label: 'USB',
        transform: (v: unknown, allSpecs: ComparableProductKeySpecs) =>
          `${String(v)}${allSpecs.has_usb_otg ? ', OTG' : ''}`,
      },
    ],
  },
  {
    category: 'Features',
    fields: [
      { key: 'fingerprint_type', label: 'Fingerprint' },
      { key: 'sensors', label: 'Sensors' },
    ],
  },
  {
    category: 'Battery',
    fields: [
      {
        key: 'battery_mah',
        label: 'Capacity',
        transform: (v: unknown, allSpecs: ComparableProductKeySpecs) =>
          `${v}mAh${allSpecs.battery_removable ? ' (removable)' : ''}`,
      },
      { key: 'charging_watt', label: 'Wired Charging', transform: (v: unknown) => `${v}W` },
      {
        key: 'wireless_charging_watt',
        label: 'Wireless Charging',
        transform: (v: unknown) => `${v}W`,
        condition: (allSpecs: ComparableProductKeySpecs) =>
          Boolean(allSpecs.has_wireless_charging),
      },
      {
        key: 'has_reverse_charging',
        label: 'Reverse Charging',
        transform: () => 'Yes',
        condition: (allSpecs: ComparableProductKeySpecs) =>
          Boolean(allSpecs.has_reverse_charging),
      },
    ],
  },
  {
    category: 'Misc',
    fields: [
      { key: 'available_colors', label: 'Colors' },
      { key: 'model_numbers', label: 'Models' },
    ],
  },
];

export const SUMMARY_SPEC_PRIORITIES = [
  {
    label: 'Display',
    candidates: [
      ['Key Specs', 'Display'],
      ['Key Specs', 'Screen'],
      ['Display', 'Size'],
      ['Display', 'Screen Size'],
      ['General', 'Display'],
    ],
  },
  {
    label: 'Processor',
    candidates: [['Key Specs', 'Processor'], ['Key Specs', 'Chipset'], ['Platform', 'Chipset']],
  },
  { label: 'RAM', candidates: [['Memory', 'RAM'], ['General', 'RAM']] },
  { label: 'Storage', candidates: [['Memory', 'Internal Storage'], ['General', 'Storage']] },
  {
    label: 'Camera',
    candidates: [
      ['Key Specs', 'Camera'],
      ['Main Camera', 'Quad Camera'],
      ['Main Camera', 'Triple Camera'],
      ['Main Camera', 'Dual Camera'],
      ['Main Camera', 'Single Camera'],
      ['General', 'Camera'],
    ],
  },
  { label: 'Battery', candidates: [['Key Specs', 'Battery'], ['Battery', 'Capacity'], ['General', 'Battery']] },
  { label: 'SIM', candidates: [['Body', 'SIM'], ['General', 'SIM']] },
  {
    label: 'OS',
    candidates: [['Key Specs', 'OS'], ['Key Specs', 'Operating System'], ['Platform', 'OS']],
  },
] as const;
```

After the move, this command must show the constants are defined only in the shared file and imported elsewhere:

```bash
rg -n "const KEY_SPEC_CATEGORIES|const SUMMARY_SPEC_PRIORITIES" \
  /Users/mac/Baci-app/apps/web/src/lib/storefront-specs \
  /Users/mac/Baci-app/apps/web/src/components/storefront/ogabassey/product-spec-data.ts
```

- [ ] **Step 5: Create shared spec-data builder**

Create `/Users/mac/Baci-app/apps/web/src/lib/storefront-specs/spec-data.ts` with the moved server-safe functions from the existing product-spec builder.

Required imports and export:

```ts
import { stripHtmlTags } from '@/lib/sanitize-core';
import {
  normalizeVariantAttributes,
  type VariantAttributeSource,
} from './variant-attributes';
import {
  KEY_SPEC_CATEGORIES,
  SUMMARY_SPEC_PRIORITIES,
  type ComparableProductKeySpecs,
} from './spec-taxonomy';

export function buildProductSpecData(source: SpecDataSource): {
  detailedSpecs: ProductSpecSection[];
  specs: ProductSpecItem[];
};
```

- [ ] **Step 6: Make old Ogabassey import path a wrapper**

Modify `/Users/mac/Baci-app/apps/web/src/components/storefront/ogabassey/product-spec-data.ts`:

```ts
export { buildProductSpecData as buildOgabasseyProductSpecData } from '@/lib/storefront-specs/spec-data';
```

Keep `ProductSpecItem`/`ProductSpecSection` structural types aligned with `/Users/mac/Baci-app/apps/web/src/components/storefront/ogabassey/types.ts`; do not duplicate divergent field names.

- [ ] **Step 7: Run focused tests**

```bash
pnpm --filter @baci/web exec vitest run \
  src/lib/storefront-specs/spec-data.test.ts \
  src/components/storefront/ogabassey/variant-attributes.test.ts \
  src/components/storefront/ogabassey/product-spec-data.test.ts \
  src/components/storefront/ogabassey/components/ProductComparisonTable.test.tsx
```

Expected: all pass.

---

## Task 2: Add the shared comparison matrix builder

**Files:**
- Create: `/Users/mac/Baci-app/apps/web/src/lib/storefront-specs/spec-matrix.ts`
- Test: `/Users/mac/Baci-app/apps/web/src/lib/storefront-specs/spec-matrix.test.ts`

- [ ] **Step 1: Write failing matrix tests**

```ts
import { describe, expect, it } from 'vitest';
import { buildProductComparisonMatrix } from './spec-matrix';

describe('buildProductComparisonMatrix', () => {
  it('builds grouped comparison rows from detailed specs for two products', () => {
    const matrix = buildProductComparisonMatrix({
      products: [
        {
          id: 'left',
          name: 'Phone A',
          product_key_specs: {
            screen_size_inches: 6.7,
            refresh_rate_hz: 120,
            chipset: 'Chip A',
            ram_gb: 8,
            battery_mah: 5000,
          },
        },
        {
          id: 'right',
          name: 'Phone B',
          product_key_specs: {
            screen_size_inches: 6.8,
            refresh_rate_hz: 144,
            chipset: 'Chip B',
            ram_gb: 12,
            battery_mah: 5500,
          },
        },
      ],
    });

    expect(matrix.columns).toEqual([
      { productId: 'left', label: 'Phone A' },
      { productId: 'right', label: 'Phone B' },
    ]);
    expect(matrix.groups).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          category: 'Display',
          rows: expect.arrayContaining([
            {
              label: 'Size',
              values: ['6.7 inches', '6.8 inches'],
              isDifferent: true,
            },
          ]),
        }),
      ])
    );
    expect(matrix.differentiatingRowCount).toBeGreaterThanOrEqual(3);
  });

  it('uses em dash for missing values and keeps available counterpart values', () => {
    const matrix = buildProductComparisonMatrix({
      products: [
        { id: 'left', name: 'Phone A', product_key_specs: { ram_gb: 8 } },
        { id: 'right', name: 'Phone B', product_key_specs: { storage_gb: 256 } },
      ],
    });

    const memoryGroup = matrix.groups.find((group) => group.category === 'Memory');
    expect(memoryGroup?.rows).toEqual(
      expect.arrayContaining([
        { label: 'RAM', values: ['8GB', '—'], isDifferent: true },
        { label: 'Internal Storage', values: ['—', '256GB'], isDifferent: true },
      ])
    );
  });
});
```

- [ ] **Step 2: Run and verify failure**

```bash
pnpm --filter @baci/web exec vitest run src/lib/storefront-specs/spec-matrix.test.ts
```

Expected: fails because `spec-matrix.ts` does not exist.

- [ ] **Step 3: Implement matrix builder**

Create `/Users/mac/Baci-app/apps/web/src/lib/storefront-specs/spec-matrix.ts`:

```ts
import { buildProductSpecData } from './spec-data';

interface MatrixProductInput {
  id: string | number;
  name: string;
  brand?: string | null;
  category?: string | null;
  condition?: string | null;
  description?: string | null;
  product_key_specs?: Record<string, unknown> | null;
  specifications?: { category: string; items: { label: string; value: string }[] }[] | null;
  variant_attributes?: unknown;
}

export interface ProductComparisonMatrixColumn {
  productId: string;
  label: string;
}

export interface ProductComparisonMatrixRow {
  label: string;
  values: string[];
  isDifferent: boolean;
}

export interface ProductComparisonMatrixGroup {
  category: string;
  rows: ProductComparisonMatrixRow[];
}

export interface ProductComparisonMatrix {
  columns: ProductComparisonMatrixColumn[];
  groups: ProductComparisonMatrixGroup[];
  flatRows: ProductComparisonMatrixRow[];
  differentiatingRowCount: number;
}

export function buildProductComparisonMatrix(input: {
  products: MatrixProductInput[];
}): ProductComparisonMatrix {
  const specData = input.products.map((product) => buildProductSpecData(product));
  const categoryNames = Array.from(
    new Set(specData.flatMap((entry) => entry.detailedSpecs.map((section) => section.category)))
  );

  const groups = categoryNames
    .map((category) => {
      const labels = Array.from(
        new Set(
          specData.flatMap((entry) =>
            entry.detailedSpecs
              .find((section) => section.category === category)
              ?.items.map((item) => item.label) ?? []
          )
        )
      );

      const rows = labels.map((label) => {
        const values = specData.map((entry) => {
          const value = entry.detailedSpecs
            .find((section) => section.category === category)
            ?.items.find((item) => item.label === label)?.value;
          return value || '—';
        });
        const uniqueValues = new Set(values.filter((value) => value !== '—'));

        return {
          label,
          values,
          isDifferent: uniqueValues.size > 1 || values.includes('—'),
        };
      });

      return { category, rows };
    })
    .filter((group) => group.rows.length > 0);

  const flatRows = groups.flatMap((group) => group.rows);

  return {
    columns: input.products.map((product) => ({
      productId: String(product.id),
      label: product.name,
    })),
    groups,
    flatRows,
    differentiatingRowCount: flatRows.filter((row) => row.isDifferent).length,
  };
}
```

- [ ] **Step 4: Run focused matrix tests**

```bash
pnpm --filter @baci/web exec vitest run src/lib/storefront-specs/spec-matrix.test.ts
```

Expected: pass.

---

## Task 3: Consolidate full product select and mapper

**Files:**
- Modify: `/Users/mac/Baci-app/apps/web/src/lib/product-key-specs-select.ts`
- Create: `/Users/mac/Baci-app/apps/web/src/lib/storefront-products-full-select.ts`
- Modify: `/Users/mac/Baci-app/apps/web/src/lib/storefront-products-select.ts`
- Modify: `/Users/mac/Baci-app/apps/web/src/lib/cached-data.ts`
- Modify: `/Users/mac/Baci-app/apps/web/src/app/api/storefront/products/storefront-products-route-data.ts`
- Modify: `/Users/mac/Baci-app/apps/web/src/app/api/storefront/products/product-response.ts`
- Test: `/Users/mac/Baci-app/apps/web/src/lib/product-key-specs-select.test.ts`
- Test: `/Users/mac/Baci-app/apps/web/src/lib/storefront-products-select.test.ts`
- Test: `/Users/mac/Baci-app/apps/web/src/lib/cached-data.products.test.ts`
- Test: `/Users/mac/Baci-app/apps/web/src/app/api/storefront/products/route.test.ts`
- Test: `/Users/mac/Baci-app/apps/web/src/app/api/storefront/products/storefront-products-route-data.test.ts`

- [ ] **Step 1: Add failing assertions for full select**

Update `/Users/mac/Baci-app/apps/web/src/app/api/storefront/products/route.test.ts` in the existing `compact=false` test:

```ts
expect(selectArg).toContain('product_key_specs (');
expect(selectArg).toContain('screen_size_inches');
expect(selectArg).toContain('chipset');
expect(selectArg).toContain('battery_mah');
```

- [ ] **Step 2: Add shared relation and cached detail select assertions**

Update `/Users/mac/Baci-app/apps/web/src/lib/product-key-specs-select.test.ts`:

```ts
expect(columns).toEqual(expect.arrayContaining(['created_at', 'has_ois']));
```

Update the existing `getCachedProductWithDetails uses explicit column select without product_variants` test in `/Users/mac/Baci-app/apps/web/src/lib/cached-data.products.test.ts`:

```ts
expect(selectArg).toContain('created_at');
expect(selectArg).toContain('updated_at');
expect(selectArg).toContain('product_key_specs (');
expect(selectArg).toContain('has_ois');
expect(selectArg).not.toContain('product_variants');
```

Update `/Users/mac/Baci-app/apps/web/src/lib/storefront-products-select.test.ts`:

```ts
expect(STOREFRONT_PRODUCTS_SELECT).toContain('product_key_specs (');
expect(STOREFRONT_PRODUCTS_SELECT).toContain('updated_at');
expect(STOREFRONT_PRODUCTS_COMPACT_SELECT).not.toContain('product_key_specs');
```

- [ ] **Step 3: Add mapper assertion**

Update `/Users/mac/Baci-app/apps/web/src/app/api/storefront/products/storefront-products-route-data.test.ts`:

```ts
it('maps product_key_specs into full storefront product responses', () => {
  const mapped = storefrontProductsRouteData.mapProduct({
    id: 'product-specs',
    name: 'Spec Phone',
    description: 'Spec phone description',
    price: 1000,
    images: [],
    category: 'Smartphones',
    brand: 'SpecBrand',
    slug: 'spec-phone',
    status: 'active',
    manage_stock: false,
    updated_at: '2026-06-06T12:00:00.000Z',
    product_key_specs: {
      screen_size_inches: 6.8,
      ram_gb: 12,
      storage_gb: 256,
    },
  });

  expect(mapped.updated_at).toBe('2026-06-06T12:00:00.000Z');
  expect(mapped.product_key_specs).toEqual({
    screen_size_inches: 6.8,
    ram_gb: 12,
    storage_gb: 256,
  });
});
```

- [ ] **Step 4: Run and verify failure**

```bash
pnpm --filter @baci/web exec vitest run \
  src/lib/product-key-specs-select.test.ts \
  src/lib/storefront-products-select.test.ts \
  src/lib/cached-data.products.test.ts \
  src/app/api/storefront/products/route.test.ts \
  src/app/api/storefront/products/storefront-products-route-data.test.ts
```

Expected: fails because active full select/mapper does not include `product_key_specs`.

- [ ] **Step 5: Add relation provenance and canonical full select**

Modify `/Users/mac/Baci-app/apps/web/src/lib/product-key-specs-select.ts` so the relation projection starts with `created_at` before spec fields:

```ts
export const PRODUCT_KEY_SPECS_RELATION_SELECT = `
  product_key_specs (
    created_at,
    screen_size_inches,
    refresh_rate_hz,
    chipset,
    ram_gb,
    storage_gb,
    main_camera_mp,
    battery_mah,
    charging_watt,
    has_5g,
    android_version,
    network_technology,
    sim_type,
    has_nfc,
    wifi_bands,
    bluetooth_version,
    usb_type,
    has_usb_otg,
    positioning,
    has_fm_radio,
    dimensions_mm,
    weight_g,
    build_materials,
    ip_rating,
    display_type,
    display_resolution,
    display_ppi,
    display_protection,
    display_peak_brightness,
    front_camera_mp,
    front_camera_features,
    front_camera_video,
    rear_camera_features,
    rear_camera_video,
    has_dual_camera,
    has_triple_camera,
    has_quad_camera,
    has_stereo_speakers,
    has_headphone_jack,
    fingerprint_type,
    sensors,
    battery_removable,
    has_wireless_charging,
    wireless_charging_watt,
    has_reverse_charging,
    cpu_cores,
    gpu,
    has_card_slot,
    card_slot_type,
    available_colors,
    model_numbers,
    announced_date,
    release_date,
    camera_score,
    battery_score,
    gaming_score,
    recommended_for,
    has_ois
  )
`;
```

Create `/Users/mac/Baci-app/apps/web/src/lib/storefront-products-full-select.ts`:

```ts
import { PRODUCT_KEY_SPECS_RELATION_SELECT } from '@/lib/product-key-specs-select';

export const STOREFRONT_PRODUCTS_FULL_SELECT = `
  id,
  created_at,
  updated_at,
  name,
  description,
  price,
  compare_at_price,
  images,
  image_hint,
  category,
  category_id,
  brand,
  stock,
  stock_quantity,
  slug,
  status,
  condition,
  has_variants,
  sku,
  manage_stock,
  low_stock_threshold,
  specifications,
  ${PRODUCT_KEY_SPECS_RELATION_SELECT},
  has_condition_offers,
  available_conditions,
  variant_model,
  offers,
  color,
  color_images,
  variant_attributes,
  categories:category_id(id, name, slug),
  product_categories (
    categories (
      id,
      name,
      slug
    )
  )
`;
```

Then modify `/Users/mac/Baci-app/apps/web/src/lib/storefront-products-select.ts` so existing imports remain stable while compact remains lean:

```ts
export { STOREFRONT_PRODUCTS_FULL_SELECT as STOREFRONT_PRODUCTS_SELECT } from '@/lib/storefront-products-full-select';

export const STOREFRONT_PRODUCTS_COMPACT_SELECT = `
  id,
  name,
  slug,
  images,
  image_hint,
  category,
  category_id,
  brand,
  price,
  compare_at_price,
  stock,
  stock_quantity,
  status,
  condition,
  has_variants,
  sku,
  manage_stock,
  low_stock_threshold,
  has_condition_offers,
  available_conditions,
  variant_model,
  categories:category_id(id, name, slug),
  product_categories (
    categories (
      id,
      name,
      slug
    )
  )
`;
```

Keep compact responses without specs.

- [ ] **Step 6: Consolidate cached product detail select**

Modify `/Users/mac/Baci-app/apps/web/src/lib/cached-data.ts`:

```ts
const STOREFRONT_PRODUCT_DETAIL_COLUMNS = `
  id,
  merchant_id,
  category_id,
  created_at,
  updated_at,
  name,
  description,
  status,
  price,
  compare_at_price,
  stock,
  stock_quantity,
  manage_stock,
  low_stock_threshold,
  sku,
  slug,
  condition,
  condition_detail,
  variant_model,
  default_variant_id,
  available_conditions,
  min_variant_price,
  max_variant_price,
  brand,
  category,
  color,
  has_variants,
  has_condition_offers,
  variant_attributes,
  images,
  imageHint:image_hint,
  specifications,
  weight_value,
  weight_unit,
  dimensions,
  taxable,
  tax_code,
  meta_title,
  meta_description,
  keywords,
  canonical_url,
  schema_markup,
  gtin,
  mpn,
  google_product_category,
  fulfillment_details,
  fulfillmentFields:fulfillment_fields
`;
```

Then replace the manual `product_key_specs (...)` block inside `getCachedProductWithDetails` with:

```ts
${PRODUCT_KEY_SPECS_RELATION_SELECT},
```

Keep `product_offers (${STOREFRONT_PRODUCT_DETAIL_OFFERS_COLUMNS})` unchanged.

- [ ] **Step 7: Map product_key_specs in route data**

Modify `/Users/mac/Baci-app/apps/web/src/app/api/storefront/products/storefront-products-route-data.ts` return object:

```ts
updated_at: product.updated_at,
product_key_specs: normalized.product_key_specs ?? product.product_key_specs,
```

- [ ] **Step 8: Remove duplicate product-response select**

Modify `/Users/mac/Baci-app/apps/web/src/app/api/storefront/products/product-response.ts` so it re-exports the canonical full select instead of defining a separate one:

```ts
export { STOREFRONT_PRODUCTS_FULL_SELECT } from '@/lib/storefront-products-full-select';
export { STOREFRONT_PRODUCTS_COMPACT_SELECT } from '@/lib/storefront-products-select';
```

Keep `mapStorefrontProduct` exported from `product-response.ts` because current tests and `storefront-search` mocks import it. Do not remove or migrate that mapper in this task; only remove the duplicate full-select definition.

- [ ] **Step 9: Run focused API/cache tests**

```bash
pnpm --filter @baci/web exec vitest run \
  src/lib/product-key-specs-select.test.ts \
  src/lib/storefront-products-select.test.ts \
  src/lib/cached-data.products.test.ts \
  src/app/api/storefront/products/route.test.ts \
  src/app/api/storefront/products/route.ids.test.ts \
  src/app/api/storefront/products/product-response.test.ts \
  src/app/api/storefront/products/storefront-products-route-data.test.ts
```

Expected: pass.

---

## Task 4: Add curated compare indexability policy

**Files:**
- Create: `/Users/mac/Baci-app/apps/web/src/lib/storefront-compare/compare-indexability-policy.ts`
- Test: `/Users/mac/Baci-app/apps/web/src/lib/storefront-compare/compare-indexability-policy.test.ts`
- Modify: `/Users/mac/Baci-app/apps/web/src/lib/storefront-compare/load-compare-page.ts`
- Test: `/Users/mac/Baci-app/apps/web/src/lib/storefront-compare/load-compare-page.test.ts`

- [ ] **Step 1: Write failing policy tests**

Create `/Users/mac/Baci-app/apps/web/src/lib/storefront-compare/compare-indexability-policy.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import {
  buildApprovedCompareSlugsForCategory,
  buildCuratedCompareSlugSet,
  isCuratedCompareSlug,
} from './compare-indexability-policy';

describe('compare indexability policy', () => {
  it('allows category support, product support, and matrix-approved compare slugs', () => {
    const curated = buildCuratedCompareSlugSet({
      categorySupportLinks: [
        { href: 'https://ogabassey.com/smartphones/compare/apple-vs-samsung', label: 'Apple vs Samsung' },
      ],
      productSupportLinks: [
        { href: 'https://ogabassey.com/smartphones/compare/iphone-17-vs-galaxy-s26', label: 'Compare with Galaxy S26' },
      ],
      approvedCompareSlugs: ['pixel-10-vs-galaxy-s26'],
    });

    expect(isCuratedCompareSlug(curated, 'apple-vs-samsung')).toBe(true);
    expect(isCuratedCompareSlug(curated, 'iphone-17-vs-galaxy-s26')).toBe(true);
    expect(isCuratedCompareSlug(curated, 'pixel-10-vs-galaxy-s26')).toBe(true);
  });

  it('rejects arbitrary compare permutations that are not curated', () => {
    const curated = buildCuratedCompareSlugSet({
      categorySupportLinks: [],
      productSupportLinks: [],
      approvedCompareSlugs: ['iphone-17-vs-galaxy-s26'],
    });

    expect(isCuratedCompareSlug(curated, 'iphone-17-vs-random-phone')).toBe(false);
  });

  it('extracts slugs only from compare URLs and ignores other links', () => {
    const curated = buildCuratedCompareSlugSet({
      categorySupportLinks: [
        { href: 'https://ogabassey.com/smartphones', label: 'Smartphones' },
        { href: 'https://ogabassey.com/smartphones/best-under/under-500k', label: 'Under 500k' },
        { href: 'https://ogabassey.com/smartphones/compare/apple-vs-samsung?utm=ignored', label: 'Apple vs Samsung' },
      ],
      productSupportLinks: [],
      approvedCompareSlugs: [],
    });

    expect([...curated]).toEqual(['apple-vs-samsung']);
  });

  it('builds the same approved slug list used by the web route and matrix export', () => {
    const approved = buildApprovedCompareSlugsForCategory({
      storeUrl: 'https://ogabassey.com',
      categorySlug: 'smartphones',
      categoryName: 'Smartphones',
      products: [
        {
          slug: 'phone-a',
          name: 'Phone A',
          brand: 'Alpha',
          price: 100000,
          category_slug: 'smartphones',
          product_key_specs: { chipset: 'Chip A', ram_gb: 8, battery_mah: 5000 },
        },
        {
          slug: 'phone-b',
          name: 'Phone B',
          brand: 'Beta',
          price: 120000,
          category_slug: 'smartphones',
          product_key_specs: { chipset: 'Chip B', ram_gb: 12, battery_mah: 5500 },
        },
      ],
      limitProducts: 30,
    });

    expect(approved).toEqual(['phone-a-vs-phone-b']);
  });
});
```

- [ ] **Step 2: Implement policy helper**

Create `/Users/mac/Baci-app/apps/web/src/lib/storefront-compare/compare-indexability-policy.ts`:

```ts
import {
  buildCategorySupportLinks,
  buildProductSupportLinks,
} from './build-commercial-support-links';

interface CompareSupportLink {
  href: string;
  label: string;
}

interface CompareCurationProduct {
  slug: string;
  name: string;
  brand?: string | null;
  price: number;
  category_slug?: string | null;
  product_key_specs?: Record<string, unknown> | null;
}

function extractCompareSlug(href: string): string | null {
  try {
    const url = href.startsWith('http') ? new URL(href) : new URL(href, 'https://ogabassey.local');
    const match = url.pathname.match(/\/compare\/([^/?#]+)$/);
    return match?.[1] || null;
  } catch {
    const match = href.split('?')[0]?.match(/\/compare\/([^/?#]+)$/);
    return match?.[1] || null;
  }
}

export function buildCuratedCompareSlugSet(input: {
  categorySupportLinks: CompareSupportLink[];
  productSupportLinks: CompareSupportLink[];
  approvedCompareSlugs: string[];
}) {
  return new Set(
    [
      ...input.categorySupportLinks.map((link) => extractCompareSlug(link.href)),
      ...input.productSupportLinks.map((link) => extractCompareSlug(link.href)),
      ...input.approvedCompareSlugs,
    ].filter((slug): slug is string => Boolean(slug))
  );
}

export function isCuratedCompareSlug(curatedSlugs: Set<string>, canonicalSlug: string) {
  return curatedSlugs.has(canonicalSlug);
}

export function buildApprovedCompareSlugsForCategory(input: {
  storeUrl: string;
  categorySlug: string;
  categoryName: string;
  products: CompareCurationProduct[];
  limitProducts?: number;
}) {
  const products = input.products.slice(0, input.limitProducts ?? 30);
  const categorySupportLinks = buildCategorySupportLinks({
    storeUrl: input.storeUrl,
    categorySlug: input.categorySlug,
    categoryName: input.categoryName,
    products,
  });
  const productSupportLinks = products.flatMap((product) =>
    buildProductSupportLinks({
      storeUrl: input.storeUrl,
      categorySlug: input.categorySlug,
      currentProductSlug: product.slug,
      currentProductPrice: product.price,
      products,
    })
  );

  return Array.from(
    buildCuratedCompareSlugSet({
      categorySupportLinks,
      productSupportLinks,
      approvedCompareSlugs: [],
    })
  ).sort();
}
```

- [ ] **Step 3: Wire policy into compare loader**

First update `/Users/mac/Baci-app/apps/web/src/lib/storefront-compare/load-compare-page.ts` imports and local product type so support-link curation has what it needs:

```ts
import {
  buildApprovedCompareSlugsForCategory,
  buildCuratedCompareSlugSet,
  isCuratedCompareSlug,
} from './compare-indexability-policy';

interface ComparableCategoryProduct {
  slug: string;
  name: string;
  brand: string | null;
  price: number;
  category_slug: string;
  product_key_specs?: Record<string, unknown> | null;
}
```

Then update the `normalizedProducts` projection in the same file so support-link curation has spec data:

```ts
const normalizedProducts = rawProducts
  .map((product) =>
    normalizeProduct(product, { preferredCategorySlug: args.categorySlug })
  )
  .map((product) => ({
    slug: product.slug,
    name: product.name,
    brand: product.brand,
    price: product.price,
    category_slug: product.category_slug,
    product_key_specs: product.product_key_specs,
  }));
```

Then build the curated slug set from the same helper used by the matrix export. Do not depend on `blog_posts.target_compare_slug`; that field is not part of the current web app contract.

```ts
const approvedCompareSlugs = buildApprovedCompareSlugsForCategory({
  storeUrl,
  categorySlug: args.categorySlug,
  categoryName,
  products: normalizedProducts,
});
const curatedCompareSlugs = buildCuratedCompareSlugSet({
  categorySupportLinks: [],
  productSupportLinks: [],
  approvedCompareSlugs,
});

if (!isCuratedCompareSlug(curatedCompareSlugs, parsed.canonicalSlug)) {
  return null;
}
```

Agent-created articles must choose compare slugs from the web-exported approved slug list in `comparison-matrix-v1.json`; the web route should not query blog posts to decide indexability.

- [ ] **Step 4: Add loader regression tests**

Update `/Users/mac/Baci-app/apps/web/src/lib/storefront-compare/load-compare-page.test.ts` to assert:

```ts
expect(await loadComparePage({
  merchantSlug: 'ogabassey',
  categorySlug: 'smartphones',
  comparisonSlug: 'uncurated-phone-a-vs-phone-b',
})).toBeNull();
```

Also assert an existing sitemap/category support comparison still returns an indexable model.

- [ ] **Step 5: Run policy tests**

```bash
pnpm --filter @baci/web exec vitest run \
  src/lib/storefront-compare/compare-indexability-policy.test.ts \
  src/lib/storefront-compare/load-compare-page.test.ts
```

Expected: pass.

---

## Task 5: Upgrade SEO compare pages to use the full matrix

**Files:**
- Modify: `/Users/mac/Baci-app/apps/web/src/lib/storefront-compare/load-compare-page.ts`
- Modify: `/Users/mac/Baci-app/apps/web/src/app/(storefront)/[slug]/(catalog)/(listing)/[category]/compare/[comparisonSlug]/compare-page-content.tsx`
- Test: `/Users/mac/Baci-app/apps/web/src/app/(storefront)/[slug]/(catalog)/(listing)/[category]/compare/[comparisonSlug]/compare-page-content.test.tsx`

- [ ] **Step 1: Add failing test for grouped rows**

Update compare page content test to expect category group rows and multiple detailed specs.

```ts
expect(screen.getByRole('table', { name: /product comparison table/i })).toBeInTheDocument();
expect(screen.getByText('Display')).toBeInTheDocument();
expect(screen.getByText('Refresh Rate')).toBeInTheDocument();
expect(screen.getByText('Battery')).toBeInTheDocument();
```

- [ ] **Step 2: Run and verify failure if current model only has flat summary rows**

```bash
pnpm --filter @baci/web exec vitest run 'src/app/(storefront)/[slug]/(catalog)/(listing)/[category]/compare/[comparisonSlug]/compare-page-content.test.tsx'
```

Expected: fails until loader/content are matrix-aware.

- [ ] **Step 3: Extend compare page model**

Modify `/Users/mac/Baci-app/apps/web/src/lib/storefront-compare/load-compare-page.ts`:

```ts
import { buildProductComparisonMatrix } from '@/lib/storefront-specs/spec-matrix';
```

Inside the product compare branch, replace summary-only row construction with:

```ts
const comparisonMatrix = buildProductComparisonMatrix({
  products: [
    {
      id: leftDetails.id,
      name: leftDetails.name,
      brand: leftDetails.brand,
      category: leftDetails.category,
      condition: leftDetails.condition,
      description: leftDetails.description,
      product_key_specs: normalizeComparableKeySpecs(leftDetails.product_key_specs),
      specifications: leftDetails.specifications,
      variant_attributes: leftDetails.variant_attributes,
    },
    {
      id: rightDetails.id,
      name: rightDetails.name,
      brand: rightDetails.brand,
      category: rightDetails.category,
      condition: rightDetails.condition,
      description: rightDetails.description,
      product_key_specs: normalizeComparableKeySpecs(rightDetails.product_key_specs),
      specifications: rightDetails.specifications,
      variant_attributes: rightDetails.variant_attributes,
    },
  ],
});
const comparisonRows = comparisonMatrix.flatRows.map((row) => ({
  label: row.label,
  leftValue: row.values[0] || '—',
  rightValue: row.values[1] || '—',
}));
```

Add `comparisonMatrix` to the product page model type and returned object.

- [ ] **Step 4: Render grouped table body**

Modify `/Users/mac/Baci-app/apps/web/src/app/(storefront)/[slug]/(catalog)/(listing)/[category]/compare/[comparisonSlug]/compare-page-content.tsx` to prefer grouped matrix rows for product pages:

```tsx
<tbody>
  {page.kind === 'product' && page.comparisonMatrix
    ? page.comparisonMatrix.groups.flatMap((group) => [
        <tr key={`group-${group.category}`} className="border-t bg-muted/30">
          <th colSpan={3} scope="colgroup" className="px-4 py-2 text-xs font-semibold uppercase tracking-wide text-foreground">
            {group.category}
          </th>
        </tr>,
        ...group.rows.map((row) => (
          <tr key={`${group.category}-${row.label}`} className="border-t align-top">
            <th scope="row" className="px-4 py-3 text-sm font-medium text-foreground">{row.label}</th>
            <td className="px-4 py-3 text-sm text-muted-foreground">{row.values[0]}</td>
            <td className="px-4 py-3 text-sm text-muted-foreground">{row.values[1]}</td>
          </tr>
        )),
      ])
    : page.comparisonRows.map((row) => (
        <tr key={row.label} className="border-t align-top">
          <th scope="row" className="px-4 py-3 text-sm font-medium text-foreground">{row.label}</th>
          <td className="px-4 py-3 text-sm text-muted-foreground">{row.leftValue}</td>
          <td className="px-4 py-3 text-sm text-muted-foreground">{row.rightValue}</td>
        </tr>
      ))}
</tbody>
```

- [ ] **Step 5: Run compare page tests**

```bash
pnpm --filter @baci/web exec vitest run \
  'src/app/(storefront)/[slug]/(catalog)/(listing)/[category]/compare/[comparisonSlug]/page.test.tsx' \
  'src/app/(storefront)/[slug]/(catalog)/(listing)/[category]/compare/[comparisonSlug]/compare-page-content.test.tsx'
```

Expected: pass.

---

## Task 6: Update PDP comparison widget to consume the shared matrix shape

**Files:**
- Modify: `/Users/mac/Baci-app/apps/web/src/components/storefront/ogabassey/components/ProductComparisonTable.tsx`
- Test: `/Users/mac/Baci-app/apps/web/src/components/storefront/ogabassey/components/ProductComparisonTable.test.tsx`

- [ ] **Step 1: Add test that added products display full key specs**

Add a test that mocks `/api/storefront/products?compact=false` returning `product_key_specs`, then verifies a detailed row such as `Refresh Rate` appears after adding a product.

- [ ] **Step 2: Run and verify failure if specs are missing**

```bash
pnpm --filter @baci/web exec vitest run src/components/storefront/ogabassey/components/ProductComparisonTable.test.tsx
```

- [ ] **Step 3: Refactor widget row generation**

Import the shared matrix builder:

```ts
import { buildProductComparisonMatrix } from '@/lib/storefront-specs/spec-matrix';
```

Build matrix from `[mainProduct, ...comparisonProducts]` and render grouped rows from `matrix.groups`. Keep search and add/remove state as client behavior.

- [ ] **Step 4: Run widget tests**

```bash
pnpm --filter @baci/web exec vitest run src/components/storefront/ogabassey/components/ProductComparisonTable.test.tsx
```

Expected: pass.

---

## Task 7: Align existing Product JSON-LD and add richer compare structured data

**Files:**
- Modify: `/Users/mac/Baci-app/apps/web/src/lib/seo-utils.ts`
- Modify: `/Users/mac/Baci-app/apps/web/src/app/(storefront)/[slug]/(catalog)/(pdp)/[category]/[productSlug]/page.tsx`
- Modify: `/Users/mac/Baci-app/apps/web/src/app/(storefront)/[slug]/(catalog)/(pdp)/products/[productSlug]/product-page-runtime.tsx`
- Modify: `/Users/mac/Baci-app/apps/web/src/lib/storefront-compare/compare-schema.ts`
- Modify: `/Users/mac/Baci-app/apps/web/src/app/(storefront)/[slug]/(catalog)/(listing)/[category]/compare/[comparisonSlug]/compare-page-content.tsx`
- Test: `/Users/mac/Baci-app/apps/web/src/lib/seo-utils.test.ts`
- Test: `/Users/mac/Baci-app/apps/web/src/lib/storefront-compare/compare-schema.test.ts`
- Test: `/Users/mac/Baci-app/apps/web/src/app/(storefront)/[slug]/(catalog)/(listing)/[category]/compare/[comparisonSlug]/compare-page-content.test.tsx`

**Purpose:** The app already has Product JSON-LD spec SEO through `generateProductSchema`. This task makes it explicitly consume the shared spec data/matrix path and adds regression coverage so future compare/blog work cannot drift from product structured data.

- [ ] **Step 0: Add Product JSON-LD regression coverage**

Add or update a focused test for `generateProductSchema` that proves `product_key_specs` and derived detailed specs become `additionalProperty` entries.

```ts
expect(schema.offers).toMatchObject({
  '@type': 'Offer',
  price: 1250000,
  priceCurrency: 'NGN',
  availability: 'https://schema.org/InStock',
  itemCondition: 'https://schema.org/NewCondition',
});
expect(schema.additionalProperty).toEqual(
  expect.arrayContaining([
    { '@type': 'PropertyValue', name: 'Screen Size', value: '6.8 inches' },
    { '@type': 'PropertyValue', name: 'Chipset', value: 'Snapdragon 8 Elite' },
    { '@type': 'PropertyValue', name: 'Battery Capacity', value: '5000mAh' },
  ])
);
```

- [ ] **Step 0.1: Ensure PDP schema input uses shared spec builder**

Verify both PDP route variants pass spec data derived from `/Users/mac/Baci-app/apps/web/src/lib/storefront-specs/spec-data.ts` into `generateProductSchema`. Keep the JSON-LD server-rendered in initial HTML. Do not move Product JSON-LD generation into the client widget.

When aligning `generateProductSchema`, preserve schema-friendly property names already used in `/Users/mac/Baci-app/apps/web/src/lib/seo-utils.ts` such as `Screen Size`, `Battery Capacity`, and `Main Camera`. The shared spec builder is the source of values and row coverage; the schema layer may use clearer property names than short table row labels like `Size` as long as the same fact/value is visible on the product page. Never emit provenance fields such as `created_at` as `additionalProperty`.

- [ ] **Step 1: Write schema test**

Create or update `/Users/mac/Baci-app/apps/web/src/lib/storefront-compare/compare-schema.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import {
  buildComparePageSchemas,
  buildProductCompareItemListSchema,
} from './compare-schema';

describe('buildProductCompareItemListSchema', () => {
  it('does not emit FAQPage JSON-LD for Ogabassey compare pages', () => {
    const schemas = buildComparePageSchemas({
      breadcrumbItems: [{ name: 'Home', url: 'https://ogabassey.com' }],
      faqItems: [{ question: 'Which phone is better?', answer: 'Compare the visible table.' }],
    });

    expect(schemas.breadcrumb['@type']).toBe('BreadcrumbList');
    expect(schemas.faq).toBeNull();
  });

  it('builds Product ItemList schema with matrix additionalProperty values', () => {
    const schema = buildProductCompareItemListSchema({
      pageName: 'Phone A vs Phone B',
      pageUrl: 'https://ogabassey.com/smartphones/compare/phone-a-vs-phone-b',
      currency: 'NGN',
      products: [
        { name: 'Phone A', url: 'https://ogabassey.com/smartphones/phone-a', price: 1000 },
        { name: 'Phone B', url: 'https://ogabassey.com/smartphones/phone-b', price: 1200 },
      ],
      matrixRows: [
        { label: 'RAM', values: ['8GB', '12GB'], isDifferent: true },
      ],
    });

    expect(schema['@type']).toBe('ItemList');
    expect(schema.itemListElement[0].item['@type']).toBe('Product');
    expect(schema.itemListElement[0].item.additionalProperty).toEqual([
      { '@type': 'PropertyValue', name: 'RAM', value: '8GB' },
    ]);
  });
});
```

- [ ] **Step 2: Implement schema helper**

Modify `/Users/mac/Baci-app/apps/web/src/lib/storefront-compare/compare-schema.ts` so `buildComparePageSchemas` stops returning `generateFAQSchema` for Ogabassey compare pages:

```ts
export function buildComparePageSchemas(input: {
  breadcrumbItems: BreadcrumbItem[];
  faqItems: FAQItem[];
}) {
  return {
    breadcrumb: generateBreadcrumbSchema(input.breadcrumbItems),
    faq: null,
  };
}
```

Keep visible FAQ sections in the page body. Only remove the `FAQPage` JSON-LD script path.

Then add `buildProductCompareItemListSchema` to the same file.

- [ ] **Step 3: Emit schema only for product compare pages**

In compare page content, render an additional JSON-LD script when `page.kind === 'product'`.

Update `/Users/mac/Baci-app/apps/web/src/app/(storefront)/[slug]/(catalog)/(listing)/[category]/compare/[comparisonSlug]/compare-page-content.test.tsx` so the old FAQ JSON-LD expectation changes from expecting `"@type":"FAQPage"` to expecting no FAQPage script:

```ts
const schemaScripts = container.querySelectorAll('script[type="application/ld+json"]');
expect(Array.from(schemaScripts).some((script) => script.textContent?.includes('"@type":"FAQPage"'))).toBe(false);
expect(screen.getByText('Which phone is better?')).toBeInTheDocument();
```

- [ ] **Step 4: Run schema tests**

```bash
pnpm --filter @baci/web exec vitest run \
  src/lib/storefront-compare/compare-schema.test.ts \
  'src/app/(storefront)/[slug]/(catalog)/(listing)/[category]/compare/[comparisonSlug]/compare-page-content.test.tsx'
```

Expected: pass.

---

## Task 8: Make blog agents consume the same matrix

**Files:**
- Create: `/Users/mac/Baci-app/apps/web/src/lib/storefront-specs/spec-matrix-export.ts`
- Create: `/Users/mac/Baci-app/apps/web/src/lib/storefront-specs/spec-matrix-export.test.ts`
- VPS agent modify: `/home/bassey/ogabassey-agents/codex_content_agent/catalog.py`
- VPS agent modify: `/home/bassey/ogabassey-agents/codex_content_agent/cache_store.py`
- VPS agent modify: `/home/bassey/ogabassey-agents/codex_content_agent/candidates.py`
- VPS agent modify: `/home/bassey/ogabassey-agents/codex_content_agent/candidate_context.py`
- VPS agent modify: `/home/bassey/ogabassey-agents/codex_content_agent/prompt_builder.py`
- VPS agent modify: `/home/bassey/ogabassey-agents/codex_content_agent/validators.py`
- VPS agent modify: `/home/bassey/ogabassey-agents/codex_content_agent/publisher.py`
- VPS cache target: `/home/bassey/ogabassey-agents/data/cache/comparison-matrix-v1.json` and R2 object `comparison-matrix-v1.json`

- [ ] **Step 1: Define exported matrix contract**

Use this JSON shape for the agent cache:

```json
{
  "schema_version": "comparison-matrix-v1",
  "merchant_id": "uuid",
  "generated_at": "2026-06-07T00:00:00.000Z",
  "approved_compare_slugs": [
    "iphone-17-vs-galaxy-s26",
    "apple-vs-samsung"
  ],
  "products": [
    {
      "id": "product-id",
      "slug": "product-slug",
      "name": "Product Name",
      "category_slug": "smartphones",
      "brand": "Brand",
      "price": 100000,
      "canonical_url": "https://ogabassey.com/smartphones/product-slug",
      "availability": "InStock",
      "inventory_policy": "unmanaged",
      "matrix_source": {
        "source": "catalog",
        "source_updated_at": "2026-06-07T00:00:00.000Z",
        "confidence": "catalog_verified"
      },
      "product_key_specs": {
        "screen_size_inches": 6.8,
        "refresh_rate_hz": 120,
        "chipset": "Chipset",
        "ram_gb": 8,
        "storage_gb": 256,
        "battery_mah": 5000
      },
      "comparison_summary_rows": [
        { "label": "Display", "value": "6.8 inches" },
        { "label": "Processor", "value": "Chipset" }
      ],
      "comparison_detail_groups": [
        {
          "category": "Display",
          "items": [
            { "label": "Size", "value": "6.8 inches" },
            { "label": "Refresh Rate", "value": "120Hz" }
          ]
        }
      ]
    }
  ]
}
```

- [ ] **Step 1.1: Export approved compare slug list**

The web export must include `approved_compare_slugs`, generated from category support links and PDP-equivalent product support links. The agent must not invent compare slugs outside this list.

Use `product.product_key_specs?.created_at || product.updated_at || product.created_at || generated_at` as the `matrix_source.source_updated_at` fallback chain. Do not add a migration just for provenance unless live schema verification proves no product timestamp is available.

- [ ] **Step 1.2: Add export helper tests**

Create `/Users/mac/Baci-app/apps/web/src/lib/storefront-specs/spec-matrix-export.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { buildComparisonMatrixExport } from './spec-matrix-export';

describe('buildComparisonMatrixExport', () => {
  it('exports cached agent-ready products with provenance and approved compare slugs', () => {
    const exported = buildComparisonMatrixExport({
      merchantId: 'merchant-1',
      storeUrl: 'https://ogabassey.com',
      generatedAt: '2026-06-07T00:00:00.000Z',
      approvedCompareSlugs: ['phone-a-vs-phone-b'],
      products: [
        {
          id: 'phone-a',
          slug: 'phone-a',
          name: 'Phone A',
          category_slug: 'smartphones',
          brand: 'Brand A',
          price: 100000,
          manage_stock: false,
          stock_quantity: null,
          created_at: '2026-06-01T00:00:00.000Z',
          updated_at: '2026-06-05T00:00:00.000Z',
          product_key_specs: {
            created_at: '2026-06-04T00:00:00.000Z',
            screen_size_inches: 6.8,
            chipset: 'Chip A',
            ram_gb: 8,
          },
        },
      ],
    });

    expect(exported.schema_version).toBe('comparison-matrix-v1');
    expect(exported.approved_compare_slugs).toEqual(['phone-a-vs-phone-b']);
    expect(exported.products[0]).toMatchObject({
      availability: 'InStock',
      inventory_policy: 'unmanaged',
      canonical_url: 'https://ogabassey.com/smartphones/phone-a',
      matrix_source: {
        source: 'catalog',
        source_updated_at: '2026-06-04T00:00:00.000Z',
        confidence: 'catalog_verified',
      },
    });
    expect(exported.products[0].comparison_detail_groups.length).toBeGreaterThan(0);
  });
});
```

- [ ] **Step 1.3: Implement export helper**

Create `/Users/mac/Baci-app/apps/web/src/lib/storefront-specs/spec-matrix-export.ts` with `buildComparisonMatrixExport(input)` that:

```text
- sorts products by category_slug then slug for deterministic cache output
- derives canonical_url as `${storeUrl}/${category_slug}/${slug}`
- maps manage_stock=false to availability "InStock" and inventory_policy "unmanaged"
- maps managed stock with stock_quantity <= 0 to "OutOfStock"
- builds comparison_summary_rows and comparison_detail_groups from buildProductSpecData(product)
- preserves raw product_key_specs for agent fact lookup
- sets matrix_source.source_updated_at from product_key_specs.created_at, product.updated_at, product.created_at, then generatedAt
- copies approvedCompareSlugs exactly after de-duping and sorting
```

- [ ] **Step 1.4: Add low-egress cache cadence**

Update `/home/bassey/ogabassey-agents/codex_content_agent/cache_store.py` so agent runs use this policy:

```text
- read /home/bassey/ogabassey-agents/data/cache/comparison-matrix-v1.json first
- if the file exists and is younger than 7 days, use it without fetching catalog data
- if the file is older than 7 days, fetch the R2 object comparison-matrix-v1.json using conditional ETag/Last-Modified when possible
- if R2 is unavailable, keep using the local stale cache for drafts but mark cache_status="stale"
- only scripts/refresh_content_cache.py is allowed to do a full catalog refresh/write to R2
```

Verify the current low-egress cron shape remains weekly cache refresh plus daily serial agent run:

```bash
crontab -l | rg 'refresh_content_cache|run_codex_content_daily_serial'
```

Expected: Sunday 05:30 Lagos cache refresh and daily 06:00 Lagos serial content run remain present, or implementation updates crontab to that cadence.

- [ ] **Step 2: Replace agent thin field select**

On VPS, update `/home/bassey/ogabassey-agents/codex_content_agent/catalog.py` so catalog fetch/cache includes the full spec relation fields from `/Users/mac/Baci-app/apps/web/src/lib/product-key-specs-select.ts`, not only the current small subset.

- [ ] **Step 3: Generate blog tables from matrix detail groups**

Comparison blog generation must use this rule:

```text
For two-product comparison articles, render a table with rows from the shared matrix groups.
Prefer 12 to 30 rows depending on available data.
Always include price, availability/condition, display, chipset/performance, memory, cameras, battery/charging, connectivity, and warranty/buying context when the source matrix contains those values.
Use "Not listed" only when a field is absent from the source matrix; do not hallucinate specs.
```

- [ ] **Step 4: Add agent tests**

Add/modify tests in `/home/bassey/ogabassey-agents/tests` to verify:

```text
- comparison drafts include an HTML table in `content_html` and not only prose
- tables include at least 8 rows when source matrix has enough fields
- unmanaged stock maps as in-stock/unlimited for agent wording
- missing specs render as "Not listed" and do not block publishing
- target_compare_slug values are selected only from `approved_compare_slugs` in `comparison-matrix-v1.json`
- internal_links count stays at or below 10 total, with product A, product B, category hub, and one guide/support link prioritized
- each comparison draft includes a distinct verdict paragraph that references at least two differing matrix attributes
```

- [ ] **Step 5: Refresh cache and run one dry comparison**

On VPS:

```bash
cd /home/bassey/ogabassey-agents
.venv/bin/python -m pytest -q
CODEX_CONTENT_CACHE_BLOG_LIMIT=750 .venv/bin/python scripts/refresh_content_cache.py
CODEX_CONTENT_USE_CACHE=1 CODEX_CONTENT_CACHE_MAX_AGE_SECONDS=604800 CODEX_PUBLISH_DRY_RUN=1 CODEX_MODEL=gpt-5.5 scripts/run_codex_content_agent.sh --task comparison
```

Expected: tests pass; dry-publish run produces a comparison draft/table from cached matrix without publishing the draft.

---

## Task 9: Validation and quality gate

**Files:**
- All modified files above.

- [ ] **Step 1: Run focused web tests**

```bash
pnpm --filter @baci/web exec vitest run \
  src/lib/storefront-specs/spec-data.test.ts \
  src/lib/storefront-specs/spec-matrix.test.ts \
  src/app/api/storefront/products/route.test.ts \
  src/app/api/storefront/products/route.ids.test.ts \
  src/app/api/storefront/products/product-response.test.ts \
  src/app/api/storefront/products/storefront-products-route-data.test.ts \
  'src/app/(storefront)/[slug]/(catalog)/(listing)/[category]/compare/[comparisonSlug]/page.test.tsx' \
  'src/app/(storefront)/[slug]/(catalog)/(listing)/[category]/compare/[comparisonSlug]/compare-page-content.test.tsx' \
  src/components/storefront/ogabassey/components/ProductComparisonTable.test.tsx
```

Expected: all pass.

- [ ] **Step 2: Run repo quality gate**

```bash
pnpm turbo lint
pnpm turbo typecheck
pnpm turbo test
```

Expected: all pass.

- [ ] **Step 3: Run CodeRabbit prompt-only review**

```bash
coderabbit review --prompt-only -t uncommitted
```

Expected: no critical/high issues. Fix any critical/high issues before commit.

- [ ] **Step 4: Verify rendered HTML table server-side**

Run the web app locally, open a known compare URL, and inspect the server HTML:

```bash
pnpm --filter @baci/web dev
curl -s 'http://localhost:3000/ogabassey/smartphones/compare/example-left-vs-example-right' | rg '<table|application/ld\+json|Refresh Rate|Battery'
```

Expected: HTML contains a real `<table>`, JSON-LD scripts, and detailed matrix rows.

- [ ] **Step 5: Verify blog-agent table output on VPS**

```bash
ssh bassey@82.29.190.219 'cd /home/bassey/ogabassey-agents && .venv/bin/python -m pytest -q && CODEX_CONTENT_USE_CACHE=1 CODEX_CONTENT_CACHE_MAX_AGE_SECONDS=604800 CODEX_PUBLISH_DRY_RUN=1 CODEX_MODEL=gpt-5.5 scripts/run_codex_content_agent.sh --task comparison'
```

Expected: tests pass and dry-publish comparison output contains a table generated from cached matrix data without publishing the draft.

---

## Acceptance criteria

- Full storefront product API responses with `compact=false` include `product_key_specs`.
- Compact listing responses still exclude heavy spec payloads.
- Product compare pages render semantic server-side tables with grouped detailed specs, `<caption>`, `<thead>`, `<tbody>`, `scope`, visible breadcrumb, and one `<h1>`.
- PDP comparison widget uses the same matrix logic as SEO compare pages.
- Product/compare structured data uses the same spec rows and does not invent specs.
- Blog agents consume the same cache/matrix shape and produce comparison tables consistently.
- `comparison-matrix-v1.json` includes `approved_compare_slugs` and `matrix_source` provenance metadata with deterministic timestamp fallback.
- No separate hardcoded agent-only comparison field subset remains.
- Existing sitemap/indexability behavior for compare pages remains intact, and only curated compare URLs are included in sitemaps/internal links.
- Product JSON-LD remains server-rendered in initial HTML and matches visible product specs/offers.
- Compare-page JSON-LD does not overclaim product rich-result eligibility for multi-product pages.
- Compare pages keep visible FAQ content but do not emit `FAQPage` JSON-LD for Ogabassey.
- Blog articles include materially distinct editorial verdicts, not only generated tables.
- `pnpm turbo lint`, `pnpm turbo typecheck`, and relevant tests pass.

---

## Koray/Google validation checklist

Before release, verify these explicitly:

- [ ] `curl` a product page and confirm Product JSON-LD, price, availability, condition, and spec `additionalProperty` are in initial HTML.
- [ ] `curl` a compare page and confirm the comparison table, visible breadcrumb, canonical URL, and JSON-LD are in initial HTML.
- [ ] Confirm compare-page JSON-LD contains no `FAQPage` object for Ogabassey; visible FAQs can remain as ordinary HTML.
- [ ] Confirm sitemap entries contain only curated compare URLs and match canonical metadata.
- [ ] Confirm non-curated compare permutations do not produce indexable thin pages.
- [ ] Confirm each comparison article has a distinct verdict section and a table generated from `comparison-matrix-v1.json`.
- [ ] Confirm internal links per compare/blog page are bounded and point to product A, product B, category hub, and the most relevant guide/support page.
- [ ] Run Google Rich Results Test manually for one product page and one compare/blog page after deployment. Treat warnings on compare pages as expected when Google does not support a rich-result type for the page.
- [ ] Use Search Console URL Inspection where credentials are available; otherwise report that Google coverage could not be confirmed.

---

## Implementation notes

- Do not modify existing Supabase migrations. If schema changes become necessary, add a new append-only migration.
- Do not use `select('*')`; keep explicit select fragments.
- Do not move `proxy.ts`.
- Do not convert the PDP widget into a pure server component; it needs client interactivity. The SEO compare pages and blog outputs are the server-side/cached authority surfaces.
- Avoid copying GSMArena text or layouts. Use Ogabassey’s own taxonomy, live catalog, Nigerian buying context, warranty/payment/condition context, and source-backed specs.
