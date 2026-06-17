-- =============================================
-- REGRESSION TEST: merchant identity drift guards
--   Validates:
--     20260617000000_guard_cac_verification_idempotent.sql   (CAC re-verify cannot clobber legal identity)
--     20260617000100_merchant_identity_placeholder_guards.sql (placeholder values rejected; real values OK)
--
-- USAGE:
--   psql $DATABASE_URL -f supabase/migrations/tests/merchant_identity_drift_guards.sql
--   (or via Supabase MCP execute_sql). Mutates inside a transaction and ROLLBACKs.
-- =============================================
BEGIN;

DO $test$
DECLARE
  v_mid uuid := '8f0ed783-0000-4000-8000-000000000301';
  v_def text;
BEGIN
  -- ---------- Placeholder CHECK constraints ----------
  -- A clean row inserts fine.
  INSERT INTO public.merchants (id, email, business_name, business_address, phone, support_phone)
  VALUES (v_mid, 'drift-guard@example.com', 'Drift Guard Store',
          '2 Olaide Tomori Street, Ikeja, Lagos', '+2348100000000', '+2348100000000')
  ON CONFLICT (id) DO NOTHING;

  -- The seeded dummy business address must be rejected.
  BEGIN
    UPDATE public.merchants SET business_address = '456 Oak Avenue, New City, State, 12345' WHERE id = v_mid;
    RAISE EXCEPTION 'placeholder business_address was accepted';
  EXCEPTION WHEN check_violation THEN NULL; END;

  -- The seeded dummy phone must be rejected.
  BEGIN
    UPDATE public.merchants SET phone = '1234567890' WHERE id = v_mid;
    RAISE EXCEPTION 'placeholder phone was accepted';
  EXCEPTION WHEN check_violation THEN NULL; END;

  -- Real values still write.
  UPDATE public.merchants
     SET business_address = 'Taiyelolu Towers, Ikeja, Lagos', phone = '+2348146978921'
   WHERE id = v_mid;

  -- ---------- CAC idempotency guard present ----------
  v_def := pg_get_functiondef('public.record_cac_verification(uuid,text,text,text)'::regprocedure);
  IF position('cac_identity_conflict' in v_def) = 0 THEN
    RAISE EXCEPTION 'record_cac_verification is missing the cac_identity_conflict guard';
  END IF;

  IF position('UPPER(BTRIM' in v_def) = 0 THEN
    RAISE EXCEPTION 'record_cac_verification does not canonicalize CAC identity comparisons';
  END IF;

  IF position('ERRCODE = ''PT409''' in v_def) = 0 THEN
    RAISE EXCEPTION 'record_cac_verification does not expose the app-visible PT409 conflict code';
  END IF;

  RAISE NOTICE 'OK: merchant identity drift guards enforced';
END;
$test$ LANGUAGE plpgsql;

ROLLBACK;