# Migration Testing Guide

## Overview
This guide walks you through testing the `20251123120000_apply_2025_best_practices.sql` migration safely.

## ⚠️ IMPORTANT: Test in Non-Production First!

**NEVER apply this migration directly to production.** Always test in:
1. Local development environment (preferred)
2. Staging/QA environment
3. Production snapshot/fork

---

## Prerequisites

- [ ] Supabase CLI installed (`npx supabase`)
- [ ] Access to your Supabase project
- [ ] Database backup created
- [ ] psql client installed (for running test scripts)

---

## Testing Methods

### Method 1: Local Development (Recommended)

#### Step 1: Start Local Supabase
```bash
# From your project root
npx supabase start
```

#### Step 2: Apply Existing Migrations
```bash
# Apply all migrations up to but NOT including the new one
npx supabase db reset
```

#### Step 3: Run Pre-Migration Checks
```bash
# Connect to local database
npx supabase db execute -f supabase/migrations/tests/pre_migration_check.sql

# Or use psql directly
psql postgresql://postgres:postgres@localhost:54322/postgres \
  -f supabase/migrations/tests/pre_migration_check.sql
```

**Review the output:**
- Check which functions will be recreated
- Note current row counts in `rate_limit_log` (if exists)
- Verify current permissions

#### Step 4: Apply the Migration
```bash
# Apply just this migration
npx supabase migration up --version 20251123120000

# OR apply it with psql
psql postgresql://postgres:postgres@localhost:54322/postgres \
  -f supabase/migrations/20251123120000_apply_2025_best_practices.sql
```

Watch for errors. If any occur, note them and proceed to troubleshooting.

#### Step 5: Run Validation Tests
```bash
# Run comprehensive test suite
psql postgresql://postgres:postgres@localhost:54322/postgres \
  -f supabase/migrations/tests/test_migration.sql
```

**Expected output:**
```
✓ rate_limit_log has all required columns
✓ Composite primary key exists
✓ Required indexes exist
✓ RLS is enabled
✓ All 13 functions exist
✓ All functions have search_path set
✓ All SECURITY DEFINER functions have secure search_path
✓ check_rate_limit allows first request
✓ Rate limit log entry created
✓ updated_at trigger works
✓ anon access properly restricted
✓ NULL validation works
✓ is_valid_email accepts valid email
✓ is_valid_email rejects invalid email
✓ Triggers recreated
```

#### Step 6: Manual Functional Tests

Run these SQL commands to verify functionality:

```sql
-- Test 1: Rate limiting works
SELECT check_rate_limit('test_ip', '/api/endpoint', 10, 1);
-- Should return: true

-- Test 2: Verify log entry
SELECT * FROM rate_limit_log WHERE identifier = 'test_ip';
-- Should show entry with all columns

-- Test 3: Test email validation
SELECT is_valid_email('user@example.com'); -- Should return true
SELECT is_valid_email('invalid'); -- Should return false

-- Test 4: Test text sanitization
SELECT sanitize_text_input('  test  '); -- Should return 'test'

-- Test 5: Check function permissions
\dp decrement_product_stock
\dp check_rate_limit
-- Should NOT show 'anon' in permissions

-- Test 6: Verify search_path
SELECT
    proname,
    (SELECT option_value
     FROM pg_options_to_table(proconfig)
     WHERE option_name = 'search_path') as search_path
FROM pg_proc
WHERE proname IN ('decrement_product_stock', 'check_rate_limit')
AND pronamespace = 'public'::regnamespace;
-- All should show 'pg_catalog, public'
```

#### Step 7: Test Application Integration

If you have application code:

```bash
# Start your development server
npm run dev

# Test these scenarios:
# 1. User authentication and order creation
# 2. Product stock updates
# 3. Rate limiting behavior
# 4. Domain management
# 5. Customer creation/updates
```

---

### Method 2: Supabase Cloud (Staging Branch)

If using Supabase branching:

```bash
# Create a preview branch
npx supabase branches create test-migration

# Link to the branch
npx supabase link --project-ref <branch-ref>

# Apply migrations
npx supabase db push

# Run tests (using Supabase connection string)
psql <branch-connection-string> -f supabase/migrations/tests/test_migration.sql
```

---

### Method 3: Direct Database Testing (Use with Caution)

**Only use this on a non-production database!**

```bash
# 1. Create database snapshot/backup
pg_dump -h your-db-host -U postgres -d your-db > backup_before_migration.sql

# 2. Run pre-migration checks
psql -h your-db-host -U postgres -d your-db \
  -f supabase/migrations/tests/pre_migration_check.sql

# 3. Apply migration
psql -h your-db-host -U postgres -d your-db \
  -f supabase/migrations/20251123120000_apply_2025_best_practices.sql

# 4. Run validation tests
psql -h your-db-host -U postgres -d your-db \
  -f supabase/migrations/tests/test_migration.sql
```

---

## Interpreting Test Results

### ✅ Success Indicators
- All tests pass with ✓ checkmarks
- No errors in migration application
- Application functionality unchanged
- All expected functions exist
- Permissions correctly restricted

### ⚠️ Warning Indicators
- Functions have `⚠` warnings but tests pass
- Some triggers missing (might not apply to your schema)
- Application works but with deprecation notices

### ❌ Failure Indicators
- Any test shows ✗ failed
- Migration throws errors
- Functions missing or incorrect
- Application breaks or errors occur

---

## Common Issues and Solutions

### Issue 1: "Table already exists" error
**Symptom:** `ERROR: relation "rate_limit_log" already exists`

**Solution:**
The migration uses `DROP TABLE IF EXISTS`, so this shouldn't happen. If it does:
```sql
-- Check table structure
\d rate_limit_log

-- If it's the old structure, the DROP should have worked
-- Try running just the table recreation section
```

### Issue 2: "Function does not exist" during tests
**Symptom:** Test fails with function not found

**Solution:**
```sql
-- Check which functions exist
SELECT proname FROM pg_proc
WHERE pronamespace = 'public'::regnamespace
AND proname LIKE '%rate%';

-- Verify migration completed
SELECT * FROM supabase_migrations.schema_migrations
ORDER BY version DESC LIMIT 5;
```

### Issue 3: Triggers not firing
**Symptom:** `updated_at` not updating or slugs not generating

**Solution:**
```sql
-- Check triggers exist
SELECT tgname, tgrelid::regclass
FROM pg_trigger
WHERE NOT tgisinternal;

-- Recreate specific trigger if missing
-- (Refer to migration file)
```

### Issue 4: Permission denied errors
**Symptom:** `permission denied for function X`

**Solution:**
```sql
-- Check current permissions
\df+ function_name

-- Grant necessary permissions
GRANT EXECUTE ON FUNCTION function_name TO authenticated;
```

---

## Rollback Procedure

If you need to rollback:

### Option 1: Use Rollback Script (Restores Old Functions)
```bash
psql <connection-string> -f supabase/migrations/tests/rollback_migration.sql
```

**Note:** This restores old functions WITH their security issues. Only use temporarily.

### Option 2: Database Restore (Clean Rollback)
```bash
# Restore from backup
psql <connection-string> < backup_before_migration.sql
```

### Option 3: Supabase Reset (Local Only)
```bash
# Removes this migration from history
npx supabase db reset
```

---

## Production Deployment Checklist

Only proceed after ALL tests pass in staging:

- [ ] All automated tests pass (test_migration.sql)
- [ ] Manual functional tests complete
- [ ] Application integration tests pass
- [ ] Performance testing shows no degradation
- [ ] Backup of production database created
- [ ] Rollback plan documented and tested
- [ ] Team notified of deployment window
- [ ] Monitoring/alerts configured

### Deployment Steps:

1. **Create Production Backup**
   ```bash
   # Via Supabase dashboard or CLI
   # Verify backup completed successfully
   ```

2. **Apply During Low-Traffic Window**
   ```bash
   # Use Supabase dashboard migrations tab
   # OR use CLI
   npx supabase db push --linked
   ```

3. **Monitor Immediately After**
   - Check error logs
   - Monitor API response times
   - Verify critical user flows
   - Watch for permission errors

4. **Validate in Production**
   ```bash
   # Run basic validation (NOT the full test suite with data modifications)
   psql <prod-connection> -c "SELECT check_rate_limit('test', '/test', 10, 1);"
   psql <prod-connection> -c "SELECT is_valid_email('test@test.com');"
   ```

---

## Post-Deployment Tasks

1. **Remove Old Migration Files** (optional)
   ```bash
   # These are now superseded:
   rm supabase/migrations/20251120163000_backfill_order_items.sql
   rm supabase/migrations/20251122_add_security_functions.sql
   rm supabase/migrations/20251123000000_create_rate_limit_log.sql
   ```

2. **Update Documentation**
   - Document new function signatures
   - Update API documentation for permission changes
   - Note any breaking changes

3. **Schedule Cleanup Job**
   ```sql
   -- Add cron job for rate limit cleanup (if using pg_cron)
   SELECT cron.schedule(
     'cleanup-rate-limits',
     '0 * * * *', -- Every hour
     $$SELECT cleanup_rate_limit_logs()$$
   );
   ```

---

## Need Help?

If tests fail or you encounter issues:

1. Check the specific error message
2. Review the "Common Issues" section above
3. Examine function definitions in the migration file
4. Check Supabase logs for detailed errors
5. Consider asking for help with specific error details

---

## Test Coverage Summary

The test scripts validate:

- ✅ Schema changes (columns, types, constraints)
- ✅ Index creation and optimization
- ✅ Function existence and signatures
- ✅ Security settings (RLS, search_path, SECURITY DEFINER)
- ✅ Permission grants (anon access revoked where needed)
- ✅ Trigger functionality
- ✅ Input validation
- ✅ Functional behavior (rate limiting, email validation, etc.)
- ✅ Data integrity (updated_at triggers)

Total: 12 automated tests + manual integration tests
