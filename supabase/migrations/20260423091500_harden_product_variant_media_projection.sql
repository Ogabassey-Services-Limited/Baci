REVOKE ALL
ON FUNCTION public.refresh_product_variant_media_projection(UUID)
FROM PUBLIC;

CREATE OR REPLACE FUNCTION public.sync_product_variant_media_projection()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  previous_product_id UUID := CASE
    WHEN TG_OP IN ('UPDATE', 'DELETE') THEN OLD.product_id
    ELSE NULL
  END;
  current_product_id UUID := CASE
    WHEN TG_OP IN ('INSERT', 'UPDATE') THEN NEW.product_id
    ELSE NULL
  END;
BEGIN
  IF current_product_id IS NOT NULL THEN
    PERFORM public.refresh_product_variant_media_projection(current_product_id);
  END IF;

  IF previous_product_id IS NOT NULL
     AND previous_product_id IS DISTINCT FROM current_product_id THEN
    PERFORM public.refresh_product_variant_media_projection(previous_product_id);
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$;

REVOKE ALL
ON FUNCTION public.sync_product_variant_media_projection()
FROM PUBLIC;
