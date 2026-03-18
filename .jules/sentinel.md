# Sentinel Changelog

## 2026-03-09 - Missing tenant scoping in Admin Image Generation API

**Vulnerability:** The API route for generating product images (`POST /api/admin/generate-product-images`) lacked explicit `merchant_id` scoping when querying and updating products. Although it verified the user was a platform admin, omitting the tenant scope meant the query could inadvertently fetch or modify products belonging to other merchants in the multi-tenant database.
**Learning:** Even administrative endpoints that enforce strict Role-Based Access Control (RBAC) must adhere to defense-in-depth principles. In a multi-tenant system, relying solely on user roles or implicit RLS logic is risky. Every query and mutation interacting with tenant-specific data must explicitly include the tenant ID to prevent cross-tenant data leaks or corruption.
**Prevention:** Always explicitly chain `.eq('merchant_id', merchantId)` on all Supabase database queries and mutations (e.g., `.select()`, `.update()`, `.insert()`, `.delete()`), regardless of the user's role or the presumed safety of the endpoint.

## 2026-03-09 - Missing CSRF validation in Discount Codes API

**Vulnerability:** The API routes for managing discount codes (`POST /api/discount-codes`, `PATCH /api/discount-codes/[id]`, `DELETE /api/discount-codes/[id]`) did not have CSRF protection. This could allow an attacker to forge requests from a malicious site on behalf of an authenticated merchant to create, update, or delete discount codes.
**Learning:** Even though routes check for proper authorization via Supabase `getUser()` and check user roles, they still require explicit CSRF protection to prevent cross-site request forgery attacks.
**Prevention:** Always use the `checkCsrfProtection` utility at the beginning of `POST`, `PATCH`, `PUT`, and `DELETE` API handlers, especially those handling sensitive merchant or customer data.

## 2024-03-24 - IDOR in Mobile Admin Blog Deletion
**Vulnerability:** Insecure Direct Object Reference (IDOR) during blog post deletion in `apps/mobile-admin/app/(admin)/blog/[id].tsx`. The `.delete()` query lacked an authorization check (`.eq('merchant_id', merchant.id)`), allowing any authenticated user to delete any blog post by ID. Furthermore, the Supabase response's `error` property was completely ignored, leading to silent failures when issues (like RLS blocking the operation) occurred.
**Learning:** Database mutations in the Baci monorepo must strictly adhere to a defense-in-depth model for tenant isolation. Relying solely on RLS policies or frontend UI obfuscation is insufficient; every backend operation must explicitly scope the query to the authenticated `merchant_id`. Additionally, neglecting to check the `.error` object returned from Supabase mutations creates critical "fail open" or silent failure states, masking underlying problems and preventing secure error handling.
**Prevention:** Always explicitly chain `.eq('merchant_id', merchant.id)` on all database queries and mutations (e.g., `.delete()`, `.update()`, `.select()`). Always extract and check the `{ error }` property from the returned Supabase promise. If an error exists, throw it to be handled safely by a `try...catch` block, ensuring the UI alerts the user securely without leaking implementation details.

## 2026-03-09 - Missing CSRF validation in Loyalty API Routes

**Vulnerability:** The API routes for managing loyalty points, settings, and rewards (`POST /api/loyalty/points`, `POST /api/loyalty/settings`, `POST /api/loyalty/rewards`, `PATCH /api/loyalty/rewards/[id]`, `DELETE /api/loyalty/rewards/[id]`) did not have CSRF protection. This could allow an attacker to forge requests from a malicious site on behalf of an authenticated admin to arbitrarily modify loyalty settings, issue points, or create/delete rewards.
**Learning:** Checking for user authorization and role (e.g., `hasPermission`) ensures the user has rights, but it does not verify the *intent* of the request or its origin. Explicit CSRF protection is strictly required for all state-changing endpoints, even administrative ones.
**Prevention:** Always use the `checkCsrfProtection` utility at the beginning of `POST`, `PATCH`, `PUT`, and `DELETE` API handlers to ensure defense against cross-site request forgery attacks.

## 2026-03-15 - Missing CSRF validation on POST API routes

**Vulnerability:** Several state-changing API routes (e.g. `POST /api/products/bulk-publish`, `POST /api/admin/generate-hero-images`) were missing CSRF protection, leaving them open to cross-site request forgery attacks.
**Learning:** In the Baci monorepo, all mutating API endpoints (POST, PUT, PATCH, DELETE) must explicitly call `checkCsrfProtection` from `@/lib/csrf` before proceeding with any action.
**Prevention:** Always verify that newly created state-changing API routes include the CSRF check as their very first action.
