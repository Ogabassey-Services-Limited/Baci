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

- [ ] Supabase CLI installed (`pnpm dlx supabase`)
- [ ] Access to your Supabase project and its ID
- [ ] Database backup created

---

## Testing Methods

### Method 1: Local Development (Recommended)

#### Step 1: Start Local Supabase
```bash
# From your project root
pnpm dlx supabase start
```

#### Step 2: Apply Existing Migrations
```bash
# Apply all migrations up to but NOT including the new one
pnpm dlx supabase db reset
```

#### Step 3: Run Pre-Migration Checks
The `pre_migration_check.sql` script is designed for `psql` and may not run correctly with all SQL clients. The recommended way to run this is to use a tool that can execute raw SQL and copy the contents of the file.

**Review the output:**
- Check which functions will be recreated
- Note current row counts in `rate_limit_log` (if exists)
- Verify current permissions

#### Step 4: Apply the Migration
```bash
# Apply just this migration
pnpm dlx supabase migration up --version 20251123120000
```
Watch for errors. If any occur, note them and proceed to troubleshooting.

#### Step 5: Run Validation Tests
The `test_migration.sql` script contains `psql`-specific commands that will cause errors if run with a standard SQL execution tool.

**To run the tests:**
1. Read the content of `supabase/migrations/tests/test_migration.sql`.
2. **Remove all `psql`-specific commands** (lines starting with `\echo`).
3. Execute the remaining pure SQL script using a direct database connection tool.

**Expected output (when run via a SQL tool, you will see notices for each passed test):**
```
NOTICE:  ✓ rate_limit_log has all required columns
NOTICE:  ✓ Composite primary key exists
...
NOTICE:  ✓ Triggers recreated
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
```

#### Step 7: Test Application Integration

If you have application code:
```bash
# Start your development server
pnpm --filter @baci/web dev

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
pnpm dlx supabase branches create test-migration

# Link to the branch
pnpm dlx supabase link --project-ref <branch-ref>

# Apply migrations
pnpm dlx supabase db push
```
Then, run the validation tests as described in Step 5 of Method 1.

---

## Interpreting Test Results

### ✅ Success Indicators
- All `NOTICE` messages from the test script are positive (✓)
- No errors in migration application
- Application functionality unchanged

### ⚠️ Warning Indicators
- `⚠` warnings in the test script output.
- Some triggers missing (might not apply to your schema).

### ❌ Failure Indicators
- Any test fails with an `EXCEPTION`.
- Migration throws errors.
- Application breaks or errors occur.

---

## Common Issues and Solutions

### Issue 1: `updated_at` trigger not working
**Symptom:** Test 9 fails with `✗ updated_at trigger not working`.
**Solution:** The trigger function must use `clock_timestamp()` instead of `NOW()` to get the real-time value within a transaction. Update the `trg_set_updated_at_rate_limit_log` function in the main migration file.

### Issue 2: \"Function does not exist\" during tests
**Symptom:** Test fails with function not found.
**Solution:**
```sql
-- Check which functions exist
SELECT proname FROM pg_proc
WHERE pronamespace = 'public'::regnamespace;

-- Verify migration completed
SELECT * FROM supabase_migrations.schema_migrations
ORDER BY version DESC LIMIT 5;
```

---

## Rollback Procedure

If you need to rollback:

### Option 1: Database Restore (Clean Rollback)
Restore the database from the backup you created.

### Option 2: Supabase Reset (Local Only)
```bash
# Removes this migration from history and resets the local DB
pnpm dlx supabase db reset
```

---

## Production Deployment Checklist

Only proceed after ALL tests pass in staging:

- [ ] All automated tests pass (`test_migration.sql`)
- [ ] Manual functional tests complete
- [ ] Application integration tests pass
- [ ] Backup of production database created
- [ ] Team notified of deployment window

### Deployment Steps:
1. **Create Production Backup.**
2. **Apply During Low-Traffic Window** using the Supabase Dashboard or the CLI:
   ```bash
   pnpm dlx supabase db push --linked
   ```
3. **Monitor Immediately After** for errors and performance issues.

---

## Post-Deployment Tasks

1. **Remove Old Migration Files**
   ```bash
   # These are now superseded:
   rm supabase/migrations/20251120163000_backfill_order_items.sql
   rm supabase/migrations/20251122_add_security_functions.sql
   rm supabase/migrations/20251123000000_create_rate_limit_log.sql
   ```

2. **Update Documentation**
   - Document new function signatures.
   - Note any breaking changes.

3. **Schedule Cleanup Job**
   ```sql
   -- Add cron job for rate limit cleanup (if using pg_cron)
   SELECT cron.schedule(
     'cleanup-rate-limits',
     '0 * * * *', -- Every hour
     $$SELECT cleanup_rate_limit_logs()$$
   );
   ```
