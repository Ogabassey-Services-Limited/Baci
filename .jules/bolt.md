## 2026-06-03 - Replaced .select() with specific column selection in features API
**Learning:** Returning all columns by default via `.select()` (or `.select('*')`) on database mutations (POST/PATCH/PUT) causes unnecessary data overfetching in response payloads.
**Action:** When updating or inserting records using Supabase, always supply explicit column names to `.select()`, for example: `.select(MERCHANT_FEATURE_SELECT_FIELDS.join(', '))`, to minimize database query planning overhead and JSON payload size.
