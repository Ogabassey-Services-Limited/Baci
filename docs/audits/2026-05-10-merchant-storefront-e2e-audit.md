# Merchant Storefront End-to-End Audit - 2026-05-10

## Executive Summary

Status: implementation and verification in progress.

Chrome E2E coverage is complete for every configured generated business type:
food-beverage, pharmaceuticals, fashion, electronics, home-goods,
health-beauty, hair-extensions, and handmade.

Each tested merchant completed signup, storefront creation, sign-in, product
creation, storefront publish, storefront checkout, order placement, and
dashboard order visibility. Verified defects were fixed locally and covered by
targeted tests.

## Environment

- Audit date: 2026-05-10
- Source branch: `codex/merchant-storefront-e2e-audit`
- Base target: `origin/main`
- Branch base commit after reconciliation: `b147177796`
- Current `origin/main`: `b147177796`
- Worktree:
  `/Users/mac/.config/superpowers/worktrees/Baci-app/merchant-storefront-e2e-audit`
- Browser harness: Chrome plugin
- Local app: `http://localhost:3000`
- Supabase project URL: `https://aivqthbxdshhltbwipbr.supabase.co`
- Supabase CLI: `2.95.4`

## Merchant Matrix

| Merchant Type | Business Type ID | Merchant Slug | Product | Order Evidence | Status |
| --- | --- | --- | --- | --- | --- |
| Food | `food-beverage` | `foodflow-1778445373839` | `Rice Bowl 1778445373839` | `f13554eb-29f6-4c62-be2f-52fe650fcca5` | Passed |
| Pharmacy | `pharmaceuticals` | `medix-1778449023022` | `Paracetamol Pack 1778449023022` | `fe60d09f-be25-40f7-859b-f90401c0f662` | Passed |
| Fashion | `fashion` | `style-1778451600001` | `Linen Dress 1778451600001` | `30026031-2080-4cf3-921c-0cf807d9a8d0` | Passed |
| Electronics | `electronics` | `volt-1778455200001` | `Power Bank 1778455200001` | `b8cec44b-9336-4a66-8459-ca918b8728a9` | Passed |
| Home goods | `home-goods` | `nest-1778453521195` | `Ceramic Vase 1778453521195` | `dd474617-581e-4ffb-ad36-38bde1a61723` | Passed |
| Health and beauty | `health-beauty` | `glow-1778454508893` | `Glow Serum 1778454508893` | `89e33659-b555-4e5e-add8-849f58ab8774` | Passed |
| Hair extensions | `hair-extensions` | `strand-1778454931672` | `Brazilian Bundle 1778454931672` | `b96de5d2-64ca-420b-8958-30f41f64ec81` | Passed |
| Handmade | `handmade` | `craft-1778455637896` | `Woven Basket 1778455637896` | `cfd0e0c5-eee3-4438-b404-d2586a1918fe` | Passed |
| Handmade post-merge smoke | `handmade` | `craft-1778455637896` | `Woven Basket 1778455637896` | `7323b580-c9ff-4b2b-b09b-1abb234feabb` / `ORD-260511-00AQ-T` | Passed |

## Chrome Evidence

- Chrome extension connection is working.
- All eight generated storefronts loaded from `http://localhost:3000/<slug>`.
- Accessible DOM verification found hero content, `Why Choose Us`, product
  cards, newsletter content, and merchant-scoped product links for every
  generated storefront.
- The handmade dashboard session verified `/dashboard/orders` contains the
  placed `Ada Craft` / `Woven Basket 1778455637896` order.
- After reconciling with `origin/main` at `b147177796`, Chrome rechecked all
  eight storefront home and product-listing routes. Each route loaded with
  industry hero copy and the expected product.
- The post-merge handmade checkout placed a pickup / pay-on-delivery order and
  redirected to
  `/craft-1778455637896/order-success?type=standard&orderId=7323b580-c9ff-4b2b-b09b-1abb234feabb&trackingToken=...`.
- The dashboard orders page showed the new order as `ORD-260511-00AQ-T` for
  `Ada Craft`, and the sidebar count updated to `Orders 2`.
- After Chrome was reinstalled, the Chrome extension connection was rechecked.
  A final browser smoke loaded all eight `/products` routes and confirmed each
  expected product plus tenant-scoped product links. The dashboard orders page
  stayed authenticated and showed `Ada Craft` / `ORD-260511-00AQ-T` after client
  hydration.
- After a later Chrome reconnection test, the sign-in flow was exercised through
  the local UI with the provided credentials and redirected to
  `/dashboard/orders`. The visible dashboard tab was claimed through Chrome and
  verified to contain live Ogabassey order rows.
- A final all-industry Chrome home-page smoke loaded all eight storefront home
  pages and confirmed industry-specific hero copy, product sections, and no real
  404/500/application-error markers. The audit food and handmade rows in
  `page_configs` were generated before the current
  `generateInitialTemplate` / `generateHeroSlides` fallback copy landed, so
  their stored Puck `draft_config` and `published_config` still contained stale
  generic carousel text. Those two audit rows were refreshed directly in
  Supabase to match the current deterministic generator output before rerunning
  the Chrome presentation smoke.
- Earlier `innerText` checks under-counted content because client-rendered Puck
  sections were present in the accessible DOM but not reflected in the quick
  text probe.

## Fixes Applied

- Added logo-generation fallback so onboarding can continue when AI logo
  generation is rate-limited or unavailable.
- Preserved generated brand colors through onboarding and preview.
- Wrapped onboarding Puck preview in the required merchant/cart providers.
- Ensured local onboarding redirects use the local app origin and preserve the
  full business-name slug.
- Persisted product stock fields from dashboard product creation.
- Fixed dashboard add-product slug auto-sync after product-name edits.
- Centralized merchant publish requests for setup checklist and dashboard use.
- Added industry-specific initial template copy for generated business types.
- Added handmade-specific second and third hero-slide fallback copy so handmade
  starter stores no longer inherit generic fashion/catalog wording.
- Added industry-aware storefront metadata.
- Guarded checkout payment/delivery selections before order creation.
- Fixed scoped storefront product links and footer links for generated slugs.
- Fixed image loader width/quality URL parameters.
- Added `/dashboard/products/add` redirect compatibility.
- Hydrated dashboard auth with the server user to avoid auth-loop flashes.
- Fixed product catalog autosave loop behavior.
- Fixed duplicate carousel key warnings.
- Added `20260510233731_fix_order_number_uuid_offset.sql` to prevent generated
  order numbers from collapsing to `ORD-YYMMDD-0000-*` for UUID prefixes that
  previously produced negative signed offsets.

## Migration Reconciliation

- `supabase migration list --linked` shows remote migrations are applied through
  `20260510180000`.
- This worktree is missing remote-applied migrations `20260510160000`,
  `20260510170000`, and `20260510180000`; they are also absent from current
  `origin/main` after fetch.
- This branch adds one new local-only migration:
  `20260510233731_fix_order_number_uuid_offset.sql`.
- The new migration has not been applied to the Supabase project.
- SQL verification used a rolled-back transaction with a temporary function.
  Verified examples:
  - Existing signed offset path: `8f0ed783...` encoded to `0000`.
  - Corrected unsigned offset path: `8f0ed783...` encoded to `00HM`.
  - Corrected unsigned offset path: `d95a5a32...` encoded to `006B`.

## Remaining Risks

- Remote migration drift must be reconciled before applying new migrations to
  the linked Supabase project. Applying this branch without accounting for the
  three remote-only migrations will keep migration history out of sync.
- Local Docker is not running, so Supabase local migration execution could not
  be used for full database replay.
- Stock values for some E2E products were corrected through Supabase after
  Chrome automation could not reliably set numeric stock fields. Product API
  tests cover persistence, and this was not reproduced as a browser app defect.
- Dev-server performance observations are local only. Chrome showed good FCP on
  generated storefronts, with one local TTFB sample in the needs-improvement
  range during dev-server compilation/caching.

## Verification Commands

- `pnpm --filter @baci/web exec vitest run src/ai/flows/fallback-logo.test.ts src/ai/flows/guide-business-onboarding.test.ts src/components/onboarding/steps/step2-branding.test.tsx src/components/onboarding-puck-preview.test.tsx src/app/onboarding/actions.test.ts src/app/api/products/route.test.ts src/app/dashboard/products/add/add-product-form.test.tsx src/lib/merchant-publish-client.test.ts src/lib/initial-template-generator.test.ts 'src/app/(storefront)/[slug]/layout.test.tsx' src/components/builder/config-footer-links.test.tsx src/lib/image-loader.test.ts src/components/storefront/blocks/ogabassey-hero.test.tsx src/components/storefront/ogabassey/pages/checkout-page.test.tsx src/contexts/auth-context.test.tsx src/app/dashboard/providers.test.tsx src/app/dashboard/auth-guard.test.tsx src/app/dashboard/products/add/page.test.tsx src/components/products/save-dirty-products.test.ts src/components/storefront/product-card.test.tsx`
  - Result: 20 files passed, 137 tests passed.
- Chrome storefront accessible matrix:
  - Result: all eight storefronts passed hero, product, newsletter, and scoped
    product-link checks.
- Chrome dashboard orders check:
  - Result: `/dashboard/orders` showed the handmade E2E order.
- Chrome sign-in check:
  - Result: local sign-in with the provided credentials redirected to
    `/dashboard/orders`, and the claimed Chrome tab showed live order rows.
- Chrome all-industry home-page presentation smoke:
  - Result: all eight home pages showed expected industry-specific hero copy,
    product sections, and no real error markers.
- `pnpm --filter @baci/web exec vitest run src/lib/initial-template-generator.test.ts`
  - Result: 1 file passed, 12 tests passed.
- `pnpm turbo lint`
  - Result: web Biome check passed; mobile-storefront replayed existing
    warnings only, with zero errors.
- `pnpm turbo typecheck`
  - Result: 4 tasks successful.
- `pnpm turbo test`
  - Result: 948 test files passed, 1 skipped; 7774 tests passed, 1 todo.
- `coderabbit review --agent -t uncommitted -c AGENTS.md`
  - Result: blocked by CodeRabbit usage quota:
    `rate_limit`, wait time `16 minutes and 19 seconds`.
  - Retried after the quota window; CodeRabbit returned `rate_limit` again
    with wait time `15 minutes and 55 seconds`, indicating account usage is
    still exhausted.
