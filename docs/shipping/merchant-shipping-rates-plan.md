# Merchant-Configured Shipping Rates — Implementation Plan

**Date:** 2026-07-10 · Synthesized from two research streams: external state-of-the-art (Shopify delivery profiles, Medusa v2 fulfillment, Saleor/Woo/commercetools) and an exact Baci integration map (file:line). Companion docs: `docs/i18n/multi-country-followups-advisory.md` (why this feature), research briefs in session transcripts.

## Context

Baci merchants cannot set any delivery fee anywhere today. Shipping = NG-only carrier quotes (GIGL/Topship) + two hardcoded ₦25k/₦20k airport constants in the ogabassey template. Non-NG merchants (live: India, UAE) get an empty-quote dead end. This feature lets every merchant define **zones → rates** (their own currency) so any store can ship anywhere, with carrier quotes coexisting for NG merchants.

## Design decisions (locked, from research)

| Decision | Choice | Why |
|---|---|---|
| Model | **Zone → rate** (Saleor/commercetools), NOT Shopify profiles | Profiles solve per-product shipping (v2+) and cause combined-rate overcharging |
| Zone vocabulary | ISO 3166-1 country + ISO 3166-2 subdivision (`NG-LA`) | Nigeria needs Lagos-vs-rest day 1; 3166-2 is the canonical vocabulary |
| Overlap resolution | **Most-specific-match, computed** (state > country > rest-of-world) | Woo's manual ordering is the #1 merchant footgun |
| Never un-shippable | Auto-created **rest-of-world zone** w/ one editable flat rate (onboarding + backfill) | Woo's "no shipping options" hard-block is a top abandonment cause |
| Rate types v1 | flat · free-over-threshold · price-tier (subtotal) · local pickup | Weight tiers deferred (products lack weights); postcodes deferred |
| Condition storage | **Relational min/max columns**, not JSONB rule engine | Queryable, testable; Medusa's attribute/operator/value = v2 escape hatch |
| Currency | Rate rows stamp `resolveMerchantCurrencyConfig(merchant).code`; no FX | One currency per merchant (just shipped in #2993/#3016) |
| Free-over basis | **Canonical server-verified pre-discount subtotal** (`computeCanonicalOrderSubtotal`) | Only tamper-proof value in the pipeline; documented as the single rule |
| Default selection | Auto-select **cheapest** | Matches existing shipping-options behavior + Baymard guidance |
| Pickup scope | Merchant-global (one pickup address) at v1 | Multi-location = later |
| Delivery estimate | `delivery_min_days`/`max_days` per rate, rendered "2–4 days" | Estimate beats vague speed labels |

### The architectural crux: computed prices, NOT persisted quotes

Merchant rates are **computed synchronously from config**, never upserted into `shipping_quotes`:
- Sidesteps `shipping_quotes_provider_check` (`'GIGL'|'TOPSHIP'|'SHIIP'|'FALLBACK'` — `'MERCHANT'` would 23514) — no constraint migration.
- Orders carry `shipping_provider: null, selected_quote_id: null` (the **existing pickup/airport RPC bypass**, checkout-page.tsx ~1763-1822) + a new `shipping_rate_id` in the POST body; the route stamps `orders.shipping_provider` post-create (self-fulfill precedent — column is unconstrained free text).
- **`/api/orders` recomputes the fee server-side** from rate config + validated destination + canonical subtotal, and rejects/overrides mismatches — mirroring the existing server-side tax recompute. **This deliberately does NOT inherit the pre-existing gap where domestic carrier-quote `shipping_fee` is client-trusted** (`order-quote-destination.ts:263-269` only validates GIGL-international). Fixing the carrier path itself = separate fast-follow PR (noted in §Follow-ups).

## Schema (migration 1)

```sql
merchant_shipping_zones (
  id uuid PK default gen_random_uuid(),
  merchant_id uuid NOT NULL REFERENCES merchants ON DELETE CASCADE,
  name text NOT NULL,
  is_rest_of_world boolean NOT NULL DEFAULT false,
  active boolean NOT NULL DEFAULT true,
  created_at/updated_at timestamptz  -- + update_updated_at_column trigger
)
-- UNIQUE (merchant_id) WHERE is_rest_of_world  (partial: exactly one fallback zone)

merchant_shipping_zone_locations (
  id uuid PK, zone_id uuid NOT NULL REFERENCES merchant_shipping_zones ON DELETE CASCADE,
  country_code char(2) NOT NULL,       -- ISO 3166-1
  subdivision_code text NULL,          -- ISO 3166-2 (NG-LA); NULL = whole country
  UNIQUE (zone_id, country_code, subdivision_code)
) -- INDEX (country_code, subdivision_code)

merchant_shipping_rates (
  id uuid PK, merchant_id uuid NOT NULL REFERENCES merchants ON DELETE CASCADE,
  zone_id uuid NOT NULL REFERENCES merchant_shipping_zones ON DELETE CASCADE,
  name text NOT NULL,                          -- "Standard", "Express", "Store pickup"
  kind text NOT NULL DEFAULT 'ship' CHECK (kind IN ('ship','pickup')),
  currency char(3) NOT NULL CHECK (currency ~ '^[A-Z]{3}$'),
  base_amount numeric(12,2) NOT NULL DEFAULT 0 CHECK (base_amount >= 0),
  condition_type text NOT NULL DEFAULT 'always' CHECK (condition_type IN ('always','price_tier')),
  min_subtotal numeric(12,2) NULL,             -- tier lower bound, inclusive
  max_subtotal numeric(12,2) NULL,             -- tier upper bound, exclusive; NULL = ∞
  free_over_amount numeric(12,2) NULL,
  delivery_min_days smallint NULL, delivery_max_days smallint NULL,
  pickup_address jsonb NULL,                   -- kind='pickup' display info
  sort_order smallint NOT NULL DEFAULT 0,
  active boolean NOT NULL DEFAULT true,
  created_at/updated_at
) -- INDEX (merchant_id, zone_id, active); INDEX (zone_id)
```

**RLS (per July-2026 conventions):**
- Owner/staff read+write: `check_staff_permission(auth.uid(), merchant_id, 'settings', 'edit')` (owner bypass built in; SQL mirrors `ensurePermission`).
- **NO anon table grants.** Storefront reads go through a SECURITY DEFINER RPC `get_storefront_shipping_rates(p_merchant_id)` returning checkout-safe columns only — the exact pattern `20260707015215_scope_shipping_quotes_to_merchant.sql` just established (a blanket anon SELECT on shipping data was *removed* there; don't reintroduce the shape).

**Migration 2 (data):** backfill — for every existing merchant, create the rest-of-world zone + one inactive-priced placeholder flat rate (₦0? No — create zone with one **active flat rate = 0/free** would surprise merchants; instead create the zone with NO rates: matching engine treats "fallback zone with zero rates" as "merchant hasn't configured shipping" → checkout behaves exactly as today. New merchants get the same at onboarding.) → **decision: zone always exists; rates only when merchant adds them. "Never un-shippable" guarantee activates the moment they save their first rate.** Keeps rollout zero-behavior-change.

## Matching engine (`apps/web/src/lib/shipping/merchant-rates/`)

Pure TS, fully unit-tested:
1. `matchZone(zones, locations, {countryCode, subdivisionCode})` → subdivision match (2) > country (1) > rest-of-world (0).
2. `computeRates(rates, {subtotal})` → filter active + kind + tier bounds (min inclusive/max exclusive); apply `free_over_amount → 0`.
3. `toShippingQuotes(...)` → existing `ShippingQuote` shape: `id: 'mrate_'+rate.id`, `provider: 'MERCHANT'` (TS union widened — **client-side type only**, no DB constraint involved), price, currency (merchant's), `estimatedDays`, `isStationPickup: kind==='pickup'`.
Tests: subdivision-beats-country, country-beats-RoW, tier boundaries, free-over, no-rates → empty, the never-throw invariant.

## Integration points (file:line from the map)

1. **`/api/shipping/quotes/route.ts`** — restructure the non-NG guard (lines 63-90): it currently returns empty BEFORE any provider runs and would suppress merchant rates for exactly the merchants who need them. New flow: *always* compute merchant rates (via the storefront RPC + engine); run the carrier aggregator ONLY when the guard passes (NG/NGN); merge into one `QuoteResponse` (aggregator ranking already provider-agnostic). Merchant-rate quotes are **not** persisted in the `shipping_quotes` upsert loop (skip `provider==='MERCHANT'`).
2. **Ogabassey checkout** (`checkout-page.tsx` + `DeliveryStep`/`DoorDeliveryQuotes`): merchant `ship` rates surface in the existing door-delivery quote list (provider-agnostic radio, quote.id keyed); merchant `pickup` rate adds/generalizes the pickup delivery method. `deliveryCost` follows the selected quote as today. Order POST: for `mrate_` selections send `shipping_provider: null, selected_quote_id: null, shipping_rate_id: <uuid>`. **Do not grow the 3,976-line page** — new logic in extracted hooks/components (note: `checkout/hooks/use-shipping.ts` is DEAD code, don't build on it).
3. **`DoorDeliveryQuotes.tsx` currency fix** (required for the target market): `₦{quote.price.toLocaleString()}` (lines ~102/128) → `formatAmountInCurrency(quote.price, quote.currency)`; replace the GIGL-specific empty-state copy.
4. **`/api/orders` fee enforcement**: when `shipping_rate_id` present → load rate via admin client, validate merchant/zone/destination match + recompute fee (canonical subtotal for tiers/free-over) → use the SERVER value in the RPC call (override client `shipping_fee`; 400 on structural mismatch e.g. rate not found/inactive/foreign merchant). Post-create: stamp `orders.shipping_provider = 'MERCHANT'` (+ rate name in existing metadata path).
5. **Dashboard** `/dashboard/settings/shipping` — mirror the **discount-codes CRUD pattern** (`dashboard/marketing/discount-codes/`: Server page + `'use server'` actions with `ensurePermission('settings','edit')` + Zod in `schemas/merchant-shipping-rates.ts` + client list/editor). Zone list → rates per zone → subdivision picker seeded from a new `lib/shipping/merchant-rates/subdivisions.ts` (v1 data: NG 36+FCT with ISO codes, IN states, AE emirates; country-only elsewhere; extendable). Settings nav entry alongside tax/trust/vtu.
6. **Generic/Puck checkout path** (`app/checkout/page.tsx` + `shipping-options.tsx`): benefits automatically via the quotes API; fix its hardcoded `country:'Nigeria'` request only if trivially safe (builder-preview path, low priority).
7. **Mobile-storefront**: no code change expected (same APIs, no provider literals — verified); flag currency rendering as a QA check. **mobile-admin settings screen = v2.**

## Execution waves

| Wave | What | Model |
|---|---|---|
| 1a | Migrations (tables + RLS + storefront RPC + backfill/onboarding zone) + SQL test | opus |
| 1b | Matching engine + subdivisions vocabulary + `ShippingQuote` union widening + tests | opus |
| 2a | Quotes route restructure + guard scoping + merge + (no-persist) + tests | opus |
| 2b | `/api/orders` server-side fee enforcement + `shipping_rate_id` schema + tests | opus (money path) |
| 3a | Ogabassey checkout integration (rates in picker, pickup method, POST threading) + currency fix in DoorDeliveryQuotes | opus |
| 3b | Dashboard settings/shipping CRUD (page + actions + UI + nav) + tests | sonnet |
| 4 | Review pass (me), full gates, PR, Codex/CodeRabbit loop, merge | — |

Branch: `codex/merchant-shipping-rates` off latest main (reuse `.worktrees/multi-country`). Same discipline as the currency effort: agents never commit; I review every diff; conventional commits; append-only migrations with fresh-prefix check against main.

## Wave-1a handoff notes (DB layer — DONE, apply-tested in ephemeral PG17)
- New-merchant rest-of-world zone is created by a **DB trigger** on merchants insert — app onboarding must NOT also insert one (would 23505 on the partial unique index).
- **Wave 3 requirement:** the dashboard UI must hide/deny delete on the `is_rest_of_world` zone (deletion is deliberately not DB-guarded to keep merchants ON DELETE CASCADE working).
- Storefront RPC `get_storefront_shipping_rates(p_merchant_id) → jsonb {zones, locations, rates}`; money fields are JSON **numbers** (2-dp) — engine Zod schema must accept numbers.
- `condition_type='always'` rows may carry stale tier columns at the DB level — the Zod/engine layer owns that shape enforcement.
- Anon table access explicitly revoked (prod default-ACL auto-grants anon on new tables — revokes are mandatory on every future table too).

## Wave-1b handoff notes (engine — DONE, 50 tests)
- `ShippingQuote.provider` widened to `ShippingProviderCode | 'MERCHANT'` (`MERCHANT_PROVIDER_CODE`); the `SHIPPING_PROVIDER_CODES` tuple stays carrier-only ON PURPOSE (it gates the booking path via `isShippingProviderCode`). Do not add MERCHANT to the tuple.
- **Wave 2a MUST widen** `schemas/shipping-quote-response.ts`'s `z.enum(SHIPPING_PROVIDER_CODES)` — it currently DROPS 'MERCHANT' quotes at the client normalizer.
- **Wave 2a:** un-estimated merchant rates use `estimatedDays: 0` sentinel — exclude them from the aggregator's "fastest" featured pick (cosmetic badge artifact otherwise). Callers must not render "0 days".
- Merchant quote ids are `mrate_<uuid>`; quotes are NOT persisted; expiresAt = now+24h synthetic.
- `resolveSubdivisionCode(country, stateName)` handles checkout's free-text states ('Lagos'→NG-LA, 'FCT - Abuja'→NG-FC, IN legacy names, AE romanizations).

## Wave-2b handoff notes (order fee enforcement — DONE, 156 tests)
- Fee mismatch (client vs server, >±0.01) → 400 `SHIPPING_FEE_MISMATCH` BEFORE the RPC; within tolerance the RPC receives the SERVER amount (parity guard tolerates ±1, cannot trip).
- Rate orders force `shipping_provider: null` + `selected_quote_id: null` into the RPC even if a buggy client sends them; post-create stamp `orders.shipping_provider='MERCHANT'` (skipped on replay).
- **Wave 3a:** offer pickup rates ONLY from the quote list for the entered address (they're zone-checked at order time like ship rates); thread `shipping_rate_id` + the SERVER-quoted fee into the order POST; **`cart_subtotal` MUST be sent on the quotes request** — without it free-over rates quote at base price while order-time recomputes 0 and the fee-mismatch guard 400s the checkout (tier rates are simply excluded without subtotal, which is consistent).
- ~~Follow-up (deferred): `shipping_rate_id` not in the idempotency hash~~ — **DONE (Codex r5):** added omit-when-empty to `buildOrderIdempotencyPayload` so a same-fee rate swap on retry now yields a different hash (RPC returns a conflict, not a wrong-rate replay); carrier/pickup/mobile hashes stay byte-identical (the mobile-mirror concern was moot — mobile never sends merchant rates).

## Follow-ups explicitly out of scope
- **Carrier-skip for body-only non-NG requests** (Codex r11 residual): R11-1 makes a non-NG merchant's OWN rates survive on the body-only path (currency sourced from the `get_storefront_shipping_rates` RPC). But the carrier-skip decision at `quotes/route.ts:~107` still uses the route's NGN-default `merchantCurrency` for a body-only caller, so NG carriers aren't skipped. In practice this is inert — GIGL/Topship are NG-domestic and return nothing for a non-NG receiver, so no NGN carrier quote actually mixes in — but making the skip currency-correct for body-only would mean threading the RPC-resolved currency up into the route (carriers run in parallel with the rate load, so the currency isn't known at the skip decision). Deferred as low-risk; revisit if carriers ever quote non-NG receivers.
- Server-side fee validation for **carrier** quotes (pre-existing gap — separate hardening PR).
- Weight tiers, postcodes, per-product profiles, multi-location pickup, distance-radius local delivery, mobile-admin screen, Medusa-style rule engine.
- WhatsApp "contact merchant" fallback when a merchant has zones but zero applicable rates (nice-to-have; v1 ships the never-unshippable default instead).
- **Trusted storefront context for any header-less (path-based) checkout caller** (Codex r3 F5, reverted): the quotes resolver deliberately loads `merchants` currency/details ONLY for a trusted merchant id (storefront header `<slug>.usebaci.com`/custom domain, or authenticated session) — an untrusted body-only `merchantId` must not trigger a `merchants` read (enumeration + attacker-controlled-id isolation; tested). Real subdomain/custom-domain checkouts already resolve currency via the trusted path, so non-NG rates quote correctly there. IF a genuinely header-less path-based checkout surface exists, the fix is to give it trusted storefront context upstream (proxy/header), NOT to load details for arbitrary body ids.
- **Checkout address-form internationalization** (Codex r1 shopper-country + r3 "non-NG address picker"): the checkout `AddressAutocomplete` is hardcoded `country="NG"` and manual state/city inference uses the NG state list (`/api/shipping/locations`), so a non-NG merchant's shoppers cannot enter a matching subdivision — subdivision-level zones for non-NG never match. Current behavior is fail-safe: the receiver country is set to `merchants.country`, so non-NG shoppers fall through most-specific-wins to the merchant's country-level zone or the auto-created rest-of-world zone (a defined, server-verified rate — never a mismatch or a Nigerian carrier quote). Non-NG merchants ship today via country/RoW zones; making subdivision zones matchable for non-NG requires merchant-country-aware address inputs + non-NG state lists (its own UX/validation/autocomplete-provider surface). NG (pilot market) is fully covered now. Surface merchant-rate metadata (`shipping_rate_name`): v1 renders it in the web **merchant dashboard** order-details view AND the web **customer account** order-details view. Remaining follow-ups: the public **track-order** view (needs a migration to add `shipping_rate_name` to the 187-line anon `get_order_tracking` SECURITY DEFINER RPC's RETURNS TABLE + SELECT — deferred to avoid reproducing a shared public RPC for a P3 cosmetic label), **mobile-admin**, **mobile-storefront**, and **email receipts**.

## Verification
- Unit: engine boundary tests; RPC/RLS SQL test (staff write allowed, anon table read denied, storefront RPC returns safe columns).
- Integration: quotes route returns merchant+carrier merged for NG merchant, merchant-only for IN/AE merchant; orders route rejects tampered `shipping_fee`, recomputes tiers/free-over.
- E2E manual: configure Lagos ₦1,500 / RoN ₦4,000 / pickup on a test merchant → checkout shows them merged with GIGL quotes; INR merchant sees ₹ rates end-to-end; place PoD order with a merchant rate → `orders.shipping_fee` = server-computed value.
