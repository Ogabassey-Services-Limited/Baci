-- Direct sensitive writes and stale sessions cannot bypass the guarded RPC.
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
RESET ROLE;
