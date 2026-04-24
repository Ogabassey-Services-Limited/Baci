-- Staff-safe verification status RPC
--
-- The existing `get_merchant_verification_status` RPC is owner-only and raises
-- "not authorized" for staff sessions. That caused mobile-admin's store
-- readiness checklist to hide the publish CTA for staff with `settings.edit`,
-- even though `/api/merchant/publish` accepts them. This RPC returns only the
-- non-sensitive verified flags and allows owners plus staff with
-- `settings.edit` permission to read them, matching the publish gate.

CREATE OR REPLACE FUNCTION "public"."get_merchant_verification_flags"(
  "p_merchant_id" "uuid"
) RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_caller_uid UUID;
  v_is_owner BOOLEAN;
  v_result jsonb;
BEGIN
  v_caller_uid := auth.uid();
  IF v_caller_uid IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM merchants
    WHERE id = p_merchant_id AND user_id = v_caller_uid
  ) INTO v_is_owner;

  IF NOT v_is_owner
     AND NOT check_staff_permission(v_caller_uid, p_merchant_id, 'settings', 'edit')
  THEN
    RAISE EXCEPTION 'not authorized';
  END IF;

  SELECT jsonb_build_object(
    'nin_verified', COALESCE(mv.nin_verified, false),
    'bvn_verified', COALESCE(mv.bvn_verified, false),
    'cac_verified', COALESCE(mv.cac_verified, false)
  ) INTO v_result
  FROM merchant_verifications mv
  WHERE mv.merchant_id = p_merchant_id;

  RETURN COALESCE(
    v_result,
    '{"nin_verified":false,"bvn_verified":false,"cac_verified":false}'::jsonb
  );
END;
$$;

ALTER FUNCTION "public"."get_merchant_verification_flags"("p_merchant_id" "uuid")
  OWNER TO "postgres";

REVOKE ALL ON FUNCTION "public"."get_merchant_verification_flags"("p_merchant_id" "uuid") FROM PUBLIC;
GRANT EXECUTE ON FUNCTION "public"."get_merchant_verification_flags"("p_merchant_id" "uuid") TO "authenticated";
GRANT EXECUTE ON FUNCTION "public"."get_merchant_verification_flags"("p_merchant_id" "uuid") TO "service_role";

COMMENT ON FUNCTION "public"."get_merchant_verification_flags"("p_merchant_id" "uuid")
  IS 'Returns verification flags (nin/bvn/cac verified booleans) for a merchant. Accessible to the owner and staff with settings.edit permission. Used by the mobile-admin readiness checklist so staff see the same publish gate as the publish API.';
