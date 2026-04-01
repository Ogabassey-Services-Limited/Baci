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

## 2026-03-17 - Missing CSRF validation and Explicit Columns in Platform Settings API
**Vulnerability:** The `PUT /api/admin/settings` route lacked explicit CSRF protection, allowing cross-site request forgery attacks on platform settings. Also, the route over-fetched data using `select('*')`.
**Learning:** Administrative endpoints managing platform configurations are highly sensitive and require explicit CSRF protection to guard against unauthorized state changes.
**Prevention:** Always use the `checkCsrfProtection` utility at the beginning of `POST`, `PATCH`, `PUT`, and `DELETE` handlers, and use explicit column selection instead of `select('*')` to avoid over-fetching.

**Vulnerability:** The API route for updating platform settings (`PUT /api/admin/settings`) lacked CSRF protection. An attacker could forge requests to maliciously modify global platform configurations (fees, tracking IDs, feature flags) on behalf of an authenticated platform admin.
**Learning:** Administrative routes often contain authorization checks (e.g. `checkPlatformAdmin`), but these alone do not mitigate CSRF. The double submit cookie pattern must be actively enforced to prove request origin.
**Prevention:** Always use the `checkCsrfProtection` utility at the beginning of state-changing (`POST`, `PUT`, `PATCH`, `DELETE`) API routes, especially for highly privileged endpoints that alter global application state.

## 2026-03-21 - Missing CSRF validation in Dashboard Preferences API
**Vulnerability:** The `POST /api/dashboard/preferences` route lacked explicit CSRF protection, allowing cross-site request forgery attacks. An attacker could trick an authenticated merchant into silently changing their dashboard layout or visible cards, potentially hiding critical data.
**Learning:** Even seemingly benign user preference endpoints need CSRF protection, as malicious modifications to the UI layout could be used as part of a larger social engineering attack to hide crucial information (like unauthorized orders) from the merchant.
**Prevention:** Always use the `checkCsrfProtection` utility at the beginning of `POST`, `PATCH`, `PUT`, and `DELETE` handlers, even for endpoints that only modify UI preferences.

## 2025-05-24 - Missing Input Validation in API Routes
**Vulnerability:** Several API routes under `/api/discount-codes` were directly extracting properties from the JSON request body (e.g., `body.code`, `body.discount_type`) without applying strict structural or type validation. This could allow clients to send malformed data, unexpected types, or malicious payloads, bypassing application constraints and potentially leading to application errors or data integrity issues (like mass assignment).
**Learning:** Even internal API routes that are authenticated and protected by CSRF checks and permissions can be vulnerable if input data isn't validated properly. Relying on simple truthiness checks (`if (!body.code)`) is not enough to ensure the structural integrity of complex objects.
**Prevention:** Always define and use Zod schemas to explicitly validate and parse incoming request payloads before performing any business logic or database operations. Utilize `.safeParse(body)` on every API route to ensure unexpected fields are stripped, required fields exist with the correct type, and malformed requests return an explicit HTTP 400 Bad Request error.

## 2026-03-25 - Prevent Timing Attacks on Cron Authentication
**Vulnerability:** String equality (`!==`) was used to compare the `x-cron-secret` header against `process.env.CRON_SECRET` in multiple cron API routes, making them susceptible to timing attacks.
**Learning:** Basic string comparison operators short-circuit, potentially leaking the secret length or prefix over many requests.
**Prevention:** Use `crypto.timingSafeEqual` to perform constant-time comparison for authentication tokens and webhooks. Always ensure the lengths of the buffers match before comparing to prevent `timingSafeEqual` from throwing an error.


## 2026-03-25 - Add CSRF Protection to Customer Profile API
**Vulnerability:** The PATCH endpoint for updating customer profiles (`apps/web/src/app/api/storefront/customer/route.ts`) was missing CSRF validation, leaving the application vulnerable to cross-site request forgery attacks.
**Learning:** In the Baci monorepo, all authenticated, mutating API routes (POST, PUT, PATCH, DELETE) must explicitly call `checkCsrfProtection()` at the start of the handler.
**Prevention:** Ensure new API routes implement CSRF protection. Review existing routes periodically to ensure protection is consistently applied.

## 2024-03-28 - Timing Attack Vulnerability in AI Worker API Auth
**Vulnerability:** The `POST /api/ai-jobs/worker` route used a standard string comparison (`authHeader !== \`Bearer \${expectedToken}\``) to verify the authorization token. This allows a timing attack where an attacker could theoretically guess the secret token by observing the response time, as standard string comparison returns `false` as soon as it finds a mismatch.
**Learning:** Any API route that authenticates requests using a secret token (like webhooks or worker endpoints) must use constant-time comparison to prevent timing attacks.
**Prevention:** Always use `crypto.timingSafeEqual` from `node:crypto` to compare secret tokens. Ensure that both strings are converted to `Buffer` objects and that their lengths are checked first, because `timingSafeEqual` will throw an error if the buffers are of different lengths.

## 2026-03-25 - Prevent Timing Attacks on Blog Preview Authentication
**Vulnerability:** The API route for blog preview (`GET /api/blog/preview`) used strict equality (`!==`) to compare the provided `secret` query parameter against the blog preview secret. This exposes the endpoint to timing attacks, where an attacker could theoretically guess the secret by observing differences in response times.
**Learning:** Any endpoint that authenticates requests using a secret token or key must use constant-time comparison to prevent timing attacks. Simple string comparison operators short-circuit on the first mismatched character.
**Prevention:** Use `constantTimeEqual` from `@/lib/constant-time-equal` to perform constant-time comparison for authentication tokens, webhook signatures, and secrets.
