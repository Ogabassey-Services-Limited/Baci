-- Independent product offers and key specs are part of public storefront data.
-- Derive the tenant and active product state from products, never relation input.

CREATE FUNCTION public.enqueue_storefront_cache_from_product_relation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_old_product_id uuid := CASE WHEN TG_OP <> 'INSERT' THEN OLD.product_id END;
  v_new_product_id uuid := CASE WHEN TG_OP <> 'DELETE' THEN NEW.product_id END;
  v_product record;
BEGIN
  FOR v_product IN
    WITH relation_product_ids(product_id) AS (
      VALUES (v_old_product_id), (v_new_product_id)
    )
    SELECT DISTINCT product.id, product.merchant_id, product.slug
    FROM relation_product_ids AS relation
    JOIN public.products AS product ON product.id = relation.product_id
    WHERE product.status = 'active'
  LOOP
    PERFORM public.enqueue_storefront_cache_targets(
      v_product.merchant_id,
      NULL,
      NULL,
      ARRAY[v_product.slug, v_product.id::text]
    );
  END LOOP;
  RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
END;
$$;
REVOKE ALL ON FUNCTION public.enqueue_storefront_cache_from_product_relation()
  FROM PUBLIC, anon, authenticated, service_role;

DROP TRIGGER IF EXISTS product_offers_enqueue_cache_invalidation
  ON public.product_offers;
CREATE TRIGGER product_offers_enqueue_cache_invalidation
AFTER INSERT OR UPDATE OR DELETE ON public.product_offers
FOR EACH ROW
EXECUTE FUNCTION public.enqueue_storefront_cache_from_product_relation();

DROP TRIGGER IF EXISTS product_key_specs_enqueue_cache_invalidation
  ON public.product_key_specs;
CREATE TRIGGER product_key_specs_enqueue_cache_invalidation
AFTER INSERT OR UPDATE OR DELETE ON public.product_key_specs
FOR EACH ROW
EXECUTE FUNCTION public.enqueue_storefront_cache_from_product_relation();
