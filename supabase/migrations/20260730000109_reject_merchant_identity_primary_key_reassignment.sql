-- Audit rows are keyed to the merchant UUID. A reassignment would detach prior
-- immutable history, so reject it before any dependent trigger can run.

CREATE OR REPLACE FUNCTION private.reject_merchant_identity_primary_key_reassignment_v1()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF OLD.id IS DISTINCT FROM NEW.id THEN
    RAISE EXCEPTION 'audit_merchant_identity_primary_key_reassignment_forbidden'
      USING ERRCODE = '22023';
  END IF;
  RETURN NEW;
END;
$$;

ALTER FUNCTION private.reject_merchant_identity_primary_key_reassignment_v1()
  OWNER TO postgres;
REVOKE ALL ON FUNCTION private.reject_merchant_identity_primary_key_reassignment_v1()
  FROM PUBLIC, anon, authenticated, service_role;

DROP TRIGGER IF EXISTS audit_merchant_identity_primary_key_guard_v1 ON public.merchants;
CREATE TRIGGER audit_merchant_identity_primary_key_guard_v1
  BEFORE UPDATE OF id ON public.merchants
  FOR EACH ROW
  WHEN (OLD.id IS DISTINCT FROM NEW.id)
  EXECUTE FUNCTION private.reject_merchant_identity_primary_key_reassignment_v1();
