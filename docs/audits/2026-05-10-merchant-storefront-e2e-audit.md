# Merchant Storefront End-to-End Audit - 2026-05-10

## Executive Summary

Status: implementation and verification complete.

Chrome E2E coverage is complete for every configured generated business type:
food-beverage, pharmaceuticals, fashion, electronics, home-goods,
health-beauty, hair-extensions, and handmade.

Each tested merchant completed signup, storefront creation, sign-in, product
creation, storefront publish, storefront checkout, order placement, and
dashboard order visibility. Verified defects were fixed locally and covered by
targeted tests.

## Environment

- Audit date: 2026-05-10 through 2026-05-12
- Source branch: `codex/merchant-storefront-e2e-audit`
- Base target: `origin/main`
- Branch commit after latest main reconciliation: `8e5cb881468`
- Current `origin/main`: `35cabe857736`
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
| Food continuation smoke | `food-beverage` | `baci-food-audit-1778482544331` | `Jollof Rice Bowl` | `c93e0eec-3733-4f82-8839-97b443dea41e` / `ORD-260511-00C8-Q` | Passed |
| Pharmacy continuation smoke | `pharmaceuticals` | `baci-pharmacy-audit-1778489000001` | `Paracetamol Tablets` | `08a945bb-3d81-4fe8-bbe5-63a8346500fc` / `ORD-260512-00BW-D` | Passed |

## Chrome Evidence

- Chrome extension connection is working.
- All eight generated storefronts loaded from `http://localhost:3000/<slug>`.
- Accessible DOM verification found hero content, `Why Choose Us`, product
  cards, newsletter content, and merchant-scoped product links for every
  generated storefront.
- The handmade dashboard session verified `/dashboard/orders` contains the
  placed `Ada Craft` / `Woven Basket 1778455637896` order.
- After reconciling with `origin/main` at `84dd7f793f`, Chrome rechecked all
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
- On 2026-05-12 the Chrome extension was reconnected after plugin reinstall and
  used against the latest local branch. New food and pharmacy merchant signups
  showed the current industry profile output: food used `Menu`, `Fresh meals,
  simple ordering`, and `Fresh, Fast, Local`; pharmacy used `Health Store`,
  `Wellness essentials you can trust`, and `Safe Healthcare Shopping`.
- The food and pharmacy continuation flows created products from the dashboard,
  published storefront product lists, placed pickup / pay-on-delivery orders,
  reached order-success pages, and showed the orders back in the dashboard.
  Linked Supabase checks confirmed `order_items` rows and `stock_quantity`
  decrements for both products.
- After merging current `origin/main` into the audit branch, Chrome rechecked
  the all-industry storefront fixture set. All eight storefronts loaded without
  application errors and showed tenant-specific hero copy plus the expected
  product. Older fixture stores still render their stored Puck configs, so they
  remain industry-specific but do not automatically adopt newer starter-profile
  copy unless regenerated.

## Storefront Design and AI Generation Notes

- Generated merchants use `template_id: 'puck'`, so their home pages render from
  Puck page configs rather than the hardcoded Ogabassey home template.
- The checkout implementation is still shared from the
  `components/storefront/ogabassey/pages/checkout` module. Current verification
  found tenant scoping, merchant slug propagation, payment availability guards,
  and order creation working for generated merchants. This is acceptable as a
  shared checkout engine, but it should be treated as a generic storefront
  checkout module and eventually renamed/extracted so the folder name does not
  imply Ogabassey-only branding.
- Industry differentiation now happens in the starter Puck profile: food,
  pharmaceuticals, fashion, electronics, home goods, health/beauty, hair, and
  handmade receive industry-specific copy, navigation labels, section order,
  story blocks, product grid titles, grid density, and newsletter framing. This
  keeps first render deterministic while avoiding the previous one-size-fits-all
  starter page.
- Preview-mode product grids now use sample products for the merchant business
  type instead of always showing fashion products. This keeps onboarding preview
  output aligned with the selected industry before any real products exist.
- PR #1565 is merged into `main` and its async AI storefront pipeline is present:
  onboarding can enqueue `storefront_layout_generation` jobs when enabled, the
  worker validates/normalizes generated layouts, the dashboard exposes build
  status, and completed AI drafts apply through the atomic
  `apply_ai_storefront_draft` RPC.
- Product recommendation: keep deterministic industry starter templates as the
  first-render path so signup always produces a working storefront immediately.
  Use AI generation as an asynchronous upgrade/edit layer that can replace or
  refine the starter after validation, because this preserves reliability while
  still enabling stronger industry-specific designs.

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
- Added centralized starter profiles for food, pharmacy, fashion, electronics,
  home goods, health/beauty, hair extensions, handmade/art, and default stores.
- Added pharmacy and hair-extension sample products, and made preview product
  grids business-type aware.
- Fixed storefront product-list freshness after dashboard product creation by
  revalidating the same storefront cache tags used by the products API and by
  fetching the client product list with `cache: 'no-store'`.
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

- Supabase MCP `list_migrations` shows remote migrations are applied through
  `20260510233731`.
- The branch was reconciled with current `origin/main`, including the previously
  remote-only migrations `20260510160000`, `20260510170000`, and
  `20260510180000`.
- This branch added and applied one migration:
  `20260510233731_fix_order_number_uuid_offset.sql`.
- No migration repair was needed. `supabase db push --linked --dry-run`
  identified exactly this one pending migration before application, and
  Supabase MCP `list_migrations` plus CLI `supabase migration list --linked`
  confirmed it in remote history after application.
- SQL verification used a rolled-back transaction against the linked database.
  Verified examples:
  - Existing signed offset path: `8f0ed783...` encoded to `0000`.
  - Corrected unsigned offset path: `8f0ed783...` encoded to `00HM`.
  - Corrected unsigned offset path: `d95a5a32...` encoded to `006B`.
- On 2026-05-12, after merging current `origin/main`, Supabase MCP
  `list_migrations` and CLI `supabase migration list --linked` both showed
  local and remote history aligned through `20260511120000`. A fresh
  `supabase db push --linked --dry-run` attempt did not reach diff evaluation
  because the Supabase CLI temp-role connection failed with `password
  authentication failed` and then the pooler circuit breaker after retries.

## Remaining Risks

- Supabase CLI temp-role auth fails unless `SUPABASE_DB_PASSWORD` is provided
  from the local database password. Once set, CLI migration listing and push
  work as expected.
- Local Docker is not running, so Supabase local migration execution could not
  be used for full database replay.
- Stock values for some E2E products were corrected through Supabase after
  Chrome automation could not reliably set numeric stock fields. Product API
  tests cover persistence, and this was not reproduced as a browser app defect.
- Existing merchants keep their stored Puck page configs. New starter-profile
  changes affect newly generated storefronts immediately, but older storefronts
  need a regenerate/apply step if they should adopt updated copy or section
  ordering.
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
- `supabase db push --linked --dry-run`
  - Result: exactly one pending migration,
    `20260510233731_fix_order_number_uuid_offset.sql`; no repair needed.
- `supabase db push --linked --yes`
  - Result: applied `20260510233731_fix_order_number_uuid_offset.sql`.
- `supabase db query --linked -f supabase/migrations/tests/order_number_uuid_offset.sql -o table`
  - Result: exited successfully; transaction rolled back after validating
    high-bit UUID prefixes no longer generate `0000` order-number segments.
- Supabase MCP `list_migrations` and CLI `supabase migration list --linked`
  - Result: remote history includes `20260510233731`.
- `pnpm --filter @baci/web exec vitest run src/lib/initial-template-profiles.test.ts src/lib/initial-template-generator.test.ts src/components/onboarding-puck-preview.test.tsx src/app/onboarding/actions.test.ts`
  - Result: 4 files passed, 48 tests passed.
- `pnpm --filter @baci/web exec vitest run src/schemas/ai-jobs.test.ts src/schemas/ai-storefront-layout.test.ts src/lib/ai-storefront/normalize-ai-storefront-layout.test.ts src/lib/ai-storefront/process-storefront-layout-job.test.ts src/scripts/process-ai-storefront-jobs.test.ts src/app/api/ai-jobs/route.test.ts 'src/app/api/ai-jobs/[id]/apply/route.test.ts' src/app/api/ai-jobs/worker/route.test.ts src/components/dashboard/store-build-status-card.test.tsx src/lib/store-build-status.test.ts`
  - Result: 10 files passed, 66 tests passed.
- `pnpm turbo lint`
  - Result: web Biome check passed; mobile-storefront replayed existing
    warnings only, with zero errors.
- `pnpm turbo typecheck`
  - Result: 4 tasks successful.
- `pnpm turbo test`
  - Result: 4 tasks successful; web reported 951 test files passed, 1 skipped;
    7794 tests passed, 1 todo.
- `coderabbit review --agent -t uncommitted -c AGENTS.md`
  - Result: CodeRabbit findings were reviewed and the valid documentation,
    handmade hero copy, and handmade/art feature consistency suggestions were
    applied before the final verification run.
- Chrome 2026-05-12 continuation smoke:
  - Result: food and pharmacy completed signup -> dashboard product creation ->
    storefront product list -> checkout -> order-success -> dashboard order
    visibility. The all-industry storefront fixture smoke passed for food,
    pharmacy, fashion, electronics, home goods, health/beauty, hair extensions,
    and handmade after current `origin/main` was merged into the branch.
- Supabase linked stock/order verification:
  - Result: `Jollof Rice Bowl` stock stayed `20`, `stock_quantity` became `19`,
    and ordered quantity was `1`; the pharmacy product stock stayed `50`,
    `stock_quantity` became `49`, and ordered quantity was `1`.
- `pnpm --filter @baci/web exec vitest run src/lib/api-client.test.ts src/lib/cache-revalidation.test.ts src/components/storefront/product-grid.test.tsx src/lib/products.test.ts src/lib/initial-template-profiles.test.ts src/lib/initial-template-generator.test.ts src/components/onboarding-puck-preview.test.tsx`
  - Result: 7 files passed, 91 tests passed.
- `pnpm turbo lint --filter=@baci/web`
  - Result: Biome checked 2355 files; no fixes applied.
- `pnpm turbo typecheck --filter=@baci/web`
  - Result: 1 task successful.
- `pnpm turbo test --filter=@baci/web`
  - Result after CodeRabbit fixes: 979 files passed, 1 skipped; 8100 tests
    passed, 1 todo.
- `coderabbit review --agent -t uncommitted -c AGENTS.md`
  - Result: initial run was blocked by CodeRabbit `rate_limit`; after the
    reported wait window, rerun against `origin/main` completed with 20 issues.
    The valid critical/major items were addressed: `apiGet` now forces `GET`,
    storefront product cache tags are merchant-scoped, template profile
    normalization/tests were expanded, sample-product aliases were hardened, and
    non-string logo URLs are ignored. A post-fix rerun hit `rate_limit` again
    with a wait of 7 minutes and 41 seconds before retry.
- `coderabbit review --agent -t uncommitted --base origin/main -c AGENTS.md`
  - Result: rerun completed with 12 issues. The valid critical/major items were
    addressed: the default template now includes its story section in
    `contentOrder`, storefront product cache keys/tags normalize merchant IDs
    consistently, invalid product revalidation IDs are skipped before tag
    creation, and sample product aliases were moved into a dedicated constant.
- Final CodeRabbit rerun attempt after those fixes:
  - Result: blocked by CodeRabbit account usage limits in both `--agent` and
    `--prompt-only` modes before a review could start.
- `pnpm --filter @baci/web exec vitest run src/lib/api-client.test.ts src/lib/cache-revalidation.test.ts src/lib/storefront-products-cache-key.test.ts src/lib/products.test.ts src/lib/initial-template-profiles.test.ts src/lib/initial-template-generator.test.ts src/components/storefront/product-grid.test.tsx`
  - Result after the latest CodeRabbit follow-up: 7 files passed, 123 tests
    passed.
- `pnpm turbo lint --filter=@baci/web`
  - Result after the latest CodeRabbit follow-up: Biome checked 2357 files; no
    fixes applied.
- `pnpm turbo typecheck --filter=@baci/web`
  - Result after the latest CodeRabbit follow-up: 1 task successful.
- `pnpm turbo test --filter=@baci/web`
  - Result after the latest CodeRabbit follow-up: 979 files passed, 1 skipped;
    8107 tests passed, 1 todo.
- `pnpm turbo test --filter=@baci/web`
  - Result after remote branch and latest `origin/main` reconciliation: 981
    files passed, 1 skipped; 8117 tests passed, 1 todo.
