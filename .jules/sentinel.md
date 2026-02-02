## 2025-05-27 - Debug Endpoint Exposure
**Vulnerability:** An exposed debug endpoint (`/api/debug/supabase-check`) returned sensitive environment variables and configuration data (Supabase URL, merchant ID, credit direct keys) without authentication.
**Learning:** Debug endpoints created for temporary troubleshooting often get committed and forgotten, creating a significant security risk in production. The file explicitly said "DELETE THIS AFTER DEBUGGING" but remained.
**Prevention:** Enforce strict rules against committing debug endpoints. If needed, they must be behind a strong authentication (e.g., admin-only or dev-environment only checks). Use feature flags or ephemeral debugging tools instead.

## 2025-05-30 - Implicit Rate Limit Defaults
**Vulnerability:** Sensitive financial endpoints (`/api/wallet`) were not explicitly defined in the rate limiting configuration, causing them to fall back to a generous default limit (50 req/min) instead of a strict one (5 req/min).
**Learning:** Default-deny or default-strict is better than default-allow. When new endpoints are added, they often inherit default security policies which may be insufficient for their sensitivity level.
**Prevention:** Use a default-strict policy for all API routes (e.g. 10/min) and relax it only for specific high-volume endpoints. Alternatively, enforce a lint rule or test that ensures every sensitive endpoint has an explicit rate limit configuration.
