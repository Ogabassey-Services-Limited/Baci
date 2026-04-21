# Security Changelog

## 2026-03-08 - Fix Timing Attack in Blog Upload Authentication

**Vulnerability:** The `devOverrideSecret` was being compared to `expectedSecret` using strict equality (`===`). This exposed the endpoint to a timing attack where an attacker could theoretically guess the secret character by character.

**Learning:** Even internal or development-only endpoints should use secure comparison functions for secrets to establish defense-in-depth and prevent accidental leakage if the code is later reused in production contexts.

**Prevention:** Always use `constantTimeEqual` or `crypto.timingSafeEqual` when comparing passwords, tokens, API keys, or webhooks signatures. Ensure variables are checked for truthiness before passing to avoid runtime type errors.

## 2026-03-08 - Fix Incorrect Supabase Client in MyCover Webhook
**Vulnerability:** The MyCover webhook handler used `createAdminClient` instead of `createServiceClient`. `createAdminClient` uses the `anon` key, which respects RLS policies, making it unsuitable for webhook handlers that run without a user context and need to bypass RLS.
**Learning:** Webhook handlers must always use the service role client (`createServiceClient`) to bypass RLS since they operate outside of an authenticated user session.
**Prevention:** Ensure all new webhook handlers import and use `createServiceClient` from `@/lib/supabase/service`.

## 2026-04-06 - Timing Attack Vulnerability in Webhook Signature Verification
**Vulnerability:** A strict equality operator (`===`) was used to compare webhook signature checksums in the Juicyway integration (`apps/web/src/lib/juicyway/webhook.ts`), allowing potential timing attacks to forge signatures.
**Learning:** Even when the developer correctly adds a comment stating `// Constant-time comparison to prevent timing attacks`, the actual implementation might simply use strict string equality (`===`).
**Prevention:** Always use the `constantTimeEqual` utility from `@/lib/constant-time-equal` for comparing authentication tokens, hashes, and webhook signatures. Ensure explicitly checking that both inputs are defined before calling the utility.

## 2026-04-21 - Fix Missing Input Validation in API Routes
**Vulnerability:** The cart validation endpoint `POST /api/cart/validate` was trusting client input via `body as { ... }` instead of properly validating the shape and types of the request body. While there was a regex check for UUIDs later in the code, the lack of top-level schema validation exposes the system to potential unexpected runtime errors or injection of malformed data structures.
**Learning:** Type assertions (using `as Type`) only instruct TypeScript to assume a type during compilation; they provide zero runtime protection.
**Prevention:** Always use Zod schemas (e.g., `cartValidateSchema.safeParse(body)`) to validate incoming request bodies on API routes before processing them. Return a `400 Bad Request` explicitly if validation fails.
