# Security Configuration Guide

## Manual Configuration Required

### 1. Enable Leaked Password Protection (REQUIRED)

**Status**: ⚠️ Must be configured manually in Supabase Dashboard

**Steps**:
1. Go to Supabase Dashboard: https://supabase.com/dashboard
2. Select your project: `aivqthbxdshhltbwipbr`
3. Navigate to: **Authentication** → **Policies**
4. Enable: **"Leaked Password Protection"**
5. This checks passwords against HaveIBeenPwned.org database

**Why**: Prevents users from setting compromised passwords that have appeared in data breaches.

---

## Automated Security Features ✅

### 1. Materialized View Security
- **Status**: ✅ Fixed via migration `20251125152000_fix_security_advisor_warnings.sql`
- **Implementation**:
  - Revoked direct access to materialized views
  - Created secure views with `security_invoker = true`
  - All views filter by `merchant_id` based on `auth.uid()`
  - Views: `secure_sales_by_channel`, `secure_daily_sales_summary`, `secure_product_performance`, `secure_customer_insights`

### 2. Row Level Security (RLS)
- **Status**: ✅ All critical tables protected
- **Implementation**: 65 RLS policies optimized for performance
- **Multi-tenant Isolation**: Every merchant can only access their own data

### 3. Vector Extension Location
- **Status**: ℹ️ Informational only - acceptable for Supabase
- **Note**: pgvector extension in public schema is standard for Supabase installations

---

## Security Audit Results

### Before Optimizations
- 5 WARN-level security issues
- 65 WARN-level performance issues

### After Optimizations
- 2 WARN-level issues (1 requires manual config, 1 is informational)
- 0 WARN-level performance issues
- All critical vulnerabilities resolved

---

## Next Steps

1. ⚠️ **Action Required**: Enable Leaked Password Protection in dashboard
2. ✅ All database-level security configured
3. ✅ Multi-tenant isolation enforced
4. ✅ Performance optimized for scale
