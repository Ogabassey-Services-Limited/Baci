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
  v_owner_uid uuid := '8f0ed783-0000-4000-8000-000000000302';
  v_def text;
BEGIN
  -- ---------- Placeholder CHECK constraints ----------
  -- The merchant fixture must satisfy the merchants.user_id foreign key on branch DBs.
  INSERT INTO auth.users (
    id,
    instance_id,
    aud,
    role,
    email,
    encrypted_password,
    email_confirmed_at,
    created_at,
    updated_at,
    raw_app_meta_data,
    raw_user_meta_data
  )
  VALUES (
    v_owner_uid,
    '00000000-0000-0000-0000-000000000000',
    'authenticated',
    'authenticated',
    format('drift-guard-owner-%s-%s@example.com', v_owner_uid, txid_current()),
    'test',
    now(),
    now(),
    now(),
    '{}'::jsonb,
    '{}'::jsonb
  )
  ON CONFLICT (id) DO NOTHING;

  -- A clean row inserts fine. The email includes v_mid + txid_current() so repeated
  -- local test runs cannot collide with unique email constraints.
  INSERT INTO public.merchants (
    id,
    user_id,
    email,
    business_name,
    business_address,
    phone,
    support_phone,
    registered_address
  )
  VALUES (
    v_mid,
    v_owner_uid,
    format('drift-guard-%s-%s@example.com', v_mid, txid_current()),
    'Drift Guard Store',
    '2 Olaide Tomori Street, Ikeja, Lagos',
    '+2348100000000',
    '+2348100000000',
    jsonb_build_object('street', '2 Olaide Tomori Street', 'city', 'Ikeja')
  );

  -- The seeded dummy business address must be rejected when there is no
  -- formatted structured address for the PR-F derivation trigger to restore.
  UPDATE public.merchants
     SET registered_address = '{}'::jsonb
   WHERE id = v_mid;

  BEGIN
    UPDATE public.merchants SET business_address = '456 Oak Avenue, New City, State, 12345' WHERE id = v_mid;
    RAISE EXCEPTION 'placeholder business_address was accepted';
  EXCEPTION WHEN check_violation THEN NULL; END;

  -- Direct sensitive identity writes must still fail without the narrow RPC
  -- capability, independently of the legacy placeholder constraints below.
  BEGIN
    UPDATE public.merchants SET phone = '+2348146978999' WHERE id = v_mid;
    RAISE EXCEPTION 'unauthorized direct phone update bypassed identity guard';
  EXCEPTION
    WHEN insufficient_privilege THEN
      IF SQLERRM <> 'merchant_sensitive_update_not_authorized' THEN
        RAISE;
      END IF;
  END;

  PERFORM pg_catalog.set_config(
    'app.merchant_sensitive_update_authorized',
    'true',
    true
  );

  -- The seeded dummy phone must be rejected.
  BEGIN
    UPDATE public.merchants SET phone = '1234567890' WHERE id = v_mid;
    RAISE EXCEPTION 'placeholder phone was accepted';
  EXCEPTION WHEN check_violation THEN NULL; END;

  -- The seeded dummy support phone must be rejected.
  BEGIN
    UPDATE public.merchants SET support_phone = '1234567890' WHERE id = v_mid;
    RAISE EXCEPTION 'placeholder support_phone was accepted';
  EXCEPTION WHEN check_violation THEN NULL; END;

  -- The complete seeded dummy registered address must be rejected.
  BEGIN
    UPDATE public.merchants
       SET registered_address = jsonb_build_object(
         'street', '123 Main Street',
         'city', 'New City',
         'state', 'State',
         'postal_code', '12345'
       )
     WHERE id = v_mid;
    RAISE EXCEPTION 'placeholder registered_address was accepted';
  EXCEPTION WHEN check_violation THEN NULL; END;

  -- A real Main Street address must not be rejected solely because of its street name.
  UPDATE public.merchants
     SET registered_address = jsonb_build_object(
       'street', '123 Main Street',
       'city', 'Ikeja',
       'state', 'Lagos',
       'postal_code', '100001'
     )
   WHERE id = v_mid;

  -- Real values still write for all guarded fields.
  UPDATE public.merchants
     SET business_address = 'Taiyelolu Towers, Ikeja, Lagos',
         phone = '+2348146978921',
         support_phone = '+2348146978922',
         registered_address = jsonb_build_object('street', '19 Adeola Odeku Street', 'city', 'Victoria Island')
   WHERE id = v_mid;

  PERFORM pg_catalog.set_config(
    'app.merchant_sensitive_update_authorized',
    'false',
    true
  );

  -- ---------- CAC idempotency guard present ----------
  v_def := pg_get_functiondef('public.record_cac_verification(uuid,text,text,text)'::regprocedure);
  IF position('cac_identity_conflict' in v_def) = 0 THEN
    RAISE EXCEPTION 'record_cac_verification is missing the cac_identity_conflict guard';
  END IF;

  IF position('regexp_replace(UPPER(BTRIM' in v_def) = 0 THEN
    RAISE EXCEPTION 'record_cac_verification does not canonicalize CAC registration comparisons';
  END IF;

  IF position('v_has_prior_cac' in v_def) = 0 THEN
    RAISE EXCEPTION 'record_cac_verification does not scope conflicts to prior CAC verification';
  END IF;

  IF position('ERRCODE = ''PT409''' in v_def) = 0 THEN
    RAISE EXCEPTION 'record_cac_verification does not expose the app-visible PT409 conflict code';
  END IF;

  IF position('AND user_id = v_caller_uid' in v_def) = 0 THEN
    RAISE EXCEPTION 'record_cac_verification does not scope writes to the caller merchant owner';
  END IF;

  -- ---------- CAC idempotency behavior ----------
  PERFORM set_config('request.jwt.claim.role', 'authenticated', true);
  PERFORM set_config('request.jwt.claim.sub', v_owner_uid::text, true);

  -- A manual pre-CAC legal name/RC value must not block the first official CAC verification.
  UPDATE public.merchants
     SET legal_entity_name = 'Manual Drift Guard LLC',
         cac_rc_number = 'RC-123456'
   WHERE id = v_mid;

  PERFORM public.record_cac_verification(
    v_mid,
    'cac/drift-guard.pdf',
    'Drift Guard Limited',
    'RC123456'
  );

  IF EXISTS (
    SELECT 1
      FROM public.merchants
     WHERE id = v_mid
       AND (legal_entity_name IS DISTINCT FROM 'Drift Guard Limited'
            OR cac_rc_number IS DISTINCT FROM 'RC123456')
  ) THEN
    RAISE EXCEPTION 'first CAC verification did not replace manual legal identity values';
  END IF;

  -- Re-verification with harmless case/spacing changes is idempotent and preserves established display values.
  PERFORM public.record_cac_verification(
    v_mid,
    'cac/drift-guard-retry.pdf',
    '  drift   guard   limited  ',
    ' rc-123456 '
  );

  IF EXISTS (
    SELECT 1
      FROM public.merchants
     WHERE id = v_mid
       AND (legal_entity_name IS DISTINCT FROM 'Drift Guard Limited'
            OR cac_rc_number IS DISTINCT FROM 'RC123456')
  ) THEN
    RAISE EXCEPTION 'canonical CAC retry changed established legal identity display values';
  END IF;

  -- A materially different legal identity must surface as an app-visible conflict.
  BEGIN
    PERFORM public.record_cac_verification(
      v_mid,
      'cac/drift-guard-conflict.pdf',
      'Different Legal Name Ltd',
      'RC999999'
    );
    RAISE EXCEPTION 'conflicting CAC identity was accepted';
  EXCEPTION WHEN SQLSTATE 'PT409' THEN NULL; END;

  RAISE NOTICE 'OK: merchant identity drift guards enforced';
END;
$test$ LANGUAGE plpgsql;

ROLLBACK;
