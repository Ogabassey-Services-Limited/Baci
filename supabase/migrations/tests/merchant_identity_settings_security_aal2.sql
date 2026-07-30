-- A verified MFA factor permits a guarded identity write only at AAL2.
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
