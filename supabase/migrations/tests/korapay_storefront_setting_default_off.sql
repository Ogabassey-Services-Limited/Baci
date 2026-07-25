-- =============================================
-- REGRESSION TEST: get_storefront_payment_settings korapay default OFF
--   Validates 20260724160000_korapay_storefront_setting_default_off.sql.
--
-- BUG: get_storefront_payment_settings coalesced a missing/null korapay_enabled
-- to TRUE, so the mobile storefront advertised Korapay for a merchant whose
-- feature-settings row was absent or NULL, while the web checkout gate (=== true)
-- and the initialization route treat it as OFF. This test fails against the prior
-- COALESCE(s.korapay_enabled, true) definition.
--
-- USAGE (run against a DB that has the migration applied):
--   psql "$DATABASE_URL" -f supabase/migrations/tests/korapay_storefront_setting_default_off.sql
--
-- Runs inside a transaction and rolls back — no data is persisted.
-- =============================================

BEGIN ISOLATION LEVEL REPEATABLE READ;

DO $$
DECLARE
  v_no_row_merchant uuid := '9c000000-0000-4000-8000-0000000009f1';
  v_null_merchant   uuid := '9c000000-0000-4000-8000-0000000009f2';
  v_korapay boolean;
  v_paystack boolean;
BEGIN
  -- The AFTER INSERT trigger trigger_create_merchant_feature_settings auto-creates
  -- a merchant_feature_settings row for every new merchant, so we shape the two
  -- cases AFTER insert rather than inserting the settings row ourselves.

  -- Merchant A: NO merchant_feature_settings row — delete the auto-created row to
  -- exercise the RPC's LEFT JOIN missing-row path.
  INSERT INTO public.merchants (id, email, business_name, slug)
  VALUES (
    v_no_row_merchant,
    'korapay-default-norow@example.com',
    'Korapay Default No-Row Store',
    'korapay-default-norow'
  );
  DELETE FROM public.merchant_feature_settings WHERE merchant_id = v_no_row_merchant;

  -- Merchant B: feature-settings row exists but korapay_enabled IS NULL — null the
  -- auto-created row's column.
  INSERT INTO public.merchants (id, email, business_name, slug)
  VALUES (
    v_null_merchant,
    'korapay-default-null@example.com',
    'Korapay Default Null Store',
    'korapay-default-null'
  );
  UPDATE public.merchant_feature_settings
    SET korapay_enabled = NULL, paystack_enabled = true
    WHERE merchant_id = v_null_merchant;

  -- Case 1: missing row -> korapay OFF, paystack still ON.
  SELECT korapay_enabled, paystack_enabled
    INTO v_korapay, v_paystack
    FROM public.get_storefront_payment_settings(v_no_row_merchant);

  IF v_korapay IS DISTINCT FROM false THEN
    RAISE EXCEPTION 'Missing-row merchant should default korapay_enabled=false, got %', v_korapay;
  END IF;
  IF v_paystack IS DISTINCT FROM true THEN
    RAISE EXCEPTION 'Missing-row merchant should keep paystack_enabled=true, got %', v_paystack;
  END IF;

  -- Case 2: null column -> korapay OFF.
  SELECT korapay_enabled
    INTO v_korapay
    FROM public.get_storefront_payment_settings(v_null_merchant);

  IF v_korapay IS DISTINCT FROM false THEN
    RAISE EXCEPTION 'Null korapay_enabled should coalesce to false, got %', v_korapay;
  END IF;

  RAISE NOTICE 'get_storefront_payment_settings korapay default-OFF regression: PASS';
END $$;

ROLLBACK;
