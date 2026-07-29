-- Dashboard-safe identity verification readiness capability.
--
-- This function intentionally returns only aggregate verified/not-verified
-- state for readiness and never exposes identity values or individual
-- verification flags.

CREATE OR REPLACE FUNCTION public.get_merchant_identity_verified(
  p_merchant_id uuid
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT CASE
    WHEN public.has_merchant_access(p_merchant_id) IS NOT TRUE THEN false
    ELSE EXISTS (
      SELECT 1
      FROM public.merchant_verifications mv
      WHERE mv.merchant_id = p_merchant_id
        AND (
          mv.nin_verified IS TRUE
          OR mv.bvn_verified IS TRUE
          OR mv.cac_verified IS TRUE
        )
    )
  END;
$$;

ALTER FUNCTION public.get_merchant_identity_verified(uuid) OWNER TO postgres;
REVOKE ALL ON FUNCTION public.get_merchant_identity_verified(uuid)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_merchant_identity_verified(uuid)
  TO authenticated;
