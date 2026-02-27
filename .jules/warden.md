# Warden's Journal

## 2026-03-04 - Product Data Integrity
**Learning:** Supabase queries for `products` were using `select('*')` and `variants:product_variants(*)`, exposing all columns including potentially sensitive or unnecessary data.
**Action:** Created `apps/web/src/lib/product-queries.ts` with explicit `PRODUCT_COLUMNS` and `PRODUCT_VARIANT_COLUMNS` and enforced their use in API routes and server utilities to prevent over-fetching.

## 2026-03-04 - Missing Tenant Scoping in Bulk Updates
**Learning:** The bulk update/remove logic in `apps/web/src/app/api/products/bulk-update/route.ts` relied on `productId` alone without explicitly scoping to `merchant_id`. While RLS might prevent access, this "defense in depth" gap could theoretically allow a user to update/delete another merchant's product if RLS policies were misconfigured or if they guessed a valid ID.
**Action:** Added explicit `.eq('merchant_id', merchantId)` to both the update and delete query chains when operating by `productId`.
