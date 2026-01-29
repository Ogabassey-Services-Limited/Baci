## 2025-05-27 - Debug Endpoint Exposure
**Vulnerability:** An exposed debug endpoint (`/api/debug/supabase-check`) returned sensitive environment variables and configuration data (Supabase URL, merchant ID, credit direct keys) without authentication.
**Learning:** Debug endpoints created for temporary troubleshooting often get committed and forgotten, creating a significant security risk in production. The file explicitly said "DELETE THIS AFTER DEBUGGING" but remained.
**Prevention:** Enforce strict rules against committing debug endpoints. If needed, they must be behind a strong authentication (e.g., admin-only or dev-environment only checks). Use feature flags or ephemeral debugging tools instead.

## 2026-10-18 - PostgREST Filter Injection in Search
**Vulnerability:** The `sanitizeSearchQuery` function did not strip PostgREST control characters (`,`, `(`, `)`, `|`). When used in `.or()` filters, this allowed users to inject arbitrary filter conditions (e.g. `foo,sku.eq.bar`).
**Learning:** Sanitization must account for the specific syntax of the downstream query engine (PostgREST), not just generic SQL injection. Commas are semantic separators in PostgREST URL parameters.
**Prevention:** Whitelist allowed characters or blacklist specific control characters relevant to the DB interface. Added specific tests for PostgREST syntax characters.
