-- Migration: Add get_merchant_verification_status RPC
-- Purpose: Allows the KYC frontend to fetch verification status for display
-- Rollback: DROP FUNCTION IF EXISTS public.get_merchant_verification_status(UUID);

CREATE OR REPLACE FUNCTION public.get_merchant_verification_status(p_merchant_id UUID)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller_uid UUID;
  v_result jsonb;
BEGIN
  v_caller_uid := auth.uid();
  IF NOT EXISTS (
    SELECT 1 FROM merchants WHERE id = p_merchant_id AND user_id = v_caller_uid
  ) THEN
    RAISE EXCEPTION 'not authorized';
  END IF;

  SELECT jsonb_build_object(
    'nin_verified', COALESCE(mv.nin_verified, false),
    'bvn_verified', COALESCE(mv.bvn_verified, false),
    'cac_verified', COALESCE(mv.cac_verified, false),
    'cac_approved_name', mv.cac_approved_name,
    'first_name', mv.first_name,
    'last_name', mv.last_name,
    'date_of_birth', mv.date_of_birth
  ) INTO v_result
  FROM merchant_verifications mv
  WHERE mv.merchant_id = p_merchant_id;

  RETURN COALESCE(
    v_result,
    '{"nin_verified":false,"bvn_verified":false,"cac_verified":false,"cac_approved_name":null,"first_name":null,"last_name":null,"date_of_birth":null}'::jsonb
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.get_merchant_verification_status(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_merchant_verification_status(UUID) TO authenticated;
