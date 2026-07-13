-- =============================================
-- REGRESSION TEST: anon public-column restore
--   Locks the invariant established by migration
--   20260713160000_restore_merchants_anon_public_columns.sql
--
-- USAGE:
--   psql $DATABASE_URL -f supabase/migrations/tests/restore_merchants_anon_public_columns.sql
--
-- Asserts (RAISE EXCEPTION on any deviation):
--   1. anon CAN SELECT feature_settings (the column whose omission 42501'd the
--      blog prerender and blocked every deploy) plus the other public columns.
--   2. anon still CANNOT SELECT any of the 18 confirmed secrets.
-- =============================================

BEGIN ISOLATION LEVEL REPEATABLE READ;

DO $$
DECLARE
  public_col text;
  secret_col text;
  public_cols text[] := ARRAY[
    -- the complete set granted by 20260713160000 (all 30):
    'about_page','faq_items','trust_profile','email_logo_url',
    'hero_images_generated_at','hero_images_regeneration_count','order_prefix',
    'feature_settings','multi_currency_enabled','self_fulfillment_enabled',
    'gmc_variants_enabled','offline_conversions_enabled','tax_exempt',
    'google_analytics_id','facebook_pixel_id','tiktok_pixel_id',
    'snapchat_pixel_id','twitter_pixel_id',
    'email_domain','email_domain_verified','lga_code','state_code',
    'endpoint_id','endpoint_scheme_id','firs_business_id','firs_service_id',
    'created_at','plan_started_at','signup_source','kyc_status'
  ];
  secret_cols text[] := ARRAY[
    'bvn','nin','cac_number',
    'firs_public_key','firs_certificate','firs_email','firs_password_encrypted',
    'facebook_capi_token','facebook_capi_access_token','tiktok_access_token',
    'snapchat_capi_token','ga4_api_secret',
    'stripe_customer_id','stripe_subscription_id',
    'paystack_subaccount_code','virtual_terminal_code','is_platform_admin',
    'google_product_sheet_url'
  ];
BEGIN
  FOREACH public_col IN ARRAY public_cols LOOP
    IF NOT has_column_privilege('anon', 'public.merchants', public_col, 'SELECT') THEN
      RAISE EXCEPTION
        'anon-restore: anon must be able to SELECT public column %, but it is revoked', public_col;
    END IF;
  END LOOP;

  FOREACH secret_col IN ARRAY secret_cols LOOP
    IF has_column_privilege('anon', 'public.merchants', secret_col, 'SELECT') THEN
      RAISE EXCEPTION
        'anon-restore CONTAINMENT BREACH: anon can SELECT secret column %', secret_col;
    END IF;
  END LOOP;

  RAISE NOTICE 'anon public-column restore: feature_settings + public cols granted, 18 secrets still revoked.';
END $$;

ROLLBACK;
