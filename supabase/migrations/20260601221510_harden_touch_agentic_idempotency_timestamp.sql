-- Keep the hardened empty search_path trigger function explicit about pg_catalog.
CREATE OR REPLACE FUNCTION public.touch_agentic_idempotency_records_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $function$
BEGIN
  NEW.updated_at = pg_catalog.now();
  RETURN NEW;
END;
$function$;
