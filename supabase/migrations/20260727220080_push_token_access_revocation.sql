CREATE OR REPLACE FUNCTION private.deactivate_revoked_staff_push_tokens()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF OLD.user_id IS NOT NULL AND OLD.merchant_id IS NOT NULL
     AND NOT EXISTS (
       SELECT 1 FROM public.merchants AS merchant
       WHERE merchant.id = OLD.merchant_id AND merchant.user_id = OLD.user_id
     )
     AND NOT EXISTS (
       SELECT 1 FROM public.staff_members AS staff
       WHERE staff.merchant_id = OLD.merchant_id
         AND staff.user_id = OLD.user_id
         AND staff.status = 'active'
     ) THEN
    UPDATE public.push_tokens AS token
    SET is_active = false,
        deactivation_reason = 'MerchantAccessRevoked',
        deactivated_at = now(),
        updated_at = now()
    WHERE token.user_id = OLD.user_id
      AND token.merchant_id = OLD.merchant_id
      AND token.app_type = 'admin'
      AND token.is_active IS TRUE;
  END IF;
  RETURN OLD;
END;
$$;

CREATE OR REPLACE FUNCTION private.deactivate_replaced_owner_push_tokens()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF OLD.user_id IS NOT NULL AND NEW.user_id IS DISTINCT FROM OLD.user_id
     AND NOT EXISTS (
       SELECT 1 FROM public.staff_members AS staff
       WHERE staff.merchant_id = OLD.id
         AND staff.user_id = OLD.user_id
         AND staff.status = 'active'
     ) THEN
    UPDATE public.push_tokens AS token
    SET is_active = false,
        deactivation_reason = 'MerchantAccessRevoked',
        deactivated_at = now(),
        updated_at = now()
    WHERE token.user_id = OLD.user_id
      AND token.merchant_id = OLD.id
      AND token.app_type = 'admin'
      AND token.is_active IS TRUE;
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION private.deactivate_revoked_customer_push_tokens()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF OLD.user_id IS NOT NULL AND OLD.merchant_id IS NOT NULL
     AND NOT EXISTS (
       SELECT 1 FROM public.customers AS customer
       WHERE customer.merchant_id = OLD.merchant_id
         AND customer.user_id = OLD.user_id
         AND customer.deleted_at IS NULL
     ) THEN
    UPDATE public.push_tokens AS token
    SET is_active = false,
        deactivation_reason = 'CustomerAccessRevoked',
        deactivated_at = now(),
        updated_at = now()
    WHERE token.user_id = OLD.user_id
      AND token.merchant_id = OLD.merchant_id
      AND token.app_type = 'storefront'
      AND token.is_active IS TRUE;
  END IF;
  RETURN OLD;
END;
$$;

ALTER FUNCTION private.deactivate_revoked_staff_push_tokens() OWNER TO postgres;
ALTER FUNCTION private.deactivate_replaced_owner_push_tokens() OWNER TO postgres;
ALTER FUNCTION private.deactivate_revoked_customer_push_tokens() OWNER TO postgres;
REVOKE ALL ON FUNCTION private.deactivate_revoked_staff_push_tokens()
  FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION private.deactivate_replaced_owner_push_tokens()
  FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION private.deactivate_revoked_customer_push_tokens()
  FROM PUBLIC, anon, authenticated, service_role;

DROP TRIGGER IF EXISTS deactivate_revoked_staff_push_tokens ON public.staff_members;
CREATE TRIGGER deactivate_revoked_staff_push_tokens
  AFTER UPDATE OF status, user_id, merchant_id OR DELETE ON public.staff_members
  FOR EACH ROW EXECUTE FUNCTION private.deactivate_revoked_staff_push_tokens();

DROP TRIGGER IF EXISTS deactivate_replaced_owner_push_tokens ON public.merchants;
CREATE TRIGGER deactivate_replaced_owner_push_tokens
  AFTER UPDATE OF user_id ON public.merchants
  FOR EACH ROW EXECUTE FUNCTION private.deactivate_replaced_owner_push_tokens();

DROP TRIGGER IF EXISTS deactivate_revoked_customer_push_tokens ON public.customers;
CREATE TRIGGER deactivate_revoked_customer_push_tokens
  AFTER UPDATE OF deleted_at, user_id, merchant_id OR DELETE ON public.customers
  FOR EACH ROW EXECUTE FUNCTION private.deactivate_revoked_customer_push_tokens();

-- One-time cleanup uses exactly the same ownership predicates as the triggers.
UPDATE public.push_tokens AS token
SET is_active = false,
    deactivation_reason = 'MerchantAccessRevoked',
    deactivated_at = now(),
    updated_at = now()
WHERE token.is_active IS TRUE
  AND token.app_type = 'admin'
  AND (
    token.user_id IS NULL OR (
  NOT EXISTS (
    SELECT 1 FROM public.merchants AS merchant
    WHERE merchant.id = token.merchant_id AND merchant.user_id = token.user_id
  )
  AND NOT EXISTS (
    SELECT 1 FROM public.staff_members AS staff
    WHERE staff.merchant_id = token.merchant_id
      AND staff.user_id = token.user_id
      AND staff.status = 'active'
  )));

UPDATE public.push_tokens AS token
SET is_active = false,
    deactivation_reason = 'CustomerAccessRevoked',
    deactivated_at = now(),
    updated_at = now()
WHERE token.is_active IS TRUE
  AND token.app_type = 'storefront'
  AND (
    token.user_id IS NULL
    OR NOT EXISTS (
      SELECT 1 FROM public.customers AS customer
      WHERE customer.merchant_id = token.merchant_id
        AND customer.user_id = token.user_id
        AND customer.deleted_at IS NULL
    )
  );

COMMENT ON COLUMN public.push_tokens.deactivation_reason IS
  'Why the token was deactivated: UserLogout, MerchantAccessRevoked, CustomerAccessRevoked, temporary LegacyDirectLogout, Expo ticket/receipt error code (DeviceNotRegistered, InvalidCredentials), or StaleLastUsed. NULL while active.';
