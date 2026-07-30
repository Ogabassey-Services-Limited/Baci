-- A fresh AAL1 password session may update guarded identity and social data.
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
