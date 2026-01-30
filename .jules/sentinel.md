## 2025-05-27 - Debug Endpoint Exposure
**Vulnerability:** An exposed debug endpoint (`/api/debug/supabase-check`) returned sensitive environment variables and configuration data (Supabase URL, merchant ID, credit direct keys) without authentication.
**Learning:** Debug endpoints created for temporary troubleshooting often get committed and forgotten, creating a significant security risk in production. The file explicitly said "DELETE THIS AFTER DEBUGGING" but remained.
**Prevention:** Enforce strict rules against committing debug endpoints. If needed, they must be behind a strong authentication (e.g., admin-only or dev-environment only checks). Use feature flags or ephemeral debugging tools instead.

## 2025-06-18 - Unused Validation Schema
**Vulnerability:** The product API contained a comprehensive Zod validation schema (`productSchema`) in `sanitize-core.ts` but the actual route handlers (`POST` and `PUT`) manually extracted fields without using this schema, leading to a Stored XSS vulnerability in the `description` field.
**Learning:** Having security tools (like Zod schemas) in the codebase doesn't mean they are being used. Manual field extraction bypasses centralized validation logic.
**Prevention:** Enforce usage of defined Zod schemas for all API inputs. Linting rules or code reviews should flag manual `req.body.field` access when a schema exists for that entity.
