## 2025-05-27 - Debug Endpoint Exposure
**Vulnerability:** An exposed debug endpoint (`/api/debug/supabase-check`) returned sensitive environment variables and configuration data (Supabase URL, merchant ID, credit direct keys) without authentication.
**Learning:** Debug endpoints created for temporary troubleshooting often get committed and forgotten, creating a significant security risk in production. The file explicitly said "DELETE THIS AFTER DEBUGGING" but remained.
**Prevention:** Enforce strict rules against committing debug endpoints. If needed, they must be behind a strong authentication (e.g., admin-only or dev-environment only checks). Use feature flags or ephemeral debugging tools instead.

## 2025-05-27 - Rate Limit Bypass via Path Parameters
**Vulnerability:** The in-memory rate limiter keyed limits off the full request `pathname` (e.g., `/api/products/123`), allowing attackers to bypass rate limits by varying path parameters (e.g., iterating IDs). This meant `/api/products` limits were not enforced across all resources under that path.
**Learning:** Rate limiting logic must group requests by the *policy bucket* or *pattern*, not the raw requested resource. Using `pathname` directly as a key is a common pitfall in custom rate limit implementations that handle dynamic routes.
**Prevention:** Ensure rate limit keys are derived from the matched configuration or normalized path pattern, ensuring all variations of a dynamic route share the same token bucket.
