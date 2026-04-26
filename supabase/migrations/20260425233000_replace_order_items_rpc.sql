CREATE OR REPLACE FUNCTION public.replace_order_items(
  p_order_id UUID,
  p_items JSONB
)
RETURNS VOID
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_order_id UUID;
  v_items JSONB := COALESCE(p_items, '[]'::jsonb);
  v_item RECORD;
BEGIN
  SELECT id
  INTO v_order_id
  FROM public.orders
  WHERE id = p_order_id
  FOR UPDATE;

  IF v_order_id IS NULL THEN
    RAISE EXCEPTION 'Order % does not exist', p_order_id;
  END IF;

  IF jsonb_typeof(v_items) <> 'array' THEN
    RAISE EXCEPTION 'Order items payload must be a JSON array for order %', p_order_id;
  END IF;

  FOR v_item IN
    SELECT
      source.item_index,
      item.*
    FROM jsonb_array_elements(v_items) WITH ORDINALITY AS source(item_json, item_index)
    CROSS JOIN LATERAL jsonb_to_record(source.item_json) AS item (
      product_id UUID,
      name TEXT,
      price NUMERIC,
      quantity INTEGER,
      fulfillment_data JSONB,
      line_id INTEGER,
      line_extension_amount NUMERIC,
      item_description TEXT,
      sellers_item_id TEXT,
      image_url TEXT
    )
  LOOP
    IF v_item.name IS NULL OR btrim(v_item.name) = '' THEN
      RAISE EXCEPTION 'Invalid order item at index % for order %: name is required',
        v_item.item_index,
        p_order_id;
    END IF;

    IF v_item.price IS NULL THEN
      RAISE EXCEPTION 'Invalid order item at index % for order %: price is required',
        v_item.item_index,
        p_order_id;
    END IF;

    IF v_item.price < 0 THEN
      RAISE EXCEPTION 'Invalid order item at index % for order %: price must be non-negative',
        v_item.item_index,
        p_order_id;
    END IF;

    IF v_item.quantity IS NOT NULL AND v_item.quantity < 1 THEN
      RAISE EXCEPTION 'Invalid order item at index % for order %: quantity must be greater than zero',
        v_item.item_index,
        p_order_id;
    END IF;

    IF v_item.line_extension_amount IS NOT NULL
      AND v_item.line_extension_amount < 0 THEN
      RAISE EXCEPTION 'Invalid order item at index % for order %: line_extension_amount must be non-negative',
        v_item.item_index,
        p_order_id;
    END IF;

    IF v_item.line_extension_amount IS NOT NULL
      AND v_item.line_extension_amount <> v_item.price * COALESCE(v_item.quantity, 1) THEN
      RAISE EXCEPTION 'Invalid order item at index % for order %: line_extension_amount must equal price times quantity',
        v_item.item_index,
        p_order_id;
    END IF;
  END LOOP;

  DELETE FROM public.order_items
  WHERE order_id = p_order_id;

  INSERT INTO public.order_items (
    order_id,
    product_id,
    name,
    price,
    quantity,
    fulfillment_data,
    created_at,
    line_id,
    line_extension_amount,
    item_description,
    sellers_item_id,
    image_url
  )
  SELECT
    p_order_id,
    item.product_id,
    item.name,
    item.price,
    COALESCE(item.quantity, 1),
    item.fulfillment_data,
    now(),
    item.line_id,
    COALESCE(
      item.line_extension_amount,
      item.price * COALESCE(item.quantity, 1)
    ),
    item.item_description,
    item.sellers_item_id,
    item.image_url
  FROM jsonb_array_elements(v_items) WITH ORDINALITY AS source(item_json, item_index)
  CROSS JOIN LATERAL jsonb_to_record(source.item_json) AS item (
    product_id UUID,
    name TEXT,
    price NUMERIC,
    quantity INTEGER,
    fulfillment_data JSONB,
    line_id INTEGER,
    line_extension_amount NUMERIC,
    item_description TEXT,
    sellers_item_id TEXT,
    image_url TEXT
  )
  ORDER BY source.item_index;
END;
$$;

COMMENT ON FUNCTION public.replace_order_items(UUID, JSONB) IS
  'Atomically replaces order_items rows for one order from a JSONB item payload.';

REVOKE ALL ON FUNCTION public.replace_order_items(UUID, JSONB) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.replace_order_items(UUID, JSONB) FROM anon;
REVOKE ALL ON FUNCTION public.replace_order_items(UUID, JSONB) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.replace_order_items(UUID, JSONB) TO service_role;
