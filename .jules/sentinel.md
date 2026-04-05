# Security Changelog

## 2026-03-08 - Fix Timing Attack in Blog Upload Authentication

**Vulnerability:** The `devOverrideSecret` was being compared to `expectedSecret` using strict equality (`===`). This exposed the endpoint to a timing attack where an attacker could theoretically guess the secret character by character.

**Learning:** Even internal or development-only endpoints should use secure comparison functions for secrets to establish defense-in-depth and prevent accidental leakage if the code is later reused in production contexts.

**Prevention:** Always use `constantTimeEqual` or `crypto.timingSafeEqual` when comparing passwords, tokens, API keys, or webhooks signatures. Ensure variables are checked for truthiness before passing to avoid runtime type errors.

## 2026-03-08 - Fix Incorrect Supabase Client in MyCover Webhook
**Vulnerability:** The MyCover webhook handler used `createAdminClient` instead of `createServiceClient`. `createAdminClient` uses the `anon` key, which respects RLS policies, making it unsuitable for webhook handlers that run without a user context and need to bypass RLS.
**Learning:** Webhook handlers must always use the service role client (`createServiceClient`) to bypass RLS since they operate outside of an authenticated user session.
**Prevention:** Ensure all new webhook handlers import and use `createServiceClient` from `@/lib/supabase/service`.
