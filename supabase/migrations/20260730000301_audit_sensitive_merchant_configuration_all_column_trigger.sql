-- The classification check lives in the trigger function, so every UPDATE
-- must invoke it. Its no-change return keeps unrelated writes silent.

DROP TRIGGER IF EXISTS audit_sensitive_merchant_configuration_change_v1 ON public.merchants;
CREATE TRIGGER audit_sensitive_merchant_configuration_change_v1
  AFTER INSERT OR DELETE OR UPDATE ON public.merchants
  FOR EACH ROW
  EXECUTE FUNCTION private.audit_sensitive_merchant_configuration_change_v1();
