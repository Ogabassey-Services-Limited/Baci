-- Append-only hardening:
-- Normalize p_full_name (trim + empty-to-NULL) to prevent blank names from
-- overwriting real names during upsert_customer_on_auth conflict updates.

CREATE OR REPLACE FUNCTION public.upsert_customer_on_auth(
  p_merchant_id UUID,
  p_user_id UUID,
  p_email TEXT,
  p_full_name TEXT DEFAULT NULL,
  p_phone TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
-- SECURITY DEFINER is intentional for this RPC path. Authorization is enforced
-- in-function via v_caller_uid/v_caller_role/v_caller_email checks below.
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_customer_id UUID;
  v_caller_uid UUID;
  v_caller_role TEXT;
  v_caller_email TEXT;
  v_normalized_full_name TEXT;
  v_default_full_name TEXT;
BEGIN
  v_caller_uid := (SELECT auth.uid());
  v_caller_role := (SELECT auth.role());
  v_caller_email := COALESCE(
    NULLIF(current_setting('request.jwt.claim.email', true), ''),
    NULLIF(auth.jwt() ->> 'email', '')
  );
  v_normalized_full_name := NULLIF(btrim(p_full_name), '');
  v_default_full_name := NULLIF(split_part(COALESCE(p_email, ''), '@', 1), '');

  IF v_caller_role <> 'service_role'
     AND (v_caller_uid IS NULL OR v_caller_uid IS DISTINCT FROM p_user_id) THEN
    RAISE EXCEPTION 'not authorized';
  END IF;

  IF v_caller_role <> 'service_role'
     AND (
       p_email IS NULL
       OR v_caller_email IS NULL
       OR lower(p_email) IS DISTINCT FROM lower(v_caller_email)
     ) THEN
    RAISE EXCEPTION 'not authorized';
  END IF;

  INSERT INTO customers (merchant_id, user_id, email, full_name, phone, last_login_at)
  VALUES (
    p_merchant_id,
    p_user_id,
    p_email,
    COALESCE(v_normalized_full_name, v_default_full_name),
    p_phone,
    NOW()
  )
  ON CONFLICT (merchant_id, email) WHERE email IS NOT NULL
  DO UPDATE SET
    user_id = COALESCE(customers.user_id, EXCLUDED.user_id),
    full_name = CASE
      WHEN v_normalized_full_name IS NULL THEN customers.full_name -- Blank/missing input: keep existing.
      WHEN EXCLUDED.full_name = v_default_full_name
           AND customers.full_name IS NOT NULL THEN customers.full_name -- Don't overwrite real name with email-derived default.
      ELSE EXCLUDED.full_name -- Use provided name.
    END,
    phone = COALESCE(EXCLUDED.phone, customers.phone),
    last_login_at = NOW(),
    updated_at = NOW()
  WHERE customers.user_id IS NULL OR customers.user_id = EXCLUDED.user_id
  RETURNING id INTO v_customer_id;

  IF v_customer_id IS NULL THEN
    RAISE EXCEPTION 'customer email is already claimed by another user';
  END IF;

  RETURN v_customer_id;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.upsert_customer_on_auth(UUID, UUID, TEXT, TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.upsert_customer_on_auth(UUID, UUID, TEXT, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.upsert_customer_on_auth(UUID, UUID, TEXT, TEXT, TEXT) TO service_role;
