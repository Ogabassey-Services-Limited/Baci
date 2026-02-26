# Warden's Journal

## 2026-03-04 - Product Data Integrity
**Learning:** Supabase queries for `products` were using `select('*')` and `variants:product_variants(*)`, exposing all columns including potentially sensitive or unnecessary data.
**Action:** Created `apps/web/src/lib/product-queries.ts` with explicit `PRODUCT_COLUMNS` and `PRODUCT_VARIANT_COLUMNS` and enforced their use in API routes and server utilities to prevent over-fetching.

## 2026-10-14 - Bulk Update Scoping
**Learning:** The bulk update API endpoint (`/api/products/bulk-update`) allowed updating and removing products by ID without verifying `merchant_id` ownership, potentially allowing cross-tenant data modification if RLS policies were permissive or bypassed.
**Action:** Added explicit `.eq('merchant_id', merchantId)` scoping to all `update` and `delete` (archive) operations in the bulk update loop to enforce tenant isolation at the application layer.
