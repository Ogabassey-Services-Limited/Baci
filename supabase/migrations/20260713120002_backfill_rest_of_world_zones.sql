-- Rest-of-world fallback bucket for every store, old and new.
--
-- Guarantees each store owns exactly one catch-all fallback bucket named
-- 'Everywhere else'. No priced options are added here, so shopper-facing
-- behavior is unchanged: a fallback bucket with zero options reads as
-- "delivery not configured yet". The never-unshippable promise only takes
-- effect once the store saves its first delivery option.

-- ---------------------------------------------------------------------------
-- One-time fill for stores that already exist.
-- Skips any store that already owns a fallback bucket, so re-running is safe.
-- ---------------------------------------------------------------------------
INSERT INTO public.merchant_shipping_zones (merchant_id, name, is_rest_of_world, active)
SELECT m.id, 'Everywhere else', true, true
FROM public.merchants AS m
WHERE NOT EXISTS (
  SELECT 1
  FROM public.merchant_shipping_zones AS z
  WHERE z.merchant_id = m.id
    AND z.is_rest_of_world
);

-- ---------------------------------------------------------------------------
-- Keep the promise for stores created later.
--
-- A store is born from application onboarding code, so a database-owned
-- after-insert hook is the self-contained way to guarantee the fallback
-- bucket exists without every caller remembering to add it. Runs as its
-- owner with an empty search path and fully qualified names. The guard makes
-- it a no-op if a fallback bucket is somehow already present.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.create_merchant_rest_of_world_zone()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  INSERT INTO public.merchant_shipping_zones (merchant_id, name, is_rest_of_world, active)
  SELECT NEW.id, 'Everywhere else', true, true
  WHERE NOT EXISTS (
    SELECT 1
    FROM public.merchant_shipping_zones AS z
    WHERE z.merchant_id = NEW.id
      AND z.is_rest_of_world
  );
  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.create_merchant_rest_of_world_zone() IS
  'After a store row is added, ensures it owns a rest-of-world fallback delivery bucket. No priced options are created.';

DROP TRIGGER IF EXISTS trigger_create_merchant_rest_of_world_zone
  ON public.merchants;
CREATE TRIGGER trigger_create_merchant_rest_of_world_zone
  AFTER INSERT ON public.merchants
  FOR EACH ROW
  EXECUTE FUNCTION public.create_merchant_rest_of_world_zone();

NOTIFY pgrst, 'reload schema';
