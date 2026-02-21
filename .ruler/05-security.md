# Security

## Input & Output

- Sanitize user-generated content with `lib/sanitize*.ts`. Never use `dangerouslySetInnerHTML`.
- Validate all API inputs with Zod schemas before any database operation.
- CSRF tokens required for non-GET API requests.

## Secrets

- Service role key NEVER in client bundles — check `NEXT_PUBLIC_` variables.
- No API keys, passwords, or tokens in source code.
- Do not commit `.env*` files.

## Payments

- Webhook signature verification (HMAC-SHA256) for Korapay/Paystack/Kuda.
- Fail-closed pattern: reject if webhook secret is missing.
- Idempotent payment processing.
- Amount validated server-side — never trust client.

## Middleware (proxy.ts)

- Rate limiting on API routes.
- CSRF protection (token validation).
- Auth session refresh.
- Custom domain routing.
- Do NOT modify without explicit approval.

## Protected Files

Do not modify without explicit approval:
- `proxy.ts` — middleware
- `src/config/business-types.ts` — business type source of truth
- `supabase/migrations/*` — existing migration files
- `.env*` files
