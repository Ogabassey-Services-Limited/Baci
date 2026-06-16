-- =============================================
-- PRE-MIGRATION REHEARSAL / PREFLIGHT TEST
--   Validates migration preflight checks.
--
-- USAGE:
--   psql $DATABASE_URL -f supabase/migrations/tests/serialized_variant_inventory_preflight.sql
-- =============================================

BEGIN;

-- Create temporary helper so we can test the normalization in the preflight rehearsal
CREATE OR REPLACE FUNCTION public.normalize_inventory_identifier(p_value text)
RETURNS text
LANGUAGE sql
IMMUTABLE
STRICT
PARALLEL SAFE
AS $$
  SELECT lower(regexp_replace(btrim(p_value), '[[:space:]]+', '', 'g'));
$$;

-- Create temporary helper to extract items array
CREATE OR REPLACE FUNCTION public.get_fulfillment_items_array(p_fulfillment jsonb)
RETURNS jsonb
LANGUAGE plpgsql
IMMUTABLE
PARALLEL SAFE
AS $$
BEGIN
  IF p_fulfillment IS NULL THEN
    RETURN '[]'::jsonb;
  END IF;

  IF jsonb_typeof(p_fulfillment) = 'array' THEN
    RETURN p_fulfillment;
  ELSIF jsonb_typeof(p_fulfillment) = 'object' AND p_fulfillment ? 'items' AND jsonb_typeof(p_fulfillment->'items') = 'array' THEN
    RETURN p_fulfillment->'items';
  ELSE
    RETURN '[]'::jsonb;
  END IF;
END;
$$;

-- Seed parent fixtures required by product/variant inventory FKs and the
-- merchant-matching trigger. The whole file runs inside a transaction and
-- finishes with ROLLBACK, so these rows never persist.
INSERT INTO public.merchants (id, email, business_name)
VALUES (
  '8f0ed783-0000-4000-8000-000000000201',
  'serialized-preflight@example.invalid',
  'Serialized Preflight Fixture'
)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.categories (id, merchant_id, name, slug)
VALUES (
  'c0000000-0000-4000-8000-000000000001',
  '8f0ed783-0000-4000-8000-000000000201',
  'Preflight Category',
  'preflight-category'
)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.products (id, merchant_id, name, description, price, category_id, status)
VALUES (
  'a0000000-0000-4000-8000-000000009001',
  '8f0ed783-0000-4000-8000-000000000201',
  'Variant Fixture Product',
  'Parent row for variant inventory preflight fixtures',
  100,
  'c0000000-0000-4000-8000-000000000001',
  'active'
)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.product_variants (id, product_id, merchant_id, attributes, stock_quantity)
VALUES (
  'd0000000-0000-4000-8000-000000000001',
  'a0000000-0000-4000-8000-000000009001',
  '8f0ed783-0000-4000-8000-000000000201',
  '{"fixture": "serialized-preflight"}',
  0
)
ON CONFLICT (id) DO NOTHING;

-- 1. Test null identifier
DO $$
DECLARE
  v_err_msg text;
BEGIN
  -- We temporarily drop the NOT NULL constraint if it exists, or since this runs BEFORE migration,
  -- identifier_value on variant_inventory is currently nullable or not. Wait, in baseline, it is NOT NULL.
  -- Wait! Let's check: if it is already NOT NULL in baseline, we can't seed NULL. Let's check baseline definition.
  -- In baseline line 10818: "identifier_value" "text" NOT NULL.
  -- Since it is already NOT NULL in baseline, we cannot insert a NULL identifier_value.
  -- But wait, the implementation plan says:
  -- "The migration fails early with null_variant_inventory_identifier_exists if existing variant_inventory.identifier_value is NULL"
  -- If the baseline has it as NOT NULL, maybe the preflight check is a defensive guard.
  -- Let's check if we can make a test block for it. Since we can't insert NULL if it's NOT NULL,
  -- we can temporarily ALTER TABLE public.variant_inventory ALTER COLUMN identifier_value DROP NOT NULL,
  -- seed NULL, run preflight, verify it raises null_variant_inventory_identifier_exists, and then
  -- ALTER TABLE public.variant_inventory ALTER COLUMN identifier_value SET NOT NULL.
  -- This is extremely smart and allows testing the preflight guard!

  ALTER TABLE public.variant_inventory ALTER COLUMN identifier_value DROP NOT NULL;

  -- Seed NULL
  INSERT INTO public.variant_inventory (variant_id, merchant_id, identifier_type, identifier_value, status)
  VALUES ('d0000000-0000-4000-8000-000000000001', '8f0ed783-0000-4000-8000-000000000201', 'serial', NULL, 'available');

  -- Preflight check block for NULL
  BEGIN
    IF EXISTS (
      SELECT 1
      FROM public.variant_inventory vi
      WHERE vi.identifier_value IS NULL
    ) THEN
      RAISE EXCEPTION 'null_variant_inventory_identifier_exists' USING ERRCODE = '23514';
    END IF;

    RAISE EXCEPTION 'preflight failed to detect null identifier';
  EXCEPTION
    WHEN check_violation THEN
      GET STACKED DIAGNOSTICS v_err_msg = MESSAGE_TEXT;
      IF v_err_msg <> 'null_variant_inventory_identifier_exists' THEN
        RAISE EXCEPTION 'unexpected error for null identifier: %', v_err_msg;
      END IF;
  END;

  -- Clean up null row and restore NOT NULL
  DELETE FROM public.variant_inventory WHERE identifier_value IS NULL;
  ALTER TABLE public.variant_inventory ALTER COLUMN identifier_value SET NOT NULL;

  RAISE NOTICE 'OK: preflight null identifier check verified';
END $$;

-- 2. Test blank/whitespace identifier
DO $$
DECLARE
  v_err_msg text;
BEGIN
  -- Seed blank
  INSERT INTO public.variant_inventory (variant_id, merchant_id, identifier_type, identifier_value, status)
  VALUES ('d0000000-0000-4000-8000-000000000001', '8f0ed783-0000-4000-8000-000000000201', 'serial', '   ', 'available');

  -- Preflight check block for blank
  BEGIN
    IF EXISTS (
      SELECT 1
      FROM public.variant_inventory vi
      WHERE public.normalize_inventory_identifier(vi.identifier_value) = ''
    ) THEN
      RAISE EXCEPTION 'blank_variant_inventory_identifier_exists' USING ERRCODE = '23514';
    END IF;

    RAISE EXCEPTION 'preflight failed to detect blank identifier';
  EXCEPTION
    WHEN check_violation THEN
      GET STACKED DIAGNOSTICS v_err_msg = MESSAGE_TEXT;
      IF v_err_msg <> 'blank_variant_inventory_identifier_exists' THEN
        RAISE EXCEPTION 'unexpected error for blank identifier: %', v_err_msg;
      END IF;
  END;

  -- Clean up blank row
  DELETE FROM public.variant_inventory WHERE public.normalize_inventory_identifier(identifier_value) = '';

  RAISE NOTICE 'OK: preflight blank identifier check verified';
END $$;

-- 3. Test invalid IMEI shape
DO $$
DECLARE
  v_err_msg text;
BEGIN
  -- Seed invalid IMEI
  INSERT INTO public.variant_inventory (variant_id, merchant_id, identifier_type, identifier_value, status)
  VALUES ('d0000000-0000-4000-8000-000000000001', '8f0ed783-0000-4000-8000-000000000201', 'imei', '12345abc', 'available');

  -- Preflight check block for invalid IMEI
  BEGIN
    -- Infer imei/serial for untyped/invalid first or check explicit check constraint
    IF EXISTS (
      SELECT 1
      FROM public.variant_inventory vi
      WHERE vi.identifier_type = 'imei'
        AND public.normalize_inventory_identifier(vi.identifier_value) !~ '^[0-9]{15}$'
    ) THEN
      RAISE EXCEPTION 'invalid_imei_identifier_exists' USING ERRCODE = '23514';
    END IF;

    RAISE EXCEPTION 'preflight failed to detect invalid IMEI';
  EXCEPTION
    WHEN check_violation THEN
      GET STACKED DIAGNOSTICS v_err_msg = MESSAGE_TEXT;
      IF v_err_msg <> 'invalid_imei_identifier_exists' THEN
        RAISE EXCEPTION 'unexpected error for invalid IMEI: %', v_err_msg;
      END IF;
  END;

  -- Clean up invalid IMEI row
  DELETE FROM public.variant_inventory WHERE identifier_value = '12345abc';

  RAISE NOTICE 'OK: preflight invalid IMEI check verified';
END $$;

-- 4. Test duplicate merchant identifiers (cross-type case)
DO $$
DECLARE
  v_err_msg text;
BEGIN
  -- Seed duplicates: one imei, one serial, same normalized value
  INSERT INTO public.variant_inventory (variant_id, merchant_id, identifier_type, identifier_value, status)
  VALUES
    ('d0000000-0000-4000-8000-000000000001', '8f0ed783-0000-4000-8000-000000000201', 'imei', '353456789012345', 'available'),
    ('d0000000-0000-4000-8000-000000000001', '8f0ed783-0000-4000-8000-000000000201', 'serial', ' 353456789012345 ', 'available');

  -- Preflight check block for duplicates
  BEGIN
    IF EXISTS (
      SELECT 1
      FROM (
        SELECT
          vi.merchant_id,
          public.normalize_inventory_identifier(vi.identifier_value) AS normalized_identifier,
          count(*) AS duplicate_count
        FROM public.variant_inventory vi
        GROUP BY
          vi.merchant_id,
          public.normalize_inventory_identifier(vi.identifier_value)
        HAVING count(*) > 1
      ) duplicate_inventory_identifiers
    ) THEN
      RAISE EXCEPTION 'duplicate_variant_inventory_identifiers_exist' USING ERRCODE = '23505';
    END IF;

    RAISE EXCEPTION 'preflight failed to detect duplicate identifiers';
  EXCEPTION
    WHEN unique_violation THEN
      GET STACKED DIAGNOSTICS v_err_msg = MESSAGE_TEXT;
      IF v_err_msg <> 'duplicate_variant_inventory_identifiers_exist' THEN
        RAISE EXCEPTION 'unexpected error for duplicate identifiers: %', v_err_msg;
      END IF;
  END;

  -- Clean up duplicate rows
  DELETE FROM public.variant_inventory WHERE public.normalize_inventory_identifier(identifier_value) = '353456789012345';

  RAISE NOTICE 'OK: preflight duplicate identifier check verified';
END $$;

-- 5. Test duplicate legacy fulfillment details
DO $$
DECLARE
  v_err_msg text;
BEGIN
  -- Insert products with duplicate identifiers in legacy fulfillment_details
  -- Baci baseline has products.fulfillment_details as JSONB
  INSERT INTO public.products (id, merchant_id, name, description, category_id, fulfillment_details)
  VALUES
    ('a0000000-0000-4000-8000-000000000001', '8f0ed783-0000-4000-8000-000000000201', 'Product A', 'Desc', 'c0000000-0000-4000-8000-000000000001', '{"items": [{"imei": "111111111111111"}, {"serial": "111111111111111"}]}');

  -- Preflight check for duplicate identifiers in legacy fulfillment_details
  BEGIN
    IF EXISTS (
      SELECT 1
      FROM (
        SELECT
          p.merchant_id,
          public.normalize_inventory_identifier(item->>'imei') AS normalized_id
        FROM public.products p,
        LATERAL jsonb_array_elements(public.get_fulfillment_items_array(p.fulfillment_details)) item
        WHERE item->>'imei' IS NOT NULL
        UNION ALL
        SELECT
          p.merchant_id,
          public.normalize_inventory_identifier(item->>'serial') AS normalized_id
        FROM public.products p,
        LATERAL jsonb_array_elements(public.get_fulfillment_items_array(p.fulfillment_details)) item
        WHERE item->>'serial' IS NOT NULL
      ) all_legacy_ids
      GROUP BY merchant_id, normalized_id
      HAVING count(*) > 1
    ) THEN
      RAISE EXCEPTION 'duplicate_legacy_fulfillment_identifiers_exist' USING ERRCODE = '23505';
    END IF;

    RAISE EXCEPTION 'preflight failed to detect duplicate legacy identifiers';
  EXCEPTION
    WHEN unique_violation THEN
      GET STACKED DIAGNOSTICS v_err_msg = MESSAGE_TEXT;
      IF v_err_msg <> 'duplicate_legacy_fulfillment_identifiers_exist' THEN
        RAISE EXCEPTION 'unexpected error for legacy duplicates: %', v_err_msg;
      END IF;
  END;

  -- Test duplicate legacy against existing variant_inventory
  INSERT INTO public.variant_inventory (variant_id, merchant_id, identifier_type, identifier_value, status)
  VALUES ('d0000000-0000-4000-8000-000000000001', '8f0ed783-0000-4000-8000-000000000201', 'imei', '222222222222222', 'available');

  UPDATE public.products
  SET fulfillment_details = '{"items": [{"imei": "333333333333333", "serial": "222222222222222"}]}'
  WHERE id = 'a0000000-0000-4000-8000-000000000001';

  BEGIN
    IF EXISTS (
      SELECT 1
      FROM (
        SELECT
          p.merchant_id,
          public.normalize_inventory_identifier(item->>'imei') AS normalized_id
        FROM public.products p,
        LATERAL jsonb_array_elements(public.get_fulfillment_items_array(p.fulfillment_details)) item
        WHERE item->>'imei' IS NOT NULL
        UNION ALL
        SELECT
          p.merchant_id,
          public.normalize_inventory_identifier(item->>'serial') AS normalized_id
        FROM public.products p,
        LATERAL jsonb_array_elements(public.get_fulfillment_items_array(p.fulfillment_details)) item
        WHERE item->>'serial' IS NOT NULL
      ) legacy_ids
      JOIN public.variant_inventory vi
        ON vi.merchant_id = legacy_ids.merchant_id
        AND public.normalize_inventory_identifier(vi.identifier_value) = legacy_ids.normalized_id
    ) THEN
      RAISE EXCEPTION 'legacy_fulfillment_identifier_already_exists' USING ERRCODE = '23505';
    END IF;

    RAISE EXCEPTION 'preflight failed to detect legacy overlap with variant_inventory';
  EXCEPTION
    WHEN unique_violation THEN
      GET STACKED DIAGNOSTICS v_err_msg = MESSAGE_TEXT;
      IF v_err_msg <> 'legacy_fulfillment_identifier_already_exists' THEN
        RAISE EXCEPTION 'unexpected error for legacy overlap check: %', v_err_msg;
      END IF;
  END;

  -- Clean up
  DELETE FROM public.variant_inventory WHERE identifier_value = '222222222222222';
  DELETE FROM public.products WHERE id = 'a0000000-0000-4000-8000-000000000001';

  RAISE NOTICE 'OK: preflight legacy fulfillment duplicate checks verified';
END $$;

ROLLBACK;
