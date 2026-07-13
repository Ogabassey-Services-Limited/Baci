-- Fail the atomic repair-pickup claim closed when the repair has already reached
-- a terminal status (completed/cancelled/rejected).
--
-- bookRepairPickup() reads the repair status once, then persists a quote and
-- calls claim_repair_pickup_booking(). If another admin cancels/completes the
-- repair in that window, the previous claim predicate (id + merchant + empty
-- shipment + free lock) still matched, so a paid courier pickup could be booked
-- and linked to a terminal repair (Codex P2, TOCTOU).
--
-- This recreates the claim function to (1) exclude terminal repairs from the
-- claiming UPDATE and (2) report a `terminal` flag so the caller can surface the
-- same `terminal_status` failure it returns for the up-front check. Changing the
-- RETURNS TABLE shape requires DROP + CREATE.

DROP FUNCTION IF EXISTS public.claim_repair_pickup_booking(uuid, uuid, uuid, integer);

CREATE FUNCTION public.claim_repair_pickup_booking(
  p_repair_id uuid,
  p_merchant_id uuid,
  p_lock_token uuid,
  p_lock_timeout_seconds integer DEFAULT 900
)
RETURNS TABLE(
  claimed boolean,
  shipment_id uuid,
  terminal boolean
)
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
BEGIN
  IF auth.role() <> 'service_role'
     AND NOT public.check_staff_permission((SELECT auth.uid()), p_merchant_id, 'repairs', 'edit') THEN
    RAISE EXCEPTION 'forbidden_claim_repair_pickup_booking'
      USING ERRCODE = '42501';
  END IF;

  -- Alias + qualify every predicate column: `shipment_id` is also an OUT column
  -- of this function, so an unqualified reference is ambiguous under the default
  -- plpgsql.variable_conflict = error (SQLSTATE 42702) — the same class of bug
  -- that took down create_storefront_order. Qualifying via `r` binds to the
  -- table column.
  UPDATE public.repairs AS r
  SET pickup_booking_lock_token = p_lock_token,
      pickup_booking_started_at = now()
  WHERE r.id = p_repair_id
    AND r.merchant_id = p_merchant_id
    AND r.shipment_id IS NULL
    -- Fail closed: never claim a pickup for a terminal repair.
    AND r.status NOT IN ('completed', 'cancelled', 'rejected')
    AND (
      r.pickup_booking_lock_token IS NULL
      OR r.pickup_booking_started_at IS NULL
      OR r.pickup_booking_started_at <
        now() - make_interval(secs => greatest(p_lock_timeout_seconds, 0))
    );

  IF FOUND THEN
    RETURN QUERY
    SELECT true, NULL::uuid, false;
    RETURN;
  END IF;

  RETURN QUERY
  SELECT false,
         r.shipment_id,
         (r.status IN ('completed', 'cancelled', 'rejected')) AS terminal
  FROM public.repairs AS r
  WHERE r.id = p_repair_id
    AND r.merchant_id = p_merchant_id;
END;
$$;

REVOKE ALL ON FUNCTION public.claim_repair_pickup_booking(uuid, uuid, uuid, integer)
  FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.claim_repair_pickup_booking(uuid, uuid, uuid, integer)
  TO authenticated, service_role;

COMMENT ON FUNCTION public.claim_repair_pickup_booking(uuid, uuid, uuid, integer) IS
  'Atomically claims provider-backed pickup booking for a repair, failing closed on terminal status, and reports already-booked/in-progress/terminal state.';
