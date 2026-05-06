## 2024-05-24 - Missing Query Scoping in Product Reviews
**Learning:** Checking ownership of a resource in application code using `merchantContext.merchantId !== review.merchant_id` is insufficient for robust data integrity. Query builder methods like `.update()` and `.delete()` must also be explicitly scoped with `.eq('merchant_id', ...)` to prevent race conditions or app-logic bypasses.
**Action:** Always append `.eq('merchant_id', merchantId)` to all database mutations (`.update()`, `.delete()`, `.upsert()`) to ensure defense-in-depth, even if application-level checks are present.

## 2025-05-24 - Prevent `select('*')` Overfetching in Customer Searches

**Learning:** Using `select('*')` when checking for existing customers overfetches all columns, increasing payload size and query execution time unnecessarily.
**Action:** Always specify exact columns needed (like `id, first_name, last_name, email, phone, address`) instead of `*` for database reads to improve performance and prevent unintended data exposure.

## 2024-05-24 - Missing Query Scoping in Rollbacks and Reactivations
**Learning:** Rollback mechanisms (e.g., deleting an orphaned record after a related insert fails) and reactivations (e.g., updating a previously 'removed' entity to 'pending') must strictly include `.eq('merchant_id', merchantId)` in their query chains. Omitting this scope can lead to cross-tenant data leaks or unauthorized modifications, even when operating by `id` or other constraints.
**Action:** Always append `.eq('merchant_id', merchantId)` to all database mutations (`.update()`, `.delete()`), including secondary cleanup operations, rollbacks, and entity reactivations, regardless of other identity constraints like primary keys.
