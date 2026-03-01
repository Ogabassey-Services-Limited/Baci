# Warden's Journal

## 2026-03-04 - Product Data Integrity
**Learning:** Supabase queries for `products` were using `select('*')` and `variants:product_variants(*)`, exposing all columns including potentially sensitive or unnecessary data.
**Action:** Created `apps/web/src/lib/product-queries.ts` with explicit `PRODUCT_COLUMNS` and `PRODUCT_VARIANT_COLUMNS` and enforced their use in API routes and server utilities to prevent over-fetching.

## 2026-03-04 - Unscoped Product and Variant Mutations
**Learning:** The `PUT` endpoint in `apps/web/src/app/api/products/[id]/route.ts` updated product records and deleted variant records solely based on the requested `id` without verifying the `merchant_id`. This created a risk of cross-tenant modifications if an attacker enumerated IDs.
**Action:** Appended `.eq('merchant_id', merchantId)` to all `.update()` and `.delete()` calls on the `products` and `product_variants` tables to strictly enforce tenant isolation during mutations.

## 2024-05-24 - Overfetching Discount Codes
**Learning:** Overfetching data with `select('*')` in `discount-codes` APIs can expose internal database schema metadata.
**Action:** Replace `select('*')` with an explicitly defined column selection string matching the exact fields needed by the feature (e.g. `select('id, code, ...')`), and use `select('discount_code_id', { count: 'exact', head: true })` instead of `select('*')` when only counting rows.
