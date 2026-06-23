-- Merchant recovery-code issuance and acknowledgement RPCs.
--
-- Generation creates a pending code set only; it does not revoke the currently
-- acknowledged set. The swap happens when the merchant confirms the displayed
-- codes were saved, so closing the tab after Generate cannot leave the account
-- with zero usable recovery codes.
--
-- SECURITY DEFINER + fully-qualified names; EXECUTE granted only to
-- service_role because the backing tables are server-only and direct grants are
-- revoked from anon/authenticated.

CREATE OR REPLACE FUNCTION public.create_recovery_code_set(
  p_user_id uuid,
  p_code_hashes text[]
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_code_set_id uuid := gen_random_uuid();
BEGIN
  IF COALESCE((SELECT auth.role()), '') <> 'service_role' THEN
    RAISE EXCEPTION 'create_recovery_code_set requires service_role'
      USING ERRCODE = '42501';
  END IF;

  IF COALESCE(array_length(p_code_hashes, 1), 0) = 0 THEN
    RAISE EXCEPTION 'recovery_code_hashes_required'
      USING ERRCODE = 'P0001';
  END IF;

  -- Serialize per merchant so retries/two-tab generation cannot interleave
  -- with acknowledgement or create partially-observable replacement sets.
  PERFORM pg_advisory_xact_lock(hashtextextended(p_user_id::text, 0));

  INSERT INTO public.merchant_auth_recovery_codes (user_id, code_set_id, code_hash)
    SELECT p_user_id, v_code_set_id, unnest(p_code_hashes);

  RETURN v_code_set_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.acknowledge_recovery_code_set(
  p_user_id uuid,
  p_code_set_id uuid
) RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_active_code_count integer;
BEGIN
  IF COALESCE((SELECT auth.role()), '') <> 'service_role' THEN
    RAISE EXCEPTION 'acknowledge_recovery_code_set requires service_role'
      USING ERRCODE = '42501';
  END IF;

  -- Serialize with generation and other acknowledgement attempts for this user.
  PERFORM pg_advisory_xact_lock(hashtextextended(p_user_id::text, 0));

  SELECT COUNT(*)::integer
  INTO v_active_code_count
  FROM public.merchant_auth_recovery_codes
  WHERE user_id = p_user_id
    AND code_set_id = p_code_set_id
    AND used_at IS NULL
    AND revoked_at IS NULL;

  IF v_active_code_count = 0 THEN
    RETURN false;
  END IF;

  INSERT INTO public.merchant_auth_readiness (
    user_id,
    acknowledged_code_set_id,
    recovery_codes_acknowledged_at,
    updated_at
  )
  VALUES (
    p_user_id,
    p_code_set_id,
    now(),
    now()
  )
  ON CONFLICT (user_id) DO UPDATE
    SET acknowledged_code_set_id = EXCLUDED.acknowledged_code_set_id,
        recovery_codes_acknowledged_at = EXCLUDED.recovery_codes_acknowledged_at,
        updated_at = EXCLUDED.updated_at;

  -- Now that the merchant confirmed the new set was saved, revoke all other
  -- unused sets. This preserves the prior acknowledged fallback until save.
  UPDATE public.merchant_auth_recovery_codes
    SET revoked_at = now()
    WHERE user_id = p_user_id
      AND code_set_id IS DISTINCT FROM p_code_set_id
      AND used_at IS NULL
      AND revoked_at IS NULL;

  RETURN true;
END;
$$;

REVOKE ALL ON FUNCTION public.create_recovery_code_set(uuid, text[]) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.create_recovery_code_set(uuid, text[]) TO service_role;

REVOKE ALL ON FUNCTION public.acknowledge_recovery_code_set(uuid, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.acknowledge_recovery_code_set(uuid, uuid) TO service_role;
