## 2024-05-24 - Missing Query Scoping in Product Reviews
**Learning:** Checking ownership of a resource in application code using `merchantContext.merchantId !== review.merchant_id` is insufficient for robust data integrity. Query builder methods like `.update()` and `.delete()` must also be explicitly scoped with `.eq('merchant_id', ...)` to prevent race conditions or app-logic bypasses.
**Action:** Always append `.eq('merchant_id', merchantId)` to all database mutations (`.update()`, `.delete()`, `.upsert()`) to ensure defense-in-depth, even if application-level checks are present.

## 2025-05-24 - Prevent `select('*')` Overfetching in Customer Searches

**Learning:** Using `select('*')` when checking for existing customers overfetches all columns, increasing payload size and query execution time unnecessarily.
**Action:** Always specify exact columns needed (like `id, first_name, last_name, email, phone, address`) instead of `*` for database reads to improve performance and prevent unintended data exposure.

## 2025-02-27 - Unhandled Errors in maybeSingle / single Queries
**Learning:** Destructuring `{ data }` from `supabase.from().single()` or `maybeSingle()` without checking for the `error` object causes silent failures. If `.single()` expects 0 rows, it incorrectly throws a PGRST116 error that could be swallowed. On the flip side, real database errors on `.maybeSingle()` are ignored if `error` is unchecked, allowing dependent logic to proceed with `data = null` improperly, leading to data integrity issues.
**Action:** Always extract and handle `error` explicitly when fetching data. Use `.maybeSingle()` when 0 rows is valid, and handle true database errors distinctly from the 0-rows case.

## 2026-05-24 - Missing Query Scoping in Transaction Updates
**Learning:** When performing updates on resources like transactions, even if the user has been authenticated and the transaction has been fetched using a gateway reference, the subsequent `.update()` call using the record's ID must still explicitly include `.eq('merchant_id', merchantId)`. Relying solely on the ID or prior fetched data creates a vulnerability if an attacker can manipulate IDs or references.
**Action:** Always append `.eq('merchant_id', merchantId)` to all database mutations (`.update()`, `.delete()`, `.upsert()`) to ensure multi-tenant isolation, regardless of whether the target record's ID was obtained securely.
