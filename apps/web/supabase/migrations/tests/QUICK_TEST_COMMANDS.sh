#!/bin/bash
# =============================================
# QUICK TEST COMMANDS
# Copy-paste these for fast testing
# =============================================

set -e  # Exit on error

echo "========================================="
echo "Migration Testing - Quick Commands"
echo "========================================="

# Detect environment
if command -v npx &> /dev/null && [ -f "supabase/config.toml" ]; then
    echo "✓ Supabase CLI detected"
    USE_SUPABASE=true
else
    echo "⚠ Supabase CLI not found, using direct psql"
    USE_SUPABASE=false
fi

# =============================================
# 1. LOCAL TESTING (Recommended)
# =============================================

if [ "$USE_SUPABASE" = true ]; then
    echo ""
    echo "=== Starting Local Supabase ==="
    npx supabase start

    echo ""
    echo "=== Running Pre-Migration Checks ==="
    npx supabase db execute -f supabase/migrations/tests/pre_migration_check.sql

    echo ""
    echo "=== Applying Migration ==="
    npx supabase db execute -f supabase/migrations/20251123120000_apply_2025_best_practices.sql

    echo ""
    echo "=== Running Validation Tests ==="
    npx supabase db execute -f supabase/migrations/tests/test_migration.sql

    echo ""
    echo "✓ All tests complete!"
    echo ""
    echo "To rollback, run:"
    echo "  npx supabase db reset"

else
    # =============================================
    # 2. DIRECT PSQL TESTING
    # =============================================

    echo ""
    echo "Enter your PostgreSQL connection string:"
    echo "(e.g., postgresql://postgres:password@localhost:5432/dbname)"
    read -r DB_URL

    echo ""
    echo "=== Running Pre-Migration Checks ==="
    psql "$DB_URL" -f supabase/migrations/tests/pre_migration_check.sql

    echo ""
    read -p "Continue with migration? (y/N) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        echo "Aborted."
        exit 1
    fi

    echo ""
    echo "=== Applying Migration ==="
    psql "$DB_URL" -f supabase/migrations/20251123120000_apply_2025_best_practices.sql

    echo ""
    echo "=== Running Validation Tests ==="
    psql "$DB_URL" -f supabase/migrations/tests/test_migration.sql

    echo ""
    echo "✓ All tests complete!"
    echo ""
    echo "To rollback, run:"
    echo "  psql \"$DB_URL\" -f supabase/migrations/tests/rollback_migration.sql"
fi

# =============================================
# 3. MANUAL VERIFICATION COMMANDS
# =============================================

echo ""
echo "========================================="
echo "Manual Verification Commands"
echo "========================================="
echo ""
echo "Run these SQL commands manually to verify:"
echo ""
echo "-- Check function exists with search_path:"
echo "SELECT proname, prosrc, proconfig"
echo "FROM pg_proc"
echo "WHERE proname = 'check_rate_limit';"
echo ""
echo "-- Test rate limiting:"
echo "SELECT check_rate_limit('test_user', '/api/test', 10, 1);"
echo ""
echo "-- Check permissions (should NOT see 'anon' for critical functions):"
echo "\dp decrement_product_stock"
echo ""
echo "-- Verify RLS enabled:"
echo "SELECT relname, relrowsecurity"
echo "FROM pg_class"
echo "WHERE relname = 'rate_limit_log';"
echo ""
echo "-- Check triggers:"
echo "SELECT tgname, tgrelid::regclass, tgfoid::regproc"
echo "FROM pg_trigger"
echo "WHERE NOT tgisinternal"
echo "ORDER BY tgrelid::regclass::text;"
echo ""
echo "========================================="
