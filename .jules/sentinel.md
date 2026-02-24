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

## 2026-02-18 - User ID Spoofing in Storefront Order Creation

**Vulnerability:** The `POST /api/orders` endpoint and `create_storefront_order` RPC accepted `user_id` from the request body even for unauthenticated users. This allowed an attacker to create orders linked to arbitrary user accounts (by guessing or knowing their UUID), potentially polluting order history or enabling phishing attacks.

**Learning:** Publicly accessible RPCs (even if `SECURITY DEFINER`) must never blindly trust input parameters that link data to user accounts. Authentication context (`auth.uid()`) must always be the source of truth for user identification, not client input.

**Prevention:**
1. In API routes: Ignore sensitive fields like `user_id` from request bodies if the user is not authenticated.
2. In Database RPCs: Always derive `user_id` from `auth.uid()`. If unauthenticated, force `user_id` to NULL or reject the operation if authentication is required.
3. Use strict equality checks: `IF p_user_id IS NOT NULL AND p_user_id <> auth.uid() THEN RAISE EXCEPTION ...`

## 2026-02-20 - IP Spoofing in Rate Limiting

**Vulnerability:** The rate limiting logic relied on naive `x-forwarded-for` parsing, which allowed spoofed client IPs to be selected from attacker-controlled header values.

**Learning:** `X-Forwarded-For` can be manipulated by clients. Security-sensitive logic should prefer trusted platform-provided IP data and conservative header parsing fallbacks.

**Prevention:** For rate limiting and auditing, prioritize trusted request IP signals first, then fall back to validated proxy headers (`x-real-ip`, sanitized `x-forwarded-for`) instead of trusting arbitrary header order.

## 2026-02-21 - Path Traversal in File Deletion

**Vulnerability:** The `DELETE /api/media` endpoint constructed file paths by directly concatenating `merchantId` with a user-provided `id` parameter without validation. This allowed an attacker to use `../` sequences to traverse directories and potentially delete files outside their merchant's folder.

**Learning:** Relying on client-provided identifiers for file operations without strict validation is dangerous. Even if filenames seem harmless, they can be manipulated to access unauthorized resources.

**Prevention:**
1. Always validate file identifiers against a strict allowlist (e.g., alphanumeric only).
2. Explicitly reject path traversal sequences (`..`, `/`).
3. Use a safe filename generation strategy on upload and enforce it on deletion.
