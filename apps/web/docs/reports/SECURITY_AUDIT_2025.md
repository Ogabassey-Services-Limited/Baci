# Security Audit Report - Baci E-Commerce Platform

**Audit Date:** November 26, 2025
**Auditor:** Claude (Security Analysis)
**Application:** Baci - AI-powered SaaS E-Commerce Platform
**Tech Stack:** Next.js 16, TypeScript, Supabase, Korapay, Google Gemini AI

---

## Executive Summary

This security audit was conducted following 2025 best practices, including OWASP Top 10 2021, NIST guidelines, and modern web application security standards. The Baci platform demonstrates good security foundations but has several areas requiring immediate attention.

### Risk Rating Summary

| Category | Critical | High | Medium | Low | Info |
|----------|----------|------|--------|-----|------|
| **Total Issues** | 2 | 4 | 6 | 5 | 4 |

---

## Critical Findings

### 1. SQL Injection via Unsanitized Search Parameters
**Severity:** CRITICAL
**CVSS Score:** 9.8
**Location:**
- `src/app/api/customers/route.ts:37`
- `src/app/api/products/route.ts:68`

**Description:**
User-supplied search parameters are interpolated directly into Supabase `ilike` queries without sanitization.

**Vulnerable Code:**
```typescript
// src/app/api/customers/route.ts:37
query = query.or(`first_name.ilike.%${search}%,last_name.ilike.%${search}%,email.ilike.%${search}%,phone.ilike.%${search}%`);

// src/app/api/products/route.ts:68
query = query.or(`name.ilike.%${search}%,sku.ilike.%${search}%`);
```

**Comparison - Secure Implementation (already exists in orders route):**
```typescript
// src/app/api/orders/route.ts:118-139 - CORRECT
const search = searchRaw ? sanitizeSearchQuery(searchRaw) : null;
const sanitizedPattern = sanitizeLikePattern(search);
query = query.or(`customer_name.ilike.%${sanitizedPattern}%,...`);
```

**Recommendation:**
Apply the same sanitization pattern used in the orders route:
```typescript
import { sanitizeSearchQuery, sanitizeLikePattern } from '@/lib/sanitize';

const searchRaw = searchParams.get('search');
const search = searchRaw ? sanitizeSearchQuery(searchRaw) : null;
if (search) {
    const sanitizedPattern = sanitizeLikePattern(search);
    query = query.or(`first_name.ilike.%${sanitizedPattern}%,...`);
}
```

---

### 2. Payment Webhook Missing Signature Verification
**Severity:** CRITICAL
**CVSS Score:** 9.1
**Location:** `src/app/api/payments/webhook/route.ts`

**Description:**
The payment webhook endpoint does not verify the cryptographic signature from Korapay. This allows attackers to forge webhook requests and potentially mark fraudulent payments as successful.

**Current Implementation:**
```typescript
export async function POST(request: NextRequest) {
    const body = await request.json();
    const { reference, status, event } = body;
    // No signature verification!
    // ...proceeds to process payment
}
```

**Recommendation:**
Implement HMAC signature verification:
```typescript
export async function POST(request: NextRequest) {
    const signature = request.headers.get('x-korapay-signature');
    const body = await request.text();

    // Verify signature
    const expectedSignature = crypto
        .createHmac('sha512', process.env.KORAPAY_SECRET_KEY!)
        .update(body)
        .digest('hex');

    if (signature !== expectedSignature) {
        logger.warn({ message: 'Invalid webhook signature' });
        return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
    }

    const data = JSON.parse(body);
    // ... proceed with verified data
}
```

---

## High Severity Findings

### 3. Missing Security Headers
**Severity:** HIGH
**Location:** `next.config.ts`

**Description:**
The Next.js configuration lacks essential security headers that protect against common web attacks.

**Missing Headers:**
- `Content-Security-Policy` (XSS protection)
- `X-Frame-Options` (Clickjacking protection)
- `X-Content-Type-Options` (MIME sniffing protection)
- `Strict-Transport-Security` (HTTPS enforcement)
- `Permissions-Policy` (Feature restrictions)

**Recommendation:**
Add to `next.config.ts`:
```typescript
const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          {
            key: 'Content-Security-Policy',
            value: "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; font-src 'self' https://fonts.gstatic.com; connect-src 'self' https://*.supabase.co https://api.korapay.com;",
          },
          {
            key: 'X-Frame-Options',
            value: 'DENY',
          },
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
          {
            key: 'Strict-Transport-Security',
            value: 'max-age=31536000; includeSubDomains',
          },
          {
            key: 'Permissions-Policy',
            value: 'camera=(), microphone=(), geolocation=()',
          },
          {
            key: 'Referrer-Policy',
            value: 'strict-origin-when-cross-origin',
          },
        ],
      },
    ];
  },
  // ... rest of config
};
```

---

### 4. In-Memory Rate Limiting (Not Production-Ready)
**Severity:** HIGH
**Location:** `src/lib/rate-limit.ts:22`

**Description:**
Rate limiting uses an in-memory Map which:
- Resets on server restart
- Not shared across serverless function instances
- Allows bypass in distributed deployments (Vercel)

**Current Implementation:**
```typescript
// Line 22 - NOT production ready
const rateLimitStore = new Map<string, { count: number; resetTime: number }>();
```

**Recommendation:**
Implement Redis-based rate limiting or use Vercel's Edge Config:
```typescript
import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';

const ratelimit = new Ratelimit({
  redis: Redis.fromEnv(),
  limiter: Ratelimit.slidingWindow(10, '1m'),
});

export async function checkRateLimit(request: NextRequest) {
    const ip = getClientIdentifier(request);
    const { success, remaining, reset } = await ratelimit.limit(ip);
    return { allowed: success, remaining, resetTime: reset };
}
```

---

### 5. Mass Assignment Vulnerability in Customer Creation
**Severity:** HIGH
**Location:** `src/app/api/customers/route.ts:74-81`

**Description:**
The customer POST endpoint accepts arbitrary fields from the request body without validation, allowing attackers to set internal fields.

**Vulnerable Code:**
```typescript
const { data: customer, error } = await supabase
    .from('customers')
    .insert({
        ...body,  // Spreads ALL user input!
        merchant_id: merchant.id,
    })
```

**Recommendation:**
Explicitly whitelist allowed fields:
```typescript
const { first_name, last_name, email, phone, address, city, state } = body;

const { data: customer, error } = await supabase
    .from('customers')
    .insert({
        first_name: sanitizeText(first_name),
        last_name: sanitizeText(last_name),
        email: sanitizeEmail(email),
        phone: sanitizePhone(phone),
        address: sanitizeText(address),
        city: sanitizeText(city),
        state: sanitizeText(state),
        merchant_id: merchant.id,
    })
```

---

### 6. TypeScript Build Errors Ignored
**Severity:** HIGH
**Location:** `next.config.ts:8-10`

**Description:**
TypeScript build errors are ignored, which could hide type safety issues that mask security vulnerabilities.

```typescript
typescript: {
    ignoreBuildErrors: true,  // DANGEROUS
},
```

**Recommendation:**
Remove this setting and fix all TypeScript errors. Type safety helps prevent injection vulnerabilities and ensures proper data handling.

---

## Medium Severity Findings

### 7. AI Prompt Injection Vulnerability
**Severity:** MEDIUM
**Location:** `src/ai/flows/generate-product-descriptions.ts:30-38`

**Description:**
User-supplied product names and keywords are interpolated directly into AI prompts without sanitization, allowing potential prompt injection attacks.

**Vulnerable Code:**
```typescript
const prompt = `
You are an expert copywriter...
Product Name: ${productName}  // Unsanitized user input
${keywords?.length ? `Keywords: ${keywords.join(', ')}` : ''}
...`;
```

**Recommendation:**
Sanitize and validate AI inputs:
```typescript
const sanitizedProductName = sanitizeText(productName, 200);
const sanitizedKeywords = keywords?.map(k => sanitizeText(k, 50)).slice(0, 10);

const prompt = `
...
Product Name: ${sanitizedProductName}
${sanitizedKeywords?.length ? `Keywords: ${sanitizedKeywords.join(', ')}` : ''}
...`;
```

---

### 8. File Upload Type Validation Insufficient
**Severity:** MEDIUM
**Location:** `src/app/api/media/route.ts:117-118`

**Description:**
File type validation relies only on the `Content-Type` header which can be spoofed.

**Current Implementation:**
```typescript
if (!file.type.startsWith('image/')) {
    return NextResponse.json({ error: 'Only images are allowed' }, { status: 400 });
}
```

**Recommendation:**
Validate file magic bytes:
```typescript
import FileType from 'file-type';

const arrayBuffer = await file.arrayBuffer();
const buffer = Buffer.from(arrayBuffer);
const fileType = await FileType.fromBuffer(buffer);

const allowedMimeTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
if (!fileType || !allowedMimeTypes.includes(fileType.mime)) {
    return NextResponse.json({ error: 'Invalid file type' }, { status: 400 });
}
```

---

### 9. Missing File Size Limit
**Severity:** MEDIUM
**Location:** `src/app/api/media/route.ts`

**Description:**
No explicit file size limit is enforced at the application layer, potentially allowing large file uploads that could exhaust resources.

**Recommendation:**
Add file size validation:
```typescript
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

if (file.size > MAX_FILE_SIZE) {
    return NextResponse.json(
        { error: `File too large. Maximum size is ${MAX_FILE_SIZE / 1024 / 1024}MB` },
        { status: 400 }
    );
}
```

---

### 10. CSRF Token Cookie Missing HttpOnly for Secret
**Severity:** MEDIUM
**Location:** `src/lib/csrf.ts:64-80`

**Description:**
While the CSRF secret is stored as HttpOnly, the implementation could be strengthened by adding additional cookie attributes.

**Recommendation:**
Add additional cookie security:
```typescript
cookieStore.set(CSRF_SECRET_NAME, secret, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',  // Changed from 'lax' to 'strict'
    path: '/',
    maxAge: 60 * 60 * 24,
    // Add domain restriction in production
    ...(process.env.NODE_ENV === 'production' && {
        domain: process.env.COOKIE_DOMAIN,
    }),
});
```

---

### 11. Verbose Error Messages in Production
**Severity:** MEDIUM
**Locations:** Multiple API routes

**Description:**
Error details are exposed in API responses which could leak implementation details.

**Example:**
```typescript
return NextResponse.json({
    error: 'Failed to initialize payment',
    details: error instanceof Error ? error.message : 'Unknown error',  // Leaks details
}, { status: 500 });
```

**Recommendation:**
Implement environment-aware error handling:
```typescript
const isProduction = process.env.NODE_ENV === 'production';

return NextResponse.json({
    error: 'Failed to initialize payment',
    ...(isProduction ? {} : { details: error.message }),
    reference: generateErrorReference(), // For support tickets
}, { status: 500 });
```

---

### 12. React Strict Mode Disabled
**Severity:** MEDIUM
**Location:** `next.config.ts:11`

**Description:**
React Strict Mode is disabled, which hides potential issues in development.

```typescript
reactStrictMode: false,
```

**Recommendation:**
Enable React Strict Mode and fix any warnings:
```typescript
reactStrictMode: true,
```

---

## Low Severity Findings

### 13. Logger May Log Sensitive Data
**Severity:** LOW
**Location:** `src/lib/logger.ts`

**Description:**
The logger accepts arbitrary payloads which could inadvertently log sensitive data like API keys, passwords, or PII.

**Recommendation:**
Implement a sanitization layer:
```typescript
const SENSITIVE_KEYS = ['password', 'api_key', 'secret', 'token', 'authorization'];

function sanitizeLogPayload(payload: LogPayload): LogPayload {
    const sanitized = { ...payload };
    for (const key of Object.keys(sanitized)) {
        if (SENSITIVE_KEYS.some(sk => key.toLowerCase().includes(sk))) {
            sanitized[key] = '[REDACTED]';
        }
    }
    return sanitized;
}
```

---

### 14. Missing Input Length Limits on Some Endpoints
**Severity:** LOW
**Locations:** Various form submission endpoints

**Description:**
Some endpoints don't enforce maximum input lengths, which could lead to storage exhaustion or performance issues.

**Recommendation:**
Use Zod schemas for all inputs with max length validation.

---

### 15. Environment Variable Validation Incomplete
**Severity:** LOW
**Location:** `src/env.ts`

**Description:**
Only Supabase environment variables are validated. Other critical keys (Korapay, Brevo, Gemini) may silently fail.

**Recommendation:**
Expand environment validation:
```typescript
export function validateEnvironment() {
    const required = [
        'NEXT_PUBLIC_SUPABASE_URL',
        'NEXT_PUBLIC_SUPABASE_ANON_KEY',
        'KORAPAY_SECRET_KEY',
        'KORAPAY_PUBLIC_KEY',
        'BREVO_API_KEY',
    ];

    const missing = required.filter(key => !process.env[key]);
    if (missing.length > 0) {
        throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
    }
}
```

---

### 16. CORS Not Explicitly Configured
**Severity:** LOW
**Location:** Middleware/API routes

**Description:**
While Next.js has default CORS behavior, explicit CORS configuration would provide better control.

**Recommendation:**
Add explicit CORS headers for API routes:
```typescript
const corsHeaders = {
    'Access-Control-Allow-Origin': process.env.ALLOWED_ORIGINS || '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-CSRF-Token',
};
```

---

### 17. Session Refresh Timing
**Severity:** LOW
**Location:** `middleware.ts:85`

**Description:**
Session refresh happens on every request which could expose timing information.

**Recommendation:**
Consider implementing session refresh only when approaching expiration.

---

## Informational Findings

### 18. Good Security Practices Observed

The codebase demonstrates several security best practices:

1. **Row-Level Security (RLS):** Well-implemented RLS policies in Supabase migrations
2. **CSRF Protection:** Double-submit cookie pattern with HMAC
3. **Input Sanitization Library:** Comprehensive `src/lib/sanitize.ts`
4. **UUID Validation:** Proper validation for entity IDs
5. **Atomic Database Operations:** Stock updates use RPC functions to prevent race conditions
6. **Security Definer Functions:** Properly configured with `SET search_path = public`
7. **Secure Materialized Views:** Access revoked and secure views created

---

### 19. Security Configuration Checklist

The following should be verified in Supabase Dashboard:
- [ ] Enable "Leaked Password Protection"
- [ ] Configure password strength requirements
- [ ] Review and audit RLS policies
- [ ] Enable audit logging

---

### 20. Compliance Considerations

For PCI DSS compliance (handling payments):
- Ensure no card data is logged
- Implement access controls for payment data
- Regular security assessments

For GDPR/data protection:
- Implement data retention policies
- Add data export functionality
- Add data deletion functionality

---

## Remediation Priority

### Immediate (P0 - Fix within 24 hours)
1. SQL Injection in customers/products routes
2. Payment webhook signature verification

### High Priority (P1 - Fix within 1 week)
3. Add security headers
4. Implement Redis rate limiting
5. Fix mass assignment vulnerability
6. Re-enable TypeScript strict checking

### Medium Priority (P2 - Fix within 1 month)
7. AI prompt injection mitigation
8. Enhanced file upload validation
9. File size limits
10. CSRF cookie hardening
11. Error message sanitization
12. Enable React Strict Mode

### Low Priority (P3 - Fix within 3 months)
13. Logger sanitization
14. Input length limits
15. Environment validation
16. Explicit CORS configuration
17. Session refresh optimization

---

## Conclusion

The Baci platform has a solid security foundation with good use of modern security patterns. However, the critical SQL injection and webhook signature vulnerabilities require immediate attention. Implementing the recommended fixes will significantly improve the security posture of the application.

**Overall Security Rating:** 6.5/10 (Good foundation, critical issues need remediation)

---

*Report generated by automated security analysis. Manual penetration testing is recommended for comprehensive security assessment.*
