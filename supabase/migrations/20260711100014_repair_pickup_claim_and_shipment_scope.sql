-- Prevent duplicate repair pickup charges and keep repair shipments tenant-scoped.

ALTER TABLE public.repairs
  ADD COLUMN IF NOT EXISTS pickup_booking_lock_token uuid,
  ADD COLUMN IF NOT EXISTS pickup_booking_started_at timestamptz;

CREATE INDEX IF NOT EXISTS repairs_pickup_booking_lock_idx
  ON public.repairs (pickup_booking_lock_token)
  WHERE pickup_booking_lock_token IS NOT NULL;

COMMENT ON COLUMN public.repairs.pickup_booking_lock_token IS
  'Short-lived token used to serialize provider-backed repair pickup booking.';
COMMENT ON COLUMN public.repairs.pickup_booking_started_at IS
  'Timestamp for expiring stale repair pickup booking locks.';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'shipments_id_merchant_id_key'
      AND conrelid = 'public.shipments'::regclass
  ) THEN
    ALTER TABLE public.shipments
      ADD CONSTRAINT shipments_id_merchant_id_key UNIQUE (id, merchant_id);
  END IF;
END $$;

UPDATE public.repairs AS r
SET shipment_id = NULL
WHERE r.shipment_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1
    FROM public.shipments AS s
    WHERE s.id = r.shipment_id
      AND s.merchant_id = r.merchant_id
  );

ALTER TABLE public.repairs
  DROP CONSTRAINT IF EXISTS repairs_shipment_fk;

ALTER TABLE public.repairs
  ADD CONSTRAINT repairs_shipment_fk
  FOREIGN KEY (shipment_id, merchant_id)
  REFERENCES public.shipments (id, merchant_id)
  ON DELETE SET NULL (shipment_id)
  NOT VALID;

ALTER TABLE public.repairs VALIDATE CONSTRAINT repairs_shipment_fk;

CREATE OR REPLACE FUNCTION public.claim_repair_pickup_booking(
  p_repair_id uuid,
  p_merchant_id uuid,
  p_lock_token uuid,
  p_lock_timeout_seconds integer DEFAULT 900
)
RETURNS TABLE(
  claimed boolean,
  shipment_id uuid
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

  UPDATE public.repairs
  SET pickup_booking_lock_token = p_lock_token,
      pickup_booking_started_at = now()
  WHERE id = p_repair_id
    AND merchant_id = p_merchant_id
    AND shipment_id IS NULL
    AND (
      pickup_booking_lock_token IS NULL
      OR pickup_booking_started_at IS NULL
      OR pickup_booking_started_at <
        now() - make_interval(secs => greatest(p_lock_timeout_seconds, 0))
    );

  IF FOUND THEN
    RETURN QUERY
    SELECT true, NULL::uuid;
    RETURN;
  END IF;

  RETURN QUERY
  SELECT false, r.shipment_id
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
  'Atomically claims provider-backed pickup booking for a repair and reports already-booked or in-progress state.';
