## S0/S1 Census — anon/shared-client reads of `merchants` in `apps/mobile-storefront`

Original census read against `origin/main` @ `c8108a052dfccfb0c99f4c5e6cac96a56dad9587`; revalidated after rebase at `origin/main@1ba7562b64`. Current code now reads receipt identity through `get_storefront_receipt_merchant_info`; pre-#3083 mobile binaries still require the temporary raw-table compatibility bridge documented below.

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

### S0-A — exact legacy projection (two-phase compatibility bridge)

Before the S0-B mobile release is mandatory, PostgREST must be able to authorize the **entire** projection requested by a pre-#3083 `useMerchantReceiptInfo()` binary. PostgreSQL rejects a select when any requested column lacks `SELECT`; therefore the first compatibility grant is the union below, not only the bootstrap columns:

```
id, slug, business_name, logo_url, social_media,
email, phone, support_email, support_phone, rider_phone_number,
business_address, hero_image_ids, brand_colors, pages,
vat_registration_status, vat_rate,
cac_rc_number, tax_identification_number, legal_entity_name,
bank_code, bank_account_number, bank_name, bank_account_name
```
(union of the storefront-bootstrap, receipt, and boot reads; row access is published-merchants-only)

Current `20260713150000_s0a_merchants_anon_containment.sql` implements this as a permanent published-store presentation/contact grant plus a dated nine-column financial/business-registration bridge. The bridge remains until the mobile minimum-version gate excludes pre-#3083 binaries and the guest-order lookup no longer uses the anon client; only then may the financial/business-registration columns be revoked. This sequencing prevents receipt/invoice regressions while bounding the residual exposure in time.

### S0-B — must-migrate to an authorization-scoped server boundary (bank/receipt fields)

The current `use-receipts.ts` implementation has moved the fixed receipt projection off the raw table and onto `get_storefront_receipt_merchant_info`. The following financial fields remain in the temporary compatibility grant solely for older binaries and must be removed after the mandatory-version gate:

```
bank_code
bank_account_number
bank_name
bank_account_name
```

The same removal wave includes the adjacent business-registration fields:
```
cac_rc_number
tax_identification_number
legal_entity_name
```

The remaining receipt projection (`business_name, logo_url, email, phone, support_email, support_phone, rider_phone_number, business_address, brand_colors, vat_registration_status, vat_rate, social_media, pages`) is intentionally public merchant presentation/contact data for published stores and remains in the bounded projection.

**Boundary note:** the replacement RPC is intentionally a fixed published-store projection rather than an arbitrary definer read. If bank details later become customer/order-private instead of public receipt configuration, add an authenticated order-scoped boundary before narrowing the RPC; do not silently remove columns while supported clients still request them.

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
