# Ogabassey Phase 5 Shared Trust Profile Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a shared merchant trust-profile platform layer for any storefront, so public trust data is captured once, rendered consistently across schema and storefront trust surfaces, and used to improve Merchant Center readiness without inventing unsupported feed output.

**Architecture:** Phase 5 adds one new persisted JSONB field, `merchants.trust_profile`, that stores only the missing public trust fields not already covered by existing merchant columns or page editors. A new shared trust-profile assembler merges `support_email`, `support_phone`, `social_media`, `business_address`, tax/legal settings, `about_page`, `pages.*`, and `trust_profile` into one normalized `MerchantTrustProfile` read model. Storefront schema builders, public trust-policy routes, PDP trust modules, sitemap entries, and Merchant Center readiness checks all consume that shared model.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript, Supabase/Postgres migration + JSONB, existing merchant dashboard settings surfaces, existing storefront schema/feed utilities, Vitest + React Testing Library, Biome.

---

## Scope Decisions

- Phase 5 is shared-platform work, not Ogabassey-only work.
- Reuse existing merchant-editable sources as the source of truth where they already exist:
  - `merchants.support_email`
  - `merchants.support_phone`
  - `merchants.social_media`
  - `merchants.business_address`
  - `merchants.legal_entity_name`
  - `merchants.registered_address`
  - `merchants.tax_identification_number`
  - `merchants.about_page`
  - `merchants.pages.contact`
  - `merchants.pages.privacy`
  - `merchants.pages.terms`
  - `merchants.pages.faq`
- Add one new persisted field for the missing public trust data:
  - `merchants.trust_profile jsonb not null default '{}'::jsonb`
- Do **not** create a separate `merchant_trust_profiles` table in this phase. The existing dashboard `updateMerchant(...)` flow already updates the `merchants` row and is the lowest-risk path for shared storefront rollout.
- Do **not** add new publish blockers to `/api/merchant/publish` in this phase. Trust completeness should surface as readiness warnings, not a harder store-publish gate.
- Do **not** emit unsupported Google Merchant XML tags. Merchant Center improvements in this phase come from:
  - better supported feed data where the feed already has fields
  - a new readiness diagnostic layer
  - stronger public trust/schema surfaces that align with Google's merchant/entity expectations
- Do **not** route long-form legal copy into the new `trust_profile` JSON. Existing page editors remain canonical for:
  - privacy policy
  - terms
  - contact page body
  - FAQ body
- Add new public trust-policy routes only for the missing trust surfaces:
  - `/{slug}/returns`
  - `/{slug}/shipping`
  - `/{slug}/warranty`
- The dashboard builder panel under `components/builder/store-settings-panel.tsx` is out of scope. The canonical merchant-editing surfaces for this phase are the dashboard settings pages.

## Shared Data Contract

The new JSONB payload stored in `merchants.trust_profile` must use this exact shape:

```ts
export interface MerchantTrustProfileDraft {
  founded_year?: number | null;
  customer_service?: {
    whatsapp_number?: string | null;
    hours_summary?: string | null;
    timezone?: string | null;
    response_time_summary?: string | null;
  } | null;
  return_policy?: {
    summary?: string | null;
    window_days?: number | null;
    return_method?: 'mail' | 'in_store' | 'carrier_dropoff' | null;
    return_fees?: 'free' | 'customer_pays' | 'original_shipping_deducted' | null;
  } | null;
  shipping_policy?: {
    summary?: string | null;
    regions?: string[] | null;
    handling_days_min?: number | null;
    handling_days_max?: number | null;
    transit_days_min?: number | null;
    transit_days_max?: number | null;
    shipping_fee_type?: 'free' | 'flat_rate' | 'calculated' | null;
  } | null;
  warranty_policy?: {
    summary?: string | null;
  } | null;
}
```

Then normalize it into this shared assembled shape:

```ts
export interface MerchantTrustProfile {
  supportEmail?: string;
  supportPhone?: string;
  whatsappNumber?: string;
  socialLinks: Record<string, string>;
  businessAddress?: string;
  registeredAddress?: {
    street?: string;
    city?: string;
    state?: string;
    postal_code?: string;
    country?: string;
  };
  legalEntityName?: string;
  taxIdentificationNumber?: string;
  foundedYear?: number;
  customerServiceHours?: {
    summary?: string;
    timezone?: string;
    responseTimeSummary?: string;
  };
  returnPolicy?: {
    summary?: string;
    windowDays?: number;
    returnMethod?: 'mail' | 'in_store' | 'carrier_dropoff';
    returnFees?: 'free' | 'customer_pays' | 'original_shipping_deducted';
    localRoute: '/returns';
  };
  shippingPolicy?: {
    summary?: string;
    regions: string[];
    handlingDaysMin?: number;
    handlingDaysMax?: number;
    transitDaysMin?: number;
    transitDaysMax?: number;
    shippingFeeType?: 'free' | 'flat_rate' | 'calculated';
    localRoute: '/shipping';
  };
  warrantyPolicy?: {
    summary?: string;
    localRoute: '/warranty';
  };
  derivedLinks: {
    about?: string;
    contact?: string;
    privacy?: string;
    terms?: string;
    faq?: string;
    returns?: string;
    shipping?: string;
    warranty?: string;
  };
}
```

## File Map

**Create**

- `supabase/migrations/20260418170000_add_merchant_trust_profile.sql`
  Purpose: add `merchants.trust_profile jsonb` with safe default and check constraint.
- `packages/shared/src/contracts/merchant-trust-profile.ts`
  Purpose: source-of-truth TypeScript contract for `trust_profile`.
- `packages/shared/src/contracts/merchant-trust-profile.test.ts`
- `packages/shared/src/schemas/merchant-trust-profile.ts`
  Purpose: Zod schema for the draft trust-profile JSON.
- `packages/shared/src/schemas/merchant-trust-profile.test.ts`
- `apps/web/src/lib/storefront-trust/merchant-trust-profile-types.ts`
  Purpose: assembled storefront-facing trust profile types and readiness types.
- `apps/web/src/lib/storefront-trust/build-merchant-trust-profile.ts`
  Purpose: merge existing merchant fields with `trust_profile`.
- `apps/web/src/lib/storefront-trust/build-merchant-trust-profile.test.ts`
- `apps/web/src/lib/storefront-trust/build-google-merchant-readiness.ts`
  Purpose: deterministic Merchant Center readiness checks using merchant data, trust profile, and feed data coverage.
- `apps/web/src/lib/storefront-trust/build-google-merchant-readiness.test.ts`
- `apps/web/src/app/dashboard/settings/trust/page.tsx`
  Purpose: shared dashboard trust-settings entrypoint.
- `apps/web/src/app/dashboard/settings/trust/page.test.tsx`
- `apps/web/src/app/dashboard/settings/trust/trust-settings-client.tsx`
  Purpose: edit the new `trust_profile` JSON-backed fields and link to existing editors for reused fields.
- `apps/web/src/app/dashboard/settings/trust/trust-settings-client.test.tsx`
- `apps/web/src/components/dashboard/integrations/google-merchant-readiness-card.tsx`
  Purpose: render feed/trust readiness checks.
- `apps/web/src/components/dashboard/integrations/google-merchant-readiness-card.test.tsx`
- `apps/web/src/app/dashboard/integrations/google-merchant/page.test.tsx`
- `apps/web/src/app/api/integrations/google-merchant-center/readiness/route.ts`
  Purpose: protected diagnostics endpoint for the dashboard Merchant Center page.
- `apps/web/src/app/api/integrations/google-merchant-center/readiness/route.test.ts`
- `apps/web/src/components/storefront/trust/trust-policy-page-client.tsx`
  Purpose: shared renderer for `/returns`, `/shipping`, and `/warranty`.
- `apps/web/src/components/storefront/trust/trust-policy-page-client.test.tsx`
- `apps/web/src/components/storefront/footer.test.tsx`
- `apps/web/src/components/storefront/ogabassey/components/Footer.test.tsx`
- `apps/web/src/app/(storefront)/[slug]/returns/page.tsx`
- `apps/web/src/app/(storefront)/[slug]/returns/page.test.tsx`
- `apps/web/src/app/(storefront)/[slug]/shipping/page.tsx`
- `apps/web/src/app/(storefront)/[slug]/shipping/page.test.tsx`
- `apps/web/src/app/(storefront)/[slug]/warranty/page.tsx`
- `apps/web/src/app/(storefront)/[slug]/warranty/page.test.tsx`

**Modify**

- `apps/web/src/hooks/merchant/types.ts`
- `apps/web/src/hooks/merchant/queries.ts`
- `apps/web/src/lib/cached-data.ts`
  Purpose: expose `trust_profile` in all merchant fetch paths.
- `apps/web/src/app/dashboard/settings/page.tsx`
  Purpose: add a settings card linking to `/dashboard/settings/trust`.
- `apps/web/src/components/storefront/footer.tsx`
  Purpose: add returns/shipping/warranty footer links when available.
- `apps/web/src/components/storefront/ogabassey/components/Footer.tsx`
  Purpose: expose the same trust links in the live Ogabassey footer.
- `apps/web/src/app/(storefront)/[slug]/sitemap.ts`
- `apps/web/src/app/(storefront)/[slug]/sitemap.test.ts`
  Purpose: publish the new trust-policy routes when they have content.
- `apps/web/src/lib/seo-utils.ts`
- `apps/web/src/lib/seo-utils.test.ts`
  Purpose: replace hardcoded organization and PDP trust defaults with trust-profile-derived values.
- `apps/web/src/types/about-page.ts`
  Purpose: keep About-page JSON-LD aligned with the shared trust profile instead of a parallel organization shape.
- `apps/web/src/app/(storefront)/[slug]/storefront-page-content.tsx`
- `apps/web/src/app/(storefront)/[slug]/page.test.tsx`
  Purpose: homepage entity graph consumes the assembled trust profile.
- `apps/web/src/app/(storefront)/[slug]/contact/page.tsx`
- `apps/web/src/app/(storefront)/[slug]/contact/page.test.tsx`
  Purpose: contact-page JSON-LD and visible contact data consume the shared profile.
- `apps/web/src/app/(storefront)/[slug]/about/page.tsx`
- `apps/web/src/app/(storefront)/[slug]/about/page.test.tsx`
- `apps/web/src/app/(storefront)/[slug]/pages/about/page.tsx`
- `apps/web/src/app/(storefront)/[slug]/pages/about/page.test.tsx`
- `apps/web/src/app/(storefront)/[slug]/products/[productSlug]/page.tsx`
- `apps/web/src/app/(storefront)/[slug]/products/[productSlug]/page.test.tsx`
- `apps/web/src/app/(storefront)/[slug]/[category]/[productSlug]/page.tsx`
- `apps/web/src/app/(storefront)/[slug]/[category]/[productSlug]/page.test.tsx`
  Purpose: pass the assembled trust profile into `generateProductSchema(...)`.
- `apps/web/src/components/storefront/ogabassey/seo/product-semantic-sections.tsx`
- `apps/web/src/components/storefront/ogabassey/seo/product-semantic-sections.test.tsx`
  Purpose: render trust-derived buying context from the shared profile.
- `apps/web/src/app/dashboard/integrations/google-merchant/page.tsx`
  Purpose: render Merchant Center readiness alongside the feed URL.
- `apps/web/src/app/api/feed/google-merchant/feed-query.test.ts`
- `apps/web/src/app/api/feed/google-merchant/feed-query.ts`
- `apps/web/src/app/api/feed/google-merchant/feed-data.ts`
- `apps/web/src/app/api/feed/google-merchant/feed-builder.ts`
- `apps/web/src/app/api/feed/google-merchant/feed-builder.test.ts`
  Purpose: improve supported feed fields and align diagnostics with actual emitted data.

## Shared Rules

### Migration shape

The canonical migration SQL is this idempotent form:

```sql
alter table public.merchants
  add column if not exists trust_profile jsonb not null default '{}'::jsonb;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'merchants_trust_profile_is_object'
  ) then
    alter table public.merchants
      add constraint merchants_trust_profile_is_object
      check (jsonb_typeof(trust_profile) = 'object');
  end if;
end $$;
```

Do **not** backfill fake trust data. Existing merchants should start with `{}`.

### Existing-field precedence

The assembler must always prefer existing merchant fields over the JSONB draft for overlapping data:

1. `support_email` over any future email-like trust-profile field
2. `support_phone` over any future phone-like trust-profile field
3. `social_media` over any trust-profile social override
4. `registered_address` over `business_address` for structured schema
5. `pages.contact/privacy/terms/faq` and `about_page` remain their own canonical content sources

### New trust routes

Only publish a route when the corresponding section has meaningful content:

- `/returns` requires `return_policy.summary` or `return_policy.window_days`
- `/shipping` requires `shipping_policy.summary` or a non-empty `shipping_policy.regions`
- `/warranty` requires `warranty_policy.summary`

### Merchant Center diagnostics

Readiness must classify each check as one of:

```ts
type ReadinessSeverity = 'pass' | 'warn' | 'fail';
```

Minimum checks:

- support email or phone present
- social links normalized
- legal entity or registered address present
- return policy present
- shipping policy present
- product brand coverage above zero
- image manifest coverage above zero
- GTIN or MPN coverage surfaced as warn/pass, not fail
- `google_product_category` coverage surfaced as warn/pass, not fail

### Feed output constraints

Phase 5 feed work must stay inside already-supported, currently-emitted feed semantics:

- keep `g:brand`, `g:gtin`, `g:mpn`, `g:identifier_exists`
- keep `g:image_link` and `g:additional_image_link`
- keep `g:product_type`
- do **not** add speculative XML tags not already supported in this codebase

The only feed output change required in this phase is to make `g:product_type` deterministic from category data rather than loose fallback strings.

## Task 1: Add the Shared Trust-Profile Data Layer

**Files:**
- Create: `supabase/migrations/20260418170000_add_merchant_trust_profile.sql`
- Create: `packages/shared/src/contracts/merchant-trust-profile.ts`
- Create: `packages/shared/src/contracts/merchant-trust-profile.test.ts`
- Create: `packages/shared/src/schemas/merchant-trust-profile.ts`
- Create: `packages/shared/src/schemas/merchant-trust-profile.test.ts`
- Create: `apps/web/src/lib/storefront-trust/merchant-trust-profile-types.ts`
- Create: `apps/web/src/lib/storefront-trust/build-merchant-trust-profile.ts`
- Create: `apps/web/src/lib/storefront-trust/build-merchant-trust-profile.test.ts`
- Modify: `apps/web/src/hooks/merchant/types.ts`
- Modify: `apps/web/src/hooks/merchant/queries.ts`
- Modify: `apps/web/src/hooks/merchant/queries.test.ts`
- Modify: `apps/web/src/lib/cached-data.ts`
- Modify: `apps/web/src/lib/cached-data.merchant-safe.test.ts`

- [ ] **Step 1: Write the failing contract and assembler tests**

Cover these concrete cases:

```ts
const merchant = {
  business_name: 'Ogabassey',
  support_email: 'support@ogabassey.com',
  support_phone: '+2348000000000',
  social_media: { instagram: '@ogabassey', twitter: '@ogabasseyhq' },
  business_address: '12 Allen Avenue, Ikeja, Lagos',
  legal_entity_name: 'Ogabassey Gadgets Ltd',
  registered_address: {
    street: '12 Allen Avenue',
    city: 'Ikeja',
    state: 'Lagos',
    country: 'Nigeria',
  },
  tax_identification_number: 'TIN-123',
  pages: { privacy: 'Privacy copy', contact: 'Contact copy' },
  trust_profile: {
    founded_year: 2018,
    customer_service: {
      whatsapp_number: '+2348111111111',
      hours_summary: 'Mon-Sat, 8am-6pm',
      timezone: 'Africa/Lagos',
      response_time_summary: 'Within 2 business hours',
    },
    return_policy: {
      summary: 'Returns accepted for defective items.',
      window_days: 7,
      return_method: 'mail',
      return_fees: 'free',
    },
    shipping_policy: {
      summary: 'Nationwide delivery available.',
      regions: ['NG'],
      handling_days_min: 0,
      handling_days_max: 1,
      transit_days_min: 1,
      transit_days_max: 5,
      shipping_fee_type: 'calculated',
    },
    warranty_policy: { summary: 'Manufacturer warranty applies.' },
  },
};
```

Assertions must prove:

- overlapping support/social/legal fields come from existing merchant columns
- new sections come from `trust_profile`
- empty `{}` returns a sparse assembled model without fake defaults
- malformed arrays/non-object JSON fail Zod validation
- `fetchDashboardMerchant(...)` still returns merchant records with the new `trust_profile` / support / legal fields populated
- `getMerchantSafe(...)` and `getRequestScopedMerchant(...)` still expose those fields on storefront merchant fetches

- [ ] **Step 2: Add the migration**

Use this exact SQL core:

```sql
alter table public.merchants
  add column if not exists trust_profile jsonb not null default '{}'::jsonb;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'merchants_trust_profile_is_object'
  ) then
    alter table public.merchants
      add constraint merchants_trust_profile_is_object
      check (jsonb_typeof(trust_profile) = 'object');
  end if;
end $$;
```

- [ ] **Step 3: Implement the shared contracts and assembler**

Requirements:

- `packages/shared` owns the draft JSON shape and Zod schema
- `build-merchant-trust-profile.ts` owns all precedence rules and social-link normalization
- `CachedMerchant` and `MerchantData` both expose `trust_profile`
- `CachedMerchant` must add typed fields for:
  - `trust_profile`
  - `support_email`
  - `support_phone`
  - `legal_entity_name`
  - `registered_address`
  - `tax_identification_number`
- `cached-data.ts` must explicitly select those fields anywhere it selects merchant storefront fields
- extend the existing `apps/web/src/hooks/merchant/queries.test.ts` assertions instead of inventing a parallel fetch-helper test
- extend the existing `apps/web/src/lib/cached-data.merchant-safe.test.ts` assertions so storefront merchant fetch helpers prove the new fields survive the cached path

- [ ] **Step 4: Run focused verification**

Run:

```bash
pnpm turbo test --filter=@baci/web -- apps/web/src/lib/storefront-trust/build-merchant-trust-profile.test.ts packages/shared/src/contracts/merchant-trust-profile.test.ts packages/shared/src/schemas/merchant-trust-profile.test.ts apps/web/src/hooks/merchant/queries.test.ts apps/web/src/lib/cached-data.merchant-safe.test.ts
```

Expected: the new trust-profile tests pass and the existing dashboard/storefront merchant fetch helpers still expose the new fields.

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/20260418170000_add_merchant_trust_profile.sql \
  packages/shared/src/contracts/merchant-trust-profile.ts \
  packages/shared/src/contracts/merchant-trust-profile.test.ts \
  packages/shared/src/schemas/merchant-trust-profile.ts \
  packages/shared/src/schemas/merchant-trust-profile.test.ts \
  apps/web/src/lib/storefront-trust/merchant-trust-profile-types.ts \
  apps/web/src/lib/storefront-trust/build-merchant-trust-profile.ts \
  apps/web/src/lib/storefront-trust/build-merchant-trust-profile.test.ts \
  apps/web/src/hooks/merchant/types.ts \
  apps/web/src/hooks/merchant/queries.ts \
  apps/web/src/hooks/merchant/queries.test.ts \
  apps/web/src/lib/cached-data.ts \
  apps/web/src/lib/cached-data.merchant-safe.test.ts
git commit -m "feat: add shared merchant trust profile model"
```

## Task 2: Add Shared Dashboard Capture for Missing Trust Fields

**Files:**
- Create: `apps/web/src/app/dashboard/settings/page.test.tsx`
- Create: `apps/web/src/app/dashboard/settings/trust/page.tsx`
- Create: `apps/web/src/app/dashboard/settings/trust/page.test.tsx`
- Create: `apps/web/src/app/dashboard/settings/trust/trust-settings-client.tsx`
- Create: `apps/web/src/app/dashboard/settings/trust/trust-settings-client.test.tsx`
- Modify: `apps/web/src/app/dashboard/settings/page.tsx`

- [ ] **Step 1: Write the failing UI tests**

Cover these exact behaviors:

- the settings landing page shows a new card linking to `/dashboard/settings/trust`
- the trust settings page loads the existing merchant `trust_profile`
- submitting the form calls `updateMerchant({ trust_profile: ... })`
- the page includes deep links back to:
  - `/dashboard/settings` for social media/contact basics
  - `/dashboard/pages` for privacy/terms/contact/about/faq
  - `/dashboard/settings/tax` for legal entity and registered address

- [ ] **Step 2: Define the missing-field editor only**

`trust-settings-client.tsx` must edit only these new JSON-backed fields:

```ts
type EditableTrustProfileFields = {
  founded_year?: number | null;
  customer_service?: {
    whatsapp_number?: string | null;
    hours_summary?: string | null;
    timezone?: string | null;
    response_time_summary?: string | null;
  };
  return_policy?: {
    summary?: string | null;
    window_days?: number | null;
    return_method?: 'mail' | 'in_store' | 'carrier_dropoff' | null;
    return_fees?: 'free' | 'customer_pays' | 'original_shipping_deducted' | null;
  };
  shipping_policy?: {
    summary?: string | null;
    regions?: string[] | null;
    handling_days_min?: number | null;
    handling_days_max?: number | null;
    transit_days_min?: number | null;
    transit_days_max?: number | null;
    shipping_fee_type?: 'free' | 'flat_rate' | 'calculated' | null;
  };
  warranty_policy?: {
    summary?: string | null;
  };
};
```

Do **not** duplicate editors for `support_email`, `support_phone`, `social_media`, `privacy`, `terms`, or `legal_entity_name` on this page.

- [ ] **Step 3: Implement the page and settings card**

Requirements:

- `page.tsx` is a server component that pulls the current merchant from `getMerchantForUser()`
- `trust-settings-client.tsx` is the only client component for the form
- use the shared Zod schema from `packages/shared`
- sanitize empty strings back to `null` before calling `updateMerchant(...)`
- `settings/page.tsx` adds a new navigation card labeled `Trust & Policies`

- [ ] **Step 4: Run focused verification**

Run:

```bash
pnpm turbo test --filter=@baci/web -- apps/web/src/app/dashboard/settings/page.test.tsx apps/web/src/app/dashboard/settings/trust/page.test.tsx apps/web/src/app/dashboard/settings/trust/trust-settings-client.test.tsx apps/web/src/app/dashboard/settings/components/settings-form.test.tsx
```

Expected: the new trust settings suite passes and the main settings page still renders.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/app/dashboard/settings/page.tsx \
  apps/web/src/app/dashboard/settings/page.test.tsx \
  apps/web/src/app/dashboard/settings/trust/page.tsx \
  apps/web/src/app/dashboard/settings/trust/page.test.tsx \
  apps/web/src/app/dashboard/settings/trust/trust-settings-client.tsx \
  apps/web/src/app/dashboard/settings/trust/trust-settings-client.test.tsx
git commit -m "feat: add dashboard trust and policy settings"
```

## Task 3: Add Public Trust Routes, Footer Links, and Sitemap Coverage

**Files:**
- Create: `apps/web/src/components/storefront/trust/trust-policy-page-client.tsx`
- Create: `apps/web/src/components/storefront/trust/trust-policy-page-client.test.tsx`
- Create: `apps/web/src/components/storefront/footer.test.tsx`
- Create: `apps/web/src/components/storefront/ogabassey/components/Footer.test.tsx`
- Create: `apps/web/src/app/(storefront)/[slug]/returns/page.tsx`
- Create: `apps/web/src/app/(storefront)/[slug]/returns/page.test.tsx`
- Create: `apps/web/src/app/(storefront)/[slug]/shipping/page.tsx`
- Create: `apps/web/src/app/(storefront)/[slug]/shipping/page.test.tsx`
- Create: `apps/web/src/app/(storefront)/[slug]/warranty/page.tsx`
- Create: `apps/web/src/app/(storefront)/[slug]/warranty/page.test.tsx`
- Modify: `apps/web/src/components/storefront/footer.tsx`
- Modify: `apps/web/src/components/storefront/ogabassey/components/Footer.tsx`
- Modify: `apps/web/src/app/(storefront)/[slug]/sitemap.ts`
- Modify: `apps/web/src/app/(storefront)/[slug]/sitemap.test.ts`

- [ ] **Step 1: Write the failing route, footer, and sitemap tests**

Assertions must prove:

- `/returns` renders when `return_policy.summary` or `window_days` exists
- `/shipping` renders when `shipping_policy.summary` or `regions` exists
- `/warranty` renders when `warranty_policy.summary` exists
- each route returns `notFound()` when its section is empty
- sitemap includes the new URLs only when the assembled trust profile exposes them
- `apps/web/src/components/storefront/footer.test.tsx` proves the shared footer renders `Returns`, `Shipping`, and `Warranty` only when those derived links are available
- `apps/web/src/components/storefront/ogabassey/components/Footer.test.tsx` proves the live Ogabassey footer renders the same links only when available

- [ ] **Step 2: Build the shared trust-policy page renderer**

The shared page component must support this shape:

```ts
type TrustPolicyPageKind = 'returns' | 'shipping' | 'warranty';
```

It must render:

- H1 title
- merchant name
- primary summary
- structured facts list
- link back to `/contact`

Use facts exactly like this:

- returns:
  - `Return window`
  - `Return method`
  - `Return fees`
- shipping:
  - `Regions`
  - `Handling time`
  - `Transit time`
  - `Shipping fees`
- warranty:
  - `Coverage`

- [ ] **Step 3: Implement the routes, footer links, and sitemap entries**

Requirements:

- each route uses `getRequestScopedMerchant(slug)` and `build-merchant-trust-profile.ts`
- each route emits canonical metadata and a simple `WebPage` JSON-LD object
- `apps/web/src/components/storefront/footer.tsx` adds `Returns`, `Shipping`, and `Warranty` only when available
- `apps/web/src/components/storefront/ogabassey/components/Footer.tsx` adds the same links to the live Ogabassey storefront
- do **not** modify `apps/web/src/components/storefront/ogabassey/layout/footer.tsx` for this task; that file is preview-only and is not what `storefront-layout-chrome.tsx` renders at runtime
- `sitemap.ts` emits those URLs when the trust profile has content, even if a bespoke template footer does not link them yet

- [ ] **Step 4: Run focused verification**

Run:

```bash
pnpm turbo test --filter=@baci/web -- "apps/web/src/app/(storefront)/[slug]/returns/page.test.tsx" "apps/web/src/app/(storefront)/[slug]/shipping/page.test.tsx" "apps/web/src/app/(storefront)/[slug]/warranty/page.test.tsx" "apps/web/src/components/storefront/trust/trust-policy-page-client.test.tsx" "apps/web/src/components/storefront/footer.test.tsx" "apps/web/src/components/storefront/ogabassey/components/Footer.test.tsx" "apps/web/src/app/(storefront)/[slug]/sitemap.test.ts"
```

Expected: all new trust-route, footer, and sitemap tests pass.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/components/storefront/trust/trust-policy-page-client.tsx \
  apps/web/src/components/storefront/trust/trust-policy-page-client.test.tsx \
  apps/web/src/components/storefront/footer.tsx \
  apps/web/src/components/storefront/footer.test.tsx \
  apps/web/src/components/storefront/ogabassey/components/Footer.tsx \
  apps/web/src/components/storefront/ogabassey/components/Footer.test.tsx \
  "apps/web/src/app/(storefront)/[slug]/returns/page.tsx" \
  "apps/web/src/app/(storefront)/[slug]/returns/page.test.tsx" \
  "apps/web/src/app/(storefront)/[slug]/shipping/page.tsx" \
  "apps/web/src/app/(storefront)/[slug]/shipping/page.test.tsx" \
  "apps/web/src/app/(storefront)/[slug]/warranty/page.tsx" \
  "apps/web/src/app/(storefront)/[slug]/warranty/page.test.tsx" \
  "apps/web/src/app/(storefront)/[slug]/sitemap.ts" \
  "apps/web/src/app/(storefront)/[slug]/sitemap.test.ts"
git commit -m "feat: publish storefront trust policy routes"
```

## Task 4: Replace Ad Hoc Entity and PDP Trust Defaults with the Shared Profile

**Files:**
- Modify: `apps/web/src/lib/seo-utils.ts`
- Modify: `apps/web/src/lib/seo-utils.test.ts`
- Modify: `apps/web/src/types/about-page.ts`
- Modify: `apps/web/src/app/(storefront)/[slug]/storefront-page-content.tsx`
- Modify: `apps/web/src/app/(storefront)/[slug]/page.test.tsx`
- Modify: `apps/web/src/app/(storefront)/[slug]/contact/page.tsx`
- Modify: `apps/web/src/app/(storefront)/[slug]/contact/page.test.tsx`
- Modify: `apps/web/src/app/(storefront)/[slug]/about/page.tsx`
- Modify: `apps/web/src/app/(storefront)/[slug]/about/page.test.tsx`
- Modify: `apps/web/src/app/(storefront)/[slug]/pages/about/page.tsx`
- Modify: `apps/web/src/app/(storefront)/[slug]/pages/about/page.test.tsx`
- Modify: `apps/web/src/app/(storefront)/[slug]/products/[productSlug]/page.tsx`
- Modify: `apps/web/src/app/(storefront)/[slug]/products/[productSlug]/page.test.tsx`
- Modify: `apps/web/src/app/(storefront)/[slug]/[category]/[productSlug]/page.tsx`
- Modify: `apps/web/src/app/(storefront)/[slug]/[category]/[productSlug]/page.test.tsx`
- Modify: `apps/web/src/components/storefront/ogabassey/seo/product-semantic-sections.tsx`
- Modify: `apps/web/src/components/storefront/ogabassey/seo/product-semantic-sections.test.tsx`

- [ ] **Step 1: Write the failing schema and PDP trust tests**

Add regression coverage proving:

- homepage `OnlineStore` now includes:
  - normalized `sameAs`
  - `contactPoint`
  - `foundingDate` when present
  - `hasMerchantReturnPolicy` when return policy exists
- contact page JSON-LD uses support email/phone from the assembled trust profile
- `generateProductSchema(...)` no longer hardcodes `merchantReturnDays: 7`
- PDP schema shipping/return values come from the trust profile's structured shipping/return settings
- Ogabassey product semantic sections render trust bullets such as:
  - `Free returns within 7 days`
  - `Ships across Nigeria`
  - `WhatsApp support available`

- [ ] **Step 2: Extend the schema helpers**

`seo-utils.ts` must change in these concrete ways:

```ts
generateOrganizationSchema(data: OrganizationData & {
  trustProfile?: MerchantTrustProfile;
})

generateProductSchema(
  product,
  merchantName,
  currency,
  country,
  merchantLogo,
  trustProfile?
)
```

Mapping rules:

- `return_method: 'mail'` -> `https://schema.org/ReturnByMail`
- `return_method: 'in_store'` -> `https://schema.org/ReturnInStore`
- `return_method: 'carrier_dropoff'` -> `https://schema.org/ReturnByMail`
- `return_fees: 'free'` -> `https://schema.org/FreeReturn`
- `return_fees: 'customer_pays'` -> `https://schema.org/ReturnShippingFees`
- `return_fees: 'original_shipping_deducted'` -> `https://schema.org/OriginalShippingFees`

If a trust-profile field is missing, preserve today's behavior only as a fallback.

- [ ] **Step 3: Thread the assembled trust profile through the storefront routes**

Requirements:

- homepage, contact, and about routes all call `buildMerchantTrustProfile(merchant, baseUrl)`
- both PDP route files pass the assembled profile into `generateProductSchema(...)`
- `product-semantic-sections.tsx` receives precomputed trust bullets from the assembled profile, not ad hoc string literals

- [ ] **Step 4: Run focused verification**

Run:

```bash
pnpm turbo test --filter=@baci/web -- apps/web/src/lib/seo-utils.test.ts "apps/web/src/app/(storefront)/[slug]/page.test.tsx" "apps/web/src/app/(storefront)/[slug]/contact/page.test.tsx" "apps/web/src/app/(storefront)/[slug]/about/page.test.tsx" "apps/web/src/app/(storefront)/[slug]/pages/about/page.test.tsx" "apps/web/src/app/(storefront)/[slug]/products/[productSlug]/page.test.tsx" "apps/web/src/app/(storefront)/[slug]/[category]/[productSlug]/page.test.tsx" apps/web/src/components/storefront/ogabassey/seo/product-semantic-sections.test.tsx
```

Expected: schema and PDP trust suites pass with trust-profile-derived output.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/lib/seo-utils.ts \
  apps/web/src/lib/seo-utils.test.ts \
  apps/web/src/types/about-page.ts \
  "apps/web/src/app/(storefront)/[slug]/storefront-page-content.tsx" \
  "apps/web/src/app/(storefront)/[slug]/page.test.tsx" \
  "apps/web/src/app/(storefront)/[slug]/contact/page.tsx" \
  "apps/web/src/app/(storefront)/[slug]/contact/page.test.tsx" \
  "apps/web/src/app/(storefront)/[slug]/about/page.tsx" \
  "apps/web/src/app/(storefront)/[slug]/about/page.test.tsx" \
  "apps/web/src/app/(storefront)/[slug]/pages/about/page.tsx" \
  "apps/web/src/app/(storefront)/[slug]/pages/about/page.test.tsx" \
  "apps/web/src/app/(storefront)/[slug]/products/[productSlug]/page.tsx" \
  "apps/web/src/app/(storefront)/[slug]/products/[productSlug]/page.test.tsx" \
  "apps/web/src/app/(storefront)/[slug]/[category]/[productSlug]/page.tsx" \
  "apps/web/src/app/(storefront)/[slug]/[category]/[productSlug]/page.test.tsx" \
  apps/web/src/components/storefront/ogabassey/seo/product-semantic-sections.tsx \
  apps/web/src/components/storefront/ogabassey/seo/product-semantic-sections.test.tsx
git commit -m "feat: derive storefront trust schema from merchant profile"
```

## Task 5: Add Merchant Center Readiness and Safe Feed Enrichment

**Files:**
- Create: `apps/web/src/lib/storefront-trust/build-google-merchant-readiness.ts`
- Create: `apps/web/src/lib/storefront-trust/build-google-merchant-readiness.test.ts`
- Create: `apps/web/src/components/dashboard/integrations/google-merchant-readiness-card.tsx`
- Create: `apps/web/src/components/dashboard/integrations/google-merchant-readiness-card.test.tsx`
- Create: `apps/web/src/app/dashboard/integrations/google-merchant/page.test.tsx`
- Create: `apps/web/src/app/api/integrations/google-merchant-center/readiness/route.ts`
- Create: `apps/web/src/app/api/integrations/google-merchant-center/readiness/route.test.ts`
- Create: `apps/web/src/app/api/feed/google-merchant/feed-query.test.ts`
- Modify: `apps/web/src/app/dashboard/integrations/google-merchant/page.tsx`
- Modify: `apps/web/src/app/api/feed/google-merchant/feed-query.ts`
- Modify: `apps/web/src/app/api/feed/google-merchant/feed-data.ts`
- Modify: `apps/web/src/app/api/feed/google-merchant/feed-data.test.ts`
- Modify: `apps/web/src/app/api/feed/google-merchant/feed-builder.ts`
- Modify: `apps/web/src/app/api/feed/google-merchant/feed-builder.test.ts`

- [ ] **Step 1: Write the failing readiness and feed tests**

Cover these exact scenarios:

- readiness returns `fail` when no support contact exists
- readiness returns `warn` when GTIN/MPN coverage is zero but brand/image coverage is present
- readiness returns `warn` when `google_product_category` coverage is partial
- readiness returns `pass` when return/shipping policy and support basics are present
- dashboard Merchant Center page renders the new readiness card beneath the feed URL section
- `feed-query.test.ts` proves `FEED_PRODUCTS_SELECT` now includes both `category_slug` and `product_categories(categories(name, slug))`
- `feed-data.test.ts` proves `product_categories(categories(name, slug))` is flattened into the existing `FeedProduct.categories` / `category_slug` shape before XML generation
- feed builder emits deterministic `g:product_type` from category data instead of falling back to an arbitrary text field

- [ ] **Step 2: Define the readiness result shape**

Use this exact public shape:

```ts
interface MerchantCenterReadinessCheck {
  id:
    | 'support-contact'
    | 'social-profiles'
    | 'legal-identity'
    | 'return-policy'
    | 'shipping-policy'
    | 'brand-coverage'
    | 'image-coverage'
    | 'identifier-coverage'
    | 'google-category-coverage';
  label: string;
  severity: 'pass' | 'warn' | 'fail';
  message: string;
}
```

Then return:

```ts
interface MerchantCenterReadiness {
  checks: MerchantCenterReadinessCheck[];
  totals: {
    products: number;
    withBrand: number;
    withIdentifier: number;
    withGoogleCategory: number;
    withVerifiedImage: number;
  };
}
```

- [ ] **Step 3: Implement the route, card UI, and feed alignment**

Requirements:

- readiness route authenticates the current merchant using existing dashboard auth
- route loads:
  - merchant
  - assembled trust profile
  - cached feed data
- Merchant Center dashboard page renders the readiness card under the feed URL block
- `feed-query.ts` must explicitly add:
  - `category_slug`
  - `product_categories(categories(name, slug))`
  so `feed-data.ts` can flatten the first joined category into the existing `FeedProduct.categories` and `FeedProduct.category_slug` shape before `feed-builder.ts` derives `g:product_type`
- `feed-query.test.ts` must assert directly against the exported `FEED_PRODUCTS_SELECT` string so the live products query cannot regress while downstream mocks still pass
- do **not** use a bare `categories(name, slug)` relation in `FEED_PRODUCTS_SELECT`; this feed path queries `products` directly and must follow the supported `product_categories(categories(...))` join shape already used elsewhere in the codebase
- extend the existing `apps/web/src/app/api/feed/google-merchant/feed-data.test.ts` instead of inventing a new test file; it must assert that a product row with joined `product_categories(categories(name, slug))` is normalized into the category fields the builder already consumes
- `feed-builder.ts` must prefer the normalized category path for `g:product_type`

- [ ] **Step 4: Run focused verification**

Run:

```bash
pnpm turbo test --filter=@baci/web -- apps/web/src/lib/storefront-trust/build-google-merchant-readiness.test.ts apps/web/src/components/dashboard/integrations/google-merchant-readiness-card.test.tsx apps/web/src/app/dashboard/integrations/google-merchant/page.test.tsx apps/web/src/app/api/integrations/google-merchant-center/readiness/route.test.ts apps/web/src/app/api/feed/google-merchant/feed-query.test.ts apps/web/src/app/api/feed/google-merchant/feed-data.test.ts apps/web/src/app/api/feed/google-merchant/feed-builder.test.ts
```

Expected: readiness diagnostics, dashboard page, feed-query projection, feed-data normalization, and feed builder tests pass.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/lib/storefront-trust/build-google-merchant-readiness.ts \
  apps/web/src/lib/storefront-trust/build-google-merchant-readiness.test.ts \
  apps/web/src/components/dashboard/integrations/google-merchant-readiness-card.tsx \
  apps/web/src/components/dashboard/integrations/google-merchant-readiness-card.test.tsx \
  apps/web/src/app/dashboard/integrations/google-merchant/page.tsx \
  apps/web/src/app/dashboard/integrations/google-merchant/page.test.tsx \
  apps/web/src/app/api/integrations/google-merchant-center/readiness/route.ts \
  apps/web/src/app/api/integrations/google-merchant-center/readiness/route.test.ts \
  apps/web/src/app/api/feed/google-merchant/feed-query.test.ts \
  apps/web/src/app/api/feed/google-merchant/feed-query.ts \
  apps/web/src/app/api/feed/google-merchant/feed-data.ts \
  apps/web/src/app/api/feed/google-merchant/feed-data.test.ts \
  apps/web/src/app/api/feed/google-merchant/feed-builder.ts \
  apps/web/src/app/api/feed/google-merchant/feed-builder.test.ts
git commit -m "feat: add merchant center trust readiness checks"
```

## Final Verification

- [ ] Run the full web quality gate:

```bash
pnpm turbo lint --filter=@baci/web
pnpm turbo typecheck --filter=@baci/web
pnpm turbo test --filter=@baci/web
```

Expected:

- Biome passes with no new errors
- typecheck passes
- all `@baci/web` tests pass, including the new trust-profile, storefront-route, schema, and Merchant Center suites

- [ ] Perform one manual HTML spot check:

1. open a published storefront homepage and confirm the `OnlineStore` JSON-LD contains `contactPoint` and return-policy data when configured
2. open one PDP and confirm the product schema no longer hardcodes the old `7 day` fallback when trust settings are present
3. open `/returns`, `/shipping`, and `/warranty` on a merchant with data and confirm each route renders server HTML

## Notes for Implementers

- Keep the assembled trust-profile logic in one place. Do not duplicate merge logic in routes, schema helpers, or the Merchant Center readiness layer.
- Reuse existing editors for existing fields. Phase 5 succeeds only if the new trust page fills the missing fields without stealing ownership from the social/media/pages/tax surfaces that already exist.
- Treat external social handles consistently. Normalize them once in the assembler, not separately in footer/schema/contact/homepage code paths.
- The new trust routes must be additive. Existing `/contact`, `/privacy-policy`, `/faq`, and `/about` routes continue to work exactly as they do today.
