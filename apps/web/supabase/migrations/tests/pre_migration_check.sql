-- =============================================
-- PRE-MIGRATION VALIDATION SCRIPT
-- Run this BEFORE applying the migration
-- =============================================

\echo '========================================='
\echo 'PRE-MIGRATION CHECKS'
\echo '========================================='

-- Check 1: List all functions that will be dropped/recreated
\echo '\n1. Functions that will be recreated:'
SELECT
    n.nspname as schema,
    p.proname as function_name,
    pg_get_function_identity_arguments(p.oid) as arguments
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
ORDER BY p.proname;

-- Check 2: Check if rate_limit_log table exists and its current schema
\echo '\n2. Current rate_limit_log table schema (if exists):'
SELECT
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns
WHERE table_schema = 'public'
AND table_name = 'rate_limit_log'
ORDER BY ordinal_position;

-- Check 3: Count existing data in rate_limit_log (if exists)
\echo '\n3. Row count in rate_limit_log (if exists):'
DO $$
BEGIN
    IF EXISTS (
        SELECT FROM information_schema.tables
        WHERE table_schema = 'public'
        AND table_name = 'rate_limit_log'
    ) THEN
        RAISE NOTICE 'rate_limit_log exists';
        EXECUTE 'SELECT COUNT(*) as row_count FROM rate_limit_log';
    ELSE
        RAISE NOTICE 'rate_limit_log does not exist yet';
    END IF;
END $$;

-- Check 4: List current grants on functions
\echo '\n4. Current function permissions:'
SELECT
    p.proname as function_name,
    array_agg(DISTINCT a.rolname) as granted_to
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
LEFT JOIN pg_proc_acl_aclexplode(p.proacl) a ON true
WHERE n.nspname = 'public'
AND p.proname IN (
    'decrement_product_stock',
    'decrement_variant_stock',
    'check_rate_limit'
)
GROUP BY p.proname
ORDER BY p.proname;

-- Check 5: Check for active triggers that will be affected
\echo '\n5. Triggers that will be recreated:'
SELECT
    t.tgname as trigger_name,
    c.relname as table_name,
    p.proname as function_name
FROM pg_trigger t
JOIN pg_class c ON t.tgrelid = c.oid
JOIN pg_proc p ON t.tgfoid = p.oid
WHERE NOT t.tgisinternal
AND c.relnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
AND p.proname IN (
    'set_order_number',
    'update_customer_full_name',
    'generate_merchant_slug',
    'ensure_single_primary_domain',
    'trg_set_updated_at_rate_limit_log'
)
ORDER BY c.relname, t.tgname;

-- Check 6: Verify search_path settings on SECURITY DEFINER functions
\echo '\n6. SECURITY DEFINER functions and their current search_path:'
SELECT
    p.proname as function_name,
    CASE WHEN p.prosecdef THEN 'SECURITY DEFINER' ELSE 'SECURITY INVOKER' END as security,
    pg_get_function_identity_arguments(p.oid) as arguments,
    COALESCE(
        (SELECT option_value
         FROM pg_options_to_table(p.proconfig)
         WHERE option_name = 'search_path'),
        'NOT SET'
    ) as search_path
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname = 'public'
AND p.prosecdef = true
ORDER BY p.proname;

\echo '\n========================================='
\echo 'Pre-migration checks complete!'
\echo 'Review the output above before proceeding.'
\echo '========================================='
