# Code Review Memory - Baci Project

## Common Review Patterns Found

### Security Issues
1. **Fail Closed Pattern**: Dev override gates should require secret exists AND matches (not treat missing as valid)
   - Changed: `!expectedSecret || match` → `expectedSecret && match`
   - File: `apps/web/src/app/api/merchant/blog/upload/route.ts`

2. **CSRF Protection**: Client-side POST requests need CSRF tokens
   - Import: `getClientCsrfToken` from `@/lib/csrf`
   - Add header: `x-csrf-token` with token value
   - File: `apps/web/src/components/blog/novel-features/image-upload.ts`

### Error Handling
1. **Promise Resolve + Throw**: Never resolve() then throw in same path
   - Causes: Promise resolves, then .catch fires unexpectedly
   - Fix: Remove throw after resolve for 401 fallback cases
   - File: `apps/web/src/components/blog/novel-features/image-upload.ts`

2. **Nested Ternaries**: Replace with lookup maps for readability
   - Pattern: Error message → status/response mapping
   - File: `apps/web/src/app/api/staff/accept-invite/route.ts`

### Data Validation
1. **NaN Safety**: Check `Number.isFinite()` before math operations
   - File: `apps/web/src/app/api/payments/webhook/route.ts`
   - Function: `getVerifiedAmount()`

2. **Case-Insensitive Comparison**: Use `.toUpperCase()` for currency codes
   - File: `apps/web/src/app/api/payments/webhook/route.ts`

3. **Null Guards**: Always guard link params that can be null
   - Pattern: `orderId ? <Link href={...orderId...} /> : null`
   - File: `apps/web/src/app/(storefront)/[slug]/order-success/page.tsx`

### Dead Code
1. **Redundant Ternaries**: Both branches same value
   - File: `apps/web/src/app/api/newsletter/subscribe/route.ts`
   - Fixed: Removed ternary, used single value

### Logging Best Practices
1. **Warn on Null Amounts**: Log when payment verification returns null
   - Helps debugging webhook issues
   - Files: `apps/web/src/app/api/payments/webhook/route.ts` (2 locations)

### Supabase Client Factory Pattern
1. **Server Factory Required**: Always use `@/lib/supabase/server` in API routes
   - Pattern: `const supabase = createClient(await cookies())`
   - Never: Direct `createClient` from `@supabase/supabase-js`
   - Files: `apps/web/src/app/api/payments/credit-direct/sign/route.ts`

2. **Unauthenticated Endpoints**: Add explanatory comment
   - Comment: "This is an unauthenticated endpoint for storefront checkout"
   - Still uses server factory with RLS-protected RPCs

### Type Safety & Runtime Validation
1. **No Unsafe Assertions**: Replace `as string` with runtime checks
   - Pattern: `if (typeof value !== 'string' || !value) return error`
   - File: `apps/web/src/app/api/payments/credit-direct/sign/route.ts` (merchant_id)

2. **Number Conversion Gotchas**:
   - `Number(null)` returns `0` (falsy but NOT NaN!)
   - `Number(undefined)` returns `NaN`
   - Fix: Check `value == null || Number.isNaN(num) || num <= 0`
   - Files: `apps/web/src/app/api/payments/{initialize,credit-direct/sign}/route.ts`

### Performance & Code Quality
1. **nanoid Uppercase**: Use `customAlphabet` instead of `.toUpperCase()`
   - Bad: `nanoid(12).toUpperCase()`
   - Good: `customAlphabet('ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789', 12)()`
   - File: `apps/web/src/app/api/payments/initialize/route.ts`

## Review Checklist Applied (2026-02-06)
- TypeScript strict mode: ✓ All fixes type-safe
- No `any` types: ✓ Removed unsafe assertions, added runtime checks
- Security: ✓ CSRF added, fail-closed pattern fixed, proper Supabase client
- Error handling: ✓ Promise logic corrected, lookup maps used
- Input validation: ✓ NaN checks, null/undefined guards, case-insensitive comparison
- Logging: ✓ Warnings added for null cases
- Supabase: ✓ Server factory pattern enforced
- Code quality: ✓ Efficient nanoid usage
