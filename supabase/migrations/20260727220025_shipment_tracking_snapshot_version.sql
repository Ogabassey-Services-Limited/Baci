-- Database-owned shipment tracking versions and per-order timeline allocation.

CREATE SCHEMA IF NOT EXISTS private;
REVOKE ALL ON SCHEMA private FROM PUBLIC, anon, authenticated;

ALTER TABLE public.shipments
  ADD COLUMN IF NOT EXISTS tracking_snapshot_version integer NOT NULL DEFAULT 0
    CHECK (tracking_snapshot_version >= 0),
  ADD COLUMN IF NOT EXISTS tracking_timeline_generation integer NOT NULL DEFAULT 0
    CHECK (tracking_timeline_generation >= 0);

CREATE TABLE private.order_tracking_timeline_generations (
  order_id uuid PRIMARY KEY REFERENCES public.orders(id) ON DELETE CASCADE,
  last_generation integer NOT NULL DEFAULT 0 CHECK (last_generation >= 0),
  updated_at timestamptz NOT NULL DEFAULT pg_catalog.now()
);

ALTER TABLE private.order_tracking_timeline_generations ENABLE ROW LEVEL SECURITY;
ALTER TABLE private.order_tracking_timeline_generations FORCE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE private.order_tracking_timeline_generations
  FROM PUBLIC, anon, authenticated, service_role;

CREATE POLICY order_tracking_timeline_generations_postgres_only
  ON private.order_tracking_timeline_generations
  FOR ALL TO postgres
  USING (true) WITH CHECK (true);

-- Existing rows predate the database-owned generation.  Allocate deterministic
-- positive values without firing later tracking triggers while the backfill runs.
ALTER TABLE public.shipments DISABLE TRIGGER set_shipments_updated_at;

UPDATE public.shipments AS shipment
SET tracking_snapshot_version = GREATEST(shipment.tracking_snapshot_version, 1);

WITH ranked_shipments AS (
  SELECT
    shipment.id,
    pg_catalog.row_number() OVER (
      PARTITION BY shipment.order_id
      ORDER BY shipment.created_at, shipment.id
    )::integer AS tracking_timeline_generation
  FROM public.shipments AS shipment
  WHERE shipment.order_id IS NOT NULL
)
UPDATE public.shipments AS shipment
SET
  tracking_timeline_generation = ranked_shipments.tracking_timeline_generation
FROM ranked_shipments
WHERE ranked_shipments.id = shipment.id;

INSERT INTO private.order_tracking_timeline_generations AS allocator (
  order_id,
  last_generation,
  updated_at
)
SELECT
  shipment.order_id,
  pg_catalog.max(shipment.tracking_timeline_generation),
  pg_catalog.now()
FROM public.shipments AS shipment
WHERE shipment.order_id IS NOT NULL
GROUP BY shipment.order_id
ON CONFLICT (order_id) DO UPDATE
SET
  last_generation = GREATEST(
    allocator.last_generation,
    EXCLUDED.last_generation
  ),
  updated_at = pg_catalog.now();

ALTER TABLE public.shipments ENABLE TRIGGER set_shipments_updated_at;

CREATE OR REPLACE FUNCTION private.allocate_shipment_tracking_generation(
  p_old_order_id uuid,
  p_new_order_id uuid
)
RETURNS TABLE (order_id uuid, tracking_timeline_generation integer)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  RETURN QUERY
  WITH candidate_order_ids AS (
    SELECT DISTINCT candidate.order_id
    FROM pg_catalog.unnest(ARRAY[p_old_order_id, p_new_order_id]::uuid[])
      AS candidate(order_id)
    WHERE candidate.order_id IS NOT NULL
    ORDER BY candidate.order_id
  ), allocations AS (
    INSERT INTO private.order_tracking_timeline_generations AS allocator (
      order_id,
      last_generation,
      updated_at
    )
    SELECT candidate.order_id, 1, pg_catalog.now()
    FROM candidate_order_ids AS candidate
    ORDER BY candidate.order_id
    ON CONFLICT (order_id) DO UPDATE
    SET
      last_generation = allocator.last_generation + 1,
      updated_at = pg_catalog.now()
    RETURNING allocator.order_id, allocator.last_generation
  )
  SELECT allocator.order_id, allocator.last_generation
  FROM allocations AS allocator
  ORDER BY allocator.order_id;
END;
$$;

ALTER FUNCTION private.allocate_shipment_tracking_generation(uuid, uuid) OWNER TO postgres;
REVOKE ALL ON FUNCTION private.allocate_shipment_tracking_generation(uuid, uuid)
  FROM PUBLIC, anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION private.bump_shipment_tracking_snapshot_version()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NEW.order_id IS NULL THEN
    NEW.tracking_timeline_generation := 0;
  ELSIF TG_OP = 'INSERT'
     OR NEW.provider IS DISTINCT FROM OLD.provider
     OR NULLIF(btrim(NEW.tracking_number), '')
       IS DISTINCT FROM NULLIF(btrim(OLD.tracking_number), '')
     OR NEW.order_id IS DISTINCT FROM OLD.order_id THEN
    SELECT allocation.tracking_timeline_generation
    INTO NEW.tracking_timeline_generation
    FROM private.allocate_shipment_tracking_generation(
      CASE WHEN TG_OP = 'INSERT' THEN NULL ELSE OLD.order_id END,
      NEW.order_id
    ) AS allocation
    WHERE allocation.order_id = NEW.order_id;
  END IF;

  IF TG_OP = 'INSERT' THEN
    NEW.tracking_snapshot_version := GREATEST(NEW.tracking_snapshot_version, 1);
  ELSIF NEW.provider IS DISTINCT FROM OLD.provider
     OR NEW.provider_shipment_id IS DISTINCT FROM OLD.provider_shipment_id
     OR NEW.tracking_number IS DISTINCT FROM OLD.tracking_number
     OR NEW.carrier_name IS DISTINCT FROM OLD.carrier_name
     OR NEW.service_tier IS DISTINCT FROM OLD.service_tier
     OR NEW.status IS DISTINCT FROM OLD.status
     OR NEW.estimated_delivery_at IS DISTINCT FROM OLD.estimated_delivery_at
     OR NEW.delivered_at IS DISTINCT FROM OLD.delivered_at
     OR NEW.cancelled_at IS DISTINCT FROM OLD.cancelled_at
     OR NEW.current_location IS DISTINCT FROM OLD.current_location
     OR NEW.tracking_events IS DISTINCT FROM OLD.tracking_events
     OR NEW.last_tracked_at IS DISTINCT FROM OLD.last_tracked_at
     OR NEW.order_id IS DISTINCT FROM OLD.order_id THEN
    NEW.tracking_snapshot_version := OLD.tracking_snapshot_version + 1;
    IF NEW.provider IS NOT DISTINCT FROM OLD.provider
       AND NULLIF(btrim(NEW.tracking_number), '')
         IS NOT DISTINCT FROM NULLIF(btrim(OLD.tracking_number), '')
       AND NEW.order_id IS NOT DISTINCT FROM OLD.order_id THEN
      NEW.tracking_timeline_generation := OLD.tracking_timeline_generation;
    END IF;
  ELSE
    NEW.tracking_snapshot_version := OLD.tracking_snapshot_version;
    NEW.tracking_timeline_generation := OLD.tracking_timeline_generation;
  END IF;

  RETURN NEW;
END;
$$;

ALTER FUNCTION private.bump_shipment_tracking_snapshot_version() OWNER TO postgres;
REVOKE ALL ON FUNCTION private.bump_shipment_tracking_snapshot_version()
  FROM PUBLIC, anon, authenticated, service_role;

DROP TRIGGER IF EXISTS bump_shipment_tracking_snapshot_version ON public.shipments;
CREATE TRIGGER bump_shipment_tracking_snapshot_version
BEFORE INSERT OR UPDATE ON public.shipments
FOR EACH ROW EXECUTE FUNCTION private.bump_shipment_tracking_snapshot_version();

CREATE UNIQUE INDEX shipments_order_tracking_timeline_generation_key
  ON public.shipments (order_id, tracking_timeline_generation)
  WHERE order_id IS NOT NULL;
