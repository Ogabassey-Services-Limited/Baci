-- Guarded writes persist their values and leave a complete audit trail.
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
