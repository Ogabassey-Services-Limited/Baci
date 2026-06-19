YYYY-MM-DD — Missing Error Check on Single Fetch
Learning: When calling `.single()` without destructuring and checking the `error` property from a Supabase query, genuine database failures (like connection issues or missing rows) fail silently and allow execution to continue using potentially undefined or null data, masking the failure and leading to corrupt state logic. Furthermore, `.single()` will throw a PostgREST error if no rows are found, which is dangerous if unhandled.
Action: Always destructure and check `error` (e.g., `const { data, error } = ...`) for every Supabase query. When 0 rows is a possibility, use `.maybeSingle()` instead of `.single()` to avoid unhandled exceptions, and then check `error`.
Source: @supabase/supabase-js v2 docs
