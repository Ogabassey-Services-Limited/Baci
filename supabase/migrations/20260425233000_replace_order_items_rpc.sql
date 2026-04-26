DROP FUNCTION IF EXISTS public.replace_order_items(UUID, JSONB);
DROP FUNCTION IF EXISTS public.replace_order_items(UUID, JSONB, UUID, JSONB);

CREATE OR REPLACE FUNCTION public.replace_order_items(
  p_order_id UUID,
  p_items JSONB,
  p_merchant_id UUID,
  p_is_import BOOLEAN DEFAULT FALSE,
  p_order_patch JSONB DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_order_id UUID;
  v_items JSONB := COALESCE(p_items, '[]'::jsonb);
  v_order_patch JSONB := p_order_patch;
  v_money_field TEXT;
  v_timestamp_field TEXT;
  v_item RECORD;
BEGIN
  SELECT id
  INTO v_order_id
  FROM public.orders
  WHERE id = p_order_id
    AND merchant_id = p_merchant_id
  FOR UPDATE;

  IF v_order_id IS NULL THEN
    RAISE EXCEPTION 'Order % does not exist for merchant %',
      p_order_id,
      p_merchant_id;
  END IF;

  IF jsonb_typeof(v_items) <> 'array' THEN
    RAISE EXCEPTION 'Order items payload must be a JSON array for order %', p_order_id;
  END IF;

  IF v_order_patch IS NOT NULL AND jsonb_typeof(v_order_patch) <> 'object' THEN
    RAISE EXCEPTION 'Order patch payload must be a JSON object for order %', p_order_id;
  END IF;

  IF v_order_patch IS NOT NULL THEN
    IF NOT p_is_import
      AND (v_order_patch ? 'created_at' OR v_order_patch ? 'updated_at') THEN
      RAISE EXCEPTION 'Order patch for order % cannot override audit timestamps outside import mode',
        p_order_id;
    END IF;

    IF v_order_patch ? 'shipping_status'
      AND NOT (v_order_patch->>'shipping_status' = ANY (ARRAY[
        'pending',
        'processing',
        'shipped',
        'delivered',
        'cancelled',
        'returned'
      ])) THEN
      RAISE EXCEPTION 'Invalid order patch for order %: invalid shipping_status: %',
        p_order_id,
        v_order_patch->>'shipping_status';
    END IF;

    IF v_order_patch ? 'payment_status'
      AND NOT (v_order_patch->>'payment_status' = ANY (ARRAY[
        'unpaid',
        'pending',
        'paid',
        'refunded',
        'failed',
        'cancelled',
        'bnpl_pending',
        'bnpl_approved'
      ])) THEN
      RAISE EXCEPTION 'Invalid order patch for order %: invalid payment_status: %',
        p_order_id,
        v_order_patch->>'payment_status';
    END IF;

    FOREACH v_timestamp_field IN ARRAY ARRAY[
      'created_at',
      'updated_at',
      'imported_at'
    ]
    LOOP
      IF v_order_patch ? v_timestamp_field THEN
        IF v_order_patch->>v_timestamp_field IS NULL
          OR NOT (v_order_patch->>v_timestamp_field) ~
            '^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}([.][0-9]+)?(Z|[+-][0-9]{2}:[0-9]{2})$' THEN
          RAISE EXCEPTION 'Invalid order patch for order %: % must be an ISO timestamp',
            p_order_id,
            v_timestamp_field;
        END IF;
      END IF;
    END LOOP;

    FOREACH v_money_field IN ARRAY ARRAY[
      'total',
      'subtotal',
      'shipping_fee',
      'tax_amount',
      'discount_amount',
      'original_total'
    ]
    LOOP
      IF v_order_patch ? v_money_field THEN
        IF v_order_patch->>v_money_field IS NULL THEN
          RAISE EXCEPTION 'Invalid order patch for order %: % cannot be null',
            p_order_id,
            v_money_field;
        END IF;

        IF NOT (v_order_patch->>v_money_field) ~ '^[0-9]+([.][0-9]+)?$' THEN
          RAISE EXCEPTION 'Invalid order patch for order %: % must be numeric',
            p_order_id,
            v_money_field;
        END IF;

        IF (v_order_patch->>v_money_field)::numeric < 0 THEN
          RAISE EXCEPTION 'Invalid order patch for order %: % must be non-negative',
            p_order_id,
            v_money_field;
        END IF;
      END IF;
    END LOOP;
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

  IF v_order_patch IS NOT NULL THEN
    UPDATE public.orders
    SET
      order_number = CASE WHEN v_order_patch ? 'order_number'
        THEN v_order_patch->>'order_number' ELSE order_number END,
      customer_name = CASE WHEN v_order_patch ? 'customer_name'
        THEN v_order_patch->>'customer_name' ELSE customer_name END,
      customer_email = CASE WHEN v_order_patch ? 'customer_email'
        THEN v_order_patch->>'customer_email' ELSE customer_email END,
      customer_phone = CASE WHEN v_order_patch ? 'customer_phone'
        THEN v_order_patch->>'customer_phone' ELSE customer_phone END,
      shipping_status = CASE WHEN v_order_patch ? 'shipping_status'
        THEN v_order_patch->>'shipping_status' ELSE shipping_status END,
      payment_status = CASE WHEN v_order_patch ? 'payment_status'
        THEN v_order_patch->>'payment_status' ELSE payment_status END,
      total = CASE WHEN v_order_patch ? 'total'
        THEN (v_order_patch->>'total')::numeric ELSE total END,
      subtotal = CASE WHEN v_order_patch ? 'subtotal'
        THEN (v_order_patch->>'subtotal')::numeric ELSE subtotal END,
      shipping_fee = CASE WHEN v_order_patch ? 'shipping_fee'
        THEN (v_order_patch->>'shipping_fee')::numeric ELSE shipping_fee END,
      tax_amount = CASE WHEN v_order_patch ? 'tax_amount'
        THEN (v_order_patch->>'tax_amount')::numeric ELSE tax_amount END,
      discount_amount = CASE WHEN v_order_patch ? 'discount_amount'
        THEN (v_order_patch->>'discount_amount')::numeric ELSE discount_amount END,
      currency = CASE WHEN v_order_patch ? 'currency'
        THEN v_order_patch->>'currency' ELSE currency END,
      original_currency = CASE WHEN v_order_patch ? 'original_currency'
        THEN v_order_patch->>'original_currency' ELSE original_currency END,
      original_total = CASE WHEN v_order_patch ? 'original_total'
        THEN (v_order_patch->>'original_total')::numeric ELSE original_total END,
      source = CASE WHEN v_order_patch ? 'source'
        THEN v_order_patch->>'source' ELSE source END,
      payment_method = CASE WHEN v_order_patch ? 'payment_method'
        THEN v_order_patch->>'payment_method' ELSE payment_method END,
      notes = CASE WHEN v_order_patch ? 'notes'
        THEN v_order_patch->>'notes' ELSE notes END,
      shipping_address = CASE WHEN v_order_patch ? 'shipping_address'
        THEN v_order_patch->'shipping_address' ELSE shipping_address END,
      tracking_token = CASE WHEN v_order_patch ? 'tracking_token'
        THEN v_order_patch->>'tracking_token' ELSE tracking_token END,
      created_at = CASE WHEN p_is_import AND v_order_patch ? 'created_at'
        THEN (v_order_patch->>'created_at')::timestamptz ELSE created_at END,
      updated_at = CASE
        WHEN p_is_import AND v_order_patch ? 'updated_at'
          THEN (v_order_patch->>'updated_at')::timestamptz
        WHEN NOT p_is_import AND v_order_patch <> '{}'::jsonb THEN now()
        ELSE updated_at
      END,
      external_source = CASE WHEN v_order_patch ? 'external_source'
        THEN v_order_patch->>'external_source' ELSE external_source END,
      external_id = CASE WHEN v_order_patch ? 'external_id'
        THEN v_order_patch->>'external_id' ELSE external_id END,
      imported_at = CASE WHEN v_order_patch ? 'imported_at'
        THEN (v_order_patch->>'imported_at')::timestamptz ELSE imported_at END,
      import_metadata = CASE WHEN v_order_patch ? 'import_metadata'
        THEN CASE
          WHEN jsonb_typeof(v_order_patch->'import_metadata') = 'null'
            THEN '{}'::jsonb
          ELSE v_order_patch->'import_metadata'
        END
        ELSE import_metadata END
    WHERE id = p_order_id
      AND merchant_id = p_merchant_id;
  END IF;

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

ALTER FUNCTION public.replace_order_items(UUID, JSONB, UUID, BOOLEAN, JSONB) OWNER TO postgres;

COMMENT ON FUNCTION public.replace_order_items(UUID, JSONB, UUID, BOOLEAN, JSONB) IS
  'Atomically updates one merchant-owned order and replaces its order_items rows from JSONB payloads. Import callers may override created_at/updated_at through p_order_patch to preserve external marketplace timestamps; normal operational callers should not set those timestamp fields.';

REVOKE ALL ON FUNCTION public.replace_order_items(UUID, JSONB, UUID, BOOLEAN, JSONB) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.replace_order_items(UUID, JSONB, UUID, BOOLEAN, JSONB) FROM anon;
REVOKE ALL ON FUNCTION public.replace_order_items(UUID, JSONB, UUID, BOOLEAN, JSONB) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.replace_order_items(UUID, JSONB, UUID, BOOLEAN, JSONB) TO service_role;
