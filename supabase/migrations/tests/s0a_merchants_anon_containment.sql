-- =============================================
-- REGRESSION TEST: S0-A merchants anon containment
--   Locks the invariants established by migration
--   20260713150000_s0a_merchants_anon_containment.sql
--
-- USAGE:
--   psql $DATABASE_URL -f supabase/migrations/tests/s0a_merchants_anon_containment.sql
--   or via Supabase MCP execute_sql
--
-- Asserts (RAISE EXCEPTION on any deviation):
--   1. anon has NO table-wide SELECT/INSERT/UPDATE/DELETE/TRUNCATE on merchants.
--   2. anon has column SELECT on the safe presentation columns.
--   3. anon has NO column SELECT on any SECRET/immutable-PII column
--      (bvn, nin, stripe_*, ga4_api_secret, firs_*, *_token, is_platform_admin).
--   4. The anon SELECT row policy filters on is_published.
--   5. The Option-B bank bridge is CURRENTLY active (bank_account_number granted).
--      >>> When the bridge is removed, flip section 5 to expect FALSE. <<<
-- =============================================

BEGIN ISOLATION LEVEL REPEATABLE READ;

DO $$
DECLARE
  secret_col   text;
  safe_col     text;
  bridge_col   text;
  policy_expr  text;
  secret_cols  text[] := ARRAY[
    'bvn','nin','is_platform_admin',
    'stripe_customer_id','stripe_subscription_id',
    'ga4_api_secret','facebook_capi_token','facebook_capi_access_token',
    'tiktok_access_token','snapchat_capi_token',
    'firs_public_key','firs_certificate','firs_email','firs_password_encrypted',
    -- payout routing: no anon reader (features route uses the RPC since #3076)
    'paystack_subaccount_code',
    -- dashboard-only: link to the merchant's product data source, never public
    'google_product_sheet_url'
  ];
  safe_cols    text[] := ARRAY[
    'id','business_name','slug','logo_url','country','is_published',
    'email','phone','vat_rate','plan_tier','social_media'
  ];
  -- Option-B bridge columns: granted TODAY, revoked at the 2026-08-24 removal.
  bridge_cols  text[] := ARRAY[
    'bank_account_number','bank_account_name','bank_code','bank_name',
    'cac_rc_number','tax_identification_number','legal_entity_name'
  ];
BEGIN
  -- 1. No table-wide privileges of any kind for anon.
  IF has_table_privilege('anon', 'public.merchants', 'INSERT')
     OR has_table_privilege('anon', 'public.merchants', 'UPDATE')
     OR has_table_privilege('anon', 'public.merchants', 'DELETE')
     OR has_table_privilege('anon', 'public.merchants', 'TRUNCATE') THEN
    RAISE EXCEPTION
      'S0-A: anon must not hold any write privilege on public.merchants (REVOKE ALL failed)';
  END IF;

  -- 2. Safe columns are readable by anon.
  FOREACH safe_col IN ARRAY safe_cols LOOP
    IF NOT has_column_privilege('anon', 'public.merchants', safe_col, 'SELECT') THEN
      RAISE EXCEPTION
        'S0-A: anon must retain SELECT on safe column %, but it is missing', safe_col;
    END IF;
  END LOOP;

  -- 3. SECRET / immutable-PII columns are NOT readable by anon.
  FOREACH secret_col IN ARRAY secret_cols LOOP
    IF has_column_privilege('anon', 'public.merchants', secret_col, 'SELECT') THEN
      RAISE EXCEPTION
        'S0-A CONTAINMENT BREACH: anon can SELECT secret column % on public.merchants', secret_col;
    END IF;
  END LOOP;

  -- 4. anon SELECT row policy filters on is_published.
  SELECT pg_get_expr(polqual, polrelid) INTO policy_expr
  FROM pg_policy
  WHERE polrelid = 'public.merchants'::regclass
    AND polname  = 'Anon can view merchants';

  IF policy_expr IS NULL THEN
    RAISE EXCEPTION 'S0-A: "Anon can view merchants" policy missing on public.merchants';
  END IF;
  IF policy_expr NOT LIKE '%is_published%' THEN
    RAISE EXCEPTION
      'S0-A: anon row policy must filter on is_published, found %', policy_expr;
  END IF;

  -- 5. Option-B bridge is CURRENTLY active (bank/reg columns still granted).
  --    Removal migration flips this expectation to "must be FALSE".
  FOREACH bridge_col IN ARRAY bridge_cols LOOP
    IF NOT has_column_privilege('anon', 'public.merchants', bridge_col, 'SELECT') THEN
      RAISE EXCEPTION
        'S0-A: Option-B bridge column % expected granted to anon, but it is missing', bridge_col;
    END IF;
  END LOOP;

  RAISE NOTICE 'S0-A merchants anon containment: all invariants hold (bridge active).';
END $$;

ROLLBACK;
