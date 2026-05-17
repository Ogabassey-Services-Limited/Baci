ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS transaction_date timestamptz;

ALTER TABLE public.orders
  ALTER COLUMN transaction_date SET DEFAULT now();

CREATE INDEX IF NOT EXISTS idx_orders_merchant_transaction_date
  ON public.orders (merchant_id, transaction_date DESC);

CREATE OR REPLACE FUNCTION public.update_transaction_review_details(
  p_merchant_id uuid,
  p_product_id uuid,
  p_order_id uuid,
  p_cost_price numeric,
  p_supplier_name text,
  p_transaction_date timestamptz
) RETURNS void
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path TO 'public'
AS $$
DECLARE
  v_product_rows integer;
  v_order_rows integer;
  v_supplier_name text := btrim(COALESCE(p_supplier_name, ''));
BEGIN
  IF p_merchant_id IS NULL THEN
    RAISE EXCEPTION 'Merchant is required'
      USING ERRCODE = '22023';
  END IF;

  IF p_product_id IS NULL THEN
    RAISE EXCEPTION 'Product is required'
      USING ERRCODE = '22023';
  END IF;

  IF p_order_id IS NULL THEN
    RAISE EXCEPTION 'Transaction is required'
      USING ERRCODE = '22023';
  END IF;

  IF p_cost_price IS NULL OR p_cost_price < 0 THEN
    RAISE EXCEPTION 'Cost price must be a non-negative number'
      USING ERRCODE = '22023';
  END IF;

  IF p_transaction_date IS NULL THEN
    RAISE EXCEPTION 'Transaction date is required'
      USING ERRCODE = '22023';
  END IF;

  UPDATE public.products
  SET
    cost_price = p_cost_price,
    metadata = CASE
      WHEN v_supplier_name = '' THEN
        COALESCE(metadata, '{}'::jsonb)
          - 'supplier_name'
          - 'supplier'
          - 'vendor_name'
          - 'vendor'
      ELSE
        (
          COALESCE(metadata, '{}'::jsonb)
            - 'supplier'
            - 'vendor'
        ) || jsonb_build_object(
          'supplier_name', v_supplier_name,
          'vendor_name', v_supplier_name
        )
    END,
    updated_at = now()
  WHERE id = p_product_id
    AND merchant_id = p_merchant_id;

  GET DIAGNOSTICS v_product_rows = ROW_COUNT;

  IF v_product_rows = 0 THEN
    RAISE EXCEPTION 'Product not found for this merchant, or you no longer have permission to update it'
      USING ERRCODE = 'P0001';
  END IF;

  UPDATE public.orders
  SET transaction_date = p_transaction_date
  WHERE id = p_order_id
    AND merchant_id = p_merchant_id;

  GET DIAGNOSTICS v_order_rows = ROW_COUNT;

  IF v_order_rows = 0 THEN
    RAISE EXCEPTION 'Transaction not found for this merchant, or you no longer have permission to update it'
      USING ERRCODE = 'P0001';
  END IF;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.update_transaction_review_details(
  uuid,
  uuid,
  uuid,
  numeric,
  text,
  timestamptz
) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.update_transaction_review_details(
  uuid,
  uuid,
  uuid,
  numeric,
  text,
  timestamptz
) TO authenticated;
