## S1 Census — `apps/mobile-admin` direct `merchants` table access

Original census read against `origin/main@c8108a052d`; revalidated after rebase at `origin/main@19d03df854`. Read-only; no migrations were applied.

Method: `git grep -n "from('merchants')"` and `"from(\"merchants\")"` plus `.rpc('` across `apps/mobile-admin`. **7 direct `.from('merchants')` call sites found — 5 reads, 2 writes** (analytics-config.tsx has one of each). No `INSERT`/`DELETE` on `merchants` from mobile-admin. Two RPCs touch merchant data but are already permission-scoped (see notes below the table).

### merchants reads/writes

| # | File:Line | Symbol | Op | Exact columns | Scope filter | Sensitive? | Proposed replacement |
|---|---|---|---|---|---|---|---|
| 1 | `apps/mobile-admin/app/(admin)/analytics-config.tsx:235` | `AnalyticsConfigScreen` → `useQuery(['merchant-analytics-full', user?.id])` | READ (`.select`) | `google_analytics_id, ga4_api_secret, facebook_pixel_id, facebook_capi_token, tiktok_pixel_id, tiktok_access_token, snapchat_pixel_id, snapchat_capi_token, offline_conversions_enabled` | `.eq('user_id', user?.id)` | **YES** — `ga4_api_secret`, `facebook_capi_token`, `tiktok_access_token`, `snapchat_capi_token` are third‑party API secrets/tokens | Permission‑scoped RPC (e.g. `get_merchant_analytics_config`, owner + `settings.edit` staff only, `SECURITY DEFINER`) returning just these columns — mirror the `get_user_merchant_context` owner-gating pattern |
| 2 | `apps/mobile-admin/app/(admin)/analytics-config.tsx:290` | `AnalyticsConfigScreen` → `saveMutation.mutationFn` | WRITE (`.update`) | Dynamic diff subset of the same 8 tracking columns (`google_analytics_id`, `ga4_api_secret`, `facebook_pixel_id`, `facebook_capi_token`, `tiktok_pixel_id`, `tiktok_access_token`, `snapchat_pixel_id`, `snapchat_capi_token`, `offline_conversions_enabled`) | `.eq('user_id', user?.id)` | **YES** — writes raw API tokens | Authenticated Route Handler (`POST /api/merchant/analytics-config`) validating with Zod + a scoped `update_merchant_analytics_config(p_merchant_id, p_payload)` RPC enforcing owner/`settings.edit` |
| 3 | `apps/mobile-admin/app/(admin)/payout-settings.tsx:54` | `PayoutSettingsScreen` → `useQuery(['merchant-payout', user?.id])` | READ (`.select`) | `id, business_name, bank_name, bank_account_number, bank_code` | `.eq('user_id', user?.id)` | **YES — the known one** — bank account number/code | Permission‑scoped RPC (e.g. `get_merchant_payout_settings`, owner-only, mirroring the `CASE WHEN v_is_owner` gating already used for bank fields in `get_user_merchant_context`) |
| — | (same screen) | `PayoutSettingsScreen` → `savePayoutSettings` (`hooks/usePayouts.ts:41`) | WRITE | N/A — already routed | N/A | YES | **Already compliant** — goes through `apiClient POST /api/paystack/subaccount`, not a direct client write. No change needed. |
| 4 | `apps/mobile-admin/app/(admin)/store-settings.tsx:150` | `StoreSettingsScreen` → `saveMutation.mutationFn` | WRITE (`.update`) | Dirty-diff subset of `business_name, phone, support_phone, support_email, business_address, country, payout_currency, slug` (+ optimistic-concurrency `.eq('updated_at', ...)`) | `.eq('id', merchant.id)` [+ `.eq('updated_at', loadedUpdatedAt)`] | NO (no bank/nin/bvn/token/kyc column) | Route ordinary settings through authenticated `PATCH /api/merchant/settings` + a permission-scoped `update_merchant_settings` RPC with the same concurrency check. **Do not include an established `slug` in that generic payload:** URL changes must call `rename_merchant_slug(merchant_id,new_slug)`, the only sanctioned path that writes `merchant_slug_aliases`; only initial assignment for a merchant with no established slug may stay in the ordinary create/setup boundary. |
| 5 | `apps/mobile-admin/components/ui/LogoPicker.tsx:68` | `uploadLogoToStorage` | WRITE (`.update`) | `logo_url` | `.eq('id', merchantId)` | NO | Route Handler or `update_merchant_logo_url(p_merchant_id, p_logo_url)` RPC (owner/`settings.edit`) called after the Storage upload completes |
| 6 | `apps/mobile-admin/hooks/createOrderDetailsReceiptActions.ts:149` | `createOrderDetailsReceiptActions` → `handleSendReceipt` | READ (`.select`) | `pages` | `.eq('id', merchant.id).maybeSingle()` | NO | Fold into a scoped `get_merchant_receipt_context(p_merchant_id)` RPC (or reuse cached `merchant.pages` from context) — low priority, non-sensitive |
| 7 | `apps/mobile-admin/hooks/orders/useOrderDetails.ts:198` | `fetchOrderById` | READ (`.select`) | `business_name, email, user_id` | `.eq('id', merchantId).eq('user_id', order.recorded_by_user_id).maybeSingle()` | NO (email is PII but not in the bank/payout/nin/bvn/token/kyc set) | Fold into an order-detail RPC/route (e.g. extend `fetchOrderById`'s server-side equivalent) scoped to merchant staff access rather than an ad-hoc client read |

### Critical context (not a separate finding, but load-bearing for every row above)

`origin/main:supabase/migrations/20260418000000_baseline.sql:13816` — the `"Authenticated can view merchants"` RLS SELECT policy is:
```sql
USING ((auth.uid() = user_id) OR (is_platform_admin IS NOT TRUE) OR is_active_staff_of(id, auth.uid()))
```
The `is_platform_admin IS NOT TRUE` clause is true for essentially every normal merchant row, so **RLS currently grants any authenticated (and per the `"Anon can view merchants" ... USING (true)` policy, even anonymous) caller SELECT on all columns of all non-platform-admin merchants**, including bank/BVN/NIN/CAC/tax-ID/tokens. This is already tracked as a P0 in memory (`project_merchants_anon_column_exposure.md`, fix drafted/not applied). It means every `.eq('user_id', ...)` / `.eq('id', ...)` filter in rows 1–7 above is a client-side courtesy only, not a security boundary — reinforcing that all seven sites need to move behind `SECURITY DEFINER` RPCs or server-side Route Handlers that do their own ownership/permission checks, independent of this RLS gap being fixed.

By contrast, `get_user_merchant_context()` (`hooks/useMerchant.ts:177`, latest def in `supabase/migrations/20260628100000_include_plan_fields_in_user_merchant_context.sql`) and `get_merchant_verification_flags()` (`hooks/useStoreReadiness.ts:61`, def in `20260423150000_add_verification_flags_rpc.sql`) are the two existing merchants-adjacent RPCs mobile-admin calls, and both are already correctly scoped: the former nulls out `bank_code/bank_account_number/bank_name/bank_account_name/paystack_subaccount_code/nin/bvn/cac_rc_number/tax_identification_number/legal_entity_name` for non-owners via `CASE WHEN v_is_owner`, and the latter checks `check_staff_permission(..., 'settings', 'edit')` and only ever returns booleans from `merchant_verifications`, never raw KYC values. These are the reference pattern to replicate for rows 1–7.

### Category mutation paths to route through B1-lite

- **`apps/mobile-admin/hooks/useProducts.ts:242`** — `useCreateCategory()` mutation: `supabase.from('categories').insert([{ merchant_id: merchant.id, name: sanitizedName, slug }]).select('id, name, slug').single()`, scoped only by the client-supplied `merchant.id` (no server-side ownership check on the insert itself). `onSuccess` (line 250-252) only does `queryClient.invalidateQueries({ queryKey: ['categories'] })` — no cache write-through of the new row, no server audit trail. **This is the only direct category DML in mobile-admin** (no update/delete on `categories` exists anywhere in the app). Must be replaced with a Route Handler / scoped `create_merchant_category(p_merchant_id, p_name, p_slug)` RPC enforcing owner/`products.edit` staff permission, consistent with B1-lite.
- Related reads that stay as-is (not in scope for B1-lite, listed for completeness): `apps/mobile-admin/hooks/useProducts.ts:214` (`useCategories()` list read) and `apps/mobile-admin/lib/discount-items.ts:92` (category search-picker read) — both are plain `SELECT`s scoped by `.eq('merchant_id', ...)`, not mutations.

### Files read (for reference)
- `apps/mobile-admin/app/(admin)/analytics-config.tsx`
- `apps/mobile-admin/app/(admin)/payout-settings.tsx`
- `apps/mobile-admin/app/(admin)/store-settings.tsx`
- `apps/mobile-admin/components/ui/LogoPicker.tsx`
- `apps/mobile-admin/hooks/createOrderDetailsReceiptActions.ts`
- `apps/mobile-admin/hooks/orders/useOrderDetails.ts`
- `apps/mobile-admin/hooks/useMerchant.ts`
- `apps/mobile-admin/hooks/useStoreReadiness.ts`
- `apps/mobile-admin/hooks/usePayouts.ts`
- `apps/mobile-admin/hooks/useProducts.ts`
- `apps/mobile-admin/components/store-settings/store-settings-payload.ts`
- `apps/mobile-admin/lib/discount-items.ts`
- `supabase/migrations/20260418000000_baseline.sql`
- `supabase/migrations/20260628100000_include_plan_fields_in_user_merchant_context.sql`
- `supabase/migrations/20260423150000_add_verification_flags_rpc.sql`
