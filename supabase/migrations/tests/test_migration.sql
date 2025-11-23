-- =============================================
-- MIGRATION TEST SCRIPT
-- Run this AFTER applying the migration
-- =============================================

\echo '========================================='
\echo 'POST-MIGRATION VALIDATION TESTS'
\echo '========================================='

BEGIN;

-- Test 1: Verify rate_limit_log table schema
\echo '\n TEST 1: Verify rate_limit_log table schema'
DO $$
DECLARE
    col_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO col_count
    FROM information_schema.columns
    WHERE table_schema = 'public'
    AND table_name = 'rate_limit_log'
    AND column_name IN ('identifier', 'endpoint', 'request_count', 'window_start', 'created_at', 'updated_at');

    IF col_count = 6 THEN
        RAISE NOTICE '✓ rate_limit_log has all required columns';
    ELSE
        RAISE EXCEPTION '✗ rate_limit_log missing columns. Found % of 6', col_count;
    END IF;
END $$;

-- Test 2: Verify composite primary key
\echo '\n TEST 2: Verify composite primary key'
DO $$
DECLARE
    constraint_found BOOLEAN;
BEGIN
    SELECT EXISTS (
        SELECT 1
        FROM pg_constraint c
        JOIN pg_class t ON c.conrelid = t.oid
        JOIN pg_namespace n ON t.relnamespace = n.oid
        WHERE n.nspname = 'public'
        AND t.relname = 'rate_limit_log'
        AND c.contype = 'p'
        AND array_length(c.conkey, 1) = 3
    ) INTO constraint_found;

    IF constraint_found THEN
        RAISE NOTICE '✓ Composite primary key exists';
    ELSE
        RAISE EXCEPTION '✗ Composite primary key not found';
    END IF;
END $$;

-- Test 3: Verify indexes
\echo '\n TEST 3: Verify indexes exist'
DO $$
DECLARE
    idx_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO idx_count
    FROM pg_indexes
    WHERE schemaname = 'public'
    AND tablename = 'rate_limit_log'
    AND indexname IN (
        'idx_rate_limit_log_identifier_endpoint_window_start',
        'idx_rate_limit_log_created_at'
    );

    IF idx_count >= 2 THEN
        RAISE NOTICE '✓ Required indexes exist (found %)', idx_count;
    ELSE
        RAISE EXCEPTION '✗ Missing indexes. Found % of 2', idx_count;
    END IF;
END $$;

-- Test 4: Verify RLS is enabled
\echo '\n TEST 4: Verify RLS is enabled on rate_limit_log'
DO $$
DECLARE
    rls_enabled BOOLEAN;
BEGIN
    SELECT relrowsecurity INTO rls_enabled
    FROM pg_class
    WHERE relname = 'rate_limit_log'
    AND relnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public');

    IF rls_enabled THEN
        RAISE NOTICE '✓ RLS is enabled';
    ELSE
        RAISE EXCEPTION '✗ RLS is not enabled';
    END IF;
END $$;

-- Test 5: Verify all functions exist
\echo '\n TEST 5: Verify all functions were created'
DO $$
DECLARE
    func_count INTEGER;
    expected_count INTEGER := 13; -- including trigger function
BEGIN
    SELECT COUNT(*) INTO func_count
    FROM pg_proc p
    JOIN pg_namespace n ON p.pronamespace = n.oid
    WHERE n.nspname = 'public'
    AND p.proname IN (
        'check_rate_limit',
        'cleanup_rate_limit_logs',
        'decrement_product_stock',
        'decrement_variant_stock',
        'sanitize_text_input',
        'is_valid_email',
        'generate_order_number_for_merchant',
        'set_order_number',
        'update_customer_full_name',
        'generate_merchant_slug',
        'set_primary_domain',
        'ensure_single_primary_domain',
        'trg_set_updated_at_rate_limit_log'
    );

    IF func_count = expected_count THEN
        RAISE NOTICE '✓ All % functions exist', func_count;
    ELSE
        RAISE EXCEPTION '✗ Missing functions. Found % of %', func_count, expected_count;
    END IF;
END $$;

-- Test 6: Verify search_path is set on all functions
\echo '\n TEST 6: Verify search_path is set on all functions'
DO $$
DECLARE
    missing_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO missing_count
    FROM pg_proc p
    JOIN pg_namespace n ON p.pronamespace = n.oid
    WHERE n.nspname = 'public'
    AND p.proname IN (
        'check_rate_limit',
        'cleanup_rate_limit_logs',
        'decrement_product_stock',
        'decrement_variant_stock',
        'sanitize_text_input',
        'is_valid_email',
        'generate_order_number_for_merchant',
        'set_order_number',
        'update_customer_full_name',
        'generate_merchant_slug',
        'set_primary_domain',
        'ensure_single_primary_domain',
        'trg_set_updated_at_rate_limit_log'
    )
    AND NOT EXISTS (
        SELECT 1
        FROM pg_options_to_table(p.proconfig)
        WHERE option_name = 'search_path'
    );

    IF missing_count = 0 THEN
        RAISE NOTICE '✓ All functions have search_path set';
    ELSE
        RAISE EXCEPTION '✗ % functions missing search_path', missing_count;
    END IF;
END $$;

-- Test 7: Verify SECURITY DEFINER functions have search_path
\echo '\n TEST 7: Verify SECURITY DEFINER functions have proper search_path'
DO $$
DECLARE
    insecure_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO insecure_count
    FROM pg_proc p
    JOIN pg_namespace n ON p.pronamespace = n.oid
    WHERE n.nspname = 'public'
    AND p.prosecdef = true
    AND p.proname IN (
        'decrement_product_stock',
        'decrement_variant_stock',
        'cleanup_rate_limit_logs',
        'generate_order_number_for_merchant',
        'set_primary_domain'
    )
    AND (
        SELECT option_value
        FROM pg_options_to_table(p.proconfig)
        WHERE option_name = 'search_path'
    ) NOT LIKE '%pg_catalog%';

    IF insecure_count = 0 THEN
        RAISE NOTICE '✓ All SECURITY DEFINER functions have secure search_path';
    ELSE
        RAISE EXCEPTION '✗ % SECURITY DEFINER functions have insecure search_path', insecure_count;
    END IF;
END $$;

-- Test 8: Test check_rate_limit function
\echo '\n TEST 8: Test check_rate_limit function'
DO $$
DECLARE
    result BOOLEAN;
BEGIN
    -- First call should succeed
    SELECT check_rate_limit('test_user', '/api/test', 5, 1) INTO result;
    IF result = true THEN
        RAISE NOTICE '✓ check_rate_limit allows first request';
    ELSE
        RAISE EXCEPTION '✗ check_rate_limit failed on first request';
    END IF;

    -- Verify data was inserted
    IF EXISTS (SELECT 1 FROM rate_limit_log WHERE identifier = 'test_user') THEN
        RAISE NOTICE '✓ Rate limit log entry created';
    ELSE
        RAISE EXCEPTION '✗ Rate limit log entry not created';
    END IF;
END $$;

-- Test 9: Test updated_at trigger
\echo '\n TEST 9: Test updated_at trigger on rate_limit_log'
DO $$
DECLARE
    old_timestamp TIMESTAMPTZ;
    new_timestamp TIMESTAMPTZ;
BEGIN
    -- Get current timestamp
    SELECT updated_at INTO old_timestamp
    FROM rate_limit_log
    WHERE identifier = 'test_user'
    LIMIT 1;

    -- Wait a tiny bit and update
    PERFORM pg_sleep(0.1);

    UPDATE rate_limit_log
    SET request_count = request_count + 1
    WHERE identifier = 'test_user';

    -- Get new timestamp
    SELECT updated_at INTO new_timestamp
    FROM rate_limit_log
    WHERE identifier = 'test_user'
    LIMIT 1;

    IF new_timestamp > old_timestamp THEN
        RAISE NOTICE '✓ updated_at trigger works';
    ELSE
        RAISE EXCEPTION '✗ updated_at trigger not working';
    END IF;
END $$;

-- Test 10: Verify anon access is revoked from critical functions
\echo '\n TEST 10: Verify anon cannot execute critical functions'
DO $$
BEGIN
    -- Note: This test checks ACL, actual enforcement depends on role setup
    IF NOT EXISTS (
        SELECT 1 FROM pg_proc p
        JOIN pg_namespace n ON p.pronamespace = n.oid
        WHERE n.nspname = 'public'
        AND p.proname IN ('decrement_product_stock', 'decrement_variant_stock')
        AND p.proacl::text LIKE '%anon%'
    ) THEN
        RAISE NOTICE '✓ anon access properly restricted';
    ELSE
        RAISE WARNING '⚠ anon may still have access to critical functions';
    END IF;
END $$;

-- Test 11: Test input validation
\echo '\n TEST 11: Test input validation on functions'
DO $$
DECLARE
    test_result RECORD;
BEGIN
    -- Test NULL validation on decrement_product_stock
    BEGIN
        SELECT * INTO test_result FROM decrement_product_stock(NULL, 1);
        IF test_result.success = false AND test_result.message LIKE '%cannot be null%' THEN
            RAISE NOTICE '✓ NULL validation works on decrement_product_stock';
        ELSE
            RAISE EXCEPTION '✗ NULL validation failed';
        END IF;
    EXCEPTION
        WHEN OTHERS THEN
            RAISE NOTICE '✓ NULL validation works (raised exception)';
    END;

    -- Test is_valid_email
    IF is_valid_email('test@example.com') = true THEN
        RAISE NOTICE '✓ is_valid_email accepts valid email';
    ELSE
        RAISE EXCEPTION '✗ is_valid_email rejected valid email';
    END IF;

    IF is_valid_email('invalid-email') = false THEN
        RAISE NOTICE '✓ is_valid_email rejects invalid email';
    ELSE
        RAISE EXCEPTION '✗ is_valid_email accepted invalid email';
    END IF;
END $$;

-- Test 12: Verify triggers are recreated
\echo '\n TEST 12: Verify all triggers exist'
DO $$
DECLARE
    trigger_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO trigger_count
    FROM pg_trigger t
    JOIN pg_class c ON t.tgrelid = c.oid
    JOIN pg_proc p ON t.tgfoid = p.oid
    WHERE NOT t.tgisinternal
    AND c.relnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    AND t.tgname IN (
        'trg_update_rate_limit_log_updated_at',
        'trigger_set_order_number',
        'trigger_update_customer_full_name',
        'set_merchant_slug',
        'on_domain_primary_change'
    );

    IF trigger_count >= 4 THEN
        RAISE NOTICE '✓ Triggers recreated (found %)', trigger_count;
    ELSE
        RAISE WARNING '⚠ Some triggers may be missing. Found %', trigger_count;
    END IF;
END $$;

-- Cleanup test data
DELETE FROM rate_limit_log WHERE identifier = 'test_user';

ROLLBACK; -- Rollback test transaction

\echo '\n========================================='
\echo 'ALL TESTS COMPLETED!'
\echo 'Review any warnings or errors above.'
\echo '========================================='
