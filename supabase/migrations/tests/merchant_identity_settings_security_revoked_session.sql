-- A revoked AAL2 session cannot use the social-media RPC.
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
