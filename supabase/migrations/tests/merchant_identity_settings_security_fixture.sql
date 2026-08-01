-- Shared fixture for the merchant identity settings replay-gate checks.
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
