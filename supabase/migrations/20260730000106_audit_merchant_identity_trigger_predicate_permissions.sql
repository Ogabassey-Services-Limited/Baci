-- PostgreSQL evaluates trigger WHEN expressions with the statement role's
-- function privileges. Permit only roles that can mutate merchants to execute
-- the two pure predicate helpers; keep the private schema and writer functions
-- inaccessible.

REVOKE EXECUTE ON FUNCTION
  private.merchant_identity_audit_row_is_bounded_v2(public.merchants)
  FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION
  private.project_merchant_social_media_for_audit_v1(jsonb)
  FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION
  private.merchant_identity_audit_row_is_bounded_v2(public.merchants)
  TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION
  private.project_merchant_social_media_for_audit_v1(jsonb)
  TO authenticated, service_role;
