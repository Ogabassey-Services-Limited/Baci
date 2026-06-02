# Security Enhancements Implementation Guide

This document describes the security improvements implemented in the Baci ecommerce platform.

## Overview

The following security enhancements have been implemented:

1. **Atomic Stock Updates** - Prevents race conditions in inventory management
2. **Rate Limiting** - Protects against API abuse and DDoS attacks
3. **CSRF Protection** - Prevents Cross-Site Request Forgery attacks
4. **Input Sanitization** - Prevents XSS, SQL injection, and other injection attacks

---

## 1. Atomic Stock Updates

### Problem
The original implementation had a race condition where two simultaneous orders could oversell inventory:
```typescript
// UNSAFE: Read then write (race condition)
const product = await db.select('stock');
const newStock = product.stock - quantity;
await db.update({ stock: newStock });
```

### Solution
Implemented PostgreSQL stored procedures with row-level locking:

**Database Function** (`supabase/migrations/20251122_add_security_functions.sql`):
```sql
CREATE OR REPLACE FUNCTION decrement_product_stock(
  product_id_param UUID,
  quantity_param INTEGER
)
RETURNS TABLE(success BOOLEAN, new_stock INTEGER, message TEXT)
```

**Usage** (`src/app/api/orders/route.ts`):
```typescript
const { data: result } = await supabase.rpc('decrement_product_stock', {
  product_id_param: item.product_id,
  quantity_param: item.quantity,
});

if (result[0].success) {
  // Stock updated successfully
} else {
  // Handle insufficient stock
}
```

### Benefits
- ✅ Thread-safe inventory updates
- ✅ Prevents overselling
- ✅ Atomic operations with `FOR UPDATE` locking
- ✅ Returns clear success/failure status

---

## 2. Rate Limiting

### Implementation
**Middleware** (`src/lib/rate-limit.ts`):
- Token bucket algorithm
- Configurable limits per endpoint
- In-memory storage (use Redis in production)

**Configuration**:
```typescript
const RATE_LIMITS = {
  '/api/orders': { maxRequests: 10, windowMs: 60000 },
  '/api/products': { maxRequests: 30, windowMs: 60000 },
  '/api/storefront': { maxRequests: 100, windowMs: 60000 },
  default: { maxRequests: 50, windowMs: 60000 },
};
```

**Middleware Integration** (`middleware.ts`):
```typescript
if (pathname.startsWith('/api/')) {
  const rateLimitResult = checkRateLimit(request);
  
  if (!rateLimitResult.allowed) {
    return createRateLimitResponse(...);
  }
}
```

### Response Headers
```
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 95
X-RateLimit-Reset: 2025-11-22T09:00:00Z
Retry-After: 45
```

### Benefits
- ✅ Prevents API abuse
- ✅ Protects against DDoS attacks
- ✅ Per-endpoint configuration
- ✅ Standard HTTP headers

---

## 3. CSRF Protection

### Implementation
**Double Submit Cookie Pattern** (`src/lib/csrf.ts`):
1. Server generates token + secret pair
2. Token stored in regular cookie (accessible to JS)
3. Secret stored in httpOnly cookie
4. Client sends token in `x-csrf-token` header
5. Server verifies token matches and validates HMAC

**Middleware Integration** (`middleware.ts`):
```typescript
if (pathname.startsWith('/api/')) {
  const csrfResult = await checkCsrfProtection(request);
  
  if (!csrfResult.valid) {
    return csrfResult.response; // 403 Forbidden
  }
}
```

**Client Usage** (`src/lib/api-client.ts`):
```typescript
import { apiPost } from '@/lib/api-client';

// Automatically includes CSRF token
await apiPost('/api/orders', orderData);
```

### Benefits
- ✅ Prevents CSRF attacks
- ✅ Automatic token management
- ✅ HMAC verification for extra security
- ✅ Easy client-side integration

---

## 4. Input Sanitization

### Implementation
**Sanitization Library** (`src/lib/sanitize.ts`):

**Functions**:
- `sanitizeText()` - Remove HTML, trim, limit length
- `sanitizeHtml()` - Allow safe HTML tags only
- `sanitizeEmail()` - Lowercase and trim
- `sanitizePhone()` - Remove non-numeric chars
- `sanitizeUrl()` - Validate and sanitize URLs
- `sanitizeSearchQuery()` - Prevent SQL injection
- `sanitizeLikePattern()` - Escape SQL LIKE wildcards

**Zod Schemas**:
```typescript
export const customerSchema = z.object({
  firstName: z.string().min(1).max(100).transform((val) => sanitizeText(val)),
  email: z.email().transform((val) => sanitizeEmail(val)),
  // ...
});
```

**Usage in API Routes**:
```typescript
import { sanitizeSearchQuery, sanitizeLikePattern } from '@/lib/sanitize';

const search = sanitizeSearchQuery(searchRaw);
const pattern = sanitizeLikePattern(search);
query = query.or(`customer_name.ilike.%${pattern}%`);
```

### Benefits
- ✅ Prevents XSS attacks
- ✅ Prevents SQL injection
- ✅ Prevents prototype pollution
- ✅ Type-safe with Zod
- ✅ Reusable schemas

---

## Setup Instructions

### 1. Run Database Migration

```bash
# Apply the security functions to your Supabase database
psql -h your-db-host -U postgres -d postgres -f supabase/migrations/20251122_add_security_functions.sql
```

Or use Supabase CLI:
```bash
supabase db push
```

### 2. Install Dependencies

```bash
npm install isomorphic-dompurify
```

### 3. Update API Calls

Replace all `fetch()` calls with the new API client:

**Before**:
```typescript
const response = await fetch('/api/orders', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(data),
});
```

**After**:
```typescript
import { apiPost } from '@/lib/api-client';

const result = await apiPost('/api/orders', data);
```

### 4. Initialize CSRF Tokens

Add CSRF token initialization to your layout:

```typescript
// app/layout.tsx
import { setCsrfToken } from '@/lib/csrf';

export default async function RootLayout({ children }) {
  await setCsrfToken(); // Initialize CSRF token
  
  return (
    <html>
      <body>{children}</body>
    </html>
  );
}
```

---

## Testing

### Test Rate Limiting
```bash
# Send 101 requests in 1 minute (should get rate limited)
for i in {1..101}; do
  curl http://localhost:3000/api/products
done
```

### Test CSRF Protection
```bash
# Without CSRF token (should fail)
curl -X POST http://localhost:3000/api/orders \
  -H "Content-Type: application/json" \
  -d '{"merchant_id":"...","items":[]}'

# Response: 403 Forbidden
```

### Test Input Sanitization
```bash
# Try SQL injection (should be sanitized)
curl "http://localhost:3000/api/orders?search='; DROP TABLE orders; --"

# Try XSS (should be sanitized)
curl -X POST http://localhost:3000/api/orders \
  -d '{"customer_name":"<script>alert(1)</script>"}'
```

### Test Atomic Stock Updates
```bash
# Run two simultaneous orders for the same product
# Only one should succeed if stock is insufficient
```

---

## Production Recommendations

### 1. Use Redis for Rate Limiting
Replace in-memory storage with Redis:

```typescript
import Redis from 'ioredis';

const redis = new Redis(process.env.REDIS_URL);

export async function checkRateLimit(request: NextRequest) {
  const key = `ratelimit:${identifier}:${endpoint}`;
  const count = await redis.incr(key);
  
  if (count === 1) {
    await redis.expire(key, windowSeconds);
  }
  
  return count <= maxRequests;
}
```

### 2. Add Logging and Monitoring
```typescript
// Log rate limit violations
if (!rateLimitResult.allowed) {
  console.warn('Rate limit exceeded', {
    ip: getClientIdentifier(request),
    endpoint: pathname,
    timestamp: new Date().toISOString(),
  });
}
```

### 3. Add Security Headers
```typescript
// middleware.ts
response.headers.set('X-Content-Type-Options', 'nosniff');
response.headers.set('X-Frame-Options', 'DENY');
response.headers.set('X-XSS-Protection', '1; mode=block');
response.headers.set('Strict-Transport-Security', 'max-age=31536000');
```

### 4. Enable CORS Properly
```typescript
// Only allow your domains
response.headers.set('Access-Control-Allow-Origin', 'https://yourdomain.com');
response.headers.set('Access-Control-Allow-Credentials', 'true');
```

---

## Security Checklist

- [x] Atomic stock updates implemented
- [x] Rate limiting on all API routes
- [x] CSRF protection for state-changing requests
- [x] Input sanitization on all user inputs
- [x] SQL injection prevention
- [x] XSS prevention
- [x] UUID validation
- [x] Email validation
- [ ] Add HTTPS in production
- [ ] Add security headers
- [ ] Implement Redis for rate limiting
- [ ] Add request logging
- [ ] Set up monitoring/alerts
- [ ] Regular security audits
- [ ] Dependency vulnerability scanning

---

## Files Modified/Created

### New Files
- `supabase/migrations/20251122_add_security_functions.sql` - Database functions
- `src/lib/rate-limit.ts` - Rate limiting middleware
- `src/lib/csrf.ts` - CSRF protection utilities
- `src/lib/sanitize.ts` - Input sanitization functions
- `src/lib/api-client.ts` - Client-side API helpers
- `SECURITY.md` - This documentation

### Modified Files
- `middleware.ts` - Added rate limiting and CSRF checks
- `src/app/api/orders/route.ts` - Added atomic stock updates and sanitization

---

## Support

For questions or issues:
1. Check the code comments in each security module
2. Review the test cases
3. Consult the Supabase documentation for RPC functions
4. Review OWASP security guidelines

---

**Last Updated**: 2025-11-22  
**Version**: 1.0.0
