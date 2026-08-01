-- A verified MFA factor blocks identity writes at AAL1 but not social updates.
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
-- Social links are public branding data. They require a live, fresh session,
-- but remain editable while an MFA factor exists and the web lacks an AAL2 UI.
SELECT public.update_merchant_social_media(
  'a3100000-0000-4000-8000-000000000002',
  '{"linkedin":"https://linkedin.com/company/secure"}'::jsonb,
  false,
  '{}'::jsonb
);
RESET ROLE;

-- A normalized no-op social draft must not require recent auth or create writes.
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
DECLARE
  v_updated_at timestamptz;
  v_social_audits integer;
BEGIN
  SELECT updated_at,
         (
           SELECT count(*)
             FROM public.audit_logs
            WHERE merchant_id = 'a3100000-0000-4000-8000-000000000002'
              AND action = 'merchant_social_media_updated'
         )
    INTO v_updated_at, v_social_audits
    FROM public.merchants
   WHERE id = 'a3100000-0000-4000-8000-000000000002';

  PERFORM public.update_merchant_social_media(
    'a3100000-0000-4000-8000-000000000002',
    '{"twitter":"","facebook":"https://facebook.com/secure","instagram":"@old","tiktok":"","youtube":"","pinterest":"","linkedin":"https://linkedin.com/company/secure","snapchat":""}'::jsonb,
    false,
    '{}'::jsonb
  );

  IF EXISTS (
    SELECT 1
      FROM public.merchants
     WHERE id = 'a3100000-0000-4000-8000-000000000002'
       AND updated_at IS DISTINCT FROM v_updated_at
  ) THEN
    RAISE EXCEPTION 'unchanged social payload updated the merchant row';
  END IF;

  IF (
    SELECT count(*)
      FROM public.audit_logs
     WHERE merchant_id = 'a3100000-0000-4000-8000-000000000002'
       AND action = 'merchant_social_media_updated'
  ) <> v_social_audits THEN
    RAISE EXCEPTION 'unchanged social payload created an audit row';
  END IF;
END;
$$;
RESET ROLE;
