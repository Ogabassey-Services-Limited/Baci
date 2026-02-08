---
description: Review current code changes for quality, security, and maintainability against Baci project standards
---

# Code Review

Review all recent code changes against the project quality checklist.

## Steps

### 1. Get Changes
```bash
git diff
# Or for full branch:
git diff main...HEAD
```

### 2. Review Checklist

Check each modified file against:

**TypeScript:**
- No `any` types — use proper generics and type narrowing
- Strict null checks respected
- No unused imports or variables

**Supabase:**
- Correct client factory: `server` (SSR), `client` (browser), `admin` (service role only)
- Auth check (`supabase.auth.getUser()`) before data operations
- `.select('specific, columns')` not `.select('*')`
- `.error` handled on Supabase responses

**API Routes:**
- Zod validation on all request bodies
- CSRF token validation on non-GET methods
- Consistent error shape: `{ error: string, code?: string }`

**React/Next.js:**
- Server Components by default; `'use client'` only when justified
- No manual `React.memo`/`useCallback` (React Compiler handles this)
- `next/image` with explicit sizing

**Security:**
- No secrets in client code
- Input sanitization via `lib/sanitize*.ts`
- No `dangerouslySetInnerHTML`

### 3. Report

Categorize findings:
- **CRITICAL**: Must fix before merge
- **WARNING**: Should fix
- **SUGGESTION**: Consider improving
- **PRAISE**: Good patterns worth noting

Include specific fix examples for each issue.
