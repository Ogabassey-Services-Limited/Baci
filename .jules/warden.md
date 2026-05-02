## 2024-05-24 - Missing Query Scoping in Product Reviews
**Learning:** Checking ownership of a resource in application code using `merchantContext.merchantId !== review.merchant_id` is insufficient for robust data integrity. Query builder methods like `.update()` and `.delete()` must also be explicitly scoped with `.eq('merchant_id', ...)` to prevent race conditions or app-logic bypasses.
**Action:** Always append `.eq('merchant_id', merchantId)` to all database mutations (`.update()`, `.delete()`, `.upsert()`) to ensure defense-in-depth, even if application-level checks are present.

## 2025-05-24 - Prevent `select('*')` Overfetching in Customer Searches

**Learning:** Using `select('*')` when checking for existing customers overfetches all columns, increasing payload size and query execution time unnecessarily.
**Action:** Always specify exact columns needed (like `id, first_name, last_name, email, phone, address`) instead of `*` for database reads to improve performance and prevent unintended data exposure.
## 2024-05-18 - Unhandled Error Returns from Supabase Database Mutations
**Learning:** Supabase queries (e.g. `insert()`) that are `await`ed without destructuring and checking their `{ error }` return object will silently fail if the database operation violates constraints (e.g., RLS, unique constraints, null fields). This creates a dangerous data integrity gap where the server proceeds as if a record was successfully created, leading to missing data and inconsistent state.
**Action:** Always capture and evaluate the `{ error }` property from Supabase mutation queries. If an error is returned, log it correctly using `console.error` or the application's logger, and return an appropriate error response from the API route instead of failing silently.
