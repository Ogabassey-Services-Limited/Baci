## S0/S1 Census — anon/shared-client reads of `merchants` in `apps/mobile-storefront`

Read against `origin/main` @ `c8108a052dfccfb0c99f4c5e6cac96a56dad9587` (fetched `origin/main`, read-only — no edits/migrations run).

Exhaustive grep (`.from('merchants')` + any merchants RPC) across `apps/mobile-storefront` returns **exactly 3 call sites**. No other `.from("merchants")`/`` `merchants` ``/schema-qualified variants exist. Only one merchants-adjacent RPC exists in the app (`get_storefront_payment_settings`) and it is a `SECURITY DEFINER` function with a fixed non-sensitive return shape (no raw table grant involved) — listed for completeness but out of scope for the anon-projection question since it isn't a raw `merchants` select.

### Table

| # | File:Line (origin/main) | Symbol | Runtime role | Exact columns selected | Sensitive fields present? |
|---|---|---|---|---|---|
| 1 | `apps/mobile-storefront/hooks/use-merchant.ts:30` | `useMerchant()` (`useQuery` queryFn) | **anon** when signed-out; same client/session when signed-in, but this hook fires unconditionally on core anon-facing screens (`app/(tabs)/index.tsx` home tab, `use-categories.ts`, `use-products.ts`, `use-product.ts`, `use-page-config.ts`, `use-pinned-launch-products.ts`, `use-cart-reprice.ts`, `use-checkout-submit.ts`) — this is the primary anon storefront-bootstrap read | `id, slug, business_name, social_media, email, phone, business_address, hero_image_ids` | **No** bank/BVN/NIN/token fields. (`email`, `phone` are the merchant's own public business contact info, not customer PII — not in the sensitive list but worth flagging as business-contact exposure, likely intentional for storefront "contact us" surfaces.) |
| 2 | `apps/mobile-storefront/hooks/use-receipts.ts:253` | `useMerchantReceiptInfo()` (`useQuery` queryFn) | **anon** — confirmed unconditional (no `enabled` gate tied to auth state). Called from `use-receipt-preview.ts` → `ReceiptsScreen` (`app/receipts/index.tsx`), which fires this hook **before** its `useRequireAuth()` `<Redirect>` early-return, so it executes on first render even for a signed-out/deep-linked visitor. Also called unconditionally from `UtilitiesReceiptsView.tsx`, `ReceiptShareButton.tsx`, and `use-order-details-controller.ts` (`orders/[id]` — that controller's own `requiresSignIn` gate only guards the *order* fetch effect, not this hook) | `business_name, logo_url, email, phone, support_email, support_phone, rider_phone_number, business_address, cac_rc_number, tax_identification_number, legal_entity_name, brand_colors, vat_registration_status, vat_rate, bank_code, bank_account_number, bank_name, bank_account_name, social_media, pages` | **YES** — `bank_code`, `bank_account_number`, `bank_name`, `bank_account_name` all present. Also carries `cac_rc_number` / `tax_identification_number` / `legal_entity_name` (business-registration identifiers, not in the task's explicit sensitive list but adjacent-sensitive). No `bvn`, `nin`, or token columns selected. |
| 3 | `apps/mobile-storefront/stores/auth-store-initialize.ts:53` | `createInitializeAction()` init sequence (runs once at app boot, before `supabase.auth.getSession()` is awaited) | **anon** for a fresh install/never-signed-in device. **Restored-authenticated-session case**: supabase-js loads any persisted session (AsyncStorage) into the client synchronously at client construction, independent of when app code calls `getSession()`. Since this query is issued *before* `auth.getSession()` is awaited in this same function, a device with a valid persisted session may already have its JWT attached to this specific request — i.e. this call can run as `authenticated` role rather than `anon`, non-deterministically from the app-code's point of view. Either way it is **not gated on auth** and is the very first DB call the app makes. | `id` only | **No.** Minimal single-column projection — already the correct pattern. |

### RPC (out of scope for the raw-table anon projection, listed for completeness)

| File:Line | Symbol | Mechanism | Sensitive? |
|---|---|---|---|
| `apps/mobile-storefront/hooks/useMerchantPaymentSettings.ts:84` | `fetchMerchantPaymentSettings()` → `rpc('get_storefront_payment_settings', { p_merchant_id })` | `SECURITY DEFINER` RPC, not a raw `merchants` select — bypasses RLS deliberately with a fixed, narrow return shape (`paystack_enabled, korapay_enabled, juicyway_enabled, credpal_enabled, credit_direct_enabled, klump_enabled, klump_min_amount, klump_max_amount, pay_on_delivery_enabled, wallet_order_auto_debit_enabled, wallet_paystack_dva_enabled, vat_registration_status, vat_rate`) | No. This is the existing "good" pattern S0-B should mirror for the bank/receipt fields. |

### DB-layer confirmation (why the app-level column lists matter, but don't fully bound exposure)

`supabase/migrations/20260418000000_baseline.sql`:
- `CREATE POLICY "Anon can view merchants" ON "public"."merchants" FOR SELECT TO "anon" USING (true);`
- `GRANT ALL ON TABLE "public"."merchants" TO "anon";`

This is a full-row, all-column grant to `anon` (matches the existing memory finding `project_merchants_anon_column_exposure.md` — P0, fix drafted, not applied). The `merchants` table also carries `bvn`, `nin`, `facebook_capi_token`, `tiktok_access_token`, `snapchat_capi_token`, `facebook_capi_access_token`, `firs_password_encrypted`, `stripe_customer_id`, `stripe_subscription_id` — **none of which any mobile-storefront code path currently selects**. The app-code census above bounds what the *shipped binary* needs; it does not bound what the anon key can currently do against PostgREST directly (that remains gated only by the blanket RLS/grant, not by app behavior).

---

### S0-A — "exact legacy projection" (anon-safe, keep on the direct anon `merchants` grant)

This is the union of every column the current shipped code actually reads via anon, **excluding** the bank/receipt fields:

```
id
slug
business_name
social_media
email            (merchant's own public business email — not customer PII)
phone            (merchant's own public business phone)
business_address
hero_image_ids
```
(from `use-merchant.ts:30`, the storefront-bootstrap read used on the home tab and product/category/checkout hooks)

Plus the single-column boot read:
```
id                (from auth-store-initialize.ts:53 — merchant-slug → id resolution)
```

Union set for S0-A anon compatibility grant:
```
id, slug, business_name, social_media, email, phone, business_address, hero_image_ids
```

### S0-B — must-migrate to an authorization-scoped server boundary (bank/receipt fields)

From `use-receipts.ts:253` (`useMerchantReceiptInfo`), the following must move off the direct anon `merchants` select onto something equivalent to the `get_storefront_payment_settings` `SECURITY DEFINER` RPC pattern (scoped to an authenticated customer with an order/receipt to justify the read, not a bare anon `USING (true)` row):

```
bank_code
bank_account_number
bank_name
bank_account_name
```

Recommend bundling in the same S0-B move (adjacent-sensitive, same query, same file/line) even though not in the task's strict sensitive list:
```
cac_rc_number
tax_identification_number
legal_entity_name
```

The remaining columns in that same `useMerchantReceiptInfo` select (`business_name, logo_url, email, phone, support_email, support_phone, rider_phone_number, business_address, brand_colors, vat_registration_status, vat_rate, social_media, pages`) are non-sensitive merchant-branding/contact/tax-rate fields and can stay anon-readable (they overlap heavily with the S0-A set already).

**Important caveat surfaced by this census**: even after migrating the bank fields off the raw table select, `useMerchantReceiptInfo()` today fires unconditionally (no `enabled` gate) from three surfaces — `ReceiptsScreen` (before its own `<Redirect>` for unauthenticated users), `UtilitiesReceiptsView.tsx`, and `use-order-details-controller.ts` (`orders/[id]`, whose own `requiresSignIn` check does not gate this hook). Any S0-B replacement RPC/endpoint should itself enforce an authenticated+authorized caller (not just move the columns behind a function while still calling it unconditionally from these signed-out-reachable code paths), or these call sites should be updated to add an `enabled: isAuthenticated` guard.

### Files read (all via `git show origin/main:<path>`, read-only)
- `/Users/mac/Baci-app/apps/mobile-storefront/hooks/use-merchant.ts`
- `/Users/mac/Baci-app/apps/mobile-storefront/hooks/use-receipts.ts`
- `/Users/mac/Baci-app/apps/mobile-storefront/hooks/use-receipt-preview.ts`
- `/Users/mac/Baci-app/apps/mobile-storefront/hooks/use-auth-guard.ts`
- `/Users/mac/Baci-app/apps/mobile-storefront/hooks/useMerchantPaymentSettings.ts`
- `/Users/mac/Baci-app/apps/mobile-storefront/stores/auth-store-initialize.ts`
- `/Users/mac/Baci-app/apps/mobile-storefront/app/receipts/index.tsx`
- `/Users/mac/Baci-app/apps/mobile-storefront/components/receipts/UtilitiesReceiptsView.tsx`
- `/Users/mac/Baci-app/apps/mobile-storefront/components/utilities/ReceiptShareButton.tsx`
- `/Users/mac/Baci-app/apps/mobile-storefront/components/orders/use-order-details-controller.ts`
- `/Users/mac/Baci-app/apps/mobile-storefront/app/orders/[id].tsx`
- `/Users/mac/Baci-app/supabase/migrations/20260418000000_baseline.sql` (merchants `CREATE TABLE`, RLS policies, grants)
