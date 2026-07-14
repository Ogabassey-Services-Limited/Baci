# S1 all-runtime direct-access census — `merchants` table — WEB half (`apps/web/src`)

Original census source: `origin/main@c8108a052d`; revalidated after rebase at `origin/main@19d03df854`. READ-ONLY. Every non-test `.from('merchants')` occurrence plus merchants-reading/-writing RPCs. Subsumes the S0 anon-web read set.

## Client-factory → runtime-role legend

| Client factory | Runtime role | Notes |
|---|---|---|
| `@/lib/supabase/client` (browser) | **anon** signed-out / **authenticated** signed-in | RLS enforced |
| `@/lib/supabase/server` `createClient(cookies)` (SSR-cookie) | **anon** signed-out / **authenticated** signed-in; **anon** in webhook (no cookies) | RLS enforced |
| `authenticateApiRequest().supabase` (`auth.supabase`) | **authenticated** | cookie-SSR *or* bearer-token-scoped client (`_createScopedClient`); RLS enforced |
| `@/lib/supabase/admin` `createAdminClient()` | **service_role** | bypasses RLS |
| `@/lib/supabase/service` `createServiceClient()` | **service_role** | bypasses RLS |
| `@/lib/supabase/anon` `createAnonClient()` | **anon** | RLS enforced |
| `getPublicSupabaseClient()` (cached-data.ts:166) / `createStaticClient(url, anonKey)` / blog `getPublicClient()` | **anon** | anon/publishable key, RLS enforced |
| `getServiceRoleSupabaseClient()` (cached-data.ts:194) / `getSupabaseAdmin()` (conversion) | **service_role** | bypasses RLS |

Sensitive-column flag 🔴 = selects/writes any of `nin, bvn, *_access_token, ga4_api_secret, *_capi_token, stripe_customer_id, bank_account_number, cac_*, kyc_*, firs_*`. Proposed-replacement shorthand: **SNAP** = public snapshot RPC `resolve_storefront_public_snapshot_v2`; **PRIV-RPC** = permission-scoped private RPC (SECURITY DEFINER, staff/owner gated); **ROUTE** = move behind an authenticated Route Handler; **KEEP** = server-only + already gated, leave as-is.

---

## A. Confirmed "known" symbols (line numbers verified on origin/main)

| file:line | symbol | client → role | op | columns | context | authz today | replacement |
|---|---|---|---|---|---|---|---|
| `hooks/merchant/queries.ts:15` def / `:216–217` use | `PUBLIC_MERCHANT_SELECT` + `fetchMerchantBySlug` | browser → **anon** (public storefront) / auth (dashboard) | select `.eq('slug')` | id, business_name, business_type, email, phone, logo_url, brand_colors, country, payout_currency, pages, google_product_sheet_url, slug, published_config, favicon_*, social_media, support_email, support_phone, business_address, rider_phone_number, is_published, published_at, template_id, plan_tier, premium_features, hero_slides, mobile_hero_slides, `+ merchant_feature_settings(*)` | called by MerchantProvider (Client Component) on storefront | public read (broad merchants-RLS SELECT) | **SNAP** (this is THE target path). The checked snapshot intentionally retains published-store `email`, `phone`, `support_*`, and `business_address`; classify those as public merchant contact data, not fields this migration drops. The security win is the fixed published-only projection and removal of raw plan/secrets/arbitrary-table reach. Changing that public-contact contract requires a separate snapshot/adapter decision. |
| `hooks/merchant/queries.ts:49` def / `:238–239` use | `DASHBOARD_MERCHANT_SELECT` + `fetchDashboardMerchant` (owner leg) | browser → **authenticated** (owner) | select `.eq('user_id')` | 🔴 all of PUBLIC_* **plus** user_id, paystack_subaccount_code, bank_account_number, bank_account_name, bank_code, bank_name, legal_entity_name, registered_address, tax_identification_number, trust_profile, plan_started_at, plan_expires_at, **stripe_customer_id**, stripe_subscription_id, offline_conversions_enabled, facebook_pixel_id, **facebook_capi_token**, google_analytics_id, **ga4_api_secret**, tiktok_pixel_id, **tiktok_access_token**, snapchat_pixel_id, **snapchat_capi_token**, twitter_pixel_id, virtual_terminal_code, vat_registration_status, vat_rate, **nin**, **bvn**, **cac_rc_number**, **kyc_status**, `+ merchant_feature_settings(*)` | MerchantProvider dashboard load (Client Component) | owner only (via RLS) | **PRIV-RPC** — a signed-in merchant's **browser** selecting nin/bvn/bank/stripe/secrets straight off the table is the S1 crux |
| `hooks/merchant/queries.ts:114` def / `:244` use | `STAFF_MEMBER_SELECT` (`merchants(...)` embedded join) | browser → **authenticated** (staff) | select on `staff_members` embedding merchants | 🔴 same full sensitive set as DASHBOARD_* via the `merchants(...)` join | MerchantProvider staff path | staff via RLS | **PRIV-RPC** — same crux, reached through the join |
| `hooks/merchant/merchant-provider.tsx:332` & `:336` | `MerchantProvider.updateMerchant` | browser → **authenticated** | **update** `.eq('user_id')` (owner) / `.eq('id')` (staff) | `pickGenericWritable(data)` allowlist (identity/contact/legal fields already deny-listed via `assertNoIdentityFields`) | Client Component write | owner, or staff w/ `settings.edit` | **ROUTE** (mirror the existing `/api/merchant/settings` PATCH used for identity fields) |
| `hooks/merchant/queries.ts:329` | `fetchPrimaryDomain` | browser → anon/auth | select on **`domains`** (not merchants) | domain | MerchantProvider | — | out of scope (domains table) — listed because task named it |
| `lib/cached-data.ts:1188` def / `:1195` client / `:1198` query | `getCachedMerchantById` | `getPublicSupabaseClient()` → **anon** | select `.eq('id').single()` | id, business_name, site_title, site_tagline, site_description, business_type, logo_url, phone, email, social_media, brand_colors, slug, business_address, payout_currency, paystack_subaccount_code, is_published, template_id, plan_expires_at, plan_tier, premium_features, country, hero_slides, favicon_svg_url, favicon_png_32_url, favicon_apple_touch_url, vat_registration_status, vat_rate | `'use cache: remote'` cached fn | public | **SNAP** / deprecate. ⚠️ **Task note "zero prod callers" is STALE** — origin/main has 2 non-test importers: `lib/repair-notifications.ts:176` and `lib/repairs/notify-repair-status-change.ts:94` |

---

## B. Public / anon runtime reads (the S0 anon-web set + other anon paths)

| file:line | symbol | client → role | op | columns | context | authz | replacement |
|---|---|---|---|---|---|---|---|
| `lib/cached-data.ts:842–843` | `resolveStorefrontMerchantOnce` → RPC | `getServiceRoleSupabaseClient()` → **service_role** | **rpc** `resolve_storefront_cached_merchant(p_identifier)` | (RPC-shaped merchant snapshot; resolves unpublished too) | cached storefront resolver | public callers, service under the hood | **KEEP/adopt as SNAP** — this is the existing analog of `resolve_storefront_public_snapshot_v2` |
| `app/(storefront)/[slug]/(commerce)/cart/page.tsx:40` | `CartContent` | SSR-cookie → **anon/auth** (customer) | select `.eq('id').single()` | vat_registration_status, vat_rate | Server Component | public | **SNAP** (public presentation) or KEEP |
| `app/(storefront)/…/[category]/[productSlug]/opengraph-image.tsx:31` | `Image` (OG) | `createAdminClient()` → **service_role** | select `.eq('slug').single()` | id, business_name, logo_url, brand_colors, country | generateMetadata/OG (edge) | public image | **SNAP** — drop service_role for public data |
| `app/(storefront)/…/products/[productSlug]/opengraph-image.tsx:31` | `Image` (OG) | `createAdminClient()` → **service_role** | select `.eq('slug').single()` | id, business_name, logo_url, brand_colors, country | OG image | public image | **SNAP** |
| `app/sitemap.ts:11` | `sitemap` | SSR-cookie → **anon/auth** | select `.not('slug', is, null).order()` | slug, updated_at | sitemap | public | **SNAP** / KEEP |
| `lib/slug-alias-cache.ts:181` client / `:184` | slug liveness check | `createAnonClient()` → **anon** | select `.eq('slug').limit(1)` | id | public slug-alias TTL cache | public | KEEP (id-only) or **SNAP** |
| `lib/domain-cache-simple.ts:177/210` client / `:213` | domain lookup | `createAdminClient()` → **service_role** | select `.eq('slug')` | id, `domains!left(...)` | **proxy.ts** middleware (pre-auth) | public routing | KEEP (id + domain only; service intentional pre-auth) |
| `app/api/merchants/by-slug/route.ts:10` client / `:16` | `unstable_cache` merchant-by-slug | `createStaticClient(url, anonKey)` → **anon** | select `.eq('slug').single()` | id, business_name, slug, logo_url, brand_colors, country, is_published | Route Handler (cached) | public | **SNAP** |
| `app/api/storefront/[slug]/products/route.ts:158` | `getMerchantIdBySlug` (`unstable_cache`) | `createStaticClient(url, anonKey)` → **anon** | select `.eq('slug').maybeSingle()` (alias-fallback) | id | Route Handler (cached) | public | **SNAP** (id resolve) |
| `app/api/blog/feed/[merchantSlug]/route.ts:131` | feed merchant lookup (`getPublicClient`) | anon public client → **anon** | select `.eq(column,value).maybeSingle()` | id, slug, business_name, site_description, logo_url, `domains!left(...)` | sitemap/feed | public | **SNAP** |
| `app/api/storefront/features/route.ts:154` | features lookup | SSR-cookie → **anon/auth** | select `.eq('slug'|'id').single()` | id, country, paystack_subaccount_code, business_type | storefront feature gate | public | **SNAP** |
| `app/api/storefront/negotiate/route.ts:65` | negotiate currency | SSR-cookie → **anon/auth** | select `.eq('id').maybeSingle()` | payout_currency, country | storefront | public | **SNAP** |
| `app/api/storefront/negotiation-evidence/route.ts:147` | merchant existence check | SSR-cookie → **anon/auth** | select `.eq('id').maybeSingle()` | id | storefront | public | **SNAP** |
| `app/api/storefront/customer/wallet/route.ts:167` | slug→id | SSR-cookie → **authenticated** (customer) | select `.eq('slug').single()` | id | storefront customer | customer | **SNAP** (id) |
| `app/api/storefront/orders/route.ts:82` | slug→id | `auth.supabase` → **authenticated** (customer) | select `.eq('slug').single()` | id | storefront customer orders | customer | **SNAP** (id) |
| `app/api/storefront/orders/[id]/route.ts:150` | slug→id | SSR-cookie → **authenticated** (customer) | select `.eq('slug').single()` | id | storefront customer | customer | **SNAP** (id) |
| `app/api/vtu/checkout/confirm/route.ts:74` | slug→id (alias-fallback) | `createAdminClient()` → **service_role** | select `.eq('slug').maybeSingle()` | id | VTU checkout | public checkout | **SNAP** (id) |
| `app/api/vtu/checkout/saved-cards/route.ts:32` | slug→id | `createAdminClient()` → **service_role** | select `.eq('slug').single()` | id | VTU checkout | public checkout | **SNAP** (id) |
| `app/api/vtu/checkout/wallet-only/route.ts:71` | slug→id (alias-fallback) | `createAdminClient()` → **service_role** | select `.eq('slug').maybeSingle()` | id | VTU checkout | public checkout | **SNAP** (id) |
| `app/api/vtu/history/route.ts:97` | slug→id | `createAdminClient()` → **service_role** | select `.eq('slug').single()` | id | VTU history | customer | **SNAP** (id) |
| `app/api/vtu/loyalty/rewards/route.ts:29` | slug→id ("public lookup, no auth") | SSR-cookie → **anon/auth** | select `.eq('slug').single()` | id | storefront loyalty | public | **SNAP** (id) |
| `app/api/shipping/quotes/quote-merchant-context.ts:122` | slug→id | SSR-cookie → **anon/auth** (storefront quote) | select `.eq('slug').maybeSingle()` | id | shipping quote | public | **SNAP** (id) |
| `app/api/shipping/quotes/quote-merchant-context.ts:188` | sender info | SSR-cookie → **anon/auth** | select `.eq('id').maybeSingle()` | business_name, business_address, phone, country, payout_currency | shipping quote | public | **SNAP**/PRIV-RPC (exposes phone/address) |
| `app/api/analytics/conversion/route.ts:96 const`/`:107` & `:120` | `MERCHANT_SELECT='id'` lookup | `getSupabaseAdmin()` → **service_role** | select `.eq('id'|'slug').single()` | id | server conversion logger | server | KEEP (id) |
| `app/api/analytics/crawler-log/route.ts:107` | slug→id | `createAdminClient()` → **service_role** | select `.eq('slug').maybeSingle()` | id | crawler log | server | KEEP (id) |
| `lib/resolve-merchant-by-slug.ts:25` | `resolveMerchantIdBySlugOrAlias` | injected → **authenticated** (mobile-onboarding scoped) / anon-auth (storefront/customer) | select `.eq('slug').maybeSingle()` | id | helper | mixed | **SNAP** (id) |
| `lib/agentic/merchant-context.ts:66` | agentic context | `createAdminClient()` → **service_role** | select `.eq('slug').maybeSingle()` | id, slug, business_name, paystack_subaccount_code | agentic Route Handler (single-tenant) | pinned merchant | KEEP / **SNAP** |
| `lib/vtu-pending-transaction.ts:518` | VTU pending txn merchant | `createAdminClient()` → **service_role** | select `.eq('slug').maybeSingle()` (alias-fallback) | id, slug, business_name, paystack_subaccount_code | VTU background | server | KEEP |
| `app/actions.ts:34` | landing stats count | SSR-cookie (unconfirmed) → anon/auth | select `id` `head:true count:'exact'` | count only | Server Action (platform stats) | public | KEEP |
| `app/api/forms/submit/route.ts:35` | form merchant validate | SSR-cookie → **anon/auth** (public form) | select `.eq('id').single()` | id, business_name, email, support_email | public form submit | public | **SNAP**/PRIV-RPC (exposes email) |
| `app/api/newsletter/subscribe/route.ts:130` | merchant name | SSR-cookie → **anon/auth** | select `.eq('id').single()` | business_name | public subscribe | public | **SNAP** |

---

## C. Authenticated (owner / staff / merchant) reads & writes

| file:line | symbol | client → role | op | columns | context | authz | replacement |
|---|---|---|---|---|---|---|---|
| `app/(platform)/onboarding/onboarding-page-content-server.tsx:16` | onboarding gate | SSR-cookie → **authenticated** | select `.eq('user_id').maybeSingle()` | id, business_name | Server Component | user | KEEP |
| `app/(platform)/template-preview/[templateId]/preview-client.tsx:273` | activate: read merchant | browser → **authenticated** | select `.eq('user_id').maybeSingle()` | id, template_id | Client Component | user | ROUTE |
| `…/preview-client.tsx:304` | activate: write template | browser → **authenticated** | **update** `.eq('id')` | template_id | Client Component | user | ROUTE |
| `app/dashboard/settings/faq/client.tsx:75` | save FAQs | browser → **authenticated** | **update** `.eq('id')` | faq_items | Client Component | owner | ROUTE |
| `app/dashboard/settings/tax/page.tsx:33` | tax settings load | SSR-cookie → **authenticated** | select `MERCHANT_TAX_SETTINGS_COLUMNS` | vat_registration_status, vat_rate, tax_identification_number, legal_entity_name, registered_address, state_code | Server Component | owner | PRIV-RPC/KEEP |
| `app/dashboard/settings/actions.ts:53` | favicon write | SSR-cookie → **authenticated** | **update** `.eq('id')` | favicon_svg_url, favicon_png_32_url, favicon_png_192_url, favicon_apple_touch_url, favicon_uploaded_at | Server Action | owner/staff checked in app code | **PRIV-RPC/ROUTE** — migrate before the authenticated table ACL reset. A cookie-bound Supabase client still writes as `authenticated`; the existing app-level permission check does not preserve database permission after `REVOKE ALL`. Route the write through a permission-scoped mutation boundary. |
| `app/dashboard/staff/actions.ts:229` | VT legacy sync | SSR-cookie/admin (dual-client file) → auth/service | **update** `.eq('id').is('virtual_terminal_code', null)` | virtual_terminal_code | Server Action | owner | KEEP (confirm which var) |
| `app/dashboard/wallet/actions.ts:30` | ownership verify | SSR-cookie → **authenticated** | select `.eq('id').eq('user_id').single()` | id | Server Action | owner | KEEP |
| `app/dashboard/wallet/page.tsx:32` | wallet load | SSR-cookie → **authenticated** | select `.eq('user_id').single()` | id, payout_currency | Server Component | owner | KEEP |
| `app/dashboard/orders/actions.ts:700` | 🔴 resend-notif merchant | SSR-cookie → **authenticated** | select `.eq('id').single()` | id, business_name, slug, support_email, email_sender_name, email, tax_identification_number, **cac_rc_number** | Server Action | owner | PRIV-RPC/KEEP |
| `app/api/merchant/favicon/route.ts:90` | favicon write | `auth.supabase` → **authenticated** | **update** `.eq('id')` | favicon_svg_url, favicon_png_32_url, favicon_png_192_url, favicon_apple_touch_url, favicon_uploaded_at | Route Handler | owner/staff | **PRIV-RPC** — the route authenticates, but its user-scoped client still depends on direct authenticated table `UPDATE`; switch its final write to the same permission-scoped mutation before the ACL reset. |
| `app/api/merchant/blog/posts/route.ts:194` | blog author | `auth.supabase` → **authenticated** | select `.eq('id').single()` | business_name, slug | Route Handler | owner/staff | KEEP |
| `app/api/merchant/publish/route.ts:102` | 🔴 pre-publish validation | `createAdminClient()` → **service_role** | select `.eq('id').single()` | id, business_name, country, email, phone, support_email, support_phone, paystack_subaccount_code, bank_code, **bank_account_number** | Route Handler | owner (gated) | KEEP |
| `app/api/merchant/publish/route.ts:225` | publish | `createAdminClient()` → **service_role** | **update** `.eq('id')` | is_published, published_at | Route Handler | owner | KEEP |
| `app/api/merchant/publish/route.ts:294` | unpublish read | `createAdminClient()` → **service_role** | select `.eq('id').single()` | id | Route Handler | owner | KEEP |
| `app/api/merchant/publish/route.ts:308` | unpublish | `createAdminClient()` → **service_role** | **update** `.eq('id')` | is_published | Route Handler | owner | KEEP |
| `app/api/merchant/readiness/route.ts:120` | readiness (owner leg) | admin+server (dual-client file) → auth/service | select `.eq('user_id').maybeSingle()` + `staff_members(merchants(...))` | 🔴 id, business_name, email, phone, country, logo_url, support_email, support_phone, business_address, paystack_subaccount_code, bank_code, **bank_account_number**, social_media, pages, hero_slides, google_analytics_id, facebook_pixel_id, tiktok_pixel_id, snapchat_pixel_id, twitter_pixel_id, is_published | Route Handler | owner/staff | PRIV-RPC (confirm client var) |
| `app/api/merchant/regenerate-hero-images/route.ts:41` | hero regen read | SSR-cookie → **authenticated** | select `.eq('owner_id').single()` | id, business_type, hero_images_regeneration_count | Route Handler | owner | KEEP |
| `app/api/merchant/regenerate-hero-images/route.ts:121` | hero regen read | SSR-cookie → **authenticated** | select `.eq('owner_id').single()` | id, hero_image_ids, hero_images_regeneration_count, hero_images_generated_at | Route Handler | owner | KEEP |
| `app/api/merchant/rename-slug/route.ts:128` | current slug read | `auth.supabase` → **authenticated** | select `.eq('id').maybeSingle()` | slug | Route Handler | owner/staff | KEEP |
| `app/api/merchant/rename-slug/route.ts:135` | rename slug **write** | `auth.supabase` → **authenticated** | **rpc** `rename_merchant_slug(p_merchant_id,p_new_slug)` | writes slug | Route Handler | owner/staff | KEEP (RPC already) |
| `app/api/merchant/verify-bvn/route.ts:78` | verify-bvn read | `auth.supabase` → **authenticated** | select `.eq('id').maybeSingle()` | country, phone | Route Handler | owner | KEEP |
| `app/api/merchant/verify-cac/route.ts:101` | verify-cac read | `auth.supabase` → **authenticated** | select `.eq('id').maybeSingle()` | country | Route Handler | owner | KEEP |
| `app/api/merchant/verify-nin/route.ts:60` | verify-nin read | `auth.supabase` → **authenticated** | select `.eq('id').maybeSingle()` | country | Route Handler | owner | KEEP |
| `app/api/merchant/verify-tax-id/route.ts:107` | 🔴 tax identity read | `auth.supabase` → **authenticated** | select `MERCHANT_TAX_IDENTITY_COLUMNS` | id, business_name, legal_entity_name, **cac_rc_number** | Route Handler | owner | PRIV-RPC/KEEP |
| `app/api/merchant/verify-tax-id/route.ts:181` | tax id write | `auth.supabase` → **authenticated** | **update** `.eq('id').select(MERCHANT_SETTINGS_COLUMNS)` | writes tax_identification_number, updated_at; returns id, social_media, vat_registration_status, tax_identification_number, legal_entity_name, registered_address, state_code, updated_at | Route Handler | owner | KEEP |
| `app/api/merchant/quiz/generate/quiz-generate-helpers.ts:114` | quiz ctx | injected `auth.supabase` → **authenticated** | select `.eq('id').maybeSingle()` | business_name, slug | helper (Route Handler) | owner/staff | KEEP |
| `app/api/merchant/quiz/prize-products/route.ts:48` | prize slug | `auth.supabase` → **authenticated** | select `.eq('id').maybeSingle()` | slug | Route Handler | owner/staff | KEEP |
| `app/api/quiz/events/route.ts:151` | quiz events merchant | `auth.supabase` → **authenticated** | select `.eq('id'|'slug').maybeSingle()` | id | Route Handler | owner/staff | KEEP |
| `app/api/marketplace/jumia/products/update/route.ts:183` | merchant id | SSR-cookie → **authenticated** | select `.eq('user_id').single()` | id | Route Handler | owner | KEEP |
| `app/api/payouts/request/route.ts:76` | payout email | SSR-cookie → **authenticated** | select `.eq('id').single()` | email | Route Handler | owner | KEEP |
| `app/api/paystack/subaccount/route.ts:147` | subaccount read | `auth.supabase` → **authenticated** | select `.eq('id').single()` | paystack_subaccount_code, business_name, country, email, phone | Route Handler | owner | KEEP |
| `app/api/paystack/subaccount/route.ts:208` | 🔴 manual bank write | `auth.supabase` → **authenticated** | **update** `.eq('id')` | paystack_subaccount_code, **bank_account_number**, bank_account_name, bank_code, bank_name | Route Handler | owner | KEEP |
| `app/api/paystack/subaccount/route.ts:328` | 🔴 bank write | `auth.supabase` → **authenticated** | **update** `.eq('id')` | paystack_subaccount_code, **bank_account_number**, bank_account_name, bank_code, bank_name | Route Handler | owner | KEEP |
| `app/api/paystack/virtual-terminal/[code]/destination/route.ts:92` & `:190` | VT ownership | SSR-cookie → **authenticated** | select `.eq('id').maybeSingle()` | virtual_terminal_code | Route Handler | owner | KEEP |
| `app/api/paystack/virtual-terminal/[code]/route.ts:62,149,246` | VT ownership | SSR-cookie → **authenticated** | select `.eq('id').maybeSingle()` | virtual_terminal_code | Route Handler | owner | KEEP |
| `app/api/paystack/virtual-terminal/[code]/route.ts:277` | VT deactivate | SSR-cookie → **authenticated** | **update** `.eq('id')` | virtual_terminal_code=null | Route Handler | owner | KEEP |
| `app/api/paystack/virtual-terminal/route.ts:153` | VT legacy read | SSR-cookie → **authenticated** | select `.eq('id').single()` | virtual_terminal_code | Route Handler | owner | KEEP |
| `app/api/paystack/virtual-terminal/route.ts:160` | VT legacy write | SSR-cookie → **authenticated** | **update** `.eq('id')` | virtual_terminal_code | Route Handler | owner | KEEP |
| `app/api/products/[id]/archive/route.ts:110` | slug for purge | `auth.supabase` → **authenticated** | select `.eq('id').single()` | slug | Route Handler | owner/staff | KEEP |
| `app/api/products/[id]/route.ts:640` | product schema ctx | SSR-cookie → **authenticated** | select `.eq('id').single()` | business_name, country | Route Handler | owner | KEEP |
| `app/api/products/bulk-update/route.ts:94` | product ctx | SSR-cookie → **authenticated** | select `.eq('id').maybeSingle()` | business_name, country, payout_currency | Route Handler | owner | KEEP |
| `app/api/products/route.ts:442` | product country | SSR-cookie → **authenticated** | select `.eq('id').single()` | country | Route Handler | owner | KEEP |
| `app/api/shipping/book/route.ts:126` | sender info | SSR-cookie → **authenticated** | select `.eq('id').single()` | business_name, business_address, phone | Route Handler | owner | KEEP |
| `app/api/cache/revalidate/route.ts:200` | slug for purge | `auth.supabase` → **authenticated** | select `.eq('id').maybeSingle()` | slug | Route Handler | owner/staff | KEEP |
| `app/api/builder/builder-route-utils.ts:147` | template data | injected `auth.supabase` → **authenticated** | select `.eq('id').single()` | id, business_name, business_type, brand_colors, logo_url, hero_image_ids | Route Handler | owner/staff | KEEP |
| `lib/get-merchant-for-api-request.ts:49` | core resolver | injected `auth.supabase` → **authenticated** | select `.eq('user_id')` (+ or/limit) | id, slug, business_name | shared helper | user | KEEP |
| `lib/merchant-feature-gates.ts:73` | feature gate | injected `auth.supabase` → **authenticated** | select `.eq('id').single()` | id, plan_tier, plan_expires_at, premium_features | shared helper | owner/staff | KEEP |
| `lib/merchant-email-domain-access.ts:50` | email-domain gate | injected `auth.supabase` → **authenticated** | select `.eq('id').single()` | plan_tier, slug, plan_expires_at, premium_features | shared helper | owner | KEEP |
| `lib/analytics/analytics-platform-config.ts:122` | entitlement | SSR-cookie → **authenticated** | select `.eq('id').maybeSingle()` | plan_tier, plan_expires_at, premium_features | analytics Route Handlers | owner | KEEP |
| `lib/analytics/analytics-platform-config.ts:136` | 🔴 platform creds | SSR-cookie → **authenticated** | select `.eq('id').maybeSingle()` | offline_conversions_enabled, facebook_pixel_id, **facebook_capi_token**, tiktok_pixel_id, **tiktok_access_token**, google_analytics_id, **ga4_api_secret**, snapchat_pixel_id, **snapchat_capi_token** | analytics Route Handlers | owner | PRIV-RPC/KEEP (server-only credential read) |
| `lib/get-merchant-blog-cache-identifiers.ts:37` | blog cache id | injected → **authenticated** | select `.eq('id').maybeSingle()` | slug | shared helper | owner/staff | KEEP |
| `lib/shipping/book-order-shipment.ts:320` | sender info | injected `auth.supabase` → **authenticated** | select `.eq('id').single()` | business_name, business_address, phone | order Route Handler | owner/staff | KEEP |
| `lib/admin-merchant-users.ts:45` | admin directory | SSR-cookie → **authenticated** (platform admin) | select `MERCHANT_COLUMNS` `.eq('id').maybeSingle()` | id, user_id, business_name, email, phone, slug, signup_source, plan_tier, is_published, created_at, updated_at | Route Handler | is_platform_admin gated | KEEP |
| `services/hero-image-generator.ts:284` | hero write | SSR-cookie → **authenticated** | **update** `.eq('id')` | hero_image_ids, hero_images_generated_at | service | owner | KEEP |
| `services/hero-image-generator.ts:304` | hero write | SSR-cookie → **authenticated** | **update** `.eq('id')` | hero_image_ids, hero_images_generated_at | service | owner | KEEP |
| `services/hero-image-generator.ts:347` | hero read | SSR-cookie → **authenticated** | select `.eq('id').single()` | business_type, hero_image_ids, hero_images_regeneration_count | service | owner | KEEP |
| `services/hero-image-generator.ts:386` | hero count write | SSR-cookie → **authenticated** | **update** `.eq('id')` | hero_images_regeneration_count | service | owner | KEEP |
| `app/api/mobile-onboarding/route.ts:331` | existing merchant | `scopedSupabase` (bearer) → **authenticated** | select `.eq('user_id').maybeSingle()` | id, business_name, slug | Route Handler | user | KEEP |
| `app/api/mobile-onboarding/route.ts:378` | update merchant | `scopedSupabase` → **authenticated** | **update** `.eq('id').select('id, slug')` | merchantUpdate payload | Route Handler | user | KEEP |
| `app/api/mobile-onboarding/route.ts:413` | insert merchant | `scopedSupabase` → **authenticated** | **insert** | user_id, email, business_name, business_type, country, payout_currency, logo_url, favicon_png_192_url, brand_colors, slug | Route Handler | user | KEEP |

---

## D. Platform-admin authorization checks (`is_platform_admin`)

All are `select('is_platform_admin').eq('id'|'user_id')` gating platform-admin ops — SSR-cookie → **authenticated**, KEEP:

`app/api/admin/analytics/route.ts:110` & `:574`; `app/api/admin/db-health/route.ts:43`; `app/api/admin/generate-product-images/route.ts:71`; `app/api/admin/merchants/[merchantId]/users/route.ts:50`; `app/api/admin/merchants/route.ts:38`; `app/api/admin/migrate/route.ts:57`; `app/api/admin/notifications/[id]/route.ts:66,218,413`; `app/api/admin/notifications/route.ts:59,268`; `app/api/admin/settings/route.ts:125`; `lib/platform-admin-auth.ts:23` (`.eq('user_id')`).

Other admin merchants access:
| file:line | op | columns | client → role | replacement |
|---|---|---|---|---|
| `app/api/admin/analytics/route.ts:157` | 🔴 select | id, **bank_account_number**, bank_account_name, bank_code, business_name, business_type, is_published, **kyc_status**, paystack_subaccount_code, … | admin+server dual file → **service_role** (financial select) | KEEP |
| `app/api/admin/migrate/route.ts:71` | select `.limit(1)` | social_media (column-exists probe) | SSR-cookie → **authenticated** | KEEP |
| `app/api/admin/notifications/route.ts:379` | select `.not('user_id', is, null)` | id | SSR-cookie → **authenticated** | KEEP |
| `app/api/admin/notifications/route.ts:470` | select (segment builder) | id | SSR-cookie → **authenticated** | KEEP |

---

## E. Service-role server-only (webhooks / crons / background / payments) + platform onboarding

| file:line | symbol | client → role | op | columns | context | replacement |
|---|---|---|---|---|---|---|
| `app/(platform)/onboarding/actions.ts:186` | dup-email precheck | `createAdminClient()` → **service_role** | select `.eq('email').maybeSingle()` | id, business_name | Server Action | KEEP |
| `app/(platform)/onboarding/actions.ts:297` | existing merchant | `createAdminClient()` → **service_role** | select `.eq('user_id').maybeSingle()` | id, business_name, slug | Server Action | KEEP |
| `app/(platform)/onboarding/actions.ts:321` | update merchant | `createAdminClient()` → **service_role** | **update** | email, business_name, business_type, country, payout_currency, logo_url, favicon_png_192_url, brand_colors | Server Action | KEEP |
| `app/(platform)/onboarding/actions.ts:351` | create merchant | `createAdminClient()` → **service_role** | **insert** | user_id, email, business_name, business_type, country, payout_currency, logo_url, favicon_png_192_url, brand_colors | Server Action | KEEP |
| `app/api/cron/agentic-commerce-health/route.ts:149` | health monitor | `createAdminClient()` → **service_role** | select `.in('slug')` | id, slug, business_name, is_published | cron | KEEP |
| `app/api/cron/merchant-sales-summaries/route.ts:94` | sales summary | admin/service → **service_role** | select `.in('id')` | id, email, business_name, country, email_sender_name, payout_currency | cron | KEEP |
| `app/api/domains/initialize-payment/route.ts:116` | domain payment | `createAdminClient()` → **service_role** | select `.eq('id').single()` | id, business_name, email, slug, plan_tier, plan_expires_at, premium_features | Route Handler | KEEP |
| `app/api/domains/purchase/route.ts:142` | domain contact | admin+server dual → **service_role** | select `.eq('id').single()` | id, plan_tier, plan_expires_at, premium_features, first_name, last_name, business_name, email, phone, phone_number, support_phone, address, business_address, city, state, postal_code, zipcode, country | Route Handler | KEEP (heavy PII — confirm gating) |
| `app/api/payments/initialize/route.ts:1156` | init merchant | `createAdminClient()` → **service_role** | select `.eq('id').single()` | id, business_name, slug, paystack_subaccount_code | payments Route Handler | KEEP |
| `app/api/payments/webhook/route.ts:1042` | 🔴 chat-order email ctx | `createServiceClient()` → **service_role** | select `.eq('id').single()` | business_name, slug, support_email, email_sender_name, email, tax_identification_number, **cac_rc_number** | webhook | KEEP |
| `app/api/payments/webhook/route.ts:1802` | domain reg ctx | `createServiceClient()` → **service_role** | select `.eq('id').single()` | business_name, email, address, city, state, phone, `users:user_id(first_name,last_name)` | webhook | KEEP |
| `app/api/payments/webhook/route.ts:2994` | user-scoped merchant | `createClient(cookieStore)` → **authenticated** | select `.eq('user_id').single()` | id | authenticated handler in same file | KEEP |
| `app/api/payments/verify/route.ts:435` | 🔴 email ctx | `createServiceClient()` → **service_role** | select `.eq('id').single()` | business_name, slug, support_email, email_sender_name, email, tax_identification_number, **cac_rc_number** | Route Handler | KEEP |
| `app/api/payments/juicyway/webhook/route.ts:469` | 🔴 email ctx | `createClient(cookieStore)` in **webhook → anon** | select `.eq('id').single()` | business_name, slug, support_email, email_sender_name, email, tax_identification_number, **cac_rc_number** | webhook | ⚠️ **PRIV-RPC / switch to service** — see callout |
| `app/api/orders/route.ts:1446` | 🔴 order-create merchant | SSR-cookie/admin dual → **authenticated** | select `.eq('id').single()` | id, phone, rider_phone_number, business_name, business_address, slug, support_email, email_sender_name, email, tax_identification_number, **cac_rc_number**, plan_tier, vat_registration_status, vat_rate, registered_address, support_phone, logo_url, legal_entity_name, brand_colors, bank_code, **bank_account_number**, bank_name, bank_account_name, social_media, pages, payout_currency, country | Route Handler | PRIV-RPC/KEEP |
| `app/api/orders/[id]/cancelled/route.ts:80` | 🔴 email ctx | `auth.supabase` → **authenticated** (merchant) | select `.eq('id').single()` | id, business_name, slug, support_email, email_sender_name, email, tax_identification_number, **cac_rc_number** | Route Handler | KEEP |
| `app/api/orders/[id]/delivered/route.ts:78` | 🔴 email ctx | `auth.supabase` → **authenticated** | select `.eq('id').single()` | (same 8 incl. **cac_rc_number**) | Route Handler | KEEP |
| `app/api/orders/[id]/generate-dva/route.ts:109` | phone | `auth.supabase` → **authenticated** | select `.eq('id').maybeSingle()` | phone | Route Handler | KEEP |
| `app/api/orders/[id]/record-payment/route.ts:162` | 🔴 email ctx | `auth.supabase` → **authenticated** | select `.eq('id').single()` | (same 8 incl. **cac_rc_number**) | Route Handler | KEEP |
| `app/api/orders/[id]/reminder/route.ts:76` | 🔴 email ctx | `auth.supabase` → **authenticated** | select `.eq('id').single()` | business_name, slug, support_email, email_sender_name, tax_identification_number, **cac_rc_number** | Route Handler | KEEP |
| `app/api/orders/[id]/ship-on-credit/route.ts:79` | merchant | `auth.supabase` → **authenticated** | select `.eq('id').single()` | id, business_name | Route Handler | KEEP |
| `app/api/orders/[id]/shipped/route.ts:146` | 🔴 email ctx | `auth.supabase` → **authenticated** | select `.eq('id').single()` | (same 8 incl. **cac_rc_number**) | Route Handler | KEEP |
| `lib/order-cancellation-email.ts:64` | 🔴 email ctx | injected `auth.supabase` → **authenticated** (customer via cancel route) | select `.eq('id').single()` | id, business_name, slug, support_email, email_sender_name, email, tax_identification_number, **cac_rc_number** | shared helper | PRIV-RPC — customer-auth reads merchant identity |
| `lib/order-update-email.ts:60` | 🔴 email ctx | injected → **authenticated** | select `.eq('id').single()` | (same 8 incl. **cac_rc_number**) | shared helper | KEEP |
| `lib/payments/run-paid-order-side-effects.ts:72` | 🔴 email ctx | injected `createServiceClient` → **service_role** | select `.eq('id').single()` | business_name, slug, support_email, email_sender_name, email, tax_identification_number, **cac_rc_number**, website_url | webhook side-effect | KEEP |
| `lib/trigger-purchase-conversion.ts:152` | conversion currency | injected `auth.supabase` → **authenticated** | select `.eq('id').maybeSingle()` | country, payout_currency | record-payment | KEEP |
| `lib/merchant-zoho-campaign-settings.ts:155` | email brand | injected → service/auth | select `.eq('id').maybeSingle()` | business_name, brand_colors | background | KEEP |
| `lib/import-jobs/run-claimed-import-job.ts:338` | import notif ctx | injected → **service_role** (background job) | select `.eq('id').single()` | id, slug, business_name, support_email, email_sender_name, email, brand_colors, logo_url, email_logo_url | background | KEEP |
| `lib/import-commit/commit-bumpa-products.ts:244` | slug for purge | injected → **service_role** | select `.eq('id').maybeSingle()` | slug | background | KEEP |
| `lib/vtu-fulfillment.ts:1344` | VTU notif ctx | injected `createAdminClient` → **service_role** | select `.eq('id').single()` | business_name, slug, support_email | webhook/VTU | KEEP |
| `lib/vtu-fulfillment.ts:2549` | VTU merchant name | injected → **service_role** | select `.eq('id').single()` | business_name | VTU | KEEP |
| `lib/resolve-wallet-top-up-merchant.ts:69` | wallet by id | injected `createAdminClient` → **service_role** | select `.eq('id').maybeSingle()` | caller-supplied `columns` (+slug) | wallet Route Handlers | KEEP |
| `lib/resolve-wallet-top-up-merchant.ts:100` | wallet by slug | injected → **service_role** | select `.eq('slug').maybeSingle()` | caller-supplied `columns` | wallet Route Handlers | KEEP |
| `lib/agentic/checkout-order-tax.ts:139` | VAT status | injected → service/auth | select `.eq('id').maybeSingle()` | vat_registration_status | agentic/order | KEEP |
| `lib/storefront-account-document-data.ts:16 def` / `:89` | 🔴 receipt/invoice merchant | injected `auth.supabase` → **authenticated** (CUSTOMER) | select `MERCHANT_COLUMNS` `.eq('slug').maybeSingle()` | id, slug, business_name, logo_url, email, phone, support_email, support_phone, rider_phone_number, business_address, **cac_rc_number**, tax_identification_number, legal_entity_name, brand_colors, vat_registration_status, vat_rate, bank_code, **bank_account_number**, bank_name, bank_account_name, social_media, pages, registered_address | storefront customer Route Handlers (invoice/receipt) | ⚠️ **PRIV-RPC** — see callout |

---

## F. CLI / one-off scripts (`src/scripts/**`, not a prod request path)

All `createAdminClient()`/service-client → **service_role**, run manually:

| file:line | op | columns |
|---|---|---|
| `scripts/audit-merchant-branches.ts:104` & `:140` | select `.eq('id'|'slug')` | id |
| `scripts/backfill-branch-ids.ts:177` & `:213` | select `.eq('id'|'slug')` | id |
| `scripts/reconcile-paystack-dva.ts:195` | 🔴 select `.eq('id')` | business_name, slug, support_email, email_sender_name, email, tax_identification_number, **cac_rc_number** |
| `scripts/report-blog-discover-image-readiness.ts:254,273,480` | select `.eq('id'|'slug'|.in('id'))` | id, slug |

---

## Unclassified / risky callout list

1. **🔴 P0 — `payments/juicyway/webhook/route.ts:469` reads `cac_rc_number` + merchant email as ANON.** The file's only merchant-read client is `createClient(cookieStore)` (line 159); there is **no** `createServiceClient` in this webhook. A payment-provider webhook carries no auth cookies, so this runs as **anon** and only succeeds because the `merchants` table currently has permissive anon SELECT RLS (the P0 "merchants anon column exposure"). It leaks `cac_rc_number`, `email`, `support_email` on the anon path. Fix: switch this read to `createServiceClient()` (like `payments/webhook` and `payments/verify` do) and/or PRIV-RPC.

2. **🔴 `lib/storefront-account-document-data.ts:89` gives a CUSTOMER-authenticated client `bank_account_number`, `cac_rc_number`, `tax_identification_number`, `legal_entity_name`.** Invoked from storefront `/api/storefront/account/orders/[id]/{invoice,receipt,route}` via `auth.supabase` (the signed-in **customer**). A customer session reading the merchant's bank account number off the table is over-broad even if only some fields render on the document. Move to a **PRIV-RPC** returning document-scoped fields only.

3. **🔴 `lib/order-cancellation-email.ts:64` — customer-authenticated client reads merchant `cac_rc_number` + `email`.** The cancel route (`/api/storefront/account/orders/[id]/cancel`) authenticates the **customer**, then this helper selects the merchant's tax identity. Same class as #2. PRIV-RPC.

4. **🔴 The browser-client dashboard reads are the S1 crux (queries.ts:238/244).** A signed-in merchant's **browser** (`@/lib/supabase/client`) selects `nin, bvn, cac_rc_number, kyc_status, stripe_customer_id, ga4_api_secret, facebook_capi_token, tiktok_access_token, snapchat_capi_token, bank_account_number` directly off the table. RLS scopes rows to the owner, but every one of these secret columns is shipped to the client bundle's runtime. This is exactly what a **PRIV-RPC** (returning a curated dashboard projection) should replace; the raw column reads should never be reachable from a browser client.

5. **⚠️ Task's "`getCachedMerchantById` — zero prod callers" is STALE on origin/main.** It now has **two** non-test importers: `lib/repair-notifications.ts:176` and `lib/repairs/notify-repair-status-change.ts:94` (both in the repairs-notifications path). It runs on the **anon** public-cached client. Re-confirm before deleting; if the repairs path is live it is a real anon read.

6. **Dual-client files where the exact client var for the merchants access needs a second confirm** (both `createAdminClient` and `createClient(server)` imported; I inferred from surrounding scope): `app/api/merchant/readiness/route.ts:120` (🔴 selects `bank_account_number`), `app/api/orders/route.ts:1446` (🔴 `bank_account_number`, `cac_rc_number`), `app/api/domains/purchase/route.ts:142` (heavy PII), `app/api/admin/analytics/route.ts:157` (🔴 `bank_account_number`, `kyc_status`), `app/dashboard/staff/actions.ts:229`. None are anon, but confirm service-vs-authenticated before writing the replacement.

7. **`createAdminClient()` (service_role) used for purely-public data** in the two `opengraph-image.tsx:31` OG generators and several VTU slug→id lookups (`vtu/checkout/{confirm,saved-cards,wallet-only}`, `vtu/history`). Not a leak (server-only), but they bypass RLS to fetch public presentation/id data that **SNAP** should serve without service_role.

8. **Anon PII fan-out beyond the flagged secret list:** `PUBLIC_MERCHANT_SELECT` (queries.ts, anon storefront), `merchants/by-slug` (anon), `blog/feed` (anon), `shipping/quotes/quote-merchant-context:188` (anon/auth), `forms/submit:35` (public) all expose `email`, `phone`, `support_email`/`support_phone`, `business_address`, `social_media` on public/anon paths. Not in the flagged secret set, but they are the merchant's contact PII and are the primary reason to route anon reads through **SNAP** (which can whitelist non-PII presentation fields).

### Merchants-reading/-writing RPCs found (web)
- `resolve_storefront_cached_merchant` — `lib/cached-data.ts:843`, **service_role** — the existing public-snapshot resolver (the analog of the proposed `resolve_storefront_public_snapshot_v2`).
- `rename_merchant_slug` — `app/api/merchant/rename-slug/route.ts:135`, **authenticated** — writes `merchants.slug`.
- (`get_user_access`, `get_admin_platform_growth`, `get_total_sales`, `create_merchant_quiz_draft`, `get_merchant_balance` appear alongside merchant reads but do not directly project `merchants` columns to the web caller — noted for completeness, out of the direct-access set.)
