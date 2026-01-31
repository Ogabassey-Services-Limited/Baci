## 2025-05-27 - Debug Endpoint Exposure
**Vulnerability:** An exposed debug endpoint (`/api/debug/supabase-check`) returned sensitive environment variables and configuration data (Supabase URL, merchant ID, credit direct keys) without authentication.
**Learning:** Debug endpoints created for temporary troubleshooting often get committed and forgotten, creating a significant security risk in production. The file explicitly said "DELETE THIS AFTER DEBUGGING" but remained.
**Prevention:** Enforce strict rules against committing debug endpoints. If needed, they must be behind a strong authentication (e.g., admin-only or dev-environment only checks). Use feature flags or ephemeral debugging tools instead.

## 2025-05-28 - Unauthenticated Cache Debug & Debug Directory
**Vulnerability:** Found an unauthenticated `GET /api/analytics/cache` exposing internal cache stats, and a committed `apps/web/src/app/api/debug` directory with a `merchant-lookup` endpoint.
**Learning:** Developers often add "utility" endpoints for debugging (checking cache size, looking up IDs) and forget to remove them or secure them. Even "safe" info like cache size hints at infrastructure details.
**Prevention:** Regularly scan for "debug" keywords in API routes. CI/CD checks should flag `api/debug` paths or files containing "for debugging" comments in production builds.
