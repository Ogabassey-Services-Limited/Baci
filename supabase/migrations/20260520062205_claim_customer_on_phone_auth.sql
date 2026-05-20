-- Claim or create a storefront customer row for phone-auth users without email.
-- The phone is verified against auth.users.phone before a guest customer row can
-- be linked, so user-writable metadata cannot claim another customer's history.
CREATE OR REPLACE FUNCTION public.claim_customer_on_phone_auth(
  p_merchant_id uuid,
  p_user_id uuid,
  p_phone text,
  p_first_name text DEFAULT NULL,
  p_last_name text DEFAULT NULL
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_auth_phone text;
  v_caller_role text;
  v_caller_uid uuid;
  v_customer_id uuid;
  v_first_name text;
  v_full_name text;
  v_last_name text;
  v_phone text;
BEGIN
  v_caller_uid := (SELECT auth.uid());
  v_caller_role := (SELECT auth.role());
  v_phone := NULLIF(btrim(p_phone), '');
  v_first_name := NULLIF(btrim(p_first_name), '');
  v_last_name := NULLIF(btrim(p_last_name), '');
  v_full_name := NULLIF(concat_ws(' ', v_first_name, v_last_name), '');

  IF v_phone IS NULL THEN
    RAISE EXCEPTION 'phone is required';
  END IF;

  IF v_caller_role <> 'service_role'
     AND (v_caller_uid IS NULL OR v_caller_uid IS DISTINCT FROM p_user_id) THEN
    RAISE EXCEPTION 'not authorized';
  END IF;

  IF v_caller_role <> 'service_role' THEN
    SELECT NULLIF(btrim(phone), '') INTO v_auth_phone
    FROM auth.users
    WHERE id = p_user_id;

    IF v_auth_phone IS NULL OR v_auth_phone IS DISTINCT FROM v_phone THEN
      RAISE EXCEPTION 'not authorized';
    END IF;
  END IF;

  INSERT INTO customers (
    merchant_id,
    user_id,
    email,
    first_name,
    last_name,
    full_name,
    phone,
    auth_provider,
    last_login_at
  )
  VALUES (
    p_merchant_id,
    p_user_id,
    NULL,
    v_first_name,
    v_last_name,
    v_full_name,
    v_phone,
    'phone',
    NOW()
  )
  ON CONFLICT (merchant_id, phone) WHERE phone IS NOT NULL AND phone <> ''
  DO UPDATE SET
    user_id = COALESCE(customers.user_id, EXCLUDED.user_id),
    first_name = COALESCE(customers.first_name, EXCLUDED.first_name),
    last_name = COALESCE(customers.last_name, EXCLUDED.last_name),
    full_name = COALESCE(customers.full_name, EXCLUDED.full_name),
    auth_provider = CASE
      WHEN customers.auth_provider IS NULL OR customers.auth_provider = 'email'
        THEN EXCLUDED.auth_provider
      ELSE customers.auth_provider
    END,
    last_login_at = NOW(),
    updated_at = NOW()
  WHERE customers.user_id IS NULL OR customers.user_id = EXCLUDED.user_id
  RETURNING id INTO v_customer_id;

  IF v_customer_id IS NULL THEN
    RAISE EXCEPTION 'customer phone is already claimed by another user';
  END IF;

  RETURN v_customer_id;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.claim_customer_on_phone_auth(uuid, uuid, text, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.claim_customer_on_phone_auth(uuid, uuid, text, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.claim_customer_on_phone_auth(uuid, uuid, text, text, text) TO service_role;
