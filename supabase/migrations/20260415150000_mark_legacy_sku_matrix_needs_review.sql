-- Mark the remaining legacy products that cannot be auto-converted into the
-- current sku_matrix shape without losing offer-only data.

DO $$
DECLARE
  affected_count INTEGER;
BEGIN
  UPDATE public.products AS p
  SET migration_status = 'needs_review'
  WHERE p.variant_model = 'legacy'
    AND (
      (
        EXISTS (
          SELECT 1
          FROM public.product_variants AS pv
          WHERE pv.product_id = p.id
        )
        AND EXISTS (
          SELECT 1
          FROM public.product_offers AS po
          WHERE po.product_id = p.id
        )
      )
      OR (
        EXISTS (
          SELECT 1
          FROM public.product_offers AS po
          WHERE po.product_id = p.id
        )
        AND (
          p.compare_at_price IS NOT NULL
          OR EXISTS (
            SELECT 1
            FROM public.product_offers AS po
            WHERE po.product_id = p.id
              AND (
                po.compare_at_price IS NOT NULL
                OR po.grade IS NOT NULL
                OR NULLIF(btrim(COALESCE(po.condition_notes, '')), '') IS NOT NULL
                OR COALESCE(po.status, 'active') <> 'active'
              )
          )
        )
      )
    );

  GET DIAGNOSTICS affected_count = ROW_COUNT;
  RAISE NOTICE 'Migration marked % legacy products as needs_review', affected_count;
END;
$$;
