-- Migration: Serialized Variant Inventory & Unlimited Stock Fallback
-- Task 1: Schema, Triggers, And Helper Functions

-- Step 2: Add Policy Columns And Unit Lifecycle Columns
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS inventory_tracking_policy text NOT NULL DEFAULT 'off',
  ADD COLUMN IF NOT EXISTS inventory_anchor_variant_id uuid;

ALTER TABLE public.products
  DROP CONSTRAINT IF EXISTS products_inventory_tracking_policy_check;

ALTER TABLE public.products
  ADD CONSTRAINT products_inventory_tracking_policy_check
  CHECK (inventory_tracking_policy IN ('off', 'serialized_strict', 'serialized_then_unlimited'));

ALTER TABLE public.product_variants
  ADD COLUMN IF NOT EXISTS inventory_tracking_policy text NOT NULL DEFAULT 'inherit',
  ADD COLUMN IF NOT EXISTS is_inventory_anchor boolean NOT NULL DEFAULT false;

ALTER TABLE public.product_variants
  DROP CONSTRAINT IF EXISTS product_variants_inventory_tracking_policy_check;

ALTER TABLE public.product_variants
  ADD CONSTRAINT product_variants_inventory_tracking_policy_check
  CHECK (inventory_tracking_policy IN ('inherit', 'off', 'serialized_strict', 'serialized_then_unlimited'));

ALTER TABLE public.variant_inventory
  ADD COLUMN IF NOT EXISTS order_item_id uuid,
  ADD COLUMN IF NOT EXISTS reserved_at timestamp with time zone,
  ADD COLUMN IF NOT EXISTS first_reserved_at timestamp with time zone,
  ADD COLUMN IF NOT EXISTS reservation_expires_at timestamp with time zone,
  ADD COLUMN IF NOT EXISTS source text NOT NULL DEFAULT 'merchant_stock',
  ADD COLUMN IF NOT EXISTS notes text;

ALTER TABLE public.order_items
  ADD COLUMN IF NOT EXISTS variant_attributes jsonb NOT NULL DEFAULT '{}'::jsonb;

COMMENT ON COLUMN public.order_items.variant_attributes IS
  'Display snapshot of selected variant attributes at order time; used for historical variant analytics.';

-- Preflight Data Repair: Normalize NULL status and stale links
UPDATE public.variant_inventory
SET status = CASE
  WHEN sold_at IS NOT NULL THEN 'sold'
  WHEN order_id IS NOT NULL THEN 'reserved'
  ELSE 'available'
END
WHERE status IS NULL;

UPDATE public.variant_inventory
SET status = CASE
  WHEN sold_at IS NOT NULL THEN 'sold'
  WHEN order_id IS NOT NULL OR order_item_id IS NOT NULL THEN 'reserved'
  ELSE status
END
WHERE status = 'available'
  AND (
    order_id IS NOT NULL
    OR order_item_id IS NOT NULL
    OR sold_at IS NOT NULL
  );

UPDATE public.variant_inventory
SET first_reserved_at = COALESCE(first_reserved_at, reserved_at, sold_at, created_at, now())
WHERE first_reserved_at IS NULL
  AND (
    order_id IS NOT NULL
    OR order_item_id IS NOT NULL
    OR sold_at IS NOT NULL
    OR status IN ('reserved', 'sold', 'returned')
    OR (
      status = 'defective'
      AND (
        reserved_at IS NOT NULL
        OR reservation_expires_at IS NOT NULL
      )
    )
  );

-- Raise exception if any historical row is missing first_reserved_at after repair
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM public.variant_inventory vi
    WHERE vi.first_reserved_at IS NULL
      AND (
        vi.order_id IS NOT NULL
        OR vi.order_item_id IS NOT NULL
        OR vi.sold_at IS NOT NULL
        OR vi.status IN ('reserved', 'sold', 'returned')
        OR (
          vi.status = 'defective'
          AND (
            vi.reserved_at IS NOT NULL
            OR vi.reservation_expires_at IS NOT NULL
          )
        )
      )
  ) THEN
    RAISE EXCEPTION 'historical_variant_inventory_missing_first_reserved_at'
      USING ERRCODE = '23514';
  END IF;
END $$;

ALTER TABLE public.variant_inventory
  ALTER COLUMN status SET DEFAULT 'available',
  ALTER COLUMN status SET NOT NULL;

ALTER TABLE public.variant_inventory
  DROP CONSTRAINT IF EXISTS variant_inventory_source_check;

ALTER TABLE public.variant_inventory
  ADD CONSTRAINT variant_inventory_source_check
  CHECK (source IN ('merchant_stock', 'vendor_sourced', 'dropship'));

ALTER TABLE public.variant_inventory
  DROP CONSTRAINT IF EXISTS variant_inventory_available_has_no_order_link;

ALTER TABLE public.variant_inventory
  ADD CONSTRAINT variant_inventory_available_has_no_order_link
  CHECK (
    status <> 'available'
    OR (
      order_id IS NULL
      AND order_item_id IS NULL
      AND sold_at IS NULL
    )
  );

-- Raise exceptions if orphans exist
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM public.variant_inventory vi
    WHERE vi.order_id IS NOT NULL
      AND NOT EXISTS (
        SELECT 1 FROM public.orders o WHERE o.id = vi.order_id
      )
  ) THEN
    RAISE EXCEPTION 'orphan_variant_inventory_order_links_exist'
      USING ERRCODE = '23514';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.variant_inventory vi
    WHERE vi.order_item_id IS NOT NULL
      AND NOT EXISTS (
        SELECT 1 FROM public.order_items oi WHERE oi.id = vi.order_item_id
      )
  ) THEN
    RAISE EXCEPTION 'orphan_variant_inventory_order_item_links_exist'
      USING ERRCODE = '23514';
  END IF;
END $$;

-- Drop constraints before recreating with ON DELETE NO ACTION
ALTER TABLE public.variant_inventory
  DROP CONSTRAINT IF EXISTS variant_inventory_order_id_fkey,
  DROP CONSTRAINT IF EXISTS variant_inventory_order_item_id_fkey,
  DROP CONSTRAINT IF EXISTS variant_inventory_variant_id_fkey;

ALTER TABLE public.variant_inventory
  ADD CONSTRAINT variant_inventory_order_id_fkey
    FOREIGN KEY (order_id) REFERENCES public.orders(id) ON DELETE NO ACTION,
  ADD CONSTRAINT variant_inventory_order_item_id_fkey
    FOREIGN KEY (order_item_id) REFERENCES public.order_items(id) ON DELETE NO ACTION,
  ADD CONSTRAINT variant_inventory_variant_id_fkey
    FOREIGN KEY (variant_id) REFERENCES public.product_variants(id) ON DELETE NO ACTION;

-- Schema private Setup
CREATE SCHEMA IF NOT EXISTS private;
REVOKE ALL ON SCHEMA private FROM PUBLIC, anon, authenticated;
GRANT USAGE ON SCHEMA private TO anon, authenticated, service_role;

-- Event ledger tables
CREATE TABLE IF NOT EXISTS private.variant_inventory_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  inventory_unit_id uuid REFERENCES public.variant_inventory(id) ON DELETE SET NULL,
  merchant_id uuid NOT NULL,
  product_id uuid,
  variant_id uuid,
  event_type text NOT NULL,
  from_status text,
  to_status text,
  order_id uuid REFERENCES public.orders(id) ON DELETE SET NULL,
  order_item_id uuid REFERENCES public.order_items(id) ON DELETE SET NULL,
  branch_id uuid REFERENCES public.branches(id) ON DELETE SET NULL,
  actor_user_id uuid,
  actor_role text,
  event_context jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT variant_inventory_events_event_type_check
    CHECK (
      event_type IN (
        'restocked',
        'reserved',
        'reservation_released',
        'reservation_expired',
        'hold_confirmed',
        'sold',
        'returned',
        'marked_defective',
        'reconditioned_for_resale',
        'identifier_updated',
        'branch_transferred',
        'deleted_accidental'
      )
    ),
  CONSTRAINT variant_inventory_events_status_values_check
    CHECK (
      (from_status IS NULL OR from_status IN ('available', 'reserved', 'sold', 'returned', 'defective'))
      AND (to_status IS NULL OR to_status IN ('available', 'reserved', 'sold', 'returned', 'defective'))
    )
);

CREATE INDEX IF NOT EXISTS variant_inventory_events_unit_created_idx
  ON private.variant_inventory_events(inventory_unit_id, created_at DESC);

CREATE INDEX IF NOT EXISTS variant_inventory_events_order_idx
  ON private.variant_inventory_events(order_id, order_item_id, created_at DESC);

CREATE INDEX IF NOT EXISTS variant_inventory_events_merchant_created_idx
  ON private.variant_inventory_events(merchant_id, created_at DESC);

CREATE TABLE IF NOT EXISTS private.shipment_inventory_reconciliation_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  merchant_id uuid NOT NULL,
  order_id uuid NOT NULL REFERENCES public.orders(id),
  provider text,
  shipment_id uuid REFERENCES public.shipments(id) ON DELETE SET NULL,
  tracking_number text,
  error_code text NOT NULL,
  error_context jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'open',
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  resolved_at timestamp with time zone,
  resolved_by uuid,
  CONSTRAINT shipment_inventory_reconciliation_events_status_check
    CHECK (status IN ('open', 'cancelled_with_provider', 'resolved'))
);

CREATE INDEX IF NOT EXISTS shipment_inventory_reconciliation_events_order_idx
  ON private.shipment_inventory_reconciliation_events(order_id);

CREATE INDEX IF NOT EXISTS shipment_inventory_reconciliation_events_merchant_status_idx
  ON private.shipment_inventory_reconciliation_events(merchant_id, status, created_at DESC);

CREATE UNIQUE INDEX IF NOT EXISTS shipment_inventory_reconciliation_events_open_uidx
  ON private.shipment_inventory_reconciliation_events(
    merchant_id,
    order_id,
    (COALESCE(provider, '')),
    (COALESCE(shipment_id::text, '')),
    error_code
  )
  WHERE status = 'open';

-- Transactions manual payment idempotency unique index
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM public.transactions t
    WHERE t.gateway = 'manual'
      AND t.transaction_type = 'payment'
      AND NULLIF(btrim(t.metadata->>'manual_payment_idempotency_key'), '') IS NOT NULL
    GROUP BY
      t.order_id,
      NULLIF(btrim(t.metadata->>'manual_payment_idempotency_key'), '')
    HAVING COUNT(*) > 1
  ) THEN
    RAISE EXCEPTION 'duplicate_manual_payment_idempotency_keys_exist';
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS transactions_manual_payment_idempotency_key_uidx
  ON public.transactions (
    order_id,
    (NULLIF(btrim(metadata->>'manual_payment_idempotency_key'), ''))
  )
  WHERE gateway = 'manual'
    AND transaction_type = 'payment'
    AND NULLIF(btrim(metadata->>'manual_payment_idempotency_key'), '') IS NOT NULL;

-- Enable RLS and setup policies on private tables
ALTER TABLE private.shipment_inventory_reconciliation_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE private.variant_inventory_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS variant_inventory_events_service_role_select ON private.variant_inventory_events;
DROP POLICY IF EXISTS variant_inventory_events_service_role_insert ON private.variant_inventory_events;

CREATE POLICY variant_inventory_events_service_role_select
  ON private.variant_inventory_events
  FOR SELECT TO service_role USING (true);

CREATE POLICY variant_inventory_events_service_role_insert
  ON private.variant_inventory_events
  FOR INSERT TO service_role WITH CHECK (true);

REVOKE ALL ON TABLE private.variant_inventory_events FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT ON TABLE private.variant_inventory_events TO service_role;

DROP POLICY IF EXISTS shipment_inventory_reconciliation_events_service_role_all ON private.shipment_inventory_reconciliation_events;

CREATE POLICY shipment_inventory_reconciliation_events_service_role_all
  ON private.shipment_inventory_reconciliation_events
  FOR ALL TO service_role USING (true) WITH CHECK (true);

REVOKE ALL ON TABLE private.shipment_inventory_reconciliation_events FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON TABLE private.shipment_inventory_reconciliation_events TO service_role;

REVOKE ALL ON TABLE public.shipping_webhook_events FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON TABLE public.shipping_webhook_events TO service_role;

-- Step 3: Replace Inventory Branch Trigger With Validation-Only Behavior
CREATE OR REPLACE FUNCTION private.ensure_variant_inventory_branch_matches_merchant()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_variant_valid boolean;
  v_branch_valid boolean;
BEGIN
  SELECT EXISTS (
    SELECT 1
    FROM public.product_variants pv
    WHERE pv.id = NEW.variant_id
      AND pv.merchant_id = NEW.merchant_id
  ) INTO v_variant_valid;

  IF v_variant_valid IS NOT TRUE THEN
    RAISE EXCEPTION 'variant_inventory_variant_merchant_mismatch'
      USING ERRCODE = '23514';
  END IF;

  IF NEW.branch_id IS NULL THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'INSERT' THEN
    SELECT EXISTS (
      SELECT 1
      FROM public.branches b
      WHERE b.id = NEW.branch_id
        AND b.merchant_id = NEW.merchant_id
        AND b.active = true
    ) INTO v_branch_valid;
  ELSIF TG_OP = 'UPDATE' THEN
    IF NEW.branch_id IS DISTINCT FROM OLD.branch_id THEN
      SELECT EXISTS (
        SELECT 1
        FROM public.branches b
        WHERE b.id = NEW.branch_id
          AND b.merchant_id = NEW.merchant_id
          AND b.active = true
      ) INTO v_branch_valid;
    ELSE
      SELECT EXISTS (
        SELECT 1
        FROM public.branches b
        WHERE b.id = NEW.branch_id
          AND b.merchant_id = NEW.merchant_id
      ) INTO v_branch_valid;
    END IF;
  END IF;

  IF v_branch_valid IS NOT TRUE THEN
    RAISE EXCEPTION 'Invalid branch assignment' USING ERRCODE = '23514';
  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION private.ensure_variant_inventory_branch_matches_merchant() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS ensure_variant_inventory_branch_matches_merchant ON public.variant_inventory;
CREATE TRIGGER ensure_variant_inventory_branch_matches_merchant
  BEFORE INSERT OR UPDATE OF merchant_id, variant_id, branch_id
  ON public.variant_inventory
  FOR EACH ROW
  EXECUTE FUNCTION private.ensure_variant_inventory_branch_matches_merchant();

-- Step 4: Add Identifier Normalization, Preflight, Check Constraints, and Helper Functions
CREATE OR REPLACE FUNCTION public.normalize_inventory_identifier(p_value text)
RETURNS text
LANGUAGE sql
IMMUTABLE
STRICT
PARALLEL SAFE
SET search_path = public
AS $$
  SELECT lower(regexp_replace(btrim(p_value), '[[:space:]]+', '', 'g'));
$$;

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

CREATE OR REPLACE FUNCTION public.get_effective_inventory_tracking_policy(
  p_product_policy text,
  p_variant_policy text
) RETURNS text
LANGUAGE sql
IMMUTABLE
PARALLEL SAFE
SET search_path = public
AS $$
  SELECT CASE
    WHEN p_variant_policy IN ('off', 'serialized_strict', 'serialized_then_unlimited')
      THEN p_variant_policy
    WHEN p_product_policy IN ('serialized_strict', 'serialized_then_unlimited')
      THEN p_product_policy
    ELSE 'off'
  END;
$$;

REVOKE ALL ON FUNCTION public.normalize_inventory_identifier(text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.get_fulfillment_items_array(jsonb) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.get_effective_inventory_tracking_policy(text, text) FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.normalize_inventory_identifier(text) TO service_role;
GRANT EXECUTE ON FUNCTION public.get_fulfillment_items_array(jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.get_effective_inventory_tracking_policy(text, text) TO service_role;

CREATE OR REPLACE FUNCTION public.claim_order_shipment_booking(
  p_order_id uuid,
  p_merchant_id uuid,
  p_lock_token uuid,
  p_lock_timeout_seconds integer DEFAULT 900
)
RETURNS TABLE(
  claimed boolean,
  shipment_id uuid,
  tracking_number text,
  shipping_status text
)
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
BEGIN
  IF auth.role() <> 'service_role'
     AND NOT public.has_merchant_access(p_merchant_id) THEN
    RAISE EXCEPTION 'forbidden_claim_order_shipment_booking'
      USING ERRCODE = '42501';
  END IF;

  UPDATE public.orders
  SET shipment_booking_lock_token = p_lock_token,
      shipment_booking_started_at = now()
  WHERE id = p_order_id
    AND merchant_id = p_merchant_id
    AND shipment_id IS NULL
    AND tracking_number IS NULL
    AND (
      shipment_booking_lock_token IS NULL
      OR shipment_booking_started_at IS NULL
      OR shipment_booking_started_at <
        now() - make_interval(secs => greatest(p_lock_timeout_seconds, 0))
    );

  IF FOUND THEN
    RETURN QUERY
    SELECT true, NULL::uuid, NULL::text, NULL::text;
    RETURN;
  END IF;

  RETURN QUERY
  SELECT false, o.shipment_id, o.tracking_number, o.shipping_status
  FROM public.orders AS o
  WHERE o.id = p_order_id
    AND o.merchant_id = p_merchant_id;
END;
$$;

REVOKE ALL ON FUNCTION public.claim_order_shipment_booking(uuid, uuid, uuid, integer) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.claim_order_shipment_booking(uuid, uuid, uuid, integer) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION private.build_safe_variant_inventory_event_context(
  p_event_type text,
  p_context jsonb
) RETURNS jsonb
LANGUAGE plpgsql
IMMUTABLE
PARALLEL SAFE
SET search_path = ''
AS $$
DECLARE
  v_result jsonb;
  v_value text;
  v_numeric numeric;
BEGIN
  IF p_context IS NULL THEN
    RETURN '{}'::jsonb;
  END IF;

  IF jsonb_typeof(p_context) <> 'object' THEN
    RETURN '{}'::jsonb;
  END IF;

  v_result := '{}'::jsonb;

  IF p_context ? 'source'
     AND jsonb_typeof(p_context->'source') = 'string'
     AND p_context->>'source' IN ('merchant_stock', 'vendor_sourced', 'dropship') THEN
    v_result := v_result || jsonb_build_object('source', p_context->>'source');
  END IF;

  IF p_context ? 'fulfillmentPath'
     AND jsonb_typeof(p_context->'fulfillmentPath') = 'string'
     AND p_context->>'fulfillmentPath' IN (
       'checkout',
       'manual_order',
       'order_reuse',
       'payment_confirmation',
       'provider_shipment',
       'self_fulfillment',
       'cleanup'
     ) THEN
    v_result := v_result || jsonb_build_object('fulfillmentPath', p_context->>'fulfillmentPath');
  END IF;

  IF p_context ? 'releaseReason'
     AND jsonb_typeof(p_context->'releaseReason') = 'string'
     AND p_context->>'releaseReason' IN (
       'payment_failed',
       'payment_cancelled',
       'order_cancelled',
       'reservation_expired',
       'order_item_deleted',
       'order_deleted',
       'quantity_reduced',
       'checkout_reuse'
     ) THEN
    v_result := v_result || jsonb_build_object('releaseReason', p_context->>'releaseReason');
  END IF;

  IF p_event_type = 'deleted_accidental'
     AND p_context ? 'deleteReason'
     AND jsonb_typeof(p_context->'deleteReason') = 'string'
     AND p_context->>'deleteReason' = 'merchant_accidental_restock_correction' THEN
    v_result := v_result || jsonb_build_object('deleteReason', p_context->>'deleteReason');
  END IF;

  IF p_context ? 'exceptionCode'
     AND jsonb_typeof(p_context->'exceptionCode') = 'string'
     AND p_context->>'exceptionCode' IN ('late_payment_reservation_lost') THEN
    v_result := v_result || jsonb_build_object('exceptionCode', p_context->>'exceptionCode');
  END IF;

  IF p_context ? 'previousStatus'
     AND jsonb_typeof(p_context->'previousStatus') = 'string'
     AND p_context->>'previousStatus' IN ('available', 'reserved', 'sold', 'returned', 'defective') THEN
    v_result := v_result || jsonb_build_object('previousStatus', p_context->>'previousStatus');
  END IF;

  IF p_context ? 'nextStatus'
     AND jsonb_typeof(p_context->'nextStatus') = 'string'
     AND p_context->>'nextStatus' IN ('available', 'reserved', 'sold', 'returned', 'defective') THEN
    v_result := v_result || jsonb_build_object('nextStatus', p_context->>'nextStatus');
  END IF;

  FOREACH v_value IN ARRAY ARRAY['previousBranchId', 'newBranchId', 'batchId']
  LOOP
    IF p_context ? v_value
       AND jsonb_typeof(p_context->v_value) = 'string'
       AND (p_context->>v_value) ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN
      v_result := v_result || jsonb_build_object(v_value, p_context->>v_value);
    END IF;
  END LOOP;

  FOREACH v_value IN ARRAY ARRAY['reservationExpiresAt', 'soldAt', 'returnedAt', 'reconditionedAt']
  LOOP
    IF p_context ? v_value
       AND jsonb_typeof(p_context->v_value) = 'string'
       AND (p_context->>v_value) ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}T' THEN
      v_result := v_result || jsonb_build_object(v_value, p_context->>v_value);
    END IF;
  END LOOP;

  FOREACH v_value IN ARRAY ARRAY['unitCount', 'missingUnitCount', 'reclaimedUnitCount']
  LOOP
    IF p_context ? v_value
       AND jsonb_typeof(p_context->v_value) = 'number' THEN
      v_numeric := (p_context->>v_value)::numeric;
      IF v_numeric >= 0 THEN
        v_result := v_result || jsonb_build_object(v_value, v_numeric);
      END IF;
    END IF;
  END LOOP;

  FOREACH v_value IN ARRAY ARRAY[
    'identifierChanged',
    'identifierTypeChanged',
    'branchChanged',
    'noteProvided',
    'sourceChanged'
  ]
  LOOP
    IF p_context ? v_value
       AND jsonb_typeof(p_context->v_value) = 'boolean' THEN
      v_result := v_result || jsonb_build_object(v_value, (p_context->>v_value)::boolean);
    END IF;
  END LOOP;

  IF p_event_type = 'identifier_updated' THEN
    v_result := v_result
      || jsonb_build_object(
        'identifierChanged',
        true,
        'rawIdentifierValuesStored',
        false
      );
  END IF;

  RETURN v_result;
END;
$$;

CREATE OR REPLACE FUNCTION private.record_variant_inventory_event(
  p_inventory_unit_id uuid,
  p_merchant_id uuid,
  p_product_id uuid,
  p_variant_id uuid,
  p_event_type text,
  p_from_status text DEFAULT NULL,
  p_to_status text DEFAULT NULL,
  p_order_id uuid DEFAULT NULL,
  p_order_item_id uuid DEFAULT NULL,
  p_branch_id uuid DEFAULT NULL,
  p_actor_user_id uuid DEFAULT NULL,
  p_actor_role text DEFAULT NULL,
  p_event_context jsonb DEFAULT '{}'::jsonb
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_event_id uuid;
  v_context jsonb;
BEGIN
  v_context := private.build_safe_variant_inventory_event_context(
    p_event_type,
    COALESCE(p_event_context, '{}'::jsonb)
  );

  INSERT INTO private.variant_inventory_events (
    inventory_unit_id,
    merchant_id,
    product_id,
    variant_id,
    event_type,
    from_status,
    to_status,
    order_id,
    order_item_id,
    branch_id,
    actor_user_id,
    actor_role,
    event_context
  ) VALUES (
    p_inventory_unit_id,
    p_merchant_id,
    p_product_id,
    p_variant_id,
    p_event_type,
    p_from_status,
    p_to_status,
    p_order_id,
    p_order_item_id,
    p_branch_id,
    p_actor_user_id,
    p_actor_role,
    v_context
  )
  RETURNING id INTO v_event_id;

  RETURN v_event_id;
END;
$$;

REVOKE ALL ON FUNCTION private.build_safe_variant_inventory_event_context(text, jsonb) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION private.record_variant_inventory_event(
  uuid, uuid, uuid, uuid, text, text, text, uuid, uuid, uuid, uuid, text, jsonb
) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION private.ensure_variant_inventory_event_required_references()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NEW.inventory_unit_id IS NULL
     OR NEW.product_id IS NULL
     OR NEW.variant_id IS NULL THEN
    RAISE EXCEPTION 'variant_inventory_event_missing_unit_reference'
      USING ERRCODE = '23514';
  END IF;

  IF NEW.event_type IN (
       'reserved',
       'reservation_released',
       'reservation_expired',
       'hold_confirmed',
       'sold',
       'returned'
     )
     AND (
       NEW.order_id IS NULL
       OR NEW.order_item_id IS NULL
     ) THEN
    RAISE EXCEPTION 'variant_inventory_event_missing_order_reference'
      USING ERRCODE = '23514';
  END IF;

  IF NEW.event_type = 'reconditioned_for_resale'
     AND NOT EXISTS (
       SELECT 1
       FROM public.variant_inventory vi
       WHERE vi.id = NEW.inventory_unit_id
         AND vi.status = 'defective'
         AND vi.order_id IS NULL
         AND vi.order_item_id IS NULL
         AND vi.sold_at IS NULL
         AND vi.reserved_at IS NULL
         AND vi.first_reserved_at IS NULL
         AND vi.reservation_expires_at IS NULL
     )
     AND (
       NEW.order_id IS NULL
       OR NEW.order_item_id IS NULL
     ) THEN
    RAISE EXCEPTION 'variant_inventory_event_missing_reconditioned_order_reference'
      USING ERRCODE = '23514';
  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION private.ensure_variant_inventory_event_required_references() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_variant_inventory_events_required_references ON private.variant_inventory_events;
CREATE TRIGGER trg_variant_inventory_events_required_references
  BEFORE INSERT ON private.variant_inventory_events
  FOR EACH ROW
  EXECUTE FUNCTION private.ensure_variant_inventory_event_required_references();

CREATE OR REPLACE FUNCTION private.ensure_variant_inventory_event_scope_matches_merchant()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NEW.inventory_unit_id IS NOT NULL
     AND NOT EXISTS (
       SELECT 1
       FROM public.variant_inventory vi
       JOIN public.product_variants pv ON pv.id = vi.variant_id
       WHERE vi.id = NEW.inventory_unit_id
         AND vi.merchant_id = NEW.merchant_id
         AND (NEW.variant_id IS NULL OR NEW.variant_id = vi.variant_id)
         AND (NEW.product_id IS NULL OR NEW.product_id = pv.product_id)
     ) THEN
    RAISE EXCEPTION 'variant_inventory_event_unit_scope_mismatch'
      USING ERRCODE = '23514';
  END IF;

  IF NEW.product_id IS NOT NULL
     AND NOT EXISTS (
       SELECT 1
       FROM public.products p
       WHERE p.id = NEW.product_id
         AND p.merchant_id = NEW.merchant_id
     ) THEN
    RAISE EXCEPTION 'variant_inventory_event_product_scope_mismatch'
      USING ERRCODE = '23514';
  END IF;

  IF NEW.variant_id IS NOT NULL
     AND NOT EXISTS (
       SELECT 1
       FROM public.product_variants pv
       WHERE pv.id = NEW.variant_id
         AND pv.merchant_id = NEW.merchant_id
         AND (NEW.product_id IS NULL OR pv.product_id = NEW.product_id)
     ) THEN
    RAISE EXCEPTION 'variant_inventory_event_variant_scope_mismatch'
      USING ERRCODE = '23514';
  END IF;

  IF NEW.order_id IS NOT NULL
     AND NOT EXISTS (
       SELECT 1
       FROM public.orders o
       WHERE o.id = NEW.order_id
         AND o.merchant_id = NEW.merchant_id
     ) THEN
    RAISE EXCEPTION 'variant_inventory_event_order_scope_mismatch'
      USING ERRCODE = '23514';
  END IF;

  IF NEW.order_item_id IS NOT NULL
     AND NOT EXISTS (
       SELECT 1
       FROM public.order_items oi
       JOIN public.orders o ON o.id = oi.order_id
       LEFT JOIN public.products oi_product ON oi_product.id = oi.product_id
       LEFT JOIN public.product_variants oi_variant ON oi_variant.id = oi.variant_id
       LEFT JOIN public.variant_inventory event_unit
         ON event_unit.id = NEW.inventory_unit_id
       LEFT JOIN public.product_variants event_unit_variant
         ON event_unit_variant.id = event_unit.variant_id
       LEFT JOIN public.product_variants event_variant
         ON event_variant.id = NEW.variant_id
       WHERE oi.id = NEW.order_item_id
         AND o.merchant_id = NEW.merchant_id
         AND (NEW.order_id IS NULL OR oi.order_id = NEW.order_id)
         AND (
           oi.product_id IS NULL
           OR (
             oi_product.id IS NOT NULL
             AND oi_product.merchant_id = NEW.merchant_id
           )
         )
         AND (NEW.product_id IS NULL OR oi.product_id = NEW.product_id)
         AND (
           oi.variant_id IS NULL
           OR (
             oi_variant.id IS NOT NULL
             AND oi_variant.merchant_id = NEW.merchant_id
             AND oi_variant.product_id = oi.product_id
             AND oi_variant.is_inventory_anchor IS NOT TRUE
           )
         )
         AND (
           NEW.variant_id IS NULL
           OR oi.variant_id = NEW.variant_id
           OR (
             oi.variant_id IS NULL
             AND oi_product.id IS NOT NULL
             AND oi_product.has_variants IS NOT TRUE
             AND COALESCE(oi_product.variant_model, 'legacy') <> 'sku_matrix'
             AND oi_product.inventory_anchor_variant_id = NEW.variant_id
             AND event_variant.id = NEW.variant_id
             AND event_variant.merchant_id = NEW.merchant_id
             AND event_variant.product_id = oi.product_id
             AND event_variant.is_inventory_anchor IS TRUE
           )
         )
         AND (
           NEW.inventory_unit_id IS NULL
           OR (
             event_unit.id IS NOT NULL
             AND event_unit.merchant_id = NEW.merchant_id
             AND event_unit_variant.id IS NOT NULL
             AND event_unit_variant.merchant_id = NEW.merchant_id
             AND event_unit_variant.product_id = oi.product_id
             AND (
               oi.variant_id = event_unit.variant_id
               OR (
                 oi.variant_id IS NULL
                 AND oi_product.id IS NOT NULL
                 AND oi_product.has_variants IS NOT TRUE
                 AND COALESCE(oi_product.variant_model, 'legacy') <> 'sku_matrix'
                 AND oi_product.inventory_anchor_variant_id = event_unit.variant_id
                 AND event_unit_variant.is_inventory_anchor IS TRUE
               )
             )
           )
         )
     ) THEN
    RAISE EXCEPTION 'variant_inventory_event_order_item_scope_mismatch'
      USING ERRCODE = '23514';
  END IF;

  IF NEW.branch_id IS NOT NULL
     AND NOT EXISTS (
       SELECT 1
       FROM public.branches b
       WHERE b.id = NEW.branch_id
         AND b.merchant_id = NEW.merchant_id
     ) THEN
    RAISE EXCEPTION 'variant_inventory_event_branch_scope_mismatch'
      USING ERRCODE = '23514';
  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION private.ensure_variant_inventory_event_scope_matches_merchant() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_variant_inventory_events_scope ON private.variant_inventory_events;
CREATE TRIGGER trg_variant_inventory_events_scope
  BEFORE INSERT ON private.variant_inventory_events
  FOR EACH ROW
  EXECUTE FUNCTION private.ensure_variant_inventory_event_scope_matches_merchant();

-- Pre-migration data validation check block before creating unique index
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM public.variant_inventory vi
    WHERE vi.identifier_value IS NULL
  ) THEN
    RAISE EXCEPTION 'null_variant_inventory_identifier_exists'
      USING ERRCODE = '23514';
  END IF;

  UPDATE public.variant_inventory vi
  SET identifier_type = CASE
    WHEN public.normalize_inventory_identifier(vi.identifier_value) ~ '^[0-9]{15}$' THEN 'imei'
    ELSE 'serial'
  END
  WHERE (vi.identifier_type IS NULL OR vi.identifier_type NOT IN ('imei', 'serial'))
    AND vi.identifier_value IS NOT NULL;

  IF EXISTS (
    SELECT 1
    FROM public.variant_inventory vi
    WHERE public.normalize_inventory_identifier(vi.identifier_value) = ''
  ) THEN
    RAISE EXCEPTION 'blank_variant_inventory_identifier_exists'
      USING ERRCODE = '23514';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.variant_inventory vi
    WHERE vi.identifier_type = 'imei'
      AND public.normalize_inventory_identifier(vi.identifier_value) !~ '^[0-9]{15}$'
  ) THEN
    RAISE EXCEPTION 'invalid_imei_identifier_exists'
      USING ERRCODE = '23514';
  END IF;

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
    RAISE EXCEPTION 'duplicate_variant_inventory_identifiers_exist'
      USING ERRCODE = '23505';
  END IF;
END $$;

ALTER TABLE public.variant_inventory
  ALTER COLUMN identifier_value SET NOT NULL,
  ALTER COLUMN identifier_type SET NOT NULL;

ALTER TABLE public.variant_inventory
  DROP CONSTRAINT IF EXISTS variant_inventory_identifier_type_check;

ALTER TABLE public.variant_inventory
  ADD CONSTRAINT variant_inventory_identifier_type_check
  CHECK (identifier_type IN ('imei', 'serial'));

ALTER TABLE public.variant_inventory
  DROP CONSTRAINT IF EXISTS variant_inventory_identifier_value_not_blank;

ALTER TABLE public.variant_inventory
  ADD CONSTRAINT variant_inventory_identifier_value_not_blank
  CHECK (public.normalize_inventory_identifier(identifier_value) <> '');

ALTER TABLE public.variant_inventory
  DROP CONSTRAINT IF EXISTS variant_inventory_identifier_shape_check;

ALTER TABLE public.variant_inventory
  ADD CONSTRAINT variant_inventory_identifier_shape_check
  CHECK (
    (
      identifier_type = 'imei'
      AND public.normalize_inventory_identifier(identifier_value) ~ '^[0-9]{15}$'
    )
    OR (
      identifier_type = 'serial'
      AND public.normalize_inventory_identifier(identifier_value) <> ''
    )
  );

CREATE UNIQUE INDEX IF NOT EXISTS variant_inventory_merchant_normalized_identifier_uidx
  ON public.variant_inventory (
    merchant_id,
    public.normalize_inventory_identifier(identifier_value)
  );

CREATE INDEX IF NOT EXISTS variant_inventory_available_claim_idx
  ON public.variant_inventory (merchant_id, variant_id, branch_id, created_at, id)
  WHERE status = 'available'
    AND order_id IS NULL
    AND order_item_id IS NULL
    AND sold_at IS NULL;

CREATE INDEX IF NOT EXISTS variant_inventory_expired_reservation_idx
  ON public.variant_inventory (reservation_expires_at, merchant_id, order_id)
  WHERE status = 'reserved'
    AND reservation_expires_at IS NOT NULL;

CREATE INDEX IF NOT EXISTS variant_inventory_order_item_idx
  ON public.variant_inventory (order_item_id)
  WHERE order_item_id IS NOT NULL;

-- Step 5: Preserve Simple-Product Inventory Anchor Variants
CREATE UNIQUE INDEX IF NOT EXISTS idx_product_variants_one_inventory_anchor
  ON public.product_variants (merchant_id, product_id)
  WHERE is_inventory_anchor = true;

CREATE OR REPLACE FUNCTION private.ensure_product_inventory_anchor_variant(
  p_merchant_id uuid,
  p_product_id uuid
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_anchor_id uuid;
  v_has_variants boolean;
  v_variant_model text;
  v_product_sku text;
BEGIN
  SELECT has_variants, variant_model, sku, inventory_anchor_variant_id
  INTO v_has_variants, v_variant_model, v_product_sku, v_anchor_id
  FROM public.products
  WHERE id = p_product_id AND merchant_id = p_merchant_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'product_not_found' USING ERRCODE = '23514';
  END IF;

  IF v_has_variants IS DISTINCT FROM TRUE
     AND COALESCE(v_variant_model, 'legacy') <> 'sku_matrix' THEN

    IF v_anchor_id IS NOT NULL THEN
      SELECT id INTO v_anchor_id
      FROM public.product_variants
      WHERE id = v_anchor_id
        AND product_id = p_product_id
        AND merchant_id = p_merchant_id
        AND is_inventory_anchor = true;

      IF FOUND THEN
        RETURN v_anchor_id;
      END IF;
    END IF;

    SELECT id INTO v_anchor_id
    FROM public.product_variants
    WHERE product_id = p_product_id
      AND merchant_id = p_merchant_id
      AND is_inventory_anchor = true
    LIMIT 1;

    IF FOUND THEN
      UPDATE public.products
      SET inventory_anchor_variant_id = v_anchor_id
      WHERE id = p_product_id;

      RETURN v_anchor_id;
    END IF;

    INSERT INTO public.product_variants (
      id,
      product_id,
      merchant_id,
      sku,
      is_inventory_anchor,
      attributes,
      price_override,
      inventory_tracking_policy
    ) VALUES (
      gen_random_uuid(),
      p_product_id,
      p_merchant_id,
      COALESCE(v_product_sku, 'anchor-' || p_product_id::text),
      true,
      '{"is_anchor": true}'::jsonb,
      0,
      'inherit'
    ) RETURNING id INTO v_anchor_id;

    UPDATE public.products
    SET inventory_anchor_variant_id = v_anchor_id
    WHERE id = p_product_id;

    RETURN v_anchor_id;
  ELSE
    RAISE EXCEPTION 'cannot_create_anchor_for_variant_product' USING ERRCODE = '23514';
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION private.ensure_product_inventory_anchor_variant(uuid, uuid) FROM PUBLIC, anon, authenticated;

-- Trigger functions to validate and guard product inventory anchors
CREATE OR REPLACE FUNCTION private.validate_product_inventory_anchor()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_variant_valid boolean;
BEGIN
  IF NEW.inventory_anchor_variant_id IS NULL THEN
    RETURN NEW;
  END IF;

  IF NEW.has_variants IS TRUE OR NEW.variant_model = 'sku_matrix' THEN
    RAISE EXCEPTION 'anchor_forbidden_for_variant_product' USING ERRCODE = '23514';
  END IF;

  SELECT EXISTS (
    SELECT 1
    FROM public.product_variants pv
    WHERE pv.id = NEW.inventory_anchor_variant_id
      AND pv.product_id = NEW.id
      AND pv.merchant_id = NEW.merchant_id
      AND pv.is_inventory_anchor = true
  ) INTO v_variant_valid;

  IF v_variant_valid IS NOT TRUE THEN
    RAISE EXCEPTION 'invalid_inventory_anchor_variant' USING ERRCODE = '23514';
  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION private.validate_product_inventory_anchor() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_validate_product_inventory_anchor ON public.products;
CREATE TRIGGER trg_validate_product_inventory_anchor
  BEFORE INSERT OR UPDATE OF inventory_anchor_variant_id, has_variants, variant_model, merchant_id
  ON public.products
  FOR EACH ROW
  EXECUTE FUNCTION private.validate_product_inventory_anchor();

-- Default variant guard: default variant cannot be an anchor
ALTER TABLE public.products
  DROP CONSTRAINT IF EXISTS products_default_variant_id_not_anchor_fkey;

CREATE OR REPLACE FUNCTION private.validate_product_default_variant()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_is_anchor boolean;
BEGIN
  IF NEW.default_variant_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT is_inventory_anchor INTO v_is_anchor
  FROM public.product_variants
  WHERE id = NEW.default_variant_id;

  IF v_is_anchor IS TRUE THEN
    RAISE EXCEPTION 'default_variant_cannot_be_inventory_anchor' USING ERRCODE = '23514';
  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION private.validate_product_default_variant() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_validate_product_default_variant ON public.products;
CREATE TRIGGER trg_validate_product_default_variant
  BEFORE INSERT OR UPDATE OF default_variant_id
  ON public.products
  FOR EACH ROW
  EXECUTE FUNCTION private.validate_product_default_variant();

CREATE OR REPLACE FUNCTION private.guard_product_variants_anchor_modification()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  -- If variant is referenced as anchor, block modifications of key fields
  IF EXISTS (
    SELECT 1
    FROM public.products p
    WHERE p.inventory_anchor_variant_id = OLD.id
  ) THEN
    IF NEW.is_inventory_anchor IS NOT TRUE THEN
      RAISE EXCEPTION 'cannot_remove_anchor_flag_from_referenced_variant' USING ERRCODE = '23514';
    END IF;
    IF NEW.product_id IS DISTINCT FROM OLD.product_id OR NEW.merchant_id IS DISTINCT FROM OLD.merchant_id THEN
      RAISE EXCEPTION 'cannot_move_referenced_anchor_variant' USING ERRCODE = '23514';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION private.guard_product_variants_anchor_modification() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_guard_product_variants_anchor_modification ON public.product_variants;
CREATE TRIGGER trg_guard_product_variants_anchor_modification
  BEFORE UPDATE OF is_inventory_anchor, product_id, merchant_id
  ON public.product_variants
  FOR EACH ROW
  EXECUTE FUNCTION private.guard_product_variants_anchor_modification();

CREATE OR REPLACE FUNCTION private.guard_product_variants_deletion()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM public.products p
    WHERE p.inventory_anchor_variant_id = OLD.id
  ) THEN
    RAISE EXCEPTION 'cannot_delete_referenced_anchor_variant' USING ERRCODE = '23514';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.variant_inventory vi
    WHERE vi.variant_id = OLD.id
  ) THEN
    RAISE EXCEPTION 'variant_has_serialized_inventory_history' USING ERRCODE = '23514';
  END IF;

  RETURN OLD;
END;
$$;

REVOKE ALL ON FUNCTION private.guard_product_variants_deletion() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_guard_product_variants_deletion ON public.product_variants;
CREATE TRIGGER trg_guard_product_variants_deletion
  BEFORE DELETE ON public.product_variants
  FOR EACH ROW
  EXECUTE FUNCTION private.guard_product_variants_deletion();

CREATE OR REPLACE FUNCTION private.guard_products_deletion()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM public.product_variants pv
    JOIN public.variant_inventory vi ON vi.variant_id = pv.id
    WHERE pv.product_id = OLD.id
  ) THEN
    RAISE EXCEPTION 'product_has_serialized_inventory_history' USING ERRCODE = '23514';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM private.variant_inventory_events vie
    WHERE vie.product_id = OLD.id
      AND vie.event_type NOT IN ('reservation_released', 'reservation_expired')
  ) THEN
    RAISE EXCEPTION 'product_has_serialized_inventory_history' USING ERRCODE = '23514';
  END IF;

  RETURN OLD;
END;
$$;

REVOKE ALL ON FUNCTION private.guard_products_deletion() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_guard_products_deletion ON public.products;
CREATE TRIGGER trg_guard_products_deletion
  BEFORE DELETE ON public.products
  FOR EACH ROW
  EXECUTE FUNCTION private.guard_products_deletion();

-- Step 6: Backfill Legacy Fulfillment Details
DO $$
DECLARE
  v_prod record;
  v_items jsonb;
  v_item jsonb;
  v_imei text;
  v_serial text;
  v_anchor_id uuid;
  v_count integer;
  v_norm_id text;
BEGIN
  -- Verify no legacy duplicates exist within same merchant
  IF EXISTS (
    SELECT 1
    FROM (
      SELECT
        p.merchant_id,
        public.normalize_inventory_identifier(item->>'imei') AS normalized_id
      FROM public.products p
      CROSS JOIN LATERAL jsonb_array_elements(public.get_fulfillment_items_array(p.fulfillment_details)) item
      WHERE item->>'imei' IS NOT NULL
      UNION ALL
      SELECT
        p.merchant_id,
        public.normalize_inventory_identifier(item->>'serial') AS normalized_id
      FROM public.products p
      CROSS JOIN LATERAL jsonb_array_elements(public.get_fulfillment_items_array(p.fulfillment_details)) item
      WHERE item->>'serial' IS NOT NULL
    ) all_legacy
    GROUP BY merchant_id, normalized_id
    HAVING count(*) > 1
  ) THEN
    RAISE EXCEPTION 'duplicate_legacy_fulfillment_identifiers_exist'
      USING ERRCODE = '23505';
  END IF;

  -- Verify no legacy overlaps with existing variant_inventory
  IF EXISTS (
    SELECT 1
    FROM (
      SELECT
        p.merchant_id,
        public.normalize_inventory_identifier(item->>'imei') AS normalized_id
      FROM public.products p
      CROSS JOIN LATERAL jsonb_array_elements(public.get_fulfillment_items_array(p.fulfillment_details)) item
      WHERE item->>'imei' IS NOT NULL
      UNION ALL
      SELECT
        p.merchant_id,
        public.normalize_inventory_identifier(item->>'serial') AS normalized_id
      FROM public.products p
      CROSS JOIN LATERAL jsonb_array_elements(public.get_fulfillment_items_array(p.fulfillment_details)) item
      WHERE item->>'serial' IS NOT NULL
    ) legacy_ids
    JOIN public.variant_inventory vi
      ON vi.merchant_id = legacy_ids.merchant_id
      AND public.normalize_inventory_identifier(vi.identifier_value) = legacy_ids.normalized_id
  ) THEN
    RAISE EXCEPTION 'legacy_fulfillment_identifier_already_exists'
      USING ERRCODE = '23505';
  END IF;

  -- Loop simple products to backfill
  FOR v_prod IN
    SELECT id, merchant_id, fulfillment_details, inventory_tracking_policy
    FROM public.products
    WHERE has_variants IS DISTINCT FROM TRUE
      AND COALESCE(variant_model, 'legacy') <> 'sku_matrix'
  LOOP
    v_items := public.get_fulfillment_items_array(v_prod.fulfillment_details);
    IF jsonb_array_length(v_items) > 0 THEN
      -- Create anchor variant
      v_anchor_id := private.ensure_product_inventory_anchor_variant(v_prod.merchant_id, v_prod.id);
      v_count := 0;

      FOR v_item IN SELECT * FROM jsonb_array_elements(v_items)
      LOOP
        v_imei := btrim(v_item->>'imei');
        v_serial := btrim(v_item->>'serial');

        IF v_imei IS NOT NULL OR v_serial IS NOT NULL THEN
          v_count := v_count + 1;

          INSERT INTO public.variant_inventory (
            id,
            variant_id,
            merchant_id,
            identifier_type,
            identifier_value,
            status,
            source,
            notes
          ) VALUES (
            gen_random_uuid(),
            v_anchor_id,
            v_prod.merchant_id,
            CASE WHEN v_imei IS NOT NULL AND public.normalize_inventory_identifier(v_imei) ~ '^[0-9]{15}$' THEN 'imei' ELSE 'serial' END,
            COALESCE(v_imei, v_serial),
            'available',
            'merchant_stock',
            CASE WHEN v_imei IS NOT NULL AND v_serial IS NOT NULL THEN 'Serial backfill: ' || v_serial ELSE NULL END
          )
          RETURNING id INTO v_norm_id;

          -- Record event
          PERFORM private.record_variant_inventory_event(
            v_norm_id,
            v_prod.merchant_id,
            v_prod.id,
            v_anchor_id,
            'restocked',
            NULL,
            'available',
            NULL,
            NULL,
            NULL,
            NULL,
            'system',
            '{"source": "merchant_stock"}'::jsonb
          );
        END IF;
      END LOOP;

      IF v_count > 0 AND v_prod.inventory_tracking_policy = 'off' THEN
        UPDATE public.products
        SET inventory_tracking_policy = 'serialized_then_unlimited'
        WHERE id = v_prod.id;
      END IF;
    END IF;
  END LOOP;
END $$;

-- Triggers for stock sync on variant inventory change
CREATE OR REPLACE FUNCTION private.sync_serialized_stock(
  p_merchant_id uuid,
  p_product_id uuid
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_has_variants boolean;
  v_variant_model text;
  v_anchor_id uuid;
  v_total_stock integer;
BEGIN
  SELECT has_variants, variant_model, inventory_anchor_variant_id
  INTO v_has_variants, v_variant_model, v_anchor_id
  FROM public.products
  WHERE id = p_product_id AND merchant_id = p_merchant_id;

  IF NOT FOUND THEN
    RETURN;
  END IF;

  IF v_has_variants IS DISTINCT FROM TRUE
     AND COALESCE(v_variant_model, 'legacy') <> 'sku_matrix' THEN
    IF public.get_effective_inventory_tracking_policy(
         (SELECT p.inventory_tracking_policy FROM public.products p WHERE p.id = p_product_id),
         'inherit'
       ) IN ('serialized_strict', 'serialized_then_unlimited')
    THEN
      IF v_anchor_id IS NULL THEN
        v_anchor_id := private.ensure_product_inventory_anchor_variant(p_merchant_id, p_product_id);
      END IF;

      SELECT COALESCE(COUNT(*), 0)
      INTO v_total_stock
      FROM public.variant_inventory
      WHERE variant_id = v_anchor_id
        AND merchant_id = p_merchant_id
        AND status = 'available'
        AND order_id IS NULL
        AND order_item_id IS NULL
        AND sold_at IS NULL;

      UPDATE public.product_variants
      SET stock_quantity = v_total_stock,
          updated_at = now()
      WHERE id = v_anchor_id;

      UPDATE public.products
      SET stock_quantity = v_total_stock,
          stock = v_total_stock,
          updated_at = now()
      WHERE id = p_product_id;
    END IF;
  ELSE
    UPDATE public.product_variants pv
    SET stock_quantity = (
          SELECT COALESCE(COUNT(*), 0)
          FROM public.variant_inventory vi
          WHERE vi.variant_id = pv.id
            AND vi.merchant_id = p_merchant_id
            AND vi.status = 'available'
            AND vi.order_id IS NULL
            AND vi.order_item_id IS NULL
            AND vi.sold_at IS NULL
        ),
        updated_at = now()
    WHERE pv.product_id = p_product_id
      AND pv.merchant_id = p_merchant_id
      AND public.get_effective_inventory_tracking_policy(
            (SELECT p.inventory_tracking_policy FROM public.products p WHERE p.id = p_product_id),
            pv.inventory_tracking_policy
          ) IN ('serialized_strict', 'serialized_then_unlimited');

    IF v_variant_model = 'sku_matrix' THEN
      PERFORM public.rebuild_sku_matrix_product_projection(p_product_id);
    ELSE
      SELECT COALESCE(SUM(stock_quantity), 0)
      INTO v_total_stock
      FROM public.product_variants
      WHERE product_id = p_product_id AND merchant_id = p_merchant_id;

      UPDATE public.products
      SET stock_quantity = v_total_stock,
          stock = v_total_stock,
          updated_at = now()
      WHERE id = p_product_id;
    END IF;
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION private.on_variant_inventory_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_product_id uuid;
BEGIN
  IF TG_OP = 'DELETE' THEN
    SELECT product_id INTO v_product_id
    FROM public.product_variants
    WHERE id = OLD.variant_id;

    IF FOUND THEN
      PERFORM private.sync_serialized_stock(OLD.merchant_id, v_product_id);
    END IF;
  ELSE
    SELECT product_id INTO v_product_id
    FROM public.product_variants
    WHERE id = NEW.variant_id;

    IF FOUND THEN
      PERFORM private.sync_serialized_stock(NEW.merchant_id, v_product_id);

      IF TG_OP = 'UPDATE' AND NEW.variant_id IS DISTINCT FROM OLD.variant_id THEN
        SELECT product_id INTO v_product_id
        FROM public.product_variants
        WHERE id = OLD.variant_id;

        IF FOUND THEN
          PERFORM private.sync_serialized_stock(OLD.merchant_id, v_product_id);
        END IF;
      END IF;
    END IF;
  END IF;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_variant_inventory_stock ON public.variant_inventory;
CREATE TRIGGER trg_sync_variant_inventory_stock
  AFTER INSERT OR DELETE OR UPDATE OF status, variant_id
  ON public.variant_inventory
  FOR EACH ROW
  EXECUTE FUNCTION private.on_variant_inventory_change();

-- Release temporary reservations when order item / order is deleted
CREATE OR REPLACE FUNCTION private.on_order_item_deleted()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_affected record;
BEGIN
  IF EXISTS (
    SELECT 1
    FROM public.variant_inventory vi
    WHERE vi.order_item_id = OLD.id
      AND (
        vi.status <> 'reserved'
        OR vi.reservation_expires_at IS NULL
      )
  ) THEN
    RAISE EXCEPTION 'cannot_delete_order_item_with_historical_serialized_units'
      USING ERRCODE = '23514';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM private.variant_inventory_events vie
    WHERE vie.order_item_id = OLD.id
      AND vie.event_type NOT IN (
        'reserved',
        'reservation_released',
        'reservation_expired'
      )
  ) THEN
    RAISE EXCEPTION 'cannot_delete_order_item_with_historical_inventory_events'
      USING ERRCODE = '23514';
  END IF;

  FOR v_affected IN
    WITH targets AS (
      SELECT
        vi.id,
        vi.merchant_id,
        pv.product_id,
        vi.variant_id,
        vi.order_id,
        vi.order_item_id,
        vi.branch_id
      FROM public.variant_inventory vi
      JOIN public.product_variants pv ON pv.id = vi.variant_id
      WHERE vi.order_item_id = OLD.id
        AND vi.status = 'reserved'
        AND vi.reservation_expires_at IS NOT NULL
    ),
    release_events AS (
      SELECT
        targets.id,
        private.record_variant_inventory_event(
          targets.id,
          targets.merchant_id,
          targets.product_id,
          targets.variant_id,
          'reservation_released',
          'reserved',
          'available',
          targets.order_id,
          targets.order_item_id,
          targets.branch_id,
          NULL,
          'system',
          jsonb_build_object('releaseReason', 'order_item_deleted')
        ) AS event_id
      FROM targets
    ),
    released AS (
      UPDATE public.variant_inventory vi
      SET status = 'available',
          order_id = NULL,
          order_item_id = NULL,
          reserved_at = NULL,
          reservation_expires_at = NULL
      WHERE vi.id IN (SELECT release_events.id FROM release_events)
      RETURNING vi.id
    )
    SELECT DISTINCT targets.merchant_id, targets.product_id
    FROM targets
    JOIN released ON released.id = targets.id
  LOOP
    PERFORM private.sync_serialized_stock(v_affected.merchant_id, v_affected.product_id);
  END LOOP;

  RETURN OLD;
END;
$$;

CREATE OR REPLACE FUNCTION private.on_order_deleted()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_affected record;
BEGIN
  IF EXISTS (
    SELECT 1
    FROM public.variant_inventory vi
    WHERE vi.order_id = OLD.id
      AND (
        vi.status <> 'reserved'
        OR vi.reservation_expires_at IS NULL
      )
  ) THEN
    RAISE EXCEPTION 'cannot_delete_order_with_historical_serialized_units'
      USING ERRCODE = '23514';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM private.variant_inventory_events vie
    WHERE vie.order_id = OLD.id
      AND vie.event_type NOT IN (
        'reserved',
        'reservation_released',
        'reservation_expired'
      )
  ) THEN
    RAISE EXCEPTION 'cannot_delete_order_with_historical_inventory_events'
      USING ERRCODE = '23514';
  END IF;

  FOR v_affected IN
    WITH targets AS (
      SELECT
        vi.id,
        vi.merchant_id,
        pv.product_id,
        vi.variant_id,
        vi.order_id,
        vi.order_item_id,
        vi.branch_id
      FROM public.variant_inventory vi
      JOIN public.product_variants pv ON pv.id = vi.variant_id
      WHERE vi.order_id = OLD.id
        AND vi.status = 'reserved'
        AND vi.reservation_expires_at IS NOT NULL
    ),
    release_events AS (
      SELECT
        targets.id,
        private.record_variant_inventory_event(
          targets.id,
          targets.merchant_id,
          targets.product_id,
          targets.variant_id,
          'reservation_released',
          'reserved',
          'available',
          targets.order_id,
          targets.order_item_id,
          targets.branch_id,
          NULL,
          'system',
          jsonb_build_object('releaseReason', 'order_deleted')
        ) AS event_id
      FROM targets
    ),
    released AS (
      UPDATE public.variant_inventory vi
      SET status = 'available',
          order_id = NULL,
          order_item_id = NULL,
          reserved_at = NULL,
          reservation_expires_at = NULL
      WHERE vi.id IN (SELECT release_events.id FROM release_events)
      RETURNING vi.id
    )
    SELECT DISTINCT targets.merchant_id, targets.product_id
    FROM targets
    JOIN released ON released.id = targets.id
  LOOP
    PERFORM private.sync_serialized_stock(v_affected.merchant_id, v_affected.product_id);
  END LOOP;

  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS trg_on_order_item_deleted ON public.order_items;
CREATE TRIGGER trg_on_order_item_deleted
  BEFORE DELETE ON public.order_items
  FOR EACH ROW
  EXECUTE FUNCTION private.on_order_item_deleted();

DROP TRIGGER IF EXISTS trg_on_order_deleted ON public.orders;
CREATE TRIGGER trg_on_order_deleted
  BEFORE DELETE ON public.orders
  FOR EACH ROW
  EXECUTE FUNCTION private.on_order_deleted();

-- Step 7: Define save_mobile_admin_product_with_variants wrapper/helper
CREATE OR REPLACE FUNCTION private.save_mobile_admin_product_with_variants(
  p_merchant_id uuid,
  p_product_id uuid,
  p_product_payload jsonb,
  p_variants_payload jsonb,
  p_actor_role text DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_name text;
  v_description text;
  v_price numeric;
  v_compare_at_price numeric;
  v_cost_price numeric;
  v_sku text;
  v_barcode text;
  v_manage_stock boolean;
  v_has_variants boolean;
  v_variant_model text;
  v_images jsonb;
  v_category_id uuid;
  v_brand text;
  v_weight numeric;
  v_meta_title text;
  v_meta_description text;
  v_tags text[];
  v_status text;
  v_slug text;
  v_inventory_tracking_policy text;

  v_variant record;
  v_existing_ids uuid[];
  v_incoming_ids uuid[];
  v_id_to_delete uuid;
  v_visible_count integer;
  v_anchor_id uuid;
  v_target_variant_id uuid;
BEGIN
  -- 1. Auth check
  IF auth.role() <> 'service_role'
     AND NOT public.has_merchant_access(p_merchant_id) THEN
    RAISE EXCEPTION 'forbidden_save_mobile_admin_product_with_variants' USING ERRCODE = '42501';
  END IF;

  -- 2. Lock product row if exists
  PERFORM 1 FROM public.products WHERE id = p_product_id AND merchant_id = p_merchant_id FOR UPDATE;

  -- Extract product fields from payload
  v_name := p_product_payload->>'name';
  v_description := p_product_payload->>'description';
  v_price := (p_product_payload->>'price')::numeric;
  v_compare_at_price := (p_product_payload->>'compare_at_price')::numeric;
  v_cost_price := (p_product_payload->>'cost_price')::numeric;
  v_sku := p_product_payload->>'sku';
  v_barcode := p_product_payload->>'barcode';
  v_manage_stock := COALESCE((p_product_payload->>'manage_stock')::boolean, false);
  v_has_variants := COALESCE((p_product_payload->>'has_variants')::boolean, false);
  v_variant_model := p_product_payload->>'variant_model';
  v_images := COALESCE((p_product_payload->'images'), '[]'::jsonb);
  v_category_id := (p_product_payload->>'category_id')::uuid;
  v_brand := p_product_payload->>'brand';
  v_weight := (p_product_payload->>'weight')::numeric;
  v_meta_title := p_product_payload->>'meta_title';
  v_meta_description := p_product_payload->>'meta_description';
  IF p_product_payload ? 'tags' AND jsonb_typeof(p_product_payload->'tags') = 'array' THEN
    SELECT array_agg(t.val)::text[] INTO v_tags FROM (SELECT jsonb_array_elements_text(p_product_payload->'tags') AS val) t;
  END IF;
  v_status := COALESCE(p_product_payload->>'status', 'draft');
  v_slug := p_product_payload->>'slug';
  v_inventory_tracking_policy := COALESCE(p_product_payload->>'inventory_tracking_policy', 'off');

  -- Verify active product offers if switching to serialized tracking
  IF v_inventory_tracking_policy IN ('serialized_strict', 'serialized_then_unlimited') THEN
    IF EXISTS (
      SELECT 1 FROM public.product_offers WHERE product_id = p_product_id
    ) THEN
      RAISE EXCEPTION 'legacy_product_offers_must_be_migrated' USING ERRCODE = '23514';
    END IF;
  END IF;

  -- Upsert Product
  INSERT INTO public.products (
    id, merchant_id, name, description, price, compare_at_price, cost_price,
    sku, barcode, manage_stock, has_variants, variant_model, images,
    category_id, brand, weight, meta_title, meta_description, tags, status, slug,
    inventory_tracking_policy
  ) VALUES (
    p_product_id, p_merchant_id, v_name, v_description, v_price, v_compare_at_price, v_cost_price,
    v_sku, v_barcode, v_manage_stock, v_has_variants, v_variant_model, v_images,
    v_category_id, v_brand, v_weight, v_meta_title, v_meta_description, v_tags, v_status, v_slug,
    v_inventory_tracking_policy
  )
  ON CONFLICT (id) DO UPDATE SET
    name = EXCLUDED.name,
    description = EXCLUDED.description,
    price = EXCLUDED.price,
    compare_at_price = EXCLUDED.compare_at_price,
    cost_price = EXCLUDED.cost_price,
    sku = EXCLUDED.sku,
    barcode = EXCLUDED.barcode,
    manage_stock = EXCLUDED.manage_stock,
    has_variants = EXCLUDED.has_variants,
    variant_model = EXCLUDED.variant_model,
    images = EXCLUDED.images,
    category_id = EXCLUDED.category_id,
    brand = EXCLUDED.brand,
    weight = EXCLUDED.weight,
    meta_title = EXCLUDED.meta_title,
    meta_description = EXCLUDED.meta_description,
    tags = EXCLUDED.tags,
    status = EXCLUDED.status,
    slug = EXCLUDED.slug,
    inventory_tracking_policy = EXCLUDED.inventory_tracking_policy,
    updated_at = now();

  -- Get current variant IDs (excluding anchors)
  SELECT array_agg(id) INTO v_existing_ids
  FROM public.product_variants
  WHERE product_id = p_product_id AND merchant_id = p_merchant_id AND is_inventory_anchor = false;

  -- Upsert Visible Variants
  IF v_has_variants IS TRUE THEN
    -- Extract incoming variant IDs to preserve
    SELECT array_agg((val->>'id')::uuid) INTO v_incoming_ids
    FROM jsonb_array_elements(p_variants_payload) val
    WHERE val->>'id' IS NOT NULL;

    -- Delete old variants not in incoming payload (and exclude anchors)
    IF v_existing_ids IS NOT NULL THEN
      FOREACH v_id_to_delete IN ARRAY v_existing_ids
      LOOP
        IF v_incoming_ids IS NULL OR NOT (v_id_to_delete = ANY(v_incoming_ids)) THEN
          DELETE FROM public.product_variants
          WHERE id = v_id_to_delete
            AND product_id = p_product_id
            AND merchant_id = p_merchant_id
            AND is_inventory_anchor = false;
        END IF;
      END LOOP;
    END IF;

    -- Upsert incoming variants
    FOR v_variant IN
      SELECT
        (val->>'id')::uuid AS id,
        val->>'sku' AS sku,
        COALESCE(val->'attributes', '{}'::jsonb) AS attributes,
        val->>'condition' AS condition,
        (val->>'price_override')::numeric AS price_override,
        COALESCE((val->>'stock_quantity')::integer, 0) AS stock_quantity,
        COALESCE((val->'images'), '[]'::jsonb) AS images,
        val->>'primary_image' AS primary_image,
        COALESCE(val->>'inventory_tracking_policy', 'inherit') AS policy
      LOOP
        -- Re-verify no active offers exist if tracking policy is serialized
        IF v_inventory_tracking_policy IN ('serialized_strict', 'serialized_then_unlimited')
           OR v_variant.policy IN ('serialized_strict', 'serialized_then_unlimited') THEN
          IF EXISTS (
            SELECT 1 FROM public.product_offers WHERE product_id = p_product_id
          ) THEN
            RAISE EXCEPTION 'legacy_product_offers_must_be_migrated' USING ERRCODE = '23514';
          END IF;
        END IF;

        INSERT INTO public.product_variants (
          id, product_id, merchant_id, sku, attributes, condition, price_override,
          stock_quantity, images, primary_image, is_inventory_anchor, inventory_tracking_policy
        ) VALUES (
          COALESCE(v_variant.id, gen_random_uuid()), p_product_id, p_merchant_id,
          v_variant.sku, v_variant.attributes, v_variant.condition, v_variant.price_override,
          v_variant.stock_quantity, v_variant.images, v_variant.primary_image, false, v_variant.policy
        )
        ON CONFLICT (id) DO UPDATE SET
          sku = EXCLUDED.sku,
          attributes = EXCLUDED.attributes,
          condition = EXCLUDED.condition,
          price_override = EXCLUDED.price_override,
          stock_quantity = EXCLUDED.stock_quantity,
          images = EXCLUDED.images,
          primary_image = EXCLUDED.primary_image,
          inventory_tracking_policy = EXCLUDED.inventory_tracking_policy,
          updated_at = now();
      END LOOP;

      -- If converting from simple to variant, we need to handle anchor reassignment
      SELECT inventory_anchor_variant_id INTO v_anchor_id FROM public.products WHERE id = p_product_id;
      IF v_anchor_id IS NOT NULL THEN
        IF EXISTS (SELECT 1 FROM public.variant_inventory WHERE variant_id = v_anchor_id) THEN
          v_target_variant_id := (p_product_payload->>'reassign_anchor_to_variant_id')::uuid;
          IF v_target_variant_id IS NULL OR NOT EXISTS (
            SELECT 1 FROM public.product_variants WHERE id = v_target_variant_id AND product_id = p_product_id AND merchant_id = p_merchant_id AND is_inventory_anchor = false
          ) THEN
            RAISE EXCEPTION 'serialized_inventory_reassignment_required' USING ERRCODE = '23514';
          END IF;

          IF EXISTS (
            SELECT 1 FROM public.variant_inventory WHERE variant_id = v_anchor_id AND status = 'reserved'
          ) THEN
            RAISE EXCEPTION 'serialized_inventory_reserved_units_exist' USING ERRCODE = '23514';
          END IF;

          -- Reassign units to new visible variant
          UPDATE public.variant_inventory
          SET variant_id = v_target_variant_id,
              updated_at = now()
          WHERE variant_id = v_anchor_id;

          -- Record event
          PERFORM private.record_variant_inventory_event(
            NULL, p_merchant_id, p_product_id, v_target_variant_id, 'branch_transferred',
            NULL, NULL, NULL, NULL, NULL, NULL, NULL,
            jsonb_build_object('anchorReassignedFrom', v_anchor_id)
          );
        END IF;

        -- Clear anchor link and delete anchor variant
        UPDATE public.products SET inventory_anchor_variant_id = NULL WHERE id = p_product_id;
        DELETE FROM public.product_variants WHERE id = v_anchor_id;
      END IF;

    ELSE
      -- Simple product: Delete all visible variants (keep anchors)
      IF v_existing_ids IS NOT NULL THEN
        FOREACH v_id_to_delete IN ARRAY v_existing_ids
        LOOP
          DELETE FROM public.product_variants
          WHERE id = v_id_to_delete
            AND product_id = p_product_id
            AND merchant_id = p_merchant_id
            AND is_inventory_anchor = false;
        END LOOP;
      END IF;

      -- Ensure anchor variant exists for simple product under serialized policies
      IF v_inventory_tracking_policy IN ('serialized_strict', 'serialized_then_unlimited') THEN
        PERFORM private.ensure_product_inventory_anchor_variant(p_merchant_id, p_product_id);
      END IF;
    END IF;

    -- Sync stock quantities
    PERFORM private.sync_serialized_stock(p_merchant_id, p_product_id);

    RETURN jsonb_build_object('success', true, 'productId', p_product_id);
END;
$$;

DROP FUNCTION IF EXISTS public.save_mobile_admin_product_with_variants(uuid, uuid, jsonb, jsonb, text);

CREATE OR REPLACE FUNCTION public.save_mobile_admin_product_with_variants(
  p_merchant_id uuid,
  p_product_id uuid,
  p_product_payload jsonb,
  p_variants_payload jsonb,
  p_actor_role text DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
AS $$
BEGIN
  RETURN private.save_mobile_admin_product_with_variants(
    p_merchant_id,
    p_product_id,
    p_product_payload,
    p_variants_payload,
    p_actor_role
  );
END;
$$;

REVOKE ALL ON FUNCTION public.save_mobile_admin_product_with_variants(uuid, uuid, jsonb, jsonb, text) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.save_mobile_admin_product_with_variants(uuid, uuid, jsonb, jsonb, text) TO authenticated, service_role;

REVOKE ALL ON FUNCTION private.save_mobile_admin_product_with_variants(uuid, uuid, jsonb, jsonb, text) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION private.save_mobile_admin_product_with_variants(uuid, uuid, jsonb, jsonb, text) TO authenticated, service_role;

-- Revoke direct tables from client roles
REVOKE ALL ON TABLE public.variant_inventory FROM PUBLIC, anon, authenticated;
DROP POLICY IF EXISTS "Merchants can view their inventory" ON public.variant_inventory;
DROP POLICY IF EXISTS "Merchants can insert their inventory" ON public.variant_inventory;
DROP POLICY IF EXISTS "Merchants can update their inventory" ON public.variant_inventory;
DROP POLICY IF EXISTS "Merchants can delete their inventory" ON public.variant_inventory;

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.variant_inventory TO service_role;

-- Task 2: Restock, Listing, and Policy RPCs

CREATE OR REPLACE FUNCTION private.restock_variant_inventory_units(
  p_merchant_id uuid,
  p_product_id uuid,
  p_units jsonb,
  p_variant_id uuid DEFAULT NULL,
  p_inventory_tracking_policy text DEFAULT NULL,
  p_branch_id uuid DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_has_variants boolean;
  v_variant_model text;
  v_anchor_id uuid;
  v_target_variant_id uuid;
  v_unit jsonb;
  v_val text;
  v_type text;
  v_inserted_ids uuid[] := array[]::uuid[];
  v_inserted_count integer := 0;
  v_idx integer;
  v_branch_valid boolean;
  v_source text;
  v_inserted_id uuid;
BEGIN
  -- 1. Auth check
  IF auth.role() <> 'service_role'
     AND NOT public.has_merchant_access(p_merchant_id) THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;

  -- 2. Lock product row and verify ownership
  SELECT has_variants, variant_model, inventory_anchor_variant_id
  INTO v_has_variants, v_variant_model, v_anchor_id
  FROM public.products
  WHERE id = p_product_id AND merchant_id = p_merchant_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'product_not_found' USING ERRCODE = 'P0002';
  END IF;

  -- Validate units payload
  IF p_units IS NULL OR jsonb_array_length(p_units) = 0 THEN
    RAISE EXCEPTION 'empty_units' USING ERRCODE = '22023';
  END IF;

  -- 3. Determine variant_id to use
  IF (v_has_variants IS DISTINCT FROM TRUE AND COALESCE(v_variant_model, 'legacy') <> 'sku_matrix') THEN
    -- Simple product: Ensure anchor variant exists and use it
    PERFORM private.ensure_product_inventory_anchor_variant(p_merchant_id, p_product_id);
    SELECT inventory_anchor_variant_id INTO v_target_variant_id
    FROM public.products
    WHERE id = p_product_id;
  ELSE
    -- Variant product: p_variant_id is required
    IF p_variant_id IS NULL THEN
      RAISE EXCEPTION 'variant_id_required' USING ERRCODE = '22023';
    END IF;

    -- Verify the variant exists, is visible, and belongs to this product/merchant
    SELECT id INTO v_target_variant_id
    FROM public.product_variants
    WHERE id = p_variant_id
      AND product_id = p_product_id
      AND merchant_id = p_merchant_id
      AND is_inventory_anchor = false;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'variant_not_found' USING ERRCODE = 'P0002';
    END IF;
  END IF;

  -- Validate tracking policy if provided
  IF p_inventory_tracking_policy IS NOT NULL THEN
    IF (v_has_variants IS DISTINCT FROM TRUE AND COALESCE(v_variant_model, 'legacy') <> 'sku_matrix') THEN
      -- Product level policy
      IF p_inventory_tracking_policy NOT IN ('off', 'serialized_strict', 'serialized_then_unlimited') THEN
        RAISE EXCEPTION 'invalid_inventory_tracking_policy' USING ERRCODE = '22023';
      END IF;

      UPDATE public.products
      SET inventory_tracking_policy = p_inventory_tracking_policy
      WHERE id = p_product_id;
    ELSE
      -- Variant level policy
      IF p_inventory_tracking_policy NOT IN ('inherit', 'off', 'serialized_strict', 'serialized_then_unlimited') THEN
        RAISE EXCEPTION 'invalid_inventory_tracking_policy' USING ERRCODE = '22023';
      END IF;

      UPDATE public.product_variants
      SET inventory_tracking_policy = p_inventory_tracking_policy
      WHERE id = v_target_variant_id;
    END IF;
  END IF;

  -- 4. Process units
  FOR v_idx IN 0 .. jsonb_array_length(p_units) - 1 LOOP
    v_unit := p_units->v_idx;

    -- Extract and clean identifier
    IF v_unit ? 'imei' AND v_unit->>'imei' IS NOT NULL AND btrim(v_unit->>'imei') <> '' THEN
      v_val := btrim(v_unit->>'imei');
      v_type := 'imei';
    ELSIF v_unit ? 'serial' AND v_unit->>'serial' IS NOT NULL AND btrim(v_unit->>'serial') <> '' THEN
      v_val := btrim(v_unit->>'serial');
      v_type := 'serial';
    ELSE
      v_val := btrim(COALESCE(v_unit->>'identifier_value', ''));
      v_type := COALESCE(v_unit->>'identifier_type', CASE WHEN v_val ~ '^[0-9]{15}$' THEN 'imei' ELSE 'serial' END);
    END IF;

    IF v_val = '' THEN
      RAISE EXCEPTION 'invalid_inventory_identifier' USING ERRCODE = '22023';
    END IF;

    -- Validate IMEI shape
    IF v_type = 'imei' AND v_val !~ '^[0-9]{15}$' THEN
      RAISE EXCEPTION 'invalid_imei_shape' USING ERRCODE = '22023';
    END IF;

    -- Validate branch if provided
    IF p_branch_id IS NOT NULL THEN
      SELECT EXISTS (
        SELECT 1 FROM public.branches WHERE id = p_branch_id AND merchant_id = p_merchant_id AND active = true
      ) INTO v_branch_valid;

      IF v_branch_valid IS NOT TRUE THEN
        RAISE EXCEPTION 'invalid_branch' USING ERRCODE = '23503';
      END IF;
    END IF;

    -- Insert unit
    v_inserted_id := gen_random_uuid();
    v_source := COALESCE(v_unit->>'source', 'merchant_stock');

    IF v_source NOT IN ('merchant_stock', 'vendor_sourced', 'dropship') THEN
      RAISE EXCEPTION 'invalid_inventory_source' USING ERRCODE = '22023';
    END IF;

    BEGIN
      INSERT INTO public.variant_inventory (
        id, merchant_id, variant_id, branch_id, identifier_type, identifier_value, status, source, notes
      ) VALUES (
        v_inserted_id, p_merchant_id, v_target_variant_id, p_branch_id, v_type, v_val, 'available', v_source, v_unit->>'notes'
      );

      -- Record restocked event
      PERFORM private.record_variant_inventory_event(
        v_inserted_id, p_merchant_id, p_product_id, v_target_variant_id, 'restocked',
        NULL, 'available', NULL, NULL, p_branch_id, NULL, NULL,
        jsonb_build_object('source', v_source)
      );

      v_inserted_ids := array_append(v_inserted_ids, v_inserted_id);
      v_inserted_count := v_inserted_count + 1;
    EXCEPTION
      WHEN unique_violation THEN
        RAISE EXCEPTION 'duplicate_variant_inventory_identifier' USING ERRCODE = '23505';
    END;
  END LOOP;

  -- Sync stock
  PERFORM private.sync_serialized_stock(p_merchant_id, p_product_id);

  RETURN jsonb_build_object(
    'success', true,
    'productId', p_product_id,
    'variantId', v_target_variant_id,
    'restockedCount', v_inserted_count,
    'unitIds', to_jsonb(v_inserted_ids)
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.restock_variant_inventory_units(
  p_merchant_id uuid,
  p_product_id uuid,
  p_units jsonb,
  p_variant_id uuid DEFAULT NULL,
  p_inventory_tracking_policy text DEFAULT NULL,
  p_branch_id uuid DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
AS $$
BEGIN
  RETURN private.restock_variant_inventory_units(
    p_merchant_id,
    p_product_id,
    p_units,
    p_variant_id,
    p_inventory_tracking_policy,
    p_branch_id
  );
END;
$$;

CREATE OR REPLACE FUNCTION private.list_variant_inventory_units(
  p_merchant_id uuid,
  p_product_id uuid,
  p_variant_id uuid DEFAULT NULL,
  p_status text DEFAULT NULL,
  p_branch_scope text DEFAULT 'all',
  p_branch_id uuid DEFAULT NULL,
  p_limit integer DEFAULT 50,
  p_cursor_created_at timestamp with time zone DEFAULT NULL,
  p_cursor_id uuid DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_limit integer;
  v_rows jsonb := '[]'::jsonb;
  v_row record;
  v_count integer := 0;
  v_has_more boolean := false;
  v_next_cursor jsonb := NULL;
BEGIN
  -- 1. Auth check
  IF auth.role() <> 'service_role'
     AND NOT public.has_merchant_access(p_merchant_id) THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;

  -- 2. Limit and cursor checks
  v_limit := LEAST(GREATEST(COALESCE(p_limit, 50), 1), 200);

  IF (p_cursor_created_at IS NULL AND p_cursor_id IS NOT NULL)
     OR (p_cursor_created_at IS NOT NULL AND p_cursor_id IS NULL) THEN
    RAISE EXCEPTION 'invalid_inventory_cursor' USING ERRCODE = '22023';
  END IF;

  -- 3. Branch scope checks
  IF p_branch_scope NOT IN ('all', 'merchant_global', 'branch') THEN
    RAISE EXCEPTION 'invalid_branch_scope' USING ERRCODE = '22023';
  END IF;

  IF p_branch_scope = 'branch' AND p_branch_id IS NULL THEN
    RAISE EXCEPTION 'branch_id_required' USING ERRCODE = '22023';
  END IF;

  -- 4. Query
  FOR v_row IN
    SELECT
      vi.id,
      pv.product_id,
      vi.variant_id,
      vi.branch_id,
      b.name AS branch_name,
      pv.attributes AS variant_attributes,
      pv.condition AS variant_condition,
      vi.identifier_type,
      vi.identifier_value,
      vi.status,
      vi.source,
      vi.order_id,
      vi.order_item_id,
      vi.created_at,
      vi.updated_at,
      (
        vi.status = 'available'
        AND vi.source = 'merchant_stock'
        AND vi.order_id IS NULL
        AND vi.order_item_id IS NULL
        AND vi.sold_at IS NULL
        AND vi.first_reserved_at IS NULL
        AND vi.reserved_at IS NULL
        AND vi.reservation_expires_at IS NULL
        AND NOT EXISTS (
          SELECT 1
          FROM private.variant_inventory_events vie
          WHERE vie.inventory_unit_id = vi.id
            AND vie.event_type IN ('marked_defective', 'reconditioned_for_resale', 'returned', 'sold', 'hold_confirmed')
        )
      ) AS can_delete
    FROM public.variant_inventory vi
    JOIN public.product_variants pv ON vi.variant_id = pv.id
    JOIN public.products p ON pv.product_id = p.id
    LEFT JOIN public.branches b ON vi.branch_id = b.id
    WHERE vi.merchant_id = p_merchant_id
      AND pv.product_id = p_product_id
      -- Variant ID filter
      AND (p_variant_id IS NULL OR vi.variant_id = p_variant_id)
      -- Status filter
      AND (p_status IS NULL OR vi.status = p_status)
      -- Branch scope filter
      AND (
        p_branch_scope = 'all'
        OR (p_branch_scope = 'merchant_global' AND vi.branch_id IS NULL)
        OR (p_branch_scope = 'branch' AND vi.branch_id = p_branch_id)
      )
      -- Anchor rule: include anchor rows only for simple products and sold historical anchor rows
      AND (pv.is_inventory_anchor = false OR p.has_variants IS DISTINCT FROM true OR vi.status = 'sold')
      -- Pagination cursor
      AND (
        p_cursor_created_at IS NULL
        OR (vi.created_at, vi.id) < (p_cursor_created_at, p_cursor_id)
      )
    ORDER BY vi.created_at DESC, vi.id DESC
    LIMIT v_limit + 1
  LOOP
    IF v_count < v_limit THEN
      v_rows := v_rows || jsonb_build_object(
        'id', v_row.id,
        'product_id', v_row.product_id,
        'variant_id', v_row.variant_id,
        'branch_id', v_row.branch_id,
        'branch_name', v_row.branch_name,
        'variant_attributes', v_row.variant_attributes,
        'variant_condition', v_row.variant_condition,
        'identifier_type', v_row.identifier_type,
        'identifier_value', v_row.identifier_value,
        'status', v_row.status,
        'source', v_row.source,
        'order_id', v_row.order_id,
        'order_item_id', v_row.order_item_id,
        'created_at', v_row.created_at,
        'updated_at', v_row.updated_at,
        'can_delete', v_row.can_delete
      );
      v_count := v_count + 1;
    ELSE
      v_has_more := true;
      v_next_cursor := jsonb_build_object(
        'createdAt', v_row.created_at,
        'id', v_row.id
      );
    END IF;
  END LOOP;

  RETURN jsonb_build_object(
    'rows', v_rows,
    'nextCursor', v_next_cursor,
    'hasMore', v_has_more
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.list_variant_inventory_units(
  p_merchant_id uuid,
  p_product_id uuid,
  p_variant_id uuid DEFAULT NULL,
  p_status text DEFAULT NULL,
  p_branch_scope text DEFAULT 'all',
  p_branch_id uuid DEFAULT NULL,
  p_limit integer DEFAULT 50,
  p_cursor_created_at timestamp with time zone DEFAULT NULL,
  p_cursor_id uuid DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
AS $$
BEGIN
  RETURN private.list_variant_inventory_units(
    p_merchant_id,
    p_product_id,
    p_variant_id,
    p_status,
    p_branch_scope,
    p_branch_id,
    p_limit,
    p_cursor_created_at,
    p_cursor_id
  );
END;
$$;

CREATE OR REPLACE FUNCTION private.update_inventory_tracking_policy(
  p_merchant_id uuid,
  p_product_id uuid,
  p_inventory_tracking_policy text,
  p_variant_id uuid DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_prev_policy text;
  v_has_variants boolean;
  v_variant_model text;
  v_anchor_id uuid;
  v_effective_policy text;
  v_available_count integer;
BEGIN
  -- 1. Auth check
  IF auth.role() <> 'service_role'
     AND NOT public.has_merchant_access(p_merchant_id) THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;

  -- 2. Lock product row and verify ownership
  SELECT has_variants, variant_model, inventory_tracking_policy, inventory_anchor_variant_id
  INTO v_has_variants, v_variant_model, v_prev_policy, v_anchor_id
  FROM public.products
  WHERE id = p_product_id AND merchant_id = p_merchant_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'product_not_found' USING ERRCODE = 'P0002';
  END IF;

  -- 3. Policy validation and update
  IF p_variant_id IS NULL THEN
    IF p_inventory_tracking_policy NOT IN ('off', 'serialized_strict', 'serialized_then_unlimited') THEN
      RAISE EXCEPTION 'invalid_inventory_tracking_policy' USING ERRCODE = '22023';
    END IF;

    UPDATE public.products
    SET inventory_tracking_policy = p_inventory_tracking_policy
    WHERE id = p_product_id;

    v_effective_policy := p_inventory_tracking_policy;
  ELSE
    -- Variant level update
    IF p_inventory_tracking_policy NOT IN ('inherit', 'off', 'serialized_strict', 'serialized_then_unlimited') THEN
      RAISE EXCEPTION 'invalid_inventory_tracking_policy' USING ERRCODE = '22023';
    END IF;

    SELECT inventory_tracking_policy INTO v_prev_policy
    FROM public.product_variants
    WHERE id = p_variant_id
      AND product_id = p_product_id
      AND merchant_id = p_merchant_id
      AND is_inventory_anchor = false
    FOR UPDATE;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'variant_not_found' USING ERRCODE = 'P0002';
    END IF;

    UPDATE public.product_variants
    SET inventory_tracking_policy = p_inventory_tracking_policy
    WHERE id = p_variant_id;

    IF p_inventory_tracking_policy = 'inherit' THEN
      SELECT inventory_tracking_policy INTO v_effective_policy
      FROM public.products
      WHERE id = p_product_id;
    ELSE
      v_effective_policy := p_inventory_tracking_policy;
    END IF;
  END IF;

  -- Sync stock
  PERFORM private.sync_serialized_stock(p_merchant_id, p_product_id);

  -- Compute available count
  IF (v_has_variants IS DISTINCT FROM TRUE AND COALESCE(v_variant_model, 'legacy') <> 'sku_matrix') THEN
    -- Simple product: count anchor variant units
    SELECT count(*)::integer INTO v_available_count
    FROM public.variant_inventory
    WHERE variant_id = v_anchor_id AND status = 'available';
  ELSE
    -- Variant product
    IF p_variant_id IS NOT NULL THEN
      SELECT count(*)::integer INTO v_available_count
      FROM public.variant_inventory
      WHERE variant_id = p_variant_id AND status = 'available';
    ELSE
      SELECT count(*)::integer INTO v_available_count
      FROM public.variant_inventory vi
      JOIN public.product_variants pv ON vi.variant_id = pv.id
      WHERE pv.product_id = p_product_id
        AND pv.is_inventory_anchor = false
        AND vi.status = 'available';
    END IF;
  END IF;

  RETURN jsonb_build_object(
    'productId', p_product_id,
    'variantId', p_variant_id,
    'previousPolicy', v_prev_policy,
    'newPolicy', p_inventory_tracking_policy,
    'effectivePolicy', v_effective_policy,
    'availableSerializedCount', v_available_count
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.update_inventory_tracking_policy(
  p_merchant_id uuid,
  p_product_id uuid,
  p_inventory_tracking_policy text,
  p_variant_id uuid DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
AS $$
BEGIN
  RETURN private.update_inventory_tracking_policy(
    p_merchant_id,
    p_product_id,
    p_inventory_tracking_policy,
    p_variant_id
  );
END;
$$;

CREATE OR REPLACE FUNCTION private.sanitize_error_context(p_context jsonb)
RETURNS jsonb
LANGUAGE plpgsql
AS $$
DECLARE
  v_key text;
  v_value jsonb;
  v_idx integer;
  v_result jsonb := '{}'::jsonb;
BEGIN
  IF p_context IS NULL THEN
    RETURN NULL;
  END IF;

  IF jsonb_typeof(p_context) = 'object' THEN
    FOR v_key, v_value IN SELECT * FROM jsonb_each(p_context) LOOP
      IF lower(v_key) IN ('imei', 'serial', 'serialnumber', 'identifiervalue', 'identifier_value') THEN
        v_result := jsonb_set(v_result, array[v_key], '"[REDACTED]"'::jsonb);
      ELSE
        v_result := jsonb_set(v_result, array[v_key], private.sanitize_error_context(v_value));
      END IF;
    END LOOP;
    RETURN v_result;
  ELSIF jsonb_typeof(p_context) = 'array' THEN
    v_result := '[]'::jsonb;
    IF jsonb_array_length(p_context) > 0 THEN
      FOR v_idx IN 0 .. jsonb_array_length(p_context) - 1 LOOP
        v_result := jsonb_insert(v_result, array[v_idx]::text[], private.sanitize_error_context(p_context->v_idx));
      END LOOP;
    END IF;
    RETURN v_result;
  ELSE
    RETURN p_context;
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION private.update_variant_inventory_unit(
  p_merchant_id uuid,
  p_unit_id uuid,
  p_identifier_value text DEFAULT NULL,
  p_status text DEFAULT NULL,
  p_branch_id uuid DEFAULT NULL,
  p_set_branch boolean DEFAULT false,
  p_notes text DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_unit record;
  v_product_id uuid;
  v_variant_id uuid;
  v_current_status text;
  v_current_order_id uuid;
  v_current_order_item_id uuid;
  v_current_sold_at timestamp with time zone;
  v_current_branch_id uuid;
  v_first_reserved_at timestamp with time zone;
  v_val text;
  v_type text;
  v_branch_valid boolean;
  v_updated record;
BEGIN
  -- 1. Auth check
  IF auth.role() <> 'service_role'
     AND NOT public.has_merchant_access(p_merchant_id) THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;

  -- 2. Lock and fetch unit
  SELECT vi.*, pv.product_id
  INTO v_unit
  FROM public.variant_inventory vi
  JOIN public.product_variants pv ON vi.variant_id = pv.id
  WHERE vi.id = p_unit_id AND vi.merchant_id = p_merchant_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'unit_not_found' USING ERRCODE = 'P0002';
  END IF;

  v_product_id := v_unit.product_id;
  v_variant_id := v_unit.variant_id;
  v_current_status := v_unit.status;
  v_current_order_id := v_unit.order_id;
  v_current_order_item_id := v_unit.order_item_id;
  v_current_sold_at := v_unit.sold_at;
  v_current_branch_id := v_unit.branch_id;
  v_first_reserved_at := v_unit.first_reserved_at;

  -- 3. Committed unit guards
  IF v_current_status IN ('reserved', 'sold') THEN
    IF p_identifier_value IS NOT NULL OR p_status IS NOT NULL OR p_set_branch IS TRUE THEN
      RAISE EXCEPTION 'cannot_mutate_committed_serialized_unit' USING ERRCODE = '22023';
    END IF;
  END IF;

  -- 4. Identifier update
  IF p_identifier_value IS NOT NULL THEN
    v_val := btrim(p_identifier_value);
    IF v_val = '' THEN
      RAISE EXCEPTION 'invalid_inventory_identifier' USING ERRCODE = '22023';
    END IF;

    -- Infer type
    IF v_val ~ '^[0-9]{15}$' THEN
      v_type := 'imei';
    ELSE
      v_type := 'serial';
    END IF;

    BEGIN
      UPDATE public.variant_inventory
      SET identifier_value = v_val,
          identifier_type = v_type,
          updated_at = now()
      WHERE id = p_unit_id;

      -- Event
      PERFORM private.record_variant_inventory_event(
        p_unit_id, p_merchant_id, v_product_id, v_variant_id, 'identifier_updated',
        NULL, NULL, NULL, NULL, v_current_branch_id, NULL, NULL,
        jsonb_build_object('identifierChanged', true, 'rawIdentifierValuesStored', false)
      );
    EXCEPTION
      WHEN unique_violation THEN
        RAISE EXCEPTION 'duplicate_variant_inventory_identifier' USING ERRCODE = '23505';
    END;
  END IF;

  -- 5. Status update
  IF p_status IS NOT NULL THEN
    IF p_status NOT IN ('available', 'defective', 'returned') THEN
      RAISE EXCEPTION 'invalid_status' USING ERRCODE = '22023';
    END IF;

    IF p_status = 'available' AND (v_current_status = 'returned' OR (v_current_status = 'defective' AND v_first_reserved_at IS NOT NULL)) THEN
      -- Reconditioning historical unit
      IF v_current_order_id IS NULL AND v_current_order_item_id IS NULL AND v_current_sold_at IS NULL THEN
        RAISE EXCEPTION 'cannot_recondition_historical_unit_without_order_refs' USING ERRCODE = '22023';
      END IF;

      -- Event
      PERFORM private.record_variant_inventory_event(
        p_unit_id, p_merchant_id, v_product_id, v_variant_id, 'reconditioned_for_resale',
        v_current_status, 'available', v_current_order_id, v_current_order_item_id, v_current_branch_id, NULL, NULL,
        jsonb_build_object(
          'priorOrderId', v_current_order_id,
          'priorOrderItemId', v_current_order_item_id,
          'priorSoldAt', v_current_sold_at,
          'priorStatus', v_current_status
        )
      );

      UPDATE public.variant_inventory
      SET status = 'available',
          order_id = NULL,
          order_item_id = NULL,
          reserved_at = NULL,
          reservation_expires_at = NULL,
          sold_at = NULL,
          source = 'merchant_stock',
          updated_at = now()
      WHERE id = p_unit_id;

    ELSIF p_status = 'available' AND v_current_status = 'defective' AND v_first_reserved_at IS NULL THEN
      -- Reconditioning never-linked defective unit
      PERFORM private.record_variant_inventory_event(
        p_unit_id, p_merchant_id, v_product_id, v_variant_id, 'reconditioned_for_resale',
        'defective', 'available', NULL, NULL, v_current_branch_id, NULL, NULL,
        jsonb_build_object('priorStatus', 'defective')
      );

      UPDATE public.variant_inventory
      SET status = 'available',
          order_id = NULL,
          order_item_id = NULL,
          reserved_at = NULL,
          reservation_expires_at = NULL,
          sold_at = NULL,
          source = 'merchant_stock',
          updated_at = now()
      WHERE id = p_unit_id;

    ELSIF p_status = 'defective' AND v_current_status = 'available' THEN
      PERFORM private.record_variant_inventory_event(
        p_unit_id, p_merchant_id, v_product_id, v_variant_id, 'marked_defective',
        'available', 'defective', NULL, NULL, v_current_branch_id, NULL, NULL,
        jsonb_build_object()
      );

      UPDATE public.variant_inventory
      SET status = 'defective',
          updated_at = now()
      WHERE id = p_unit_id;

    ELSIF (p_status = 'returned' AND v_current_status = 'defective') OR (p_status = 'defective' AND v_current_status = 'returned') THEN
      PERFORM private.record_variant_inventory_event(
        p_unit_id, p_merchant_id, v_product_id, v_variant_id,
        CASE WHEN p_status = 'defective' THEN 'marked_defective'::text ELSE 'returned'::text END,
        v_current_status, p_status, v_current_order_id, v_current_order_item_id, v_current_branch_id, NULL, NULL,
        jsonb_build_object()
      );

      UPDATE public.variant_inventory
      SET status = p_status,
          updated_at = now()
      WHERE id = p_unit_id;

    ELSE
      -- Generic status transitions
      PERFORM private.record_variant_inventory_event(
        p_unit_id, p_merchant_id, v_product_id, v_variant_id,
        CASE
          WHEN p_status = 'defective' THEN 'marked_defective'::text
          WHEN p_status = 'returned' THEN 'returned'::text
          ELSE 'status_updated'::text
        END,
        v_current_status, p_status, v_current_order_id, v_current_order_item_id, v_current_branch_id, NULL, NULL,
        jsonb_build_object()
      );

      UPDATE public.variant_inventory
      SET status = p_status,
          updated_at = now()
      WHERE id = p_unit_id;
    END IF;
  END IF;

  -- 6. Branch update
  IF p_set_branch IS TRUE THEN
    IF p_branch_id IS NOT NULL THEN
      SELECT EXISTS (
        SELECT 1 FROM public.branches
        WHERE id = p_branch_id AND merchant_id = p_merchant_id AND active = true
      ) INTO v_branch_valid;

      IF v_branch_valid IS NOT TRUE THEN
        RAISE EXCEPTION 'invalid_branch' USING ERRCODE = '23503';
      END IF;
    END IF;

    UPDATE public.variant_inventory
    SET branch_id = p_branch_id,
        updated_at = now()
    WHERE id = p_unit_id;

    PERFORM private.record_variant_inventory_event(
      p_unit_id, p_merchant_id, v_product_id, v_variant_id, 'branch_transferred',
      NULL, NULL, NULL, NULL, p_branch_id, NULL, NULL,
      jsonb_build_object('priorBranchId', v_current_branch_id, 'newBranchId', p_branch_id)
    );
  END IF;

  -- 7. Notes update
  IF p_notes IS NOT NULL THEN
    UPDATE public.variant_inventory
    SET notes = p_notes,
        updated_at = now()
    WHERE id = p_unit_id;
  END IF;

  -- Sync stock
  PERFORM private.sync_serialized_stock(p_merchant_id, v_product_id);

  -- Retrieve updated unit
  SELECT vi.*, b.name AS branch_name
  INTO v_updated
  FROM public.variant_inventory vi
  LEFT JOIN public.branches b ON vi.branch_id = b.id
  WHERE vi.id = p_unit_id;

  RETURN jsonb_build_object(
    'id', v_updated.id,
    'merchant_id', v_updated.merchant_id,
    'variant_id', v_updated.variant_id,
    'branch_id', v_updated.branch_id,
    'branch_name', v_updated.branch_name,
    'identifier_type', v_updated.identifier_type,
    'identifier_value', v_updated.identifier_value,
    'status', v_updated.status,
    'source', v_updated.source,
    'notes', v_updated.notes,
    'created_at', v_updated.created_at,
    'updated_at', v_updated.updated_at
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.update_variant_inventory_unit(
  p_merchant_id uuid,
  p_unit_id uuid,
  p_identifier_value text DEFAULT NULL,
  p_status text DEFAULT NULL,
  p_branch_id uuid DEFAULT NULL,
  p_set_branch boolean DEFAULT false,
  p_notes text DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
AS $$
BEGIN
  RETURN private.update_variant_inventory_unit(
    p_merchant_id,
    p_unit_id,
    p_identifier_value,
    p_status,
    p_branch_id,
    p_set_branch,
    p_notes
  );
END;
$$;

CREATE OR REPLACE FUNCTION private.delete_variant_inventory_unit(
  p_merchant_id uuid,
  p_unit_id uuid
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_unit record;
  v_product_id uuid;
  v_variant_id uuid;
  v_branch_id uuid;
  v_status text;
  v_events_exist boolean;
BEGIN
  -- 1. Auth check
  IF auth.role() <> 'service_role'
     AND NOT public.has_merchant_access(p_merchant_id) THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;

  -- 2. Lock unit and verify ownership
  SELECT vi.*, pv.product_id
  INTO v_unit
  FROM public.variant_inventory vi
  JOIN public.product_variants pv ON vi.variant_id = pv.id
  WHERE vi.id = p_unit_id AND vi.merchant_id = p_merchant_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'unit_not_found' USING ERRCODE = 'P0002';
  END IF;

  v_product_id := v_unit.product_id;
  v_variant_id := v_unit.variant_id;
  v_branch_id := v_unit.branch_id;
  v_status := v_unit.status;

  -- 3. Check if unit is pure accidental never-linked restock row
  SELECT EXISTS (
    SELECT 1 FROM private.variant_inventory_events
    WHERE inventory_unit_id = p_unit_id
      AND event_type IN ('marked_defective', 'reconditioned_for_resale', 'returned', 'sold', 'hold_confirmed')
  ) INTO v_events_exist;

  IF v_status <> 'available'
     OR v_unit.source <> 'merchant_stock'
     OR v_unit.order_id IS NOT NULL
     OR v_unit.order_item_id IS NOT NULL
     OR v_unit.sold_at IS NOT NULL
     OR v_unit.reserved_at IS NOT NULL
     OR v_unit.first_reserved_at IS NOT NULL
     OR v_unit.reservation_expires_at IS NOT NULL
     OR v_events_exist IS TRUE THEN
    RAISE EXCEPTION 'cannot_delete_historical_serialized_unit' USING ERRCODE = '22023';
  END IF;

  -- 4. Record deleted_accidental event
  PERFORM private.record_variant_inventory_event(
    p_unit_id, p_merchant_id, v_product_id, v_variant_id, 'deleted_accidental',
    v_status, NULL, NULL, NULL, v_branch_id, NULL, NULL,
    jsonb_build_object('deleteReason', 'merchant_accidental_restock_correction')
  );

  -- 5. Delete row
  DELETE FROM public.variant_inventory WHERE id = p_unit_id;

  -- 6. Sync stock
  PERFORM private.sync_serialized_stock(p_merchant_id, v_product_id);

  RETURN jsonb_build_object(
    'deleted', true,
    'productId', v_product_id,
    'variantId', v_variant_id,
    'branchId', v_branch_id,
    'stockSynced', true
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.delete_variant_inventory_unit(
  p_merchant_id uuid,
  p_unit_id uuid
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
AS $$
BEGIN
  RETURN private.delete_variant_inventory_unit(
    p_merchant_id,
    p_unit_id
  );
END;
$$;

-- Task 3: Order Claiming, Release, and Shipment Lifecycle

CREATE OR REPLACE FUNCTION private.claim_variant_inventory_units_for_order_item_internal(
  p_merchant_id uuid,
  p_order_id uuid,
  p_order_item_id uuid
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_product_id uuid;
  v_variant_id uuid;
  v_qty integer;
  v_order_branch_id uuid;
  v_payment_status text;
  v_payment_method text;
  v_has_variants boolean;
  v_variant_model text;
  v_prod_policy text;
  v_anchor_id uuid;
  v_var_policy text;
  v_effective_policy text;
  v_reserved_count integer;
  v_excess integer;
  v_needed integer;
  v_claimed_count integer := 0;
  v_unit record;
  v_unit_branch_id uuid;
  v_is_confirmed_hold boolean := false;
  v_max_expires timestamp with time zone;
  v_units_json jsonb;
  v_fulfillment_data jsonb;
  v_total_items integer;
  v_total_qty integer;
  v_unit_id uuid;
  v_missing_count integer := 0;
BEGIN
  -- 1. Lock parent order (crucial for same-item concurrency locks)
  PERFORM 1 FROM public.orders WHERE id = p_order_id AND merchant_id = p_merchant_id FOR UPDATE;

  -- 2. Lock target order item and verify ownership
  SELECT oi.product_id, oi.variant_id, oi.quantity, o.branch_id, o.payment_status, o.payment_method
  INTO v_product_id, v_variant_id, v_qty, v_order_branch_id, v_payment_status, v_payment_method
  FROM public.order_items oi
  JOIN public.orders o ON oi.order_id = o.id
  WHERE oi.id = p_order_item_id AND o.id = p_order_id AND o.merchant_id = p_merchant_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'order_item_not_found' USING ERRCODE = 'P0002';
  END IF;

  -- 3. Get product policy and anchor info
  SELECT has_variants, variant_model, inventory_tracking_policy, inventory_anchor_variant_id
  INTO v_has_variants, v_variant_model, v_prod_policy, v_anchor_id
  FROM public.products
  WHERE id = v_product_id AND merchant_id = p_merchant_id;

  -- Simple vs variant product routing
  IF (v_has_variants IS DISTINCT FROM TRUE AND COALESCE(v_variant_model, 'legacy') <> 'sku_matrix') THEN
    -- Simple product uses hidden anchor variant
    PERFORM private.ensure_product_inventory_anchor_variant(p_merchant_id, v_product_id);
    SELECT inventory_anchor_variant_id INTO v_variant_id
    FROM public.products
    WHERE id = v_product_id;
  ELSE
    -- Variant product: check that the linked variant is not a hidden anchor
    IF EXISTS (
      SELECT 1 FROM public.product_variants
      WHERE id = v_variant_id AND is_inventory_anchor = true
    ) THEN
      RAISE EXCEPTION 'anchor_not_claimable_for_variant_product' USING ERRCODE = '22023';
    END IF;
  END IF;

  -- 4. Get effective tracking policy
  SELECT inventory_tracking_policy INTO v_var_policy
  FROM public.product_variants
  WHERE id = v_variant_id AND merchant_id = p_merchant_id;

  v_effective_policy := COALESCE(NULLIF(v_var_policy, 'inherit'), v_prod_policy, 'off');

  IF v_effective_policy = 'off' THEN
    RETURN jsonb_build_object('policy', 'off');
  END IF;

  -- 5. Determine if this is a confirmed hold
  IF v_payment_status IN ('paid', 'bnpl_approved')
     OR (lower(trim(v_payment_method)) IN ('pod', 'pay_on_delivery') AND v_payment_status = 'pending') THEN
    v_is_confirmed_hold := true;
  END IF;

  -- 6. Reconcile currently claimed count against order item quantity
  SELECT count(*)::integer INTO v_reserved_count
  FROM public.variant_inventory
  WHERE order_item_id = p_order_item_id;

  IF v_reserved_count = v_qty THEN
    -- Quantity matches, but let's make sure the expirations are updated if status changed
    IF v_is_confirmed_hold THEN
      UPDATE public.variant_inventory
      SET reservation_expires_at = NULL,
          updated_at = now()
      WHERE order_item_id = p_order_item_id;
    END IF;
  ELSIF v_reserved_count > v_qty THEN
    -- Excess reservations exist: release the latest ones first
    v_excess := v_reserved_count - v_qty;
    FOR v_unit_id IN
      SELECT id FROM public.variant_inventory
      WHERE order_item_id = p_order_item_id AND status = 'reserved'
      ORDER BY reserved_at DESC, id DESC
      LIMIT v_excess
    LOOP
      PERFORM private.record_variant_inventory_event(
        v_unit_id, p_merchant_id, v_product_id, v_variant_id, 'reservation_released',
        'reserved', 'available', p_order_id, p_order_item_id, NULL, NULL, NULL,
        jsonb_build_object()
      );

      UPDATE public.variant_inventory
      SET status = 'available',
          order_id = NULL,
          order_item_id = NULL,
          reserved_at = NULL,
          reservation_expires_at = NULL,
          updated_at = now()
      WHERE id = v_unit_id;
    END LOOP;
  ELSE
    -- Missing reservations exist: claim additional units
    v_needed := v_qty - v_reserved_count;

    FOR v_unit IN
      SELECT vi.id, vi.branch_id
      FROM public.variant_inventory vi
      WHERE vi.merchant_id = p_merchant_id
        AND vi.variant_id = v_variant_id
        AND vi.status = 'available'
        AND vi.order_id IS NULL
        AND vi.order_item_id IS NULL
        AND vi.sold_at IS NULL
        AND (
          (v_order_branch_id IS NULL AND vi.branch_id IS NULL)
          OR (v_order_branch_id IS NOT NULL AND (vi.branch_id = v_order_branch_id OR vi.branch_id IS NULL))
        )
      ORDER BY (CASE WHEN vi.branch_id = v_order_branch_id THEN 0 ELSE 1 END) ASC, vi.created_at ASC, vi.id ASC
      LIMIT v_needed
      FOR UPDATE SKIP LOCKED
    LOOP
      v_unit_branch_id := COALESCE(v_unit.branch_id, v_order_branch_id);

      UPDATE public.variant_inventory
      SET status = 'reserved',
          order_id = p_order_id,
          order_item_id = p_order_item_id,
          branch_id = v_unit_branch_id,
          reserved_at = now(),
          first_reserved_at = COALESCE(first_reserved_at, now()),
          reservation_expires_at = CASE WHEN v_is_confirmed_hold THEN NULL ELSE now() + interval '2 hours' END,
          updated_at = now()
      WHERE id = v_unit.id;

      PERFORM private.record_variant_inventory_event(
        v_unit.id, p_merchant_id, v_product_id, v_variant_id, 'reserved',
        'available', 'reserved', p_order_id, p_order_item_id, v_unit_branch_id, NULL, NULL,
        jsonb_build_object()
      );

      v_claimed_count := v_claimed_count + 1;
    END LOOP;

    -- Strict check
    IF v_effective_policy = 'serialized_strict' AND (v_reserved_count + v_claimed_count) < v_qty THEN
      RAISE EXCEPTION 'serialized_inventory_unavailable' USING ERRCODE = '55000';
    END IF;

    IF v_effective_policy = 'serialized_then_unlimited' AND (v_reserved_count + v_claimed_count) < v_qty THEN
      v_missing_count := v_qty - (v_reserved_count + v_claimed_count);
    END IF;
  END IF;

  -- 7. Build and write item-level fulfillment_data snapshot
  SELECT jsonb_agg(
    jsonb_build_object(
      'inventoryUnitId', vi.id,
      'identifierType', vi.identifier_type,
      'identifierValue', vi.identifier_value
    )
  ) INTO v_units_json
  FROM public.variant_inventory vi
  WHERE vi.order_item_id = p_order_item_id;

  SELECT max(reservation_expires_at) INTO v_max_expires
  FROM public.variant_inventory
  WHERE order_item_id = p_order_item_id;

  -- Recompute missing count strictly from locked unit state
  SELECT count(*)::integer INTO v_reserved_count
  FROM public.variant_inventory
  WHERE order_item_id = p_order_item_id;

  v_fulfillment_data := jsonb_build_object(
    'source', 'merchant_stock',
    'reservationExpiresAt', to_jsonb(v_max_expires),
    'inventoryUnits', COALESCE(v_units_json, '[]'::jsonb),
    'missingUnitCount', GREATEST(v_qty - v_reserved_count, 0)
  );

  UPDATE public.order_items
  SET fulfillment_data = v_fulfillment_data
  WHERE id = p_order_item_id;

  -- Mirror for single-unit orders
  SELECT count(*), sum(quantity) INTO v_total_items, v_total_qty FROM public.order_items WHERE order_id = p_order_id;
  IF v_total_items = 1 AND v_total_qty = 1 THEN
    UPDATE public.orders SET fulfillment_details = v_fulfillment_data WHERE id = p_order_id;
  END IF;

  -- Sync stock
  PERFORM private.sync_serialized_stock(p_merchant_id, v_product_id);

  RETURN v_fulfillment_data;
END;
$$;

CREATE OR REPLACE FUNCTION public.claim_variant_inventory_units_for_order_item(
  p_merchant_id uuid,
  p_order_id uuid,
  p_order_item_id uuid
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
AS $$
BEGIN
  RETURN private.claim_variant_inventory_units_for_order_item_internal(
    p_merchant_id,
    p_order_id,
    p_order_item_id
  );
END;
$$;

CREATE OR REPLACE FUNCTION private.confirm_order_inventory_reservations(
  p_merchant_id uuid,
  p_order_id uuid
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_order record;
  v_is_confirmed_hold boolean := false;
  v_item record;
  v_units_json jsonb;
  v_max_expires timestamp with time zone;
  v_reclaimed_count integer := 0;
  v_confirmed_count integer := 0;
  v_already_confirmed_count integer := 0;
  v_total_missing_count integer := 0;
  v_exceptions jsonb := '[]'::jsonb;
  v_total_items integer;
  v_total_qty integer;
  v_has_variants boolean;
  v_variant_model text;
  v_prod_policy text;
  v_anchor_id uuid;
  v_var_policy text;
  v_effective_policy text;
  v_reserved_count integer;
  v_needed integer;
  v_claimed_in_loop integer;
  v_unit record;
  v_unit_branch_id uuid;
  v_fulfillment_data jsonb;
  v_actual_variant_id uuid;
BEGIN
  -- 1. Lock order
  SELECT * INTO v_order
  FROM public.orders
  WHERE id = p_order_id AND merchant_id = p_merchant_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'order_not_found' USING ERRCODE = 'P0002';
  END IF;

  -- 2. Confirm hold validation
  IF v_order.payment_status IN ('paid', 'bnpl_approved')
     OR (lower(trim(v_order.payment_method)) IN ('pod', 'pay_on_delivery') AND v_order.payment_status = 'pending') THEN
    v_is_confirmed_hold := true;
  END IF;

  IF NOT v_is_confirmed_hold THEN
    RAISE EXCEPTION 'order_not_confirmed_for_inventory_hold' USING ERRCODE = '22023';
  END IF;

  -- 3. Reconcile each order item
  FOR v_item IN
    SELECT oi.*
    FROM public.order_items oi
    WHERE oi.order_id = p_order_id
    FOR UPDATE
  LOOP
    -- Get product policy and anchor info
    SELECT has_variants, variant_model, inventory_tracking_policy, inventory_anchor_variant_id
    INTO v_has_variants, v_variant_model, v_prod_policy, v_anchor_id
    FROM public.products
    WHERE id = v_item.product_id AND merchant_id = p_merchant_id;

    -- Skip if product policy is off and variant is not serialized
    v_actual_variant_id := v_item.variant_id;
    IF (v_has_variants IS DISTINCT FROM TRUE AND COALESCE(v_variant_model, 'legacy') <> 'sku_matrix') THEN
      PERFORM private.ensure_product_inventory_anchor_variant(p_merchant_id, v_item.product_id);
      SELECT inventory_anchor_variant_id INTO v_actual_variant_id
      FROM public.products
      WHERE id = v_item.product_id;
    END IF;

    SELECT inventory_tracking_policy INTO v_var_policy
    FROM public.product_variants
    WHERE id = v_actual_variant_id AND merchant_id = p_merchant_id;

    v_effective_policy := COALESCE(NULLIF(v_var_policy, 'inherit'), v_prod_policy, 'off');

    IF v_effective_policy = 'off' THEN
      CONTINUE;
    END IF;

    -- Count existing linked units
    SELECT count(*)::integer INTO v_reserved_count
    FROM public.variant_inventory
    WHERE order_item_id = v_item.id;

    -- 4. Reconcile
    -- Identify units already confirmed (durable holds have reservation_expires_at IS NULL)
    SELECT count(*)::integer INTO v_already_confirmed_count
    FROM public.variant_inventory
    WHERE order_item_id = v_item.id AND reservation_expires_at IS NULL;

    IF v_reserved_count = v_item.quantity THEN
      -- All units are already reserved. Clear their expiration
      UPDATE public.variant_inventory
      SET reservation_expires_at = NULL,
          updated_at = now()
      WHERE order_item_id = v_item.id AND reservation_expires_at IS NOT NULL;

      -- Events for confirmed holds
      FOR v_unit IN
        SELECT id FROM public.variant_inventory
        WHERE order_item_id = v_item.id AND status = 'reserved'
      LOOP
        PERFORM private.record_variant_inventory_event(
          v_unit.id, p_merchant_id, v_item.product_id, v_actual_variant_id, 'hold_confirmed',
          'reserved', 'reserved', p_order_id, v_item.id, v_order.branch_id, NULL, NULL,
          jsonb_build_object()
        );
        v_confirmed_count := v_confirmed_count + 1;
      END LOOP;

    ELSE
      -- Some/all units were released or we need to reclaim.
      -- First confirm any currently linked ones
      UPDATE public.variant_inventory
      SET reservation_expires_at = NULL,
          updated_at = now()
      WHERE order_item_id = v_item.id;

      -- Re-claim missing
      v_needed := v_item.quantity - v_reserved_count;
      v_claimed_in_loop := 0;

      FOR v_unit IN
        SELECT vi.id, vi.branch_id
        FROM public.variant_inventory vi
        WHERE vi.merchant_id = p_merchant_id
          AND vi.variant_id = v_actual_variant_id
          AND vi.status = 'available'
          AND vi.order_id IS NULL
          AND vi.order_item_id IS NULL
          AND vi.sold_at IS NULL
          AND (
            (v_order.branch_id IS NULL AND vi.branch_id IS NULL)
            OR (v_order.branch_id IS NOT NULL AND (vi.branch_id = v_order.branch_id OR vi.branch_id IS NULL))
          )
        ORDER BY (CASE WHEN vi.branch_id = v_order.branch_id THEN 0 ELSE 1 END) ASC, vi.created_at ASC, vi.id ASC
        LIMIT v_needed
        FOR UPDATE SKIP LOCKED
      LOOP
        v_unit_branch_id := COALESCE(v_unit.branch_id, v_order.branch_id);

        UPDATE public.variant_inventory
        SET status = 'reserved',
            order_id = p_order_id,
            order_item_id = v_item.id,
            branch_id = v_unit_branch_id,
            reserved_at = now(),
            first_reserved_at = COALESCE(first_reserved_at, now()),
            reservation_expires_at = NULL,
            updated_at = now()
        WHERE id = v_unit.id;

        PERFORM private.record_variant_inventory_event(
          v_unit.id, p_merchant_id, v_item.product_id, v_actual_variant_id, 'hold_confirmed',
          'available', 'reserved', p_order_id, v_item.id, v_unit_branch_id, NULL, NULL,
          jsonb_build_object('action', 'reclaimed_on_payment')
        );

        v_reclaimed_count := v_reclaimed_count + 1;
      END LOOP;

      -- Check if we are still short
      IF (v_reserved_count + v_reclaimed_count) < v_item.quantity THEN
        v_total_missing_count := v_total_missing_count + (v_item.quantity - (v_reserved_count + v_reclaimed_count));

        IF v_effective_policy = 'serialized_strict' THEN
          v_exceptions := v_exceptions || jsonb_build_object(
            'itemId', v_item.id,
            'code', 'late_payment_reservation_lost'
          );
        END IF;
      END IF;
    END IF;

    -- Re-fetch linked units for snapshot
    SELECT jsonb_agg(
      jsonb_build_object(
        'inventoryUnitId', vi.id,
        'identifierType', vi.identifier_type,
        'identifierValue', vi.identifier_value
      )
    ) INTO v_units_json
    FROM public.variant_inventory vi
    WHERE vi.order_item_id = v_item.id;

    -- Recompute missing count strictly from locked unit state
    SELECT count(*)::integer INTO v_reserved_count
    FROM public.variant_inventory
    WHERE order_item_id = v_item.id;

    v_fulfillment_data := jsonb_build_object(
      'source', 'merchant_stock',
      'reservationExpiresAt', null,
      'inventoryUnits', COALESCE(v_units_json, '[]'::jsonb),
      'missingUnitCount', GREATEST(v_item.quantity - v_reserved_count, 0)
    );

    -- If strict exception occurred, add to JSON
    IF v_effective_policy = 'serialized_strict' AND v_reserved_count < v_item.quantity THEN
      v_fulfillment_data := jsonb_set(
        v_fulfillment_data,
        '{serializedInventoryException}',
        jsonb_build_object('code', 'late_payment_reservation_lost')
      );
    END IF;

    UPDATE public.order_items
    SET fulfillment_data = v_fulfillment_data
    WHERE id = v_item.id;

    -- Sync stock
    PERFORM private.sync_serialized_stock(p_merchant_id, v_item.product_id);
  END LOOP;

  -- Mirror for single-unit orders
  SELECT count(*), sum(quantity) INTO v_total_items, v_total_qty FROM public.order_items WHERE order_id = p_order_id;
  IF v_total_items = 1 AND v_total_qty = 1 THEN
    SELECT fulfillment_data INTO v_fulfillment_data FROM public.order_items WHERE order_id = p_order_id LIMIT 1;
    UPDATE public.orders SET fulfillment_details = v_fulfillment_data WHERE id = p_order_id;
  END IF;

  RETURN jsonb_build_object(
    'alreadyConfirmed', v_already_confirmed_count,
    'confirmedUnitCount', v_confirmed_count,
    'reclaimedUnitCount', v_reclaimed_count,
    'missingUnitCount', v_total_missing_count,
    'exceptionCodes', v_exceptions
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.confirm_order_inventory_reservations(
  p_merchant_id uuid,
  p_order_id uuid
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
AS $$
BEGIN
  RETURN private.confirm_order_inventory_reservations(
    p_merchant_id,
    p_order_id
  );
END;
$$;

CREATE OR REPLACE FUNCTION private.mark_order_inventory_units_sold(
  p_merchant_id uuid,
  p_order_id uuid
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_unit record;
  v_count integer := 0;
BEGIN
  -- 1. Auth check
  IF auth.role() <> 'service_role'
     AND NOT public.has_merchant_access(p_merchant_id) THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;

  -- 2. Select and lock reserved units for order
  FOR v_unit IN
    SELECT vi.*, pv.product_id
    FROM public.variant_inventory vi
    JOIN public.product_variants pv ON vi.variant_id = pv.id
    WHERE vi.order_id = p_order_id AND vi.merchant_id = p_merchant_id AND vi.status = 'reserved'
    FOR UPDATE
  LOOP
    UPDATE public.variant_inventory
    SET status = 'sold',
        sold_at = now(),
        updated_at = now()
    WHERE id = v_unit.id;

    PERFORM private.record_variant_inventory_event(
      v_unit.id, p_merchant_id, v_unit.product_id, v_unit.variant_id, 'sold',
      'reserved', 'sold', p_order_id, v_unit.order_item_id, v_unit.branch_id, NULL, NULL,
      jsonb_build_object()
    );

    v_count := v_count + 1;
  END LOOP;

  RETURN jsonb_build_object(
    'success', true,
    'orderId', p_order_id,
    'unitsMarkedSold', v_count
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.mark_order_inventory_units_sold(
  p_merchant_id uuid,
  p_order_id uuid
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
AS $$
BEGIN
  RETURN private.mark_order_inventory_units_sold(
    p_merchant_id,
    p_order_id
  );
END;
$$;

CREATE OR REPLACE FUNCTION private.record_external_order_inventory_units(
  p_merchant_id uuid,
  p_order_id uuid,
  p_order_item_id uuid,
  p_units jsonb,
  p_source text DEFAULT 'vendor_sourced'
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_order record;
  v_item record;
  v_missing_count integer;
  v_input_length integer;
  v_source text := COALESCE(p_source, 'vendor_sourced');
  v_idx integer;
  v_unit jsonb;
  v_val text;
  v_type text;
  v_inserted_id uuid;
  v_inserted_ids uuid[] := array[]::uuid[];
  v_units_json jsonb;
  v_fulfillment_data jsonb;
  v_total_items integer;
  v_total_qty integer;
BEGIN
  -- 1. Auth check
  IF auth.role() <> 'service_role'
     AND NOT public.has_merchant_access(p_merchant_id) THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;

  -- Validate source
  IF v_source NOT IN ('vendor_sourced', 'dropship') THEN
    RAISE EXCEPTION 'invalid_inventory_source' USING ERRCODE = '22023';
  END IF;

  -- 2. Lock order
  SELECT * INTO v_order
  FROM public.orders
  WHERE id = p_order_id AND merchant_id = p_merchant_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'order_not_found' USING ERRCODE = 'P0002';
  END IF;

  -- 3. Lock item
  SELECT * INTO v_item
  FROM public.order_items
  WHERE id = p_order_item_id AND order_id = p_order_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'order_item_not_found' USING ERRCODE = 'P0002';
  END IF;

  -- Get current missing unit count from snapshot
  v_missing_count := COALESCE((v_item.fulfillment_data->>'missingUnitCount')::integer, 0);

  IF v_missing_count <= 0 THEN
    RAISE EXCEPTION 'no_missing_units_to_record' USING ERRCODE = '22023';
  END IF;

  -- Validate input length
  IF p_units IS NULL OR jsonb_typeof(p_units) <> 'array' THEN
    RAISE EXCEPTION 'invalid_units_payload' USING ERRCODE = '22023';
  END IF;

  v_input_length := jsonb_array_length(p_units);
  IF v_input_length <> v_missing_count THEN
    RAISE EXCEPTION 'submitted_unit_count_mismatch' USING ERRCODE = '22023';
  END IF;

  -- 4. Process and insert units
  FOR v_idx IN 0 .. v_input_length - 1 LOOP
    v_unit := p_units->v_idx;

    -- Extract and clean identifier
    IF v_unit ? 'imei' AND v_unit->>'imei' IS NOT NULL AND btrim(v_unit->>'imei') <> '' THEN
      v_val := btrim(v_unit->>'imei');
      v_type := 'imei';
    ELSIF v_unit ? 'serial' AND v_unit->>'serial' IS NOT NULL AND btrim(v_unit->>'serial') <> '' THEN
      v_val := btrim(v_unit->>'serial');
      v_type := 'serial';
    ELSE
      v_val := btrim(COALESCE(v_unit->>'identifier_value', ''));
      v_type := COALESCE(v_unit->>'identifier_type', CASE WHEN v_val ~ '^[0-9]{15}$' THEN 'imei' ELSE 'serial' END);
    END IF;

    IF v_val = '' THEN
      RAISE EXCEPTION 'invalid_inventory_identifier' USING ERRCODE = '22023';
    END IF;

    IF v_type = 'imei' AND v_val !~ '^[0-9]{15}$' THEN
      RAISE EXCEPTION 'invalid_imei_shape' USING ERRCODE = '22023';
    END IF;

    -- Insert unit directly as sold
    v_inserted_id := gen_random_uuid();
    BEGIN
      INSERT INTO public.variant_inventory (
        id, merchant_id, variant_id, branch_id, identifier_type, identifier_value, status, source, order_id, order_item_id, sold_at
      ) VALUES (
        v_inserted_id, p_merchant_id, v_item.variant_id, v_order.branch_id, v_type, v_val, 'sold', v_source, p_order_id, p_order_item_id, now()
      );

      -- Record sold event
      PERFORM private.record_variant_inventory_event(
        v_inserted_id, p_merchant_id, v_item.product_id, v_item.variant_id, 'sold',
        'available', 'sold', p_order_id, p_order_item_id, v_order.branch_id, NULL, NULL,
        jsonb_build_object('source', v_source, 'externalRecording', true)
      );

      v_inserted_ids := array_append(v_inserted_ids, v_inserted_id);
    EXCEPTION
      WHEN unique_violation THEN
        RAISE EXCEPTION 'duplicate_variant_inventory_identifier' USING ERRCODE = '23505';
    END;
  END LOOP;

  -- 5. Re-aggregate linked units and update item snapshot
  SELECT jsonb_agg(
    jsonb_build_object(
      'inventoryUnitId', vi.id,
      'identifierType', vi.identifier_type,
      'identifierValue', vi.identifier_value
    )
  ) INTO v_units_json
  FROM public.variant_inventory vi
  WHERE vi.order_item_id = p_order_item_id;

  v_fulfillment_data := jsonb_build_object(
    'source', 'merchant_stock',
    'reservationExpiresAt', null,
    'inventoryUnits', COALESCE(v_units_json, '[]'::jsonb),
    'missingUnitCount', 0
  );

  UPDATE public.order_items
  SET fulfillment_data = v_fulfillment_data
  WHERE id = p_order_item_id;

  -- Mirror for single-unit orders
  SELECT count(*), sum(quantity) INTO v_total_items, v_total_qty FROM public.order_items WHERE order_id = p_order_id;
  IF v_total_items = 1 AND v_total_qty = 1 THEN
    UPDATE public.orders SET fulfillment_details = v_fulfillment_data WHERE id = p_order_id;
  END IF;

  -- Sync stock
  PERFORM private.sync_serialized_stock(p_merchant_id, v_item.product_id);

  RETURN v_fulfillment_data;
END;
$$;

CREATE OR REPLACE FUNCTION public.record_external_order_inventory_units(
  p_merchant_id uuid,
  p_order_id uuid,
  p_order_item_id uuid,
  p_units jsonb,
  p_source text DEFAULT 'vendor_sourced'
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
AS $$
BEGIN
  RETURN private.record_external_order_inventory_units(
    p_merchant_id,
    p_order_id,
    p_order_item_id,
    p_units,
    p_source
  );
END;
$$;

CREATE OR REPLACE FUNCTION private.release_order_inventory_units(
  p_merchant_id uuid,
  p_order_id uuid,
  p_target_status text DEFAULT 'available'
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_target_status text := COALESCE(p_target_status, 'available');
  v_unit record;
  v_count integer := 0;
  v_item record;
  v_units_json jsonb;
  v_fulfillment_data jsonb;
  v_reserved_count integer;
  v_total_items integer;
  v_total_qty integer;
BEGIN
  -- 1. Auth check
  IF auth.role() <> 'service_role'
     AND NOT public.has_merchant_access(p_merchant_id) THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;

  IF v_target_status NOT IN ('available', 'returned') THEN
    RAISE EXCEPTION 'invalid_target_status' USING ERRCODE = '22023';
  END IF;

  -- 2. Reconcile units
  IF v_target_status = 'available' THEN
    -- Release back to available
    FOR v_unit IN
      SELECT vi.*, pv.product_id
      FROM public.variant_inventory vi
      JOIN public.product_variants pv ON vi.variant_id = pv.id
      WHERE vi.order_id = p_order_id AND vi.merchant_id = p_merchant_id AND vi.status = 'reserved'
      FOR UPDATE
    LOOP
      PERFORM private.record_variant_inventory_event(
        v_unit.id, p_merchant_id, v_unit.product_id, v_unit.variant_id, 'reservation_released',
        'reserved', 'available', p_order_id, v_unit.order_item_id, v_unit.branch_id, NULL, NULL,
        jsonb_build_object()
      );

      UPDATE public.variant_inventory
      SET status = 'available',
          order_id = NULL,
          order_item_id = NULL,
          reserved_at = NULL,
          reservation_expires_at = NULL,
          updated_at = now()
      WHERE id = v_unit.id;

      v_count := v_count + 1;
    END LOOP;
  ELSE
    -- Mark returned
    FOR v_unit IN
      SELECT vi.*, pv.product_id
      FROM public.variant_inventory vi
      JOIN public.product_variants pv ON vi.variant_id = pv.id
      WHERE vi.order_id = p_order_id AND vi.merchant_id = p_merchant_id AND vi.status = 'reserved'
      FOR UPDATE
    LOOP
      PERFORM private.record_variant_inventory_event(
        v_unit.id, p_merchant_id, v_unit.product_id, v_unit.variant_id, 'returned',
        'reserved', 'returned', p_order_id, v_unit.order_item_id, v_unit.branch_id, NULL, NULL,
        jsonb_build_object()
      );

      UPDATE public.variant_inventory
      SET status = 'returned',
          updated_at = now()
      WHERE id = v_unit.id;

      v_count := v_count + 1;
    END LOOP;
  END IF;

  -- 3. Update order item snapshots
  FOR v_item IN
    SELECT oi.*
    FROM public.order_items oi
    WHERE oi.order_id = p_order_id
    FOR UPDATE
  LOOP
    -- Re-aggregate linked units
    SELECT jsonb_agg(
      jsonb_build_object(
        'inventoryUnitId', vi.id,
        'identifierType', vi.identifier_type,
        'identifierValue', vi.identifier_value
      )
    ) INTO v_units_json
    FROM public.variant_inventory vi
    WHERE vi.order_item_id = v_item.id;

    -- Count reserved units remaining
    SELECT count(*)::integer INTO v_reserved_count
    FROM public.variant_inventory
    WHERE order_item_id = v_item.id AND status = 'reserved';

    v_fulfillment_data := jsonb_build_object(
      'source', 'merchant_stock',
      'reservationExpiresAt', null,
      'inventoryUnits', COALESCE(v_units_json, '[]'::jsonb),
      -- Keep missing unit count unchanged for dropship/vendor-sourced items, but make sure it accounts for released units
      'missingUnitCount', COALESCE((v_item.fulfillment_data->>'missingUnitCount')::integer, GREATEST(v_item.quantity - v_reserved_count, 0))
    );

    UPDATE public.order_items
    SET fulfillment_data = v_fulfillment_data
    WHERE id = v_item.id;

    -- Sync stock
    PERFORM private.sync_serialized_stock(p_merchant_id, v_item.product_id);
  END LOOP;

  -- Mirror for single-unit orders
  SELECT count(*), sum(quantity) INTO v_total_items, v_total_qty FROM public.order_items WHERE order_id = p_order_id;
  IF v_total_items = 1 AND v_total_qty = 1 THEN
    SELECT fulfillment_data INTO v_fulfillment_data FROM public.order_items WHERE order_id = p_order_id LIMIT 1;
    UPDATE public.orders SET fulfillment_details = v_fulfillment_data WHERE id = p_order_id;
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'orderId', p_order_id,
    'releasedCount', v_count
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.release_order_inventory_units(
  p_merchant_id uuid,
  p_order_id uuid,
  p_target_status text DEFAULT 'available'
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
AS $$
BEGIN
  RETURN private.release_order_inventory_units(
    p_merchant_id,
    p_order_id,
    p_target_status
  );
END;
$$;

CREATE OR REPLACE FUNCTION private.mark_order_payment_failed_and_release_inventory(
  p_merchant_id uuid,
  p_order_id uuid,
  p_payment_status text,
  p_notes text DEFAULT NULL,
  p_shipping_address jsonb DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_released jsonb;
  v_count integer;
BEGIN
  -- 1. Auth check
  IF auth.role() <> 'service_role'
     AND NOT public.has_merchant_access(p_merchant_id) THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;

  -- Validate target payment status
  IF p_payment_status NOT IN ('failed', 'cancelled', 'abandoned', 'expired') THEN
    RAISE EXCEPTION 'invalid_payment_status' USING ERRCODE = '22023';
  END IF;

  -- 2. Lock and verify order
  PERFORM 1 FROM public.orders
  WHERE id = p_order_id AND merchant_id = p_merchant_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'order_not_found' USING ERRCODE = 'P0002';
  END IF;

  -- 3. Release inventory
  SELECT * INTO v_released FROM private.release_order_inventory_units(p_merchant_id, p_order_id, 'available');
  v_count := (v_released->>'releasedCount')::integer;

  -- 4. Update order status
  UPDATE public.orders
  SET payment_status = p_payment_status,
      notes = COALESCE(p_notes, notes),
      delivery_address = COALESCE(p_shipping_address, delivery_address),
      updated_at = now()
  WHERE id = p_order_id;

  RETURN jsonb_build_object(
    'orderId', p_order_id,
    'paymentStatus', p_payment_status,
    'releasedUnitCount', v_count
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.mark_order_payment_failed_and_release_inventory(
  p_merchant_id uuid,
  p_order_id uuid,
  p_payment_status text,
  p_notes text DEFAULT NULL,
  p_shipping_address jsonb DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
AS $$
BEGIN
  RETURN private.mark_order_payment_failed_and_release_inventory(
    p_merchant_id,
    p_order_id,
    p_payment_status,
    p_notes,
    p_shipping_address
  );
END;
$$;

CREATE OR REPLACE FUNCTION private.validate_order_shipment_inventory(
  p_merchant_id uuid,
  p_order_id uuid,
  p_external_units jsonb DEFAULT '[]'::jsonb
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_order record;
  v_item record;
  v_ext_item jsonb;
  v_ext_unit jsonb;
  v_idx integer;
  v_unit_idx integer;
  v_val text;
  v_type text;
  v_ext_count integer := 0;
  v_res_count integer := 0;
  v_missing_recomputed integer;
  v_linked_count integer;
  v_total_reserved_count integer := 0;
  v_validated_items uuid[] := array[]::uuid[];
  v_identifiers text[] := array[]::text[];
  v_actual_variant_id uuid;
  v_has_variants boolean;
  v_variant_model text;
  v_prod_policy text;
  v_anchor_id uuid;
  v_var_policy text;
  v_effective_policy text;
BEGIN
  -- 1. Verify order belongs to merchant
  SELECT * INTO v_order
  FROM public.orders
  WHERE id = p_order_id AND merchant_id = p_merchant_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'order_not_found' USING ERRCODE = 'P0002';
  END IF;

  -- Check currently assigned units are still linked to the order with status='reserved'
  SELECT count(*)::integer INTO v_total_reserved_count
  FROM public.variant_inventory
  WHERE order_id = p_order_id AND status = 'reserved';

  -- 2. Validate external units payload shape & content
  IF p_external_units IS NOT NULL AND jsonb_typeof(p_external_units) = 'array' THEN
    FOR v_idx IN 0 .. jsonb_array_length(p_external_units) - 1 LOOP
      v_ext_item := p_external_units->v_idx;

      IF NOT (v_ext_item ? 'itemId' AND v_ext_item ? 'units') THEN
        RAISE EXCEPTION 'invalid_external_units_shape' USING ERRCODE = '22023';
      END IF;

      -- Validate order item belongs to this order
      SELECT * INTO v_item
      FROM public.order_items
      WHERE id = (v_ext_item->>'itemId')::uuid AND order_id = p_order_id;

      IF NOT FOUND THEN
        RAISE EXCEPTION 'order_item_not_found' USING ERRCODE = 'P0002';
      END IF;

      -- Recompute missing unit count from actual database state
      SELECT count(*)::integer INTO v_linked_count
      FROM public.variant_inventory
      WHERE order_item_id = v_item.id AND status IN ('reserved', 'sold');

      v_missing_recomputed := GREATEST(v_item.quantity - v_linked_count, 0);

      -- Check that units count matches remaining missing count
      IF jsonb_array_length(v_ext_item->'units') <> v_missing_recomputed THEN
        RAISE EXCEPTION 'submitted_unit_count_mismatch' USING ERRCODE = '22023';
      END IF;

      -- Validate each unit identifier
      FOR v_unit_idx IN 0 .. jsonb_array_length(v_ext_item->'units') - 1 LOOP
        v_ext_unit := (v_ext_item->'units')->v_unit_idx;

        IF v_ext_unit ? 'imei' AND v_ext_unit->>'imei' IS NOT NULL AND btrim(v_ext_unit->>'imei') <> '' THEN
          v_val := public.normalize_inventory_identifier(btrim(v_ext_unit->>'imei'));
          v_type := 'imei';
        ELSIF v_ext_unit ? 'serial' AND v_ext_unit->>'serial' IS NOT NULL AND btrim(v_ext_unit->>'serial') <> '' THEN
          v_val := public.normalize_inventory_identifier(btrim(v_ext_unit->>'serial'));
          v_type := 'serial';
        ELSE
          v_val := public.normalize_inventory_identifier(btrim(COALESCE(v_ext_unit->>'identifier_value', '')));
          v_type := COALESCE(v_ext_unit->>'identifier_type', CASE WHEN v_val ~ '^[0-9]{15}$' THEN 'imei' ELSE 'serial' END);
        END IF;

        IF v_val = '' THEN
          RAISE EXCEPTION 'invalid_inventory_identifier' USING ERRCODE = '22023';
        END IF;

        IF v_type = 'imei' AND v_val !~ '^[0-9]{15}$' THEN
          RAISE EXCEPTION 'invalid_imei_shape' USING ERRCODE = '22023';
        END IF;

        -- Check duplicate inside payload
        IF v_val = ANY(v_identifiers) THEN
          RAISE EXCEPTION 'duplicate_variant_inventory_identifier' USING ERRCODE = '23505';
        END IF;
        v_identifiers := array_append(v_identifiers, v_val);

        -- Check duplicate in database
        IF EXISTS (
          SELECT 1 FROM public.variant_inventory
          WHERE merchant_id = p_merchant_id
            AND public.normalize_inventory_identifier(identifier_value) = v_val
        ) THEN
          RAISE EXCEPTION 'duplicate_variant_inventory_identifier' USING ERRCODE = '23505';
        END IF;

        v_ext_count := v_ext_count + 1;
      END LOOP;

      v_validated_items := array_append(v_validated_items, v_item.id);
    END LOOP;
  END IF;

  -- Check other items that might have missing units but are not in the payload
  FOR v_item IN
    SELECT oi.*
    FROM public.order_items oi
    WHERE oi.order_id = p_order_id
      AND NOT (oi.id = ANY(v_validated_items))
  LOOP
    -- Get product policy and anchor info
    SELECT has_variants, variant_model, inventory_tracking_policy, inventory_anchor_variant_id
    INTO v_has_variants, v_variant_model, v_prod_policy, v_anchor_id
    FROM public.products
    WHERE id = v_item.product_id AND merchant_id = p_merchant_id;

    v_actual_variant_id := v_item.variant_id;
    IF (v_has_variants IS DISTINCT FROM TRUE AND COALESCE(v_variant_model, 'legacy') <> 'sku_matrix') THEN
      PERFORM private.ensure_product_inventory_anchor_variant(p_merchant_id, v_item.product_id);
      SELECT inventory_anchor_variant_id INTO v_actual_variant_id
      FROM public.products
      WHERE id = v_item.product_id;
    END IF;

    SELECT inventory_tracking_policy INTO v_var_policy
    FROM public.product_variants
    WHERE id = v_actual_variant_id AND merchant_id = p_merchant_id;

    v_effective_policy := COALESCE(NULLIF(v_var_policy, 'inherit'), v_prod_policy, 'off');

    IF v_effective_policy = 'off' THEN
      CONTINUE;
    END IF;

    SELECT count(*)::integer INTO v_linked_count
    FROM public.variant_inventory
    WHERE order_item_id = v_item.id AND status IN ('reserved', 'sold');

    v_missing_recomputed := GREATEST(v_item.quantity - v_linked_count, 0);

    IF v_missing_recomputed > 0 THEN
      RAISE EXCEPTION 'missing_external_identifiers_required' USING ERRCODE = '22023';
    END IF;
  END LOOP;

  RETURN jsonb_build_object(
    'orderId', p_order_id,
    'reservedUnitCount', v_total_reserved_count,
    'externalUnitCount', v_ext_count,
    'validatedItemIds', to_jsonb(v_validated_items)
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.validate_order_shipment_inventory(
  p_merchant_id uuid,
  p_order_id uuid,
  p_external_units jsonb DEFAULT '[]'::jsonb
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
AS $$
BEGIN
  RETURN private.validate_order_shipment_inventory(
    p_merchant_id,
    p_order_id,
    p_external_units
  );
END;
$$;

CREATE OR REPLACE FUNCTION private.complete_order_shipment_with_inventory(
  p_merchant_id uuid,
  p_order_id uuid,
  p_external_units jsonb DEFAULT '[]'::jsonb,
  p_shipping_update jsonb DEFAULT '{}'::jsonb
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_order record;
  v_validation jsonb;
  v_sold_res jsonb;
  v_ext_item jsonb;
  v_idx integer;
  v_item_id uuid;
  v_track_num text;
  v_ship_provider text;
  v_ship_fee numeric;
  v_ship_addr jsonb;
BEGIN
  -- 1. Auth check
  IF auth.role() <> 'service_role'
     AND NOT public.has_merchant_access(p_merchant_id) THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;

  -- 2. Lock order row
  SELECT * INTO v_order
  FROM public.orders
  WHERE id = p_order_id AND merchant_id = p_merchant_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'order_not_found' USING ERRCODE = 'P0002';
  END IF;

  -- Check if order can transition to shipped
  IF v_order.shipping_status IN ('shipped', 'delivered', 'cancelled') THEN
    RAISE EXCEPTION 'invalid_order_shipping_transition' USING ERRCODE = '22023';
  END IF;

  -- 3. Re-validate inventory under lock
  v_validation := private.validate_order_shipment_inventory(p_merchant_id, p_order_id, p_external_units);

  -- 4. Record external units
  IF p_external_units IS NOT NULL AND jsonb_typeof(p_external_units) = 'array' THEN
    FOR v_idx IN 0 .. jsonb_array_length(p_external_units) - 1 LOOP
      v_ext_item := p_external_units->v_idx;
      v_item_id := (v_ext_item->>'itemId')::uuid;

      PERFORM private.record_external_order_inventory_units(
        p_merchant_id, p_order_id, v_item_id, v_ext_item->'units', 'vendor_sourced'
      );
    END LOOP;
  END IF;

  -- 5. Mark reserved units as sold
  v_sold_res := private.mark_order_inventory_units_sold(p_merchant_id, p_order_id);

  -- 6. Update order shipping status and shipping fields
  v_track_num := p_shipping_update->>'tracking_number';
  v_ship_provider := p_shipping_update->>'shipping_provider';
  v_ship_fee := (p_shipping_update->>'shipping_fee')::numeric;
  v_ship_addr := p_shipping_update->'delivery_address';

  UPDATE public.orders
  SET shipping_status = 'shipped',
      tracking_number = COALESCE(v_track_num, tracking_number),
      shipping_provider = COALESCE(v_ship_provider, shipping_provider),
      shipping_fee = COALESCE(v_ship_fee, shipping_fee),
      delivery_address = COALESCE(v_ship_addr, delivery_address),
      shipped_at = COALESCE(shipped_at, now()),
      updated_at = now()
  WHERE id = p_order_id;

  RETURN jsonb_build_object(
    'orderId', p_order_id,
    'soldUnitCount', v_sold_res->'unitsMarkedSold',
    'externalUnitCount', v_validation->'externalUnitCount',
    'shippingStatus', 'shipped'
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.complete_order_shipment_with_inventory(
  p_merchant_id uuid,
  p_order_id uuid,
  p_external_units jsonb DEFAULT '[]'::jsonb,
  p_shipping_update jsonb DEFAULT '{}'::jsonb
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
AS $$
BEGIN
  RETURN private.complete_order_shipment_with_inventory(
    p_merchant_id,
    p_order_id,
    p_external_units,
    p_shipping_update
  );
END;
$$;

CREATE OR REPLACE FUNCTION private.record_shipment_inventory_reconciliation(
  p_merchant_id uuid,
  p_order_id uuid,
  p_provider text,
  p_shipment_id uuid,
  p_tracking_number text,
  p_error_code text,
  p_error_context jsonb DEFAULT '{}'::jsonb
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_shipment_order_id uuid;
  v_sanitized_context jsonb;
  v_event_id uuid;
BEGIN
  -- 1. Auth check
  IF auth.role() <> 'service_role'
     AND NOT public.has_merchant_access(p_merchant_id) THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;

  -- 2. Validate order exists
  IF NOT EXISTS (
    SELECT 1 FROM public.orders WHERE id = p_order_id AND merchant_id = p_merchant_id
  ) THEN
    RAISE EXCEPTION 'order_not_found' USING ERRCODE = 'P0002';
  END IF;

  -- 3. Validate shipment belongs to the merchant/order
  IF p_shipment_id IS NOT NULL THEN
    SELECT order_id INTO v_shipment_order_id
    FROM public.shipments
    WHERE id = p_shipment_id AND merchant_id = p_merchant_id;

    IF NOT FOUND OR v_shipment_order_id <> p_order_id THEN
      RAISE EXCEPTION 'invalid_shipment_for_order' USING ERRCODE = '22023';
    END IF;
  END IF;

  -- 4. Sanitize context
  v_sanitized_context := private.sanitize_error_context(p_error_context);

  -- 5. Upsert open reconciliation event
  INSERT INTO private.shipment_inventory_reconciliation_events (
    merchant_id, order_id, provider, shipment_id, tracking_number, error_code, error_context, status, created_at
  ) VALUES (
    p_merchant_id, p_order_id, p_provider, p_shipment_id, p_tracking_number, p_error_code, v_sanitized_context, 'open', now()
  )
  ON CONFLICT (merchant_id, order_id, (COALESCE(provider, '')), (COALESCE(shipment_id::text, '')), error_code)
  WHERE status = 'open'
  DO UPDATE SET
    tracking_number = EXCLUDED.tracking_number,
    error_context = EXCLUDED.error_context,
    created_at = now()
  RETURNING id INTO v_event_id;

  RETURN v_event_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.record_shipment_inventory_reconciliation(
  p_merchant_id uuid,
  p_order_id uuid,
  p_provider text,
  p_shipment_id uuid,
  p_tracking_number text,
  p_error_code text,
  p_error_context jsonb DEFAULT '{}'::jsonb
) RETURNS uuid
LANGUAGE plpgsql
SECURITY INVOKER
AS $$
BEGIN
  RETURN private.record_shipment_inventory_reconciliation(
    p_merchant_id,
    p_order_id,
    p_provider,
    p_shipment_id,
    p_tracking_number,
    p_error_code,
    p_error_context
  );
END;
$$;

CREATE OR REPLACE FUNCTION private.get_pending_provider_shipment_cancellation_finalization(
  p_merchant_id uuid,
  p_shipment_id uuid
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_rec record;
BEGIN
  -- 1. Auth check
  IF auth.role() <> 'service_role'
     AND NOT public.has_merchant_access(p_merchant_id) THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;

  -- 2. Validate shipment belongs to merchant
  IF NOT EXISTS (
    SELECT 1 FROM public.shipments WHERE id = p_shipment_id AND merchant_id = p_merchant_id
  ) THEN
    RAISE EXCEPTION 'shipment_not_found' USING ERRCODE = 'P0002';
  END IF;

  -- 3. Check for open marker
  SELECT * INTO v_rec
  FROM private.shipment_inventory_reconciliation_events
  WHERE merchant_id = p_merchant_id
    AND shipment_id = p_shipment_id
    AND error_code = 'provider_cancelled_local_finalization_failed'
    AND status = 'open'
  LIMIT 1;

  IF FOUND THEN
    RETURN jsonb_build_object(
      'pending', true,
      'eventId', v_rec.id,
      'orderId', v_rec.order_id,
      'provider', v_rec.provider,
      'trackingNumber', v_rec.tracking_number
    );
  ELSE
    RETURN jsonb_build_object('pending', false);
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_pending_provider_shipment_cancellation_finalization(
  p_merchant_id uuid,
  p_shipment_id uuid
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
AS $$
BEGIN
  RETURN private.get_pending_provider_shipment_cancellation_finalization(
    p_merchant_id,
    p_shipment_id
  );
END;
$$;

CREATE OR REPLACE FUNCTION private.apply_provider_shipment_webhook_status(
  p_shipment_id uuid,
  p_provider text,
  p_normalized_status text,
  p_tracking_number text DEFAULT NULL,
  p_tracking_event jsonb DEFAULT '{}'::jsonb,
  p_event_timestamp timestamp with time zone DEFAULT now()
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_shipment record;
  v_order record;
  v_merchant_id uuid;
  v_order_id uuid;
  v_order_shipping_status text;
  v_requires_finalization boolean := false;
  v_requires_manual_review boolean := false;
  v_sold_count integer := 0;
  v_released jsonb;
  v_target_order_status text := NULL;
BEGIN
  -- 1. Service-role check
  IF auth.role() <> 'service_role' THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;

  -- 2. Lock shipment
  SELECT * INTO v_shipment
  FROM public.shipments
  WHERE id = p_shipment_id AND provider = p_provider
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'shipment_not_found' USING ERRCODE = 'P0002';
  END IF;

  v_merchant_id := v_shipment.merchant_id;
  v_order_id := v_shipment.order_id;

  -- 3. Lock linked order
  SELECT * INTO v_order
  FROM public.orders
  WHERE id = v_order_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'order_not_found' USING ERRCODE = 'P0002';
  END IF;

  v_order_shipping_status := v_order.shipping_status;

  -- Check if serialized units are sold
  SELECT count(*)::integer INTO v_sold_count
  FROM public.variant_inventory
  WHERE order_id = v_order_id AND status = 'sold';

  -- 4. Process statuses
  IF p_normalized_status IN ('booked', 'pickup_scheduled', 'picked_up', 'in_transit', 'out_for_delivery') THEN
    IF v_sold_count > 0 OR NOT EXISTS (
      -- Check if there are any serialized items for the order
      SELECT 1 FROM public.order_items oi
      JOIN public.products p ON oi.product_id = p.id
      WHERE oi.order_id = v_order_id AND p.inventory_tracking_policy <> 'off'
    ) THEN
      v_target_order_status := 'shipped';
    ELSE
      v_requires_finalization := true;
    END IF;

  ELSIF p_normalized_status = 'delivered' THEN
    IF v_order_shipping_status = 'shipped' AND (v_sold_count > 0 OR NOT EXISTS (
      SELECT 1 FROM public.order_items oi
      JOIN public.products p ON oi.product_id = p.id
      WHERE oi.order_id = v_order_id AND p.inventory_tracking_policy <> 'off'
    )) THEN
      v_target_order_status := 'delivered';
    ELSE
      v_requires_finalization := true;
    END IF;

  ELSIF p_normalized_status IN ('cancelled', 'failed') THEN
    -- If already sold, returned, or defective, require manual review
    IF v_sold_count > 0 OR EXISTS (
      SELECT 1 FROM public.variant_inventory
      WHERE order_id = v_order_id AND status IN ('returned', 'defective')
    ) THEN
      v_requires_manual_review := true;
    ELSE
      v_target_order_status := p_normalized_status;

      -- Release reserved units
      SELECT * INTO v_released FROM private.release_order_inventory_units(v_merchant_id, v_order_id, 'available');
    END IF;
  END IF;

  -- 5. Update shipment row
  UPDATE public.shipments
  SET status = p_normalized_status,
      tracking_number = COALESCE(p_tracking_number, tracking_number),
      tracking_history = COALESCE(tracking_history, '[]'::jsonb) || jsonb_build_object(
        'status', p_normalized_status,
        'timestamp', p_event_timestamp,
        'event', private.sanitize_error_context(p_tracking_event)
      ),
      updated_at = now()
  WHERE id = p_shipment_id;

  -- 6. Update order status if eligible
  IF v_target_order_status IS NOT NULL THEN
    UPDATE public.orders
    SET shipping_status = v_target_order_status,
        shipped_at = CASE WHEN v_target_order_status = 'shipped' THEN COALESCE(shipped_at, now()) ELSE shipped_at END,
        delivered_at = CASE WHEN v_target_order_status = 'delivered' THEN COALESCE(delivered_at, now()) ELSE delivered_at END,
        updated_at = now()
    WHERE id = v_order_id;
  END IF;

  RETURN jsonb_build_object(
    'shipmentId', p_shipment_id,
    'merchantId', v_merchant_id,
    'orderId', v_order_id,
    'normalizedStatus', p_normalized_status,
    'appliedOrderStatus', COALESCE(v_target_order_status, v_order_shipping_status),
    'requiresInventoryFinalization', v_requires_finalization,
    'requiresManualReturnReview', v_requires_manual_review
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.apply_provider_shipment_webhook_status(
  p_shipment_id uuid,
  p_provider text,
  p_normalized_status text,
  p_tracking_number text DEFAULT NULL,
  p_tracking_event jsonb DEFAULT '{}'::jsonb,
  p_event_timestamp timestamp with time zone DEFAULT now()
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
AS $$
BEGIN
  RETURN private.apply_provider_shipment_webhook_status(
    p_shipment_id,
    p_provider,
    p_normalized_status,
    p_tracking_number,
    p_tracking_event,
    p_event_timestamp
  );
END;
$$;

CREATE OR REPLACE FUNCTION private.release_expired_variant_inventory_reservations(
  p_merchant_id uuid DEFAULT NULL,
  p_reference_time timestamp with time zone DEFAULT now(),
  p_limit integer DEFAULT 500
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_limit integer;
  v_order record;
  v_released_count integer := 0;
  v_order_released_count integer := 0;
  v_item record;
  v_units_json jsonb;
  v_fulfillment_data jsonb;
  v_reserved_count integer;
  v_total_items integer;
  v_total_qty integer;
  v_merchant_id uuid;
  v_results jsonb := '[]'::jsonb;
BEGIN
  -- 1. Service-role check
  IF auth.role() <> 'service_role' THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;

  v_limit := LEAST(GREATEST(COALESCE(p_limit, 500), 1), 1000);

  -- 2. Find and lock candidate orders with expired reservations
  FOR v_order IN
    SELECT DISTINCT o.id, o.merchant_id
    FROM public.orders o
    JOIN public.variant_inventory vi ON vi.order_id = o.id
    WHERE vi.status = 'reserved'
      AND vi.reservation_expires_at IS NOT NULL
      AND vi.reservation_expires_at <= p_reference_time
      -- Order state guards
      AND o.payment_status NOT IN ('paid', 'bnpl_approved')
      AND o.shipping_status NOT IN ('shipped', 'delivered')
      AND (p_merchant_id IS NULL OR o.merchant_id = p_merchant_id)
    ORDER BY o.id
    LIMIT v_limit
    FOR UPDATE SKIP LOCKED
  LOOP
    v_order_released_count := 0;
    v_merchant_id := v_order.merchant_id;

    -- Re-evaluate each item/unit under order lock
    FOR v_item IN
      SELECT oi.*
      FROM public.order_items oi
      WHERE oi.order_id = v_order.id
      FOR UPDATE
    LOOP
      -- Release units
      DECLARE
        v_unit record;
      BEGIN
        FOR v_unit IN
          SELECT vi.*, pv.product_id
          FROM public.variant_inventory vi
          JOIN public.product_variants pv ON vi.variant_id = pv.id
          WHERE vi.order_item_id = v_item.id
            AND vi.status = 'reserved'
            AND vi.reservation_expires_at IS NOT NULL
            AND vi.reservation_expires_at <= p_reference_time
            FOR UPDATE
        LOOP
          PERFORM private.record_variant_inventory_event(
            v_unit.id, v_merchant_id, v_unit.product_id, v_unit.variant_id, 'reservation_expired',
            'reserved', 'available', v_order.id, v_item.id, v_unit.branch_id, NULL, NULL,
            jsonb_build_object()
          );

          UPDATE public.variant_inventory
          SET status = 'available',
              order_id = NULL,
              order_item_id = NULL,
              reserved_at = NULL,
              reservation_expires_at = NULL,
              updated_at = now()
          WHERE id = v_unit.id;

          v_order_released_count := v_order_released_count + 1;
          v_released_count := v_released_count + 1;
        END LOOP;
      END;

      -- Update item snapshot
      SELECT jsonb_agg(
        jsonb_build_object(
          'inventoryUnitId', vi.id,
          'identifierType', vi.identifier_type,
          'identifierValue', vi.identifier_value
        )
      ) INTO v_units_json
      FROM public.variant_inventory vi
      WHERE vi.order_item_id = v_item.id;

      SELECT count(*)::integer INTO v_reserved_count
      FROM public.variant_inventory
      WHERE order_item_id = v_item.id AND status = 'reserved';

      v_fulfillment_data := jsonb_build_object(
        'source', 'merchant_stock',
        'reservationExpiresAt', null,
        'inventoryUnits', COALESCE(v_units_json, '[]'::jsonb),
        'missingUnitCount', COALESCE((v_item.fulfillment_data->>'missingUnitCount')::integer, GREATEST(v_item.quantity - v_reserved_count, 0))
      );

      UPDATE public.order_items
      SET fulfillment_data = v_fulfillment_data
      WHERE id = v_item.id;

      -- Sync stock
      PERFORM private.sync_serialized_stock(v_merchant_id, v_item.product_id);
    END LOOP;

    -- Mirror single unit order
    SELECT count(*), sum(quantity) INTO v_total_items, v_total_qty FROM public.order_items WHERE order_id = v_order.id;
    IF v_total_items = 1 AND v_total_qty = 1 THEN
      SELECT fulfillment_data INTO v_fulfillment_data FROM public.order_items WHERE order_id = v_order.id LIMIT 1;
      UPDATE public.orders SET fulfillment_details = v_fulfillment_data WHERE id = v_order.id;
    END IF;

    IF v_order_released_count > 0 THEN
      v_results := v_results || jsonb_build_object(
        'merchantId', v_merchant_id,
        'orderId', v_order.id,
        'releasedCount', v_order_released_count
      );
    END IF;
  END LOOP;

  RETURN jsonb_build_object(
    'totalReleasedCount', v_released_count,
    'details', v_results
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.release_expired_variant_inventory_reservations(
  p_merchant_id uuid DEFAULT NULL,
  p_reference_time timestamp with time zone DEFAULT now(),
  p_limit integer DEFAULT 500
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
AS $$
BEGIN
  RETURN private.release_expired_variant_inventory_reservations(
    p_merchant_id,
    p_reference_time,
    p_limit
  );
END;
$$;

CREATE OR REPLACE FUNCTION private.cancel_order_and_release_inventory(
  p_merchant_id uuid,
  p_order_id uuid,
  p_payment_status text DEFAULT NULL,
  p_notes text DEFAULT NULL,
  p_shipping_address jsonb DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_order record;
  v_released jsonb;
  v_count integer;
BEGIN
  -- 1. Auth check
  IF auth.role() <> 'service_role'
     AND NOT public.has_merchant_access(p_merchant_id) THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;

  -- 2. Lock order row
  SELECT * INTO v_order
  FROM public.orders
  WHERE id = p_order_id AND merchant_id = p_merchant_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'order_not_found' USING ERRCODE = 'P0002';
  END IF;

  -- Validate current status can transition to cancelled
  IF v_order.shipping_status IN ('cancelled', 'shipped', 'delivered') THEN
    RAISE EXCEPTION 'invalid_order_cancellation_state' USING ERRCODE = '22023';
  END IF;

  -- 3. Release units
  SELECT * INTO v_released FROM private.release_order_inventory_units(p_merchant_id, p_order_id, 'available');
  v_count := (v_released->>'releasedCount')::integer;

  -- 4. Update order status
  UPDATE public.orders
  SET shipping_status = 'cancelled',
      payment_status = COALESCE(p_payment_status, payment_status),
      notes = COALESCE(p_notes, notes),
      delivery_address = COALESCE(p_shipping_address, delivery_address),
      updated_at = now()
  WHERE id = p_order_id;

  RETURN jsonb_build_object(
    'orderId', p_order_id,
    'releasedUnitCount', v_count
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.cancel_order_and_release_inventory(
  p_merchant_id uuid,
  p_order_id uuid,
  p_payment_status text DEFAULT NULL,
  p_notes text DEFAULT NULL,
  p_shipping_address jsonb DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
AS $$
BEGIN
  RETURN private.cancel_order_and_release_inventory(
    p_merchant_id,
    p_order_id,
    p_payment_status,
    p_notes,
    p_shipping_address
  );
END;
$$;

CREATE OR REPLACE FUNCTION private.cancel_provider_shipment_order_and_release_inventory(
  p_merchant_id uuid,
  p_shipment_id uuid,
  p_refund_amount numeric DEFAULT NULL,
  p_cancelled_at timestamp with time zone DEFAULT now()
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_shipment record;
  v_order record;
  v_released jsonb;
  v_count integer;
BEGIN
  -- 1. Auth check
  IF auth.role() <> 'service_role'
     AND NOT public.has_merchant_access(p_merchant_id) THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;

  -- 2. Lock shipment
  SELECT * INTO v_shipment
  FROM public.shipments
  WHERE id = p_shipment_id AND merchant_id = p_merchant_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'shipment_not_found' USING ERRCODE = 'P0002';
  END IF;

  -- Reject non-cancellable
  IF v_shipment.status IN ('delivered', 'cancelled', 'returned') THEN
    RAISE EXCEPTION 'invalid_shipment_cancellation_state' USING ERRCODE = '22023';
  END IF;

  -- 3. Lock linked order
  SELECT * INTO v_order
  FROM public.orders
  WHERE id = v_shipment.order_id AND merchant_id = p_merchant_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'order_not_found' USING ERRCODE = 'P0002';
  END IF;

  -- 4. Cancel order and release inventory
  SELECT * INTO v_released FROM private.cancel_order_and_release_inventory(
    p_merchant_id, v_shipment.order_id, NULL, 'Cancelled via provider shipment cancellation', NULL
  );
  v_count := (v_released->>'releasedUnitCount')::integer;

  -- 5. Update shipment
  UPDATE public.shipments
  SET status = 'cancelled',
      cancelled_at = p_cancelled_at,
      refund_amount = COALESCE(p_refund_amount, refund_amount),
      updated_at = now()
  WHERE id = p_shipment_id;

  -- 6. Resolve any open reconciliation events
  UPDATE private.shipment_inventory_reconciliation_events
  SET status = 'resolved',
      resolved_at = now(),
      resolved_by = auth.uid()
  WHERE merchant_id = p_merchant_id
    AND shipment_id = p_shipment_id
    AND error_code = 'provider_cancelled_local_finalization_failed'
    AND status = 'open';

  RETURN jsonb_build_object(
    'shipmentId', p_shipment_id,
    'orderId', v_shipment.order_id,
    'releasedUnitCount', v_count
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.cancel_provider_shipment_order_and_release_inventory(
  p_merchant_id uuid,
  p_shipment_id uuid,
  p_refund_amount numeric DEFAULT NULL,
  p_cancelled_at timestamp with time zone DEFAULT now()
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
AS $$
BEGIN
  RETURN private.cancel_provider_shipment_order_and_release_inventory(
    p_merchant_id,
    p_shipment_id,
    p_refund_amount,
    p_cancelled_at
  );
END;
$$;

-- Revoke and Grant EXECUTE permissions to enforce client/service-role access

REVOKE ALL ON FUNCTION public.restock_variant_inventory_units(uuid, uuid, jsonb, uuid, text, uuid) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.restock_variant_inventory_units(uuid, uuid, jsonb, uuid, text, uuid) TO authenticated, service_role;
REVOKE ALL ON FUNCTION private.restock_variant_inventory_units(uuid, uuid, jsonb, uuid, text, uuid) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION private.restock_variant_inventory_units(uuid, uuid, jsonb, uuid, text, uuid) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.list_variant_inventory_units(uuid, uuid, uuid, text, text, uuid, integer, timestamp with time zone, uuid) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.list_variant_inventory_units(uuid, uuid, uuid, text, text, uuid, integer, timestamp with time zone, uuid) TO authenticated, service_role;
REVOKE ALL ON FUNCTION private.list_variant_inventory_units(uuid, uuid, uuid, text, text, uuid, integer, timestamp with time zone, uuid) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION private.list_variant_inventory_units(uuid, uuid, uuid, text, text, uuid, integer, timestamp with time zone, uuid) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.update_inventory_tracking_policy(uuid, uuid, text, uuid) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.update_inventory_tracking_policy(uuid, uuid, text, uuid) TO authenticated, service_role;
REVOKE ALL ON FUNCTION private.update_inventory_tracking_policy(uuid, uuid, text, uuid) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION private.update_inventory_tracking_policy(uuid, uuid, text, uuid) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.update_variant_inventory_unit(uuid, uuid, text, text, uuid, boolean, text) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.update_variant_inventory_unit(uuid, uuid, text, text, uuid, boolean, text) TO authenticated, service_role;
REVOKE ALL ON FUNCTION private.update_variant_inventory_unit(uuid, uuid, text, text, uuid, boolean, text) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION private.update_variant_inventory_unit(uuid, uuid, text, text, uuid, boolean, text) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.delete_variant_inventory_unit(uuid, uuid) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.delete_variant_inventory_unit(uuid, uuid) TO authenticated, service_role;
REVOKE ALL ON FUNCTION private.delete_variant_inventory_unit(uuid, uuid) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION private.delete_variant_inventory_unit(uuid, uuid) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.claim_variant_inventory_units_for_order_item(uuid, uuid, uuid) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.claim_variant_inventory_units_for_order_item(uuid, uuid, uuid) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.mark_order_inventory_units_sold(uuid, uuid) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.mark_order_inventory_units_sold(uuid, uuid) TO authenticated, service_role;
REVOKE ALL ON FUNCTION private.mark_order_inventory_units_sold(uuid, uuid) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION private.mark_order_inventory_units_sold(uuid, uuid) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.confirm_order_inventory_reservations(uuid, uuid) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.confirm_order_inventory_reservations(uuid, uuid) TO authenticated, service_role;
REVOKE ALL ON FUNCTION private.confirm_order_inventory_reservations(uuid, uuid) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION private.confirm_order_inventory_reservations(uuid, uuid) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.record_external_order_inventory_units(uuid, uuid, uuid, jsonb, text) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.record_external_order_inventory_units(uuid, uuid, uuid, jsonb, text) TO authenticated, service_role;
REVOKE ALL ON FUNCTION private.record_external_order_inventory_units(uuid, uuid, uuid, jsonb, text) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION private.record_external_order_inventory_units(uuid, uuid, uuid, jsonb, text) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.release_order_inventory_units(uuid, uuid, text) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.release_order_inventory_units(uuid, uuid, text) TO authenticated, service_role;
REVOKE ALL ON FUNCTION private.release_order_inventory_units(uuid, uuid, text) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION private.release_order_inventory_units(uuid, uuid, text) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.mark_order_payment_failed_and_release_inventory(uuid, uuid, text, text, jsonb) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.mark_order_payment_failed_and_release_inventory(uuid, uuid, text, text, jsonb) TO authenticated, service_role;
REVOKE ALL ON FUNCTION private.mark_order_payment_failed_and_release_inventory(uuid, uuid, text, text, jsonb) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION private.mark_order_payment_failed_and_release_inventory(uuid, uuid, text, text, jsonb) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.validate_order_shipment_inventory(uuid, uuid, jsonb) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.validate_order_shipment_inventory(uuid, uuid, jsonb) TO authenticated, service_role;
REVOKE ALL ON FUNCTION private.validate_order_shipment_inventory(uuid, uuid, jsonb) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION private.validate_order_shipment_inventory(uuid, uuid, jsonb) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.complete_order_shipment_with_inventory(uuid, uuid, jsonb, jsonb) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.complete_order_shipment_with_inventory(uuid, uuid, jsonb, jsonb) TO authenticated, service_role;
REVOKE ALL ON FUNCTION private.complete_order_shipment_with_inventory(uuid, uuid, jsonb, jsonb) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION private.complete_order_shipment_with_inventory(uuid, uuid, jsonb, jsonb) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.record_shipment_inventory_reconciliation(uuid, uuid, text, uuid, text, text, jsonb) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.record_shipment_inventory_reconciliation(uuid, uuid, text, uuid, text, text, jsonb) TO authenticated, service_role;
REVOKE ALL ON FUNCTION private.record_shipment_inventory_reconciliation(uuid, uuid, text, uuid, text, text, jsonb) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION private.record_shipment_inventory_reconciliation(uuid, uuid, text, uuid, text, text, jsonb) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.get_pending_provider_shipment_cancellation_finalization(uuid, uuid) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_pending_provider_shipment_cancellation_finalization(uuid, uuid) TO authenticated, service_role;
REVOKE ALL ON FUNCTION private.get_pending_provider_shipment_cancellation_finalization(uuid, uuid) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION private.get_pending_provider_shipment_cancellation_finalization(uuid, uuid) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.apply_provider_shipment_webhook_status(uuid, text, text, text, jsonb, timestamp with time zone) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.apply_provider_shipment_webhook_status(uuid, text, text, text, jsonb, timestamp with time zone) TO service_role;
REVOKE ALL ON FUNCTION private.apply_provider_shipment_webhook_status(uuid, text, text, text, jsonb, timestamp with time zone) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION private.apply_provider_shipment_webhook_status(uuid, text, text, text, jsonb, timestamp with time zone) TO service_role;

REVOKE ALL ON FUNCTION public.release_expired_variant_inventory_reservations(uuid, timestamp with time zone, integer) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.release_expired_variant_inventory_reservations(uuid, timestamp with time zone, integer) TO service_role;
REVOKE ALL ON FUNCTION private.release_expired_variant_inventory_reservations(uuid, timestamp with time zone, integer) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION private.release_expired_variant_inventory_reservations(uuid, timestamp with time zone, integer) TO service_role;

REVOKE ALL ON FUNCTION public.cancel_order_and_release_inventory(uuid, uuid, text, text, jsonb) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.cancel_order_and_release_inventory(uuid, uuid, text, text, jsonb) TO authenticated, service_role;
REVOKE ALL ON FUNCTION private.cancel_order_and_release_inventory(uuid, uuid, text, text, jsonb) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION private.cancel_order_and_release_inventory(uuid, uuid, text, text, jsonb) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.cancel_provider_shipment_order_and_release_inventory(uuid, uuid, numeric, timestamp with time zone) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.cancel_provider_shipment_order_and_release_inventory(uuid, uuid, numeric, timestamp with time zone) TO authenticated, service_role;
REVOKE ALL ON FUNCTION private.cancel_provider_shipment_order_and_release_inventory(uuid, uuid, numeric, timestamp with time zone) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION private.cancel_provider_shipment_order_and_release_inventory(uuid, uuid, numeric, timestamp with time zone) TO authenticated, service_role;

-- Task 6f: Quiz Product-Prize Award Reservation schema and helpers
ALTER TABLE public.quiz_awards
  ADD COLUMN IF NOT EXISTS product_id uuid REFERENCES public.products(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS variant_id uuid REFERENCES public.product_variants(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS condition text,
  ADD COLUMN IF NOT EXISTS reserved_order_id uuid REFERENCES public.orders(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS reserved_order_item_id uuid REFERENCES public.order_items(id) ON DELETE SET NULL;

CREATE OR REPLACE FUNCTION private.create_quiz_product_prize_award_with_inventory(
  p_attempt_id uuid,
  p_event_id uuid,
  p_customer_id uuid,
  p_product_id uuid,
  p_variant_id uuid DEFAULT NULL,
  p_condition text DEFAULT NULL,
  p_route_proof jsonb DEFAULT '{}'::jsonb,
  p_user_id uuid DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_merchant_id uuid;
  v_active boolean;
  v_has_variants boolean;
  v_variant_model text;
  v_prod_policy text;
  v_var_policy text;
  v_effective_policy text;
  v_claim_variant_id uuid;
  v_order_id uuid;
  v_order_item_id uuid;
  v_award_id uuid;
  v_customer_email text;
  v_customer_name text;
  v_customer_phone text;
  v_prize_amount numeric;
  v_claim_res jsonb;
  v_reserved_count integer;
  v_variant_name text;
  v_product_name text;
BEGIN
  -- 1. Lock quiz_attempts, quiz_events, customers, and existing matching awards FOR UPDATE
  PERFORM 1 FROM public.quiz_attempts WHERE id = p_attempt_id FOR UPDATE;
  PERFORM 1 FROM public.quiz_events WHERE id = p_event_id FOR UPDATE;

  SELECT c.merchant_id, c.email, (COALESCE(c.first_name, '') || ' ' || COALESCE(c.last_name, ''))::text, c.phone
  INTO v_merchant_id, v_customer_email, v_customer_name, v_customer_phone
  FROM public.customers c
  WHERE c.id = p_customer_id
  FOR UPDATE;

  -- Find existing award
  SELECT id, reserved_order_id INTO v_award_id, v_order_id
  FROM public.quiz_awards
  WHERE attempt_id = p_attempt_id
    AND award_type = 'store_credit'
    AND status <> 'void'
  ORDER BY created_at
  LIMIT 1
  FOR UPDATE;

  IF v_award_id IS NOT NULL THEN
    RETURN jsonb_build_object(
      'success', true,
      'awardId', v_award_id,
      'orderId', v_order_id,
      'alreadyExisted', true
    );
  END IF;

  -- 2. Validate product/variant
  SELECT p.merchant_id, (p.status = 'active'), p.has_variants, p.variant_model, p.inventory_tracking_policy, p.price, p.name
  INTO v_merchant_id, v_active, v_has_variants, v_variant_model, v_prod_policy, v_prize_amount, v_product_name
  FROM public.products p
  WHERE p.id = p_product_id;

  IF NOT FOUND OR NOT v_active THEN
    RETURN jsonb_build_object('success', false, 'error', 'quiz_prize_product_inactive_or_not_found');
  END IF;

  -- Check if variant belongs to product
  IF p_variant_id IS NOT NULL THEN
    SELECT pv.inventory_tracking_policy, COALESCE(pv.price_override, v_prize_amount), (SELECT public.format_order_item_variant_name(pv.attributes))
    INTO v_var_policy, v_prize_amount, v_variant_name
    FROM public.product_variants pv
    WHERE pv.id = p_variant_id
      AND pv.product_id = p_product_id
      AND pv.merchant_id = v_merchant_id
      AND pv.is_inventory_anchor IS NOT TRUE;

    IF NOT FOUND THEN
      RETURN jsonb_build_object('success', false, 'error', 'quiz_prize_variant_invalid');
    END IF;
    v_claim_variant_id := p_variant_id;
  ELSE
    -- If product is variant product, require configured prize_variant_id
    IF (v_has_variants IS TRUE OR v_variant_model = 'sku_matrix') THEN
      RETURN jsonb_build_object('success', false, 'error', 'quiz_prize_variant_id_required_for_variant_product');
    END IF;
    -- For simple product, let's ensure anchor variant exists
    PERFORM private.ensure_product_inventory_anchor_variant(v_merchant_id, p_product_id);
    SELECT inventory_anchor_variant_id INTO v_claim_variant_id
    FROM public.products
    WHERE id = p_product_id;

    SELECT pv.inventory_tracking_policy INTO v_var_policy
    FROM public.product_variants pv
    WHERE pv.id = v_claim_variant_id;

    v_variant_name := NULL;
  END IF;

  v_effective_policy := public.get_effective_inventory_tracking_policy(v_prod_policy, v_var_policy);

  -- 3. Check inventory if strict tracking
  IF v_effective_policy = 'serialized_strict' THEN
    -- Check how many clean units are available
    SELECT count(*)::integer INTO v_reserved_count
    FROM public.variant_inventory
    WHERE variant_id = v_claim_variant_id
      AND status = 'available'
      AND order_id IS NULL
      AND order_item_id IS NULL
      AND sold_at IS NULL;

    IF v_reserved_count < 1 THEN
      RETURN jsonb_build_object('success', false, 'error', 'stock_exhausted');
    END IF;
  END IF;

  -- 4. Create zero-total order and order item
  INSERT INTO public.orders (
    merchant_id,
    customer_id,
    customer_email,
    customer_name,
    customer_phone,
    subtotal,
    shipping_fee,
    discount_amount,
    tax_amount,
    total,
    payment_method,
    payment_status,
    shipping_status,
    source,
    notes,
    tax_basis
  ) VALUES (
    v_merchant_id,
    p_customer_id,
    COALESCE(v_customer_email, 'quiz-prize@baci.app'),
    COALESCE(v_customer_name, 'Quiz Winner'),
    v_customer_phone,
    0,
    0,
    0,
    0,
    0,
    'quiz_award',
    'paid',
    'pending',
    'quiz_prize',
    'Quiz prize award reservation',
    'exclusive'
  ) RETURNING id INTO v_order_id;

  -- Insert order item
  INSERT INTO public.order_items (
    order_id,
    product_id,
    variant_id,
    variant_name,
    name,
    price,
    quantity,
    condition,
    variant_attributes
  ) VALUES (
    v_order_id,
    p_product_id,
    p_variant_id, -- variant_id is NULL for simple products to match catalog
    v_variant_name,
    v_product_name,
    0,
    1,
    p_condition,
    '{}'::jsonb
  ) RETURNING id INTO v_order_item_id;

  -- 5. Create approved award row
  INSERT INTO public.quiz_awards (
    amount,
    approved_at,
    attempt_id,
    award_type,
    customer_id,
    event_id,
    status,
    product_id,
    variant_id,
    condition,
    reserved_order_id,
    reserved_order_item_id
  ) VALUES (
    v_prize_amount,
    now(),
    p_attempt_id,
    'store_credit',
    p_customer_id,
    p_event_id,
    'approved',
    p_product_id,
    p_variant_id,
    p_condition,
    v_order_id,
    v_order_item_id
  ) RETURNING id INTO v_award_id;

  -- 6. Claim inventory
  PERFORM private.claim_variant_inventory_units_for_order_item_internal(
    v_merchant_id,
    v_order_id,
    v_order_item_id
  );

  RETURN jsonb_build_object(
    'success', true,
    'awardId', v_award_id,
    'orderId', v_order_id,
    'orderItemId', v_order_item_id,
    'alreadyExisted', false
  );
END;
$$;

REVOKE ALL ON FUNCTION private.create_quiz_product_prize_award_with_inventory(uuid, uuid, uuid, uuid, uuid, text, jsonb, uuid) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION private.create_quiz_product_prize_award_with_inventory(uuid, uuid, uuid, uuid, uuid, text, jsonb, uuid) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.submit_quiz_answer(
  p_attempt_id uuid,
  p_question_id uuid,
  p_answer text,
  p_client_answered_at timestamptz DEFAULT NULL,
  p_integrity_tier text DEFAULT NULL,
  p_route_proof jsonb DEFAULT '{}'::jsonb,
  p_user_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_answer_id uuid;
  v_answered_questions integer;
  v_attempt_event_id uuid;
  v_award_id uuid;
  v_customer_id uuid;
  v_next_question jsonb;
  v_prize_amount numeric;
  v_prize_claim jsonb;
  v_prize_condition text;
  v_prize_product_id uuid;
  v_prize_variant_id uuid;
  v_score integer;
  v_status text;
  v_total_questions integer;
  v_award_res jsonb;
BEGIN
  IF NOT public.quiz_route_proof_valid(p_route_proof, 'submit_quiz_answer', p_attempt_id::text || ':' || p_question_id::text, p_user_id) THEN
    RAISE EXCEPTION 'quiz route proof required' USING ERRCODE = 'QZ010';
  END IF;

  v_answer_id := public.record_quiz_answer(
    p_attempt_id,
    p_question_id,
    pg_catalog.jsonb_build_object(
      'answer', p_answer,
      'client_answered_at', p_client_answered_at,
      'integrity_tier', p_integrity_tier,
      'user_id', p_user_id
    ),
    p_route_proof,
    p_user_id,
    true
  );

  SELECT
    a.event_id,
    a.customer_id
  INTO v_attempt_event_id, v_customer_id
  FROM public.quiz_attempts a
  JOIN public.customers c ON c.id = a.customer_id
  WHERE a.id = p_attempt_id
    AND c.user_id = p_user_id;

  IF v_attempt_event_id IS NULL OR v_customer_id IS NULL THEN
    RAISE EXCEPTION 'quiz_attempt_not_found' USING ERRCODE = 'QZ004';
  END IF;

  SELECT
    pg_catalog.count(q.id)::integer,
    pg_catalog.count(ans.id)::integer,
    COALESCE(pg_catalog.sum(ans.score_delta), 0)::integer
  INTO v_total_questions, v_answered_questions, v_score
  FROM public.quiz_attempt_questions q
  LEFT JOIN public.quiz_attempt_answers ans ON ans.attempt_question_id = q.id
  WHERE q.attempt_id = p_attempt_id;

  IF v_answered_questions >= v_total_questions THEN
    UPDATE public.quiz_attempts a
    SET status = 'submitted',
        submitted_at = COALESCE(a.submitted_at, pg_catalog.now())
    FROM public.customers c
    WHERE a.id = p_attempt_id
      AND c.id = a.customer_id
      AND c.user_id = p_user_id;
    v_status := 'completed';

    IF COALESCE(v_score, 0) >= COALESCE(v_total_questions, 0) AND COALESCE(v_total_questions, 0) > 0 THEN
      SELECT
        NULLIF(e.settings ->> 'prize_product_id', '')::uuid,
        NULLIF(e.settings ->> 'prize_variant_id', '')::uuid,
        NULLIF(e.settings ->> 'prize_condition', '')
      INTO v_prize_product_id, v_prize_variant_id, v_prize_condition
      FROM public.quiz_events e
      WHERE e.id = v_attempt_event_id
        AND NULLIF(e.settings ->> 'prize_product_id', '') IS NOT NULL;

      IF v_prize_product_id IS NOT NULL THEN
        -- Call the inventory-aware prize creator
        v_award_res := private.create_quiz_product_prize_award_with_inventory(
          p_attempt_id,
          v_attempt_event_id,
          v_customer_id,
          v_prize_product_id,
          v_prize_variant_id,
          v_prize_condition,
          p_route_proof,
          p_user_id
        );

        IF (v_award_res->>'success')::boolean = true THEN
          v_award_id := (v_award_res->>'awardId')::uuid;
          v_prize_claim := pg_catalog.jsonb_build_object(
            'awardId', v_award_id,
            'condition', v_prize_condition,
            'productId', v_prize_product_id,
            'variantId', v_prize_variant_id
          );
        ELSE
          v_prize_claim := NULL;
        END IF;
      END IF;
    END IF;
  ELSE
    v_status := 'in_progress';

    WITH next_attempt_question AS (
      SELECT aq.id
      FROM public.quiz_attempt_questions aq
      LEFT JOIN public.quiz_attempt_answers ans ON ans.attempt_question_id = aq.id
      WHERE aq.attempt_id = p_attempt_id
        AND ans.id IS NULL
      ORDER BY aq.position
      LIMIT 1
    )
    UPDATE public.quiz_attempt_questions aq
    SET issued_at = COALESCE(aq.issued_at, pg_catalog.now()),
        time_limit_ms = COALESCE(
          aq.time_limit_ms,
          CASE
            WHEN e.settings->>'time_limit_seconds' ~ '^[0-9]+$' THEN
              pg_catalog.least(pg_catalog.greatest((e.settings->>'time_limit_seconds')::integer, 1), 60) * 1000
            ELSE 30000
          END
        )
    FROM next_attempt_question nq
    JOIN public.quiz_attempts a ON a.id = p_attempt_id
    JOIN public.quiz_events e ON e.id = a.event_id
    WHERE aq.id = nq.id;

    SELECT pg_catalog.jsonb_build_object(
      'id', aq.slot_id,
      'prompt', qv.prompt,
      'options', CASE WHEN pg_catalog.jsonb_typeof(qv.options) = 'array' THEN qv.options ELSE '[]'::jsonb END,
      'timeLimitSeconds', CASE
        WHEN aq.time_limit_ms IS NOT NULL THEN pg_catalog.ceil(aq.time_limit_ms::numeric / 1000)::integer
        WHEN e.settings->>'time_limit_seconds' ~ '^[0-9]+$' THEN
          pg_catalog.least(pg_catalog.greatest((e.settings->>'time_limit_seconds')::integer, 1), 60)
        ELSE 30
      END,
      'index', aq.position,
      'total', v_total_questions
    ) INTO v_next_question
    FROM public.quiz_attempt_questions aq
    JOIN public.quiz_question_variants qv ON qv.id = aq.variant_id
    JOIN public.quiz_attempts a ON a.id = aq.attempt_id
    JOIN public.quiz_events e ON e.id = a.event_id
    LEFT JOIN public.quiz_attempt_answers ans ON ans.attempt_question_id = aq.id
    WHERE aq.attempt_id = p_attempt_id
      AND ans.id IS NULL
    ORDER BY aq.position
    LIMIT 1;
  END IF;

  RETURN pg_catalog.jsonb_strip_nulls(pg_catalog.jsonb_build_object(
    'attemptId', p_attempt_id,
    'status', v_status,
    'correctAnswers', COALESCE(v_score, 0),
    'totalQuestions', COALESCE(v_total_questions, 0),
    'prizeEligible', v_prize_claim IS NOT NULL,
    'prizeClaim', v_prize_claim,
    'answerId', v_answer_id,
    'question', v_next_question,
    'error', CASE WHEN v_prize_product_id IS NOT NULL AND v_prize_claim IS NULL THEN 'stock_exhausted' ELSE NULL END
  ));
END;
$$;

REVOKE ALL ON FUNCTION public.submit_quiz_answer(uuid, uuid, text, timestamptz, text, jsonb, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.submit_quiz_answer(uuid, uuid, text, timestamptz, text, jsonb, uuid) TO authenticated, service_role;
-- Task 4: Storefront Checkout Integration RPC replacements

DROP FUNCTION IF EXISTS public.create_storefront_order(
  UUID, TEXT, TEXT, JSONB, TEXT, NUMERIC, NUMERIC, NUMERIC, TEXT, TEXT,
  TEXT, JSONB, TEXT, TEXT, JSONB, UUID, TEXT, TEXT, UUID
);
DROP FUNCTION IF EXISTS public.create_storefront_order(
  UUID, TEXT, TEXT, JSONB, TEXT, NUMERIC, NUMERIC, NUMERIC, TEXT, TEXT,
  TEXT, JSONB, TEXT, TEXT, JSONB, UUID, TEXT, TEXT, UUID, TEXT, NUMERIC
);
DROP FUNCTION IF EXISTS public.create_storefront_order(
  UUID, TEXT, TEXT, JSONB, TEXT, NUMERIC, NUMERIC, NUMERIC, TEXT, TEXT,
  TEXT, JSONB, TEXT, TEXT, JSONB, UUID, TEXT, TEXT, UUID, TEXT, NUMERIC, NUMERIC
);

DROP FUNCTION IF EXISTS public.create_storefront_order_with_savings(
  UUID, TEXT, TEXT, JSONB, TEXT, NUMERIC, NUMERIC, NUMERIC, TEXT, TEXT,
  TEXT, JSONB, TEXT, TEXT, JSONB, UUID, TEXT, TEXT, UUID, TEXT, NUMERIC,
  NUMERIC, UUID, NUMERIC, TEXT, TEXT, TEXT
);
DROP FUNCTION IF EXISTS private.create_storefront_order_with_savings(
  UUID, TEXT, TEXT, JSONB, TEXT, NUMERIC, NUMERIC, NUMERIC, TEXT, TEXT,
  TEXT, JSONB, TEXT, TEXT, JSONB, UUID, TEXT, TEXT, UUID, TEXT, NUMERIC,
  NUMERIC, UUID, NUMERIC, TEXT, TEXT, TEXT
);
DROP FUNCTION IF EXISTS public.create_storefront_order_with_quiz_voucher(
  UUID, TEXT, TEXT, JSONB, TEXT, NUMERIC, NUMERIC, NUMERIC, TEXT, TEXT,
  TEXT, JSONB, TEXT, TEXT, JSONB, UUID, TEXT, TEXT, UUID, TEXT, NUMERIC,
  NUMERIC, JSONB
);
DROP FUNCTION IF EXISTS private.create_storefront_order_with_quiz_voucher(
  UUID, TEXT, TEXT, JSONB, TEXT, NUMERIC, NUMERIC, NUMERIC, TEXT, TEXT,
  TEXT, JSONB, TEXT, TEXT, JSONB, UUID, TEXT, TEXT, UUID, TEXT, NUMERIC,
  NUMERIC, JSONB
);

CREATE OR REPLACE FUNCTION private.create_storefront_order(
  p_merchant_id UUID,
  p_customer_email TEXT,
  p_customer_name TEXT,
  p_items JSONB,
  p_customer_phone TEXT DEFAULT NULL,
  p_shipping_fee NUMERIC DEFAULT 0,
  p_discount_amount NUMERIC DEFAULT 0,
  p_tax_amount NUMERIC DEFAULT 0,
  p_payment_method TEXT DEFAULT 'card',
  p_payment_status TEXT DEFAULT 'unpaid',
  p_shipping_status TEXT DEFAULT 'pending',
  p_shipping_address JSONB DEFAULT NULL,
  p_source TEXT DEFAULT 'online_store',
  p_notes TEXT DEFAULT NULL,
  p_ad_tracking JSONB DEFAULT NULL,
  p_selected_quote_id UUID DEFAULT NULL,
  p_shipping_provider TEXT DEFAULT NULL,
  p_tracking_number TEXT DEFAULT NULL,
  p_user_id UUID DEFAULT NULL,
  p_tax_basis TEXT DEFAULT 'exclusive',
  p_gift_wrapping_fee NUMERIC DEFAULT 0,
  p_expected_total NUMERIC DEFAULT NULL,
  p_checkout_idempotency_key TEXT DEFAULT NULL,
  p_checkout_request_hash TEXT DEFAULT NULL
)
RETURNS TABLE (
  id UUID,
  order_number TEXT,
  tracking_token TEXT,
  subtotal NUMERIC,
  shipping_fee NUMERIC,
  discount_amount NUMERIC,
  tax_amount NUMERIC,
  total NUMERIC,
  customer_id UUID,
  customer_email TEXT,
  customer_name TEXT,
  customer_phone TEXT,
  payment_status TEXT,
  shipping_status TEXT,
  payment_method TEXT,
  shipping_address JSONB,
  merchant_id UUID,
  tax_basis TEXT,
  gift_wrapping_fee NUMERIC,
  idempotency_replayed BOOLEAN
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_order_id UUID;
  v_order_number TEXT;
  v_tracking_token TEXT;
  v_customer_id UUID;
  v_first_name TEXT;
  v_last_name TEXT;
  v_trimmed_customer_name TEXT := trim(p_customer_name);
  v_normalized_customer_email TEXT := lower(trim(p_customer_email));
  v_normalized_customer_phone TEXT := NULLIF(trim(COALESCE(p_customer_phone, '')), '');
  v_subtotal NUMERIC := 0;
  v_shipping_fee NUMERIC := COALESCE(p_shipping_fee, 0);
  v_discount_amount NUMERIC := GREATEST(COALESCE(p_discount_amount, 0), 0);
  v_tax_amount NUMERIC := COALESCE(p_tax_amount, 0);
  v_gift_wrapping_fee NUMERIC := COALESCE(p_gift_wrapping_fee, 0);
  v_tax_basis TEXT := lower(trim(COALESCE(p_tax_basis, 'exclusive')));
  v_merchant_vat_status TEXT;
  v_merchant_vat_rate NUMERIC;
  v_expected_tax NUMERIC;
  v_total NUMERIC := 0;
  v_payment_method TEXT := p_payment_method;
  v_payment_status TEXT := 'unpaid';
  v_shipping_status TEXT := p_shipping_status;
  v_shipping_address JSONB := p_shipping_address;
  v_user_id UUID := auth.uid();
  v_customer_record_phone TEXT;
  v_invalid_item_count INTEGER;
  v_invalid_quantity_count INTEGER;
  v_invalid_variant_count INTEGER;
  v_retry_attempt INT := 0;
  v_checkout_idempotency_key TEXT := NULLIF(trim(COALESCE(p_checkout_idempotency_key, '')), '');
  v_checkout_request_hash TEXT := NULLIF(trim(COALESCE(p_checkout_request_hash, '')), '');
  v_existing_order RECORD;
  v_idempotency_replayed BOOLEAN := false;
  stock_rec RECORD;
BEGIN
  IF p_merchant_id IS NULL THEN
    RAISE EXCEPTION 'merchant_id_required';
  END IF;

  IF p_customer_email IS NULL OR trim(p_customer_email) = '' THEN
    RAISE EXCEPTION 'customer_email_required';
  END IF;

  IF p_customer_name IS NULL OR trim(p_customer_name) = '' THEN
    RAISE EXCEPTION 'customer_name_required';
  END IF;

  IF p_items IS NULL OR jsonb_typeof(p_items) <> 'array' OR jsonb_array_length(p_items) = 0 THEN
    RAISE EXCEPTION 'items_required';
  END IF;

  IF public.is_agentic_checkout_context() THEN
    p_user_id := NULL;
  ELSIF v_user_id IS NOT NULL THEN
    IF p_user_id IS NULL THEN
      p_user_id := v_user_id;
    ELSIF p_user_id <> v_user_id THEN
      RAISE EXCEPTION 'user_id_mismatch';
    END IF;
  ELSIF p_user_id IS NOT NULL THEN
    RAISE EXCEPTION 'cannot_set_user_id_anonymously';
  END IF;

  IF p_payment_status IS NOT NULL AND trim(p_payment_status) <> '' THEN
    v_payment_status := lower(trim(p_payment_status));

    IF v_payment_status NOT IN ('unpaid', 'pending') THEN
      RAISE EXCEPTION 'invalid_payment_status';
    END IF;
  END IF;

  IF p_shipping_provider IS NOT NULL AND p_selected_quote_id IS NULL THEN
    RAISE EXCEPTION 'shipping_quote_required';
  END IF;

  IF v_tax_basis NOT IN ('exclusive', 'inclusive') THEN
    RAISE EXCEPTION 'invalid_tax_basis';
  END IF;

  v_tax_basis := 'exclusive';

  IF v_gift_wrapping_fee < 0 THEN
    RAISE EXCEPTION 'gift_wrapping_fee_negative';
  END IF;

  PERFORM 1 FROM public.merchants m WHERE m.id = p_merchant_id LIMIT 1;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'merchant_not_found';
  END IF;

  IF v_checkout_idempotency_key IS NOT NULL THEN
    IF v_checkout_request_hash IS NULL THEN
      RAISE EXCEPTION 'checkout_request_hash_required';
    END IF;

    PERFORM pg_advisory_xact_lock(
      hashtextextended(
        p_merchant_id::text || ':checkout:' || v_checkout_idempotency_key,
        0
      )
    );

    SELECT
      o.id,
      o.order_number,
      o.tracking_token,
      o.subtotal,
      o.shipping_fee,
      o.discount_amount,
      o.tax_amount,
      o.total,
      o.customer_id,
      o.customer_email,
      o.customer_name,
      o.customer_phone,
      o.payment_status,
      o.shipping_status,
      o.payment_method,
      o.shipping_address,
      o.merchant_id,
      o.tax_basis,
      o.gift_wrapping_fee,
      o.checkout_request_hash
    INTO v_existing_order
    FROM public.orders o
    WHERE o.merchant_id = p_merchant_id
      AND o.checkout_idempotency_key = v_checkout_idempotency_key
    LIMIT 1
    FOR UPDATE;

    IF FOUND THEN
      IF v_existing_order.checkout_request_hash IS DISTINCT FROM v_checkout_request_hash THEN
        RAISE EXCEPTION 'checkout_idempotency_conflict';
      END IF;

      IF v_existing_order.payment_status IN ('paid', 'bnpl_approved', 'refunded')
        OR COALESCE(v_existing_order.shipping_status, '') IN (
          'processing',
          'shipped',
          'out_for_delivery',
          'delivered',
          'completed',
          'cancelled'
        )
      THEN
        RAISE EXCEPTION 'order_not_reusable';
      END IF;

      UPDATE public.orders o
      SET
        payment_method = trim(p_payment_method),
        payment_status = v_payment_status,
        shipping_status = 'pending',
        updated_at = now()
      WHERE o.id = v_existing_order.id
      RETURNING
        o.id,
        o.order_number,
        o.tracking_token,
        o.subtotal,
        o.shipping_fee,
        o.discount_amount,
        o.tax_amount,
        o.total,
        o.customer_id,
        o.customer_email,
        o.customer_name,
        o.customer_phone,
        o.payment_status,
        o.shipping_status,
        o.payment_method,
        o.shipping_address,
        o.merchant_id,
        o.tax_basis,
        o.gift_wrapping_fee,
        o.checkout_request_hash
      INTO v_existing_order;

      RETURN QUERY
      SELECT
        v_existing_order.id,
        v_existing_order.order_number,
        v_existing_order.tracking_token,
        v_existing_order.subtotal,
        v_existing_order.shipping_fee,
        v_existing_order.discount_amount,
        v_existing_order.tax_amount,
        v_existing_order.total,
        v_existing_order.customer_id,
        v_existing_order.customer_email,
        v_existing_order.customer_name,
        v_existing_order.customer_phone,
        v_existing_order.payment_status,
        v_existing_order.shipping_status,
        v_existing_order.payment_method,
        v_existing_order.shipping_address,
        v_existing_order.merchant_id,
        v_existing_order.tax_basis,
        v_existing_order.gift_wrapping_fee,
        true;
      RETURN;
    END IF;
  END IF;

  v_first_name := split_part(v_trimmed_customer_name, ' ', 1);
  IF position(' ' in v_trimmed_customer_name) > 0 THEN
    v_last_name := trim(substring(v_trimmed_customer_name from position(' ' in v_trimmed_customer_name) + 1));
  ELSE
    v_last_name := NULL;
  END IF;

  DROP TABLE IF EXISTS pg_temp.tmp_storefront_order_items;

  CREATE TEMP TABLE tmp_storefront_order_items (
    product_id UUID,
    condition TEXT,
    image_url TEXT,
    variant_id UUID,
    variant_attributes JSONB,
    variant_name TEXT,
    quantity INTEGER,
    has_assurance BOOLEAN,
    assurance_fee NUMERIC,
    product_name TEXT,
    base_price NUMERIC,
    price_override NUMERIC,
    manage_stock BOOLEAN,
    variant_stock INTEGER
  ) ON COMMIT DROP;

  INSERT INTO tmp_storefront_order_items (
    product_id,
    condition,
    image_url,
    variant_id,
    variant_attributes,
    variant_name,
    quantity,
    has_assurance,
    assurance_fee,
    product_name,
    base_price,
    price_override,
    manage_stock,
    variant_stock
  )
  SELECT
    r.product_id,
    COALESCE(NULLIF(trim(r.condition), ''), p.condition),
    r.image_url,
    r.variant_id,
    r.variant_attributes,
    COALESCE(
      public.format_order_item_variant_name(v.attributes),
      public.format_order_item_variant_name(r.variant_attributes)
    ),
    r.quantity,
    r.has_assurance,
    r.assurance_fee,
    p.name,
    p.price,
    v.price_override,
    p.manage_stock,
    v.stock_quantity
  FROM (
    SELECT
      COALESCE(
        NULLIF(item->>'product_id','')::uuid,
        NULLIF(item->>'productId','')::uuid,
        NULLIF(item->>'id','')::uuid
      ) AS product_id,
      NULLIF(trim(item->>'condition'), '') AS condition,
      NULLIF(trim(COALESCE(item->>'image_url', item->>'imageUrl')), '') AS image_url,
      NULLIF(item->>'variant_id','')::uuid AS variant_id,
      COALESCE(item->'variant_attributes', item->'variantAttributes') AS variant_attributes,
      (item->>'quantity')::int AS quantity,
      COALESCE((item->>'has_assurance')::boolean, false) AS has_assurance,
      GREATEST(COALESCE((item->>'assurance_fee')::numeric, 0), 0) AS assurance_fee
    FROM jsonb_array_elements(p_items) AS item
  ) AS r
  LEFT JOIN public.products p ON p.id = r.product_id
    AND p.merchant_id = p_merchant_id
    AND p.status = 'active'
  LEFT JOIN public.product_variants v
    ON r.variant_id IS NOT NULL
    AND v.id = r.variant_id
    AND v.product_id = p.id;

  SELECT
    COUNT(*) FILTER (WHERE t.product_id IS NULL OR t.product_name IS NULL) AS invalid_item_count,
    COUNT(*) FILTER (WHERE t.quantity IS NULL OR t.quantity <= 0) AS invalid_quantity_count,
    COUNT(*) FILTER (
      WHERE t.variant_id IS NOT NULL AND t.variant_stock IS NULL
    ) AS invalid_variant_count
  INTO v_invalid_item_count, v_invalid_quantity_count, v_invalid_variant_count
  FROM tmp_storefront_order_items t;

  IF v_invalid_item_count > 0 THEN
    RAISE EXCEPTION 'invalid_items';
  END IF;

  IF v_invalid_quantity_count > 0 THEN
    RAISE EXCEPTION 'invalid_quantity';
  END IF;

  IF v_invalid_variant_count > 0 THEN
    RAISE EXCEPTION 'invalid_variant';
  END IF;

  SELECT COALESCE(SUM((COALESCE(t.price_override, t.base_price) * t.quantity) + t.assurance_fee), 0)
    INTO v_subtotal
  FROM tmp_storefront_order_items t;

  v_shipping_fee := GREATEST(v_shipping_fee, 0);
  v_tax_amount := GREATEST(v_tax_amount, 0);

  SELECT
    COALESCE(m.vat_registration_status, 'not_registered'),
    COALESCE(m.vat_rate, 7.5)
    INTO v_merchant_vat_status, v_merchant_vat_rate
  FROM public.merchants m
  WHERE m.id = p_merchant_id;

  IF v_merchant_vat_status = 'registered' THEN
    IF v_tax_basis = 'exclusive' THEN
      SELECT COALESCE(SUM(
        CASE
          WHEN COALESCE(p.vat_category_code, 'S') = 'S' THEN
            ROUND(
              ROUND(
                t.quantity * COALESCE(t.price_override, t.base_price),
                2
              )
              * COALESCE(p.vat_rate, 7.5) / 100,
              2
            )
          ELSE 0
        END
      ), 0)
        INTO v_expected_tax
      FROM tmp_storefront_order_items t
      JOIN public.products p ON p.id = t.product_id;

      IF ABS(v_tax_amount - v_expected_tax) > 1 THEN
        RAISE EXCEPTION 'tax_amount_mismatch'
          USING DETAIL = format(
            'expected=%s got=%s subtotal=%s vat_rate=%s',
            v_expected_tax, v_tax_amount, v_subtotal, v_merchant_vat_rate
          );
      END IF;
    END IF;
  ELSE
    IF v_tax_amount > 1 THEN
      RAISE EXCEPTION 'tax_amount_must_be_zero_for_non_vat_merchant'
        USING DETAIL = format('got=%s', v_tax_amount);
    END IF;
    v_tax_amount := 0;
  END IF;

  IF v_tax_basis = 'exclusive' THEN
    v_total :=
      v_subtotal
      + v_shipping_fee
      + v_gift_wrapping_fee
      + v_tax_amount
      - v_discount_amount;
  ELSE
    v_total :=
      v_subtotal
      + v_shipping_fee
      + v_gift_wrapping_fee
      - v_discount_amount;
  END IF;

  IF v_total < 0 THEN
    v_total := 0;
  END IF;

  IF p_expected_total IS NOT NULL
    AND ABS(v_total - p_expected_total) > 1
  THEN
    RAISE EXCEPTION 'order_total_mismatch'
      USING DETAIL = format(
        'expected=%s computed=%s subtotal=%s shipping=%s gift=%s tax=%s discount=%s basis=%s',
        p_expected_total, v_total, v_subtotal, v_shipping_fee,
        v_gift_wrapping_fee, v_tax_amount, v_discount_amount, v_tax_basis
      );
  END IF;

  IF v_normalized_customer_phone IS NOT NULL THEN
    PERFORM pg_advisory_xact_lock(
      hashtext(p_merchant_id::text),
      hashtext(v_normalized_customer_phone)
    );
  END IF;

  IF p_user_id IS NOT NULL THEN
    PERFORM pg_advisory_xact_lock(
      hashtextextended(p_merchant_id::text || ':' || p_user_id::text, 0)
    );
  END IF;
  PERFORM pg_advisory_xact_lock(
    hashtextextended(
      p_merchant_id::text || ':' || v_normalized_customer_email, 1
    )
  );

  IF p_user_id IS NOT NULL THEN
    SELECT c.id
      INTO v_customer_id
    FROM public.customers c
    WHERE c.merchant_id = p_merchant_id
      AND c.user_id = p_user_id
    ORDER BY c.id
    LIMIT 1
    FOR UPDATE;
  END IF;

  -- Δ-97 / Codex P1: phone-only fallback is restricted to GUEST
  -- checkouts (p_user_id IS NULL). Phone numbers are recycled by
  -- telcos (NIST SP 800-63B AAL1); auto-claiming an existing
  -- customer row from an authed checkout based on phone alone
  -- would let one auth user inherit a stranger's order history.
  IF v_customer_id IS NULL
    AND v_normalized_customer_phone IS NOT NULL
    AND p_user_id IS NULL
  THEN
    SELECT c.id
      INTO v_customer_id
    FROM public.customers c
    WHERE c.merchant_id = p_merchant_id
      AND c.phone = v_normalized_customer_phone
      AND c.user_id IS NULL
    ORDER BY c.id
    LIMIT 1
    FOR UPDATE;
  END IF;

  IF v_customer_id IS NULL THEN
    SELECT c.id
      INTO v_customer_id
    FROM public.customers c
    WHERE c.merchant_id = p_merchant_id
      AND lower(c.email) = v_normalized_customer_email
    ORDER BY c.id
    LIMIT 1
    FOR UPDATE;
  END IF;

  IF v_customer_id IS NOT NULL THEN
    UPDATE public.customers c
    SET
      email = CASE
        WHEN (c.email IS NULL OR c.email = '')
          AND NOT EXISTS (
            SELECT 1
            FROM public.customers existing_email
            WHERE existing_email.merchant_id = p_merchant_id
              AND lower(existing_email.email) = v_normalized_customer_email
              AND existing_email.id <> c.id
          )
          THEN v_normalized_customer_email
        ELSE c.email
      END,
      phone = CASE
        WHEN v_normalized_customer_phone IS NULL THEN c.phone
        WHEN c.phone = v_normalized_customer_phone THEN c.phone
        WHEN NOT EXISTS (
          SELECT 1
          FROM public.customers existing_phone
          WHERE existing_phone.merchant_id = p_merchant_id
            AND existing_phone.phone = v_normalized_customer_phone
            AND existing_phone.id <> c.id
        )
          THEN v_normalized_customer_phone
        ELSE c.phone
      END,
      user_id = CASE
        WHEN c.user_id IS NULL THEN p_user_id
        ELSE c.user_id
      END,
      first_name = COALESCE(c.first_name, v_first_name),
      last_name = COALESCE(c.last_name, v_last_name),
      updated_at = now()
    WHERE c.id = v_customer_id
    RETURNING c.id INTO v_customer_id;
  ELSE
    v_customer_record_phone := v_normalized_customer_phone;

    IF v_normalized_customer_phone IS NOT NULL
      AND EXISTS (
        SELECT 1
        FROM public.customers existing_phone
        WHERE existing_phone.merchant_id = p_merchant_id
          AND existing_phone.phone = v_normalized_customer_phone
      )
    THEN
      v_customer_record_phone := NULL;
    END IF;

    v_retry_attempt := 0;
    LOOP
      v_retry_attempt := v_retry_attempt + 1;
      IF v_retry_attempt > 3 THEN
        RAISE EXCEPTION 'customer_upsert_failed'
          USING HINT = 'Exhausted 3 retry attempts on customer upsert';
      END IF;

      BEGIN
        INSERT INTO public.customers (
          merchant_id,
          email,
          first_name,
          last_name,
          phone,
          user_id
        )
        VALUES (
          p_merchant_id,
          v_normalized_customer_email,
          v_first_name,
          v_last_name,
          v_customer_record_phone,
          p_user_id
        )
        RETURNING id INTO v_customer_id;
        EXIT;
      EXCEPTION WHEN unique_violation THEN
        v_customer_id := NULL;
        SELECT c.id INTO v_customer_id
        FROM public.customers c
        WHERE c.merchant_id = p_merchant_id
          AND (
            (p_user_id IS NOT NULL AND c.user_id = p_user_id)
            OR lower(c.email) = v_normalized_customer_email
          )
        ORDER BY
          CASE
            WHEN p_user_id IS NOT NULL AND c.user_id = p_user_id THEN 0
            ELSE 1
          END,
          c.id
        LIMIT 1;

        IF v_customer_id IS NOT NULL THEN
          UPDATE public.customers c
          SET
            phone = COALESCE(c.phone, v_customer_record_phone),
            user_id = COALESCE(c.user_id, p_user_id),
            first_name = COALESCE(c.first_name, v_first_name),
            last_name = COALESCE(c.last_name, v_last_name),
            email = COALESCE(NULLIF(c.email, ''), v_normalized_customer_email),
            updated_at = now()
          WHERE c.id = v_customer_id;
          EXIT;
        END IF;
      END;
    END LOOP;
  END IF;

  INSERT INTO public.orders (
    merchant_id,
    customer_id,
    customer_email,
    customer_name,
    customer_phone,
    subtotal,
    shipping_fee,
    discount_amount,
    tax_amount,
    total,
    payment_method,
    payment_status,
    shipping_status,
    shipping_address,
    source,
    notes,
    ad_tracking,
    selected_quote_id,
    shipping_provider,
    tracking_number,
    tax_basis,
    gift_wrapping_fee,
    checkout_idempotency_key,
    checkout_request_hash
  )
  VALUES (
    p_merchant_id,
    v_customer_id,
    v_normalized_customer_email,
    v_trimmed_customer_name,
    v_normalized_customer_phone,
    v_subtotal,
    v_shipping_fee,
    v_discount_amount,
    v_tax_amount,
    v_total,
    v_payment_method,
    v_payment_status,
    v_shipping_status,
    v_shipping_address,
    p_source,
    p_notes,
    p_ad_tracking,
    p_selected_quote_id,
    p_shipping_provider,
    p_tracking_number,
    v_tax_basis,
    v_gift_wrapping_fee,
    v_checkout_idempotency_key,
    v_checkout_request_hash
  )
  RETURNING
    orders.id,
    orders.order_number,
    orders.tracking_token,
    orders.payment_method,
    orders.shipping_status,
    orders.shipping_address
  INTO
    v_order_id,
    v_order_number,
    v_tracking_token,
    v_payment_method,
    v_shipping_status,
    v_shipping_address;

  FOR stock_rec IN
    SELECT
      t.product_id,
      t.variant_id,
      SUM(t.quantity)::INTEGER AS total_quantity,
      BOOL_OR(t.manage_stock) AS manage_stock
    FROM tmp_storefront_order_items t
    GROUP BY t.product_id, t.variant_id
    ORDER BY t.product_id, t.variant_id
  LOOP
    IF stock_rec.manage_stock THEN
      -- Verify tracking policy to bypass legacy decrement for serialized inventory
      DECLARE
        v_prod_policy TEXT;
        v_var_policy TEXT;
        v_effective_policy TEXT;
        v_variant_id UUID := stock_rec.variant_id;
      BEGIN
        SELECT inventory_tracking_policy INTO v_prod_policy
        FROM public.products
        WHERE id = stock_rec.product_id;

        IF v_variant_id IS NOT NULL THEN
          SELECT inventory_tracking_policy INTO v_var_policy
          FROM public.product_variants
          WHERE id = v_variant_id;
        ELSE
          v_var_policy := 'inherit';
        END IF;

        v_effective_policy := public.get_effective_inventory_tracking_policy(v_prod_policy, v_var_policy);

        IF v_effective_policy IN ('serialized_strict', 'serialized_then_unlimited') THEN
          -- Bypassed legacy stock decrement for serialized inventory tracking
          CONTINUE;
        END IF;
      END;

      IF stock_rec.variant_id IS NOT NULL THEN
        UPDATE public.product_variants
        SET stock_quantity = stock_quantity - stock_rec.total_quantity
        WHERE product_variants.id = stock_rec.variant_id
          AND stock_quantity >= stock_rec.total_quantity;

        IF NOT FOUND THEN
          RAISE EXCEPTION 'insufficient_variant_stock';
        END IF;
      ELSE
        UPDATE public.products
        SET stock_quantity = stock_quantity - stock_rec.total_quantity
        WHERE public.products.id = stock_rec.product_id
          AND stock_quantity >= stock_rec.total_quantity;

        IF NOT FOUND THEN
          RAISE EXCEPTION 'insufficient_stock';
        END IF;
      END IF;
    END IF;
  END LOOP;

  INSERT INTO public.order_items (
    order_id,
    product_id,
    condition,
    image_url,
    variant_id,
    variant_name,
    name,
    price,
    quantity,
    has_assurance,
    assurance_fee,
    variant_attributes
  )
  SELECT
    v_order_id,
    t.product_id,
    t.condition,
    t.image_url,
    t.variant_id,
    t.variant_name,
    t.product_name,
    COALESCE(t.price_override, t.base_price),
    t.quantity,
    t.has_assurance,
    t.assurance_fee,
    COALESCE(t.variant_attributes, '{}'::jsonb)
  FROM tmp_storefront_order_items t;

  -- Claim serialized units for newly created order items
  DECLARE
    v_item RECORD;
  BEGIN
    FOR v_item IN
      SELECT oi.id, oi.product_id, oi.variant_id
      FROM public.order_items oi
      WHERE oi.order_id = v_order_id
    LOOP
      PERFORM private.claim_variant_inventory_units_for_order_item_internal(
        p_merchant_id,
        v_order_id,
        v_item.id
      );
    END LOOP;
  END;

  SELECT o.total, o.tax_amount
    INTO v_total, v_tax_amount
  FROM public.orders o
  WHERE o.id = v_order_id;

  RETURN QUERY
  SELECT
    v_order_id,
    v_order_number,
    v_tracking_token,
    v_subtotal,
    v_shipping_fee,
    v_discount_amount,
    v_tax_amount,
    v_total,
    v_customer_id,
    v_normalized_customer_email,
    v_trimmed_customer_name,
    v_normalized_customer_phone,
    v_payment_status,
    v_shipping_status,
    v_payment_method,
    v_shipping_address,
    p_merchant_id,
    v_tax_basis,
    v_gift_wrapping_fee,
    v_idempotency_replayed;
END;
$$;

CREATE OR REPLACE FUNCTION public.create_storefront_order(
  p_merchant_id UUID,
  p_customer_email TEXT,
  p_customer_name TEXT,
  p_items JSONB,
  p_customer_phone TEXT DEFAULT NULL,
  p_shipping_fee NUMERIC DEFAULT 0,
  p_discount_amount NUMERIC DEFAULT 0,
  p_tax_amount NUMERIC DEFAULT 0,
  p_payment_method TEXT DEFAULT 'card',
  p_payment_status TEXT DEFAULT 'unpaid',
  p_shipping_status TEXT DEFAULT 'pending',
  p_shipping_address JSONB DEFAULT NULL,
  p_source TEXT DEFAULT 'online_store',
  p_notes TEXT DEFAULT NULL,
  p_ad_tracking JSONB DEFAULT NULL,
  p_selected_quote_id UUID DEFAULT NULL,
  p_shipping_provider TEXT DEFAULT NULL,
  p_tracking_number TEXT DEFAULT NULL,
  p_user_id UUID DEFAULT NULL,
  p_tax_basis TEXT DEFAULT 'exclusive',
  p_gift_wrapping_fee NUMERIC DEFAULT 0,
  p_expected_total NUMERIC DEFAULT NULL,
  p_checkout_idempotency_key TEXT DEFAULT NULL,
  p_checkout_request_hash TEXT DEFAULT NULL
)
RETURNS TABLE (
  id UUID,
  order_number TEXT,
  tracking_token TEXT,
  subtotal NUMERIC,
  shipping_fee NUMERIC,
  discount_amount NUMERIC,
  tax_amount NUMERIC,
  total NUMERIC,
  customer_id UUID,
  customer_email TEXT,
  customer_name TEXT,
  customer_phone TEXT,
  payment_status TEXT,
  shipping_status TEXT,
  payment_method TEXT,
  shipping_address JSONB,
  merchant_id UUID,
  tax_basis TEXT,
  gift_wrapping_fee NUMERIC,
  idempotency_replayed BOOLEAN
)
LANGUAGE plpgsql
SECURITY INVOKER
AS $$
BEGIN
  RETURN QUERY
  SELECT * FROM private.create_storefront_order(
    p_merchant_id,
    p_customer_email,
    p_customer_name,
    p_items,
    p_customer_phone,
    p_shipping_fee,
    p_discount_amount,
    p_tax_amount,
    p_payment_method,
    p_payment_status,
    p_shipping_status,
    p_shipping_address,
    p_source,
    p_notes,
    p_ad_tracking,
    p_selected_quote_id,
    p_shipping_provider,
    p_tracking_number,
    p_user_id,
    p_tax_basis,
    p_gift_wrapping_fee,
    p_expected_total,
    p_checkout_idempotency_key,
    p_checkout_request_hash
  );
END;
$$;

REVOKE ALL ON FUNCTION public.create_storefront_order(UUID, TEXT, TEXT, JSONB, TEXT, NUMERIC, NUMERIC, NUMERIC, TEXT, TEXT, TEXT, JSONB, TEXT, TEXT, JSONB, UUID, TEXT, TEXT, UUID, TEXT, NUMERIC, NUMERIC, TEXT, TEXT) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.create_storefront_order(UUID, TEXT, TEXT, JSONB, TEXT, NUMERIC, NUMERIC, NUMERIC, TEXT, TEXT, TEXT, JSONB, TEXT, TEXT, JSONB, UUID, TEXT, TEXT, UUID, TEXT, NUMERIC, NUMERIC, TEXT, TEXT) TO anon, authenticated, service_role;
REVOKE ALL ON FUNCTION private.create_storefront_order(UUID, TEXT, TEXT, JSONB, TEXT, NUMERIC, NUMERIC, NUMERIC, TEXT, TEXT, TEXT, JSONB, TEXT, TEXT, JSONB, UUID, TEXT, TEXT, UUID, TEXT, NUMERIC, NUMERIC, TEXT, TEXT) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION private.create_storefront_order(UUID, TEXT, TEXT, JSONB, TEXT, NUMERIC, NUMERIC, NUMERIC, TEXT, TEXT, TEXT, JSONB, TEXT, TEXT, JSONB, UUID, TEXT, TEXT, UUID, TEXT, NUMERIC, NUMERIC, TEXT, TEXT) TO anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION private.prepare_storefront_order_for_checkout(
  p_order_id UUID,
  p_merchant_id UUID,
  p_tracking_token TEXT,
  p_customer_email TEXT,
  p_payment_method TEXT,
  p_shipping_provider TEXT DEFAULT NULL,
  p_selected_quote_id UUID DEFAULT NULL
)
RETURNS TABLE (
  id UUID,
  order_number TEXT,
  tracking_token TEXT,
  subtotal NUMERIC,
  shipping_fee NUMERIC,
  total NUMERIC,
  currency TEXT,
  payment_method TEXT,
  payment_status TEXT,
  shipping_status TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_order record;
  v_effective_payment_status TEXT;
  v_item record;
  v_has_reserved boolean;
  v_is_pod boolean;
BEGIN
  IF p_order_id IS NULL THEN
    RAISE EXCEPTION 'order_id_required';
  END IF;

  IF p_merchant_id IS NULL THEN
    RAISE EXCEPTION 'merchant_id_required';
  END IF;

  IF p_tracking_token IS NULL OR trim(p_tracking_token) = '' THEN
    RAISE EXCEPTION 'unauthorized';
  END IF;

  IF p_customer_email IS NULL OR trim(p_customer_email) = '' THEN
    RAISE EXCEPTION 'email_required';
  END IF;

  IF p_payment_method IS NULL OR trim(p_payment_method) = '' THEN
    RAISE EXCEPTION 'payment_method_required';
  END IF;

  SELECT
    o.id,
    o.merchant_id,
    o.order_number,
    o.tracking_token,
    o.customer_email,
    o.subtotal,
    o.shipping_fee,
    o.total,
    o.currency,
    o.payment_method,
    o.payment_status,
    o.shipping_status
  INTO v_order
  FROM public.orders o
  WHERE o.id = p_order_id
  FOR UPDATE;

  IF v_order.id IS NULL THEN
    RAISE EXCEPTION 'order_not_found';
  END IF;

  IF v_order.merchant_id <> p_merchant_id THEN
    RAISE EXCEPTION 'merchant_mismatch';
  END IF;

  IF v_order.tracking_token <> trim(p_tracking_token) THEN
    RAISE EXCEPTION 'unauthorized';
  END IF;

  IF lower(trim(v_order.customer_email)) <> lower(trim(p_customer_email)) THEN
    RAISE EXCEPTION 'email_mismatch';
  END IF;

  IF v_order.payment_status IN ('paid', 'bnpl_approved', 'refunded') THEN
    RAISE EXCEPTION 'order_not_reusable';
  END IF;

  IF coalesce(v_order.shipping_status, '') IN (
    'processing',
    'shipped',
    'out_for_delivery',
    'delivered',
    'completed',
    'cancelled'
  ) THEN
    RAISE EXCEPTION 'order_not_reusable';
  END IF;

  v_effective_payment_status := CASE
    WHEN p_payment_method IN ('pod', 'pay_on_delivery') THEN 'pending'
    ELSE 'unpaid'
  END;

  IF p_shipping_provider IS NOT NULL AND p_selected_quote_id IS NULL THEN
    RAISE EXCEPTION 'shipping_quote_required';
  END IF;

  -- Update order details first
  UPDATE public.orders o
  SET
    payment_method = trim(p_payment_method),
    payment_status = v_effective_payment_status,
    shipping_status = 'pending',
    shipping_provider = COALESCE(p_shipping_provider, o.shipping_provider),
    selected_quote_id = COALESCE(p_selected_quote_id, o.selected_quote_id),
    updated_at = now()
  WHERE o.id = p_order_id;

  -- Process serialized inventory claims / updates
  v_is_pod := lower(trim(p_payment_method)) IN ('pod', 'pay_on_delivery');

  FOR v_item IN
    SELECT oi.id, oi.product_id, oi.variant_id, oi.quantity
    FROM public.order_items oi
    WHERE oi.order_id = p_order_id
    FOR UPDATE
  LOOP
    SELECT EXISTS (
      SELECT 1 FROM public.variant_inventory
      WHERE order_item_id = v_item.id AND status = 'reserved'
    ) INTO v_has_reserved;

    IF v_has_reserved THEN
      IF v_is_pod THEN
        UPDATE public.variant_inventory
        SET reservation_expires_at = NULL,
            updated_at = now()
        WHERE order_item_id = v_item.id;
      ELSE
        UPDATE public.variant_inventory
        SET reservation_expires_at = now() + interval '2 hours',
            updated_at = now()
        WHERE order_item_id = v_item.id;
      END IF;

      -- Update the order_items.fulfillment_data JSON
      DECLARE
        v_units_json jsonb;
        v_max_expires timestamp with time zone;
        v_reserved_count integer;
      BEGIN
        SELECT jsonb_agg(
          jsonb_build_object(
            'inventoryUnitId', vi.id,
            'identifierType', vi.identifier_type,
            'identifierValue', vi.identifier_value
          )
        ) INTO v_units_json
        FROM public.variant_inventory vi
        WHERE vi.order_item_id = v_item.id;

        SELECT max(reservation_expires_at) INTO v_max_expires
        FROM public.variant_inventory vi
        WHERE vi.order_item_id = v_item.id;

        SELECT count(*)::integer INTO v_reserved_count
        FROM public.variant_inventory
        WHERE order_item_id = v_item.id;

        UPDATE public.order_items
        SET fulfillment_data = jsonb_build_object(
          'source', 'merchant_stock',
          'reservationExpiresAt', to_jsonb(v_max_expires),
          'inventoryUnits', COALESCE(v_units_json, '[]'::jsonb),
          'missingUnitCount', GREATEST(v_item.quantity - v_reserved_count, 0)
        )
        WHERE id = v_item.id;
      END;
    ELSE
      -- Reclaim units
      PERFORM private.claim_variant_inventory_units_for_order_item_internal(
        p_merchant_id,
        p_order_id,
        v_item.id
      );
    END IF;
  END LOOP;

  -- Mirror for single-unit orders
  DECLARE
    v_total_items integer;
    v_total_qty integer;
    v_fulfillment_data jsonb;
  BEGIN
    SELECT count(*), sum(quantity) INTO v_total_items, v_total_qty FROM public.order_items WHERE order_id = p_order_id;
    IF v_total_items = 1 AND v_total_qty = 1 THEN
      SELECT fulfillment_data INTO v_fulfillment_data FROM public.order_items WHERE order_id = p_order_id LIMIT 1;
      UPDATE public.orders SET fulfillment_details = v_fulfillment_data WHERE id = p_order_id;
    END IF;
  END;

  RETURN QUERY
  SELECT
    o.id,
    o.order_number,
    o.tracking_token,
    o.subtotal,
    o.shipping_fee,
    o.total,
    o.currency,
    o.payment_method,
    o.payment_status,
    o.shipping_status
  FROM public.orders o
  WHERE o.id = p_order_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.prepare_storefront_order_for_checkout(
  p_order_id UUID,
  p_merchant_id UUID,
  p_tracking_token TEXT,
  p_customer_email TEXT,
  p_payment_method TEXT,
  p_shipping_provider TEXT DEFAULT NULL,
  p_selected_quote_id UUID DEFAULT NULL
)
RETURNS TABLE (
  id UUID,
  order_number TEXT,
  tracking_token TEXT,
  subtotal NUMERIC,
  shipping_fee NUMERIC,
  total NUMERIC,
  currency TEXT,
  payment_method TEXT,
  payment_status TEXT,
  shipping_status TEXT
)
LANGUAGE plpgsql
SECURITY INVOKER
AS $$
BEGIN
  RETURN QUERY
  SELECT * FROM private.prepare_storefront_order_for_checkout(
    p_order_id,
    p_merchant_id,
    p_tracking_token,
    p_customer_email,
    p_payment_method,
    p_shipping_provider,
    p_selected_quote_id
  );
END;
$$;

REVOKE ALL ON FUNCTION public.prepare_storefront_order_for_checkout(UUID, UUID, TEXT, TEXT, TEXT, TEXT, UUID) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.prepare_storefront_order_for_checkout(UUID, UUID, TEXT, TEXT, TEXT, TEXT, UUID) TO anon, authenticated, service_role;
REVOKE ALL ON FUNCTION private.prepare_storefront_order_for_checkout(UUID, UUID, TEXT, TEXT, TEXT, TEXT, UUID) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION private.prepare_storefront_order_for_checkout(UUID, UUID, TEXT, TEXT, TEXT, TEXT, UUID) TO anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION private.create_storefront_order_with_savings(
  p_merchant_id uuid,
  p_customer_email text,
  p_customer_name text,
  p_items jsonb,
  p_customer_phone text DEFAULT NULL,
  p_shipping_fee numeric DEFAULT 0,
  p_discount_amount numeric DEFAULT 0,
  p_tax_amount numeric DEFAULT 0,
  p_payment_method text DEFAULT 'card',
  p_payment_status text DEFAULT 'unpaid',
  p_shipping_status text DEFAULT 'pending',
  p_shipping_address jsonb DEFAULT NULL,
  p_source text DEFAULT 'online_store',
  p_notes text DEFAULT NULL,
  p_ad_tracking jsonb DEFAULT NULL,
  p_selected_quote_id uuid DEFAULT NULL,
  p_shipping_provider text DEFAULT NULL,
  p_tracking_number text DEFAULT NULL,
  p_user_id uuid DEFAULT NULL,
  p_tax_basis text DEFAULT 'exclusive',
  p_gift_wrapping_fee numeric DEFAULT 0,
  p_expected_total numeric DEFAULT NULL,
  p_savings_goal_id uuid DEFAULT NULL,
  p_savings_amount numeric DEFAULT NULL,
  p_savings_idempotency_key text DEFAULT NULL,
  p_checkout_idempotency_key text DEFAULT NULL,
  p_checkout_request_hash text DEFAULT NULL
)
RETURNS TABLE (
  id uuid,
  order_number text,
  tracking_token text,
  subtotal numeric,
  shipping_fee numeric,
  discount_amount numeric,
  tax_amount numeric,
  total numeric,
  customer_id uuid,
  customer_email text,
  customer_name text,
  customer_phone text,
  payment_status text,
  shipping_status text,
  payment_method text,
  shipping_address jsonb,
  merchant_id uuid,
  tax_basis text,
  gift_wrapping_fee numeric,
  savings_redemption_success boolean,
  savings_redeemed_amount numeric,
  savings_goal_id uuid,
  savings_redemption_id uuid,
  savings_goal_status text,
  idempotency_replayed boolean
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_order record;
  v_savings record;
BEGIN
  IF p_savings_goal_id IS NULL THEN
    RAISE EXCEPTION 'create_storefront_order_with_savings p_savings_goal_id is required'
      USING ERRCODE = '22023';
  END IF;

  IF p_savings_amount IS NULL OR p_savings_amount <= 0 THEN
    RAISE EXCEPTION 'create_storefront_order_with_savings p_savings_amount must be greater than zero'
      USING ERRCODE = '22023';
  END IF;

  SELECT
    created.id,
    created.order_number,
    created.tracking_token,
    created.subtotal,
    created.shipping_fee,
    created.discount_amount,
    created.tax_amount,
    created.total,
    created.customer_id,
    created.customer_email,
    created.customer_name,
    created.customer_phone,
    created.payment_status,
    created.shipping_status,
    created.payment_method,
    created.shipping_address,
    created.merchant_id,
    created.tax_basis,
    created.gift_wrapping_fee,
    created.idempotency_replayed
  INTO v_order
  FROM private.create_storefront_order(
    p_merchant_id => p_merchant_id,
    p_customer_email => p_customer_email,
    p_customer_name => p_customer_name,
    p_items => p_items,
    p_customer_phone => p_customer_phone,
    p_shipping_fee => p_shipping_fee,
    p_discount_amount => p_discount_amount,
    p_tax_amount => p_tax_amount,
    p_payment_method => p_payment_method,
    p_payment_status => p_payment_status,
    p_shipping_status => p_shipping_status,
    p_shipping_address => p_shipping_address,
    p_source => p_source,
    p_notes => p_notes,
    p_ad_tracking => p_ad_tracking,
    p_selected_quote_id => p_selected_quote_id,
    p_shipping_provider => p_shipping_provider,
    p_tracking_number => p_tracking_number,
    p_user_id => p_user_id,
    p_tax_basis => p_tax_basis,
    p_gift_wrapping_fee => p_gift_wrapping_fee,
    p_expected_total => p_expected_total,
    p_checkout_idempotency_key => p_checkout_idempotency_key,
    p_checkout_request_hash => p_checkout_request_hash
  ) AS created;

  IF v_order.id IS NULL THEN
    RAISE EXCEPTION 'create_storefront_order_with_savings order creation failed'
      USING ERRCODE = 'P0001';
  END IF;

  SELECT
    redeemed.success,
    redeemed.redeemed_amount,
    redeemed.remaining_goal_amount,
    redeemed.goal_id,
    redeemed.redemption_id,
    redeemed.goal_status
  INTO v_savings
  FROM public.redeem_savings_for_order(
    v_order.customer_id,
    p_merchant_id,
    v_order.id,
    p_savings_goal_id,
    LEAST(p_savings_amount, v_order.total),
    COALESCE(
      NULLIF(btrim(p_savings_idempotency_key), ''),
      'savings:' || v_order.id::text || ':' || p_savings_goal_id::text
    )
  ) AS redeemed;

  IF v_savings.success IS NOT TRUE THEN
    RAISE EXCEPTION 'savings_redemption_failed'
      USING ERRCODE = 'P0001';
  END IF;

  RETURN QUERY
  SELECT
    v_order.id,
    v_order.order_number,
    v_order.tracking_token,
    v_order.subtotal,
    v_order.shipping_fee,
    v_order.discount_amount,
    v_order.tax_amount,
    v_order.total,
    v_order.customer_id,
    v_order.customer_email,
    v_order.customer_name,
    v_order.customer_phone,
    v_order.payment_status,
    v_order.shipping_status,
    v_order.payment_method,
    v_order.shipping_address,
    v_order.merchant_id,
    v_order.tax_basis,
    v_order.gift_wrapping_fee,
    v_savings.success,
    v_savings.redeemed_amount,
    v_savings.goal_id,
    v_savings.redemption_id,
    v_savings.goal_status,
    v_order.idempotency_replayed;
END;
$$;

CREATE OR REPLACE FUNCTION public.create_storefront_order_with_savings(
  p_merchant_id uuid,
  p_customer_email text,
  p_customer_name text,
  p_items jsonb,
  p_customer_phone text DEFAULT NULL,
  p_shipping_fee numeric DEFAULT 0,
  p_discount_amount numeric DEFAULT 0,
  p_tax_amount numeric DEFAULT 0,
  p_payment_method text DEFAULT 'card',
  p_payment_status text DEFAULT 'unpaid',
  p_shipping_status text DEFAULT 'pending',
  p_shipping_address jsonb DEFAULT NULL,
  p_source text DEFAULT 'online_store',
  p_notes text DEFAULT NULL,
  p_ad_tracking jsonb DEFAULT NULL,
  p_selected_quote_id uuid DEFAULT NULL,
  p_shipping_provider text DEFAULT NULL,
  p_tracking_number text DEFAULT NULL,
  p_user_id uuid DEFAULT NULL,
  p_tax_basis text DEFAULT 'exclusive',
  p_gift_wrapping_fee numeric DEFAULT 0,
  p_expected_total numeric DEFAULT NULL,
  p_savings_goal_id uuid DEFAULT NULL,
  p_savings_amount numeric DEFAULT NULL,
  p_savings_idempotency_key text DEFAULT NULL,
  p_checkout_idempotency_key text DEFAULT NULL,
  p_checkout_request_hash text DEFAULT NULL
)
RETURNS TABLE (
  id uuid,
  order_number text,
  tracking_token text,
  subtotal numeric,
  shipping_fee numeric,
  discount_amount numeric,
  tax_amount numeric,
  total numeric,
  customer_id uuid,
  customer_email text,
  customer_name text,
  customer_phone text,
  payment_status text,
  shipping_status text,
  payment_method text,
  shipping_address jsonb,
  merchant_id uuid,
  tax_basis text,
  gift_wrapping_fee numeric,
  savings_redemption_success boolean,
  savings_redeemed_amount numeric,
  savings_goal_id uuid,
  savings_redemption_id uuid,
  savings_goal_status text,
  idempotency_replayed boolean
)
LANGUAGE plpgsql
SECURITY INVOKER
AS $$
BEGIN
  RETURN QUERY
  SELECT * FROM private.create_storefront_order_with_savings(
    p_merchant_id,
    p_customer_email,
    p_customer_name,
    p_items,
    p_customer_phone,
    p_shipping_fee,
    p_discount_amount,
    p_tax_amount,
    p_payment_method,
    p_payment_status,
    p_shipping_status,
    p_shipping_address,
    p_source,
    p_notes,
    p_ad_tracking,
    p_selected_quote_id,
    p_shipping_provider,
    p_tracking_number,
    p_user_id,
    p_tax_basis,
    p_gift_wrapping_fee,
    p_expected_total,
    p_savings_goal_id,
    p_savings_amount,
    p_savings_idempotency_key,
    p_checkout_idempotency_key,
    p_checkout_request_hash
  );
END;
$$;

REVOKE ALL ON FUNCTION public.create_storefront_order_with_savings(uuid, text, text, jsonb, text, numeric, numeric, numeric, text, text, text, jsonb, text, text, jsonb, uuid, text, text, uuid, text, numeric, numeric, uuid, numeric, text, text, text) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.create_storefront_order_with_savings(uuid, text, text, jsonb, text, numeric, numeric, numeric, text, text, text, jsonb, text, text, jsonb, uuid, text, text, uuid, text, numeric, numeric, uuid, numeric, text, text, text) TO authenticated, service_role;
REVOKE ALL ON FUNCTION private.create_storefront_order_with_savings(uuid, text, text, jsonb, text, numeric, numeric, numeric, text, text, text, jsonb, text, text, jsonb, uuid, text, text, uuid, text, numeric, numeric, uuid, numeric, text, text, text) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION private.create_storefront_order_with_savings(uuid, text, text, jsonb, text, numeric, numeric, numeric, text, text, text, jsonb, text, text, jsonb, uuid, text, text, uuid, text, numeric, numeric, uuid, numeric, text, text, text) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION private.create_storefront_order_with_quiz_voucher(
  p_merchant_id uuid,
  p_customer_email text,
  p_customer_name text,
  p_items jsonb,
  p_customer_phone text DEFAULT NULL,
  p_shipping_fee numeric DEFAULT 0,
  p_discount_amount numeric DEFAULT 0,
  p_tax_amount numeric DEFAULT 0,
  p_payment_method text DEFAULT 'card',
  p_payment_status text DEFAULT 'unpaid',
  p_shipping_status text DEFAULT 'pending',
  p_shipping_address jsonb DEFAULT NULL,
  p_source text DEFAULT 'online_store',
  p_notes text DEFAULT NULL,
  p_ad_tracking jsonb DEFAULT NULL,
  p_selected_quote_id uuid DEFAULT NULL,
  p_shipping_provider text DEFAULT NULL,
  p_tracking_number text DEFAULT NULL,
  p_user_id uuid DEFAULT NULL,
  p_tax_basis text DEFAULT 'exclusive',
  p_gift_wrapping_fee numeric DEFAULT 0,
  p_expected_total numeric DEFAULT NULL,
  p_route_proof jsonb DEFAULT '{}'::jsonb
)
RETURNS TABLE (
  id uuid,
  order_number text,
  tracking_token text,
  subtotal numeric,
  shipping_fee numeric,
  discount_amount numeric,
  tax_amount numeric,
  total numeric,
  customer_id uuid,
  customer_email text,
  customer_name text,
  customer_phone text,
  payment_status text,
  shipping_status text,
  payment_method text,
  shipping_address jsonb,
  merchant_id uuid,
  tax_basis text,
  gift_wrapping_fee numeric
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_award_amount numeric;
  v_award_id uuid;
  v_order record;
  v_order_item_id uuid;
  v_product_id uuid;
  v_variant_id uuid;
  v_condition text;
  v_voucher_item jsonb;
  v_voucher_item_count integer;
  v_reserved_order_id uuid;
  v_reserved_order_item_id uuid;
BEGIN
  IF p_user_id IS NULL THEN
    RAISE EXCEPTION 'quiz_voucher_user_required';
  END IF;

  IF p_items IS NULL OR pg_catalog.jsonb_typeof(p_items) <> 'array' THEN
    RAISE EXCEPTION 'quiz_voucher_invalid';
  END IF;

  WITH voucher_items AS (
    SELECT item
    FROM pg_catalog.jsonb_array_elements(p_items) AS item
    WHERE NULLIF(pg_catalog.btrim(item->>'voucher_award_id'), '') IS NOT NULL
  )
  SELECT
    pg_catalog.count(*)::integer,
    (pg_catalog.array_agg(item))[1]
    INTO v_voucher_item_count, v_voucher_item
  FROM voucher_items;

  IF v_voucher_item_count <> 1 THEN
    RAISE EXCEPTION 'quiz_voucher_invalid';
  END IF;

  BEGIN
    v_award_id := NULLIF(pg_catalog.btrim(v_voucher_item->>'voucher_award_id'), '')::uuid;
    v_product_id := COALESCE(
      NULLIF(v_voucher_item->>'product_id', '')::uuid,
      NULLIF(v_voucher_item->>'productId', '')::uuid,
      NULLIF(v_voucher_item->>'id', '')::uuid
    );
    v_variant_id := NULLIF(v_voucher_item->>'variant_id', '')::uuid;
  EXCEPTION WHEN invalid_text_representation THEN
    RAISE EXCEPTION 'quiz_voucher_invalid';
  END;

  v_condition := NULLIF(pg_catalog.btrim(COALESCE(v_voucher_item->>'condition', '')), '');

  IF v_award_id IS NULL OR v_product_id IS NULL THEN
    RAISE EXCEPTION 'quiz_voucher_invalid';
  END IF;

  IF NOT public.quiz_route_proof_valid(
    p_route_proof,
    'create_storefront_order_with_quiz_voucher',
    v_award_id::text,
    p_user_id
  ) THEN
    RAISE EXCEPTION 'quiz_voucher_route_proof_required' USING ERRCODE = 'QZ010';
  END IF;

  SELECT qa.amount, qa.reserved_order_id, qa.reserved_order_item_id
    INTO v_award_amount, v_reserved_order_id, v_reserved_order_item_id
  FROM public.quiz_awards qa
  JOIN public.quiz_events qe ON qe.id = qa.event_id
  JOIN public.customers c ON c.id = qa.customer_id
  WHERE qa.id = v_award_id
    AND qe.merchant_id = p_merchant_id
    AND c.user_id = p_user_id
  FOR UPDATE OF qa;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'quiz_voucher_award_not_found';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.quiz_awards qa
    WHERE qa.id = v_award_id
      AND qa.status <> 'approved'
  ) THEN
    RAISE EXCEPTION 'quiz_voucher_award_not_approved';
  END IF;

  -- 1. Check if a reserved order already exists for this award (serialized prize case)
  IF v_reserved_order_id IS NOT NULL THEN
    SELECT o.id, o.order_number, o.tracking_token, o.subtotal, o.shipping_fee, o.discount_amount, o.tax_amount, o.total, o.customer_id, o.customer_email, o.customer_name, o.customer_phone, o.payment_status, o.shipping_status, o.payment_method, o.shipping_address, o.merchant_id, o.tax_basis, o.gift_wrapping_fee
    INTO v_order
    FROM public.orders o
    WHERE o.id = v_reserved_order_id
    FOR UPDATE;

    IF v_order.id IS NULL THEN
      RAISE EXCEPTION 'quiz_voucher_reserved_order_not_found';
    END IF;

    -- Update order with shipping & user fields
    UPDATE public.orders
    SET
      customer_email = lower(trim(p_customer_email)),
      customer_name = trim(p_customer_name),
      customer_phone = NULLIF(trim(COALESCE(p_customer_phone, '')), ''),
      shipping_fee = COALESCE(p_shipping_fee, 0),
      payment_method = trim(p_payment_method),
      payment_status = CASE WHEN p_payment_method IN ('pod', 'pay_on_delivery') THEN 'pending' ELSE 'paid' END,
      shipping_address = p_shipping_address,
      shipping_provider = COALESCE(p_shipping_provider, shipping_provider),
      selected_quote_id = COALESCE(p_selected_quote_id, selected_quote_id),
      tracking_number = COALESCE(p_tracking_number, tracking_number),
      notes = COALESCE(p_notes, notes),
      updated_at = now()
    WHERE id = v_reserved_order_id
    RETURNING
      orders.id,
      orders.order_number,
      orders.tracking_token,
      orders.subtotal,
      orders.shipping_fee,
      orders.discount_amount,
      orders.tax_amount,
      orders.total,
      orders.customer_id,
      orders.customer_email,
      orders.customer_name,
      orders.customer_phone,
      orders.payment_status,
      orders.shipping_status,
      orders.payment_method,
      orders.shipping_address,
      orders.merchant_id,
      orders.tax_basis,
      orders.gift_wrapping_fee
    INTO v_order;

    -- Update the quiz award to claimed
    UPDATE public.quiz_awards
    SET status = 'claimed',
        claimed_at = pg_catalog.now(),
        route_proof_id = p_route_proof->>'proof_id'
    WHERE id = v_award_id;

    RETURN QUERY
    SELECT
      v_order.id::uuid,
      v_order.order_number::text,
      v_order.tracking_token::text,
      v_order.subtotal::numeric,
      v_order.shipping_fee::numeric,
      v_order.discount_amount::numeric,
      v_order.tax_amount::numeric,
      v_order.total::numeric,
      v_order.customer_id::uuid,
      v_order.customer_email::text,
      v_order.customer_name::text,
      v_order.customer_phone::text,
      v_order.payment_status::text,
      v_order.shipping_status::text,
      v_order.payment_method::text,
      v_order.shipping_address::jsonb,
      v_order.merchant_id::uuid,
      v_order.tax_basis::text,
      v_order.gift_wrapping_fee::numeric;
    RETURN;
  END IF;

  -- 2. Legacy / fallback path
  SELECT
    created.id,
    created.order_number,
    created.tracking_token,
    created.subtotal,
    created.shipping_fee,
    created.discount_amount,
    created.tax_amount,
    created.total,
    created.customer_id,
    created.customer_email,
    created.customer_name,
    created.customer_phone,
    created.payment_status,
    created.shipping_status,
    created.payment_method,
    created.shipping_address,
    created.merchant_id,
    created.tax_basis,
    created.gift_wrapping_fee
    INTO v_order
  FROM private.create_storefront_order(
    p_merchant_id => p_merchant_id,
    p_customer_email => p_customer_email,
    p_customer_name => p_customer_name,
    p_items => p_items,
    p_customer_phone => p_customer_phone,
    p_shipping_fee => p_shipping_fee,
    p_discount_amount => COALESCE(p_discount_amount, 0) + COALESCE(v_award_amount, 0),
    p_tax_amount => p_tax_amount,
    p_payment_method => p_payment_method,
    p_payment_status => p_payment_status,
    p_shipping_status => p_shipping_status,
    p_shipping_address => p_shipping_address,
    p_source => p_source,
    p_notes => p_notes,
    p_ad_tracking => p_ad_tracking,
    p_selected_quote_id => p_selected_quote_id,
    p_shipping_provider => p_shipping_provider,
    p_tracking_number => p_tracking_number,
    p_user_id => p_user_id,
    p_tax_basis => p_tax_basis,
    p_gift_wrapping_fee => p_gift_wrapping_fee,
    p_expected_total => p_expected_total
  ) AS created;

  UPDATE public.order_items
  SET quiz_award_id = v_award_id
  WHERE id = (
    SELECT oi.id
    FROM public.order_items oi
    WHERE oi.order_id = v_order.id
      AND oi.product_id = v_product_id
      AND oi.variant_id IS NOT DISTINCT FROM v_variant_id
      AND (v_condition IS NULL OR oi.condition IS NOT DISTINCT FROM v_condition)
      AND oi.quiz_award_id IS NULL
    ORDER BY oi.created_at, oi.id
    LIMIT 1
  )
  RETURNING public.order_items.id INTO v_order_item_id;

  IF v_order_item_id IS NULL THEN
    RAISE EXCEPTION 'quiz_voucher_order_item_not_found';
  END IF;

  UPDATE public.quiz_awards
  SET status = 'claimed',
      claimed_at = pg_catalog.now(),
      route_proof_id = p_route_proof->>'proof_id'
  WHERE id = v_award_id
    AND status = 'approved';

  IF NOT FOUND THEN
    RAISE EXCEPTION 'quiz_voucher_award_not_approved';
  END IF;

  RETURN QUERY
  SELECT
    v_order.id::uuid,
    v_order.order_number::text,
    v_order.tracking_token::text,
    v_order.subtotal::numeric,
    v_order.shipping_fee::numeric,
    v_order.discount_amount::numeric,
    v_order.tax_amount::numeric,
    v_order.total::numeric,
    v_order.customer_id::uuid,
    v_order.customer_email::text,
    v_order.customer_name::text,
    v_order.customer_phone::text,
    v_order.payment_status::text,
    v_order.shipping_status::text,
    v_order.payment_method::text,
    v_order.shipping_address::jsonb,
    v_order.merchant_id::uuid,
    v_order.tax_basis::text,
    v_order.gift_wrapping_fee::numeric;
END;
$$;

CREATE OR REPLACE FUNCTION public.create_storefront_order_with_quiz_voucher(
  p_merchant_id uuid,
  p_customer_email text,
  p_customer_name text,
  p_items jsonb,
  p_customer_phone text DEFAULT NULL,
  p_shipping_fee numeric DEFAULT 0,
  p_discount_amount numeric DEFAULT 0,
  p_tax_amount numeric DEFAULT 0,
  p_payment_method text DEFAULT 'card',
  p_payment_status text DEFAULT 'unpaid',
  p_shipping_status text DEFAULT 'pending',
  p_shipping_address jsonb DEFAULT NULL,
  p_source text DEFAULT 'online_store',
  p_notes text DEFAULT NULL,
  p_ad_tracking jsonb DEFAULT NULL,
  p_selected_quote_id uuid DEFAULT NULL,
  p_shipping_provider text DEFAULT NULL,
  p_tracking_number text DEFAULT NULL,
  p_user_id uuid DEFAULT NULL,
  p_tax_basis text DEFAULT 'exclusive',
  p_gift_wrapping_fee numeric DEFAULT 0,
  p_expected_total numeric DEFAULT NULL,
  p_route_proof jsonb DEFAULT '{}'::jsonb
)
RETURNS TABLE (
  id uuid,
  order_number text,
  tracking_token text,
  subtotal numeric,
  shipping_fee numeric,
  discount_amount numeric,
  tax_amount numeric,
  total numeric,
  customer_id uuid,
  customer_email text,
  customer_name text,
  customer_phone text,
  payment_status text,
  shipping_status text,
  payment_method text,
  shipping_address jsonb,
  merchant_id uuid,
  tax_basis text,
  gift_wrapping_fee numeric
)
LANGUAGE plpgsql
SECURITY INVOKER
AS $$
BEGIN
  RETURN QUERY
  SELECT * FROM private.create_storefront_order_with_quiz_voucher(
    p_merchant_id,
    p_customer_email,
    p_customer_name,
    p_items,
    p_customer_phone,
    p_shipping_fee,
    p_discount_amount,
    p_tax_amount,
    p_payment_method,
    p_payment_status,
    p_shipping_status,
    p_shipping_address,
    p_source,
    p_notes,
    p_ad_tracking,
    p_selected_quote_id,
    p_shipping_provider,
    p_tracking_number,
    p_user_id,
    p_tax_basis,
    p_gift_wrapping_fee,
    p_expected_total,
    p_route_proof
  );
END;
$$;

REVOKE ALL ON FUNCTION public.create_storefront_order_with_quiz_voucher(uuid, text, text, jsonb, text, numeric, numeric, numeric, text, text, text, jsonb, text, text, jsonb, uuid, text, text, uuid, text, numeric, numeric, jsonb) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.create_storefront_order_with_quiz_voucher(uuid, text, text, jsonb, text, numeric, numeric, numeric, text, text, text, jsonb, text, text, jsonb, uuid, text, text, uuid, text, numeric, numeric, jsonb) TO authenticated, service_role;
REVOKE ALL ON FUNCTION private.create_storefront_order_with_quiz_voucher(uuid, text, text, jsonb, text, numeric, numeric, numeric, text, text, text, jsonb, text, text, jsonb, uuid, text, text, uuid, text, numeric, numeric, jsonb) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION private.create_storefront_order_with_quiz_voucher(uuid, text, text, jsonb, text, numeric, numeric, numeric, text, text, text, jsonb, text, text, jsonb, uuid, text, text, uuid, text, numeric, numeric, jsonb) TO authenticated, service_role;


-- Task 5: Storefront and Feed availability RPCs

CREATE OR REPLACE FUNCTION private.get_public_serialized_variant_availability_counts(
  p_merchant_id uuid,
  p_product_ids uuid[],
  p_branch_id uuid DEFAULT NULL
)
RETURNS TABLE(product_id uuid, variant_id uuid, public_available_units integer)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_branch_valid boolean;
  v_only_active_branch_id uuid;
  v_active_branch_count integer;
BEGIN
  IF array_length(p_product_ids, 1) IS NULL OR array_length(p_product_ids, 1) > 200 THEN
    RAISE EXCEPTION 'too_many_product_ids' USING ERRCODE = '22023';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.merchants m
    WHERE m.id = p_merchant_id
      AND (COALESCE(m.is_platform_admin, FALSE) = TRUE OR COALESCE(m.is_published, FALSE) = TRUE)
  ) THEN
    RETURN;
  END IF;

  IF p_branch_id IS NOT NULL THEN
    SELECT EXISTS (
      SELECT 1 FROM public.branches b
      WHERE b.id = p_branch_id
        AND b.merchant_id = p_merchant_id
        AND b.active = true
    ) INTO v_branch_valid;

    IF v_branch_valid IS NOT TRUE THEN
      RETURN;
    END IF;
  ELSE
    SELECT count(*)::integer, (array_agg(id))[1] INTO v_active_branch_count, v_only_active_branch_id
    FROM public.branches
    WHERE merchant_id = p_merchant_id AND active = true;
  END IF;

  RETURN QUERY
  WITH eligible_products AS (
    SELECT p.id
    FROM public.products p
    WHERE p.merchant_id = p_merchant_id
      AND p.status = 'active'
      AND p.id = ANY(p_product_ids)
  ),
  variant_units AS (
    SELECT
      pv.product_id,
      CASE WHEN pv.is_inventory_anchor THEN NULL::uuid ELSE pv.id END AS variant_id,
      vi.id AS unit_id
    FROM public.product_variants pv
    JOIN eligible_products ep ON ep.id = pv.product_id
    JOIN public.variant_inventory vi ON vi.variant_id = pv.id
    WHERE pv.merchant_id = p_merchant_id
      AND vi.status = 'available'
      AND vi.order_id IS NULL
      AND vi.order_item_id IS NULL
      AND vi.sold_at IS NULL
      AND (
        CASE
          WHEN p_branch_id IS NOT NULL THEN
            (vi.branch_id = p_branch_id OR vi.branch_id IS NULL)
          ELSE
            CASE
              WHEN v_active_branch_count = 1 THEN
                (vi.branch_id = v_only_active_branch_id OR vi.branch_id IS NULL)
              ELSE
                vi.branch_id IS NULL
            END
        END
      )
  )
  SELECT vu.product_id, vu.variant_id, count(vu.unit_id)::integer AS public_available_units
  FROM variant_units vu
  GROUP BY vu.product_id, vu.variant_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_public_serialized_variant_availability_counts(
  p_merchant_id uuid,
  p_product_ids uuid[],
  p_branch_id uuid DEFAULT NULL
)
RETURNS TABLE(product_id uuid, variant_id uuid, public_available_units integer)
LANGUAGE plpgsql
STABLE
SECURITY INVOKER
AS $$
BEGIN
  RETURN QUERY
  SELECT * FROM private.get_public_serialized_variant_availability_counts(
    p_merchant_id,
    p_product_ids,
    p_branch_id
  );
END;
$$;

REVOKE ALL ON FUNCTION public.get_public_serialized_variant_availability_counts(uuid, uuid[], uuid) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_public_serialized_variant_availability_counts(uuid, uuid[], uuid) TO anon, authenticated, service_role;
REVOKE ALL ON FUNCTION private.get_public_serialized_variant_availability_counts(uuid, uuid[], uuid) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION private.get_public_serialized_variant_availability_counts(uuid, uuid[], uuid) TO anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION private.get_feed_product_variants(
  p_product_ids uuid[],
  p_merchant_id uuid
)
RETURNS TABLE(
  id uuid,
  product_id uuid,
  sku text,
  attributes jsonb,
  condition text,
  price_override numeric,
  stock_quantity integer
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  WITH merchant_scope AS (
    SELECT m.id
    FROM public.merchants AS m
    WHERE m.id = p_merchant_id
      AND (
        COALESCE(m.is_platform_admin, FALSE) = TRUE
        OR COALESCE(m.is_published, FALSE) = TRUE
      )
  ),
  requested_products AS (
    SELECT DISTINCT requested.product_id
    FROM unnest(
      CASE
        WHEN COALESCE(array_length(p_product_ids, 1), 0) <= 10000
          THEN COALESCE(p_product_ids, ARRAY[]::uuid[])
        ELSE ARRAY[]::uuid[]
      END
    ) AS requested(product_id)
  ),
  eligible_products AS (
    SELECT p.id, p.merchant_id
    FROM requested_products AS requested
    JOIN public.products AS p
      ON p.id = requested.product_id
    JOIN merchant_scope AS merchant
      ON merchant.id = p.merchant_id
    WHERE p.status = 'active'
  )
  SELECT
    pv.id,
    pv.product_id,
    pv.sku,
    pv.attributes,
    pv.condition,
    pv.price_override,
    pv.stock_quantity
  FROM eligible_products AS product
  JOIN public.product_variants AS pv
    ON pv.merchant_id = product.merchant_id
   AND pv.product_id = product.id
  WHERE pv.is_inventory_anchor IS NOT TRUE
  ORDER BY pv.product_id, pv.created_at, pv.id;
$$;

CREATE OR REPLACE FUNCTION public.get_feed_product_variants(
  p_product_ids uuid[],
  p_merchant_id uuid
)
RETURNS TABLE(
  id uuid,
  product_id uuid,
  sku text,
  attributes jsonb,
  condition text,
  price_override numeric,
  stock_quantity integer
)
LANGUAGE plpgsql
STABLE
SECURITY INVOKER
AS $$
BEGIN
  RETURN QUERY
  SELECT * FROM private.get_feed_product_variants(p_product_ids, p_merchant_id);
END;
$$;

REVOKE ALL ON FUNCTION public.get_feed_product_variants(uuid[], uuid) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_feed_product_variants(uuid[], uuid) TO anon, authenticated, service_role;
REVOKE ALL ON FUNCTION private.get_feed_product_variants(uuid[], uuid) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION private.get_feed_product_variants(uuid[], uuid) TO anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION private.get_storefront_product_variants(p_product_ids uuid[])
RETURNS TABLE(
  id uuid,
  product_id uuid,
  sku text,
  attributes jsonb,
  condition text,
  price_override numeric,
  stock_quantity integer,
  images jsonb,
  primary_image text,
  created_at timestamp with time zone,
  updated_at timestamp with time zone
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT
    pv.id,
    pv.product_id,
    pv.sku,
    pv.attributes,
    pv.condition,
    pv.price_override,
    pv.stock_quantity,
    pv.images,
    pv.primary_image,
    pv.created_at,
    pv.updated_at
  FROM public.product_variants AS pv
  JOIN public.products AS p
    ON p.id = pv.product_id
  JOIN public.merchants AS m
    ON m.id = p.merchant_id
  WHERE COALESCE(array_length(p_product_ids, 1), 0) <= 10000
    AND pv.product_id = ANY(COALESCE(p_product_ids, ARRAY[]::UUID[]))
    AND pv.merchant_id = p.merchant_id
    AND p.status = 'active'
    AND COALESCE(m.is_published, FALSE) = TRUE
    AND pv.is_inventory_anchor IS NOT TRUE
  ORDER BY pv.product_id, pv.created_at, pv.id;
$$;

CREATE OR REPLACE FUNCTION public.get_storefront_product_variants(p_product_ids uuid[])
RETURNS TABLE(
  id uuid,
  product_id uuid,
  sku text,
  attributes jsonb,
  condition text,
  price_override numeric,
  stock_quantity integer,
  images jsonb,
  primary_image text,
  created_at timestamp with time zone,
  updated_at timestamp with time zone
)
LANGUAGE plpgsql
STABLE
SECURITY INVOKER
AS $$
BEGIN
  RETURN QUERY
  SELECT * FROM private.get_storefront_product_variants(p_product_ids);
END;
$$;

REVOKE ALL ON FUNCTION public.get_storefront_product_variants(uuid[]) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_storefront_product_variants(uuid[]) TO anon, authenticated, service_role;
REVOKE ALL ON FUNCTION private.get_storefront_product_variants(uuid[]) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION private.get_storefront_product_variants(uuid[]) TO anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION private.convert_chat_order_to_paid_order_with_inventory(
  p_chat_order_id uuid,
  p_gateway text,
  p_reference text,
  p_amount numeric,
  p_currency text
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_chat_order record;
  v_order_id uuid;
  v_order_number text;
  v_expected_total numeric;
  v_item record;
  v_variant_name text;
  v_order_item_id uuid;
  v_confirm_res jsonb;
BEGIN
  -- 1. Lock and fetch chat order
  SELECT * INTO v_chat_order
  FROM public.chat_orders
  WHERE id = p_chat_order_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'chat_order_not_found' USING ERRCODE = 'P0002';
  END IF;

  IF v_chat_order.status <> 'pending_payment' THEN
    -- Idempotency check: if already completed/processing, find existing order
    IF v_chat_order.status IN ('completed', 'processing') THEN
      SELECT id, order_number INTO v_order_id, v_order_number
      FROM public.orders
      WHERE notes = 'Converted from chat order. Session: ' || v_chat_order.session_id;

      IF FOUND THEN
        RETURN jsonb_build_object(
          'success', true,
          'order_id', v_order_id,
          'order_number', v_order_number,
          'already_processed', true
        );
      END IF;
    END IF;
    RAISE EXCEPTION 'chat_order_already_processed_or_invalid_status' USING ERRCODE = '22023';
  END IF;

  -- 2. Validate amount/currency
  v_expected_total := COALESCE(v_chat_order.subtotal, 0) + COALESCE(v_chat_order.shipping_fee, 0);
  IF ABS(p_amount - v_expected_total) > 0.01 THEN
    RAISE EXCEPTION 'payment_amount_mismatch' USING ERRCODE = '22023';
  END IF;

  IF upper(trim(p_currency)) <> 'NGN' THEN
    RAISE EXCEPTION 'payment_currency_mismatch' USING ERRCODE = '22023';
  END IF;

  -- 3. Create the canonical paid order
  INSERT INTO public.orders (
    merchant_id,
    customer_id,
    customer_email,
    customer_name,
    customer_phone,
    shipping_address,
    subtotal,
    shipping_fee,
    total,
    payment_status,
    shipping_status,
    payment_method,
    currency,
    notes,
    source,
    tax_basis
  ) VALUES (
    v_chat_order.merchant_id,
    v_chat_order.customer_id,
    v_chat_order.customer_email,
    v_chat_order.customer_name,
    v_chat_order.customer_phone,
    v_chat_order.shipping_address,
    v_chat_order.subtotal,
    v_chat_order.shipping_fee,
    v_expected_total,
    'paid',
    'processing',
    COALESCE(p_gateway, 'bank_transfer'),
    'NGN',
    'Converted from chat order. Session: ' || v_chat_order.session_id,
    'chat',
    'exclusive'
  ) RETURNING id, order_number INTO v_order_id, v_order_number;

  -- 4. Create order items and claim inventory
  FOR v_item IN
    SELECT * FROM jsonb_to_recordset(v_chat_order.items) AS (
      product_id uuid,
      variant_id uuid,
      name text,
      quantity integer,
      price numeric
    )
  LOOP
    -- Reject hidden anchors
    IF v_item.variant_id IS NOT NULL AND EXISTS (
      SELECT 1 FROM public.product_variants
      WHERE id = v_item.variant_id AND is_inventory_anchor = true
    ) THEN
      RAISE EXCEPTION 'anchor_not_claimable_for_variant_product' USING ERRCODE = '22023';
    END IF;

    -- Get variant label
    v_variant_name := NULL;
    IF v_item.variant_id IS NOT NULL THEN
      SELECT public.format_variant_attributes_label(attributes) INTO v_variant_name
      FROM public.product_variants
      WHERE id = v_item.variant_id;
    END IF;

    INSERT INTO public.order_items (
      order_id,
      product_id,
      variant_id,
      variant_name,
      name,
      quantity,
      price,
      line_extension_amount,
      item_description
    ) VALUES (
      v_order_id,
      v_item.product_id,
      v_item.variant_id,
      v_variant_name,
      v_item.name,
      v_item.quantity,
      v_item.price,
      v_item.quantity * v_item.price,
      v_item.name
    ) RETURNING id INTO v_order_item_id;

    -- Claim serialized inventory units
    PERFORM private.claim_variant_inventory_units_for_order_item_internal(
      v_chat_order.merchant_id,
      v_order_id,
      v_order_item_id
    );
  END LOOP;

  -- 5. Confirm reservations order-wide
  v_confirm_res := private.confirm_order_inventory_reservations(
    v_chat_order.merchant_id,
    v_order_id
  );

  -- If strict serialized check failed, rollback via exception
  IF v_confirm_res ? 'exceptionCodes' AND jsonb_array_length(v_confirm_res->'exceptionCodes') > 0 THEN
    RAISE EXCEPTION 'serialized_inventory_unavailable' USING ERRCODE = '55000';
  END IF;

  -- 6. Create transaction record
  INSERT INTO public.transactions (
    merchant_id,
    order_id,
    amount,
    currency,
    status,
    gateway,
    gateway_reference,
    transaction_type,
    description
  ) VALUES (
    v_chat_order.merchant_id,
    v_order_id,
    v_expected_total,
    'NGN',
    'completed',
    p_gateway,
    p_reference,
    'payment',
    'Payment for order ' || v_order_number || ' (via chat)'
  );

  -- 7. Update chat order status to completed
  UPDATE public.chat_orders
  SET status = 'completed',
      updated_at = now()
  WHERE id = p_chat_order_id;

  RETURN jsonb_build_object(
    'success', true,
    'order_id', v_order_id,
    'order_number', v_order_number,
    'already_processed', false
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.convert_chat_order_to_paid_order_with_inventory(
  p_chat_order_id uuid,
  p_gateway text,
  p_reference text,
  p_amount numeric,
  p_currency text
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
AS $$
BEGIN
  IF auth.role() <> 'service_role' THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;

  RETURN private.convert_chat_order_to_paid_order_with_inventory(
    p_chat_order_id,
    p_gateway,
    p_reference,
    p_amount,
    p_currency
  );
END;
$$;

REVOKE ALL ON FUNCTION public.convert_chat_order_to_paid_order_with_inventory(uuid, text, text, numeric, text) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.convert_chat_order_to_paid_order_with_inventory(uuid, text, text, numeric, text) TO service_role;
REVOKE ALL ON FUNCTION private.convert_chat_order_to_paid_order_with_inventory(uuid, text, text, numeric, text) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION private.convert_chat_order_to_paid_order_with_inventory(uuid, text, text, numeric, text) TO service_role;
