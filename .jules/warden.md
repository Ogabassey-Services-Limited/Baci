# Warden's Journal

## 2026-03-04 - Product Data Integrity
**Learning:** Supabase queries for `products` were using `select('*')` and `variants:product_variants(*)`, exposing all columns including potentially sensitive or unnecessary data.
**Action:** Created `apps/web/src/lib/product-queries.ts` with explicit `PRODUCT_COLUMNS` and `PRODUCT_VARIANT_COLUMNS` and enforced their use in API routes and server utilities to prevent over-fetching.

## 2026-03-04 - Unscoped Variant Deletion
**Learning:** Deleting related records (like variants) by parent ID only is insufficient defense-in-depth; explicit merchant_id scoping prevents potential cross-tenant leaks if parent ID validation fails.
**Action:** Added `.eq('merchant_id', merchantId)` to all delete operations on child resources in API routes.
