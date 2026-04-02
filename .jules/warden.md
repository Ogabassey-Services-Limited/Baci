## 2024-05-24 - Missing Query Scoping in Product Reviews
**Learning:** Checking ownership of a resource in application code using `merchantContext.merchantId !== review.merchant_id` is insufficient for robust data integrity. Query builder methods like `.update()` and `.delete()` must also be explicitly scoped with `.eq('merchant_id', ...)` to prevent race conditions or app-logic bypasses.
**Action:** Always append `.eq('merchant_id', merchantId)` to all database mutations (`.update()`, `.delete()`, `.upsert()`) to ensure defense-in-depth, even if application-level checks are present.
