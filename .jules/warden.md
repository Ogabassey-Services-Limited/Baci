## 2024-05-24 - Missing Query Scoping in Product Reviews
**Learning:** Checking ownership of a resource in application code using `merchantContext.merchantId !== review.merchant_id` is insufficient for robust data integrity. Query builder methods like `.update()` and `.delete()` must also be explicitly scoped with `.eq('merchant_id', ...)` to prevent race conditions or app-logic bypasses.
**Action:** Always append `.eq('merchant_id', merchantId)` to all database mutations (`.update()`, `.delete()`, `.upsert()`) to ensure defense-in-depth, even if application-level checks are present.

## 2025-05-24 - Prevent `select('*')` Overfetching in Customer Searches

**Learning:** Using `select('*')` when checking for existing customers overfetches all columns, increasing payload size and query execution time unnecessarily.
**Action:** Always specify exact columns needed (like `id, first_name, last_name, email, phone, address`) instead of `*` for database reads to improve performance and prevent unintended data exposure.
## 2025-02-23 - Enforce multi-tenant safety on product fallback deletion
**Learning:** During product creation, if variant insertion fails, the fallback deletion of the orphaned product record was performed using only the product ID (`.delete().eq('id', product.id)`). If an attacker spoofed an ID and intentionally failed variant creation, this unscoped delete could remove products belonging to other merchants.
**Action:** Always scope database mutations (`.delete()`, `.update()`) with `.eq('merchant_id', merchantId)` for defense-in-depth, even when rolling back newly created rows by their primary key.
