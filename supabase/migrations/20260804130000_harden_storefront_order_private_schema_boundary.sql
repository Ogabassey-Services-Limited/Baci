-- The public checkout wrapper is the authenticated storefront boundary. Keep
-- the private schema inaccessible to authenticated clients while executing the
-- private implementation with the function owner's privileges.
ALTER FUNCTION public.create_storefront_order(
  uuid, text, text, jsonb, text, numeric, numeric, numeric, text, text,
  text, jsonb, text, text, jsonb, uuid, text, text, uuid, text, numeric,
  numeric, text, text
) OWNER TO postgres;

ALTER FUNCTION public.create_storefront_order(
  uuid, text, text, jsonb, text, numeric, numeric, numeric, text, text,
  text, jsonb, text, text, jsonb, uuid, text, text, uuid, text, numeric,
  numeric, text, text
) SECURITY DEFINER;

ALTER FUNCTION public.create_storefront_order(
  uuid, text, text, jsonb, text, numeric, numeric, numeric, text, text,
  text, jsonb, text, text, jsonb, uuid, text, text, uuid, text, numeric,
  numeric, text, text
) SET search_path = public;

REVOKE USAGE ON SCHEMA private FROM authenticated;
