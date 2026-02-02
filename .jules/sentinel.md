## 2025-05-27 - Debug Endpoint Exposure

**Vulnerability:** An exposed debug endpoint (`/api/debug/supabase-check`) returned sensitive environment variables and configuration data (Supabase URL, merchant ID, credit direct keys) without authentication.

**Learning:** Debug endpoints created for temporary troubleshooting often get committed and forgotten, creating a significant security risk in production. The file explicitly said "DELETE THIS AFTER DEBUGGING" but remained.

**Prevention:** Enforce strict rules against committing debug endpoints. If needed, they must be behind a strong authentication (e.g., admin-only or dev-environment only checks). Use feature flags or ephemeral debugging tools instead.

## 2026-01-30 - Stored XSS in Product API

**Vulnerability:** The product API endpoints (`POST /api/products` and `PUT /api/products/[id]`) accepted user input without proper sanitization. While a comprehensive Zod schema (`productSchema`) existed in `sanitize-core.ts`, the route handlers manually extracted fields from `request.json()` without using this schema, allowing malicious HTML/JavaScript in product fields (name, description, category, brand) to be stored in the database and potentially rendered to users.

**Learning:** Having validation schemas defined is not enough - they must be actively used in all route handlers. Manual field extraction bypasses validation transforms. Partial PUT updates can also wipe existing values if fields default to empty strings when undefined.

**Prevention:**
1. Use Zod `safeParse()` with transform functions at the entry point of every route handler
2. Create dedicated schemas in `src/schemas/` for each API resource
3. For PUT/PATCH routes, use conditional field updates (only include fields that are explicitly provided)
4. Add comprehensive XSS test suites that verify sanitization of all user-input fields
5. Use `sanitizeText()` for plain text fields and `sanitizeHtml()` for rich content
