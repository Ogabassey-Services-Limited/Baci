CREATE OR REPLACE FUNCTION private.enforce_product_insert_limit()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NEW.status = 'archived' THEN
    RETURN NEW;
  END IF;

  PERFORM private.enforce_mobile_admin_product_limit(NEW.merchant_id, NEW.id);

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS enforce_product_insert_limit ON public.products;
CREATE TRIGGER enforce_product_insert_limit
  BEFORE INSERT ON public.products
  FOR EACH ROW
  EXECUTE FUNCTION private.enforce_product_insert_limit();

REVOKE ALL ON FUNCTION private.enforce_product_insert_limit() FROM PUBLIC, anon, authenticated, service_role;
