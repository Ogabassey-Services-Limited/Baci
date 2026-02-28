# Warden's Journal

## 2026-03-04 - Product Data Integrity
**Learning:** Supabase queries for `products` were using `select('*')` and `variants:product_variants(*)`, exposing all columns including potentially sensitive or unnecessary data.
**Action:** Created `apps/web/src/lib/product-queries.ts` with explicit `PRODUCT_COLUMNS` and `PRODUCT_VARIANT_COLUMNS` and enforced their use in API routes and server utilities to prevent over-fetching.

## 2026-03-04 - Unscoped Product and Variant Mutations
**Learning:** The `PUT` endpoint in `apps/web/src/app/api/products/[id]/route.ts` updated product records and deleted variant records solely based on the requested `id` without verifying the `merchant_id`. This created a risk of cross-tenant modifications if an attacker enumerated IDs.
**Action:** Appended `.eq('merchant_id', merchantId)` to all `.update()` and `.delete()` calls on the `products` and `product_variants` tables to strictly enforce tenant isolation during mutations.
