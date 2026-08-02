-- Route identity changes by the payload that can actually enter the immutable
-- ledger. Raw asset query and fragment text is intentionally excluded.

CREATE OR REPLACE FUNCTION private.merchant_identity_audit_row_is_bounded_v2(
  p_merchant public.merchants
)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT pg_catalog.octet_length(
    pg_catalog.jsonb_build_object(
      'exact', private.project_merchant_identity_exact_values_v3(p_merchant),
      'presence', private.project_merchant_identity_presence_values_v3(p_merchant)
    )::text
  ) <= 16384;
$$;

ALTER FUNCTION private.merchant_identity_audit_row_is_bounded_v2(public.merchants)
  OWNER TO postgres;
REVOKE ALL ON FUNCTION private.merchant_identity_audit_row_is_bounded_v2(public.merchants)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION private.merchant_identity_audit_row_is_bounded_v2(public.merchants)
  TO authenticated, service_role;
