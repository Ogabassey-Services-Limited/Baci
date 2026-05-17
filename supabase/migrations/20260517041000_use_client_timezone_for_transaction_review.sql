DROP FUNCTION IF EXISTS public.update_transaction_review_details(
  uuid,
  uuid,
  uuid,
  numeric,
  text,
  timestamptz
);

CREATE OR REPLACE FUNCTION public.update_transaction_review_details(
  p_merchant_id uuid,
  p_product_id uuid,
  p_order_id uuid,
  p_cost_price numeric,
  p_supplier_name text,
  p_transaction_date timestamptz,
  p_client_timezone text DEFAULT NULL
) RETURNS void
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path TO 'public'
AS $$
DECLARE
  v_product_rows integer;
  v_order_rows integer;
  v_supplier_name text := btrim(COALESCE(p_supplier_name, ''));
  v_transaction_time_zone text := NULLIF(
    btrim(COALESCE(p_client_timezone, '')),
    ''
  );
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

  IF v_transaction_time_zone IS NULL THEN
    v_transaction_time_zone := 'Africa/Lagos';
  END IF;

  PERFORM 1
  FROM pg_timezone_names
  WHERE name = v_transaction_time_zone;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Transaction timezone is invalid'
      USING ERRCODE = '22023';
  END IF;

  IF (p_transaction_date AT TIME ZONE v_transaction_time_zone)::date >
    (now() AT TIME ZONE v_transaction_time_zone)::date THEN
    RAISE EXCEPTION 'Transaction date cannot be in the future'
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
  timestamptz,
  text
) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.update_transaction_review_details(
  uuid,
  uuid,
  uuid,
  numeric,
  text,
  timestamptz,
  text
) TO authenticated;
