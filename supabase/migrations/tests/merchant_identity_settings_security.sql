BEGIN;
DO $$
DECLARE
  v_user_id uuid := 'a3100000-0000-4000-8000-000000000001';
  v_merchant_id uuid := 'a3100000-0000-4000-8000-000000000002';
  v_session_id uuid := 'a3100000-0000-4000-8000-000000000003';
BEGIN
  INSERT INTO auth.users (
    id, instance_id, aud, role, email, encrypted_password,
    email_confirmed_at, created_at, updated_at,
    raw_app_meta_data, raw_user_meta_data
  ) VALUES (
    v_user_id,
    '00000000-0000-0000-0000-000000000000',
    'authenticated',
    'authenticated',
    'merchant-identity-security@example.com',
    'test',
    now(), now(), now(), '{}'::jsonb, '{}'::jsonb
  ) ON CONFLICT (id) DO NOTHING;
  INSERT INTO public.merchants (
    id, user_id, email, business_name, support_email, phone,
    support_phone, social_media
  ) VALUES (
    v_merchant_id,
    v_user_id,
    'merchant-identity-security@example.com',
    'Secure Store',
    'old@example.com',
    '+2348011111111',
    '+2348022222222',
    '{"instagram":"@old"}'::jsonb
  );
  INSERT INTO auth.sessions (id, user_id, created_at, updated_at, aal)
  VALUES (v_session_id, v_user_id, now(), now(), 'aal1');
END;
$$;
SELECT set_config(
  'request.jwt.claims',
  jsonb_build_object(
    'sub', 'a3100000-0000-4000-8000-000000000001',
    'role', 'authenticated',
    'session_id', 'a3100000-0000-4000-8000-000000000003',
    'aal', 'aal1',
    'amr', jsonb_build_array(
      jsonb_build_object(
        'method', 'password',
        'timestamp', extract(epoch from now() - interval '1 hour')::bigint
      )
    )
  )::text,
  true
);
SET LOCAL ROLE authenticated;
DO $$
BEGIN
  BEGIN
    PERFORM public.update_merchant_identity_settings(
      'a3100000-0000-4000-8000-000000000002',
      '{"business_name":"Missing token"}'::jsonb,
      NULL
    );
    RAISE EXCEPTION 'identity settings update accepted no concurrency token';
  EXCEPTION
    WHEN invalid_parameter_value THEN
      IF SQLERRM <> 'merchant_settings_concurrency_token_required' THEN
        RAISE;
      END IF;
  END;
  BEGIN
    PERFORM public.update_merchant_identity_settings(
      'a3100000-0000-4000-8000-000000000002',
      '{"support_email":"stale@example.com"}'::jsonb,
      (
        SELECT updated_at FROM public.merchants
        WHERE id = 'a3100000-0000-4000-8000-000000000002'
      )
    );
    RAISE EXCEPTION 'stale AAL1 session changed merchant identity settings';
  EXCEPTION
    WHEN insufficient_privilege THEN
      IF SQLERRM <> 'merchant_settings_reauthentication_required' THEN
        RAISE;
      END IF;
  END;
  BEGIN
    UPDATE public.merchants
       SET support_email = 'direct@example.com'
     WHERE id = 'a3100000-0000-4000-8000-000000000002';
    RAISE EXCEPTION 'direct sensitive merchants update bypassed the guard';
  EXCEPTION
    WHEN insufficient_privilege THEN
      IF SQLERRM <> 'merchant_sensitive_update_not_authorized' THEN
        RAISE;
      END IF;
  END;
END;
$$;
SELECT set_config(
  'request.jwt.claims',
  jsonb_build_object(
    'sub', 'a3100000-0000-4000-8000-000000000001',
    'role', 'authenticated',
    'session_id', 'a3100000-0000-4000-8000-000000000003',
    'aal', 'aal1',
    'amr', jsonb_build_array(
      jsonb_build_object(
        'method', 'password',
        'timestamp', extract(epoch from now())::bigint
      )
    )
  )::text,
  true
);
SELECT public.update_merchant_identity_settings(
  'a3100000-0000-4000-8000-000000000002',
  '{"support_email":"new@example.com","phone":"+2348033333333"}'::jsonb,
  (
    SELECT updated_at FROM public.merchants
    WHERE id = 'a3100000-0000-4000-8000-000000000002'
  )
);
SELECT public.update_merchant_social_media(
  'a3100000-0000-4000-8000-000000000002',
  '{"facebook":"https://facebook.com/secure"}'::jsonb,
  false,
  '{}'::jsonb
);
RESET ROLE;
DO $$
DECLARE
  v_email text;
  v_phone text;
  v_social jsonb;
  v_identity_audits integer;
  v_social_audits integer;
BEGIN
  SELECT support_email, phone, social_media
    INTO v_email, v_phone, v_social
    FROM public.merchants
   WHERE id = 'a3100000-0000-4000-8000-000000000002';
  IF v_email IS DISTINCT FROM 'new@example.com'
    OR v_phone IS DISTINCT FROM '+2348033333333'
    OR v_social ->> 'facebook' IS DISTINCT FROM 'https://facebook.com/secure' THEN
    RAISE EXCEPTION 'guarded settings updates did not persist: %, %, %',
      v_email, v_phone, v_social;
  END IF;
  SELECT count(*) FILTER (
           WHERE action = 'merchant_identity_settings_updated'
         ),
         count(*) FILTER (
           WHERE action = 'merchant_social_media_updated'
         )
    INTO v_identity_audits, v_social_audits
    FROM public.audit_logs
   WHERE merchant_id = 'a3100000-0000-4000-8000-000000000002';
  IF v_identity_audits <> 1 OR v_social_audits <> 1 THEN
    RAISE EXCEPTION 'expected identity and social audit rows, got % and %',
      v_identity_audits, v_social_audits;
  END IF;
  IF NOT EXISTS (
    SELECT 1
      FROM public.audit_logs
     WHERE merchant_id = 'a3100000-0000-4000-8000-000000000002'
       AND action = 'merchant_identity_settings_updated'
       AND changes -> 'before' ->> 'support_email' = 'old@example.com'
       AND changes -> 'after' ->> 'support_email' = 'new@example.com'
  ) THEN
    RAISE EXCEPTION 'identity audit did not preserve before/after values';
  END IF;
END;
$$;
INSERT INTO auth.mfa_factors (
  id, user_id, friendly_name, factor_type, status, created_at, updated_at, secret
) VALUES (
  'a3100000-0000-4000-8000-000000000004',
  'a3100000-0000-4000-8000-000000000001',
  'Regression authenticator',
  'totp',
  'verified',
  now(),
  now(),
  'TESTSECRET'
);
SELECT set_config(
  'request.jwt.claims',
  jsonb_build_object(
    'sub', 'a3100000-0000-4000-8000-000000000001',
    'role', 'authenticated',
    'session_id', 'a3100000-0000-4000-8000-000000000003',
    'aal', 'aal1',
    'amr', jsonb_build_array(
      jsonb_build_object(
        'method', 'password',
        'timestamp', extract(epoch from now())::bigint
      )
    )
  )::text,
  true
);
SET LOCAL ROLE authenticated;
DO $$
BEGIN
  BEGIN
    PERFORM public.update_merchant_identity_settings(
      'a3100000-0000-4000-8000-000000000002',
      '{"support_phone":"+2348044444444"}'::jsonb,
      (
        SELECT updated_at FROM public.merchants
        WHERE id = 'a3100000-0000-4000-8000-000000000002'
      )
    );
    RAISE EXCEPTION 'AAL1 session bypassed a verified MFA factor';
  EXCEPTION
    WHEN insufficient_privilege THEN
      IF SQLERRM <> 'merchant_settings_mfa_required' THEN
        RAISE;
      END IF;
  END;
END;
$$;
-- Social links are public branding data, not a payment/identity value. They
-- still require a live, fresh session but must remain editable on the web
-- while the merchant has a verified MFA factor and no AAL2 UI is available.
SELECT public.update_merchant_social_media(
  'a3100000-0000-4000-8000-000000000002',
  '{"linkedin":"https://linkedin.com/company/secure"}'::jsonb,
  false,
  '{}'::jsonb
);
RESET ROLE;
SELECT set_config(
  'request.jwt.claims',
  jsonb_build_object(
    'sub', 'a3100000-0000-4000-8000-000000000001',
    'role', 'authenticated',
    'session_id', 'a3100000-0000-4000-8000-000000000003',
    'aal', 'aal2',
    'amr', '[]'::jsonb
  )::text,
  true
);
SET LOCAL ROLE authenticated;
SELECT public.update_merchant_identity_settings(
  'a3100000-0000-4000-8000-000000000002',
  '{"support_phone":"+2348044444444"}'::jsonb,
  (
    SELECT updated_at FROM public.merchants
    WHERE id = 'a3100000-0000-4000-8000-000000000002'
  )
);
RESET ROLE;
DO $$
DECLARE
  v_support_phone text;
  v_identity_audits integer;
BEGIN
  SELECT support_phone
    INTO v_support_phone
    FROM public.merchants
   WHERE id = 'a3100000-0000-4000-8000-000000000002';
  SELECT count(*)
    INTO v_identity_audits
    FROM public.audit_logs
   WHERE merchant_id = 'a3100000-0000-4000-8000-000000000002'
     AND action = 'merchant_identity_settings_updated';
  IF v_support_phone IS DISTINCT FROM '+2348044444444'
    OR v_identity_audits <> 2 THEN
    RAISE EXCEPTION 'AAL2 update/audit mismatch: %, %',
      v_support_phone, v_identity_audits;
  END IF;
END;
$$;
DELETE FROM auth.sessions
WHERE id = 'a3100000-0000-4000-8000-000000000003';
SELECT set_config(
  'request.jwt.claims',
  jsonb_build_object(
    'sub', 'a3100000-0000-4000-8000-000000000001',
    'role', 'authenticated',
    'session_id', 'a3100000-0000-4000-8000-000000000003',
    'aal', 'aal2',
    'amr', '[]'::jsonb
  )::text,
  true
);
SET LOCAL ROLE authenticated;
DO $$
BEGIN
  BEGIN
    PERFORM public.update_merchant_social_media(
      'a3100000-0000-4000-8000-000000000002',
      '{"youtube":"https://youtube.com/@blocked"}'::jsonb,
      false,
      '{}'::jsonb
    );
    RAISE EXCEPTION 'revoked AAL2 session changed social links';
  EXCEPTION
    WHEN insufficient_privilege THEN
      IF SQLERRM <> 'merchant_settings_reauthentication_required' THEN
        RAISE;
      END IF;
  END;
END;
$$;
RESET ROLE;
ROLLBACK;
